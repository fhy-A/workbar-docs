# 连接其他兼容工具

许多聊天工具、桌面客户端和开发工具都允许自定义“API 地址”和“API 密钥”。只要工具支持 workbar 提供的兼容格式，就可以尝试连接。

不同工具对“Base URL”的理解并不完全相同。最常见的问题不是密钥错误，而是把网站地址、版本路径和完整接口地址重复拼接。本篇先帮你判断应当填写哪一种地址。

> 本文适用于需要手动填写地址、密钥和模型的其他工具。workbar Code 请阅读[《使用 workbar Code》](workbar-code.md)；Claude Code 请阅读[《在 Claude Code 中使用 workbar》](claude-code.md)。

## 开始前准备

你需要：

- 一把已启用的 workbar API 密钥；
- 一个准确的模型 ID；
- 确认目标工具支持 OpenAI、Claude（Anthropic）或 Gemini 兼容接口；
- 确认目标工具允许修改服务地址，并知道地址字段是“Base URL”还是“完整接口 URL”。

如果还没有密钥，请先阅读[《管理 API 密钥》](../keys/manage-api-keys.md)。
如果工具只提供厂商官方登录，却没有自定义服务地址或兼容接口选项，通常无法按本文方式连接。

## 第一步：判断工具使用哪种格式

先查看工具的提供商或接口类型选项。

| 工具中的选项 | 优先阅读 |
| --- | --- |
| OpenAI、OpenAI Compatible、Chat Completions、Responses | [OpenAI 兼容接口](../api/openai-compatible.md) |
| Anthropic、Claude、Messages API | [Claude 兼容接口](../api/claude-compatible.md) |
| Google Gemini、Gemini API、Generative Language | [Gemini 兼容接口](../api/gemini-compatible.md) |

工具名称里出现某个模型品牌，不代表它一定使用该品牌的原生接口。例如，一个能选择 Claude 模型的客户端，也可能只发送 OpenAI 格式请求。应以配置页写明的“提供商类型”或接口文档为准。

## 第二步：判断地址字段会不会自动拼接路径

同样名为“API 地址”的字段，可能有三种含义：

| 字段含义 | OpenAI 示例 | Claude 示例 | Gemini 示例 |
| --- | --- | --- | --- |
| 网站或服务根地址 | `https://workbar.ai` | `https://workbar.ai` | `https://workbar.ai` |
| 带版本的 Base URL | `https://workbar.ai/v1` | 通常不需要手动加 `/v1` | 仅在工具明确要求版本前缀时使用 `/v1beta` |
| 完整接口 URL | `https://workbar.ai/v1/chat/completions` | `https://workbar.ai/v1/messages` | `https://workbar.ai/v1beta/models/{model}:generateContent` |

判断方法：

1. 如果工具说明会自动调用 `chat/completions`、`responses`、`messages` 或 `models/...:generateContent`，填写它要求的 Base URL，不要再添加完整接口路径。
2. 如果工具明确要求“Endpoint”“完整 URL”或“请求地址”，填写对应的完整接口 URL。
3. 如果文档示例中的默认值已经包含 `/v1` 或 `/v1beta`，先看工具是替换整个默认值，还是只替换域名。
4. 保存后出现 404 时，检查错误地址中是否有 `/v1/v1`、`/v1/messages/v1/messages` 或 `/v1beta/v1beta`。

## 第三步：按接口格式填写地址

### OpenAI 兼容工具

很多 OpenAI SDK 和客户端会在 Base URL 后追加 `chat/completions` 或 `responses`。这类工具通常填写：

```text
Base URL: https://workbar.ai/v1
API Key: YOUR_WORKBAR_API_KEY
Model: YOUR_MODEL_ID
```

如果工具要求完整的聊天接口地址，则填写：

```text
https://workbar.ai/v1/chat/completions
```

使用 Responses 格式的工具应改用：

```text
https://workbar.ai/v1/responses
```

### Claude 兼容工具

会自动追加 `/v1/messages` 的 Claude 客户端通常填写：

```text
Base URL: https://workbar.ai
API Key: YOUR_WORKBAR_API_KEY
Model: YOUR_MODEL_ID
```

如果工具要求完整 Messages 接口，则填写：

```text
https://workbar.ai/v1/messages
```

Claude Code 的配置方式见[《在 Claude Code 中使用 workbar》](claude-code.md)。

### Gemini 兼容工具

Gemini 原生请求把模型名称和动作写在 URL 中。会自动拼接 `/v1beta/models/...` 的工具通常使用站点根地址：

```text
Base URL: https://workbar.ai
API Key: YOUR_WORKBAR_API_KEY
Model: YOUR_MODEL_ID
```

如果工具要求完整接口地址，则结构为：

```text
https://workbar.ai/v1beta/models/YOUR_MODEL_ID:generateContent
```

部分工具把版本前缀和接口路径分开填写。遇到这种情况，应按工具自身说明填写，不要同时在两个字段中重复加入 `/v1beta`。

## 第四步：填写密钥和模型

工具可能用下面不同名称表示密钥字段，都应填写 workbar API 密钥，而不是 workbar 登录密码：

- API Key；
- Token；
- OpenAI API Key；
- Anthropic API Key；
- Gemini API Key。

模型字段必须填写 [workbar 模型广场](https://workbar.ai/pricing)当前显示的准确模型 ID，不能只填“OpenAI”“Claude”或“Gemini”。如果模型列表可以自动加载，仍应确认加载出的模型在这把密钥的分组和模型限制范围内。

> **不要把密钥放进 URL**<br>
> 即使某些 Gemini 客户端支持 `?key=...`，也优先使用专门的 API Key 字段或请求头。URL 更容易进入浏览器历史、代理日志和错误截图。

## 第五步：先做最小验证

保存配置后，先发送一个很短的纯文本请求，不要立即测试图片、文件或工具调用。例如：

```text
只回答：连接成功
```

然后在 workbar 的“使用日志”中确认是否出现对应请求。基础文本请求成功后，再测试图片、工具调用、长上下文或流式输出等高级能力。

不要用高级功能作为第一次连接测试，因为不同工具、模型和兼容格式支持的字段可能不同。

## 常见问题

### 保存时提示地址无效

检查工具是否只允许 `https://` 地址，以及字段是否要求 Base URL 而不是完整接口。不要把示例中的 `{model}`、`YOUR_MODEL_ID` 等占位符原样留在实际配置中。

### 404 或页面不存在

通常是路径重复或接口类型选错。先查看工具实际请求的 URL，再与本文中的完整接口地址比较。

### 401 或密钥无效

确认密钥已启用、没有复制缺失，并且没有把账号登录密码误填进 API Key 字段。

### 能加载模型，但发送失败

模型列表和实际请求可能使用不同接口。检查模型 ID、分组、模型限制、余额以及工具发送的协议格式。

### 选了 Claude 模型却不能使用 Claude 格式

模型名称与请求协议是两件事。是否能通过某种格式调用，取决于 workbar 当前网关、上游服务和该模型能力。请优先使用模型卡片或工具文档明确支持的格式。

### 流式输出、图片或工具调用异常

先关闭流式输出和高级参数，用纯文本请求验证。基础请求成功后，再逐项启用功能，便于判断是连接问题还是能力兼容问题。

## 安全建议

- 为不同工具创建不同密钥，名称写清设备和用途；
- 不在截图、日志、配置教程或聊天中展示完整密钥；
- 不把包含密钥的配置文件提交到 Git；
- 停止使用某个工具时，及时停用对应密钥；
- 在公共或临时设备上不要保存长期有效的密钥。

如果仍不能确定应使用哪种格式，请先阅读[《API 接入概览》](../api/index.md)，再根据工具的实际请求路径选择对应专题页。

---

本文中的 workbar 接口路径按当前 workbar 网关实现核对。第三方工具是否自动拼接版本和接口路径，应以该工具当前官方说明为准。最后核对日期：2026-08-09。
