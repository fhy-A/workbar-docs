const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const contentDir = path.join(rootDir, 'content');
const distDir = path.join(rootDir, 'dist');
const stageDir = path.join(rootDir, '.dist-build');
const defaultBaseUrl = 'https://docs.workbar.ai/';

function assertSafeBuildDirectory(target, expectedName) {
  if (path.dirname(target) !== rootDir || path.basename(target) !== expectedName) {
    throw new Error(`Refusing to modify unexpected build directory: ${target}`);
  }
}

assertSafeBuildDirectory(distDir, 'dist');
assertSafeBuildDirectory(stageDir, '.dist-build');

function normalizeBaseUrl(value) {
  const url = new URL(value || defaultBaseUrl);
  if (!['https:', 'http:'].includes(url.protocol)) {
    throw new Error('DOCS_BASE_URL must use http or https.');
  }
  if (url.search || url.hash) {
    throw new Error('DOCS_BASE_URL cannot contain a query string or hash.');
  }
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/`;
  return url;
}

const baseUrl = normalizeBaseUrl(process.env.DOCS_BASE_URL);
const basePath = baseUrl.pathname;

function listFiles(directory, predicate = () => true) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(absolute, predicate));
    else if (predicate(absolute)) files.push(absolute);
  }
  return files;
}

function copyDirectory(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (entry.isDirectory()) copyDirectory(sourcePath, destinationPath);
    else if (entry.isFile()) fs.copyFileSync(sourcePath, destinationPath);
    else throw new Error(`Unsupported asset entry: ${sourcePath}`);
  }
}

const secretPatterns = [
  ['OpenAI-style secret key', /\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/g],
  ['GitHub personal access token', /\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/g],
  ['AWS access key', /\bAKIA[A-Z0-9]{16}\b/g],
  ['JWT credential', /\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{8,}\b/g],
  ['private key block', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
];

function scanTextForSecrets(text, fileLabel) {
  const failures = [];
  for (const [label, pattern] of secretPatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text))) {
      const line = text.slice(0, match.index).split(/\r?\n/).length;
      failures.push(`${fileLabel}:${line} matched ${label}`);
    }
  }
  return failures;
}

function validateSourceSecrets() {
  const failures = [];
  for (const file of listFiles(contentDir, (candidate) => candidate.endsWith('.md'))) {
    failures.push(...scanTextForSecrets(
      fs.readFileSync(file, 'utf8'),
      path.relative(rootDir, file).replace(/\\/g, '/'),
    ));
  }
  if (failures.length) {
    throw new Error(`Possible secret detected. Values are intentionally redacted:\n- ${failures.join('\n- ')}`);
  }
}

validateSourceSecrets();

// Requiring the preview builder refreshes preview/index.html and exposes the
// exact same validated Markdown render used by the production build.
const { docs, docDefs, groups, escapeHtml } = require('./build.cjs');
console.log('Preparing production document routes and assets...');
const previewHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const styleMatch = previewHtml.match(/<style>([\s\S]*?)<\/style>/i);
if (!styleMatch) throw new Error('Could not read the shared visual styles from preview/index.html.');

const productionStyles = `${styleMatch[1].trim()}\n
/* Production-only additions. */
.topbar-brand-wrap { display: flex; align-items: center; gap: 8px; min-width: 0; }
.brand-image { display: block; width: 34px; height: 34px; border-radius: 50%; }
.skip-link { position: fixed; z-index: 200; top: 10px; left: 12px; padding: 9px 13px; border-radius: 10px; background: var(--text); color: var(--panel-solid); transform: translateY(-160%); transition: transform .16s ease; }
.skip-link:focus { transform: translateY(0); }
.not-found { max-width: 760px; margin: 8vh auto 0; padding: clamp(28px, 6vw, 58px); border: 1px solid var(--border); border-radius: 26px; background: var(--panel-solid); box-shadow: var(--shadow); }
.not-found-code { margin: 0 0 10px; color: var(--green); font-family: var(--font-mono); font-size: 13px; font-weight: 760; letter-spacing: .08em; }
.not-found h1 { margin: 0; font-size: clamp(38px, 7vw, 68px); line-height: 1.08; letter-spacing: -.055em; }
.not-found p { margin: 18px 0 0; color: var(--muted); }
.not-found a { display: inline-flex; margin-top: 24px; padding: 11px 16px; border-radius: 12px; background: var(--lime); color: #11140f; text-decoration: none; font-weight: 760; }
@media (max-width: 820px) { .brand-image { width: 31px; height: 31px; } }
`;

const productionScript = fs.readFileSync(path.join(__dirname, 'site.js'), 'utf8');

function digest(value) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 12);
}

const cssFileName = `site.${digest(productionStyles)}.css`;
const jsFileName = `site.${digest(productionScript)}.js`;

function routeFromFile(file) {
  const normalized = file.replace(/\\/g, '/').replace(/\.md$/i, '');
  if (normalized === 'index') return '';
  return normalized.endsWith('/index') ? normalized.slice(0, -'/index'.length) : normalized;
}

function joinSitePath(relative = '') {
  const normalized = relative.replace(/^\/+/, '');
  return `${basePath}${normalized}`.replace(/\/{2,}/g, '/');
}

function routeUrl(route) {
  return route ? joinSitePath(`${route}/`) : basePath;
}

function absoluteUrl(relative = '') {
  return new URL(relative.replace(/^\/+/, ''), baseUrl).href;
}

const routeById = new Map(docDefs.map((doc) => [doc.id, routeFromFile(doc.file)]));
if (routeById.size !== docDefs.length) throw new Error('Document IDs must be unique.');
const routeValues = [...routeById.values()];
if (new Set(routeValues).size !== routeValues.length) throw new Error('Document output routes must be unique.');

function decodeHtml(value) {
  return String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(value, index) {
  const base = value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s/]+/g, '-')
    .replace(/[^\p{L}\p{N}_-]/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return base || `section-${index + 1}`;
}

function rewriteDocumentLinks(html) {
  return html.replace(
    /href="#([^"?]+)(?:\?section=([^"]+))?"\s+data-doc-link="([^"]+)"/g,
    (match, _hashRoute, encodedSection, targetId) => {
      if (!routeById.has(targetId)) throw new Error(`Unknown production document route: ${targetId}`);
      let anchor = '';
      if (encodedSection) {
        try {
          anchor = `#${decodeURIComponent(encodedSection)}`;
        } catch (_) {
          throw new Error(`Invalid encoded document anchor for ${targetId}: ${encodedSection}`);
        }
      }
      return `href="${escapeHtml(routeUrl(routeById.get(targetId)) + anchor)}"`;
    },
  );
}

function rewriteAssetPaths(html) {
  return html.replace(
    /(href|src)="(?:\.\.\/)?assets\/([^"]+)"/g,
    (_match, attribute, relative) => `${attribute}="${escapeHtml(joinSitePath(`assets/${relative}`))}"`,
  );
}

function addHeadingIds(html) {
  const seen = new Map();
  const headings = [];
  let index = 0;
  const output = html.replace(/<h2>([\s\S]*?)<\/h2>/g, (match, inner) => {
    const title = decodeHtml(inner);
    const base = slugify(title, index);
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    const id = count ? `${base}-${count + 1}` : base;
    index += 1;
    headings.push({ id, title });
    return `<h2 id="${escapeHtml(id)}">${inner}</h2>`;
  });
  return { html: output, headings };
}

function wrapTables(html) {
  return html.replace(/<table>([\s\S]*?)<\/table>/g, '<div class="table-wrap"><table>$1</table></div>');
}

function prepareDocument(doc) {
  let html = rewriteDocumentLinks(doc.html);
  html = rewriteAssetPaths(html);
  const withHeadings = addHeadingIds(html);
  html = wrapTables(withHeadings.html);
  return {
    ...doc,
    html,
    headings: withHeadings.headings,
    route: routeById.get(doc.id),
    url: routeUrl(routeById.get(doc.id)),
  };
}

const preparedDocs = docs.map(prepareDocument);
console.log(`Prepared ${preparedDocs.length} production documents.`);
const preparedById = new Map(preparedDocs.map((doc) => [doc.id, doc]));
const articleOrder = preparedDocs.filter((doc) => doc.id !== 'home');

function navMarkup(currentDoc) {
  const homeCurrent = currentDoc?.id === 'home' ? ' class="nav-home active" aria-current="page"' : ' class="nav-home"';
  const sections = groups.map((group) => {
    const links = group.docs.map(([id, , title]) => {
      const current = currentDoc?.id === id ? ' active' : '';
      const ariaCurrent = currentDoc?.id === id ? ' aria-current="page"' : '';
      return `<a class="nav-link${current}" href="${escapeHtml(preparedById.get(id).url)}"${ariaCurrent}><span>${escapeHtml(title)}</span></a>`;
    }).join('');
    const open = currentDoc?.groupId === group.id || (currentDoc?.id === 'home' && group.id === 'start') ? ' open' : '';
    return `<details class="nav-group"${open}><summary><span>${escapeHtml(group.label)}</span><span class="chevron" aria-hidden="true">⌄</span></summary><div class="nav-group-links">${links}</div></details>`;
  }).join('');
  return `<a${homeCurrent} href="${escapeHtml(basePath)}">文档首页</a>${sections}`;
}

function homeMarkup() {
  const link = (id) => preparedById.get(id).url;
  return `<section class="home-hero">
    <p class="home-kicker">一个账号，多种模型</p>
    <h1>让 AI 工具真正开始工作。</h1>
    <p>从第一次连接，到日常使用、费用管理和程序接入，按你的目标找到下一步。不需要先理解复杂的 API 概念。</p>
    <a class="home-primary" href="${escapeHtml(link('quick-start'))}">从快速开始进入 <span aria-hidden="true">→</span></a>
  </section>
  <section class="goal-grid" aria-label="按目标选择文档">
    <a class="goal-card" href="${escapeHtml(link('quick-start'))}"><span class="goal-index">01 / 新手</span><h2>第一次使用 workbar</h2><p>创建 API 密钥，连接 workbar Code，并完成第一次只读任务。</p></a>
    <a class="goal-card" href="${escapeHtml(link('compatible-tools'))}"><span class="goal-index">02 / 工具</span><h2>连接已有 AI 工具</h2><p>判断工具使用的协议和地址字段，填写正确的地址、密钥与模型。</p></a>
    <a class="goal-card" href="${escapeHtml(link('claude-code'))}"><span class="goal-index">03 / Claude Code</span><h2>在 Claude Code 中使用</h2><p>配置 workbar 地址和专用密钥，先完成一次安全的基础验证。</p></a>
    <a class="goal-card" href="${escapeHtml(link('api-overview'))}"><span class="goal-index">04 / 开发者</span><h2>在自己的程序中接入</h2><p>选择 OpenAI、Claude 或 Gemini 兼容格式，并验证最小请求。</p></a>
  </section>
  <section class="home-help"><div><strong>遇到登录、密钥、模型或余额问题？</strong><span>按你看到的页面现象逐项排查，不需要先知道 HTTP 状态码。</span></div><a href="${escapeHtml(link('common-problems'))}">打开常见问题 →</a></section>`;
}

function articleNavigation(doc) {
  const index = articleOrder.findIndex((item) => item.id === doc.id);
  if (index < 0) return '';
  const previous = index > 0 ? articleOrder[index - 1] : null;
  const next = index < articleOrder.length - 1 ? articleOrder[index + 1] : null;
  const item = (target, direction) => target
    ? `<a href="${escapeHtml(target.url)}"><small>${direction}</small><strong>${escapeHtml(target.title)}</strong></a>`
    : '<span></span>';
  return `<nav class="article-nav" aria-label="上一篇和下一篇">${item(previous, '上一篇')}${item(next, '下一篇')}</nav>`;
}

function articleMarkup(doc) {
  if (doc.id === 'home') return homeMarkup();
  return `<header class="article-head">
    <div class="breadcrumb"><span>workbar 文档</span><span aria-hidden="true">/</span><span>${escapeHtml(doc.groupLabel)}</span></div>
    <h1>${escapeHtml(doc.title)}</h1>
    <p class="article-summary">${escapeHtml(doc.summary)}</p>
  </header>
  <article class="article-body" data-document="${escapeHtml(doc.id)}">${doc.html}</article>
  ${articleNavigation(doc)}`;
}

function tocMarkup(doc) {
  if (doc.id === 'home') return '<p class="toc-title">文档首页</p><p class="toc-empty">按你的目标选择入口</p>';
  if (!doc.headings.length) return '<p class="toc-title">本文目录</p><p class="toc-empty">本页无需目录</p>';
  return `<p class="toc-title">本文目录</p>${doc.headings.map((heading) => (
    `<a href="#${escapeHtml(heading.id)}" data-section="${escapeHtml(heading.id)}">${escapeHtml(heading.title)}</a>`
  )).join('')}`;
}

function pageTemplate({
  title,
  description,
  canonical,
  currentDoc = null,
  main,
  toc,
  robots = 'index,follow',
}) {
  const favicon = joinSitePath('assets/brand/workbar-symbol-universal.svg');
  const cssUrl = joinSitePath(`assets/${cssFileName}`);
  const jsUrl = joinSitePath(`assets/${jsFileName}`);
  const searchUrl = joinSitePath('search-index.json');
  return `<!doctype html>
<html lang="zh-CN" data-theme="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="${escapeHtml(robots)}">
  <meta name="theme-color" content="#f5f5ef" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#0c100c" media="(prefers-color-scheme: dark)">
  <meta property="og:locale" content="zh_CN">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="workbar 文档">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <link rel="icon" href="${escapeHtml(favicon)}" type="image/svg+xml">
  <link rel="manifest" href="${escapeHtml(joinSitePath('site.webmanifest'))}">
  <link rel="sitemap" href="${escapeHtml(joinSitePath('sitemap.xml'))}" type="application/xml">
  <link rel="stylesheet" href="${escapeHtml(cssUrl)}">
  <title>${escapeHtml(title)}</title>
  <script src="${escapeHtml(jsUrl)}" defer></script>
</head>
<body data-search-index="${escapeHtml(searchUrl)}">
  <a class="skip-link" href="#mainContent">跳到正文</a>
  <header class="topbar">
    <div class="topbar-brand-wrap">
      <button class="mobile-menu-button" id="menuButton" aria-label="打开文档目录" aria-expanded="false">☰</button>
      <a class="brand" href="${escapeHtml(basePath)}" aria-label="workbar 文档首页">
        <img class="brand-image" src="${escapeHtml(favicon)}" alt="" width="34" height="34">
        <span class="brand-label">workbar<small>文档</small></span>
      </a>
    </div>
    <div class="search-wrap" role="search">
      <span class="search-icon" aria-hidden="true">⌕</span>
      <label class="screen-reader" for="searchInput">搜索文档</label>
      <input class="search-input" id="searchInput" type="search" placeholder="搜索文档，例如：自动分组" autocomplete="off">
      <span class="search-shortcut" aria-hidden="true">Ctrl K</span>
    </div>
    <div class="top-actions">
      <button class="icon-button" id="themeButton" aria-label="切换深浅色主题" title="切换深浅色主题">◐</button>
      <a class="back-link" href="https://workbar.ai/" target="_blank" rel="noopener"><span>返回 workbar</span> ↗</a>
    </div>
  </header>
  <aside class="sidebar" id="sidebar" aria-label="文档目录"><nav>${navMarkup(currentDoc)}</nav><div class="sidebar-foot">正式文档 · 内容以当前 workbar 页面实际显示为准</div></aside>
  <button class="mobile-backdrop" id="mobileBackdrop" aria-label="关闭文档目录"></button>
  <main class="page" id="mainContent" tabindex="-1"><div class="reader-shell"><div class="main-column">${main}</div><aside class="toc" aria-label="本文目录">${toc}</aside></div></main>
  <div class="search-panel" id="searchPanel" hidden aria-label="搜索结果" aria-live="polite"></div>
  <div class="lightbox" id="lightbox" hidden role="dialog" aria-modal="true" aria-label="查看文档大图"><div class="lightbox-head"><button class="lightbox-close" id="lightboxClose" aria-label="关闭大图">×</button></div><div class="lightbox-body"><img id="lightboxImage" alt=""></div></div>
</body>
</html>`;
}

function writeFile(relative, content) {
  const target = path.join(stageDir, ...relative.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
}

function writeDocumentPage(doc) {
  const relative = doc.route ? `${doc.route}/index.html` : 'index.html';
  const title = doc.id === 'home' ? 'workbar 文档' : `${doc.title} · workbar 文档`;
  writeFile(relative, pageTemplate({
    title,
    description: doc.summary,
    canonical: absoluteUrl(doc.route ? `${doc.route}/` : ''),
    currentDoc: doc,
    main: articleMarkup(doc),
    toc: tocMarkup(doc),
  }));
}

function xmlEscape(value) {
  return String(value).replace(/[<>&'"]/g, (character) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
  })[character]);
}

function expectedFileForUrl(urlValue) {
  const parsed = new URL(urlValue, baseUrl);
  if (parsed.origin !== baseUrl.origin || !parsed.pathname.startsWith(basePath)) return null;
  const relative = decodeURIComponent(parsed.pathname.slice(basePath.length));
  if (!relative || relative.endsWith('/')) return path.join(stageDir, relative, 'index.html');
  return path.join(stageDir, ...relative.split('/'));
}

function validateGeneratedSite() {
  const required = ['index.html', '404.html', 'robots.txt', 'sitemap.xml', 'search-index.json', 'site.webmanifest'];
  const failures = [];
  for (const relative of required) {
    if (!fs.existsSync(path.join(stageDir, relative))) failures.push(`missing ${relative}`);
  }
  for (const doc of preparedDocs) {
    const relative = doc.route ? `${doc.route}/index.html` : 'index.html';
    if (!fs.existsSync(path.join(stageDir, ...relative.split('/')))) failures.push(`missing page ${relative}`);
  }
  for (const file of listFiles(stageDir, (candidate) => candidate.endsWith('.html'))) {
    const html = fs.readFileSync(file, 'utf8');
    const label = path.relative(stageDir, file).replace(/\\/g, '/');
    failures.push(...scanTextForSecrets(html, label));
    if (/data-doc-link=|\.\.\/assets\//.test(html)) failures.push(`${label} contains a preview-only link or asset path`);
    const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));
    for (const match of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
      const reference = match[1];
      if (/^(?:mailto:|tel:|javascript:|data:)/i.test(reference)) continue;
      if (reference.startsWith('#')) {
        if (reference.length > 1 && !ids.has(reference.slice(1))) failures.push(`${label} has missing anchor ${reference}`);
        continue;
      }
      const expected = expectedFileForUrl(reference);
      if (expected && !fs.existsSync(expected)) failures.push(`${label} points to missing ${reference}`);
    }
  }
  try {
    const searchIndex = JSON.parse(fs.readFileSync(path.join(stageDir, 'search-index.json'), 'utf8'));
    if (searchIndex.length !== preparedDocs.length) failures.push('search-index.json has the wrong document count');
  } catch (error) {
    failures.push(`search-index.json is invalid: ${error.message}`);
  }
  if (failures.length) throw new Error(`Production validation failed:\n- ${[...new Set(failures)].join('\n- ')}`);
}

function build() {
  console.log('Writing staged production site...');
  fs.rmSync(stageDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(stageDir, 'assets'), { recursive: true });

  const sourceAssets = path.join(rootDir, 'assets');
  if (!fs.existsSync(sourceAssets)) throw new Error('Missing workbar-docs/assets directory.');
  copyDirectory(sourceAssets, path.join(stageDir, 'assets'));
  fs.writeFileSync(path.join(stageDir, 'assets', cssFileName), productionStyles, 'utf8');
  fs.writeFileSync(path.join(stageDir, 'assets', jsFileName), productionScript, 'utf8');

  preparedDocs.forEach(writeDocumentPage);
  console.log('Wrote production article pages.');

  const notFoundTitle = '页面未找到 · workbar 文档';
  const notFoundDescription = '这个文档地址不存在，可能已经移动或输入有误。';
  writeFile('404.html', pageTemplate({
    title: notFoundTitle,
    description: notFoundDescription,
    canonical: absoluteUrl('404.html'),
    main: `<section class="not-found"><p class="not-found-code">404 / NOT FOUND</p><h1>没有找到这个页面。</h1><p>${notFoundDescription}</p><a href="${escapeHtml(basePath)}">返回文档首页</a></section>`,
    toc: '<p class="toc-title">页面未找到</p><p class="toc-empty">请返回首页重新选择文档</p>',
    robots: 'noindex,follow',
  }));

  const searchIndex = preparedDocs.map((doc) => ({
    id: doc.id,
    title: doc.title,
    summary: doc.summary,
    groupLabel: doc.groupLabel,
    url: doc.url,
    searchText: doc.searchText,
  }));
  writeFile('search-index.json', `${JSON.stringify(searchIndex)}\n`);

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${preparedDocs.map((doc) => `  <url><loc>${xmlEscape(absoluteUrl(doc.route ? `${doc.route}/` : ''))}</loc></url>`).join('\n')}\n</urlset>\n`;
  writeFile('sitemap.xml', sitemap);
  writeFile('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${absoluteUrl('sitemap.xml')}\n`);
  writeFile('site.webmanifest', `${JSON.stringify({
    name: 'workbar 文档',
    short_name: 'workbar 文档',
    description: 'workbar 官方用户文档',
    lang: 'zh-CN',
    start_url: basePath,
    scope: basePath,
    display: 'standalone',
    background_color: '#f5f5ef',
    theme_color: '#f5f5ef',
    icons: [{ src: joinSitePath('assets/brand/workbar-symbol-universal.svg'), sizes: 'any', type: 'image/svg+xml' }],
  }, null, 2)}\n`);

  console.log('Validating staged production site...');
  validateGeneratedSite();
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.renameSync(stageDir, distDir);
  console.log(`Built ${preparedDocs.length} production pages -> ${distDir}`);
  console.log(`Canonical base URL: ${baseUrl.href}`);
}

try {
  build();
} catch (error) {
  fs.rmSync(stageDir, { recursive: true, force: true });
  throw error;
}
