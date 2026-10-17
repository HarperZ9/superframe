// Post chain for the spectral key frames: tone to display, paint over with the engine's painter,
// restore the light above display range on bright pixels, then the engine's lens suite.
// Engine passes used: paintover/painter.mjs (paint), lens/lens.mjs + lens/params.mjs (lens),
// lab/gpu-kit.mjs labEncode8 (display encode). Original glue code.
import { rn } from "./rn.mjs";

const E = {
  painter: await import(rn("web/shaders/paintover/painter.mjs")),
  lens: await import(rn("web/shaders/lens/lens.mjs")),
  params: await import(rn("web/shaders/lens/params.mjs")),
  kit: await import(rn("web/shaders/lab/gpu-kit.mjs")),
  png: await import(rn("tools/shaders/png.mjs")),
};
export const { writePng, readPng } = E.png;
export const encode = (f, gain) => E.kit.labEncode8(f, gain);
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

// Paint over a display frame (RGBA8) with the scene's ids and normals. Returns RGBA8.
export function paintOver(rgba8, w, h, ids, nrm, opt = {}) {
  const rgb = new Float32Array(w * h * 3);
  for (let i = 0; i < w * h; i++) for (let c = 0; c < 3; c++) rgb[i * 3 + c] = rgba8[i * 4 + c] / 255;
  return E.painter.paint({ w, h, rgb }, { id: ids, N: nrm }, opt).rgba8;
}
// Back to scene-linear light for the lens: invert the display encode; where the source light was
// brighter than the painting holds (lamps), keep the source energy so the lens sees the lamp.
export function reHdr(painted, src, gain, keepAbove = 1.2) {
  const n = src.width * src.height, d = new Float64Array(n * 4);
  for (let i = 0; i < n; i++) {
    const L = 0.2126 * src.data[i * 4] + 0.7152 * src.data[i * 4 + 1] + 0.0722 * src.data[i * 4 + 2];
    for (let c = 0; c < 3; c++) { const l = Math.min(0.995, toLin(painted[i * 4 + c] / 255)), v = -Math.log(1 - l) / gain; d[i * 4 + c] = L > keepAbove ? Math.max(v, src.data[i * 4 + c]) : v; }
    d[i * 4 + 3] = 1;
  }
  return { width: src.width, height: src.height, data: d };
}
export function lensPass(frame, hour, body = {}) {
  const p = { ...E.params.lensAtHour(hour), ...body }, plan = E.lens.resolveLens(p, { width: frame.width, height: frame.height }), src = E.lens.extractSources(plan, frame);
  return { out: E.lens.runLens(plan, frame, E.lens.prepareSources(plan, src.list), src.keep), sources: src.list.length };
}
// Display grain and a soft vignette in display space (deterministic). Applied last.
export function finish(rgba8, w, h, { grain = 0.03, vignette = 0.35, seed = 7 } = {}) {
  const o = new Uint8ClampedArray(rgba8);
  let s = seed >>> 0; const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, u = (x / w - 0.5) * 1.6, v = (y / h - 0.5) * 1.6, vg = 1 - vignette * Math.pow(Math.min(1, u * u + v * v), 1.4), g = 1 + grain * (rnd() + rnd() - 1);
    for (let c = 0; c < 3; c++) o[i + c] = rgba8[i + c] * vg * g;
  }
  return o;
}
// Rain streaks lit by the frame itself (display space): bright behind lamps, faint elsewhere.
export function rainOver(rgba8, w, h, { amount = 0.5, slant = 0.18, seed = 3 } = {}) {
  const o = new Uint8ClampedArray(rgba8), hash = (a) => { let x = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); return ((x ^ (x >>> 16)) >>> 0) / 4294967296; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const col = x + Math.floor(y * slant), r = hash(col * 977 + seed); if (r > 0.16) continue;
    const len = 0.05 * h, ph = hash(col * 131 + seed + 7), u = y / len + ph * 9, f = u - Math.floor(u); if (f > 0.3) continue;
    const i = (y * w + x) * 4, lum = (o[i] + o[i + 1] + o[i + 2]) / 765, k = amount * (1 - f / 0.3) * (0.15 + 0.85 * lum * lum);
    for (let c = 0; c < 3; c++) o[i + c] = o[i + c] + (235 - o[i + c]) * k * 0.6;
  }
  return o;
}
