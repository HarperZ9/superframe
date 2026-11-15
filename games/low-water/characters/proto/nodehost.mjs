// The browser pieces the figure drawer needs, faked for Node (characters/proto/perf_diff.mjs and
// tools/crowd-cards.mjs): fetch and Image read the checkout's files, a 2D context records every image put
// on the "screen" canvas (shots), a PNG reader. One checkout (root) with a fallback for files it lacks.
//   const H = await nodeHost({ root, fallback }); H.shots, H.imp(rel), H.readAny(rel), H.png(buf)
import { readFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";
import { pathToFileURL } from "node:url";
export async function nodeHost(opt) {
  const root = opt.root.replace(/\\/g, "/").replace(/\/?$/, "/"), fb = (opt.fallback || opt.root).replace(/\/?$/, "/");
  const fileOf = (u) => String(u).replace(/^\/engine\//, "game/engine/").replace(/^\//, "");
  async function readAny(rel) { try { return await readFile(root + rel); } catch { return readFile(fb + rel); } }
  globalThis.fetch = async (u) => {
    try { const b = await readAny(fileOf(u)); return { ok: true, status: 200, json: async () => JSON.parse(b.toString()), arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), text: async () => b.toString() }; }
    catch { return { ok: false, status: 404, json: async () => null }; }
  };
  // PNG (8-bit RGB or RGBA, not interlaced) to RGBA
  function png(buf) {
    let o = 8, w = 0, h = 0, ct = 0; const idat = [];
    while (o < buf.length) { const len = buf.readUInt32BE(o), type = buf.toString("ascii", o + 4, o + 8), data = buf.subarray(o + 8, o + 8 + len); if (type === "IHDR") { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9]; } else if (type === "IDAT") idat.push(data); else if (type === "IEND") break; o += 12 + len; }
    const raw = inflateSync(Buffer.concat(idat)), bpp = ct === 6 ? 4 : 3, stride = w * bpp, out = new Uint8ClampedArray(w * h * 4), prev = new Uint8Array(stride), cur = new Uint8Array(stride);
    for (let y = 0; y < h; y++) {
      const f = raw[y * (stride + 1)], s = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
      for (let x = 0; x < stride; x++) { const a = x >= bpp ? cur[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0; let v = s[x];
        if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1; else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
        cur[x] = v & 255; }
      for (let x = 0; x < w; x++) { out[(y * w + x) * 4] = cur[x * bpp]; out[(y * w + x) * 4 + 1] = cur[x * bpp + 1]; out[(y * w + x) * 4 + 2] = cur[x * bpp + 2]; out[(y * w + x) * 4 + 3] = bpp === 4 ? cur[x * bpp + 3] : 255; }
      prev.set(cur);
    }
    return { w, h, d: out };
  }
  globalThis.Image = class { set src(u) { this.u = u; } async decode() { const p = png(await readAny(fileOf(this.u))); this.naturalWidth = p.w; this.naturalHeight = p.h; this.px = p; } };
  globalThis.ImageData = class { constructor(a, b, c) { if (typeof a === "number") { this.width = a; this.height = b; this.data = new Uint8ClampedArray(a * b * 4); } else { this.data = a; this.width = b; this.height = c ?? a.length / 4 / b; } } };
  const shots = [];
  class Ctx2D {
    constructor(c) { this.canvas = c; }
    putImageData(img, x = 0, y = 0, dx = 0, dy = 0, dw = img.width, dh = img.height) {   // the dirty rectangle alone
      const d = new Uint8Array(dw * dh * 4); for (let r = 0; r < dh; r++) d.set(img.data.subarray(((dy + r) * img.width + dx) * 4, ((dy + r) * img.width + dx + dw) * 4), r * dw * 4);
      this.canvas.last = { d, w: dw, h: dh, x: x + dx, y: y + dy }; (this.canvas.puts ||= []).push(this.canvas.last); if (this.canvas.puts.length > 64) this.canvas.puts.shift(); }
    getImageData(x, y, w, h) { const s = this.canvas.px; return { data: s ? s.data : new Uint8ClampedArray(w * h * 4), width: w, height: h }; }
    drawImage(src, ...a) {
      if (src.px && a.length === 4 && this.canvas.label !== "screen") {   // a plate scaled into a luminance canvas: nearest sample
        const [, , W, H] = a, P = src.px, d = new Uint8ClampedArray(W * H * 4);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const sx = Math.min(P.w - 1, Math.floor(((x + 0.5) * P.w) / W)), sy = Math.min(P.h - 1, Math.floor(((y + 0.5) * P.h) / H)); d.set(P.d.subarray((sy * P.w + sx) * 4, (sy * P.w + sx) * 4 + 4), (y * W + x) * 4); }
        this.canvas.px = { data: d }; return;
      }
      if (this.canvas.label === "screen" && src.last) {
        if (a.length === 8) { const [sx, sy, sw, sh, dx, dy] = a, L = [...(src.puts || [src.last])].reverse().find((p) => sx >= p.x && sy >= p.y && sx + sw <= p.x + p.w && sy + sh <= p.y + p.h) || src.last, d = new Uint8Array(sw * sh * 4); for (let r = 0; r < sh; r++) d.set(L.d.subarray(((sy - L.y + r) * L.w + sx - L.x) * 4, ((sy - L.y + r) * L.w + sx - L.x + sw) * 4), r * sw * 4); shots.push({ label: `${shots.tag}:${this.op || "over"}`, d, w: sw, h: sh, x: dx, y: dy }); }
        else shots.push({ label: `${shots.tag}:${this.op || "over"}`, ...src.last, x: a[0], y: a[1] });
      }
    }
    set globalCompositeOperation(v) { this.op = v === "source-over" ? null : v; }
    get globalCompositeOperation() { return this.op || "source-over"; }
  }
  Ctx2D.prototype.save = function () { (this.stack ||= []).push(this.op); };
  Ctx2D.prototype.restore = function () { this.op = (this.stack || []).pop() ?? null; };
  for (const k of ["setTransform", "beginPath", "ellipse", "arc", "fill", "stroke", "moveTo", "lineTo", "closePath", "setLineDash", "scale", "fillRect", "clearRect"]) Ctx2D.prototype[k] = function () {};
  Ctx2D.prototype.createRadialGradient = () => ({ addColorStop() {} });
  globalThis.OffscreenCanvas = class { constructor(w, h) { this.width = w; this.height = h; } getContext() { return (this.ctx ||= new Ctx2D(this)); } };

  const imp = (rel) => import(pathToFileURL(root + rel).href);
  const { makeFightDrawer } = await imp("characters/runtime/fightdrawer.mjs");
  const { installPainter } = await imp("game/engine/paint/install.mjs");
  const { plateCtx } = await imp("characters/runtime/platectx.mjs");
  await installPainter({ hourOf: () => opt.hour ?? 23, base: pathToFileURL(root + "characters/").href });
  return { root, readAny, fileOf, png, shots, imp, makeFightDrawer, plateCtx };
}
