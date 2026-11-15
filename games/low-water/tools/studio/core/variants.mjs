// Variants without repainting everything.
// Moods: a mood is a group of layers over the base portrait: an override (the mood's own underpainting,
// procedural and locked), a paint layer for a person, and masks that clip both to the region the mood
// changes (the brows, the eyes and lids, the mouth, and any pixel the mood's render moved). A painter
// repaints the region only; the rest of the face stays the one painted base.
// Age, era, camera, key: re-render the reference, warp every painted layer through the form
// (reproject.mjs), and flag what the form cannot carry.
//   moodRegion(baseRef, moodRef) -> Float32Array feather 0..1
//   addMoodOverride(doc, name, region, moodUnder) -> { layer, paint, masks }   showMood(doc, name)
//   reprojectDoc(doc, oldRef, newRef, newUnder) -> { doc, repaint: Uint8Array, flaggedShare }
import { dilate, blur1, lum } from "./passes.mjs";
import { addLayer, createDoc, composite } from "./doc.mjs";
import { correspond, warpLayer, repaintMask } from "./reproject.mjs";
import { footprint, reshapes } from "./liquify.mjs";

const FEATURES = new Set([15, 16, 26, 28]);   // eye, lip, brow, white
export function moodRegion(baseRef, moodRef, { grow = 0.018, feather = 0.008 } = {}) {
  const { w, h } = moodRef.G, n = w * h, m = new Uint8Array(n), A = baseRef.colour, B = moodRef.colour;
  for (let i = 0; i < n; i++) {
    const d = Math.abs(lum(A[i * 4], A[i * 4 + 1], A[i * 4 + 2]) - lum(B[i * 4], B[i * 4 + 1], B[i * 4 + 2]));
    if (FEATURES.has(moodRef.G.id[i]) || FEATURES.has(baseRef.G.id[i]) || (d > 0.04 && moodRef.G.id[i])) m[i] = 1;
  }
  const g = dilate(m, w, h, Math.max(2, Math.round(w * grow))), f = blur1(Float32Array.from(g), w, h, Math.max(1, Math.round(w * feather)));
  return f;
}
export function addMoodOverride(doc, name, region, moodUnder) {
  const n = doc.w * doc.h, fill = new Float32Array(n * 4), mk = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++) fill[i * 4 + k] = moodUnder[i * 4 + k];
    fill[i * 4 + 3] = region[i] > 0.01 ? 1 : 0; mk[i * 4 + 3] = region[i];
  }
  const layer = addLayer(doc, { name: `mood: ${name}`, kind: "paint", author: "procedural", locked: true, fill });
  const paint = addLayer(doc, { name: `mood: ${name} paint`, kind: "paint", author: "human" });
  const masks = [layer, paint].map((t) => addLayer(doc, { name: `${t.name} mask`, kind: "mask", author: "procedural", locked: true, target: t.id, fill: mk }));
  for (const L of [layer, paint, ...masks]) L.mood = name;
  doc.active = paint.id;
  return { layer, paint, masks };
}
// one mood visible at a time (neutral: none); the paint layer over a mood is the painter's, kept for all
export function showMood(doc, name) {
  for (const L of doc.layers) if (L.mood) L.visible = L.mood === name;
  composite(doc);
}
export const moodsOf = (doc) => [...new Set(doc.layers.filter((l) => l.mood).map((l) => l.mood))];

// a doc for another reference: the new underpainting below, every other layer warped through the form
export function reprojectDoc(doc, oldRef, newRef, newUnder, opts = {}) {
  const corr = correspond(oldRef, newRef, opts), out = createDoc(newRef.G.w, newRef.G.h, { ...doc.meta, ...newRef.meta, from: doc.meta.who });
  const paintedOld = new Uint8Array(doc.w * doc.h);
  for (const L of doc.layers) {
    if (L.name === "underpainting") { addLayer(out, { name: L.name, author: "procedural", locked: true, fill: newUnder }); continue; }
    const wl = warpLayer(L, corr), nl = addLayer(out, { name: L.name, kind: L.kind, author: L.author, opacity: L.opacity, locked: L.locked });
    nl.rgba.set(wl.rgba); if (nl.height && wl.height) nl.height.set(wl.height); nl.mood = L.mood; nl.visible = L.visible;
    if (L.author !== "procedural" && L.kind === "paint") for (let i = 0; i < paintedOld.length; i++) if (L.rgba[i * 4 + 3] > 0.05) paintedOld[i] = 1;
  }
  for (const L of out.layers) if (L.kind === "mask") { const src = doc.layers[out.layers.indexOf(L)]; const t = src && doc.layers.find((k) => k.id === src.target); L.target = t ? out.layers[doc.layers.indexOf(t)].id : null; }
  const repaint = repaintMask(corr, paintedOld); let flagged = 0, fig = 0;
  // a liquify or transform reshaped the paint against the old reference, so where it acted the carried
  // paint is checked too (the new underpainting is not reshaped)
  for (const r of doc.strokes.filter(reshapes)) { const fp = footprint(r, doc.w, doc.h); for (let i = 0; i < repaint.length; i++) { const x = Math.min(doc.w - 1, Math.round(((i % out.w) * doc.w) / out.w)), y = Math.min(doc.h - 1, Math.round((((i / out.w) | 0) * doc.h) / out.h)); if (fp[y * doc.w + x] && newRef.G.id[i]) repaint[i] = 1; } }
  for (let i = 0; i < repaint.length; i++) { if (newRef.G.id[i]) fig++; if (repaint[i]) flagged++; }
  out.meta.repaint = repaint; out.active = out.layers.at(-1)?.id ?? null; composite(out);
  return { doc: out, corr, repaint, flaggedShare: fig ? flagged / fig : 0 };
}
