# API 接入概览

如果你正在编写程序，或某个工具要求手动选择接口格式，可以通过 workbar 的兼容接口调用模型。只在网页中使用 workbar 的用户，不需要配置这些地址。

workbar 当前提供 OpenAI、Claude（Anthropic）和 Gemini 三类常用兼容格式。三类接口共用 workbar API 密钥，但版本路径、认证头和请求正文并不相同。

## 开始前准备

接入前请准备：

1. 一把已启用的 workbar API 密钥；
2. 从 [workbar 模型广场](https://workbar.ai/pricing)复制的准确模型 ID；
3. 你的 SDK 或工具所使用的协议格式；
4. 该 SDK 的地址字段会自动追加哪些路径。

没有密钥时，请先阅读[《管理 API 密钥》](../keys/manage-api-keys.md)。分组和模型范围见[《模型、分组与自动选择》](../models/models-and-auto-routing.md)。

> **密钥安全**
>
> 下文的 `YOUR_WORKBAR_API_KEY` 和 `YOUR_MODEL_ID` 都是占位符。workbar API 密钥不是登录密码，也不是后台管理令牌。不要把真实密钥放进公开代码、截图、聊天或版本库。

## 先分清三种地址

“网站地址”“Base URL”和“完整接口 URL”不是同一个概念。

| 名称 | 示例 | 用途 |
| --- | --- | --- |
| 网站地址 | `https://workbar.ai` | 在浏览器中登录、创建密钥、查看模型和用量。 |
| Base URL | 例如 `https://workbar.ai/v1` | 填入 SDK 或工具；客户端通常会在后面继续追加方法路径。 |
| 完整接口 URL | 例如 `https://workbar.ai/v1/chat/completions` | 一次 HTTP 请求真正发送到的完整地址。 |

workbar 没有一个适用于所有客户端的通用 Base URL。应该填写站点根地址、带 `/v1` 的地址，还是带 `/v1beta` 的地址，取决于客户端会自动拼接什么。

如果一个工具要求 Base URL，不要直接复制完整接口 URL。否则可能形成 `/v1/chat/completions/chat/completions` 之类的重复路径。

## 选择协议格式

优先按照**客户端发送的协议**选择，而不是只看模型品牌。

| 客户端或工具类型 | 建议先看 | 常用配置值 | 实际接口路径 |
| --- | --- | --- | --- |
| OpenAI SDK、OpenAI Compatible 工具 | [OpenAI 兼容接口](openai-compatible.md) | Base URL：`https://workbar.ai/v1` | `POST /v1/chat/completions` 或 `POST /v1/responses` |
| Anthropic SDK、Claude 格式工具 | [Claude 兼容接口](claude-compatible.md) | Base URL：`https://workbar.ai` | `POST /v1/messages` |
| Gemini 原生格式工具 | [Gemini 兼容接口](gemini-compatible.md) | Base URL：`https://workbar.ai` | `POST /v1beta/models/{model}:generateContent` |

表中的 Base URL 适用于对应页面中的示例。第三方工具可能把 API 版本设置为单独字段，也可能要求完整接口 URL；填写前应查看工具说明或实际请求地址。

## 认证方式速查

| 格式 | 推荐请求头 |
| --- | --- |
| OpenAI | `Authorization: Bearer YOUR_WORKBAR_API_KEY` |
| Claude | `x-api-key: YOUR_WORKBAR_API_KEY`，同时发送 `anthropic-version: 2023-06-01` |
| Gemini | `x-goog-api-key: YOUR_WORKBAR_API_KEY` |

workbar 当前的 Claude 兼容路由也接受 Bearer Token；Gemini 兼容路由也接受 Bearer Token。直接编写请求时，优先使用上表中与原生协议一致的请求头。

Gemini 客户端有时支持把密钥写成 URL 查询参数 `?key=...`。workbar 当前路由可以识别这种形式，但不建议使用，因为完整 URL 更容易进入日志、浏览器历史和错误截图。

## 推荐接入顺序

### 1. 为应用创建专用密钥

为不同应用分别创建密钥，并用名称标明用途。这样更容易查看用量，也能在单个应用停用时只撤销对应密钥。

### 2. 复制准确模型 ID

从 [workbar 模型广场](https://workbar.ai/pricing)复制模型 ID。不要把中文说明、供应商名称或分组名称当作模型 ID。

### 3. 发送最小非流式文本请求

第一次只发送一条简单文本，不加入工具调用、图片、结构化输出或其他高级参数。这样更容易确认地址、认证和模型是否正确。

### 4. 在使用日志中核对

请求成功后，在 workbar 控制台打开“使用日志”，核对请求时间、模型、状态和用量。日志可能需要短暂刷新后出现。

### 5. 再逐项测试高级能力

基础文本成功后，再按需要测试流式输出、工具调用、图片或其他能力。一次只增加一类参数，出现问题时更容易定位。

## 兼容接口不等于上游原生接口

workbar 接受上述常用协议，并把请求转发到当前可用的模型服务。协议中存在某个字段，并不代表所有模型、上游渠道和转换路径都支持该字段。

例如，基础文本可能正常，但工具调用、图片、音频、扩展思考、结构化输出或特定响应字段仍可能不同。请以当前模型卡片、密钥的模型限制和实际最小请求为准，不要只凭模型名称推断能力。

## 常见状态码

| 状态码 | 常见含义 | 优先检查 |
| --- | --- | --- |
| `400` | 请求格式或参数不正确 | 模型 ID、必填字段、消息结构和可选参数。 |
| `401` | 认证失败 | 密钥是否完整、已启用，请求头名称是否正确。 |
| `403` | 当前账号或密钥不能执行该请求 | 分组、模型限制、账号状态和权限。 |
| `404` | 请求路径不存在 | 是否重复添加了 `/v1`、`/v1beta` 或完整方法路径。 |
| `429` | 请求过于频繁或达到限制 | 降低并发与频率，稍后重试。 |
| `5xx` | 网关或上游服务暂时异常 | 稍后重试，或改用当前可用的其他模型。 |

完整排查流程见[《常见问题排查》](../troubleshooting/common-problems.md)。

## 继续阅读

- [OpenAI 兼容接口](openai-compatible.md)
- [Claude 兼容接口](claude-compatible.md)
- [Gemini 兼容接口](gemini-compatible.md)
- [连接其他兼容工具](../tools/compatible-tools.md)
