# workbar 文档构建器

`index.html` 是由 `../content/` 中的 Markdown 生成的本地单页预览。`build-dist.cjs` 使用同一份渲染结果和样式生成 `../dist/` 正式多页面静态站。两个入口都不读取线上用户数据，也不会修改 workbar 配置。

## 直接查看

双击 `index.html` 即可打开。为了让浏览器按正常网站方式处理本地资源，也可以在 `workbar-docs` 目录运行：

```powershell
python -m http.server 8092 --bind 127.0.0.1
```

然后访问：

```text
http://127.0.0.1:8092/preview/
```

## 安装依赖

首次使用或锁文件变化后，在本目录安装锁定依赖：

```powershell
npm ci
```

## 重新生成本地预览

```powershell
npm run build:preview
```

## 生成正式静态站

```powershell
npm run build
```

正式产物位于 `../dist/`。完整命令、目录契约、构建检查和部署边界见 `../README.md`。

构建过程会检查 Markdown 站内链接和图片路径；目标不存在时会停止生成，避免把失效链接带入页面。Markdown 中的原始 HTML 会按文字显示，不会直接执行；危险链接协议和不受支持的图片协议也会被阻止。
