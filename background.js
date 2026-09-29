/**
 * 阿苏工具箱 — Manifest V3 Service Worker（v2.0.0 重构版）
 *
 * 模块划分：
 *   CONFIG      默认配置与存储读取
 *   MENUS       右键菜单定义与构建
 *   NOTIFY      通知
 *   RPC         Aria2 / Motrix JSON-RPC
 *   QR          二维码识别（offscreen 文档 + jsQR）
 *   HANDLERS    菜单点击分发
 *   PROXY       代理管理（固定 / PAC 订阅 / 域名分流）
 *   MESSAGING   与 popup / options / offscreen 的消息总线
 */
'use strict';

/* ============================== CONFIG ============================== */

const BRAND = '阿苏工具箱';

const MENU_DEFS = [
  { id: 'qr-selection',  contexts: ['selection'],                    type: 'qr',       title: '生成选区二维码' },
  { id: 'qr-link-page',  contexts: ['link', 'page', 'audio', 'video'], type: 'qr',     title: '生成链接/页面二维码' },
  { id: 'qr-scan',       contexts: ['image'],                        type: 'qr_scan',  title: '识别图片二维码' },
  { id: 'qr-jump',       contexts: ['image'],                        type: 'qr_jump',  title: '识别二维码并跳转' },
  { id: 'img-baidu',     contexts: ['image'],                        type: 'baidu_image', title: '百度识图（相似图片）' },
  { id: 'img-google',    contexts: ['image'],                        type: 'google_image', title: '谷歌识图（Lens）' },
  { id: 'pan-search',    contexts: ['selection'],                    type: 'pan',      title: '网盘聚合搜索' },
  { id: 'download',      contexts: ['link', 'audio', 'video'],       type: 'download', title: '使用浏览器下载' },
  { id: 'aria-down',     contexts: ['link', 'audio', 'video'],       type: 'aria',     title: '推送到 Aria2 下载' },
  { id: 'motrix-down',   contexts: ['link', 'audio', 'video'],       type: 'motrix',   title: '推送到 Motrix 下载' },
  { id: 'show-password', contexts: ['page'],                         type: 'password', title: '显示/隐藏明文密码' },
  { id: 'cookie-tool',   contexts: ['page'],                         type: 'cookie',   title: 'Cookie 工具（本站）' },
  { id: 'open-options',  contexts: ['page'],                         type: 'options',  title: '阿苏工具箱设置' },
];

const DEFAULT_CONFIG = {
  menus: Object.fromEntries(MENU_DEFS.map(m => [m.id, { on: true, title: m.title }])),
  aria:   { server: 'http://localhost:6800/jsonrpc',  token: '' },
  motrix: { server: 'http://localhost:16800/jsonrpc', token: '' },
  pan:    { template: 'https://www.dalipan.com/search?key={q}' },
  proxy: {
    mode: 'off', // off | fixed | pac_url | rules
    fixed: { scheme: 'http', host: '127.0.0.1', port: 7890 },
    pacUrl: '',
    rules: [],
    bypassList: ['localhost', '127.0.0.1', '<local>'],
  },
  scripts: [], // [{ id, name, code, on }]
};

/** 读取合并后的配置（浅合并一层，兼容旧配置缺字段）。 */
async function loadConfig() {
  const stored = await chrome.storage.sync.get(null);
  const cfg = structuredClone(DEFAULT_CONFIG);
  for (const key of Object.keys(cfg)) {
    if (stored[key] !== undefined) {
      cfg[key] = (key === 'menus' || typeof cfg[key] !== 'object')
        ? stored[key]
        : Object.assign(cfg[key], stored[key]);
    }
  }
  return cfg;
}

/* ============================== MENUS =============================== */

let menuRebuildChain = Promise.resolve();

/** 串行化重建，避免并发触发导致菜单 ID 冲突。 */
function scheduleRebuildMenus() {
  menuRebuildChain = menuRebuildChain.then(rebuildMenus).catch(() => {});
  return menuRebuildChain;
}

async function rebuildMenus() {
  await chrome.contextMenus.removeAll();
  const cfg = await loadConfig();
  for (const def of MENU_DEFS) {
    const state = cfg.menus[def.id] || { on: true, title: def.title };
    if (!state.on) continue;
    await createMenu({ id: def.id, contexts: def.contexts, title: state.title || def.title });
  }
  for (const script of cfg.scripts || []) {
    if (!script.on || !script.name) continue;
    await createMenu({ id: `script-${script.id}`, contexts: ['page', 'frame'], title: '▶ ' + script.name });
  }
}

function createMenu(props) {
  return new Promise(resolve => {
    chrome.contextMenus.create(props, () => { void chrome.runtime.lastError; resolve(); });
  });
}

/* ============================== NOTIFY ============================== */

function notify(title, message) {
  try {
    chrome.notifications.create({ type: 'basic', iconUrl: 'icons/icon_128.png', title, message });
  } catch { /* 通知不可用时静默 */ }
}

/* =============================== RPC ================================ */

/** 推送 URL 到 Aria2 / Motrix（二者同为 aria2 JSON-RPC 协议）。 */
async function rpcAddUri(server, token, url, referer, cookieHeader) {
  const options = {};
  if (referer) options.referer = referer;
  if (cookieHeader) options.header = ['Cookie: ' + cookieHeader];
  const params = token ? [`token:${token}`, [url], options] : [[url], options];
  const res = await fetch(server, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 'asu-' + Date.now(), method: 'aria2.addUri', params }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'RPC 错误');
  return data.result;
}

async function rpcGetVersion(server, token) {
  const params = token ? [`token:${token}`] : [];
  const res = await fetch(server, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 'asu-ver', method: 'aria2.getVersion', params }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.result.version;
}

/* ================================ QR ================================ */

/* offscreen 文档负责 canvas 解码；SW 只负责取图与结果等待。 */

async function ensureOffscreen() {
  let exists = false;
  try {
    if (typeof chrome.offscreen.hasDocument === 'function') {
      exists = await chrome.offscreen.hasDocument();
    } else if (typeof chrome.runtime.getContexts === 'function') {
      const ctxs = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
      exists = !!(ctxs && ctxs.length);
    }
  } catch { exists = false; }
  if (exists) return;
  try {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html', reasons: ['DOM_PARSER'], justification: '二维码图片解码',
    });
  } catch (e) {
    if (!String(e).includes('single offscreen document')) throw e;
  }
}

async function fetchAsDataUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('图片下载失败 HTTP ' + res.status);
  const blob = await res.blob();
  if (blob.size > 15 * 1024 * 1024) throw new Error('图片超过 15MB');
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  }
  const type = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/png';
  return `data:${type};base64,` + btoa(bin);
}

/** 解码等待器：单一持久监听 + 待决 Promise 表，避免重复监听器堆积。 */
const decodeWaiters = new Set();

chrome.runtime.onMessage.addListener(msg => {
  if (msg && msg.asuDecode !== undefined) {
    for (const waiter of decodeWaiters) waiter(msg);
    decodeWaiters.clear();
  }
});

async function decodeQrImage(dataUrl) {
  await ensureOffscreen();
  const task = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      decodeWaiters.delete(waiter);
      reject(new Error('识别超时'));
    }, 15000);
    const waiter = msg => {
      clearTimeout(timer);
      msg.asuDecode ? resolve(msg.text) : reject(new Error(msg.error || '未识别到二维码'));
    };
    decodeWaiters.add(waiter);
  });
  chrome.runtime.sendMessage({ asuDecodeImage: dataUrl }).catch(() => {});
  return task;
}

/* ============================= HANDLERS ============================= */

/** 取当前标签页站点 Cookie 的请求头字符串（推送下载时附带鉴权）。 */
async function getCookieHeader(tab) {
  try {
    const host = new URL(tab.url).hostname;
    const cookies = await chrome.cookies.getAll({ domain: host });
    return cookies.map(c => `${c.name}=${c.value}`).join('; ');
  } catch { return ''; }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const cfg = await loadConfig();
  const menuId = String(info.menuItemId);
  const url = info.linkUrl || info.srcUrl || info.pageUrl || '';
  try {
    switch (menuId) {
      case 'qr-selection':
      case 'qr-link-page': {
        const text = menuId === 'qr-selection' ? (info.selectionText || '') : url;
        chrome.tabs.create({ url: 'tools/qr.html?text=' + encodeURIComponent(text) });
        break;
      }
      case 'qr-scan':
      case 'qr-jump': {
        if (!info.srcUrl) { notify(BRAND, '未取到图片地址'); break; }
        notify(BRAND, '正在下载并识别图片…');
        const dataUrl = await fetchAsDataUrl(info.srcUrl);
        const text = await decodeQrImage(dataUrl);
        if (menuId === 'qr-jump' && /^https?:\/\//i.test(text)) {
          chrome.tabs.create({ url: text });
        } else {
          try { await navigator.clipboard.writeText(text); notify('识别成功，已复制', text.slice(0, 180)); }
          catch { notify('识别成功', text.slice(0, 180)); }
        }
        break;
      }
      case 'img-baidu':
        chrome.tabs.create({ url: 'https://graph.baidu.com/details?isfromtusoupc=1&tn=pc&image_url=' + encodeURIComponent(info.srcUrl || '') });
        break;
      case 'img-google':
        chrome.tabs.create({ url: 'https://lens.google.com/uploadbyurl?url=' + encodeURIComponent(info.srcUrl || '') });
        break;
      case 'pan-search': {
        const q = (info.selectionText || '').trim();
        if (!q) { notify(BRAND, '请先选中要搜索的文字'); break; }
        chrome.tabs.create({ url: cfg.pan.template.replace('{q}', encodeURIComponent(q)) });
        break;
      }
      case 'download':
        chrome.downloads.download({ url });
        notify(BRAND, '已加入浏览器下载');
        break;
      case 'aria-down':
      case 'motrix-down': {
        const conf = menuId === 'aria-down' ? cfg.aria : cfg.motrix;
        const label = menuId === 'aria-down' ? 'Aria2' : 'Motrix';
        try {
          await rpcAddUri(conf.server, conf.token, url, tab?.url || '', await getCookieHeader(tab));
          notify(`已推送到 ${label}`, url.slice(0, 120));
        } catch (e) {
          notify(`推送到 ${label} 失败`, `${e.message || e} — 请确认服务已启动，并在设置里核对地址/密钥`);
        }
        break;
      }
      case 'show-password': {
        const [r] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const revealed = [...document.querySelectorAll('input[data-asu-pw="1"]')];
            if (revealed.length) {
              revealed.forEach(el => { el.type = 'password'; el.removeAttribute('data-asu-pw'); });
              return 'hidden';
            }
            const boxes = [...document.querySelectorAll('input[type=password]')];
            boxes.forEach(el => { el.type = 'text'; el.dataset.asuPw = '1'; });
            return 'shown:' + boxes.length;
          },
        });
        const result = r?.result;
        if (result === 'hidden') notify(BRAND, '密码框已还原为圆点');
        else if (result?.startsWith('shown')) notify(BRAND, `已显示 ${result.split(':')[1]} 个密码框（再点一次还原）`);
        else notify(BRAND, '本页没有找到密码框');
        break;
      }
      case 'cookie-tool':
        chrome.tabs.create({ url: 'tools/cookie.html' });
        break;
      case 'open-options':
        chrome.runtime.openOptionsPage();
        break;
      default:
        if (menuId.startsWith('script-')) {
          const script = (cfg.scripts || []).find(s => menuId === 'script-' + s.id);
          if (script && tab?.id) {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              world: 'MAIN',
              func: code => { (0, eval)(code); },
              args: [script.code],
            });
            notify('自定义脚本已执行', script.name);
          }
        }
    }
  } catch (e) {
    notify(BRAND + ' 出错了', String(e.message || e).slice(0, 160));
  }
});

/* ============================== PROXY =============================== */

function buildPacFromRules(rules, bypass) {
  const entries = (rules || []).map(r => ({
    domain: (r.domain || '').replace(/^\*\./, '').toLowerCase(),
    host: r.host,
    port: Number(r.port) || 80,
    scheme: (r.scheme || 'HTTP').toUpperCase(),
  }));
  return `function FindProxyForURL(url, host) {
  var bypass = ${JSON.stringify(bypass || [])};
  for (var i = 0; i < bypass.length; i++) {
    if (host === bypass[i] || (bypass[i] === '<local>' && host.indexOf('.') === -1)) return 'DIRECT';
  }
  var rules = ${JSON.stringify(entries)};
  for (var j = 0; j < rules.length; j++) {
    var r = rules[j];
    if (host === r.domain || host.endsWith('.' + r.domain)) {
      return r.scheme + ' ' + r.host + ':' + r.port + '; DIRECT';
    }
  }
  return 'DIRECT';
}`;
}

async function applyProxy() {
  const cfg = await loadConfig();
  const p = cfg.proxy;
  switch (p.mode) {
    case 'fixed':
      await chrome.proxy.settings.set({
        scope: 'regular',
        value: {
          mode: 'fixed_servers',
          rules: {
            singleProxy: { scheme: p.fixed.scheme, host: p.fixed.host, port: Number(p.fixed.port) },
            bypassList: p.bypassList,
          },
        },
      });
      return 'fixed';
    case 'pac_url': {
      const res = await fetch(p.pacUrl);
      await chrome.proxy.settings.set({
        scope: 'regular',
        value: { mode: 'pac_script', value: { data: await res.text() } },
      });
      return 'pac_url';
    }
    case 'rules':
      await chrome.proxy.settings.set({
        scope: 'regular',
        value: { mode: 'pac_script', value: { data: buildPacFromRules(p.rules, p.bypassList) } },
      });
      return 'rules';
    default:
      await chrome.proxy.settings.clear({ scope: 'regular' });
      return 'off';
  }
}

/* ============================ MESSAGING ============================= */

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg?.asuApplyProxy) {
      try { sendResponse({ ok: true, mode: await applyProxy() }); }
      catch (e) { sendResponse({ ok: false, error: String(e.message || e) }); }
    } else if (msg?.asuTestRpc) {
      try { sendResponse({ ok: true, version: await rpcGetVersion(msg.server, msg.token) }); }
      catch (e) { sendResponse({ ok: false, error: String(e.message || e) }); }
    } else if (msg?.asuGetCurrentIp) {
      try {
        const res = await fetch('https://api.ipify.org?format=json');
        sendResponse({ ok: true, ip: (await res.json()).ip });
      } catch (e) { sendResponse({ ok: false, error: String(e.message || e) }); }
    }
  })();
  return true; // 异步响应
});

/* ============================== BOOTSTRAP =========================== */

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.sync.get(null);
  if (stored.menus === undefined) await chrome.storage.sync.set(DEFAULT_CONFIG);
  await scheduleRebuildMenus();
});
chrome.runtime.onStartup.addListener(scheduleRebuildMenus);
chrome.storage.onChanged.addListener((_, area) => { if (area === 'sync') scheduleRebuildMenus(); });
scheduleRebuildMenus(); // SW 每次唤醒都自愈菜单状态
