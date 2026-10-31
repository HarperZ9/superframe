// SPDX-License-Identifier: FSL-1.1-MIT
// One way in for a view or tool: shapes, index fields, scenes, materials, world fields, frames and presets.
import { SH, GR, GROUPS } from "./shapes.js";
import { SCENES, sceneCode } from "./scenes.js";
import "./scatter.js"; // registers the patterns scene
import "./spectra.js"; // registers the metamer scene
import { MAT, MATERIAL_RECORDS } from "./materials.js";
import { FIELDS } from "./fields.js";
import { FRAMES } from "./frames.js";
import { PRESETS } from "./train.js";
import { PRESET_PROVENANCE } from "./constants.js";

export { MAT, PRESETS };
export const shape = (id) => (SH[id] ? { id, label: SH[id][0], body: SH[id][1] } : null);
export const shapes = () => Object.keys(SH).map(shape);
export const shapeGroups = () => GROUPS;
export const indexField = (id) => GR[id] || null;
export function registerShape(id, label, body, group = "Registered") {
  if (SH[id]) throw new Error(`shape ${id} is already registered`);
  if (!/\breturn\b/.test(body)) throw new Error(`shape ${id}: a body must return a distance`);
  SH[id] = [label, body];
  const g = GROUPS.find(([n]) => n === group);
  if (g) g[1].push(id);
  else GROUPS.push([group, [id]]);
}
export function unregisterShape(id) {
  delete SH[id];
  for (const g of GROUPS) g[1] = g[1].filter((v) => v !== id);
  for (let i = GROUPS.length - 1; i >= 0; i--) if (!GROUPS[i][1].length) GROUPS.splice(i, 1);
}
export const scene = (k) => SCENES[k] || null;
export const sceneProgram = (k) => sceneCode(k);
export const worldFields = () => Object.entries(FIELDS).map(([id, f]) => ({ id, ...f }));
export const materialRecord = (id) => MATERIAL_RECORDS[id] || null;
export const frames = () => FRAMES;
export const presetProvenance = (k) => PRESET_PROVENANCE[k] || null;
