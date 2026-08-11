const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const rootDir = path.resolve(__dirname, '..');
const contentDir = path.join(rootDir, 'content');
const outputFile = path.join(__dirname, 'index.html');

const groups = [
  {
    id: 'start',
    label: '开始使用',
    docs: [
      ['quick-start', 'getting-started/quick-start.md', '快速开始', '注册账号、创建 API 密钥、连接 workbar Code，并完成第一次只读任务。'],
    ],
  },
  {
    id: 'tools',
    label: '连接 AI 工具',
    docs: [
      ['workbar-code', 'tools/workbar-code.md', '使用 workbar Code', '下载并连接本地 Code，选择项目、模型和权限模式，了解同步与本地数据边界。'],
      ['claude-code', 'tools/claude-code.md', '在 Claude Code 中使用 workbar', '安装 Claude Code，配置 workbar 地址和专用密钥，并完成一次安全验证。'],
      ['compatible-tools', 'tools/compatible-tools.md', '连接其他兼容工具', '判断工具使用的协议和地址字段，填写正确的地址、密钥与模型。'],
    ],
  },
  {
    id: 'account',
    label: '账号与使用',
    docs: [
      ['manage-api-keys', 'keys/manage-api-keys.md', '管理 API 密钥', '创建、限制、复制、停用和更换密钥，并降低泄露风险。'],
      ['models-auto-routing', 'models/models-and-auto-routing.md', '模型、分组与自动选择', '理解模型可用范围、自动分组和模型限制，并排查模型为何没有出现。'],
      ['balance-pricing', 'billing/balance-pricing-and-usage.md', '余额、价格与使用记录', '查看模型价格、完成充值，并用订单和使用日志核对费用。'],
      ['account-security', 'account/account-and-security.md', '账号与安全', '管理密码、邮箱、Passkey、双重身份验证以及不同凭据的安全边界。'],
    ],
  },
  {
    id: 'api',
    label: '开发者接口',
    docs: [
      ['api-overview', 'api/index.md', 'API 接入概览', '选择 OpenAI、Claude 或 Gemini 兼容格式，并按最小步骤验证接入。'],
      ['openai-compatible', 'api/openai-compatible.md', 'OpenAI 兼容接口', '使用 Chat Completions 或 Responses 完成最小 OpenAI 格式请求。'],
      ['claude-compatible', 'api/claude-compatible.md', 'Claude 兼容接口', '使用 Messages API、正确认证头和请求结构完成 Claude 格式调用。'],
      ['gemini-compatible', 'api/gemini-compatible.md', 'Gemini 兼容接口', '使用 generateContent 路径、Gemini 认证和请求结构完成最小调用。'],
    ],
  },
  {
    id: 'help',
    label: '获取帮助',
    docs: [
      ['common-problems', 'troubleshooting/common-problems.md', '常见问题排查', '按页面现象排查登录、Code、密钥、模型、余额和服务错误，并安全反馈。'],
    ],
  },
];

const home = {
  id: 'home',
  file: 'index.md',
  title: 'workbar 文档',
  summary: '按你的使用目标，找到从首次连接到工具配置、费用管理和接口接入的指南。',
  groupId: 'home',
  groupLabel: '文档首页',
};

const docDefs = [home];
for (const group of groups) {
  for (const [id, file, title, summary] of group.docs) {
    docDefs.push({ id, file, title, summary, groupId: group.id, groupLabel: group.label });
  }
}

const fileToRoute = new Map(
  docDefs.map((doc) => [path.normalize(path.resolve(contentDir, doc.file)).toLowerCase(), doc.id]),
);

marked.setOptions({
  gfm: true,
  breaks: false,
});

marked.use({
  renderer: {
    html(token) {
      const rawHtml = typeof token === 'string' ? token : token.text;
      return escapeHtml(rawHtml || '');
    },
  },
});

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function stripHtml(value) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
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

function rewriteDocLinks(html, sourceFile) {
  const sourceDir = path.dirname(sourceFile);
  return html.replace(/href="([^"]+)"/g, (match, href) => {
    const normalizedHref = href.trim();
    const compactHref = normalizedHref.replace(/[\u0000-\u0020]+/g, '').toLowerCase();
    if (compactHref.startsWith('//') || /^(?:javascript|vbscript|data):/.test(compactHref)) {
      return 'href="#" data-blocked-link="true"';
    }
    if (/^(?:https?:|mailto:|tel:|#)/i.test(normalizedHref)) return `href="${normalizedHref}"`;
    if (/^[a-z][a-z0-9+.-]*:/i.test(normalizedHref)) return 'href="#" data-blocked-link="true"';
    const [targetPath, anchor = ''] = normalizedHref.split('#');
    const absoluteTarget = path.normalize(path.resolve(sourceDir, decodeURI(targetPath))).toLowerCase();
    const route = fileToRoute.get(absoluteTarget);
    if (!route) {
      if (/\.md$/i.test(targetPath)) throw new Error(`Unresolved document link in ${sourceFile}: ${href}`);
      return match;
    }
    const suffix = anchor ? `?section=${encodeURIComponent(anchor)}` : '';
    return `href="#${route}${suffix}" data-doc-link="${route}"`;
  });
}

function imageSize(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    if (buffer.length >= 24 && buffer.toString('ascii', 1, 4) === 'PNG') {
      return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    }
    if (buffer.length >= 12 && buffer[0] === 0xff && buffer[1] === 0xd8) {
      const startOfFrame = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
      let offset = 2;
      while (offset + 9 < buffer.length) {
        if (buffer[offset] !== 0xff) {
          offset += 1;
          continue;
        }
        const marker = buffer[offset + 1];
        if (marker === 0xd9 || marker === 0xda) break;
        if (marker === 0x00 || marker === 0xff) {
          offset += 1;
          continue;
        }
        const segmentLength = buffer.readUInt16BE(offset + 2);
        if (startOfFrame.has(marker)) {
          return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
        }
        if (segmentLength < 2) break;
        offset += segmentLength + 2;
      }
    }
  } catch (_) {
    // Missing images remain visible as normal browser errors and are caught by validation.
  }
  return null;
}

function rewriteImages(html, sourceFile) {
  const sourceDir = path.dirname(sourceFile);
  return html.replace(/<img\s+([^>]*?)src="([^"]+)"([^>]*)>/g, (match, before, src, after) => {
    const normalizedSrc = src.trim();
    const compactSrc = normalizedSrc.replace(/[\u0000-\u0020]+/g, '').toLowerCase();
    if (compactSrc.startsWith('//') || /^(?:javascript|vbscript|data):/.test(compactSrc)) {
      return `<span class="image-blocked" role="img" aria-label="已阻止不安全的图片地址"></span>`;
    }
    if (/^https?:/i.test(normalizedSrc)) return match;
    if (/^[a-z][a-z0-9+.-]*:/i.test(normalizedSrc)) {
      return `<span class="image-blocked" role="img" aria-label="已阻止不支持的图片地址"></span>`;
    }
    const absoluteImage = path.resolve(sourceDir, decodeURI(normalizedSrc));
    if (!fs.existsSync(absoluteImage)) throw new Error(`Missing image in ${sourceFile}: ${src}`);
    const relativeImage = path.relative(__dirname, absoluteImage).replace(/\\/g, '/');
    const size = imageSize(absoluteImage);
    const dimensions = size ? ` width="${size.width}" height="${size.height}"` : '';
    return `<img ${before}src="${relativeImage}"${after}${dimensions} loading="lazy" decoding="async">`;
  });
}

function buildFigures(html) {
  return html.replace(
    /<p><img\s+([^>]*?src="([^"]+)"[^>]*)><\/p>\s*<p><em>([\s\S]*?)<\/em><\/p>/g,
    (match, attributes, src, caption) => {
      const sizeMatch = attributes.match(/width="(\d+)"\s+height="(\d+)"/);
      const ratio = sizeMatch ? Number(sizeMatch[1]) / Number(sizeMatch[2]) : 0;
      const wideClass = ratio > 1.7 ? ' is-wide' : '';
      const altMatch = attributes.match(/alt="([^"]*)"/);
      const alt = altMatch ? altMatch[1] : '文档配图';
      return `<figure class="doc-figure${wideClass}"><a href="${src}" data-lightbox aria-label="查看大图：${escapeHtml(alt)}"><img ${attributes}></a><figcaption>${caption}</figcaption></figure>`;
    },
  );
}

function renderMarkdown(doc) {
  const sourceFile = path.resolve(contentDir, doc.file);
  const markdown = fs.readFileSync(sourceFile, 'utf8');
  let html = marked.parse(markdown);
  html = html.replace(/^<h1[^>]*>[\s\S]*?<\/h1>\s*/i, '');
  html = rewriteDocLinks(html, sourceFile);
  html = rewriteImages(html, sourceFile);
  html = buildFigures(html);
  return {
    ...doc,
    html,
    searchText: `${doc.title} ${doc.summary} ${stripHtml(html)}`.toLowerCase(),
  };
}

const docs = docDefs.map(renderMarkdown);

const navHtml = groups.map((group, index) => {
  const links = group.docs.map(([id, , title]) => (
    `<a class="nav-link" href="#${id}" data-route="${id}"><span>${escapeHtml(title)}</span></a>`
  )).join('');
  return `<details class="nav-group" data-group="${group.id}"${index === 0 ? ' open' : ''}><summary><span>${escapeHtml(group.label)}</span><span class="chevron" aria-hidden="true">⌄</span></summary><div class="nav-group-links">${links}</div></details>`;
}).join('');

const order = docDefs.filter((doc) => doc.id !== 'home').map((doc) => doc.id);
const docsJson = JSON.stringify(docs).replace(/</g, '\\u003c');
const groupsJson = JSON.stringify(groups.map(({ id, label }) => ({ id, label }))).replace(/</g, '\\u003c');
const orderJson = JSON.stringify(order);

const html = `<!doctype html>
<html lang="zh-CN" data-theme="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="workbar 用户文档本地预览">
  <title>workbar 文档</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f5f5ef;
      --panel: #fbfbf7;
      --panel-solid: #ffffff;
      --text: #11140f;
      --muted: #697064;
      --subtle: #8a9185;
      --border: #dfe2d8;
      --border-strong: #cbd0c3;
      --lime: #caff3f;
      --lime-soft: #efffc1;
      --green: #457a5d;
      --code: #10140f;
      --code-text: #e9eee6;
      --shadow: 0 16px 48px rgba(21, 27, 17, .08);
      --topbar-height: 68px;
      --sidebar-width: 276px;
      --content-width: 820px;
      --font-sans: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      --font-mono: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
    }

    html[data-theme="dark"] {
      color-scheme: dark;
      --bg: #0c100c;
      --panel: #111611;
      --panel-solid: #151b15;
      --text: #f1f4eb;
      --muted: #a8b0a3;
      --subtle: #7f897b;
      --border: #293128;
      --border-strong: #3a4538;
      --lime-soft: #253218;
      --green: #86bd9d;
      --code: #070a07;
      --code-text: #e7eee3;
      --shadow: 0 18px 60px rgba(0, 0, 0, .34);
    }

    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      min-width: 320px;
      background: var(--bg);
      color: var(--text);
      font-family: var(--font-sans);
      font-size: 16px;
      line-height: 1.75;
      text-rendering: optimizeLegibility;
    }
    button, input { font: inherit; }
    button, a { -webkit-tap-highlight-color: transparent; }
    a { color: inherit; }
    :focus-visible { outline: 3px solid rgba(155, 207, 37, .55); outline-offset: 3px; }

    .topbar {
      position: fixed;
      inset: 0 0 auto 0;
      z-index: 80;
      height: var(--topbar-height);
      display: grid;
      grid-template-columns: var(--sidebar-width) minmax(280px, 680px) 1fr;
      align-items: center;
      gap: 28px;
      padding: 0 24px;
      border-bottom: 1px solid var(--border);
      background: color-mix(in srgb, var(--panel) 92%, transparent);
      backdrop-filter: blur(18px);
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
      text-decoration: none;
      font-size: 17px;
      font-weight: 760;
      letter-spacing: -.02em;
    }
    .brand-mark {
      width: 34px;
      height: 34px;
      display: grid;
      place-items: center;
      border: 2px solid currentColor;
      border-radius: 50%;
      background: var(--panel-solid);
      box-shadow: inset 0 0 0 3px var(--panel-solid), inset 0 0 0 5px currentColor;
      font-size: 13px;
      font-weight: 820;
      letter-spacing: -.08em;
    }
    .brand-label small {
      display: block;
      margin-top: -5px;
      color: var(--muted);
      font-size: 11px;
      font-weight: 560;
      letter-spacing: .08em;
      text-transform: uppercase;
    }
    .search-wrap { position: relative; width: 100%; }
    .search-icon {
      position: absolute;
      inset: 50% auto auto 16px;
      transform: translateY(-50%);
      color: var(--muted);
      pointer-events: none;
    }
    .search-input {
      width: 100%;
      height: 42px;
      padding: 0 46px 0 44px;
      border: 1px solid var(--border);
      border-radius: 13px;
      background: var(--panel-solid);
      color: var(--text);
      transition: border-color .18s ease, box-shadow .18s ease;
    }
    .search-input::placeholder { color: var(--subtle); }
    .search-input:focus { border-color: var(--border-strong); box-shadow: 0 0 0 4px rgba(110, 143, 71, .1); outline: 0; }
    .search-shortcut {
      position: absolute;
      inset: 50% 11px auto auto;
      transform: translateY(-50%);
      padding: 2px 7px;
      border: 1px solid var(--border);
      border-radius: 7px;
      color: var(--subtle);
      background: var(--panel);
      font-size: 12px;
      line-height: 1.5;
    }
    .top-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
    .icon-button, .mobile-menu-button {
      width: 42px;
      height: 42px;
      display: inline-grid;
      place-items: center;
      border: 1px solid var(--border);
      border-radius: 13px;
      background: var(--panel-solid);
      color: var(--text);
      cursor: pointer;
    }
    .back-link {
      height: 42px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 0 15px;
      border: 1px solid var(--border);
      border-radius: 13px;
      background: var(--panel-solid);
      text-decoration: none;
      font-weight: 650;
      white-space: nowrap;
    }
    .mobile-menu-button { display: none; }

    .sidebar {
      position: fixed;
      inset: var(--topbar-height) auto 0 0;
      z-index: 70;
      width: var(--sidebar-width);
      overflow-y: auto;
      padding: 24px 18px 36px;
      border-right: 1px solid var(--border);
      background: var(--panel);
    }
    .nav-home, .nav-link {
      display: flex;
      align-items: center;
      min-height: 42px;
      padding: 8px 12px;
      border-radius: 11px;
      color: var(--muted);
      text-decoration: none;
      font-size: 14px;
      font-weight: 600;
      transition: color .16s ease, background .16s ease;
    }
    .nav-home { margin-bottom: 14px; color: var(--text); font-weight: 720; }
    .nav-home::before { content: ''; width: 8px; height: 8px; margin-right: 10px; border-radius: 50%; background: var(--lime); box-shadow: 0 0 0 4px var(--lime-soft); }
    .nav-home:hover, .nav-link:hover { background: var(--lime-soft); color: var(--text); }
    .nav-home.active, .nav-link.active { background: var(--text); color: var(--panel-solid); }
    html[data-theme="dark"] .nav-home.active, html[data-theme="dark"] .nav-link.active { background: var(--lime); color: #11140f; }
    .nav-group { margin: 5px 0; }
    .nav-group summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 38px;
      padding: 5px 12px;
      color: var(--subtle);
      cursor: pointer;
      list-style: none;
      font-size: 12px;
      font-weight: 760;
      letter-spacing: .08em;
      text-transform: uppercase;
      user-select: none;
    }
    .nav-group summary::-webkit-details-marker { display: none; }
    .chevron { transform: rotate(-90deg); transition: transform .16s ease; font-size: 15px; }
    .nav-group[open] .chevron { transform: rotate(0deg); }
    .nav-group-links { padding: 2px 0 8px; }
    .nav-link { padding-left: 20px; }
    .sidebar-foot { margin: 28px 12px 0; padding-top: 18px; border-top: 1px solid var(--border); color: var(--subtle); font-size: 12px; line-height: 1.6; }

    .page {
      min-height: 100vh;
      padding: calc(var(--topbar-height) + 46px) 34px 80px calc(var(--sidebar-width) + 34px);
    }
    .reader-shell {
      width: min(100%, 1280px);
      margin: 0 auto;
      display: grid;
      grid-template-columns: minmax(0, 1fr) 218px;
      gap: 54px;
      align-items: start;
    }
    .main-column { min-width: 0; }
    .article-head { max-width: var(--content-width); margin: 0 auto 42px; }
    .breadcrumb { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; color: var(--muted); font-size: 13px; font-weight: 650; }
    .breadcrumb span:last-child { color: var(--text); }
    .article-head h1 {
      max-width: 17ch;
      margin: 0;
      font-size: clamp(38px, 5vw, 64px);
      line-height: 1.08;
      letter-spacing: -.055em;
      text-wrap: balance;
    }
    .article-summary { max-width: 720px; margin: 20px 0 0; color: var(--muted); font-size: clamp(17px, 2vw, 20px); line-height: 1.75; text-wrap: pretty; }
    .article-body { max-width: var(--content-width); margin: 0 auto; }
    .article-body > :not(.doc-figure):not(table):not(.table-wrap) { max-width: var(--content-width); margin-left: auto; margin-right: auto; }
    .article-body h2 { margin-top: 64px; margin-bottom: 18px; padding-top: 12px; scroll-margin-top: 92px; font-size: clamp(25px, 3vw, 34px); line-height: 1.28; letter-spacing: -.035em; text-wrap: balance; }
    .article-body h3 { margin-top: 38px; margin-bottom: 12px; scroll-margin-top: 92px; font-size: 21px; line-height: 1.4; letter-spacing: -.02em; }
    .article-body h4 { margin: 28px auto 8px; font-size: 17px; }
    .article-body p { margin-top: 0; margin-bottom: 18px; color: var(--muted); }
    .article-body strong { color: var(--text); }
    .article-body a { color: var(--green); font-weight: 620; text-underline-offset: 3px; text-decoration-thickness: 1px; }
    .article-body a:hover { text-decoration-thickness: 2px; }
    .article-body ul, .article-body ol { margin-top: 14px; margin-bottom: 24px; padding-left: 26px; color: var(--muted); }
    .article-body li { margin: 8px 0; padding-left: 4px; }
    .article-body li::marker { color: var(--green); font-weight: 760; }
    .article-body hr { height: 1px; margin-top: 50px; margin-bottom: 42px; border: 0; background: var(--border); }
    .article-body blockquote {
      margin-top: 24px;
      margin-bottom: 26px;
      padding: 18px 22px 18px 24px;
      border: 1px solid color-mix(in srgb, var(--lime) 40%, var(--border));
      border-left: 5px solid var(--lime);
      border-radius: 0 14px 14px 0;
      background: var(--lime-soft);
    }
    .article-body blockquote p { margin: 0; color: var(--text); }
    .article-body code {
      padding: .16em .42em;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--panel-solid);
      color: var(--text);
      font-family: var(--font-mono);
      font-size: .9em;
      overflow-wrap: anywhere;
    }
    .article-body pre {
      position: relative;
      max-width: var(--content-width) !important;
      margin-top: 20px !important;
      margin-bottom: 28px !important;
      padding: 22px 58px 22px 24px;
      overflow: auto;
      border: 1px solid #252c24;
      border-radius: 16px;
      background: var(--code);
      color: var(--code-text);
      box-shadow: 0 10px 30px rgba(0, 0, 0, .12);
    }
    .article-body pre code { padding: 0; border: 0; background: transparent; color: inherit; font-size: 14px; line-height: 1.65; white-space: pre; overflow-wrap: normal; }
    .copy-code {
      position: absolute;
      inset: 12px 12px auto auto;
      min-width: 38px;
      height: 34px;
      padding: 0 10px;
      border: 1px solid rgba(255, 255, 255, .18);
      border-radius: 9px;
      background: rgba(255, 255, 255, .08);
      color: #dfe7dc;
      cursor: pointer;
      font-size: 12px;
    }
    .copy-code:hover { background: rgba(255, 255, 255, .14); }
    .table-wrap { width: 100%; max-width: var(--content-width); margin: 24px auto 34px; overflow-x: auto; border: 1px solid var(--border); border-radius: 15px; background: var(--panel-solid); }
    table { width: 100%; border-collapse: collapse; color: var(--muted); font-size: 14px; }
    th, td { min-width: 130px; padding: 14px 16px; border-bottom: 1px solid var(--border); text-align: left; vertical-align: top; }
    th { color: var(--text); background: var(--panel); font-weight: 720; }
    tr:last-child td { border-bottom: 0; }
    .doc-figure { width: min(100%, var(--content-width)); margin: 30px auto 42px; }
    .doc-figure.is-wide { width: min(100%, var(--content-width)); }
    .doc-figure a { display: block; border-radius: 15px; background: #fff; cursor: zoom-in; }
    .doc-figure img { display: block; width: 100%; height: auto; border: 1px solid var(--border); border-radius: 15px; background: #fff; box-shadow: var(--shadow); }
    .doc-figure figcaption { max-width: 76ch; margin: 12px auto 0; color: var(--muted); font-size: 13px; line-height: 1.6; text-align: center; }

    .article-nav {
      max-width: var(--content-width);
      margin: 70px auto 0;
      padding-top: 28px;
      border-top: 1px solid var(--border);
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }
    .article-nav a { min-height: 92px; padding: 17px 19px; border: 1px solid var(--border); border-radius: 15px; background: var(--panel-solid); text-decoration: none; transition: border-color .16s ease, transform .16s ease; }
    .article-nav a:hover { border-color: var(--border-strong); transform: translateY(-2px); }
    .article-nav a:last-child { text-align: right; }
    .article-nav small { display: block; margin-bottom: 4px; color: var(--subtle); font-size: 12px; }
    .article-nav strong { font-size: 15px; }

    .toc { position: sticky; top: calc(var(--topbar-height) + 28px); max-height: calc(100vh - var(--topbar-height) - 56px); overflow: auto; padding-left: 20px; border-left: 1px solid var(--border); }
    .toc-title { margin: 0 0 12px; color: var(--subtle); font-size: 12px; font-weight: 760; letter-spacing: .08em; text-transform: uppercase; }
    .toc a { display: block; padding: 5px 0; color: var(--muted); text-decoration: none; font-size: 13px; line-height: 1.45; }
    .toc a:hover, .toc a.active { color: var(--text); }
    .toc-empty { color: var(--subtle); font-size: 12px; }

    .home-hero {
      position: relative;
      overflow: hidden;
      max-width: 1080px;
      margin: 0 auto 28px;
      padding: clamp(32px, 6vw, 68px);
      border: 1px solid var(--border);
      border-radius: 30px;
      background: var(--text);
      color: var(--panel-solid);
      box-shadow: var(--shadow);
    }
    html[data-theme="dark"] .home-hero { background: #eef2e8; color: #11140f; }
    .home-hero::before, .home-hero::after { content: ''; position: absolute; border: 1px solid rgba(202, 255, 63, .25); border-radius: 50%; pointer-events: none; }
    .home-hero::before { width: 440px; height: 440px; right: -170px; top: -230px; }
    .home-hero::after { width: 300px; height: 300px; right: -90px; top: -160px; }
    .home-kicker { position: relative; z-index: 1; margin: 0 0 14px; color: var(--lime); font-size: 13px; font-weight: 760; letter-spacing: .12em; text-transform: uppercase; }
    .home-hero h1 { position: relative; z-index: 1; max-width: 11ch; margin: 0; font-size: clamp(46px, 7vw, 82px); line-height: 1.02; letter-spacing: -.065em; text-wrap: balance; }
    .home-hero p { position: relative; z-index: 1; max-width: 610px; margin: 24px 0 0; color: color-mix(in srgb, currentColor 72%, transparent); font-size: 18px; line-height: 1.75; }
    .home-primary { position: relative; z-index: 1; display: inline-flex; align-items: center; gap: 10px; margin-top: 30px; padding: 13px 19px; border-radius: 13px; background: var(--lime); color: #11140f; text-decoration: none; font-weight: 760; }
    .goal-grid { max-width: 1080px; margin: 0 auto; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
    .goal-card { min-height: 180px; padding: 24px; border: 1px solid var(--border); border-radius: 22px; background: var(--panel-solid); text-decoration: none; transition: transform .18s ease, border-color .18s ease; }
    .goal-card:hover { transform: translateY(-3px); border-color: var(--border-strong); }
    .goal-index { color: var(--green); font-family: var(--font-mono); font-size: 12px; font-weight: 760; }
    .goal-card h2 { margin: 22px 0 8px; font-size: 23px; line-height: 1.3; letter-spacing: -.03em; }
    .goal-card p { margin: 0; color: var(--muted); font-size: 14px; line-height: 1.65; }
    .home-help { max-width: 1080px; margin: 16px auto 0; padding: 22px 24px; border: 1px solid var(--border); border-radius: 18px; background: var(--lime-soft); display: flex; align-items: center; justify-content: space-between; gap: 18px; }
    .home-help strong { display: block; }
    .home-help span { color: var(--muted); font-size: 14px; }
    .home-help a { flex: none; font-weight: 720; }

    .search-panel {
      position: fixed;
      z-index: 130;
      top: calc(var(--topbar-height) - 8px);
      left: calc(var(--sidebar-width) + 24px);
      width: min(680px, calc(100vw - var(--sidebar-width) - 280px));
      max-height: min(560px, calc(100vh - 90px));
      overflow: auto;
      padding: 8px;
      border: 1px solid var(--border);
      border-radius: 16px;
      background: var(--panel-solid);
      box-shadow: 0 22px 70px rgba(0, 0, 0, .2);
    }
    .search-panel[hidden] { display: none; }
    .search-result { display: block; padding: 13px 14px; border-radius: 11px; text-decoration: none; }
    .search-result:hover, .search-result:focus { background: var(--lime-soft); outline: 0; }
    .search-result small { display: block; color: var(--green); font-size: 11px; font-weight: 720; }
    .search-result strong { display: block; margin: 2px 0; font-size: 15px; }
    .search-result span { display: block; color: var(--muted); font-size: 12px; line-height: 1.5; }
    .search-empty { padding: 28px 16px; color: var(--muted); text-align: center; }

    .lightbox {
      position: fixed;
      inset: 0;
      z-index: 160;
      display: grid;
      grid-template-rows: auto 1fr;
      padding: 18px;
      background: rgba(5, 7, 5, .93);
      backdrop-filter: blur(8px);
    }
    .lightbox[hidden] { display: none; }
    .lightbox-head { display: flex; justify-content: flex-end; padding-bottom: 12px; }
    .lightbox-close { width: 44px; height: 44px; border: 1px solid rgba(255,255,255,.25); border-radius: 13px; background: rgba(255,255,255,.1); color: #fff; cursor: pointer; font-size: 25px; }
    .lightbox-body { overflow: auto; display: grid; place-items: center; touch-action: pan-x pan-y pinch-zoom; }
    .lightbox img { display: block; max-width: none; width: auto; min-width: min(100%, 760px); height: auto; background: #fff; border-radius: 12px; }

    .mobile-backdrop { display: none; }
    .screen-reader { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

    @media (max-width: 1120px) {
      .reader-shell { grid-template-columns: minmax(0, 1fr); }
      .toc { display: none; }
      .topbar { grid-template-columns: var(--sidebar-width) minmax(260px, 1fr) auto; }
      .back-link span { display: none; }
    }
    @media (max-width: 820px) {
      :root { --topbar-height: 62px; }
      .topbar { grid-template-columns: auto 1fr auto; gap: 10px; padding: 0 12px; }
      .mobile-menu-button { display: inline-grid; }
      .brand-mark { width: 31px; height: 31px; }
      .brand-label { display: none; }
      .search-shortcut { display: none; }
      .search-input { height: 40px; padding-right: 12px; }
      .back-link { display: none; }
      .sidebar { transform: translateX(-105%); transition: transform .22s ease; box-shadow: 18px 0 50px rgba(0,0,0,.15); }
      body.nav-open .sidebar { transform: translateX(0); }
      .mobile-backdrop { position: fixed; inset: var(--topbar-height) 0 0; z-index: 60; background: rgba(0,0,0,.38); }
      body.nav-open .mobile-backdrop { display: block; }
      .page { padding: calc(var(--topbar-height) + 30px) 18px 60px; }
      .article-head { margin-bottom: 30px; }
      .article-head h1 { font-size: clamp(36px, 11vw, 52px); }
      .article-summary { font-size: 17px; }
      .article-body h2 { margin-top: 48px; }
      .goal-grid { grid-template-columns: 1fr; }
      .home-hero { border-radius: 22px; }
      .home-help { align-items: flex-start; flex-direction: column; }
      .search-panel { top: calc(var(--topbar-height) - 4px); left: 12px; right: 12px; width: auto; }
    }
    @media (max-width: 620px) {
      .article-body { font-size: 15px; }
      .article-body pre { margin-left: auto !important; margin-right: auto !important; padding: 18px 50px 18px 18px; border-radius: 13px; }
      .doc-figure { width: 100%; margin-left: auto; margin-right: auto; }
      .doc-figure figcaption { padding: 0; text-align: left; }
      .article-nav { grid-template-columns: 1fr; }
      .article-nav a:last-child { text-align: left; }
      .table-wrap { width: 100%; margin-left: auto; margin-right: auto; }
      .home-hero p { font-size: 16px; }
    }

    @media print {
      .topbar, .sidebar, .toc, .article-nav, .copy-code { display: none !important; }
      .page { padding: 0; }
      .reader-shell { display: block; }
      .doc-figure img, .home-hero { box-shadow: none; }
      .doc-figure, pre, table { break-inside: avoid; }
      body { background: #fff; color: #111; }
    }
  </style>
</head>
<body>
  <header class="topbar">
    <div style="display:flex;align-items:center;gap:8px;min-width:0">
      <button class="mobile-menu-button" id="menuButton" aria-label="打开文档目录" aria-expanded="false">☰</button>
      <a class="brand" href="#home" aria-label="workbar 文档首页">
        <span class="brand-mark" aria-hidden="true">wb</span>
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

  <aside class="sidebar" id="sidebar" aria-label="文档目录">
    <nav>
      <a class="nav-home" href="#home" data-route="home">文档首页</a>
      ${navHtml}
    </nav>
    <div class="sidebar-foot">本地预览版 · 内容以当前 workbar 页面实际显示为准</div>
  </aside>
  <button class="mobile-backdrop" id="mobileBackdrop" aria-label="关闭文档目录"></button>

  <main class="page" id="mainContent" tabindex="-1">
    <div class="reader-shell">
      <div class="main-column" id="articleContainer"></div>
      <aside class="toc" id="toc" aria-label="本文目录"></aside>
    </div>
  </main>

  <div class="search-panel" id="searchPanel" hidden aria-label="搜索结果" aria-live="polite"></div>

  <div class="lightbox" id="lightbox" hidden role="dialog" aria-modal="true" aria-label="查看文档大图">
    <div class="lightbox-head"><button class="lightbox-close" id="lightboxClose" aria-label="关闭大图">×</button></div>
    <div class="lightbox-body"><img id="lightboxImage" alt=""></div>
  </div>

  <script>
    const docs = ${docsJson};
    const docMap = new Map(docs.map((doc) => [doc.id, doc]));
    const groups = ${groupsJson};
    const articleOrder = ${orderJson};
    const articleContainer = document.getElementById('articleContainer');
    const toc = document.getElementById('toc');
    const searchInput = document.getElementById('searchInput');
    const searchPanel = document.getElementById('searchPanel');
    const themeButton = document.getElementById('themeButton');
    const menuButton = document.getElementById('menuButton');
    const mobileBackdrop = document.getElementById('mobileBackdrop');
    const lightbox = document.getElementById('lightbox');
    const lightboxImage = document.getElementById('lightboxImage');
    const lightboxClose = document.getElementById('lightboxClose');
    let lastLightboxTrigger = null;
    let headingObserver = null;
    const lightboxBackground = [document.querySelector('.topbar'), document.getElementById('sidebar'), mobileBackdrop, document.getElementById('mainContent'), searchPanel];
    const mobileBackground = [document.querySelector('.brand'), document.querySelector('.search-wrap'), document.querySelector('.top-actions'), document.getElementById('mainContent')];

    function escapeHtmlClient(value) {
      return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]);
    }

    function slugify(value, index) {
      const base = value.trim().toLowerCase().replace(/<[^>]+>/g, '').replace(/[\\s/]+/g, '-').replace(/[^\\p{L}\\p{N}_-]/gu, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
      return base || 'section-' + (index + 1);
    }

    function homeMarkup() {
      return '<section class="home-hero">' +
        '<p class="home-kicker">一个账号，多种模型</p>' +
        '<h1>让 AI 工具真正开始工作。</h1>' +
        '<p>从第一次连接，到日常使用、费用管理和程序接入，按你的目标找到下一步。不需要先理解复杂的 API 概念。</p>' +
        '<a class="home-primary" href="#quick-start">从快速开始进入 <span aria-hidden="true">→</span></a>' +
      '</section>' +
      '<section class="goal-grid" aria-label="按目标选择文档">' +
        '<a class="goal-card" href="#quick-start"><span class="goal-index">01 / 新手</span><h2>第一次使用 workbar</h2><p>创建 API 密钥，连接 workbar Code，并完成第一次只读任务。</p></a>' +
        '<a class="goal-card" href="#compatible-tools"><span class="goal-index">02 / 工具</span><h2>连接已有 AI 工具</h2><p>判断工具使用的协议和地址字段，填写正确的地址、密钥与模型。</p></a>' +
        '<a class="goal-card" href="#claude-code"><span class="goal-index">03 / Claude Code</span><h2>在 Claude Code 中使用</h2><p>配置 workbar 地址和专用密钥，先完成一次安全的基础验证。</p></a>' +
        '<a class="goal-card" href="#api-overview"><span class="goal-index">04 / 开发者</span><h2>在自己的程序中接入</h2><p>选择 OpenAI、Claude 或 Gemini 兼容格式，并验证最小请求。</p></a>' +
      '</section>' +
      '<section class="home-help"><div><strong>遇到登录、密钥、模型或余额问题？</strong><span>按你看到的页面现象逐项排查，不需要先知道 HTTP 状态码。</span></div><a href="#common-problems">打开常见问题 →</a></section>';
    }

    function wrapTables(root) {
      root.querySelectorAll('table').forEach((table) => {
        if (table.parentElement.classList.contains('table-wrap')) return;
        const wrapper = document.createElement('div');
        wrapper.className = 'table-wrap';
        table.parentNode.insertBefore(wrapper, table);
        wrapper.appendChild(table);
      });
    }

    function addCopyButtons(root) {
      root.querySelectorAll('pre').forEach((pre) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'copy-code';
        button.textContent = '复制';
        button.setAttribute('aria-label', '复制代码');
        button.addEventListener('click', async () => {
          const text = pre.querySelector('code')?.innerText || pre.innerText;
          try {
            await navigator.clipboard.writeText(text);
          } catch (_) {
            const area = document.createElement('textarea');
            area.value = text;
            document.body.appendChild(area);
            area.select();
            document.execCommand('copy');
            area.remove();
          }
          button.textContent = '已复制';
          setTimeout(() => { button.textContent = '复制'; }, 1400);
        });
        pre.appendChild(button);
      });
    }

    function buildToc(root) {
      if (headingObserver) headingObserver.disconnect();
      const headings = [...root.querySelectorAll('h2')];
      if (!headings.length) {
        toc.innerHTML = '<p class="toc-title">本文目录</p><p class="toc-empty">本页无需目录</p>';
        return;
      }
      const seen = new Map();
      headings.forEach((heading, index) => {
        const base = slugify(heading.textContent, index);
        const count = seen.get(base) || 0;
        seen.set(base, count + 1);
        heading.id = count ? base + '-' + (count + 1) : base;
      });
      toc.innerHTML = '<p class="toc-title">本文目录</p>' + headings.map((heading) => '<a href="#' + currentRoute() + '?section=' + encodeURIComponent(heading.id) + '" data-section="' + escapeHtmlClient(heading.id) + '">' + escapeHtmlClient(heading.textContent) + '</a>').join('');
      const tocLinks = new Map([...toc.querySelectorAll('[data-section]')].map((link) => [link.dataset.section, link]));
      headingObserver = new IntersectionObserver((entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (!visible) return;
        tocLinks.forEach((link) => link.classList.toggle('active', link.dataset.section === visible.target.id));
      }, { rootMargin: '-90px 0px -70% 0px', threshold: 0 });
      headings.forEach((heading) => headingObserver.observe(heading));
    }

    function currentRoute() {
      const raw = location.hash.slice(1).split('?')[0];
      return docMap.has(raw) ? raw : 'home';
    }

    function requestedSection() {
      const query = location.hash.slice(1).split('?')[1] || '';
      return new URLSearchParams(query).get('section');
    }

    function articleNav(route) {
      const index = articleOrder.indexOf(route);
      if (index < 0) return '';
      const previous = index > 0 ? docMap.get(articleOrder[index - 1]) : null;
      const next = index < articleOrder.length - 1 ? docMap.get(articleOrder[index + 1]) : null;
      const item = (doc, direction) => doc ? '<a href="#' + doc.id + '"><small>' + direction + '</small><strong>' + escapeHtmlClient(doc.title) + '</strong></a>' : '<span></span>';
      return '<nav class="article-nav" aria-label="上一篇和下一篇">' + item(previous, '上一篇') + item(next, '下一篇') + '</nav>';
    }

    function updateNav(doc) {
      document.querySelectorAll('[data-route]').forEach((link) => link.classList.toggle('active', link.dataset.route === doc.id));
      document.querySelectorAll('.nav-group').forEach((details) => {
        details.open = doc.groupId === 'home' ? details.dataset.group === 'start' : details.dataset.group === doc.groupId;
      });
    }

    function renderRoute({ preserveScroll = false } = {}) {
      const route = currentRoute();
      const doc = docMap.get(route) || docMap.get('home');
      document.title = doc.id === 'home' ? 'workbar 文档' : doc.title + ' · workbar 文档';
      if (doc.id === 'home') {
        articleContainer.innerHTML = homeMarkup();
        toc.innerHTML = '<p class="toc-title">文档首页</p><p class="toc-empty">按你的目标选择入口</p>';
      } else {
        articleContainer.innerHTML = '<header class="article-head"><div class="breadcrumb"><span>workbar 文档</span><span aria-hidden="true">/</span><span>' + escapeHtmlClient(doc.groupLabel) + '</span></div><h1>' + escapeHtmlClient(doc.title) + '</h1><p class="article-summary">' + escapeHtmlClient(doc.summary) + '</p></header><article class="article-body" data-route="' + doc.id + '">' + doc.html + '</article>' + articleNav(doc.id);
        const body = articleContainer.querySelector('.article-body');
        wrapTables(body);
        addCopyButtons(body);
        buildToc(body);
      }
      updateNav(doc);
      closeMobileNav();
      const section = requestedSection();
      if (section && doc.id !== 'home') {
        requestAnimationFrame(() => document.getElementById(section)?.scrollIntoView({ behavior: 'smooth' }));
      } else if (!preserveScroll) {
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
    }

    function search(query) {
      const terms = query.toLowerCase().trim().split(/\\s+/).filter(Boolean);
      if (!terms.length) return [];
      return docs.map((doc) => {
        let score = 0;
        for (const term of terms) {
          if (doc.title.toLowerCase().includes(term)) score += 8;
          if (doc.summary.toLowerCase().includes(term)) score += 4;
          if (doc.searchText.includes(term)) score += 1;
          else return null;
        }
        return { doc, score };
      }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 8);
    }

    function updateSearch() {
      const query = searchInput.value.trim();
      if (!query) {
        searchPanel.hidden = true;
        searchPanel.innerHTML = '';
        return;
      }
      const results = search(query);
      searchPanel.hidden = false;
      searchPanel.innerHTML = results.length ? results.map(({ doc }) => '<a class="search-result" href="#' + doc.id + '"><small>' + escapeHtmlClient(doc.groupLabel) + '</small><strong>' + escapeHtmlClient(doc.title) + '</strong><span>' + escapeHtmlClient(doc.summary) + '</span></a>').join('') : '<div class="search-empty">没有找到相关内容，试试“密钥”“模型”或“余额”。</div>';
    }

    function closeSearch() {
      searchPanel.hidden = true;
      searchInput.blur();
    }

    function setInert(elements, inert) {
      elements.filter(Boolean).forEach((element) => {
        element.inert = inert;
        if (inert) element.setAttribute('aria-hidden', 'true');
        else element.removeAttribute('aria-hidden');
      });
    }

    function closeMobileNav({ returnFocus = false } = {}) {
      document.body.classList.remove('nav-open');
      menuButton.setAttribute('aria-expanded', 'false');
      setInert(mobileBackground, false);
      if (returnFocus && matchMedia('(max-width: 820px)').matches) menuButton.focus();
    }

    function setTheme(theme) {
      document.documentElement.dataset.theme = theme;
      localStorage.setItem('workbar-docs-theme', theme);
      themeButton.textContent = theme === 'dark' ? '☀' : '◐';
      themeButton.title = theme === 'dark' ? '切换到浅色主题' : '切换到深色主题';
    }

    searchInput.addEventListener('input', updateSearch);
    searchInput.addEventListener('focus', updateSearch);
    searchPanel.addEventListener('click', (event) => { if (event.target.closest('a')) { searchInput.value = ''; closeSearch(); } });
    document.addEventListener('click', (event) => { if (!event.target.closest('.search-wrap') && !event.target.closest('.search-panel')) closeSearch(); });
    document.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInput.focus();
      }
      if (event.key === 'Escape') {
        if (!lightbox.hidden) closeLightbox();
        else { closeSearch(); closeMobileNav({ returnFocus: true }); }
      }
      if (event.key === 'Tab' && !lightbox.hidden) {
        event.preventDefault();
        lightboxClose.focus();
      } else if (event.key === 'Tab' && document.body.classList.contains('nav-open')) {
        const focusable = [menuButton, ...sidebar.querySelectorAll('a, summary')].filter((element) => element.offsetParent !== null && !element.inert);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });

    themeButton.addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
    menuButton.addEventListener('click', () => {
      const open = !document.body.classList.contains('nav-open');
      document.body.classList.toggle('nav-open', open);
      menuButton.setAttribute('aria-expanded', String(open));
      setInert(mobileBackground, open);
      if (open) requestAnimationFrame(() => (sidebar.querySelector('[data-route].active') || sidebar.querySelector('a')).focus());
    });
    mobileBackdrop.addEventListener('click', () => closeMobileNav({ returnFocus: true }));

    articleContainer.addEventListener('click', (event) => {
      const trigger = event.target.closest('[data-lightbox]');
      if (!trigger) return;
      event.preventDefault();
      lastLightboxTrigger = trigger;
      const image = trigger.querySelector('img');
      lightboxImage.src = trigger.getAttribute('href');
      lightboxImage.alt = image?.alt || '文档配图';
      lightbox.hidden = false;
      document.body.style.overflow = 'hidden';
      setInert(lightboxBackground, true);
      lightboxClose.focus();
    });

    function closeLightbox() {
      lightbox.hidden = true;
      lightboxImage.removeAttribute('src');
      document.body.style.overflow = '';
      setInert(lightboxBackground, false);
      lastLightboxTrigger?.focus();
    }
    lightboxClose.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (event) => { if (event.target === lightbox || event.target.classList.contains('lightbox-body')) closeLightbox(); });

    window.addEventListener('hashchange', () => renderRoute());
    const savedTheme = localStorage.getItem('workbar-docs-theme');
    setTheme(savedTheme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
    if (!location.hash) history.replaceState(null, '', '#home');
    renderRoute();
  </script>
</body>
</html>`;

fs.mkdirSync(__dirname, { recursive: true });
fs.writeFileSync(outputFile, html, 'utf8');

console.log(`Built ${docs.length} documents -> ${outputFile}`);

// The production builder reuses the same validated Markdown rendering and
// navigation metadata so the local preview and deployed site cannot drift.
module.exports = {
  docs,
  docDefs,
  groups,
  escapeHtml,
  rootDir,
};
