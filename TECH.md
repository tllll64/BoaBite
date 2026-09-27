# BoaBite 技术文档（3.0 架构与前后端契约）

> 定位：前后端**唯一的对接契约**（PRD_3.0.md §2.1），也是交付形态与数据链路的技术基准。
> 原则：阶段一的假数据按终态（WEB_APP）API 响应形状制作，阶段二迁移时前端调用方不变。
> 更新时间：2026-09-27

## 1. 交付形态与阶段

| 阶段 | 平台形态 | 内容 | server/ | 数据 |
| --- | --- | --- | --- | --- |
| 阶段一（当前） | STATIC_SITE | 纯前端原型（3.0 重构后） | ❌ 禁止存在 | 假数据在前端，形状=终态 API 响应 |
| 阶段二（终态） | WEB_APP | Express 后端 + PG + AI 网关 | ✅ 必含 | 真实数据链路 |

## 2. CoWork 平台约束（已确认）

- 后端语言：**仅 Node.js（Express）**；无 Python / Java / Go。
- 数据库：**PostgreSQL**（平台注入连接配置）；无 Redis / MQ / S3 / 向量库。
- AI：**平台 AI 网关**（`guard_sdk/ai`，凭据自动注入，前端不持有任何 Key）。
- Pod：1–2GB 内存、**无公网出口** → 图片不能引用外链，以 base64 入 PG（后续若平台提供对象存储再迁移）。
- 无云函数：要服务端能力只有 WEB_APP 一条路。

## 3. 数据链路终态

```text
拍照/输入 → POST /api/taste → AI 网关生成品鉴文案 + kcal → 写入 PG
        → 首页蛇形态 / 当天摘要 ← GET /api/feedings
        → 记录页（当天与历史）  ← GET /api/feedings?date=...
```

蛇的形态与食物轮廓布局由**前端**根据投喂记录推导（布局算法在前端，见 BOABITE_DESIGN.md §7.1），后端只存事实数据，不存渲染布局。

## 4. API 契约

### 4.1 POST /api/taste（核心投喂）

请求体：

```json
{
  "photo": "data:image/png;base64,...",
  "food": "用户填写的食物名称",
  "reason": "为什么忍住不吃"
}
```

成功（201）：

```json
{
  "id": "uuid",
  "date": "2026-09-27",
  "createdAt": 1730000000000,
  "food": "识别或确认的食物名称",
  "reason": "用户写下的原因",
  "calories": 150,
  "duration": 90,
  "description": "蛇视角的品鉴文案",
  "comparison": "相当于四分之一只兔子",
  "tone": "正向 | 中性 | 负向"
}
```

失败语义（蛇不吞下、不写记录）：

- `400`：缺必填字段（food / reason 必填，photo 可缺省——见 §6 待定）
- `502`：AI 网关失败，前端提示「重试 / 返回修改」，当前投喂不计入

### 4.2 GET /api/feedings?date=YYYY-MM-DD

```json
{
  "date": "2026-09-27",
  "items": [
    { "id": "...", "createdAt": 0, "food": "...", "calories": 150, "description": "...", "photo": "..." }
  ]
}
```

首页当天摘要（耗时 / 热量 / 次数）由前端对 `items` 本地聚合，不单独提供 `/api/home`。

## 5. PG 数据模型

```sql
CREATE TABLE IF NOT EXISTS feedings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT NOT NULL DEFAULT 'local',   -- 账号体系待定，先单用户
  date         DATE NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  food         TEXT NOT NULL,
  reason       TEXT NOT NULL,
  photo        TEXT,                            -- base64；平台有对象存储后迁移
  calories     INTEGER,
  duration     INTEGER,                         -- 单位：分钟
  description  TEXT,                            -- 蛇视角品鉴文案
  comparison   TEXT,                            -- 动物类比
  tone         TEXT                             -- 正向|中性|负向
);
CREATE INDEX IF NOT EXISTS idx_feedings_date ON feedings (date);
```

字段与 PRD.md §8.2（V2 投喂记录）对齐，`estimatedCalories / estimatedDuration / snakeState` 收拢为上述事实字段；蛇形态由前端推导。

## 6. 前端数据层抽象（阶段一 / 二共用）

```text
app/js/api.js        # 唯一数据入口：tasteFeed() / getFeedings(date)
  ├─ 阶段一实现：localStorage 假数据（形状 = 上文响应 JSON）
  └─ 阶段二实现：fetch('/api/taste' | '/api/feedings')，调用方不变
```

规则：前端业务代码**只依赖 api.js 的返回形状**，不直接读写 localStorage；迁移到 WEB_APP 时只替换 api.js 的实现，页面代码零改动。

## 7. 部署与发布（脚本自动化，不手动拖文件）

- **STATIC_SITE**：沙箱起预览服务并注册 `projectPath` → 平台上点发布 → 平台 package API 打包已注册目录（无需本地产 zip）。
- **WEB_APP**：本地 `guard verify`（全绿才准过）→ `guard pack` 产出标准 zip（顶层含 `install.sh / start.sh / health.sh`）→ 平台在 Pod 内运行。

## 8. 与 PRD 分层的关系

- 本文档即 PRD_3.0.md §2.1 中的「API 契约」——两端唯一必须保持一致的内容。
- 阶段一 = 前端层在 STATIC_SITE 的完整呈现（假数据按本文档形状）；
- 阶段二 = 前端层 + 后端层在 WEB_APP 的完整呈现（本文档为后端实现基准）。

## 9. 待定项

1. 账号体系与鉴权：阶段二先单用户（`user_id='local'`），是否做多用户待定。
2. `photo` 是否必填：STATIC_SITE 阶段相机可用时必填；WEB_APP 阶段 base64 体积与 PG 容量待评估。
3. AI 网关的调用封装（品鉴文案 + kcal 是否一次调用、温度/模型参数）待阶段二实现时确认。
4. 阶段一假数据的种子来源：优先用真实产品体验产出样例记录，不编造夸张数值。
