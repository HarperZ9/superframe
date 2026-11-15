// Brush presets: a few to start from, and the painter's own, saved per sitter beside the painting's source
// (characters/portraits-painted/src/<id>/presets.json), so a sitter's brushes come back with the sitter.
//   PRESETS   loadPresets(sink, dir) -> { name: brush }   savePreset(sink, dir, presets, name, brush)
import { LIGHT } from "./brush.mjs";

export const PRESETS = {
  "bristle round": { tool: "brush", size: 14, flow: 0.55, load: 1, pickup: 0.35, bristles: 22, spread: 0.9, impasto: 0.5, dry: 0.3, depletion: 0.012 },
  "soft blender": { tool: "brush", size: 22, flow: 0.3, load: 0.9, pickup: 0.6, bristles: 34, spread: 2.4, impasto: 0.15, dry: 0.1, depletion: 0.006, wetUnder: true },
  "rigger": { tool: "brush", size: 3, flow: 0.8, load: 1, pickup: 0.1, bristles: 6, spread: 1.6, impasto: 0.4, dry: 0.2, depletion: 0.02 },
  "light stroke": { tool: "brush", ...LIGHT },
  "palette knife": { tool: "knife", size: 26, flow: 0.8, load: 1, pickup: 0.5, impasto: 0.8, depletion: 0.01 },
  "glaze wash": { tool: "brush", size: 40, flow: 0.18, load: 1, pickup: 0, bristles: 30, spread: 3, impasto: 0, dry: 0, depletion: 0 },
};
const KEEP = ["tool", "size", "flow", "load", "pickup", "bristles", "spread", "impasto", "dry", "depletion", "light", "wetUnder", "sizeCurve", "spacing", "jitter"];
export async function loadPresets(sink, dir) {
  const own = await sink.readJson(`${dir}/presets.json`).catch(() => ({}));
  return { ...PRESETS, ...own };
}
export async function savePreset(sink, dir, presets, name, brush) {
  if (!name || !String(name).trim()) throw new Error("studio: a preset needs a name");
  const p = Object.fromEntries(KEEP.filter((k) => brush[k] !== undefined).map((k) => [k, brush[k]]));
  presets[name] = p;
  const own = Object.fromEntries(Object.entries(presets).filter(([k]) => !(k in PRESETS) || k === name));
  await sink.json(`${dir}/presets.json`, own); return p;
}
