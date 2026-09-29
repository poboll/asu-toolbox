const $ = s => document.querySelector(s);
const msg = t => { $('#msg').textContent = t; };

(async () => {
  const got = await chrome.storage.sync.get('proxy');
  const p = got.proxy || { mode: 'off' };
  const names = { off: '关闭', fixed: '固定服务器', pac_url: 'PAC 订阅', rules: '分流规则' };
  $('#proxyMode').textContent = names[p.mode] || p.mode;
  $('#proxyOn').checked = p.mode !== 'off';
})();

$('#proxyOn').addEventListener('change', async (ev) => {
  const got = await chrome.storage.sync.get('proxy');
  const p = got.proxy || {};
  const next = ev.target.checked ? (p.mode === 'off' ? (p.fixed ? 'fixed' : 'rules') : p.mode) : 'off';
  await chrome.storage.sync.set({ proxy: { ...p, mode: next, _want: ev.target.checked } });
  const res = await chrome.runtime.sendMessage({ jzxApplyProxy: true });
  msg(res?.ok ? '代理已' + (next === 'off' ? '关闭' : '开启 (' + next + ')') : '失败：' + (res?.error || ''));
});

async function inject(fn) {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) return null;
  const [r] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: fn });
  return r?.result;
}

$('#showPw').addEventListener('click', async () => {
  try {
    const res = await inject(() => {
      const f = [...document.querySelectorAll('input[data-jzx-pw="1"]')];
      if (f.length) { f.forEach(el => { el.type = 'password'; el.removeAttribute('data-jzx-pw'); }); return 'hidden'; }
      const pws = [...document.querySelectorAll('input[type=password]')];
      pws.forEach(el => { el.type = 'text'; el.dataset.jzxPw = '1'; });
      return 'shown:' + pws.length;
    });
    msg(res === 'hidden' ? '已还原' : res ? '已显示 ' + res.split(':')[1] + ' 个密码框' : '本页没有密码框');
  } catch (e) { msg('失败：' + e.message); }
});

$('#qrPage').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  chrome.tabs.create({ url: 'tools/qr.html?text=' + encodeURIComponent(tab?.url || '') });
});

$('#qrTool').addEventListener('click', () => chrome.tabs.create({ url: 'tools/qr.html' }));
$('#cookieTool').addEventListener('click', () => chrome.tabs.create({ url: 'tools/cookie.html' }));
$('#opts').addEventListener('click', () => chrome.runtime.openOptionsPage());
