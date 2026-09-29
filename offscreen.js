// offscreen 解码页：接收 dataUrl 图片 → jsQR 解码 → 广播结果
chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || !msg.jzxDecodeImage) return;
  (async () => {
    let ok = false, text = '', error = '';
    try {
      const img = await loadImage(msg.jzxDecodeImage);
      const canvas = new OffscreenCanvas(img.width, img.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(data.data, data.width, data.height, { inversionAttempts: 'attemptBoth' });
      if (code && code.data) { ok = true; text = code.data; }
      else error = '图中未找到二维码';
    } catch (e) {
      error = String(e.message || e);
    }
    chrome.runtime.sendMessage({ jzxDecode: ok, text, error }).catch(() => {});
  })();
});

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片解码失败'));
    img.src = src;
  });
}
