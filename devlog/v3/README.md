# V3 版本（STATIC_SITE 原型）

> 收纳时间：2026-10-04  
> 来源：CoWork 工作区 `workspace-ag4024lpbr`

## 说明

这是 BoaBite V3 的可运行原型，与 V1、V2 **并列存放、互不覆盖**。

- V1 快照：`devlog/v1/app`（只读保留）
- V2 快照：`devlog/v2/app`；仓库根目录仍是 V2 当前实现（只读保留）
- V3 原型：本目录 `devlog/v3/app`

产品需求以本目录内 `app/PRD.md` 为准。仓库根部 `PRD_3.0.md` 记录 3.0 架构分层与交付约束。

## 运行方式

在仓库根目录：

```bash
python3 -m http.server 8003 --bind 0.0.0.0 --directory devlog/v3/app
```

或：

```bash
npm run dev:v3
```

访问：http://localhost:8003/

## 目录结构

```
devlog/v3/
  README.md
  app/
    index.html          # 首页 / 相机 / 抠像确认 / 投食状 / 品鉴加载 / 品鉴结果
    app.js              # 流程与 mock 识别
    style.css
    PRD.md              # V3 产品需求
    design/assets/      # 界面切图
    media/              # 参考图与过程素材
    serve.py            # 本地静态预览
```

## 当前范围

已实现投喂主链路（识别/品鉴为 mock）。日历（P1）、人设（P2）仅入口占位。
