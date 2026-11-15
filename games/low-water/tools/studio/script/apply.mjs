// Lay the scripted paint-over on a sitting: add its layers in painting order under the person's own
// "paint" layer, clip each pass to its form (masks from the reference, a couple of pixels of spill, as a
// careful painter keeps a pass to its shape), generate the strokes and replay them through the brush
// engine. Shared by the command line (bin/portrait.mjs) and the browser (the Studio's script button).
//   applyScript(sitting) -> { strokes, layers }
import { addLayer, composite } from "../core/doc.mjs";
import { replay } from "../core/stroke.mjs";
import { maskFill } from "../core/masks.mjs";
import { landmarks, IDS } from "./landmarks.mjs";
import { skinStrokes, eyeStrokes, featureStrokes } from "./face.mjs";
import { groundStrokes, clothStrokes, lightStrokes } from "./scene.mjs";
import { glazeStrokes, keyStrokes } from "./light.mjs";
import { planeGeometry, formStrokes } from "./planes.mjs";
import { planeLight, fillStrokes } from "./planelight.mjs";
import { cleanupStrokes } from "./cleanup.mjs";
import { formCoverage } from "../core/form.mjs";

// full: the first paint-over, which restates the whole figure. targeted (the default since the author's
// note of 2026-10-21): eyes, mouth, brows and nose, the shadow side's unity, the cloth's folds and a few
// edges of ground get paint; the light side keeps the underpainting's strokes under a warm glaze, with a
// few strokes of the light-stroke brush added the way they were laid.
export const MODES = {
  full: ["ground", "cloth", "skin", "features", "shade", "eyes", "lights"],
  targeted: ["ground", "cloth", "skin", "light glaze", "light strokes", "features", "shade", "eyes"],
};
export const SCRIPT_LAYERS = [...new Set(Object.values(MODES).flat())];
// a mask by rule (core/masks.mjs), so the source can rebuild it from doc.json
function clip(s, name, rule) {
  const doc = s.doc, L = doc.layers.find((l) => l.name === name);
  const m = addLayer(doc, { name: `${name} mask`, kind: "mask", author: "procedural", locked: true, target: L.id, fill: maskFill(rule, s.ref), index: doc.layers.indexOf(L) + 1 });
  m.rule = rule;
}
export function scriptStrokes(s, mode = "targeted") {
  const lm = landmarks(s.ref), pal = s.palette, r = s.ref;
  if (mode === "full") return { lm, strokes: [...groundStrokes(r, lm, pal), ...clothStrokes(r, lm), ...skinStrokes(r, lm, pal), ...featureStrokes(r, lm, pal), ...lightStrokes(r, lm), ...eyeStrokes(r, lm)] };
  return { lm, strokes: [...groundStrokes(r, lm, pal, { count: 25 }), ...clothStrokes(r, lm, { foldsOnly: true }), ...skinStrokes(r, lm, pal, { passes: ["shadow"] }),
    ...glazeStrokes(r, lm), ...keyStrokes(r, lm), ...featureStrokes(r, lm, pal), ...lightStrokes(r, lm, { accents: false }), ...eyeStrokes(r, lm)] };
}
export function applyScript(s, { mode = "targeted" } = {}) {
  const doc = s.doc, top = doc.layers.findIndex((l) => l.name === "paint"), names = MODES[mode];
  if (!names) throw new Error(`studio: no script mode "${mode}"`);
  if (doc.layers.some((l) => SCRIPT_LAYERS.includes(l.name))) throw new Error("studio: this painting already has the scripted layers");
  names.forEach((name, k) => addLayer(doc, { name, kind: name === "light glaze" ? "glaze" : "paint", author: "script", index: (top < 0 ? doc.layers.length : top) + k }));
  doc.layers.find((l) => l.name === "shade").opacity = 0.85;
  const cleaned = applyCleanup(s);   // the stray dark squares first, so every later pass picks up clean skin
  const { strokes, lm } = scriptStrokes(s, mode);
  if (mode === "targeted") { clip(s, "light glaze", { kind: "lit", ids: [...IDS.skin, ...IDS.lip], lo: 0.2, hi: 0.5, soft: 3 }); clip(s, "light strokes", { kind: "ids", ids: IDS.skin, soft: 1 }); }
  clip(s, "ground", { kind: "ids", ids: [0], soft: 1 }); clip(s, "skin", { kind: "ids", ids: [...IDS.skin, ...IDS.lip], grow: 2, soft: 1 });
  clip(s, "cloth", { kind: "ids", ids: IDS.coat, grow: 2, soft: 1 }); clip(s, "shade", { kind: "shade", lo: 0.3, hi: 0.02, foot: 0.62, soft: 4 });
  replay(doc, strokes, { history: s.history }); composite(doc);
  doc.active = doc.layers.find((l) => l.name === "paint")?.id ?? doc.active;
  return { strokes: strokes.length + cleaned.strokes, cleaned: cleaned.found, eyes: lm.eyes.length, layers: names, mode };
}
// the form override (script/planes.mjs): a form layer of painted planes and a paint layer of light laid
// from them, placed over the skin and under the features and eyes, the light clipped to the face
export function applyForm(s) {
  const doc = s.doc, after = doc.layers.findIndex((l) => l.name === "skin mask" || l.name === "skin"), at = after < 0 ? doc.layers.length - 1 : after + 1;
  if (doc.layers.some((l) => l.name === "form")) throw new Error("studio: this painting already has a form layer");
  // the lit planes as value and colour at partial opacity, so the underpainting's stroke light shows through;
  // the shadow side and the small turned-away planes over it at full strength, one mass
  addLayer(doc, { name: "form", kind: "form", author: "script", index: at }); addLayer(doc, { name: "form light", author: "script", index: at + 1, opacity: 0.45 });
  addLayer(doc, { name: "form shadow", author: "script", index: at + 2, opacity: 0.95 });
  const skinRule = { kind: "ids", ids: [...IDS.skin, ...IDS.lip], grow: 1, soft: 1 };
  clip(s, "form", { kind: "ids", ids: [...IDS.skin, ...IDS.lip], soft: 0 }); clip(s, "form light", skinRule); clip(s, "form shadow", skinRule);
  const lm = landmarks(s.ref), g = planeGeometry(s.ref, lm, doc); if (!g) throw new Error("studio: no face to block into planes (eyes, nose and face not found)");
  const strokes = [...formStrokes(s.ref, lm, g), ...planeLight(s.ref, lm, g, doc)]; replay(doc, strokes, { history: s.history }); composite(doc);
  for (let pass = 0; pass < 2; pass++) {   // fill what is still open, plane by plane, until under the check's 5 percent
    const c = formCoverage(doc, { list: true }); if (c.uncovered < 0.03) break;
    const fill = fillStrokes(s.ref, doc, c.list); replay(doc, fill, { history: s.history }); composite(doc); strokes.push(...fill);
  }
  doc.active = doc.layers.find((l) => l.name === "paint")?.id ?? doc.active;
  return { strokes: strokes.length, uncovered: formCoverage(doc).uncovered };
}
// the underpainting's stray dark squares covered (script/cleanup.mjs), on a "cleanup" layer just above it
export function applyCleanup(s) {
  const doc = s.doc; if (doc.layers.some((l) => l.name === "cleanup")) return { strokes: 0, found: 0 };
  const { strokes, found } = cleanupStrokes(s.ref, doc.layers[0].rgba, doc); if (!strokes.length) return { strokes: 0, found };
  addLayer(doc, { name: "cleanup", author: "script", index: 1 }); clip(s, "cleanup", { kind: "ids", ids: IDS.skin, grow: 1, soft: 1 });
  replay(doc, strokes, { history: s.history }); composite(doc);
  return { strokes: strokes.length, found };
}
