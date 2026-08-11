# 在 Claude Code 中使用 workbar

Claude Code 是 Anthropic 提供的终端编程工具。本篇只介绍如何安装 Claude Code，并让它通过 workbar 调用模型。

这里的 Claude Code 与 **workbar Code** 是两个不同的工具。如果你希望使用图形界面、自动同步 workbar 密钥并在浏览器中操作，请阅读[《使用 workbar Code》](workbar-code.md)。
如果你使用的不是这两个工具，请改读[《连接其他兼容工具》](compatible-tools.md)。

## 完成后你将得到什么

完成本文后，你可以：

- 在电脑上启动 Claude Code；
- 让 Claude Code 把模型请求发送到 workbar；
- 使用一把独立的 workbar API 密钥控制 Claude Code 的访问范围；
- 通过 workbar 使用日志确认请求已经成功。

## 开始前准备

请先准备：

- 一个可以正常登录的 workbar 账号；
- 一把已启用的 workbar API 密钥；
- 一台受你控制的电脑；
- 一个准备让 Claude Code 查看或处理的项目文件夹。

建议为 Claude Code 单独创建一把 API 密钥，例如命名为 `Claude Code - 我的电脑`。这样更容易查看用量，也可以在设备丢失或停止使用时只停用这一把密钥。创建方法见[《管理 API 密钥》](../keys/manage-api-keys.md)。

> **保护好 API 密钥**<br>
> 不要把完整密钥发送到聊天、截图或公开仓库中。本文示例中的 `YOUR_WORKBAR_API_KEY` 和 `YOUR_MODEL_ID` 都是占位符，不能直接使用。

## 第一步：安装 Claude Code

Claude Code 的安装方式可能随版本更新。以下命令来自 [Anthropic 官方安装说明](https://code.claude.com/docs/en/installation)。

### Windows

打开 PowerShell，选择一种方式安装。

使用官方原生安装程序：

```powershell
irm https://claude.ai/install.ps1 | iex
```

或者使用 WinGet：

```powershell
winget install Anthropic.ClaudeCode
```

### macOS、Linux 或 WSL

```bash
curl -fsSL https://claude.ai/install.sh | bash
```

安装完成后，检查版本：

```text
claude --version
```

如果命令没有返回版本号，请先按照 [Claude Code 官方安装说明](https://code.claude.com/docs/en/installation)排查安装问题，再继续配置 workbar。

> **完成标志**<br>
> `claude --version` 能正常显示版本号。

## 第二步：确认要填写的地址

Claude Code 会在 Base URL 后自动请求 `/v1/messages`，因此 `ANTHROPIC_BASE_URL` 只填 workbar 的站点根地址：

```text
https://workbar.ai
```

不要把 `/v1` 或完整接口路径写进这个变量：

```text
https://workbar.ai/v1
https://workbar.ai/v1/messages
```

否则 Claude Code 可能再次追加版本和接口路径，形成重复路径。`https://workbar.ai/v1/messages` 是它实际请求的完整接口，不是需要手动填写的 Base URL。

> **当前兼容范围**
>
> 目前已按 workbar 当前网关核对 `/v1/messages` 基础 Messages 请求。Claude Code 官方网关规范还包含 `/v1/messages/count_tokens` 等配套能力，而当前 workbar 网关未提供该路由。因此，依赖 Token 预估或其他新增网关能力的功能可能不可用；基础请求成功不代表所有 Claude Code 功能都已完整兼容。

## 第三步：在当前终端中配置

下面的方法只对当前终端窗口生效，适合第一次验证。关闭窗口后，变量会随之消失。

### Windows PowerShell

```powershell
$env:ANTHROPIC_BASE_URL = "https://workbar.ai"
$env:ANTHROPIC_AUTH_TOKEN = Read-Host "请粘贴 workbar API 密钥"
```

### macOS、Linux 或 WSL

```bash
export ANTHROPIC_BASE_URL="https://workbar.ai"
printf "workbar API 密钥: "
read -s WORKBAR_API_KEY
printf "\n"
export ANTHROPIC_AUTH_TOKEN="$WORKBAR_API_KEY"
unset WORKBAR_API_KEY
```

请只在自己的电脑上粘贴实际密钥，并确认屏幕不会被旁人看到。上面的输入方式不会把密钥本身写进命令历史；macOS、Linux 和 WSL 的示例还会隐藏输入。`ANTHROPIC_AUTH_TOKEN` 会让 Claude Code 使用 `Authorization: Bearer ...` 发送凭据；workbar 的 Claude 兼容接口接受这种认证方式。

不要把密钥写进项目内的 `.claude/settings.json` 并提交到 Git。

> **完成标志**<br>
> Base URL 和认证变量已经存在。检查时只确认密钥是否已设置，不要把密钥内容打印出来。

Windows PowerShell 可以这样检查：

```powershell
$env:ANTHROPIC_BASE_URL
if ($env:ANTHROPIC_AUTH_TOKEN) { "API 密钥已设置" }
```

## 第四步：启动并选择模型

先进入项目文件夹，再启动 Claude Code：

```text
cd 你的项目文件夹
claude
```

如果 Claude Code 默认选择的模型在你的 workbar API 密钥范围内不可用，请使用 [workbar 模型广场](https://workbar.ai/pricing)中显示的准确模型 ID 启动：

```text
claude --model YOUR_MODEL_ID
```

也可以在 Claude Code 中输入 `/model` 重新选择。第三方网关的模型不一定都会自动出现在内置列表中，因此以 workbar 当前可用模型和密钥的“模型限制”为准。

> **完成标志**<br>
> Claude Code 成功进入项目会话，没有出现未授权、模型不存在或余额不足提示。

## 第五步：完成一次验证

第一次使用时，建议先发送只读任务：

```text
请只查看当前项目，概括它包含什么。不要修改文件，也不要执行会改变项目的命令。
```

收到回答后，再打开 workbar 控制台中的“使用日志”，核对：

- 请求时间是否对应；
- 模型名称是否符合预期；
- 请求状态是否成功；
- 使用量是否出现。

日志可能需要短暂刷新后显示。

## 需要长期保存配置时

优先使用操作系统的安全凭据管理工具，或者在每次启动的受控终端中临时输入密钥。这样可以减少密钥以明文形式长期保存在磁盘上的时间。

只有在个人受控设备上，并且理解明文保存风险时，才考虑把环境变量写入用户级 `~/.claude/settings.json`；Windows 中的 `~` 对应 `%USERPROFILE%`。请先确认这台电脑和该文件只有受信任的用户可以访问。

用户级设置的结构如下：

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://workbar.ai",
    "ANTHROPIC_AUTH_TOKEN": "YOUR_WORKBAR_API_KEY"
  }
}
```

不要把真实密钥写入项目级 `.claude/settings.json`，因为该文件可能被提交并分享给其他人。更安全的做法是使用系统凭据管理、组织的密钥工具，或每次在受控终端中临时设置。

## 停止使用或切回其他服务

如果只在当前终端设置了变量，关闭终端即可。也可以主动清除。

Windows PowerShell：

```powershell
Remove-Item Env:ANTHROPIC_BASE_URL -ErrorAction SilentlyContinue
Remove-Item Env:ANTHROPIC_AUTH_TOKEN -ErrorAction SilentlyContinue
```

macOS、Linux 或 WSL：

```bash
unset ANTHROPIC_BASE_URL
unset ANTHROPIC_AUTH_TOKEN
```

如果已经写入用户级设置，还需要从 `~/.claude/settings.json` 的 `env` 中移除对应字段。停用设备时，建议同时在 workbar 控制台中停用或删除专用 API 密钥。

## 常见问题

### 地址设置后出现 404

先检查 Base URL 是否误写成了 `https://workbar.ai/v1` 或完整接口地址。Claude Code 需要的是站点根地址 `https://workbar.ai`。

### 提示 401 或未授权

检查 API 密钥是否存在、已启用且没有复制不完整。不要在排查消息中粘贴完整密钥；必要时创建一把新密钥再测试。

### 提示模型不存在或无权使用

确认模型 ID 与 workbar 模型广场一致，并检查这把密钥的分组与模型限制。密钥允许的模型范围可能小于账号当前可见的全部模型。

### Claude Code 要求登录 Anthropic 账号

先确认 `ANTHROPIC_BASE_URL` 和 `ANTHROPIC_AUTH_TOKEN` 是在启动 `claude` 的同一个终端中设置的。如果电脑上保存过其他 Claude Code 登录信息，可在 `/status` 中查看当前使用的配置来源。

### 请求成功但部分功能异常

Claude Code 会持续增加新能力，而不同网关和模型对高级功能的支持可能不同。记录当前 Claude Code 版本，先用基础文本任务验证，再核对该版本的网关要求；如果只有 Token 预估、工具调用、扩展思考或其他高级能力失败，请记录版本、模型 ID 和错误文字后再反馈。

更多错误说明见[《常见问题排查》](../troubleshooting/common-problems.md)。如果你要自行编写 Claude 格式请求，请继续阅读[《Claude 兼容接口》](../api/claude-compatible.md)。

---

本文中的 Claude Code 安装和环境变量名称按 Anthropic 官方文档核对；workbar 地址与 `/v1/messages` 路径按当前 workbar 网关实现核对。最后核对日期：2026-08-09。
