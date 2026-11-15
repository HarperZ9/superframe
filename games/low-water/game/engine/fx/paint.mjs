// The painted form of the effects: each primitive is a brush mark, an elongated dab along its angle with a bristled
// edge (glows add, the rest lie over the painting), drawn either into an RGBA buffer (node, the proof sheets) or onto a
// canvas over the plate (the game). Original code.
//   paintRgba(img, prims, { scale = 1, ox = 0, oy = 0 })     img: { width, height, data } in plate pixels times scale
//   paintCanvas(ctx2d, prims, view)                           view: { left, top, zoom } (ui/platecam frameNow)
const LIN = new Float32Array(256).map((_, i) => { const c = i / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
const enc = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(Math.min(1, x), 1 / 2.4) - 0.055) * 255;
const hh = (a, b) => { let x = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1); x = Math.imul(x ^ (x >>> 15), 0x85ebca6b); return ((x ^ (x >>> 13)) >>> 0) / 4294967296; };
// a dab's coverage at a point: distance to its segment over its radius, softened, with bristles along the stroke
function cover(p, X, Y) {
  const c = Math.cos(p.ang || 0), s = Math.sin(p.ang || 0), dx = X - p.x, dy = Y - p.y, along = dx * c + dy * s, across = -dx * s + dy * c, L = p.len || 0;
  const t = Math.max(0, Math.min(L, along)), d = Math.hypot(along - t, across) / Math.max(0.5, p.r); if (d >= 1) return 0;
  const edge = 1 - d * d, bristle = L > 1.5 ? 0.75 + 0.25 * hh(Math.round(across * 2), p.x | 0) : 1;
  return edge * bristle;
}
// a notice: a paper oblong with lines of print, a corner torn away as it ages (the torn share of its seed's corner)
function noticeCover(p, X, Y) {
  const w = p.len * 2, h = p.r * 2, x = X - (p.x - w / 2), y = Y - (p.y - h / 2); if (x < 0 || y < 0 || x > w || y > h) return 0;
  const cut = p.torn * 0.6, cx = (p.seed & 1) ? w - x : x, cy = (p.seed & 2) ? h - y : y; if (cx / w + cy / h < cut) return 0;
  return 1;
}
function noticeInk(p, X, Y) { const h = p.r * 2, y = Y - (p.y - p.r), line = Math.floor((y / h) * 7); return line > 0 && line < 6 && (y / h * 7) % 1 < 0.45 && hh(line, Math.floor((X - p.x) / 2) + p.seed) > 0.25 * (1 + p.torn); }
export function paintRgba(img, prims, { scale = 1, ox = 0, oy = 0 } = {}) {
  const W = img.width, H = img.height, D = img.data;
  for (const p0 of prims) {
    if (p0.glyphOnly) continue;
    if (p0.k === "layer") { layerRgba(img, p0, scale, ox, oy); continue; }
    if (p0.k === "notice") { noticeRgba(img, p0, scale, ox, oy); continue; }
    const p = { ...p0, x: (p0.x - ox) * scale, y: (p0.y - oy) * scale, r: p0.r * scale, len: (p0.len || 0) * scale }, ext = p.r + p.len;
    const x0 = Math.max(0, Math.floor(p.x - ext)), x1 = Math.min(W - 1, Math.ceil(p.x + ext)), y0 = Math.max(0, Math.floor(p.y - ext)), y1 = Math.min(H - 1, Math.ceil(p.y + ext));
    for (let Y = y0; Y <= y1; Y++) for (let X = x0; X <= x1; X++) {
      const k = cover(p, X + 0.5, Y + 0.5) * p.a; if (k <= 0.004) continue; const q = (Y * W + X) * 4;
      for (let c = 0; c < 3; c++) { const b = LIN[D[q + c]]; D[q + c] = enc(p.glow ? b + p.rgb[c] * k : b * (1 - k) + p.rgb[c] * k); }
    }
  }
  return img;
}
function noticeRgba(img, p0, scale, ox, oy) {
  const W = img.width, H = img.height, D = img.data, p = { ...p0, x: (p0.x - ox) * scale, y: (p0.y - oy) * scale, r: p0.r * scale, len: p0.len * scale };
  for (let Y = Math.max(0, Math.floor(p.y - p.r)); Y <= Math.min(H - 1, Math.ceil(p.y + p.r)); Y++) for (let X = Math.max(0, Math.floor(p.x - p.len)); X <= Math.min(W - 1, Math.ceil(p.x + p.len)); X++) {
    if (!noticeCover(p, X + 0.5, Y + 0.5)) continue; const q = (Y * W + X) * 4, ink = noticeInk(p, X + 0.5, Y + 0.5), c = ink ? p.rgb.map((v) => v * 0.25) : p.rgb;
    for (let k = 0; k < 3; k++) D[q + k] = enc(LIN[D[q + k]] * (1 - p.a) + c[k] * p.a);
  }
}
// a plate-anchored image (lying snow): sampled at its own resolution, laid over by its alpha
function layerRgba(img, L, scale, ox, oy) {
  const W = img.width, H = img.height, D = img.data;
  for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
    const px = X / scale + ox, py = Y / scale + oy, lx = Math.floor(px * L.scale), ly = Math.floor(py * L.scale); if (lx < 0 || ly < 0 || lx >= L.w || ly >= L.h) continue;
    let q = (ly * L.w + lx) * 4, a = L.rgba[q + 3] / 255, rgb = [L.rgba[q], L.rgba[q + 1], L.rgba[q + 2]];
    if (L.smooth) {   // a coarse layer (the fog) read bilinearly, so its edges do not step
      const fx = px * L.scale - 0.5, fy = py * L.scale - 0.5, x0 = Math.max(0, Math.floor(fx)), y0 = Math.max(0, Math.floor(fy)), x1 = Math.min(L.w - 1, x0 + 1), y1 = Math.min(L.h - 1, y0 + 1), u = Math.max(0, fx - x0), v = Math.max(0, fy - y0);
      const at = (xx, yy, k) => L.rgba[(yy * L.w + xx) * 4 + k], bl = (k) => (at(x0, y0, k) * (1 - u) + at(x1, y0, k) * u) * (1 - v) + (at(x0, y1, k) * (1 - u) + at(x1, y1, k) * u) * v;
      a = bl(3) / 255; rgb = [bl(0), bl(1), bl(2)];
    }
    if (a <= 0) continue; const o = (Y * W + X) * 4;
    for (let c = 0; c < 3; c++) D[o + c] = D[o + c] * (1 - a) + L.rgba[q + c] * a;
  }
}
const layerCanvas = new WeakMap();
function drawLayer(g, L, view) {
  let c = layerCanvas.get(L);
  if (!c) { c = new OffscreenCanvas(L.w, L.h); c.getContext("2d").putImageData(new ImageData(L.rgba, L.w, L.h), 0, 0); layerCanvas.set(L, c); }
  g.globalCompositeOperation = L.glow ? "lighter" : "source-over"; g.globalAlpha = L.glow ? 0.6 : 1; g.imageSmoothingEnabled = true;
  g.drawImage(c, -view.left * view.zoom, -view.top * view.zoom, (L.w / L.scale) * view.zoom, (L.h / L.scale) * view.zoom);
}
const css = (rgb) => `rgb(${Math.round(enc(rgb[0]))},${Math.round(enc(rgb[1]))},${Math.round(enc(rgb[2]))})`;
export function paintCanvas(g, prims, view) {
  const z = view.zoom; g.save();
  for (const p of prims) {
    if (p.glyphOnly) continue;
    if (p.k === "layer") { drawLayer(g, p, view); continue; }
    if (p.k === "notice") { const x = (p.x - view.left) * z, y = (p.y - view.top) * z; g.globalCompositeOperation = "source-over"; g.globalAlpha = p.a; g.fillStyle = css(p.rgb); g.beginPath(); g.moveTo(x - p.len * z + p.torn * p.len * z, y - p.r * z); g.lineTo(x + p.len * z, y - p.r * z); g.lineTo(x + p.len * z, y + p.r * z); g.lineTo(x - p.len * z, y + p.r * z); g.lineTo(x - p.len * z, y - p.r * z + p.torn * p.r * z); g.fill(); g.fillStyle = css(p.rgb.map((v) => v * 0.25)); for (let l = 1; l < 6; l++) g.fillRect(x - p.len * z * 0.7, y - p.r * z + (l / 7) * 2 * p.r * z, p.len * z * 1.4 * (0.6 + 0.4 * ((l * 7 + p.seed) % 5) / 5), Math.max(0.6, p.r * z * 0.12)); continue; }
    const x = (p.x - view.left) * z, y = (p.y - view.top) * z, r = Math.max(0.6, p.r * z), L = (p.len || 0) * z; if (x < -r - L || y < -r - L || x > g.canvas.width + r + L || y > g.canvas.height + r + L) continue;
    g.globalCompositeOperation = p.glow ? "lighter" : "source-over"; g.globalAlpha = Math.min(1, p.a); g.fillStyle = css(p.rgb);
    g.beginPath(); g.ellipse(x + Math.cos(p.ang || 0) * L / 2, y + Math.sin(p.ang || 0) * L / 2, r + L / 2, r, p.ang || 0, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}
