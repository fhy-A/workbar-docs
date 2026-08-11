# workbar 官方用户文档

正文以 `content/` 中的 Markdown 为唯一内容源，图片和品牌资源位于 `assets/`。构建器会同时复用现有预览的视觉样式，生成可以独立部署到 `docs.workbar.ai` 的多页面静态站。

## 安装依赖

```powershell
cd preview
npm ci
```

依赖版本由 `preview/package-lock.json` 固定。生产环境和 CI 应使用 `npm ci`，不要使用未锁定依赖的临时安装结果。

## 本地预览

重新生成原有单页预览：

```powershell
cd preview
npm run build:preview
cd ..
python -m http.server 8092 --bind 127.0.0.1
```

访问 `http://127.0.0.1:8092/preview/`。该入口继续使用 hash 路由，适合快速检查全部内容和样式。

## 正式构建

```powershell
cd preview
npm run build
```

默认按 `https://docs.workbar.ai/` 生成 canonical、站内链接、robots 和 sitemap。需要在其他正式路径验证时，可以显式覆盖：

```powershell
$env:DOCS_BASE_URL = "https://docs.example.com/"
npm run build
Remove-Item Env:DOCS_BASE_URL
```

不要为普通本地预览永久修改构建脚本中的默认域名。

正式产物位于 `dist/`，部署契约为：

```text
dist/
├─ index.html
├─ 404.html
├─ robots.txt
├─ sitemap.xml
├─ search-index.json
├─ site.webmanifest
├─ assets/
└─ 各文章目录/index.html
```

本地检查正式产物：

```powershell
python -m http.server 8093 --bind 127.0.0.1 --directory dist
```

访问 `http://127.0.0.1:8093/`。本地地址仅用于页面检查；其中 canonical 仍指向构建时的正式域名。

## 构建时检查

每次正式构建都会：

- 检查 Markdown 站内链接和图片目标；
- 阻止危险链接、危险图片协议和 Markdown 原始 HTML 执行；
- 扫描正文中的常见真实密钥、访问令牌、JWT 和私钥格式，错误信息不会回显匹配值；
- 验证所有文章、站内链接、锚点、图片、样式、脚本和搜索索引均存在；
- 在全部检查通过后才替换 `dist/`，构建失败会保留上一份正式产物。

文本扫描无法识别图片像素中的个人信息或密钥。新增截图仍必须人工确认账号、邮箱、余额、邀请链接、请求内容和完整 API 密钥已经脱敏。

## 发布边界

- `dist/` 是唯一应交给静态服务器的目录；不要部署 `content/`、`preview/` 或 `node_modules/`。
- 文档站不读取 workbar 登录态，不需要连接数据库，也不应接收 API 密钥。
- 文档更新应独立于 New API 网关镜像发布。
- 上线后在 workbar 后台将“文档链接”设置为 `https://docs.workbar.ai/`。
