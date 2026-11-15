// Character light: a three-point model adapted per scene (design/art/LIGHT.md section 3). The key is the
// scene's real strongest source at the head; the fill is the room's bounce (the ground's light thrown back
// up, in the ground's colour, from the side away from the key); the rim is the strongest light behind the
// figure as the camera sees it, or, when none is there, a thin cool edge from the sky or the room's far
// light, just strong enough to part the figure from the ground. Also the face-light terminator, the eye
// catch-light and the subsurface warmth of ears, nose and fingers in the cold. Original code.
//   figureRig({ M, at, cam, t, F, groundRgb, cold }) -> { rig (characters/render/shade.mjs light()), key, fill,
//                                                         rim, terminator, catch, sss }
import { camBasis } from "../world/plateworld.mjs";
import { lum } from "./kelvin.mjs";
import { coneK } from "./train.mjs";
import { basis as geoBasis } from "./geo.mjs";

const HEAD = 1.55, norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const SOFT = { sun: 0.12, moon: 0.2, headlamp: 0.15, carbide: 0.2, sodium: 0.35, candle: 0.35, tallow: 0.4, rush: 0.35, paraffin: 0.35, gas: 0.4, bulb: 0.3, fluorescent: 0.7, stove: 0.45, embers: 0.6, brazier: 0.45, window: 0.65, phone: 0.5, police: 0.4, sky: 0.85 };
// the rim floor: a figure always parts from its ground by at least this much edge light (legibility, not drama)
export const RIM_FLOOR = 0.07;

// every source as seen from the head: direction, colour, strength (shadow from the field where known)
function candidates(M, P, t, gains, dyn) {
  const out = [], S = M.sky;
  const lamp = (L, g) => { const d = [L.at[0] - P[0], L.at[1] - P[1], L.at[2] - P[2]], l = Math.hypot(...d); if (l >= L.reach) return; const f = 1 - l / L.reach, E = L.e0 * f * f * g * (L.cone ? coneK(L, P) : 1); if (E > 1e-4) out.push({ dir: d.map((v) => v / l), rgb: L.rgb, E, K: L.K, kind: L.kind, at: L.at }); };
  M.lights.forEach((L, i) => lamp(L, gains[i]));
  for (const L of dyn) lamp(L, 1);
  // the sun at normal incidence (a face turned to it), not on the ground: a low sun is weak on the snow, strong on a face
  if (S.sun.E > 0 && S.sun.dir[1] > 0) out.push({ dir: S.sun.dir, rgb: S.sun.rgb, E: (S.sun.E / Math.max(0.05, S.sun.dir[1])) * (M.indoor ? 0.15 : 1), K: 5200, kind: "sun", vis: true });
  if (S.moon.E > 0 && S.moon.dir[1] > 0) out.push({ dir: S.moon.dir, rgb: S.moon.rgb, E: S.moon.E, K: 7000, kind: "moon", vis: true });
  return out;
}
export function figureRig({ M, at, cam = M.place.camera, t = 0, F = null, groundRgb = null, cold = null, dyn = [] }) {
  const P = [at[0], at[1] + HEAD, at[2]], B = camBasis({ ...cam, target: cam.target || [0, 0, 0], dist: cam.dist || 50 }), gains = M.gains(t);
  const C = candidates(M, P, t, gains, dyn), S = M.sky, skyE = lum(S.amb);
  if (F) applySunShadow(C, F, at);
  C.sort((a, b) => b.E - a.E);
  const key = C[0] && C[0].E > skyE * 0.6 ? C[0] : { dir: [0, 1, 0], rgb: S.amb.map((v) => v / (Math.max(...S.amb) || 1)), E: skyE, K: 9000, kind: "sky" };
  const back = (c) => c.dir[0] * B.f[0] + c.dir[1] * B.f[1] + c.dir[2] * B.f[2];   // > 0: the light is behind the figure
  const rimC = C.filter((c) => c !== key && back(c) > 0.15).sort((a, b) => b.E * back(b) - a.E * back(a))[0];
  const rim = rimOf(rimC, key, S, B, back);
  const ground = groundRgb || [0.3, 0.29, 0.28], gE = F ? fieldAt(F, at) : S.ground, bounce = gE.map((v, k) => v * ground[k] * 1.6);
  // the fill comes off the room toward the viewer's side of the face; it is held to at least a quarter of the key
  // (4:1, a portrait painter's limit for a face that still reads), and a third when the key is behind
  // with the key behind the figure, or straight overhead (a hard top light: the face under its own brow and brim),
  // the face would take only a flat fill; the room's bounce then comes from the
  // key's side, three-quarters on, so the face keeps a turn of light across it
  const kb = back(key) > 0.2 || key.dir[1] > 0.8, sd = Math.sign(key.dir[0] * B.right[0] + key.dir[2] * B.right[2]) || 1;
  const fd = kb ? norm([B.right[0] * sd * 0.8 - B.f[0] * 0.6, 0.15, B.right[2] * sd * 0.8 - B.f[2] * 0.6]) : norm([-key.dir[0] * 0.5 - B.f[0] * 0.7, -0.35, -key.dir[2] * 0.5 - B.f[2] * 0.7]);
  const fE = Math.max(lum(bounce), key.E * (kb ? 0.7 : 0.25)), bn = bounce.map((v) => v / (Math.max(...bounce) || 1));
  // a room is lit by its ruling light, so most of its bounce is that light's colour, tinted by the floor and the sky
  // indoors a room is lit by its ruling light, so most of its bounce is that light's colour; outdoors the shadow side
  // faces the open sky, so the fill is mostly the sky's own colour (cool by day, cold blue at the blue hour)
  const skyN = S.amb.map((v) => v / (Math.max(...S.amb) || 1)), out = !M.indoor;
  const fill = { dir: fd, rgb: bn.map((v, k) => (out ? 0.25 * v + 0.55 * skyN[k] + 0.2 * key.rgb[k] : 0.4 * v + 0.6 * key.rgb[k])), E: out ? Math.max(fE, lum(S.amb) * 0.8) : fE };
  const coldK = cold ?? Math.min(1, (+(M.terms && M.terms.frost) || 0) + (M.era === 2 ? 0.3 : 0));
  adapt([key, fill, rim], S);
  return { rig: toRig(key, fill, rim, S, B), key, fill, rim, terminator: terminatorOf(key, fill, B), catch: catchOf(key, B), sss: sssOf(coldK, rim, key) };
}
// partial chromatic adaptation (von Kries, half way): the eye takes some of the ruling light's colour as white,
// so a face at golden hour is warm, not orange, while sodium stays sodium on the street
function adapt(lights, S) {
  const w = lights[0].rgb.map((v, k) => v * lights[0].E + S.amb[k]), m = Math.max(...w) || 1, white = w.map((v) => 0.5 + 0.5 * (v / m));
  for (const L of lights) { const c = L.rgb.map((v, k) => v / white[k]), cm = Math.max(...c) || 1; L.rgb = c.map((v) => v / cm); }
}
// an exposure nudge within the model's allowance (one stop either way), for a drawer that sets a figure's
// exposure against the painting round it
export const NUDGE = [1, 1.41, 0.71, 2, 0.5];
export function scaleRig(rig, k) {
  const sc = (L) => (L ? { ...L, c: L.c.map((v) => v * k) } : L);
  return { ...rig, amb: rig.amb.map((v) => v * k), ground: rig.ground.map((v) => v * k), key: sc(rig.key), fill: sc(rig.fill), rim: sc(rig.rim), fresnel: rig.fresnel ? { ...rig.fresnel, c: rig.fresnel.c.map((v) => v * k) } : rig.fresnel };
}
function applySunShadow(C, F, at) {
  const i = sampleOf(F, at); if (i < 0) return;
  for (const c of C) if (c.kind === "sun" || c.kind === "moon") c.E *= (c.kind === "sun" ? F.sunVis[i] : F.moonVis[i]) / 255;
}
function rimOf(rc, key, S, B, back) {
  // with no light behind, a thin edge from behind and above in the sky's colour (night) or the horizon's (day)
  const behind = norm([B.f[0], 0.55, B.f[2]]), cool = norm3(S.horizon.map((v, k) => v + [0.04, 0.05, 0.09][k]));
  if (!rc) return { dir: behind, rgb: cool, E: RIM_FLOOR, kind: "sky", floor: true };
  const E = Math.max(RIM_FLOOR, rc.E * back(rc));
  return { dir: rc.dir, rgb: rc.rgb, E, K: rc.K, kind: rc.kind, floor: E === RIM_FLOOR };
}
const norm3 = (c) => { const m = Math.max(...c) || 1; return c.map((v) => v / m); };
// the rig in characters/render/shade.mjs's shape: amb (top), ground, key/fill/rim lights with wrap, and the
// fresnel edge toward the rim's side
function toRig(key, fill, rim, S, B) {
  const kE = Math.min(1.6, key.E * 2.2), fE = Math.min(0.8, kE * 0.75, fill.E * 2.2), rE = Math.min(0.9, rim.E * 3);
  return {
    amb: S.amb.map((v) => v * 0.6), ground: fill.rgb.map((v) => v * fE * 0.35),
    key: { dir: key.dir, c: key.rgb.map((v) => v * kE), wrap: 0.15 + 0.4 * (SOFT[key.kind] ?? 0.35) },
    fill: { dir: fill.dir, c: fill.rgb.map((v) => (v / (Math.max(...fill.rgb) || 1)) * fE), wrap: 0.35 },
    rim: { dir: rim.dir, c: rim.rgb.map((v) => v * rE * 0.5), wrap: 0, pow: 3 },
    fresnel: { c: rim.rgb.map((v) => v * rE * 0.6), pow: 3, dir: rim.dir, directionality: 2 },
  };
}
// the face-light terminator in screen space: the direction across the face from its dark side to its lit side,
// how soft the turn is (the source's size), and the key-to-fill ratio that sets how deep the dark side falls
function terminatorOf(key, fill, B) {
  const sx = key.dir[0] * B.right[0] + key.dir[1] * B.right[1] + key.dir[2] * B.right[2], sy = -(key.dir[0] * B.up[0] + key.dir[1] * B.up[1] + key.dir[2] * B.up[2]), l = Math.hypot(sx, sy) || 1;
  const toward = -(key.dir[0] * B.f[0] + key.dir[1] * B.f[1] + key.dir[2] * B.f[2]);   // 1: key from the camera (flat), -1: from behind
  return { dir2: [sx / l, sy / l], soft: SOFT[key.kind] ?? 0.35, ratio: key.E / Math.max(1e-3, fill.E), facing: toward };
}
function catchOf(key, B) {
  const sx = key.dir[0] * B.right[0] + key.dir[1] * B.right[1] + key.dir[2] * B.right[2], sy = -(key.dir[0] * B.up[0] + key.dir[1] * B.up[1] + key.dir[2] * B.up[2]);
  const toward = -(key.dir[0] * B.f[0] + key.dir[1] * B.f[1] + key.dir[2] * B.f[2]);
  return { offset2: [sx * 0.35, sy * 0.35], rgb: key.rgb, k: toward > -0.2 ? Math.min(1, key.E * 4) : 0 };
}
// ears, nose and fingers redden in the cold, and glow where a light behind shines through them
function sssOf(cold, rim, key) { return { k: Math.min(1, cold * 0.55 + (rim.floor ? 0 : rim.E * 1.5)), rgb: [1.0, 0.32, 0.22], through: rim.floor ? key.rgb : rim.rgb }; }

export function sampleOf(F, at) {
  // the field sample nearest the feet, found through the plate projection
  const b = F.basis || (F.basis = basisOfField(F)), sx = b.o[0] + b.x[0] * at[0] + b.y[0] * at[1] + b.z[0] * at[2], sy = b.o[1] + b.x[1] * at[0] + b.y[1] * at[1] + b.z[1] * at[2], X = Math.round(sx), Y = Math.round(sy);
  return X < 0 || Y < 0 || X >= F.w || Y >= F.h ? -1 : Y * F.w + X;
}
const basisOfField = (F) => geoBasis(F.pj);
function fieldAt(F, at) { const i = sampleOf(F, at); return i < 0 ? [0.05, 0.05, 0.06] : [F.E[i * 3], F.E[i * 3 + 1], F.E[i * 3 + 2]]; }
