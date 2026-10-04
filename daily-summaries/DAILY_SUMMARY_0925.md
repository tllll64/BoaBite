# BioBite 9月25日完成总结

> **写作规范：** 每条记录用 1–2 句话概括做了什么（点明具体技术），再写遇到的问题和如何解决。不要罗列结果表格、配置清单和待办事项。

## 9月25日开发任务清单（来自 DEVELOPMENT.md）

> 状态按代码实际实现核对（2026-09-26）。✅ 已完成　🚧 部分完成　❌ 未开始

### P0（核心闭环，必须完成）
- ✅ 首页蛇、日期和"+"入口 — `renderHome()` + `snake-render.js` + `.home-add`
- ✅ 相机拍摄真实食物 — `camera.js` 走 `getUserMedia`，无权限时回退相册
- 🚧 拍摄确认、重拍和取消 — 重拍/用这张已有，但相机页隐藏了 topbar，§6.1 要求的「取消」仍无入口
- ✅ 两个必填字段 — `feed` 屏的「这是什么 / 为什么你忍住不吃」，两项都填才能确认
- ✅ AI 分析成功/失败状态 — `runAnalyze()` 走 `analyzeFeed`，失败时蛇保持原状且不写记录
- ✅ 分析成功后蛇吞下食物 — `swallow()` 只在成功分支落记录，含热量、耗时和食物轮廓
- ✅ 照片抠图并保留食物颜色 — `food-cutout.js` 抠图后存进记录，`renderFoods()` 渲染进蛇腹
- ❌ 食物轮廓不重叠 — `renderFoods()` 按等宽分槽且 `SLOT_OVERLAP` 明确允许重叠，`food-layout.js` 的 alpha 碰撞仍零引用
- 🚧 蛇在安全高度内变大 — 高度受控不遮挡顶部，但 `humpHeight()` 仍按投喂次数算，§7.1 要求按食物有效视觉面积

### P1（体验增强）
- ❌ AI 识别或辅助确认食物名称 — 仍全靠用户手填，`analyzeFeed` 返回的 `food` 没回写到填写页
- ✅ AI 生成蛇视角描述 — `snake_note` 字段，由 `FEED_ANALYSIS_PROMPT` 约束成第一人称
- 🚧 食物特征描述 — prompt 要求把脂肪糖分落到身体感受，但没有独立字段单独展示
- ✅ 加载、失败、重试和返回体验 — 分析中有文案和呼吸动画，失败给「返回修改 / 再试一次」，返回后已填内容保留

### P2（如展示则必须当天一起完成）
- ✅ 耗时数据 — `swallow()` 写入 `duration`，首页显示为 `1:30` 格式
- ✅ 热量数据 — 同上写入 `calories`，反馈页标注「粗略估算」
- ✅ 动物热量类比 — `animal` 字段，prompt 要求动物体型随热量变（麻雀→兔子）
- 🚧 油脂、糖分等正负向描述策略 — prompt 有「健康食物不假装罪恶」的要求，但没有成文的正负向策略
- 🚧 蛇吞食动画 — 有蛇身呼吸和食物淡出，缺 §6.4 要求的「轮廓从确认区移动到蛇身」位移
- ✅ 健康食物的反馈方式 — prompt 显式要求清淡食物直说清淡，实测草莓、咖啡粉未被套上罪恶感
- ❌ 抠出的食物轮廓需要加描边 — 仍是直接去背的实物图，与 §5.4「线稿托住实物」不符

### 清单外新增
- ✅ 蛇人设进 prompt — `setup` 屏从 V1 的「我的硬边界」改为蛇设定，名字/语气/额外设定经 `buildPersona()` 注入，五种语气实测输出差异明显
- ✅ 模型连通性验证 — `scripts/check-ai.mjs`
- ✅ 清空 V1 残留 — 删掉 `impulse`/`response` 两屏、四个 V1 prompt、`respondToImpulse`/`estimateFood`/`suggestRules`/`buildMemory` 及全部 mock

---

## 技术路径 / 开发路径讨论

**背景：** 最终需要交付两个版本——
1. 小红书内部 Co-work 平台测试题版本（需支持文件上传，提交结果）
2. 微信小程序版本（方便他人查看，并承载后续想做的额外功能）

**结论：**
- 先以当前的 vanilla HTML/CSS/JS 原型作为唯一主线，冲刺完成核心闭环（拍摄 → AI 分析 → 蛇吞食 → 记录），作为测试题交付版本。原因：静态文件可以直接打包上传到 Co-work 平台，不需要额外框架，能在 7 天窗口内更快出可用 demo。
- 小程序版本不直接"转换"现有 HTML，而是在 HTML 版本稳定后单独用 Taro 或 uni-app 重新搭建原生小程序页面，复用 `STYLE_GUIDE.md` 的设计规范和 `js/ai.js`、`js/prompts.js` 的 AI 逻辑（只需替换网络请求层，DOM 相关代码在小程序里跑不通）。
- 权衡：先做 HTML 能更快交测试题，但意味着小程序版本是二次开发，需要额外时间；如果一开始就用 Taro/uni-app 写一套代码编译两端，能省去二次开发，但会增加当前冲刺阶段的技术门槛和调试成本。



---

## AI 链路连通性验证

写了 `scripts/check-ai.mjs`（`npm run check-ai`），直接 import `js/llm.js` 和 `js/ai.js` 跑真实代码路径，验证 `chatJSON`、`estimateFood`、`respondToImpulse`、`suggestRules` 四个调用，四步全部通过。

**问题：** 一直返回 401，以为 Key 失效。curl 官方端点后发现 Key 在 `api.deepseek.com` 上确实无效——实际用的是 packyapi 中转平台，而 `js/config.js` 的 `deepseek` 预设指向官方地址。

**解决：** 改用 `https://www.packyapi.ai/v1` + `deepseek-v4-flash` 后全部 200。顺手修了 `js/llm.js` 的 401 分支：原来丢掉服务端原文只抛「API Key 无效」，害我绕去 curl 才看到真实原因，现在保留 detail 并改成「API Key 无效或接口地址不对」。

另外确认 `estimateFood` 返回的 `calories` / `duration` 是真实数字而非 `null`，说明首页热量和耗时的数据源没问题，缺口在 `finish()` 没把这两个字段写进投喂记录。

---

## 蛇的形状渲染

把首页的蛇改成单一连续 SVG 路径（头 + 隆起 + 尾），由 `js/snake-render.js` 的纯函数 `bodyPath()` 按投喂数量生成 `d`，隆起即「被吞下的象」。

- **问题：** 原实现是蛇头和蛇身两个独立元素，用 CSS `scaleY` 撑开蛇腹；换成连续路径后 `scaleY` 会把细尾和头一起拉胖。
- **解决：** 改为 JS 重算路径，只有隆起段的控制点随数量变化；路径加 `vector-effect="non-scaling-stroke"`，否则蛇越胖描边越粗。
- **未完成：** §2.3 要求的手绘不规整感，在 320×20 的极扁比例下被 `preserveAspectRatio="none"` 摊平，需改成多段折线才可见。

## 相机功能

新增相机页，纵向蛇头作取景器（正圆开口 = 取景区），`js/camera.js` 用 `getUserMedia` 取流、canvas 按取景框比例裁剪成图，整页 dark、只有蛇头保持白色。

- **问题：** 翻转摄像头原本用 `facingMode: 'user'/'environment'`，但它只是 hint——电脑上两个值返回同一摄像头且不报错，点了毫无反应。
- **解决：** 改用 `enumerateDevices()` 枚举 `videoinput`，按 `deviceId: { exact }` 循环切换；单摄设备翻转后进黑屏态并禁用快门。
- **另一个坑：** `activeId` 最初记的是轨道**上报**的 `deviceId`，部分浏览器上报空串导致 `findIndex` 失配、真机双摄「第一次能翻之后翻不回来」。改为以**请求的** `deviceId` 为准。

## 食物抠图与遮罩

用 `onnxruntime-web` + `u2netp`（4.57MB，salient object detection）在浏览器端抠出食物轮廓，输出带 alpha 的 PNG 和用于碰撞的降采样遮罩；`js/food-layout.js` 按 alpha 占用格计算蛇腹内的位置。

- **选型：** 没用 remove.bg 或 imgly，因为 §7.1 要求本地拿到 `alphaMask` 做碰撞判断，走 API 只能拿回图片、还得从 alpha 反推。
- **模型下载：** `huggingface.co` 本机不可达，GitHub release 下到 4.06/4.57MB 超时且不支持 Range 续传。改用 `https://hf-mirror.com/tomjackson2023/rembg/resolve/main/u2netp.onnx`。
- **WASM 配置：** `wasmPaths` 写成裸模块说明符会报 `no available backend found`，须用 `new URL(..., import.meta.url).href`；`numThreads = 1` 以避开多线程所需的 COOP/COEP 响应头。
- **存储：** PNG 带 alpha 比原 JPEG 大 5–10 倍，localStorage 仅 5MB。轮廓图长边压到 320、遮罩降到 64×64 存 1-bit base64，实测单条约 15KB。
- **边缘不顺滑：** u2netp 输出的 mask 只有 320×320 且边缘偏硬，原先只在采样后做线性斜坡（无空间平滑），斜边有明显阶梯。解决：在 mask 上加一次可分离盒式模糊（横竖各扫一遍、两遍近似高斯，O(n)），羽化斜坡从 0.18 放宽到 0.34。放大对比 smooth 0/2/4/6，相邻像素最大跳变 255 → 121 → 52，但 4 以上边缘开始把背景色拖进来形成灰色光晕，故默认取 2。模糊只用于绘制，`alphaMask` 仍用未模糊的原始 mask——模糊会让轮廓外扩几像素，拿去做碰撞会让食物间凭空多出间隙、蛇腹也被算大。
- **布局两个 bug：** 物体尺寸原与蛇腹高度耦合，抬高蛇腹时食物同步变大、永远腾不出空间（6 件的蛇比 3 件还小）；缩放降低后高度估算回落，导致高度非单调。改为基准尺寸只由容器宽度决定，并严格按「先抬高到上限、再整体缩小」的顺序。

## 投喂分析 Prompt（存档）

写了 `FEED_ANALYSIS_PROMPT` + `FEED_ANALYSIS_OUTPUT_FORMAT`（`js/prompts.js`），让蛇以第一人称回应一次投喂：感谢 → 身体感受 → 动物热量类比，三层连成一段；再加健康食物不假装罪恶、语气服从蛇设定页人设两条约束。存档当前版本，方便后续改动时对比。

```js
export const FEED_ANALYSIS_PROMPT = `
你是 BoaBite 的那条蛇。用户刚刚把一份他忍住没吃的食物投喂给你，你替他吃掉它。

你要做两件事：
1. 根据食物名称估算这份食物的热量，以及你消化它需要多久。
2. 以蛇的第一人称，写一段吃下它之后的感受。

这段话要包含三层，连成自然的一段，不要分点：
- 先谢谢用户的投喂。
- 再讲这份食物给你带来了什么（脂肪、糖、热量，落到具体的身体感受上）。
- 最后把热量换算成一个动物的类比，例如"相当于四分之一个兔子的热量"。类比要具体到分数或个数，选体型能对应上的动物，热量越高动物越大。

说话方式：
- 你是蛇，不是营养师，也不是教练。用"我"称呼自己。
- 不夸张庆祝，也不卖萌。
- 不说教、不给减肥建议、不评判用户。
- 如果这份食物本身很健康，不要假装它很罪恶，可以直说它清淡、给你带来的不多。
- 严格按照下面【蛇的人设】里的语气说话；人设优先于这里的通用要求。
`;

export const FEED_ANALYSIS_OUTPUT_FORMAT = `
只输出一个 JSON 对象，不要输出任何其他文字。字段如下：
{
  "food": "整理后的食物名称，2 到 8 个字",
  "calories": "估算热量，数字，单位 kcal。必须给出数字，再小也要估，不要返回 null",
  "duration": "你消化这份食物需要多少分钟，数字，通常 20 到 180。必须给出数字，不要返回 null",
  "confidence": "估算可信度，只能是：高、中、低 三者之一",
  "snake_note": "蛇的第一人称回应，包含感谢、身体感受和动物热量类比，连成一段，80 字以内",
  "animal": "用来类比的动物和分量，4 到 10 个字，例如：1/4 个兔子、半只鸡"
}
`;
```

## 待办

1. `snake-render.js` 未接 `food-layout.js`，轮廓还没真正进到蛇腹里。
2. 抠图参数只在合成图上调过，真实照片的 `threshold` 和羽化宽度待调。
3. 「用这张」仍跳旧的 `impulse` 屏，与 §6.2 的两个必填字段不一致。
