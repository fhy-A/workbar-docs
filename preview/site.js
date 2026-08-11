(() => {
  'use strict';

  const root = document.documentElement;
  const body = document.body;
  const searchInput = document.getElementById('searchInput');
  const searchPanel = document.getElementById('searchPanel');
  const themeButton = document.getElementById('themeButton');
  const menuButton = document.getElementById('menuButton');
  const sidebar = document.getElementById('sidebar');
  const mobileBackdrop = document.getElementById('mobileBackdrop');
  const mainContent = document.getElementById('mainContent');
  const lightbox = document.getElementById('lightbox');
  const lightboxImage = document.getElementById('lightboxImage');
  const lightboxClose = document.getElementById('lightboxClose');
  const topbar = document.querySelector('.topbar');
  let searchDocumentsPromise;
  let lastLightboxTrigger = null;

  const mobileBackground = [
    document.querySelector('.brand'),
    document.querySelector('.search-wrap'),
    document.querySelector('.top-actions'),
    mainContent,
  ];
  const lightboxBackground = [topbar, sidebar, mobileBackdrop, mainContent, searchPanel];

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    })[character]);
  }

  function setInert(elements, inert) {
    elements.filter(Boolean).forEach((element) => {
      element.inert = inert;
      if (inert) element.setAttribute('aria-hidden', 'true');
      else element.removeAttribute('aria-hidden');
    });
  }

  function setTheme(theme) {
    root.dataset.theme = theme;
    localStorage.setItem('workbar-docs-theme', theme);
    if (!themeButton) return;
    themeButton.textContent = theme === 'dark' ? '☀' : '◐';
    themeButton.title = theme === 'dark' ? '切换到浅色主题' : '切换到深色主题';
  }

  function closeSearch() {
    if (!searchPanel || !searchInput) return;
    searchPanel.hidden = true;
    searchInput.blur();
  }

  function closeMobileNav({ returnFocus = false } = {}) {
    body.classList.remove('nav-open');
    menuButton?.setAttribute('aria-expanded', 'false');
    setInert(mobileBackground, false);
    if (returnFocus && matchMedia('(max-width: 820px)').matches) menuButton?.focus();
  }

  function closeLightbox() {
    if (!lightbox || lightbox.hidden) return;
    lightbox.hidden = true;
    lightboxImage?.removeAttribute('src');
    body.style.overflow = '';
    setInert(lightboxBackground, false);
    lastLightboxTrigger?.focus();
  }

  function addCopyButtons() {
    document.querySelectorAll('.article-body pre').forEach((pre) => {
      if (pre.querySelector('.copy-code')) return;
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
          area.style.position = 'fixed';
          area.style.opacity = '0';
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

  function observeTableOfContents() {
    const tocLinks = new Map(
      [...document.querySelectorAll('.toc [data-section]')]
        .map((link) => [link.dataset.section, link]),
    );
    if (!tocLinks.size || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((first, second) => first.boundingClientRect.top - second.boundingClientRect.top)[0];
      if (!visible) return;
      tocLinks.forEach((link) => {
        link.classList.toggle('active', link.dataset.section === visible.target.id);
      });
    }, { rootMargin: '-90px 0px -70% 0px', threshold: 0 });
    tocLinks.forEach((_, section) => {
      const heading = document.getElementById(section);
      if (heading) observer.observe(heading);
    });
  }

  async function loadSearchDocuments() {
    if (!searchDocumentsPromise) {
      const endpoint = body.dataset.searchIndex;
      searchDocumentsPromise = fetch(endpoint, {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      }).then((response) => {
        if (!response.ok) throw new Error(`Search index returned ${response.status}`);
        return response.json();
      });
    }
    return searchDocumentsPromise;
  }

  function rankSearch(documents, query) {
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return documents.map((doc) => {
      let score = 0;
      for (const term of terms) {
        if (doc.title.toLowerCase().includes(term)) score += 8;
        if (doc.summary.toLowerCase().includes(term)) score += 4;
        if (doc.searchText.includes(term)) score += 1;
        else return null;
      }
      return { doc, score };
    }).filter(Boolean).sort((first, second) => second.score - first.score).slice(0, 8);
  }

  async function updateSearch() {
    if (!searchPanel || !searchInput) return;
    const query = searchInput.value.trim();
    if (!query) {
      searchPanel.hidden = true;
      searchPanel.innerHTML = '';
      return;
    }
    searchPanel.hidden = false;
    searchPanel.innerHTML = '<div class="search-empty">正在搜索…</div>';
    try {
      const results = rankSearch(await loadSearchDocuments(), query);
      if (searchInput.value.trim() !== query) return;
      searchPanel.innerHTML = results.length
        ? results.map(({ doc }) => (
          `<a class="search-result" href="${escapeHtml(doc.url)}">`
          + `<small>${escapeHtml(doc.groupLabel)}</small>`
          + `<strong>${escapeHtml(doc.title)}</strong>`
          + `<span>${escapeHtml(doc.summary)}</span></a>`
        )).join('')
        : '<div class="search-empty">没有找到相关内容，试试“密钥”“模型”或“余额”。</div>';
    } catch (_) {
      searchPanel.innerHTML = '<div class="search-empty">搜索暂时不可用，请使用左侧目录浏览文档。</div>';
    }
  }

  const savedTheme = localStorage.getItem('workbar-docs-theme');
  setTheme(savedTheme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  addCopyButtons();
  observeTableOfContents();

  themeButton?.addEventListener('click', () => {
    setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
  });

  menuButton?.addEventListener('click', () => {
    const open = !body.classList.contains('nav-open');
    body.classList.toggle('nav-open', open);
    menuButton.setAttribute('aria-expanded', String(open));
    setInert(mobileBackground, open);
    if (open) {
      requestAnimationFrame(() => {
        (sidebar?.querySelector('[aria-current="page"]') || sidebar?.querySelector('a'))?.focus();
      });
    }
  });

  mobileBackdrop?.addEventListener('click', () => closeMobileNav({ returnFocus: true }));
  sidebar?.addEventListener('click', (event) => {
    if (event.target.closest('a') && matchMedia('(max-width: 820px)').matches) closeMobileNav();
  });

  searchInput?.addEventListener('input', updateSearch);
  searchInput?.addEventListener('focus', updateSearch);
  searchPanel?.addEventListener('click', (event) => {
    if (event.target.closest('a')) {
      searchInput.value = '';
      closeSearch();
    }
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.search-wrap') && !event.target.closest('.search-panel')) closeSearch();
  });

  mainContent?.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-lightbox]');
    if (!trigger || !lightbox || !lightboxImage) return;
    event.preventDefault();
    lastLightboxTrigger = trigger;
    const image = trigger.querySelector('img');
    lightboxImage.src = trigger.getAttribute('href');
    lightboxImage.alt = image?.alt || '文档配图';
    lightbox.hidden = false;
    body.style.overflow = 'hidden';
    setInert(lightboxBackground, true);
    lightboxClose?.focus();
  });

  lightboxClose?.addEventListener('click', closeLightbox);
  lightbox?.addEventListener('click', (event) => {
    if (event.target === lightbox || event.target.classList.contains('lightbox-body')) closeLightbox();
  });

  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      searchInput?.focus();
    }
    if (event.key === 'Escape') {
      if (lightbox && !lightbox.hidden) closeLightbox();
      else {
        closeSearch();
        closeMobileNav({ returnFocus: true });
      }
    }
    if (event.key === 'Tab' && lightbox && !lightbox.hidden) {
      event.preventDefault();
      lightboxClose?.focus();
    } else if (event.key === 'Tab' && body.classList.contains('nav-open')) {
      const focusable = [menuButton, ...sidebar.querySelectorAll('a, summary')]
        .filter((element) => element && element.offsetParent !== null && !element.inert);
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
})();
