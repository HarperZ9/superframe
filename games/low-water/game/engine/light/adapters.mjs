// Adapters: the light model in the exact shapes the three consumers already use, so each seam is a one-line change
// on the owner's side (design/state/light.md lists them). Nothing here draws.
//   drawerRig(at, cam, opt)        -> { rig, tone } | null    characters/runtime/fightdrawer.mjs rigAt's return shape
//   rulingLight(at)                -> [x, y, z] | null         paint/install.mjs's ruling-lamp direction (toward the light)
//   paintTerms(F, M, i, out)       -> { lightValue, family, terminator, warm, ruling, ao }   design/art/PAINT-LANGUAGE.md
//   paintTermsMap(F, M)            -> the same per sample as typed arrays
//   glyphCells(C, F, E, opt)       -> Float32Array rgb per glyph world cell, exposed for the hour (glyph/light.mjs bakeLight's shape)
//   clockExposure(E, F)            -> the eye's adaptation for the light now: how far a dark scene is lifted for type
import { cellsFromField } from "./consume.mjs";
import { mired } from "./kelvin.mjs";
import { KEY_SKY } from "./field.mjs";

const model = () => globalThis.__lwLightModel || null;
export function drawerRig(at, cam, { t } = {}) {
  const L = model(); if (!L || !L.ready()) return null;
  const R = L.rig(at, t, cam); if (!R) return null;
  return { rig: R.rig, tone: R.key.kind === "sodium" ? "sodium" : null, light: R };
}
export function rulingLight(at) {
  const L = model(); if (!L || !L.ready()) return null;
  const R = L.rig(at); return R && R.key.kind !== "sky" ? R.key.dir : null;
}
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
// family: 0 shadow .. 1 light, soft across the terminator and dropped where the key is blocked; warm: -1 cool .. 1 warm
// by the light's temperature in mired against a 4000 K neutral (2000 K is +1, 8000 K is -1)
export function paintTerms(F, M, i, out = {}) {
  const R = F.rec, E = F.E, s = R.side[i] / 127, soft = 0.25, sh = R.shadow[i] / 255;
  out.lightValue = 0.2126 * E[i * 3] + 0.7152 * E[i * 3 + 1] + 0.0722 * E[i * 3 + 2];
  out.family = clamp(0.5 + s / (2 * soft)) * (1 - 0.8 * sh);
  out.terminator = R.term[i] / 255;
  out.warm = clamp((mired(R.K[i] || 4000) - mired(4000)) / (mired(2000) - mired(4000)), -1, 1);
  out.ruling = R.key[i] === KEY_SKY ? -1 : R.key[i];
  out.ao = R.occ[i] / 255;
  return out;
}
export function paintTermsMap(F, M) {
  const n = F.n, o = { lightValue: new Float32Array(n), family: new Uint8Array(n), terminator: new Uint8Array(n), warm: new Int8Array(n), ruling: new Int16Array(n).fill(-1), ao: new Uint8Array(n) }, t = {};
  for (let i = 0; i < n; i++) {
    if (!Number.isFinite(F.N[i * 3])) continue; paintTerms(F, M, i, t);
    o.lightValue[i] = t.lightValue; o.family[i] = Math.round(t.family * 255); o.terminator[i] = Math.round(t.terminator * 255); o.warm[i] = Math.round(t.warm * 127); o.ruling[i] = t.ruling; o.ao[i] = Math.round(t.ao * 255);
  }
  return o;
}
// the eye adapts to the scene: the light at the brighter samples (the 80th percentile of value) is brought toward
// a target the type's tone curve was tuned for, lifting a dark night a long way and a bright day not at all;
// darks stay darks relative to the lit tenth, which is what the night square needs to read without turning to day
export function clockExposure(E, F, { target = 0.16, max = 8 } = {}) {
  const v = []; for (let i = 0; i < F.n; i += 5) if (Number.isFinite(F.N[i * 3])) v.push(0.2126 * E[i * 3] + 0.7152 * E[i * 3 + 1] + 0.0722 * E[i * 3 + 2]);
  v.sort((a, b) => a - b); const p80 = v.length ? v[Math.floor(v.length * 0.8)] : target;
  return clamp(target / Math.max(1e-4, p80), 1, max);
}
export function glyphCells(C, F, E = F.E, { exposure = null } = {}) {
  const k = exposure ?? clockExposure(E, F), out = cellsFromField(C, F, E);
  if (k !== 1) for (let i = 0; i < out.length; i++) out[i] *= k;
  out.exposure = k; return out;
}
