# V2 版本快照

> 保留时间：2026-09-27（3.0 开发启动前）

## 说明

这是 BoaBite V2（对应 `PRD.md` 的 V2 产品定义）的完整可运行快照，与当时根目录实现逐文件一致。

- 用途：3.0 版本开发期间完整保留 2.0，可随时独立运行与回退。
- 运行方式：在 `devlog/v2/app` 目录下启动静态服务器（如 `python3 -m http.server 8000`），访问对应端口。
- 排除文件：`js/config.local.js`（本地私密配置，遵循根目录 `.gitignore`，不进入快照）。

## 目录结构

```
devlog/v2/app/
  index.html          # 首页 / 相机 / 填写 / AI 分析 / 吞食反馈 / 蛇设定 / 模型设置
  css/app.css         # 黑白品牌系统 + 手写线稿风格
  js/
    app.js            # 页面流程与状态管理
    camera.js         # 相机拍摄（getUserMedia + 相册回退）
    ai.js             # AI 分析 / 蛇吞食
    llm.js            # 模型请求封装
    prompts.js        # 提示词
    config.js         # 模型服务配置
    food-cutout.js    # 食物抠图（透明轮廓 + alpha mask）
    food-layout.js    # 蛇腹食物布局（位置 / 缩放 / 碰撞）
    snake-render.js   # 蛇身 SVG 渲染
    swallow-render.js # 吞食反馈渲染
    storage.js        # 本地存储
  assests/            # 页面引用的图片素材（背景纸纹等）
```

## 与 3.0 的关系

- 3.0 在根目录独立演进（新 PRD 见 `PRD_3.0.md`）。
- 本快照与 git 历史（`git log` 可见完整演进）共同构成 2.0 的双重保留。
