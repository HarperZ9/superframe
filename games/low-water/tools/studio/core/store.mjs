// The painting's source, kept in the repo: doc.json (the reference's parameters, the layer list),
// strokes.jsonl (every stroke with its author, one a line), one PNG per layer a person or a script painted
// (colour and alpha, and the paint height as a grey PNG), and the masks that clip those layers. The
// underpainting and the mood overrides are not stored: they are regenerated from the parameters, so the
// source stays small and honest about what was hand made.
//   saveSource(sitting, sink, dir)    loadSource(sink, dir, { members, timing, newSitting, moodSitting }) -> sitting
import { addLayer, composite } from "./doc.mjs";
import { maskFill } from "./masks.mjs";
import { replay } from "./stroke.mjs";
import { blendField } from "./blend.mjs";
import { unplaced } from "./placement.mjs";

const HSCALE = 4;   // paint height 0..4 stored in 0..255
const painted = (L) => L.kind !== "mask" && !L.locked && L.author !== "procedural";
const keep = (doc, L) => painted(L) || (L.kind === "mask" && painted(doc.layers.find((t) => t.id === L.target) || {}));
const fileOf = (name) => name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "layer";

export async function saveSource(s, sink, dir) {
  const { doc } = s, { repaint, ...meta } = doc.meta, layers = [];
  for (const L of doc.layers) {
    const e = { name: L.name, kind: L.kind, author: L.author, opacity: L.opacity, visible: L.visible, locked: L.locked, mood: L.mood || null, target: doc.layers.find((t) => t.id === L.target)?.name ?? null, rule: L.rule || null, blend: L.blend || null, group: L.group || null };
    if (keep(doc, L)) {
      e.file = `${fileOf(L.name)}.png`; e.heightFile = L.height ? `${fileOf(L.name)}.height.png` : null;
      const n = doc.w * doc.h, c = new Uint8ClampedArray(n * 4), hgt = new Uint8ClampedArray(n * 4);
      for (let i = 0; i < n * 4; i++) c[i] = Math.round(L.rgba[i] * 255);
      for (let i = 0; i < n; i++) { const v = Math.round(((L.height ? L.height[i] : 0) / HSCALE) * 255); hgt[i * 4] = hgt[i * 4 + 1] = hgt[i * 4 + 2] = v; hgt[i * 4 + 3] = 255; }
      await sink.image(`${dir}/${e.file}`, doc.w, doc.h, c); if (e.heightFile) await sink.image(`${dir}/${e.heightFile}`, doc.w, doc.h, hgt);
    }
    layers.push(e);
  }
  await sink.json(`${dir}/doc.json`, { format: "lw-studio-1", meta, layers, groups: doc.groups || {}, strokes: "strokes.jsonl" });
  await sink.text(`${dir}/strokes.jsonl`, doc.strokes.map((r) => JSON.stringify(r)).join("\n") + "\n");   // one stroke a line
  return { dir, layers: layers.filter((l) => l.file).length, strokes: doc.strokes.length };
}

// one stored layer back onto the doc: from its PNG when present, a mask from its rule otherwise;
// returns false when a painted layer's image is missing (the strokes will rebuild it)
async function restoreLayer(sink, dir, doc, s, e) {
  let L = doc.layers.find((l) => l.name === e.name);
  if (!L) { L = addLayer(doc, { name: e.name, kind: e.kind, author: e.author, locked: e.locked, target: doc.layers.find((t) => t.name === e.target)?.id ?? null }); L.mood = e.mood || undefined; }
  Object.assign(L, { opacity: e.opacity, visible: e.visible, blend: e.blend || null, group: e.group || null }); if (e.rule) L.rule = e.rule;
  if (!e.file) return true;
  const c = await sink.readImage(`${dir}/${e.file}`).catch(() => null);
  if (!c) { if (L.kind === "mask" && e.rule) { L.rgba.set(maskFill(e.rule, s.ref)); return true; } return false; }
  if (c.width !== doc.w || c.height !== doc.h) throw new Error(`studio: ${e.file} is ${c.width}x${c.height}, the painting is ${doc.w}x${doc.h}`);
  for (let i = 0; i < doc.w * doc.h * 4; i++) L.rgba[i] = c.data[i] / 255;
  const hg = e.heightFile ? await sink.readImage(`${dir}/${e.heightFile}`).catch(() => null) : null;
  if (L.height && hg) for (let i = 0; i < doc.w * doc.h; i++) L.height[i] = (hg.data[i * 4] / 255) * HSCALE;
  return L.height ? !!hg : true;
}
// Layer images are a cache (images stay out of git); the strokes are the record. When any painted
// layer's image is missing, or the sitter's reference changed (its fingerprint), every painted layer is
// cleared and the strokes are replayed in order on the reference as it is now.
export async function loadSource(sink, dir, { members, timing, newSitting, moodSitting }) {
  const src = await sink.readJson(`${dir}/doc.json`);
  if (src.format !== "lw-studio-1") throw new Error(`studio: ${dir}/doc.json is not a Studio source (format ${src.format})`);
  const m = src.meta, s = newSitting({ members, who: m.who, timing, cam: m.cam, key: m.key, w: m.w, h: m.h, seed: m.seed });
  for (const mood of [...new Set(src.layers.filter((l) => l.mood).map((l) => l.mood))]) moodSitting(s, mood);
  const doc = s.doc; let complete = true;
  s.refChanged = !!(m.refHash && s.ref?.meta?.refHash && m.refHash !== s.ref.meta.refHash);   // the cast's code moved under the painting
  for (const e of src.layers) complete = (await restoreLayer(sink, dir, doc, s, e)) && complete;
  const at = (L) => { const k = src.layers.findIndex((e) => e.name === L.name); return k < 0 ? 1e9 : k; };
  doc.layers.sort((a, b) => at(a) - at(b));
  const strokes = typeof src.strokes === "string" ? (await sink.readText(`${dir}/${src.strokes}`)).split("\n").filter(Boolean).map((l) => JSON.parse(l)) : src.strokes || [];
  doc.groups = src.groups || {};
  if (complete && !s.refChanged) { doc.strokes = strokes; doc.meta.blend = { ...(m.blend || {}) }; blendField(doc); composite(doc); return s; }
  for (const L of doc.layers) if (!L.locked && L.kind !== "mask") { L.rgba.fill(0); L.height?.fill(0); }
  doc.strokes = []; composite(doc); replay(doc, strokes); composite(doc); s.rebuilt = true;
  // a changed head is a rebuild on the re-baked reference, not a failure; what the replay could not place is flagged
  if (s.refChanged) { const u = unplaced(strokes, s.ref, doc.w, doc.h); s.unplaced = u.count; doc.meta.repaint = u.mask; doc.meta.unplaced = u.strokes.map((r) => strokes.indexOf(r)); }
  return s;
}
