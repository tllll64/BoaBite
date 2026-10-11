# 自动抠图模型替换试验

本轮用完整版 U²-Net 替换轻量版 u2netp，保持自动分割，不增加用户点击或修正步骤。

- 来源：https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net.onnx
- 参数依据：https://github.com/danielgatis/rembg/blob/main/rembg/sessions/u2net.py
- 文件大小：175997641 bytes（约 168 MiB）。
- 预期 MD5：60024c5c889badc19c04ad937298a77b。
- 输入：float32，1×3×320×320，ImageNet 均值与标准差。
- 现有蛇嘴区域裁切、自动抠图、确认流程保持不变。
- 原 u2netp 模型保留，便于回退。

这是模型替换试验，不代表已经验证手部残留减少。完整版仍为显著主体分割，可能继续保留与物品接触的手。请用同一拍摄构图比较主体完整度、手部残留和等待时间。

按用户偏好，不做网页检查。模型完整性和运行兼容性通过命令行验证，视觉效果由用户确认。

验证结果：模型 MD5 与来源一致；ONNX Runtime WASM 单线程推理成功，输出 1×1×320×320，所有数值有限。仅验证运行兼容性，未验证手部去除效果。
