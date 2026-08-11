# docs.workbar.ai 部署手册

本文档用于把 `workbar-docs/dist/` 部署为独立静态站：

```text
https://docs.workbar.ai/
```

推荐结构是在现有 VPS 上继续使用 Nginx，由独立虚拟主机直接读取静态文件。文档与 New API 网关使用不同域名和发布目录，不需要把文档打进 New API 镜像，也不需要修改 `FRONTEND_BASE_URL`。

这里选择静态目录而不是再增加一个常驻文档容器：文档没有服务端运行时，直接由现有 Nginx 提供文件更简单，故障面也更小。如果现有边缘 Nginx 本身运行在容器中，可把整个 `/srv/workbar-docs` 以只读方式挂载到容器内相同路径，再使用同一份虚拟主机配置；不要只挂载 `current`，否则容器可能无法解析它指向的版本目录。

## 1. 部署结构

```text
/srv/workbar-docs/
├── current -> /srv/workbar-docs/releases/20260809T120000Z
└── releases/
    ├── 20260809T120000Z/
    └── 20260810T083000Z/
```

- 每次发布复制到新的只读版本目录。
- `current` 软链接指向正在提供服务的版本。
- 发布和回滚只原子切换 `current`，不覆盖旧版本。
- Nginx 直接读取 `/srv/workbar-docs/current`，无需为内容更新重启网关。

## 2. 前置条件

1. 为 `docs.workbar.ai` 添加指向 VPS 公网地址的 DNS `A` 记录；仅在服务器确实配置 IPv6 时添加 `AAAA` 记录。
2. 确认公网可以访问 TCP 80 和 443。
3. 服务器已安装 Nginx、Certbot 和 GNU coreutils。
4. 本地已生成正式静态产物 `workbar-docs/dist/`。
5. 正式发布前确认 `dist/` 至少包含：

   ```text
   index.html
   404.html
   robots.txt
   sitemap.xml
   assets/
   ```

> `preview/` 仅用于本地视觉预览，不应直接上传到生产环境。

## 3. 生成并检查生产产物

在 `workbar-docs/preview` 目录安装锁定依赖并构建：

```bash
cd /path/to/project/workbar-docs/preview
npm ci
npm run check
```

`check` 会执行脚本语法检查、生成 `workbar-docs/dist/` 并校验正式产物。默认站点地址为 `https://docs.workbar.ai/`；仅在测试其他部署地址时才设置 `DOCS_BASE_URL`。不得跳过失效链接、缺失图片和疑似真实密钥检查。

### 3.1 从 GitHub Actions 产物发布

仓库的 `Build documentation artifact` 工作流会对每个 `main` 推送和 Pull Request 执行同一套检查，并上传以完整 commit SHA 命名的产物。正式发布时应选择准备上线的 commit 对应且状态为成功的工作流运行，在页面底部下载 `workbar-docs-<commit-sha>` artifact。下载并解压 GitHub 外层压缩包后，会得到：

```text
workbar-docs-<commit-sha>.tar.gz
workbar-docs-<commit-sha>.tar.gz.sha256
```

在同一目录校验并展开为部署脚本要求的 `dist/`：

```bash
sha256sum -c workbar-docs-<commit-sha>.tar.gz.sha256
install -d dist
tar -xzf workbar-docs-<commit-sha>.tar.gz -C dist
test -f dist/index.html
```

校验失败、工作流未成功或 artifact 的 commit SHA 与计划发布版本不一致时不得继续。服务器发布时还需要使用同一 commit 中的 `deploy/scripts/`；不要把其他版本的脚本与当前 artifact 混用。

## 4. 初始化服务器目录

以下命令以 Debian/Ubuntu 默认的 Nginx 用户组 `www-data` 为例：

```bash
sudo install -d -o root -g www-data -m 0755 /srv/workbar-docs
sudo install -d -o root -g www-data -m 0755 /srv/workbar-docs/releases
sudo install -d -o root -g www-data -m 0755 /var/www/certbot
```

如果 Nginx 使用 `nginx` 用户组，后续发布时设置：

```bash
sudo env WORKBAR_DOCS_GROUP=nginx \
  bash deploy/scripts/deploy-release.sh dist "$(date -u +%Y%m%dT%H%M%SZ)"
```

## 5. 发布首个版本

把完整项目或至少 `dist/` 与 `deploy/scripts/` 上传到服务器的临时工作目录，然后运行：

```bash
cd /path/to/uploaded/workbar-docs
sudo bash deploy/scripts/deploy-release.sh dist "$(date -u +%Y%m%dT%H%M%SZ)"
```

脚本会：

1. 检查必需文件和目录；
2. 拒绝包含软链接、`.env`、`.git` 或疑似真实 `sk-` 密钥的产物；
3. 复制到同一文件系统内的临时目录；
4. 规范化目录和文件权限；
5. 将临时目录原子改名为正式版本目录；
6. 原子切换 `current` 软链接。

脚本不会自动删除旧版本。

## 6. 首次配置 HTTP 与申请证书

先安装安全头片段和仅 HTTP 的引导配置：

```bash
sudo install -m 0644 deploy/nginx/snippets/workbar-docs-security-headers.conf \
  /etc/nginx/snippets/workbar-docs-security-headers.conf

sudo install -m 0644 deploy/nginx/docs.workbar.ai.bootstrap.conf \
  /etc/nginx/sites-available/docs.workbar.ai

sudo ln -sfn /etc/nginx/sites-available/docs.workbar.ai \
  /etc/nginx/sites-enabled/docs.workbar.ai

sudo nginx -t
sudo systemctl reload nginx
```

确认 DNS 已生效后，用 Webroot 模式申请证书：

```bash
sudo certbot certonly --webroot \
  --webroot-path /var/www/certbot \
  --domain docs.workbar.ai
```

不得在 DNS 尚未生效时反复申请，以免触发签发频率限制。

## 7. 启用 HTTPS 正式配置

证书签发成功后替换为正式配置：

```bash
sudo install -m 0644 deploy/nginx/docs.workbar.ai.conf \
  /etc/nginx/sites-available/docs.workbar.ai

sudo nginx -t
sudo systemctl reload nginx
```

正式配置包含：

- HTTP 自动跳转 HTTPS；
- ACME 续期目录；
- HTML 不缓存，避免版本切换后仍显示旧正文；
- 带内容哈希的资源缓存一年且标记 `immutable`；
- 未带内容哈希的图片、CSS、JS 缓存一小时；
- CSP、HSTS、`nosniff`、防 iframe、安全 Referrer 和权限限制；
- `404.html` 与关闭目录列表。

验证自动续期：

```bash
sudo certbot renew --dry-run
```

## 8. 后续发布

每次先在本地重新构建和校验，再把 `dist/` 上传到服务器临时目录，然后运行：

```bash
sudo bash deploy/scripts/deploy-release.sh dist "$(date -u +%Y%m%dT%H%M%SZ)"
```

静态内容切换不需要 reload Nginx。若同时修改了 Nginx 配置，必须先执行：

```bash
sudo nginx -t && sudo systemctl reload nginx
```

旧版本保留到新版本完成验收后再人工清理。删除旧版本前先确认它不是 `current` 指向的版本，也不是计划中的回滚目标。

## 9. 回滚

查看可用版本和当前版本：

```bash
readlink -f /srv/workbar-docs/current
ls -1 /srv/workbar-docs/releases
```

切换到指定旧版本：

```bash
sudo bash deploy/scripts/rollback-release.sh 20260809T120000Z
```

回滚同样只切换软链接，不需要重启 New API 或回滚数据库。

## 10. workbar 后台接入

文档站验收通过后，在 workbar 管理后台完成：

1. 打开“系统设置 → 站点与品牌 → 系统信息”；
2. 将“文档链接”设置为 `https://docs.workbar.ai/`；
3. 保存更改；
4. 分别以未登录用户和已登录用户点击顶部“文档”，确认能打开正式站点；
5. 检查自定义首页的“文档”和“查看新手教程”入口。

后台配置属于线上配置，必须由有权限的管理员在文档站验收通过后操作。

## 11. 上线验收

### 页面与交互

- [ ] `https://docs.workbar.ai/` 返回 200 且证书有效；
- [ ] 每篇文章的真实地址可以直接打开、刷新和分享；
- [ ] 站内链接、目录锚点、搜索、复制按钮和图片放大正常；
- [ ] 桌面端与移动端布局无横向溢出；
- [ ] 不存在失效图片、空白截图或指向本地预览服务（如 `127.0.0.1:8092`、`127.0.0.1:8093`）的链接；Code 专题中用于本地界面的 `127.0.0.1:3010` 除外；
- [ ] 不存在真实 API Key、邮箱、用户名或其他未脱敏信息；
- [ ] 不存在的地址返回自定义 404 和 HTTP 404 状态码。

### 缓存与安全

```bash
curl -I https://docs.workbar.ai/
curl -I https://docs.workbar.ai/getting-started/quick-start/
curl -I https://docs.workbar.ai/this-page-does-not-exist
```

- [ ] HTML 包含 `Cache-Control: no-cache`；
- [ ] 哈希资源包含长期 `Cache-Control`；
- [ ] 404 请求不是 200；
- [ ] 响应包含 CSP、HSTS、`X-Content-Type-Options` 和 `Referrer-Policy`；
- [ ] 浏览器控制台没有 CSP、404 或混合内容错误。

### 与网关隔离

- [ ] `https://workbar.ai/` 和模型 API 行为没有变化；
- [ ] 文档发布不需要重建或重启 New API；
- [ ] 文档故障时仍可正常登录、创建 API 密钥和调用模型；
- [ ] New API 后台仅保存公开文档地址，没有保存服务器路径或部署凭据。

## 12. 基础监控

至少对以下地址配置外部可用性监控：

```text
https://docs.workbar.ai/
https://docs.workbar.ai/getting-started/quick-start/
```

建议监控 HTTP 状态、TLS 到期时间和响应时间。文档统计如需接入分析工具，应避免收集 API Key、查询参数中的敏感信息或登录态标识。
