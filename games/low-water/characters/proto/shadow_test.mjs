// The ground shadows' flush (runtime/groundshadow.mjs flushAll) in clusters against one image over the union:
// masks far apart, overlapping, touching, clipped at the canvas edge and empty, put on a canvas, must give
// the same pixels and the same stats (hits, peak, union box) as the union image. A control shifts one mask's
// value and must fail.
//   node characters/proto/shadow_test.mjs        (exits non-zero on any difference)
globalThis.ImageData = class { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4); } };
class Ctx { constructor(c) { this.canvas = c; } putImageData(img, x, y, dx = 0, dy = 0, dw = img.width, dh = img.height) { const c = this.canvas; for (let r = dy; r < dy + dh; r++) for (let q = dx; q < dx + dw; q++) for (let k = 0; k < 4; k++) c.px[((y + r) * c.width + x + q) * 4 + k] = img.data[(r * img.width + q) * 4 + k]; }
  drawImage(src, sx, sy, sw, sh, dx, dy) { const c = this.canvas; if (this.op !== "destination-over") throw new Error("expected destination-over");
    for (let r = 0; r < sh; r++) for (let q = 0; q < sw; q++) { const o = ((dy + r) * c.width + dx + q) * 4, i = ((sy + r) * src.width + sx + q) * 4, a = src.px[i + 3]; if (!a) continue; if (c.px[o + 3]) throw new Error("two shadow images over one pixel"); for (let k = 0; k < 4; k++) c.px[o + k] = src.px[i + k]; } }
  save() {} restore() { this.op = null; } setTransform() {} set globalCompositeOperation(v) { this.op = v; } }
globalThis.OffscreenCanvas = class { constructor(w, h) { this.w = w; this.h = h; this.px = new Uint8ClampedArray(w * h * 4); } get width() { return this.w; } get height() { return this.h; } set width(v) { this.w = v; this.px = new Uint8ClampedArray(this.w * this.h * 4); } set height(v) { this.h = v; this.px = new Uint8ClampedArray(this.w * this.h * 4); } getContext() { return (this.ctx ||= new Ctx(this)); } };
const { queueMask } = await import("../runtime/groundshadow.mjs");
let fails = 0; const expect = (ok, msg) => { console.log((ok ? "ok   " : "FAIL ") + msg); if (!ok) fails++; };
const INK = [8, 4, 10];
let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const blob = (x0, y0, w, h, k = 1) => { const mask = new Float32Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const u = (x + 0.5) / w - 0.5, v = (y + 0.5) / h - 0.5; mask[y * w + x] = Math.max(0, k * (0.6 - Math.hypot(u, v) * 1.3) + 0.05 * rnd()); } return { x0, y0, w, h, mask, box: [x0, y0, x0 + w, y0 + h], stat: {} }; };
// the reference: one image over the union, as before the clusters
function reference(fms, W, H) {
  const px = new Uint8ClampedArray(W * H * 4), M = new Float32Array(W * H); let hits = 0, peak = 0, x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (const m of fms) if (m.w && m.h) { x0 = Math.min(x0, m.x0); y0 = Math.min(y0, m.y0); x1 = Math.max(x1, m.x0 + m.w); y1 = Math.max(y1, m.y0 + m.h); }
  x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(W, x1); y1 = Math.min(H, y1);
  for (const m of fms) for (let yy = 0; yy < m.h; yy++) for (let xx = 0; xx < m.w; xx++) { const X = m.x0 + xx, Y = m.y0 + yy; if (X < x0 || X >= x1 || Y < y0 || Y >= y1) continue; const v = m.mask[yy * m.w + xx], o = M[Y * W + X]; if (v > o) { M[Y * W + X] = v; if (v > 0.01 && !(o > 0.01)) hits++; if (v > peak) peak = v; } }
  for (let i = 0; i < W * H; i++) { const a = Math.round(Math.min(1, M[i]) * 255); if (a) { px[i * 4] = INK[0]; px[i * 4 + 1] = INK[1]; px[i * 4 + 2] = INK[2]; px[i * 4 + 3] = a; } }
  return { px, hits, peak: +peak.toFixed(3), box: [x0, y0, x1 - x0, y1 - y0] };
}
async function run(fms, W, H, tamper = null) {
  const g = new OffscreenCanvas(W, H).getContext("2d");
  for (const m of fms) queueMask(g, m, 0, 0);
  await new Promise((r) => setTimeout(r, 0));
  const ref = reference(tamper ? fms.map((m, k) => (k === 0 ? { ...m, mask: m.mask.map((v) => v * 1.1) } : m)) : fms, W, H), S = globalThis.__lwShadowStats;
  let bad = 0; for (let i = 0; i < W * H * 4; i++) if (g.canvas.px[i] !== ref.px[i]) bad++;
  return { bad, stats: S.pixels === ref.hits && S.peak === ref.peak && S.box.join() === ref.box.join() };
}
const scenes = {
  "nine figures far apart": [...Array(9)].map((_, k) => blob(40 + k * 130, 300 + (k % 3) * 90, 90, 40)),
  "overlapping chain and a lone one": [blob(100, 100, 120, 50), blob(180, 120, 120, 50), blob(280, 90, 100, 60), blob(900, 500, 80, 40)],
  "touching edges (not overlapping)": [blob(100, 100, 60, 30), blob(160, 100, 60, 30), blob(100, 130, 60, 30)],
  "clipped at the canvas edges, one empty": [blob(-30, -10, 80, 40), blob(1240, 690, 80, 50), { ...blob(500, 300, 1, 1), w: 0, h: 0, mask: new Float32Array(0) }, blob(600, 350, 70, 30, 0.004)],
  "a crowd stacked in one spot": [...Array(6)].map((_, k) => blob(400 + k * 9, 300 + k * 4, 100, 45)),
};
for (const [name, fms] of Object.entries(scenes)) { const r = await run(fms, 1280, 720); expect(r.bad === 0 && r.stats, `${name}: ${r.bad} bytes differ from the union image; stats ${r.stats ? "equal" : "DIFFER"}`); }
{ const r = await run(scenes["overlapping chain and a lone one"], 1280, 720, true); expect(r.bad > 0, `control (one mask 10% darker in the reference) differs: ${r.bad} bytes`); }
if (fails) { console.log(`${fails} failed`); process.exit(1); }
