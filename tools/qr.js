/* 二维码工具页：生成（qrcode-generator）+ 本地图片识别（jsQR） */
const $ = s => document.querySelector(s);
const cv = $('#cv'), ta = $('#text'), genmsg = $('#genmsg');

function render(text) {
  try {
    if (!text) { genmsg.textContent = '等待输入…'; return; }
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const count = qr.getModuleCount();
    const cell = Math.max(2, Math.floor(Math.min(320 / count, 8)));
    const size = cell * count;
    cv.width = size; cv.height = size;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#000';
    for (let r = 0; r < count; r++)
      for (let c = 0; c < count; c++)
        if (qr.isDark(r, c)) ctx.fillRect(c * cell, r * cell, cell, cell);
    genmsg.textContent = `版本 ${count}×${count} 模块`;
  } catch (e) {
    genmsg.textContent = '内容过长，生成失败';
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
  }
}

let timer = null;
ta.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => render(ta.value.trim()), 250); });

$('#dl').addEventListener('click', () => {
  const a = document.createElement('a');
  a.download = 'qrcode.png';
  a.href = cv.toDataURL('image/png');
  a.click();
});

$('#copy').addEventListener('click', async () => {
  try {
    const blob = await new Promise(r => cv.toBlob(r));
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    genmsg.textContent = '已复制到剪贴板';
  } catch { genmsg.textContent = '复制失败，请用下载'; }
});

/* ---- 识别 ---- */
$('#file').addEventListener('change', async (ev) => {
  const box = $('#decodeResult');
  box.style.display = 'block';
  const file = ev.target.files[0];
  if (!file) return;
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
    c.width = img.width * scale; c.height = img.height * scale;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const data = ctx.getImageData(0, 0, c.width, c.height);
    const code = jsQR(data.data, data.width, data.height, { inversionAttempts: 'attemptBoth' });
    if (code && code.data) {
      if (/^https?:\/\//i.test(code.data)) {
        box.innerHTML = '识别到：<a href="' + code.data.replace(/"/g, '&quot;') + '" target="_blank">' + code.data.replace(/</g, '&lt;') + '</a>';
      } else {
        box.textContent = '识别到：' + code.data;
      }
    } else { box.className = 'err'; box.id = 'decodeResult'; box.classList.add('err'); box.textContent = '未识别到二维码，试试更清晰的图'; }
  };
  img.src = URL.createObjectURL(file);
});

/* ---- URL 参数预填 ---- */
const pre = new URLSearchParams(location.search).get('text');
if (pre) { ta.value = pre; render(pre); } else render('');
