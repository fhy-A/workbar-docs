# workbar 文档部署交接手册（开发）

本文面向负责服务器发布的开发人员，说明如何从 GitHub 获取经过校验的文档产物，并将其发布到 `https://docs.workbar.ai/`。

完整的 Nginx、DNS、TLS、安全头、缓存和服务器初始化说明见 [`deploy/README.md`](deploy/README.md)。本文只保留每次交接都必须执行的发布闭环。

## 1. 部署边界

- 源码仓库：<https://github.com/fhy-A/workbar-docs>
- GitHub Actions 负责检查、构建和打包，但不会自动连接服务器或发布生产环境。
- 生产环境只接收 Actions 生成的静态 `dist/`，不在服务器重新安装依赖或构建。
- 文档站由独立 Nginx 虚拟主机提供，不进入 New API 镜像，不连接数据库，也不读取 workbar 登录状态。
- 发布文档不需要重建或重启 New API，不得修改模型网关配置。
- GitHub、Issue、日志、服务器目录和命令输出中不得写入 SSH 私钥、密码、API Key 或其他生产凭据。

## 2. 每次交接必须提供的信息

文档维护者应向开发提供：

1. 已经合并到 `main` 的完整 commit SHA；
2. 对应该 SHA、由 `main` push 触发且结论为成功的 GitHub Actions 链接；
3. Artifact 名称：`workbar-docs-<完整 commit SHA>`；
4. 本次变更摘要；
5. 是否为首次部署，以及是否同时修改了 Nginx 配置。

开发必须确认 commit SHA、`main`、Actions run 和 Artifact 名称完全一致。PR 检查生成的 Artifact 只用于评审，不能发布到生产环境。任一项不一致时停止发布。

## 3. 获取并校验发布产物

仓库公开后，开发无需仓库写权限即可查看源码和成功的 Actions。打开交接提供的 Actions run，在页面底部下载：

```text
workbar-docs-<完整 commit SHA>
```

先解压 GitHub 下载的外层压缩包，得到：

```text
workbar-docs-<完整 commit SHA>.tar.gz
workbar-docs-<完整 commit SHA>.tar.gz.sha256
```

在已登录 GitHub 的可信 Linux 开发机或 CI 交付机中校验并展开。不要为了下载 Artifact 而把 GitHub 凭据长期保存在生产服务器：

```bash
export WORKBAR_DOCS_SHA='<完整 commit SHA>'
export WORKBAR_DOCS_INPUT_DIR="$(pwd)/release-input"

sha256sum -c "workbar-docs-${WORKBAR_DOCS_SHA}.tar.gz.sha256"
install -d "${WORKBAR_DOCS_INPUT_DIR}/dist"
tar -xzf "workbar-docs-${WORKBAR_DOCS_SHA}.tar.gz" -C "${WORKBAR_DOCS_INPUT_DIR}/dist"
test -f "${WORKBAR_DOCS_INPUT_DIR}/dist/index.html"
test -f "${WORKBAR_DOCS_INPUT_DIR}/dist/404.html"
test -d "${WORKBAR_DOCS_INPUT_DIR}/dist/assets"
```

任一检查失败都不得继续。

## 4. 获取同一提交的部署脚本

部署脚本必须与 Artifact 来自同一个 commit，不能混用其他版本：

```bash
git clone https://github.com/fhy-A/workbar-docs.git
cd workbar-docs
git checkout --detach "$WORKBAR_DOCS_SHA"
test "$(git rev-parse HEAD)" = "$WORKBAR_DOCS_SHA"
git fetch origin main
git merge-base --is-ancestor "$WORKBAR_DOCS_SHA" origin/main
```

最后一条命令失败说明目标 SHA 尚未进入 `main`，必须停止发布。

在可信开发机上准备只包含静态产物和同一提交部署文件的上传目录：

```bash
export WORKBAR_DOCS_UPLOAD_DIR="$(pwd)/release-upload-${WORKBAR_DOCS_SHA}"
test ! -e "$WORKBAR_DOCS_UPLOAD_DIR"
install -d "$WORKBAR_DOCS_UPLOAD_DIR"
cp -a "${WORKBAR_DOCS_INPUT_DIR}/dist" "${WORKBAR_DOCS_UPLOAD_DIR}/dist"
cp -a deploy "${WORKBAR_DOCS_UPLOAD_DIR}/deploy"
tar -czf "workbar-docs-upload-${WORKBAR_DOCS_SHA}.tar.gz" -C "$WORKBAR_DOCS_UPLOAD_DIR" .
```

使用现有安全文件传输方式把 `workbar-docs-upload-<完整 commit SHA>.tar.gz` 上传到 VPS 临时目录并解压。不要上传 `.git/`、GitHub 凭据、源码依赖或本地环境文件。

以下服务器命令均在解压后的上传目录中执行。重新设置服务器 Shell 变量，不要依赖开发机中的变量：

```bash
export WORKBAR_DOCS_SHA='<完整 commit SHA>'
export WORKBAR_DOCS_GROUP='www-data' # Nginx 使用 nginx 组时改为 nginx
cd /path/to/uploaded/workbar-docs

test -f dist/index.html
test -f deploy/scripts/deploy-release.sh
```

## 5. 首次部署

首次部署前，开发需要具备：

- VPS 的 `sudo` 权限；
- `docs.workbar.ai` 的 DNS 配置权限或可联系对应管理员；
- 已安装的 Nginx、Certbot 和 GNU coreutils；
- 公网 TCP 80、443 可访问；
- 已确认 Nginx 实际使用的组为 `www-data` 或 `nginx`。

按 [`deploy/README.md`](deploy/README.md) 完成服务器目录初始化后，显式传入已经确认的 Nginx 组并发布静态版本：

```bash
sudo env WORKBAR_DOCS_GROUP="$WORKBAR_DOCS_GROUP" \
  bash deploy/scripts/deploy-release.sh dist "$WORKBAR_DOCS_SHA"
```

随后严格按完整手册执行：

1. 安装安全头和 HTTP 引导配置；
2. 执行 `sudo nginx -t`，通过后再 reload；
3. DNS 生效后使用 Certbot Webroot 申请 `docs.workbar.ai` 证书；
4. 安装正式 HTTPS 配置；
5. 再次执行 `sudo nginx -t`，通过后再 reload；
6. 执行 `sudo certbot renew --dry-run`。

如果边缘 Nginx 在容器中，必须以只读方式挂载整个 `/srv/workbar-docs`，不能只挂载 `current` 软链接。

## 6. 后续内容更新

后续每个版本重复第 2～4 节，然后显式传入 Nginx 组执行：

```bash
sudo env WORKBAR_DOCS_GROUP="$WORKBAR_DOCS_GROUP" \
  bash deploy/scripts/deploy-release.sh dist "$WORKBAR_DOCS_SHA"
```

脚本会创建 `/srv/workbar-docs/releases/<完整 commit SHA>`，并原子切换 `/srv/workbar-docs/current`。

纯文档内容更新不需要 reload Nginx，也不需要重启 New API。只有 Nginx 配置本身发生变化时才执行：

```bash
sudo nginx -t && sudo systemctl reload nginx
```

Actions Artifact 当前保留 30 天。过期后，如果原工作流仍允许 rerun，可针对同一 commit 重新运行；否则在可信开发机或 CI 构建机 checkout 同一 SHA，执行与 CI 一致的 `npm --prefix preview ci` 和 `npm --prefix preview run check` 后重新生成产物。不得在生产服务器临时构建，也不得改用其他 commit 的 Artifact。

## 7. 回滚

查看当前版本和可回滚版本：

```bash
readlink -f /srv/workbar-docs/current
ls -1 /srv/workbar-docs/releases
```

切换到已验收的旧版本：

```bash
sudo bash deploy/scripts/rollback-release.sh '<旧 release-id>'
```

回滚只切换 `current` 软链接，不需要重启 New API，也不涉及数据库回滚。至少保留一个已经验收的旧版本，确认回滚可用后再清理更早版本。

## 8. 发布后验收与回传

开发完成发布后，需要向文档维护者回传：

- 部署的完整 commit SHA；
- GitHub Actions run 链接；
- release-id；
- `readlink -f /srv/workbar-docs/current` 输出；
- `sudo nginx -t` 成功结果；
- 当前证书状态和 `certbot renew --dry-run` 结果；
- 下列请求的状态码与关键响应头；
- 一个可立即回滚的旧 release-id。

```bash
curl -I https://docs.workbar.ai/
curl -I https://docs.workbar.ai/getting-started/quick-start/
curl -I https://docs.workbar.ai/this-page-does-not-exist
```

至少确认：

- 首页和快速开始返回 `200`；
- 不存在页面返回真实 `404`，不是伪装成成功的 `200`；
- TLS 证书有效；
- HTML 使用 `Cache-Control: no-cache`；
- 哈希资源使用长期缓存；
- 响应包含 CSP、HSTS、`X-Content-Type-Options` 和 `Referrer-Policy`；
- 搜索、目录、复制、图片放大、桌面端和移动端布局正常；
- `https://workbar.ai/` 登录、密钥和模型 API 行为没有变化。

文档站验收通过后，workbar 管理员再把后台“文档链接”设置为 `https://docs.workbar.ai/`。该后台操作不属于服务器发布脚本的职责。

## 9. GitHub 协作约定

- 内容或部署配置修改统一通过 Fork 或分支提交 Pull Request。
- PR 必须等待 `Build documentation artifact` 成功后才能合并。
- 不要在 PR 中提交生成的 `dist/`、`node_modules/`、预览 HTML 或发布压缩包。
- 开发仅部署时无需仓库写权限；服务器、DNS 和 SSH 权限继续在 GitHub 之外单独管理。
- 如果发现文档或截图疑似包含密钥、邮箱、账号、余额、邀请链接等敏感信息，停止部署并通知维护者重新脱敏和构建。

## 10. 交接消息模板

```text
请部署 workbar 文档：

- 仓库：https://github.com/fhy-A/workbar-docs
- 已进入 main 的完整 commit SHA：<填写>
- main push 成功 Actions：<填写链接>
- Artifact：workbar-docs-<完整 commit SHA>
- 变更摘要：<填写>
- 部署类型：首次部署 / 后续更新

请只使用上述 SHA 对应的成功 Artifact 和同一提交中的 deploy/scripts。
不要在服务器重新构建，不要重建或重启 New API。
完成后请回传 release-id、current 实际路径、nginx -t、证书、三个 curl -I 结果及可回滚版本。
```
