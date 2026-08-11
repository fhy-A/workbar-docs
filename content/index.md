# workbar 文档

欢迎使用 workbar。这里会帮助你用一个账号连接常用 AI 工具和多种模型，并查看余额、价格与使用记录。

如果你是第一次使用，不需要先学习 API 或编程知识。直接按照[《快速开始》](getting-started/quick-start.md)操作即可；看到 workbar Code 正常返回回答，就表示首次连接成功。

## 第一次使用

从[《快速开始》](getting-started/quick-start.md)开始。你将完成账号注册、创建 API 密钥、连接 workbar Code，并发送第一次任务。

完成首次连接后，可以继续阅读：

- [《使用 workbar Code》](tools/workbar-code.md)：了解项目目录、模型、权限模式和日常使用；
- [《管理 API 密钥》](keys/manage-api-keys.md)：为不同设备或工具分别创建和限制密钥；
- [《模型、分组与自动选择》](models/models-and-auto-routing.md)：理解为什么同一把密钥能使用不同模型。

## 使用其他 AI 工具

如果你已经在使用 Claude Code 或其他支持自定义服务地址的工具，请选择对应指南：

- [《在 Claude Code 中使用 workbar》](tools/claude-code.md)
- [《连接其他兼容工具》](tools/compatible-tools.md)

不同工具可能使用 OpenAI、Claude 或 Gemini 格式。不要把一种格式的地址直接复制到另一种工具中；不确定时先阅读[《API 接入概览》](api/index.md)。

## 余额与账号

- [《余额、价格与使用记录》](billing/balance-pricing-and-usage.md)：查看模型价格、充值、使用日志和推荐奖励；
- [《账号与安全》](account/account-and-security.md)：管理登录、Passkey 和双重身份验证。

## 开发者接入

如果你准备在自己的程序中调用 workbar，可按所用 SDK 或协议查看：

- [《OpenAI 兼容接口》](api/openai-compatible.md)
- [《Claude 兼容接口》](api/claude-compatible.md)
- [《Gemini 兼容接口》](api/gemini-compatible.md)

所有示例都应使用你自己的 API 密钥。不要把完整密钥写入前端代码、公开仓库、截图或反馈信息中。

## 遇到问题

先打开[《常见问题排查》](troubleshooting/common-problems.md)，按页面现象检查密钥、模型、余额和请求频率。寻求帮助时可以提供错误文字、发生时间和模型名称，但不要提供完整 API 密钥、密码或私人文件。

---

本文档面向 workbar 当前新版前端。模型、价格、分组和支付方式可能随系统配置变化，请以登录后页面的实际显示为准。
