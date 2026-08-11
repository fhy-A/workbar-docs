# OpenAI 兼容接口

OpenAI 兼容格式适合 OpenAI SDK，以及明确支持 OpenAI Compatible、Chat Completions 或 Responses 的工具。

本页先完成纯文本接入。图片、音频、实时接口和其他高级能力，需要在确认客户端、模型与当前上游都支持后单独测试。

## 接入信息

| 项目 | 填写内容 |
| --- | --- |
| 常用 Base URL | `https://workbar.ai/v1` |
| Chat Completions 完整接口 | `POST https://workbar.ai/v1/chat/completions` |
| Responses 完整接口 | `POST https://workbar.ai/v1/responses` |
| 模型列表完整接口 | `GET https://workbar.ai/v1/models` |
| 认证请求头 | `Authorization: Bearer YOUR_WORKBAR_API_KEY` |

这里的 Base URL 适用于本页的 OpenAI Python SDK 示例，也适用于只会追加 `chat/completions` 或 `responses` 的客户端。若工具会自行追加 `/v1`，应填写站点根地址 `https://workbar.ai`，避免形成 `/v1/v1`。

从 [workbar 模型广场](https://workbar.ai/pricing)复制准确模型 ID，替换下文的 `YOUR_MODEL_ID`。不要填写模型卡片的中文名称或分组名称。

## Chat Completions

Chat Completions 使用 `messages` 表示对话历史。第一次接入建议先用这个最小请求验证地址、密钥和模型。

### 原始 HTTP 请求

```http
POST /v1/chat/completions HTTP/1.1
Host: workbar.ai
Authorization: Bearer YOUR_WORKBAR_API_KEY
Content-Type: application/json

{
  "model": "YOUR_MODEL_ID",
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
choices[0].message.content
```

### Python SDK 示例

先把密钥放入你自己的安全环境变量 `WORKBAR_API_KEY`，不要直接写进代码。

```python
import os
from openai import OpenAI

client = OpenAI(
    base_url="https://workbar.ai/v1",
    api_key=os.environ["WORKBAR_API_KEY"],
)

result = client.chat.completions.create(
    model="YOUR_MODEL_ID",
    messages=[
        {"role": "user", "content": "只回答：连接成功"},
    ],
)

print(result.choices[0].message.content)
```

这个 SDK 会在 `base_url` 后追加 `chat/completions`，因此不要把完整接口 URL 填进 `base_url`。

## Responses

workbar 当前提供 `POST /v1/responses` 路由。Responses 使用 `input` 表示输入，与 Chat Completions 的 `messages` 不是同一个字段。

### 原始 HTTP 请求

```http
POST /v1/responses HTTP/1.1
Host: workbar.ai
Authorization: Bearer YOUR_WORKBAR_API_KEY
Content-Type: application/json

{
  "model": "YOUR_MODEL_ID",
  "input": "只回答：连接成功"
}
```

### Python SDK 示例

```python
import os
from openai import OpenAI

client = OpenAI(
    base_url="https://workbar.ai/v1",
    api_key=os.environ["WORKBAR_API_KEY"],
)

result = client.responses.create(
    model="YOUR_MODEL_ID",
    input="只回答：连接成功",
)

print(result.output_text)
```

`output_text` 是 OpenAI Python SDK 提供的便捷属性。直接处理原始 JSON 时，应按实际响应中的 `output` 内容块读取文本。

Responses 协议还定义了工具、推理和多种输入输出结构，但 workbar 存在该路由并不代表每个模型或上游都支持全部字段。若最小 Responses 请求失败，而 Chat Completions 正常，可先继续使用 Chat Completions，再确认所选模型和客户端的兼容范围。

## 流式输出

两类请求都可以尝试设置：

```json
{
  "stream": true
}
```

客户端需要按对应接口的流式事件格式读取结果。先确认非流式请求成功，再开启流式输出；不同模型和转换路径对事件字段的支持可能不同。

## 查看模型列表

使用同一把 workbar API 密钥发送：

```http
GET /v1/models HTTP/1.1
Host: workbar.ai
Authorization: Bearer YOUR_WORKBAR_API_KEY
```

列表返回的模型仍可能受账号、分组和密钥模型限制影响。模型出现在列表中，也不表示它支持全部 OpenAI 参数。

## 常见问题

### 请求地址出现 `/v1/v1`

客户端已经自动添加了版本路径。把 Base URL 从 `https://workbar.ai/v1` 改为 `https://workbar.ai`，或关闭工具中重复的 API 版本设置。

### 返回 `400`

先只保留 `model` 和最小输入，删除温度、工具、图片、结构化输出等可选参数。如果最小请求成功，再逐项加回。

### Chat Completions 成功，但 Responses 失败

这通常表示当前客户端、模型或上游对 Responses 的兼容范围不同。不要把两种请求正文混用；可以先使用 Chat Completions 完成任务。

### 模型列表可见，但调用提示无权使用

检查当前密钥的分组和模型限制。账号能看到模型，不代表这把密钥一定允许调用。

更多说明见[《API 接入概览》](index.md)和[《常见问题排查》](../troubleshooting/common-problems.md)。
