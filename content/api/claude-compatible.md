# Claude 兼容接口

Claude 兼容格式采用 Anthropic Messages API 的常用请求结构，适合 Anthropic SDK，以及明确支持 Claude 或 Anthropic 接口的工具。

## 接入信息

| 项目 | 填写内容 |
| --- | --- |
| 本页 SDK 示例的 Base URL | `https://workbar.ai` |
| 完整消息接口 | `POST https://workbar.ai/v1/messages` |
| 原生格式认证 | `x-api-key: YOUR_WORKBAR_API_KEY` |
| 协议版本头 | `anthropic-version: 2023-06-01` |

本页的 Anthropic Python SDK 会在 Base URL 后追加 `/v1/messages`，因此不要把 `https://workbar.ai/v1` 或完整消息接口填进 `base_url`。

从 [workbar 模型广场](https://workbar.ai/pricing)复制准确模型 ID，替换下文的 `YOUR_MODEL_ID`。

## 认证方式

直接发送 Claude 格式请求时，推荐使用：

```text
x-api-key: YOUR_WORKBAR_API_KEY
anthropic-version: 2023-06-01
```

workbar 当前的 `/v1/messages` 路由也接受：

```text
Authorization: Bearer YOUR_WORKBAR_API_KEY
anthropic-version: 2023-06-01
```

同一个请求选择一种密钥认证方式即可。`anthropic-version` 是 Claude 格式的协议版本头；使用 SDK 时通常由 SDK 发送，直接编写 HTTP 请求时需要显式加入。

## 最小请求

```http
POST /v1/messages HTTP/1.1
Host: workbar.ai
x-api-key: YOUR_WORKBAR_API_KEY
anthropic-version: 2023-06-01
Content-Type: application/json

{
  "model": "YOUR_MODEL_ID",
  "max_tokens": 256,
  "messages": [
    {
      "role": "user",
      "content": "只回答：连接成功"
    }
  ]
}
```

基础文本通常位于响应的：

```text
content[0].text
```

## Python SDK 示例

先把密钥放入你自己的安全环境变量 `WORKBAR_API_KEY`。

```python
import os
from anthropic import Anthropic

client = Anthropic(
    base_url="https://workbar.ai",
    api_key=os.environ["WORKBAR_API_KEY"],
)

message = client.messages.create(
    model="YOUR_MODEL_ID",
    max_tokens=256,
    messages=[
        {"role": "user", "content": "只回答：连接成功"},
    ],
)

print(message.content[0].text)
```

## Messages 格式要点

### `max_tokens` 是必填项

创建消息时需要提供正整数 `max_tokens`。第一次验证可以使用较小的值，确认成功后再按任务需要调整。

### 系统说明使用顶层 `system`

Claude Messages 格式不把系统说明写成 `messages` 中的 `system` 角色，而是使用顶层字段：

```json
{
  "model": "YOUR_MODEL_ID",
  "max_tokens": 256,
  "system": "请使用简体中文回答。",
  "messages": [
    {
      "role": "user",
      "content": "介绍当前项目。"
    }
  ]
}
```

从 OpenAI 格式迁移时，不要直接保留 `{"role": "system"}` 的消息结构。

### 复杂内容需要单独验证

基础文本可以使用字符串。图片、工具调用、扩展思考或其他复杂内容需要相应内容块，也取决于模型、上游和客户端的实际兼容范围。第一次连接不要加入这些字段。

## 流式输出

请求可以尝试设置：

```json
{
  "stream": true
}
```

先确认非流式文本成功，再按照所用 SDK 的流式方法读取事件。workbar 支持 Messages 路由，不等于所有模型都支持 Claude 原生协议中的每一种事件或高级能力。

## Claude Code 用户

Claude Code 与直接编写 Python SDK 程序的配置步骤不同。它会读取自己的环境变量，并自动拼接消息接口；不要把其他工具中的完整 Endpoint 原样复制过去。请按[《在 Claude Code 中使用 workbar》](../tools/claude-code.md)配置和验证。

## 常见问题

### 提示缺少 `anthropic-version`

直接发送 HTTP 请求时加入该请求头。使用 SDK 时，检查自定义代理或请求封装是否移除了 SDK 默认头。

### 返回 404 或出现重复路径

检查实际请求地址。对于本页的 Anthropic Python SDK，Base URL 应为 `https://workbar.ai`，不是 `https://workbar.ai/v1` 或完整的 `/v1/messages`。

### 提示 `max_tokens` 缺失

在请求正文加入一个正整数 `max_tokens` 后重试。

### 返回 `401`

确认使用的是 workbar API 密钥，不是登录密码或后台管理令牌；再检查 `x-api-key` 或 Bearer 请求头是否完整。

### 基础文本成功，但高级能力失败

删除工具、图片、思考或测试性请求头后重试。基础文本成功只能证明地址、认证和最小 Messages 请求可用，不能证明全部 Anthropic 原生能力都已兼容。

更多说明见[《API 接入概览》](index.md)和[《常见问题排查》](../troubleshooting/common-problems.md)。
