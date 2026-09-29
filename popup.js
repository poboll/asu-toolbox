/* 阿苏工具箱 popup：快捷开关与工具入口 */
const $ = s => document.querySelector(s);
const msg = t => { $('#msg').textContent = t; };

const PROXY_MODE_NAMES = { off: '关闭', fixed: '固定服务器', pac_url: 'PAC 订阅', rules: '分流规则' };

async function loadProxyState() {
  const { proxy = {} } = await chrome.storage.sync.get('proxy');
  $('#proxyMode').textContent = PROXY_MODE_NAMES[proxy.mode] || proxy.mode || '关闭';
  $('#proxyOn').checked = !!proxy.mode && proxy.mode !== 'off';
}

$('#proxyOn').addEventListener('change', async ev => {
  const { proxy = {} } = await chrome.storage.sync.get('proxy');
  const turnedOn = ev.target.checked;
  const nextMode = turnedOn
    ? (proxy.mode && proxy.mode !== 'off' ? proxy.mode : (proxy.fixed ? 'fixed' : 'rules'))
    : 'off';
  await chrome.storage.sync.set({ proxy: { ...proxy, mode: nextMode } });
  const res = await chrome.runtime.sendMessage({ asuApplyProxy: true });
  if (res?.ok) {
    loadProxyState();
    msg(nextMode === 'off' ? '代理已关闭' : `代理已开启（${PROXY_MODE_NAMES[nextMode] || nextMode}）`);
  } else {
    loadProxyState();
    msg('失败：' + (res?.error || '未知错误'));
  }
});

/** 向当前活动标签页注入函数并返回结果。 */
async function injectIntoActiveTab(fn) {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) return null;
  const [frame] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: fn });
  return frame?.result ?? null;
}

$('#showPw').addEventListener('click', async () => {
  try {
    const result = await injectIntoActiveTab(() => {
      const revealed = [...document.querySelectorAll('input[data-asu-pw="1"]')];
      if (revealed.length) {
        revealed.forEach(el => { el.type = 'password'; el.removeAttribute('data-asu-pw'); });
        return 'hidden';
      }
      const boxes = [...document.querySelectorAll('input[type=password]')];
      boxes.forEach(el => { el.type = 'text'; el.dataset.asuPw = '1'; });
      return 'shown:' + boxes.length;
    });
    if (result === 'hidden') msg('已还原为圆点');
    else if (result?.startsWith('shown')) msg(`已显示 ${result.split(':')[1]} 个密码框`);
    else msg('本页没有密码框');
  } catch (e) { msg('失败：' + e.message); }
});

$('#qrPage').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  chrome.tabs.create({ url: 'tools/qr.html?text=' + encodeURIComponent(tab?.url || '') });
});

$('#qrTool').addEventListener('click', () => chrome.tabs.create({ url: 'tools/qr.html' }));
$('#cookieTool').addEventListener('click', () => chrome.tabs.create({ url: 'tools/cookie.html' }));
$('#opts').addEventListener('click', () => chrome.runtime.openOptionsPage());

loadProxyState();
