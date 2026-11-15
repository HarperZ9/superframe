// The Well House fire's flame kind (era 3 plates, pass 2, 2026-10-23). The shared "flame" emits as a tungsten window
// at 30 and paints white at the fire plate's gain; this one emits on the sodium curve, a low deep orange, at an
// intensity the grade can hold, so the tongues read as fire and not as white blobs (era3.md: slow swells, no strobe,
// no saturated red). Registered into kit/ids.mjs's tables on import, like render/props/e4_kinds.mjs.
import { KIND, ID, BY_ID } from "../kit/ids.mjs";
import "./kinds.mjs";
function emitter(name, mat, emit) {
  if (ID[name] != null) return ID[name];
  const k = { id: BY_ID.length, name, mat, scale: 0, wet: 0, tone: 0.9, cls: 6, flags: "e", emit };
  KIND[name] = k; ID[name] = k.id; BY_ID[k.id] = k; return k.id;
}
// the body of a tongue, and its thinner, dimmer tip
export const FLAME3 = emitter("e3flame", "grey", ["sodium", 1.2, "flame"]);
export const FLAME3_TIP = emitter("e3flametip", "grey", ["sodium", 0.7, "flame"]);
// fix pass, 2026-10-24: the tongues read as pale pins (FLAME3 and FLAME3_TIP above are kept registered so later ids do
// not move, and no longer used). A fire reads by a pale root, orange bodies and dark licks at the tips: core, body, lick.
// None is saturated red (R / (R + G + B) stays under WCAG 2.2's 0.8), and a flicker that scales the light keeps each
// colour's chromaticity, so the fire cannot make a red transition (cine/redflash.mjs).
export const FLAME3_CORE = emitter("e3flamecore", "grey", ["window", 0.9, "flame"]);
export const FLAME3_BODY = emitter("e3flamebody", "grey", ["sodium", 0.55, "flame"]);
export const FLAME3_LICK = emitter("e3flamelick", "grey", ["sodium", 0.16, "flame"]);
// one flame kind for the whole fire (2026-10-24): three kinds made three paint regions, and the ink drew their borders
// as bands through the flames. This one emits by height above the fire's floor y0 over a flame height h: a pale
// tungsten root, an orange sodium body, a dim sodium lick, so the painter blends the bands with no line between them.
export function flameKind(y0, h) {
  const name = `e3fire_${y0.toFixed(2)}`; if (ID[name] != null) return ID[name];
  const k = { id: BY_ID.length, name, mat: "grey", scale: 0, wet: 0, tone: 0.9, cls: 6, flags: "e", emit: ["sodium", 0.55, "flame"], detail: (P, N, V) => {
    const t = (P[1] - y0) / h, f = V.emit && "flame" in V.emit ? V.emit.flame : 1;
    const e = t < 0.22 ? { type: "window", I: 0.9 } : t < 0.6 ? { type: "sodium", I: 0.55 - 0.3 * (t - 0.22) } : { type: "sodium", I: Math.max(0.1, 0.42 - 0.5 * (t - 0.6)) };
    return { mat: "grey", scale: 0, wet: 0, emit: { type: e.type, I: e.I * f } };
  } };
  KIND[name] = k; ID[name] = k.id; BY_ID[k.id] = k; return k.id;
}
