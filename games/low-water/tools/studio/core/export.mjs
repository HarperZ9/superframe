// Export into the game: portrait sets per speaker, mood and era, in the shape the talk panel reads
// (game/engine/ui/portrait.mjs: index who -> mood -> light -> path), 640 x 800 with the eyes at 40 percent
// (the rendering lead's box), opaque (the painted
// ground is part of the picture). Ids carry the era, `ned@e2`; the slice's era (2) also writes the plain
// id. Each set has a manifest: the reference that made it, its layers, and who painted what.
// Writing goes through a sink, so Node writes files and the browser posts them to the Studio server.
//   flatten(doc, { mood }) -> Float32Array    resample(rgba, w, h, W, H)    authorship(doc) -> shares
//   exportPortrait(doc, { mood, light, sink, root }) -> { id, file, entry }    mergeIndex(index, entries)
import { composite } from "./doc.mjs";
import { onGame } from "./game.mjs";
import { showMood } from "./variants.mjs";

// the export's root, size and default era are the game's (games/<name>.mjs export and portrait.out)
export let SLICE_ERA, OUT_W, OUT_H, ROOT;
onGame((g) => { SLICE_ERA = g.export.defaultEra; [OUT_W, OUT_H] = g.portrait.out; ROOT = g.export.root; });
export const idOf = (person, era) => `${person}@e${era}`;

export function flatten(doc, { mood = "neutral" } = {}) {
  showMood(doc, mood === "neutral" ? null : mood);
  return Float32Array.from(composite(doc));
}
// area resample (box filter of the source footprint): clean at any ratio, 768 -> 640 included
export function resample(src, w, h, W, H) {
  const out = new Float32Array(W * H * 4), fx = w / W, fy = h / H;
  for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
    const x0 = X * fx, x1 = x0 + fx, y0 = Y * fy, y1 = y0 + fy, acc = [0, 0, 0, 0]; let wt = 0;
    for (let y = Math.floor(y0); y < Math.ceil(y1); y++) for (let x = Math.floor(x0); x < Math.ceil(x1); x++) {
      const a = (Math.min(x1, x + 1) - Math.max(x0, x)) * (Math.min(y1, y + 1) - Math.max(y0, y)); if (a <= 0) continue;
      const i = (Math.min(h - 1, y) * w + Math.min(w - 1, x)) * 4; for (let k = 0; k < 4; k++) acc[k] += src[i + k] * a; wt += a;
    }
    for (let k = 0; k < 4; k++) out[(Y * W + X) * 4 + k] = acc[k] / wt;
  }
  return out;
}
export function toBytes(rgba, n) {
  const d = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n * 4; i++) d[i] = (i & 3) === 3 ? 255 : Math.round(Math.max(0, Math.min(1, rgba[i])) * 255);
  return d;
}
// who painted what: for each figure pixel, the author of the topmost visible paint layer that covers it
// (alpha over a half, after its mask, its group's opacity and the region blend); a glaze changes hue, not
// what is painted, so it is counted apart (glazed) and the layer under it is the author. Strokes by author.
export function authorship(doc, figure = null) {
  const vis = doc.layers.filter((l) => l.visible && l.kind !== "mask" && l.kind !== "form" && doc.groups?.[l.group]?.visible !== false).reverse(), px = {}, n = doc.w * doc.h; let total = 0, glazed = 0;
  const mask = vis.map((l) => doc.layers.find((k) => k.kind === "mask" && k.target === l.id && k.visible)?.rgba), f = doc.blendField;
  const eff = (k, i) => { const l = vis[k]; return l.rgba[i * 4 + 3] * l.opacity * (doc.groups?.[l.group]?.opacity ?? 1) * (mask[k] ? mask[k][i * 4 + 3] : 1) * (f && !l.locked && l.author !== "procedural" ? f[i] : 1); };
  for (let i = 0; i < n; i++) {
    if (figure && !figure[i]) continue; total++; let a = "none", g = false;
    for (let k = 0; k < vis.length; k++) { if (eff(k, i) <= 0.5) continue; if (vis[k].kind === "glaze") { g = true; continue; } a = vis[k].author; break; }
    px[a] = (px[a] || 0) + 1; if (g) glazed++;
  }
  const strokes = {}; for (const s of doc.strokes) { const who = s.op && s.op !== "stroke" ? `${s.author || "human"} ${s.op}` : s.author; strokes[who] = (strokes[who] || 0) + 1; }
  return { pixels: Object.fromEntries(Object.entries(px).map(([k, v]) => [k, +(v / Math.max(1, total)).toFixed(4)])), glazed: +(glazed / Math.max(1, total)).toFixed(4), strokes };
}

export async function exportPortrait(doc, { mood = "neutral", light = "paraffin", sink, root = ROOT, figure = null }) {
  const info = doc.meta.info?.[mood] || null, k = OUT_W / doc.w, at = (v) => Math.round(v * k);
  const id = idOf(doc.meta.person, doc.meta.era), img = resample(flatten(doc, { mood }), doc.w, doc.h, OUT_W, OUT_H);
  const file = `${root}/${id}/${mood}-${light}.png`;
  await sink.image(file, OUT_W, OUT_H, toBytes(img, OUT_W * OUT_H));
  const entry = { id, plain: doc.meta.era === SLICE_ERA ? doc.meta.person : null, mood, light, file,
    heads: doc.meta.heads || "old",   // the box places a speaking mouth and a blink from these (design/state/painted.md)
    eyes: info?.eyes?.map((e) => ({ cx: at(e.cx), cy: at(e.cy), wd: +(e.wd * k).toFixed(1), ht: +(e.ht * k).toFixed(1), opened: e.opened })) ?? null,
    mouth: info?.mouth ? { x0: at(info.mouth.x0), x1: at(info.mouth.x1), y: at(info.mouth.y) } : null,
    made: { who: doc.meta.who, age: doc.meta.age, era: doc.meta.era, cam: doc.meta.cam, key: doc.meta.key, seed: doc.meta.seed, work: [doc.w, doc.h] },
    layers: doc.layers.map((l) => ({ name: l.name, kind: l.kind, author: l.author, mood: l.mood || null })), authorship: authorship(doc, figure) };
  return { id, file, entry };
}
export function mergeIndex(index, entries) {
  const out = structuredClone(index || {});
  for (const e of entries) for (const k of [e.id, e.plain].filter(Boolean)) {
    out[k] = out[k] || {}; out[k][e.mood] = { ...(out[k][e.mood] || {}), [e.light]: e.file };
  }
  return out;
}
export function mergeManifest(man, entries) {
  const out = structuredClone(man || { portraits: {} });
  for (const e of entries) out.portraits[`${e.id}/${e.mood}-${e.light}`] = e;
  return out;
}
