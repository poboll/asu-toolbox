/* JZX Lite 百宝箱 — MV3 service worker
 * 右键菜单 + 动作分发 + Aria2/Motrix RPC + 代理管理 + offscreen 二维码识别
 */

const MENUS = [
  { id: 'qr-selection',   contexts: ['selection'],                type: 'qr',       title: '生成选区二维码' },
  { id: 'qr-link-page',   contexts: ['link', 'page', 'audio', 'video'], type: 'qr',  title: '生成链接/页面二维码' },
  { id: 'qr-scan',        contexts: ['image'],                    type: 'qr_scan',  title: '识别图片二维码' },
  { id: 'qr-jump',        contexts: ['image'],                    type: 'qr_jump',  title: '识别二维码并跳转' },
  { id: 'img-baidu',      contexts: ['image'],                    type: 'baidu_image', title: '百度识图（相似图片）' },
  { id: 'img-google',     contexts: ['image'],                    type: 'google_image', title: '谷歌识图（Lens）' },
  { id: 'pan-search',     contexts: ['selection'],                type: 'pan',      title: '网盘聚合搜索' },
  { id: 'download',       contexts: ['link', 'audio', 'video'],   type: 'download', title: '使用浏览器下载' },
  { id: 'aria-down',      contexts: ['link', 'audio', 'video'],   type: 'aria',     title: '推送到 Aria2 下载' },
  { id: 'motrix-down',    contexts: ['link', 'audio', 'video'],   type: 'motrix',   title: '推送到 Motrix 下载' },
  { id: 'show-password',  contexts: ['page'],                     type: 'password', title: '显示/隐藏明文密码' },
  { id: 'cookie-tool',    contexts: ['page'],                     type: 'cookie',   title: 'Cookie 工具（本站）' },
  { id: 'open-options',   contexts: ['page'],                     type: 'options',  title: 'JZX Lite 设置' },
];

const DEFAULTS = {
  menus: Object.fromEntries(MENUS.map(m => [m.id, { on: true, title: m.title }])),
  aria: { server: 'http://localhost:6800/jsonrpc', token: '' },
  motrix: { server: 'http://localhost:16800/jsonrpc', token: '' },
  pan: { template: 'https://www.dalipan.com/search?key={q}' },
  proxy: {
    mode: 'off', // off | fixed | pac_url | rules
    fixed: { scheme: 'http', host: '127.0.0.1', port: 7890 },
    pacUrl: '',
    rules: [], // [{domain, host, port, scheme}]
    bypassList: ['localhost', '127.0.0.1', '<local>']
  },
  scripts: [] // [{id, name, code, on}]
};

async function cfg() {
  const got = await chrome.storage.sync.get(null);
  const out = structuredClone(DEFAULTS);
  for (const k of Object.keys(out)) if (got[k] !== undefined) out[k] = got[k];
  // 深合并一层，避免旧配置缺字段
  for (const k of ['aria', 'motrix', 'pan', 'proxy']) Object.assign(out[k], got[k] || {});
  return out;
}

/* ---------------- 右键菜单 ---------------- */

let rebuildChain = Promise.resolve();
function rebuildMenus() {
  rebuildChain = rebuildChain.then(doRebuild).catch(() => {});
  return rebuildChain;
}

async function doRebuild() {
  await chrome.contextMenus.removeAll();
  const c = await cfg();
  for (const m of MENUS) {
    const st = c.menus[m.id] || { on: true, title: m.title };
    if (!st.on) continue;
    await createMenu({
      id: m.id,
      contexts: m.contexts,
      title: st.title || m.title
    });
  }
  for (const s of (c.scripts || [])) {
    if (!s.on || !s.name) continue;
    await createMenu({
      id: 'script-' + s.id,
      contexts: ['page', 'frame'],
      title: '▶ ' + s.name
    });
  }
}

function createMenu(props) {
  return new Promise(resolve => {
    chrome.contextMenus.create(props, () => { void chrome.runtime.lastError; resolve(); });
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  const cur = await chrome.storage.sync.get(null);
  if (cur.menus === undefined) await chrome.storage.sync.set(DEFAULTS);
  await rebuildMenus();
});
chrome.runtime.onStartup.addListener(rebuildMenus);
chrome.storage.onChanged.addListener((_, area) => { if (area === 'sync') rebuildMenus(); });
rebuildMenus(); // SW 每次唤醒都自愈菜单状态

/* ---------------- 通知 ---------------- */

function notify(title, message) {
  try {
    chrome.notifications.create({
      type: 'basic', iconUrl: 'icons/icon_128.png', title, message
    });
  } catch (e) { /* notifications 不可用时静默 */ }
}

/* ---------------- Aria2 / Motrix JSON-RPC ---------------- */

async function ariaSend(server, token, url, referer, cookieHeader) {
  const options = {};
  if (referer) options.referer = referer;
  if (cookieHeader) options.header = ['Cookie: ' + cookieHeader];
  const body = {
    jsonrpc: '2.0', id: 'jzx-' + Date.now(), method: 'aria2.addUri',
    params: token ? [`token:${token}`, [url], options] : [[url], options]
  };
  const res = await fetch(server, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'RPC 错误');
  return data.result;
}

async function rpcVersion(server, token) {
  const body = { jsonrpc: '2.0', id: 'jzx-v', method: 'aria2.getVersion', params: token ? [`token:${token}`] : [] };
  const res = await fetch(server, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.result.version;
}

/* ---------------- 二维码识别（offscreen + jsQR） ---------------- */

async function ensureOffscreen() {
  let has = false;
  try {
    if (typeof chrome.offscreen.hasDocument === 'function') has = await chrome.offscreen.hasDocument();
    else if (typeof chrome.runtime.getContexts === 'function') {
      const ctxs = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
      has = !!(ctxs && ctxs.length);
    }
  } catch { has = false; }
  if (has) return;
  try { await chrome.offscreen.createDocument({ url: 'offscreen.html', reasons: ['DOM_PARSER'], justification: '二维码图片解码' }); }
  catch (e) { if (!String(e).includes('single offscreen document')) throw e; }
}

async function decodeImage(dataUrl) {
  await ensureOffscreen();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('识别超时')), 15000);
    chrome.runtime.onMessage.addListener(function listener(msg) {
      if (msg && msg.jzxDecode !== undefined) {
        chrome.runtime.onMessage.removeListener(listener);
        clearTimeout(timer);
        msg.jzxDecode ? resolve(msg.text) : reject(new Error(msg.error || '未识别到二维码'));
      }
    });
    chrome.runtime.sendMessage({ jzxDecodeImage: dataUrl }).catch(() => {});
  });
}

async function fetchAsDataUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('图片下载失败 HTTP ' + res.status);
  const blob = await res.blob();
  if (blob.size > 15 * 1024 * 1024) throw new Error('图片超过 15MB');
  const buf = await blob.arrayBuffer();
  let bin = '';
  const arr = new Uint8Array(buf);
  for (let i = 0; i < arr.length; i += 0x8000) bin += String.fromCharCode.apply(null, arr.subarray(i, i + 0x8000));
  const type = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/png';
  return `data:${type};base64,` + btoa(bin);
}

/* ---------------- 点击分发 ---------------- */

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const c = await cfg();
  const mid = info.menuItemId;
  const src = info.srcUrl || info.linkUrl || info.pageUrl || '';
  const url = info.linkUrl || info.srcUrl || info.pageUrl || '';
  try {
    if (mid === 'qr-selection' || mid === 'qr-link-page') {
      const text = mid === 'qr-selection' ? (info.selectionText || '') : url;
      chrome.tabs.create({ url: 'tools/qr.html?text=' + encodeURIComponent(text) });
    } else if (mid === 'qr-scan' || mid === 'qr-jump') {
      if (!info.srcUrl) { notify('JZX Lite', '未取到图片地址'); return; }
      notify('JZX Lite', '正在下载并识别图片…');
      const dataUrl = await fetchAsDataUrl(info.srcUrl);
      const text = await decodeImage(dataUrl);
      if (mid === 'qr-scan') {
        try { await navigator.clipboard.writeText(text); notify('识别成功，已复制', text.slice(0, 180)); }
        catch { notify('识别成功', text.slice(0, 180)); }
      } else {
        if (/^https?:\/\//i.test(text)) chrome.tabs.create({ url: text });
        else { notify('内容不是链接', text.slice(0, 120)); }
      }
    } else if (mid === 'img-baidu') {
      if (!info.srcUrl) return;
      chrome.tabs.create({ url: 'https://graph.baidu.com/details?isfromtusoupc=1&tn=pc&image_url=' + encodeURIComponent(info.srcUrl) });
    } else if (mid === 'img-google') {
      if (!info.srcUrl) return;
      chrome.tabs.create({ url: 'https://lens.google.com/uploadbyurl?url=' + encodeURIComponent(info.srcUrl) });
    } else if (mid === 'pan-search') {
      const q = (info.selectionText || '').trim();
      if (!q) { notify('JZX Lite', '请先选中要搜索的文字'); return; }
      chrome.tabs.create({ url: c.pan.template.replace('{q}', encodeURIComponent(q)) });
    } else if (mid === 'download') {
      if (!url) return;
      chrome.downloads.download({ url });
      notify('JZX Lite', '已加入浏览器下载');
    } else if (mid === 'aria-down' || mid === 'motrix-down') {
      const conf = mid === 'aria-down' ? c.aria : c.motrix;
      const cookieHeader = await tabCookieHeader(tab);
      try {
        await ariaSend(conf.server, conf.token, url, tab?.url || '', cookieHeader);
        notify(mid === 'aria-down' ? '已推送到 Aria2' : '已推送到 Motrix', url.slice(0, 120));
      } catch (e) {
        notify('推送失败', (e.message || '') + ' — 请确认服务已启动并在设置里填对地址/密钥');
      }
    } else if (mid === 'show-password') {
      const [r] = await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: false },
        func: () => {
          const flagged = [...document.querySelectorAll('input[data-jzx-pw="1"]')];
          if (flagged.length) {
            flagged.forEach(el => { el.type = 'password'; el.removeAttribute('data-jzx-pw'); });
            return 'hidden';
          }
          const pws = [...document.querySelectorAll('input[type=password]')];
          pws.forEach(el => { el.type = 'text'; el.dataset.jzxPw = '1'; });
          return 'shown:' + pws.length;
        }
      });
      const res = r?.result;
      if (res === 'hidden') notify('JZX Lite', '密码框已还原为圆点');
      else if (res && res.startsWith('shown')) notify('JZX Lite', '已显示 ' + res.split(':')[1] + ' 个密码框（再点一次还原）');
      else notify('JZX Lite', '本页没有找到密码框');
    } else if (mid === 'cookie-tool') {
      chrome.tabs.create({ url: 'tools/cookie.html' });
    } else if (mid === 'open-options') {
      chrome.runtime.openOptionsPage();
    } else if (String(mid).startsWith('script-')) {
      const sid = String(mid).slice(7);
      const s = (c.scripts || []).find(x => String(x.id) === sid);
      if (!s || !tab?.id) return;
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: false },
        world: 'MAIN',
        func: (code) => { (0, eval)(code); },
        args: [s.code]
      });
      notify('自定义脚本已执行', s.name);
    }
  } catch (e) {
    notify('JZX Lite 出错了', String(e.message || e).slice(0, 160));
  }
});

async function tabCookieHeader(tab) {
  try {
    if (!tab?.url) return '';
    const u = new URL(tab.url);
    const cookies = await chrome.cookies.getAll({ domain: u.hostname });
    return cookies.map(x => `${x.name}=${x.value}`).join('; ');
  } catch { return ''; }
}

/* ---------------- 代理管理 ---------------- */

function buildPacFromRules(rules, bypass) {
  const entries = (rules || []).map(r => ({
    domain: (r.domain || '').replace(/^\*\./, '').toLowerCase(),
    wildcard: (r.domain || '').startsWith('*.'),
    host: r.host, port: Number(r.port) || 80, scheme: (r.scheme || 'HTTP').toUpperCase()
  }));
  const bypassArr = JSON.stringify(bypass || []);
  return `
function FindProxyForURL(url, host) {
  var bypass = ${bypassArr};
  for (var i = 0; i < bypass.length; i++) {
    if (host === bypass[i] || (bypass[i] === '<local>' && host.indexOf('.') === -1)) return 'DIRECT';
  }
  var rules = ${JSON.stringify(entries)};
  for (var j = 0; j < rules.length; j++) {
    var r = rules[j];
    var hit = r.wildcard ? (host === r.domain || host.endsWith('.' + r.domain)) : (host === r.domain || host.endsWith('.' + r.domain));
    if (hit) return r.scheme + ' ' + r.host + ':' + r.port + '; DIRECT';
  }
  return 'DIRECT';
}`;
}

async function applyProxy() {
  const c = await cfg();
  const p = c.proxy;
  if (p.mode === 'off') { await chrome.proxy.settings.clear({ scope: 'regular' }); return 'off'; }
  if (p.mode === 'fixed') {
    await chrome.proxy.settings.set({
      scope: 'regular',
      value: { mode: 'fixed_servers', rules: { singleProxy: { scheme: p.fixed.scheme, host: p.fixed.host, port: Number(p.fixed.port) }, bypassList: p.bypassList } }
    });
    return 'fixed';
  }
  if (p.mode === 'pac_url') {
    const res = await fetch(p.pacUrl);
    const text = await res.text();
    await chrome.proxy.settings.set({ scope: 'regular', value: { mode: 'pac_script', value: { data: text } } });
    return 'pac_url';
  }
  if (p.mode === 'rules') {
    await chrome.proxy.settings.set({ scope: 'regular', value: { mode: 'pac_script', value: { data: buildPacFromRules(p.rules, p.bypassList) } } });
    return 'rules';
  }
  return 'off';
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg?.jzxApplyProxy) { try { sendResponse({ ok: true, mode: await applyProxy() }); } catch (e) { sendResponse({ ok: false, error: String(e.message || e) }); } }
    else if (msg?.jzxTestRpc) { try { sendResponse({ ok: true, version: await rpcVersion(msg.server, msg.token) }); } catch (e) { sendResponse({ ok: false, error: String(e.message || e) }); } }
    else if (msg?.jzxGetCurrentIp) {
      try { const r = await fetch('https://api.ipify.org?format=json'); const j = await r.json(); sendResponse({ ok: true, ip: j.ip }); }
      catch (e) { sendResponse({ ok: false, error: String(e.message || e) }); }
    }
  })();
  return true; // async
});
