// The form override (the coordinator, 2026-10-22: a way past the sculpt). A "form" layer holds the face's
// planes as a person paints them: each pixel a direction the surface faces (brow ridge up and forward, the
// cheekbone's side plane turning away, the jaw's side and underside), chosen as a plane (yaw and pitch from
// the face's own forward) and painted with any brush. It is never shown itself. The light-stroke brush,
// where a form layer covers the canvas, loads its colour from these planes lit by the portrait's key (the
// scene's key when the portrait takes one), not from the sculpt's normals; the "Form light" view shows it.
//   planeNormal({ yaw, pitch }, facingDeg) -> world unit vector     formNormalAt(doc, i) -> [x, y, z] | null
//   formTones(ref) -> { light, shadow }     formLight(doc, n) -> [r, g, b]     formView(doc) -> Float32Array rgba
//   formCoverage(doc) -> { formed, open, uncovered }
import { mix as kmMix } from "../../../game/engine/paint/km.mjs";
import { IDS } from "./ids.mjs";

const rad = (d) => (d * Math.PI) / 180;
export const sitterFacing = (meta) => (meta.cam?.yaw ?? 34) - (meta.cam?.turn ?? 32);
// yaw: + toward the face's own right (the viewer's left when it faces you), pitch: + up
export function planeNormal({ yaw = 0, pitch = 0 }, facingDeg) {
  const F = rad(facingDeg), f = [Math.sin(F), 0, Math.cos(F)], r = [Math.cos(F), 0, -Math.sin(F)], a = rad(yaw), p = rad(pitch);
  const s = Math.sin(a) * Math.cos(p), u = Math.sin(p), c = Math.cos(a) * Math.cos(p);
  return [r[0] * s + f[0] * c, u, r[2] * s + f[2] * c];
}
export const encodeN = (n) => n.map((v) => v * 0.5 + 0.5);
const decodeN = (a, i) => { const n = [a[i * 4] * 2 - 1, a[i * 4 + 1] * 2 - 1, a[i * 4 + 2] * 2 - 1], m = Math.hypot(...n) || 1; return n.map((v) => v / m); };
export function formNormalAt(doc, i) {
  for (let k = doc.layers.length - 1; k >= 0; k--) {
    const L = doc.layers[k]; if (L.kind !== "form" || !L.visible) continue;
    if (L._maskN !== doc.layers.length) { L._mask = doc.layers.find((q) => q.kind === "mask" && q.target === L.id) || false; L._maskN = doc.layers.length; }
    const m = L._mask;   // a mask clips the planes too
    if (L.rgba[i * 4 + 3] * (m && m.visible ? m.rgba[i * 4 + 3] : 1) > 0.3) return decodeN(L.rgba, i);
  }
  return null;
}
// the sitter's skin in the light and in the shadow, from the reference (what the planes are lit with)
export function formTones(ref) {
  const skin = new Set(IDS.skin), L = ref.meta.keyDir, acc = { light: [0, 0, 0, 0], shadow: [0, 0, 0, 0] }, G = ref.G;
  for (let i = 0; i < G.w * G.h; i += 2) {
    if (!skin.has(G.id[i])) continue; const v = G.N[i * 3] * L[0] + G.N[i * 3 + 1] * L[1] + G.N[i * 3 + 2] * L[2];
    const t = v > 0.55 ? acc.light : v < 0.15 ? acc.shadow : null; if (!t) continue; for (let k = 0; k < 3; k++) t[k] += ref.colour[i * 4 + k]; t[3]++;
  }
  const avg = (t, fb) => (t[3] ? t.slice(0, 3).map((v) => v / t[3]) : fb);
  return { light: avg(acc.light, [0.86, 0.66, 0.52]), shadow: avg(acc.shadow, [0.3, 0.22, 0.22]) };
}
const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function formLight(doc, n) {
  const L = doc.meta.keyDir || [-0.6, 0.3, 0.74], m = Math.hypot(...L) || 1, tones = doc.meta.formTones || { light: [0.86, 0.66, 0.52], shadow: [0.3, 0.22, 0.22] };
  const v = (n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / m, t = ss(-0.05, 0.75, v);
  return kmMix(tones.shadow, tones.light, t).map((c) => Math.min(1, c * (0.85 + 0.3 * t)));
}
// the planes as lit, over the painting dimmed (for the "Form light" view)
export function formView(doc) {
  const out = new Float32Array(doc.w * doc.h * 4);
  for (let i = 0; i < doc.w * doc.h; i++) {
    const n = formNormalAt(doc, i), c = n ? formLight(doc, n) : [doc.out[i * 4] * 0.45, doc.out[i * 4 + 1] * 0.45, doc.out[i * 4 + 2] * 0.45];
    out[i * 4] = c[0]; out[i * 4 + 1] = c[1]; out[i * 4 + 2] = c[2]; out[i * 4 + 3] = 1;
  }
  return out;
}
// the check (the coordinator, 2026-10-22: no mosaic): of the pixels a form layer covers, the fraction left
// as holes, where the painted layers' own cover (after their masks; their opacity and the region blend are
// choices, not holes) adds up to less than half. Kept under about 5 percent.
export function formCoverage(doc, { list: want = false } = {}) {
  const list = want ? [] : null;
  const paint = doc.layers.filter((l) => l.visible && l.kind === "paint" && !l.locked && l.author !== "procedural");
  const masks = paint.map((l) => doc.layers.find((k) => k.kind === "mask" && k.target === l.id && k.visible)?.rgba); let formed = 0, open = 0;
  for (let i = 0; i < doc.w * doc.h; i++) {
    if (!formNormalAt(doc, i)) continue; formed++; let clear = 1;
    paint.forEach((l, k) => { clear *= 1 - Math.min(1, l.rgba[i * 4 + 3] * (masks[k] ? masks[k][i * 4 + 3] : 1)); });   // the coat's own cover: a layer at partial opacity is a choice, a hole is not
    if (1 - clear < 0.5) { open++; if (list) list.push(i); }
  }
  return { formed, open, uncovered: formed ? +(open / formed).toFixed(4) : 0, list };
}
