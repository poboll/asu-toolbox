/* 阿苏工具箱 设置页逻辑 */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
let CFG = null;

const MENU_NAMES = {
  'qr-selection': '生成选区二维码', 'qr-link-page': '生成链接/页面二维码',
  'qr-scan': '识别图片二维码', 'qr-jump': '识别二维码并跳转',
  'img-baidu': '百度识图', 'img-google': '谷歌识图（Lens）',
  'translate-selection': '翻译选中文本（菜单组）', 'translate-google': '├ 谷歌翻译',
  'translate-baidu': '├ 百度翻译', 'translate-deepl': '├ DeepL 翻译', 'translate-bing': '└ 必应翻译',
  'unlock-copy': '解除本页复制/右键限制',
  'pan-search': '网盘聚合搜索', 'download': '使用浏览器下载',
  'aria-down': '推送到 Aria2', 'motrix-down': '推送到 Motrix',
  'show-password': '显示/隐藏明文密码', 'cookie-tool': 'Cookie 工具', 'open-options': '阿苏工具箱设置'
};

function escAttr(s) { return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }

async function load() {
  CFG = await chrome.storage.sync.get(null);
  renderMenus();
  $('#ariaServer').value = CFG.aria?.server || 'http://localhost:6800/jsonrpc';
  $('#ariaToken').value = CFG.aria?.token || '';
  $('#motrixServer').value = CFG.motrix?.server || 'http://localhost:16800/jsonrpc';
  $('#motrixToken').value = CFG.motrix?.token || '';
  $('#panTemplate').value = CFG.pan?.template || 'https://www.dalipan.com/search?key={q}';
  const cl = CFG.cleaner || {};
  $('#cleanerBaidu').checked = cl.baidu !== false;
  $('#cleanerSogou').checked = cl.sogou !== false;
  $('#cleanerDeredirect').checked = cl.deredirect !== false;
  const p = CFG.proxy || {};
  $('#proxyMode').value = p.mode || 'off';
  $('#fixScheme').value = p.fixed?.scheme || 'http';
  $('#fixHost').value = p.fixed?.host || '127.0.0.1';
  $('#fixPort').value = p.fixed?.port ?? 7890;
  $('#pacUrl').value = p.pacUrl || '';
  $('#rulesText').value = (p.rules || []).map(r => `${r.domain} ${r.host} ${r.port}${r.scheme && r.scheme !== 'http' ? ' ' + r.scheme.toLowerCase() : ''}`).join('\n');
  $('#bypassList').value = (p.bypassList || ['localhost', '127.0.0.1', '<local>']).join(', ');
  renderScripts();
  syncProxySections();
}

function renderMenus() {
  const box = $('#menuList');
  box.innerHTML = '';
  const menus = CFG.menus || {};
  for (const [id, name] of Object.entries(MENU_NAMES)) {
    const on = menus[id]?.on !== false;
    const row = document.createElement('div');
    row.className = 'toggle-row';
    row.innerHTML = `<span>${name}</span><label class="sw"><input type="checkbox" data-menu="${id}" ${on ? 'checked' : ''}><i></i></label>`;
    box.appendChild(row);
  }
}

function renderScripts() {
  const box = $('#scriptList');
  box.innerHTML = '';
  (CFG.scripts || []).forEach((s, i) => {
    const div = document.createElement('div');
    div.className = 'card';
    div.style.background = '#fafafa';
    div.style.marginTop = '8px';
    div.innerHTML = `
      <div class="row">
        <input type="text" data-idx="${i}" class="sc-name" value="${escAttr(s.name)}" placeholder="脚本名（右键菜单标题）">
        <label class="sw"><input type="checkbox" data-idx="${i}" class="sc-on" ${s.on ? 'checked' : ''}><i></i></label>
        <button class="act ghost sc-del" data-idx="${i}">删除</button>
      </div>
      <textarea data-idx="${i}" class="sc-code" rows="4" placeholder="// JS 代码，在页面上下文执行">${escAttr(s.code || '')}</textarea>`;
    box.appendChild(div);
  });
  box.querySelectorAll('.sc-del').forEach(b => b.addEventListener('click', () => {
    CFG.scripts.splice(+b.dataset.idx, 1);
    renderScripts();
  }));
}

function collect() {
  const menus = { ...CFG.menus };
  $$('input[data-menu]').forEach(cb => { if (menus[cb.dataset.menu]) menus[cb.dataset.menu].on = cb.checked; });
  const scripts = $$('.sc-name').map((n, i) => ({
    id: (CFG.scripts[i] && CFG.scripts[i].id) || (Date.now() + '-' + i),
    name: n.value.trim(),
    on: $$('.sc-on')[i].checked,
    code: $$('.sc-code')[i].value,
  })).filter(s => s.name && s.code);
  const rules = $('#rulesText').value.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const [domain, host, port, scheme] = l.split(/\s+/);
    return { domain, host, port, scheme: (scheme || 'http').toLowerCase() };
  });
  return {
    menus,
    aria: { server: $('#ariaServer').value.trim(), token: $('#ariaToken').value.trim() },
    motrix: { server: $('#motrixServer').value.trim(), token: $('#motrixToken').value.trim() },
    pan: { template: $('#panTemplate').value.trim() },
    cleaner: {
      baidu: $('#cleanerBaidu').checked,
      sogou: $('#cleanerSogou').checked,
      deredirect: $('#cleanerDeredirect').checked,
    },
    proxy: {
      mode: $('#proxyMode').value,
      fixed: { scheme: $('#fixScheme').value, host: $('#fixHost').value.trim(), port: +$('#fixPort').value || 80 },
      pacUrl: $('#pacUrl').value.trim(),
      rules,
      bypassList: $('#bypassList').value.split(',').map(x => x.trim()).filter(Boolean),
    },
    scripts,
  };
}

$('#save').addEventListener('click', async () => {
  await chrome.storage.sync.set(collect());
  $('#msg').textContent = '✔ 已保存（右键菜单即时生效）';
  setTimeout(() => $('#msg').textContent = '', 2500);
});

$('#nav').addEventListener('click', ev => {
  const b = ev.target.closest('button[data-s]');
  if (!b) return;
  $$('#nav button').forEach(x => x.classList.toggle('on', x === b));
  ['menus', 'download', 'search', 'proxy', 'scripts', 'backup'].forEach(s => $('#s-' + s).classList.toggle('hidden', s !== b.dataset.s));
});

function syncProxySections() {
  const m = $('#proxyMode').value;
  $('#proxyFixed').classList.toggle('hidden', m !== 'fixed');
  $('#proxyPac').classList.toggle('hidden', m !== 'pac_url');
  $('#proxyRules').classList.toggle('hidden', m !== 'rules');
}
$('#proxyMode').addEventListener('change', syncProxySections);

function bindTest(btnId, outId, getServer, getToken) {
  $(btnId).addEventListener('click', async () => {
    $(outId).textContent = '测试中…';
    const res = await chrome.runtime.sendMessage({ asuTestRpc: true, server: getServer(), token: getToken() });
    $(outId).textContent = res?.ok ? '✔ 连接成功，版本 ' + res.version : '✘ ' + (res?.error || '失败');
  });
}
bindTest('#testAria', '#testAriaOut', () => $('#ariaServer').value.trim(), () => $('#ariaToken').value.trim());
bindTest('#testMotrix', '#testMotrixOut', () => $('#motrixServer').value.trim(), () => $('#motrixToken').value.trim());

$('#applyProxy').addEventListener('click', async () => {
  await chrome.storage.sync.set(collect());
  const res = await chrome.runtime.sendMessage({ asuApplyProxy: true });
  $('#proxyOut').textContent = res?.ok ? '✔ 已应用（模式 ' + res.mode + '）' : '✘ ' + (res?.error || '失败');
});

$('#checkIp').addEventListener('click', async () => {
  $('#proxyOut').textContent = '查询中…';
  const res = await chrome.runtime.sendMessage({ asuGetCurrentIp: true });
  $('#proxyOut').textContent = res?.ok ? '当前出口 IP：' + res.ip : '查询失败';
});

$('#addScript').addEventListener('click', () => {
  CFG.scripts = CFG.scripts || [];
  CFG.scripts.push({ id: Date.now() + '', name: '新脚本', on: true, code: "alert('Hello 阿苏');" });
  renderScripts();
});

$('#exportCfg').addEventListener('click', async () => {
  $('#cfgJson').value = JSON.stringify(await chrome.storage.sync.get(null), null, 2);
});

$('#importCfg').addEventListener('click', async () => {
  try {
    await chrome.storage.sync.set(JSON.parse($('#cfgJson').value));
    await load();
    $('#msg').textContent = '✔ 已恢复';
  } catch (e) {
    $('#msg').textContent = '✘ JSON 解析失败：' + e.message;
  }
  setTimeout(() => $('#msg').textContent = '', 2500);
});

load();
