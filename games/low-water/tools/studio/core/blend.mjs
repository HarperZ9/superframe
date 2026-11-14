// The blend between the underpainting and the paint, chosen per region (the author, 2026-10-21: "a cool
// combination of both"). Each region is a rule on the reference (masks.mjs); its value, 0 to 1, scales
// every painted layer (author human or script) where the region lies, so 0 shows the underpainting's own
// strokes there and 1 shows the paint at full strength. The eyes and mouth sit over the face regions.
// A change is a record in the painting's log, so the rebuild replays it in its place.
//   REGIONS   blendField(doc) -> Float32Array | null   setBlend(doc, region, value, { history }) -> record
import { ruleWeights } from "./masks.mjs";
import { IDS } from "./ids.mjs";
import { composite } from "./doc.mjs";
import { pushOp } from "./history.mjs";

const SKIN = [...IDS.skin, ...IDS.lip];
export const REGIONS = {
  "face, light side": { kind: "lit", ids: SKIN, lo: 0.2, hi: 0.45, soft: 3 },
  "face, shadow side": { kind: "lit", ids: SKIN, lo: 0.2, hi: 0.45, invert: true, soft: 3 },
  "hair and hat": { kind: "ids", ids: [...IDS.hair, ...IDS.brow, ...IDS.hat], soft: 2 },
  "clothes": { kind: "ids", ids: [...IDS.coat, ...IDS.collar], soft: 2 },
  "ground": { kind: "ids", ids: [0], soft: 2 },
};
export const OVER = { "eyes and mouth": { kind: "features", ids: IDS.lip, eye: 1.6, grow: 3, soft: 4 } };
export const painted = (L) => L.kind !== "mask" && !L.locked && L.author !== "procedural";
const valuesOf = (doc) => doc.meta.blend || (doc.meta.blend = {});

// the field from the region weights (cached per reference), or null when every region is at 1
export function blendField(doc) {
  const v = valuesOf(doc), all = { ...REGIONS, ...OVER };
  if (!doc.ref || Object.keys(all).every((k) => (v[k] ?? 1) === 1)) return (doc.blendField = null);
  const W = doc._regionW || (doc._regionW = Object.fromEntries(Object.entries(all).map(([k, r]) => [k, ruleWeights(r, doc.ref)])));
  const n = doc.w * doc.h, f = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0, ws = 0; for (const k of Object.keys(REGIONS)) { const w = W[k][i]; s += w * (v[k] ?? 1); ws += w; }
    let b = ws > 1e-4 ? s / ws : 1; for (const k of Object.keys(OVER)) b += (W[k][i]) * ((v[k] ?? 1) - b);
    f[i] = b;
  }
  return (doc.blendField = f);
}
export function setBlendValue(doc, region, value) {
  if (!(region in REGIONS) && !(region in OVER)) throw new Error(`studio: no blend region "${region}"`);
  valuesOf(doc)[region] = +value; blendField(doc); composite(doc);
}
export function setBlend(doc, region, value, { history = null } = {}) {
  const prev = valuesOf(doc)[region] ?? 1, rec = { op: "blend", region, value: +value, prev };
  setBlendValue(doc, region, value);
  if (history) pushOp(history, rec, () => setBlendValue(doc, region, prev), () => setBlendValue(doc, region, value)); else doc.strokes.push(rec);
  return rec;
}
