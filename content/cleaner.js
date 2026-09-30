/**
 * 阿苏工具箱 — 搜索结果净化（百度 / 搜狗）
 * 去广告、去跟踪重定向； MutationObserver 应对动态加载的结果。
 */
'use strict';

(() => {
  const host = location.hostname;

  const ENGINES = {
    'www.baidu.com': 'baidu',
    'm.baidu.com': 'baidu',
    'www.sogou.com': 'sogou',
    'sogou.com': 'sogou',
  };
  const engine = ENGINES[host];
  if (!engine) return;

  chrome.storage.sync.get('cleaner').then(({ cleaner }) => {
    const conf = cleaner || { baidu: true, sogou: true, deredirect: true };
    if (engine === 'baidu' && conf.baidu === false) return;
    if (engine === 'sogou' && conf.sogou === false) return;

    const style = document.createElement('style');
    style.id = 'asu-cleaner-style';
    style.textContent = engine === 'baidu'
      ? `
        /* 百度：广告与推广容器 */
        #content_left > div[cmatchid],
        #content_left .ec_ad_results,
        #content_left .ec_tuiguang_ppzq,
        #content_left > div[data-tuiguang],
        [data-tuiguang],
        .page-ad,
        #content_right [cmatchid] { display: none !important; }`
      : `
        /* 搜狗：广告与推广容器 */
        .vrwrap .rb .ads,
        .results .vrwrap[data-ad],
        .struct201102[ad],
        .promote,
        .ad-tag-.sponsored,
        #pagebar ~ .top-ad { display: none !important; }`;
    (document.head || document.documentElement).appendChild(style);

    /* ---- 文本徽标兜底：容器内含"广告/商业推广"角标则整块隐藏 ---- */
    const BADGE_TEXTS = new Set(['广告', '商业推广', '品牌广告', 'AI 智能回答', '极速版专享']);
    const isAdBadge = node => {
      const t = (node.textContent || '').trim();
      return t && t.length <= 6 && BADGE_TEXTS.has(t);
    };
    const hideAdContainer = badge => {
      let el = badge;
      for (let i = 0; i < 6 && el; i++) {
        el = el.parentElement;
        if (!el) break;
        // 停在结果级容器：百度 #content_left 直接子级 / 搜狗 .vrwrap 或 .results 直接子级
        const stop = engine === 'baidu'
          ? el.parentElement && el.parentElement.id === 'content_left'
          : el.classList && (el.classList.contains('vrwrap') || el.parentElement?.classList.contains('results'));
        if (stop) { el.style.display = 'none'; return; }
      }
      badge.closest('div')?.style.setProperty('display', 'none');
    };

    const sweep = root => {
      root.querySelectorAll?.('span,div').forEach(node => {
        if (isAdBadge(node) && node.offsetParent !== null) hideAdContainer(node);
      });
    };

    /* ---- 去跟踪重定向：把引擎跳转链接替换为真实地址 ---- */
    const REDIRECT_RE = engine === 'baidu'
      ? /^(https?:\/\/)?(www\.)?baidu\.com\/link\?url=/
      : /^(https?:\/\/)?(www\.)?sogou\.com\/link\?url=/;

    const resolveCache = new Map();
    const dereirect = async a => {
      const href = a.href || '';
      if (!REDIRECT_RE.test(href) || a.dataset.asuReal) return;
      a.dataset.asuReal = '1';
      let real = resolveCache.get(href);
      if (real === undefined) {
        try {
          const res = await fetch(href, { redirect: 'follow', credentials: 'omit' });
          real = res.url && !REDIRECT_RE.test(res.url) ? res.url : '';
        } catch { real = ''; }
        resolveCache.set(href, real);
      }
      if (real) { a.href = real; a.removeAttribute('onclick'); }
    };

    const scan = root => {
      sweep(root);
      if (conf.deredirect !== false) {
        root.querySelectorAll?.(`a[href*="/link?url="]`).forEach(a => dereirect(a));
      }
    };

    // 阻断搜索引擎的 mousedown 跳转跟踪（百度/搜狗都靠它改写链接）
    document.addEventListener('mousedown', e => {
      if (e.isTrusted) e.stopPropagation();
    }, true);

    scan(document);
    new MutationObserver(muts => {
      for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1) scan(n);
    }).observe(document.body || document.documentElement, { childList: true, subtree: true });
  });
})();
