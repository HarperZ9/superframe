// Pure image helpers for float RGBA buffers (straight alpha), shared by Node tools and the browser.
// Float RGBA (0..1) to 8-bit, optionally over a background colour.
export function toRgba8(rgba, w, h, bg = null) {
  const d = new Uint8ClampedArray(w * h * 4), g = (x) => Math.round(Math.max(0, Math.min(1, x)) * 255);
  for (let i = 0; i < w * h; i++) {
    const a = rgba[i * 4 + 3];
    if (bg) { for (let c = 0; c < 3; c++) d[i * 4 + c] = g(rgba[i * 4 + c] * a + bg[c] * (1 - a)); d[i * 4 + 3] = 255; }
    else { for (let c = 0; c < 3; c++) d[i * 4 + c] = g(rgba[i * 4 + c]); d[i * 4 + 3] = Math.round(a * 255); }
  }
  return d;
}
// Box-downsample float RGBA by an integer factor (premultiplied, so edges stay clean).
export function down(rgba, w, h, f) {
  if (f === 1) return { rgba, w, h };
  const W = Math.floor(w / f), H = Math.floor(h / f), o = new Float32Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let dy = 0; dy < f; dy++) for (let dx = 0; dx < f; dx++) { const i = ((y * f + dy) * w + x * f + dx) * 4, al = rgba[i + 3]; r += rgba[i] * al; g += rgba[i + 1] * al; b += rgba[i + 2] * al; a += al; }
    const k = f * f, j = (y * W + x) * 4; o[j + 3] = a / k; if (a > 0) { o[j] = r / a; o[j + 1] = g / a; o[j + 2] = b / a; }
  }
  return { rgba: o, w: W, h: H };
}
// Paste float RGBA b (bw x bh) over a (aw x ah) at (x0, y0).
export function paste(a, aw, ah, b, bw, bh, x0, y0) {
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    const X = x0 + x, Y = y0 + y; if (X < 0 || Y < 0 || X >= aw || Y >= ah) continue;
    const i = (y * bw + x) * 4, j = (Y * aw + X) * 4, al = b[i + 3];
    for (let c = 0; c < 3; c++) a[j + c] = a[j + c] * (1 - al) + b[i + c] * al;
    a[j + 3] = Math.max(a[j + 3], al);
  }
}
