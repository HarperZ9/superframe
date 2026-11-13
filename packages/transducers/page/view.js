/* Any field to a small picture: grids as tone, colour grids as colour, sequences as a trace, symbols as coloured ticks. */
(function (g) {
  "use strict";
  const V = (g.TView = {});
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const LETTER = { A: "--s1", C: "--s2", G: "--s3", T: "--s5" };
  V.setup = (c, w, h) => {
    const r = Math.min(window.devicePixelRatio || 1, 3);
    c.width = Math.round(w * r); c.height = Math.round(h * r); c.style.width = w + "px"; c.style.height = h + "px";
    const x = c.getContext("2d"); x.setTransform(r, 0, 0, r, 0, 0); return x;
  };
  const range = (v) => { let a = Infinity, b = -Infinity; for (let i = 0; i < v.length; i++) { const x = v[i]; if (x < a) a = x; if (x > b) b = x; } return b > a ? [a, b] : [a - 1, a + 1]; };
  /* Draw a grid into an offscreen bitmap and scale it up with no smoothing, so pixels stay pixels. */
  const grid = (x, f, W, H) => {
    const [h, w] = f.domain.shape, c = f.components, off = new OffscreenCanvas(w, h), o = off.getContext("2d"), im = o.createImageData(w, h);
    const [a, b] = range(f.values), s = 255 / (b - a), gamma = (t) => 255 * Math.pow(Math.max(0, t) / 255, 0.6);
    for (let i = 0; i < w * h; i++) {
      const p = i * 4, q = i * c;
      im.data[p] = gamma((f.values[q] - a) * s);
      im.data[p + 1] = gamma((f.values[q + (c >= 3 ? 1 : 0)] - a) * s);
      im.data[p + 2] = gamma((f.values[q + (c >= 3 ? 2 : 0)] - a) * s);
      im.data[p + 3] = 255;
    }
    o.putImageData(im, 0, 0);
    x.imageSmoothingEnabled = false;
    const k = Math.min(W / w, H / h), dw = w * k, dh = h * k;
    x.drawImage(off, (W - dw) / 2, (H - dh) / 2, dw, dh);
  };
  /* A spike train reads as its rate: a one-bit trace at this width is a solid block. */
  const rateOf = (v, W) => { const n = v.length, win = Math.max(1, Math.floor((n / W) * 8)), o = new Float64Array(n); let s = 0; for (let i = 0; i < n; i++) { s += v[i]; if (i >= win) s -= v[i - win]; o[i] = s; } return o; };
  const trace = (x, v0, W, H, ink) => {
    const v = v0.every((a) => a === 0 || a === 1) ? rateOf(v0, W) : v0;
    const [a, b] = range(v), n = v.length, bin = Math.max(1, Math.floor(n / W));
    x.strokeStyle = ink; x.lineWidth = 1; x.beginPath();
    for (let px = 0; px < W; px++) {
      let lo = Infinity, hi = -Infinity;
      for (let i = Math.floor((px * n) / W), e = Math.min(n, i + bin); i < e; i++) { if (v[i] < lo) lo = v[i]; if (v[i] > hi) hi = v[i]; }
      if (lo === Infinity) continue;
      x.moveTo(px + 0.5, H - 2 - ((lo - a) / (b - a)) * (H - 4)); x.lineTo(px + 0.5, H - 2 - ((hi - a) / (b - a)) * (H - 4) - 0.5);
    }
    x.stroke();
  };
  const ticks = (x, s, W, H) => {
    const n = Math.min(s.length, Math.floor(W / 2)), wd = W / n;
    for (let i = 0; i < n; i++) { const c = s[i]; x.fillStyle = LETTER[c] ? css(LETTER[c]) : css("--ink"); const h2 = c === "-" || c === " " ? 2 : LETTER[c] ? H : ((c.charCodeAt(0) * 7) % 11) / 11 * H * 0.8 + H * 0.2; x.fillRect(i * wd, H - h2, Math.max(1, wd - 0.5), h2); }
  };
  V.field = (canvas, f, W, H) => {
    const x = V.setup(canvas, W, H), ink = css("--ink");
    x.clearRect(0, 0, W, H);
    if (f.symbolic) ticks(x, Array.from(f.values), W, H);
    else if (f.domain.kind === "grid") grid(x, f, W, H);
    else trace(x, f.components === 1 ? f.values : f.values.filter((_, i) => i % f.components === 0), W, H, ink);
    canvas.setAttribute("aria-label", `${f.name}: ${f.values.length} values in ${f.unit.name}`);
  };
  /* The bits-kept stroke: a thick bar in proportion to the source, on a log scale from 1 bit to the source's size. */
  V.barWidth = (bits, head) => (bits <= 1 ? 0 : Math.max(0, Math.log2(bits) / Math.log2(Math.max(head, 2))));
  V.fmt = (x) => { if (x === null || x === undefined || !Number.isFinite(x)) return "-"; const a = Math.abs(x); return a === 0 ? "0" : a >= 1e6 ? (x / 1e6).toFixed(1) + "M" : a >= 1e4 ? (x / 1e3).toFixed(0) + "k" : a >= 1000 ? (x / 1e3).toFixed(1) + "k" : a >= 10 ? x.toFixed(0) : a >= 0.01 ? x.toFixed(2) : x.toExponential(0); };
  V.css = css;
})(globalThis);
