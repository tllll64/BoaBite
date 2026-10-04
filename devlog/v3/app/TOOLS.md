# TOOLS.md — 本地工具备忘

只写**本机 / 环境 / 执行相关**的信息，不重复 `AGENTS.md`。**不记录**：凭证、通用行为规则、长期项目记忆、当天日志。

## 建站 / 预览 / 上线 → 读 `skills/guard-skill/SKILL.md`

统一走 guard 形态（后端栈、前端约束见 skill）。脚手架、填业务、**本地预览**（起 server + `redcowork-preview` 注册 + 排障）、`guard verify` / `guard pack` 上线，全流程都在那份 skill 里。**别在这里凭记忆敲命令**。

一句话记住：server 绑 `0.0.0.0`、起完 `redcowork-preview start <port>`、注册前先 `curl 127.0.0.1:<port>` 自检、预览 URL 结尾带斜杠。创作期别提前跑 `guard verify`（会阻塞快速迭代），用户说"上线/部署"才收尾打包。细节看 skill。

- `$REDCOWORK_AGENT_ID`、`$REDCOWORK_GATEWAY_URL` 由 core 自动注入，`redcowork-preview` 命令直接读。
- 路径含中文 / 空格 / 特殊字符时命令加引号。
- 多环境（本机 vs sandbox 容器）共存时执行前先确认在哪：`hostname; pwd`。
- 后台进程记得 `nohup ... > /tmp/xxx.log 2>&1 &` 起，前台 blocking 会卡住会话。

## 用户身份查询

需要 `user_id` / `department_id` / `email` / `role` 等：**先从 `/workspace/USER.md` 正则匹配**，缺失再走对应 skill。禁止从对话上下文猜或硬编码 ID。

## 安全

发现疑似密钥 / 凭证 / 可外发配置时按敏感信息处理，不要复制到总结类文件。dev server 是公开预览，别往里放敏感数据。
