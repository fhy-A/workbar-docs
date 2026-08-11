# Gemini 兼容接口

Gemini 兼容格式采用 Google Gemini API 常见的 URL 和请求结构，适合明确支持 Gemini 原生接口的工具或程序。

Gemini 会把模型 ID 和动作写进 URL，因此要特别区分站点根地址、`/v1beta` 版本路径和完整接口 URL。

## 接入信息

| 项目 | 填写内容 |
| --- | --- |
| 会自动拼接 Gemini 路径的客户端 Base URL | `https://workbar.ai` |
| 非流式完整接口 | `POST https://workbar.ai/v1beta/models/YOUR_MODEL_ID:generateContent` |
| 流式完整接口 | `POST https://workbar.ai/v1beta/models/YOUR_MODEL_ID:streamGenerateContent?alt=sse` |
| 模型列表完整接口 | `GET https://workbar.ai/v1beta/models` |
| 推荐认证请求头 | `x-goog-api-key: YOUR_WORKBAR_API_KEY` |

从 [workbar 模型广场](https://workbar.ai/pricing)复制准确模型 ID，替换 URL 中的 `YOUR_MODEL_ID`。不要把占位符、中文说明或分组名称原样留在实际请求中。

## 认证方式

直接发送 Gemini 格式请求时，推荐使用：

```text
x-goog-api-key: YOUR_WORKBAR_API_KEY
```

workbar 当前的 Gemini 兼容路由也接受：

```text
Authorization: Bearer YOUR_WORKBAR_API_KEY
```

部分 Gemini 客户端会把密钥写成 `?key=YOUR_WORKBAR_API_KEY`。workbar 当前路由可以识别这种形式，但不建议优先使用，因为完整 URL 更容易进入日志、浏览器历史和错误截图。

## 最小请求

```http
POST /v1beta/models/YOUR_MODEL_ID:generateContent HTTP/1.1
Host: workbar.ai
x-goog-api-key: YOUR_WORKBAR_API_KEY
Content-Type: application/json

{
  "contents": [
    {
      "role": "user",
      "parts": [
        {
          "text": "只回答：连接成功"
        }
      ]
    }
  ]
}
```

基础文本通常位于响应的：

```text
candidates[0].content.parts[0].text
```

用量信息通常位于 `usageMetadata`。正式程序仍应检查 `candidates`、`content` 和 `parts` 是否存在，并处理没有文本候选的情况。

## 请求正文要点

### `contents`

`contents` 是对话内容列表。基础文本内容通常包含 `role` 和 `parts`：

```json
{
  "role": "user",
  "parts": [
    {"text": "你好"}
  ]
}
```

### `systemInstruction`

需要系统说明时，可以使用顶层 `systemInstruction`：

```json
{
  "systemInstruction": {
    "parts": [
      {"text": "请使用简体中文回答。"}
    ]
  },
  "contents": [
    {
      "role": "user",
      "parts": [
        {"text": "介绍当前项目。"}
      ]
    }
  ]
}
```

### 可选参数

`generationConfig`、安全设置、工具和多模态内容都属于进阶能力。不同模型和上游的支持范围可能不同；第一次连接应省略这些字段，只保留 `contents`。

## 流式输出

Gemini 格式的流式接口为：

```text
POST https://workbar.ai/v1beta/models/YOUR_MODEL_ID:streamGenerateContent?alt=sse
```

先确认 `:generateContent` 非流式请求成功，再切换到 `:streamGenerateContent`。客户端需要能够读取 SSE；路由存在不代表每个模型都会返回完全相同的流式事件。

## 查看模型列表

使用同一把 workbar API 密钥发送：

```http
GET /v1beta/models HTTP/1.1
Host: workbar.ai
x-goog-api-key: YOUR_WORKBAR_API_KEY
```

模型列表仍受账号、分组和密钥模型限制影响。返回某个模型，不表示该模型支持全部 Gemini 原生参数。

## 第三方工具中的地址怎么填

Gemini 客户端的自定义地址字段并不统一：

| 工具的拼接行为 | 应填写 |
| --- | --- |
| 自动加入 `/v1beta/models/{model}:generateContent` | `https://workbar.ai` |
| 只自动加入 `models/{model}:generateContent` | `https://workbar.ai/v1beta` |
| 要求完整 Endpoint | 包含模型 ID 和动作名的完整接口 URL |
| 把 API 版本设为单独选项 | 地址中不要再次重复填写 `/v1beta` |

如果工具没有说明拼接规则，保存后查看实际请求 URL。出现 404 时，重点检查是否形成了 `/v1beta/v1beta`，或是否漏掉 `models`、模型 ID、冒号后的动作名。

## 常见问题

### 404 或找不到模型

确认 URL 中的模型 ID 与 workbar 模型广场完全一致，再检查 `/v1beta` 是否被工具重复添加。

### 返回 `401`

确认填入的是 workbar API 密钥，不是登录密码；再检查 `x-goog-api-key` 或 Bearer 请求头是否完整。

### 请求成功但没有文本

响应可能没有文本候选，或包含多个候选和内容块。不要假设第一个字段永远存在，应先检查响应结构。

### 非流式成功，流式失败

确认客户端支持 SSE，并使用 `:streamGenerateContent?alt=sse`。如果仍失败，先继续使用非流式接口，再核对模型与客户端的流式兼容范围。

### 图片、音频、PDF 或工具调用失败

这些能力需要不同内容块和参数，也依赖具体模型。回到纯文本最小请求，确认基础连接后再逐项增加。

更多说明见[《API 接入概览》](index.md)、[《连接其他兼容工具》](../tools/compatible-tools.md)和[《常见问题排查》](../troubleshooting/common-problems.md)。
