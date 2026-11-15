// A Studio painting: a stack of layers over one canvas size, and the composite a person sees.
// Layer kinds: paint (oil laid over what is below), glaze (a transparent tint: blend "glaze" changes the
// hue and keeps the value below, kmGlaze; "multiply" darkens; "screen" lifts), mask (alpha only; clips
// the layer named in `target`). Every paint layer keeps a paint height per pixel, summed up the stack and
// lit by the key so impasto catches the light. Layers may share a group (doc.groups[name]: visible,
// opacity); painted layers are scaled by the per-region blend (blend.mjs) when one is set.
// Colours are display values 0..1, as the character renderer and the portrait painter write them.
//   createDoc(w, h) addLayer(doc, opts) composite(doc, rect?, opts) -> Float32Array rgba
import { mix as kmMix, glaze as kmGlaze } from "../../../game/engine/paint/km.mjs";
import { lum } from "./passes.mjs";

let NEXT = 1;
export function createDoc(w, h, meta = {}) {
  return { w, h, layers: [], active: null, meta: { ...meta }, strokes: [], out: new Float32Array(w * h * 4), flat: new Float32Array(w * h * 4), height: new Float32Array(w * h) };
}
// author: who laid the pixels ("procedural" for the underpainting, "human" for a person, "script" for a
// recorded stroke file); locked layers take no strokes (the underpainting is regenerated, never painted)
export function addLayer(doc, { name, kind = "paint", author = "human", opacity = 1, target = null, fill = null, locked = false, index = null, blend = null, group = null } = {}) {
  const n = doc.w * doc.h, L = { id: `L${NEXT++}`, name: name || `${kind} ${doc.layers.length + 1}`, kind, author, opacity, visible: true, locked, target, blend, group,
    rgba: new Float32Array(n * 4), height: kind === "paint" ? new Float32Array(n) : null };
  if (fill) for (let i = 0; i < n; i++) { L.rgba[i * 4] = fill[i * 4]; L.rgba[i * 4 + 1] = fill[i * 4 + 1]; L.rgba[i * 4 + 2] = fill[i * 4 + 2]; L.rgba[i * 4 + 3] = fill[i * 4 + 3] ?? 1; }
  if (index == null) doc.layers.push(L); else doc.layers.splice(index, 0, L);
  doc.active = L.id; doc.stale = true; return L;   // stale: the composite no longer shows the stack
}
export const layerById = (doc, id) => doc.layers.find((l) => l.id === id) || null;
export function removeLayer(doc, id) {
  doc.layers = doc.layers.filter((l) => l.id !== id && l.target !== id); doc.stale = true;
  if (doc.active === id) doc.active = doc.layers.at(-1)?.id ?? null;
}
export function moveLayer(doc, id, by) {
  const i = doc.layers.findIndex((l) => l.id === id), j = Math.max(0, Math.min(doc.layers.length - 1, i + by));
  if (i < 0 || i === j) return; const [L] = doc.layers.splice(i, 1); doc.layers.splice(j, 0, L); doc.stale = true;
}

const full = (doc) => ({ x0: 0, y0: 0, x1: doc.w, y1: doc.h });
function maskFor(doc, L) {
  const m = doc.layers.find((k) => k.kind === "mask" && k.target === L.id && k.visible);
  return m ? m.rgba : null;
}
// one pixel of one layer over the running colour c (in place)
const tmp = [0, 0, 0], mixOut = [0, 0, 0];
// glaze modes: "glaze" keeps the value below (pigment), "multiply" darkens by the tint, "screen" lifts
function glazeMode(L, c, t, a) {
  if (L.blend === "multiply") for (let k = 0; k < 3; k++) mixOut[k] = c[k] * (1 - a + a * t[k]);
  else if (L.blend === "screen") for (let k = 0; k < 3; k++) mixOut[k] = c[k] + (1 - c[k]) * t[k] * a;
  else kmGlaze(c, t, Math.min(1, a), 0, mixOut);
}
function over(L, mask, i, c, f) {
  const a = L.rgba[i * 4 + 3] * L.opacity * f * (mask ? mask[i * 4 + 3] : 1); if (a <= 0) return 0;
  tmp[0] = L.rgba[i * 4]; tmp[1] = L.rgba[i * 4 + 1]; tmp[2] = L.rgba[i * 4 + 2];
  if (L.kind === "glaze") glazeMode(L, c, tmp, a);
  else if (a >= 1) { mixOut[0] = tmp[0]; mixOut[1] = tmp[1]; mixOut[2] = tmp[2]; }
  else for (let k = 0; k < 3; k++) mixOut[k] = c[k] * (1 - a) + tmp[k] * a;
  c[0] = mixOut[0]; c[1] = mixOut[1]; c[2] = mixOut[2]; return a;
}

// the whole stack over a rect: colour into doc.out, summed paint height into doc.height
export function composite(doc, rect = full(doc), { relief = 0.7, value = false, key = doc.meta.keyDir || [-0.6, 0.3, 0.74] } = {}) {
  if (rect.x0 === 0 && rect.y0 === 0 && rect.x1 === doc.w && rect.y1 === doc.h) doc.stale = false;
  const { w } = doc, c = [0, 0, 0], g = (l) => doc.groups?.[l.group], vis = doc.layers.filter((l) => l.visible && l.kind !== "mask" && l.kind !== "form" && g(l)?.visible !== false), masks = vis.map((l) => maskFor(doc, l));
  const gop = vis.map((l) => g(l)?.opacity ?? 1), field = doc.blendField, scaled = vis.map((l) => !!field && l.kind !== "mask" && !l.locked && l.author !== "procedural");
  for (let y = rect.y0; y < rect.y1; y++) for (let x = rect.x0; x < rect.x1; x++) {
    const i = y * w + x; c[0] = c[1] = c[2] = 0; let H = 0;
    for (let k = 0; k < vis.length; k++) { const L = vis[k], a = over(L, masks[k], i, c, gop[k] * (scaled[k] ? field[i] : 1)); if (a > 0 && L.height) H = H * (1 - Math.min(1, a) * 0.35) + L.height[i] * a; }
    doc.height[i] = H;
    for (let ch = 0; ch < 3; ch++) doc.flat[i * 4 + ch] = doc.out[i * 4 + ch] = c[ch];
    doc.flat[i * 4 + 3] = doc.out[i * 4 + 3] = 1;
  }
  if (relief > 0) lightRelief(doc, grow(doc, rect, 1), key, relief);
  if (value) for (let y = rect.y0; y < rect.y1; y++) for (let x = rect.x0; x < rect.x1; x++) { const i = (y * w + x) * 4, v = lum(doc.out[i], doc.out[i + 1], doc.out[i + 2]); doc.out[i] = doc.out[i + 1] = doc.out[i + 2] = v; }
  return doc.out;
}
export const grow = (doc, r, p) => ({ x0: Math.max(0, r.x0 - p), y0: Math.max(0, r.y0 - p), x1: Math.min(doc.w, r.x1 + p), y1: Math.min(doc.h, r.y1 + p) });

// impasto lit by the key: the height's slope turned to or from the light, and a small glint on ridges
// (reads doc.flat, writes doc.out, so lighting twice never compounds)
export function lightRelief(doc, rect, key, k) {
  const { w, h } = doc, H = doc.height, lx = key[0], ly = -key[1], lz = key[2] || 0.7;
  for (let y = rect.y0; y < rect.y1; y++) for (let x = rect.x0; x < rect.x1; x++) {
    const i = y * w + x, dx = (H[x < w - 1 ? i + 1 : i] - H[x > 0 ? i - 1 : i]) * 0.5, dy = (H[y < h - 1 ? i + w : i] - H[y > 0 ? i - w : i]) * 0.5;
    if (dx === 0 && dy === 0) continue;
    const nx = -dx * 2, ny = -dy * 2, inv = 1 / Math.hypot(nx, ny, 1), ndl = (nx * lx + ny * ly + lz) * inv, flat = lz;
    const s = 1 + k * (ndl - flat) * 0.6, glint = ndl > 0.96 ? (ndl - 0.96) * 4 * k : 0;
    for (let ch = 0; ch < 3; ch++) doc.out[i * 4 + ch] = Math.min(1, doc.flat[i * 4 + ch] * s + glint * 0.5);
  }
}
// the unlit composite at a point, for colour pickup (what a wet brush touches; the impasto's light is not paint)
export function sampleAt(doc, x, y, out = [0, 0, 0]) {
  const i = (Math.max(0, Math.min(doc.h - 1, y | 0)) * doc.w + Math.max(0, Math.min(doc.w - 1, x | 0))) * 4;
  out[0] = doc.flat[i]; out[1] = doc.flat[i + 1]; out[2] = doc.flat[i + 2]; return out;
}
export { kmMix };
