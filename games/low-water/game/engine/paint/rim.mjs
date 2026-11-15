// The painter's found edge: a figure on a dark plate is kept apart from it by paint, as the
// reference keeps its figures apart with a rim light. A stroke that turns away from the eye (its
// normals grazing) is lifted: on the side toward the ruling lamp to the lamp's colour at a value
// above the ground's, on the far side, where the ground is dark, to a cool reflected light just over
// it. Everything per stroke, from the stroke's own normals, so the edge rides the body. Original code.
//   mass(mean, lit, ground, out): the light and dark sides (before the palette glazes the value)
//   rimOf(pc, graze, lit, ground, P, out) -> out (linear RGB): the found edge
import { glaze, lum } from "./km.mjs";

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const T = [0, 0, 0];
export const RIM = { start: 0.3, end: 0.75, litLift: 3.0, coolLift: 1.5, darkGround: 0.08, massK: 0.35 };
// Massing: the painter's split of a form into a light side and a dark side. A stroke facing the
// ruling lamp is lifted, one facing away is sunk, each by up to massK of its own value, so the form
// reads as two masses at play size while a black coat stays a black coat (a lift toward the figure's
// mean turned black hats grey in the Brine, stills 2026-10-21).
export function mass(pc, lit, G0, out = pc) {
  const up = ss(0.0, 0.55, lit), down = ss(-0.05, -0.55, lit), g = 1 + RIM.massK * (up - 0.7 * down);
  out[0] = Math.min(1, pc[0] * g); out[1] = Math.min(1, pc[1] * g); out[2] = Math.min(1, pc[2] * g);
  return out;
}

export function rimOf(pc, graze, lit, ground, P, out = pc) {
  const G0 = ground != null && ground > 0 ? ground : 0.03;
  const r = ss(RIM.start, RIM.end, graze); if (r <= 0) { out[0] = pc[0]; out[1] = pc[1]; out[2] = pc[2]; return out; }
  const Lc = lum(pc) || 1e-5;
  let target = Lc, tint = null, k = 0;
  const onLit = ss(0.05, 0.45, lit);
  if (onLit > 0) { target = Math.max(Lc, G0 * RIM.litLift + 0.004); tint = P.light; k = r * onLit; }
  else if (G0 < RIM.darkGround) { target = Math.max(Lc, G0 * RIM.coolLift + 0.002); tint = P.shadowB; k = r * 0.6; }
  if (!tint || k <= 0) { out[0] = pc[0]; out[1] = pc[1]; out[2] = pc[2]; return out; }
  glaze(pc, tint, 0.5, 0, T);
  const g = Math.min(4, target / Lc);
  for (let c = 0; c < 3; c++) out[c] = Math.min(1, pc[c] * (1 - k) + T[c] * g * k);
  return out;
}
// R4, the map-aware painter: a stroke's mean curvature (-1 concave .. 1 convex) and cavity (0 open .. 1 enclosed)
// from the sculptor's per-vertex maps, carried by the rasteriser as G.curv and G.cav. Cavity puts a warm dark
// into the stroke (sockets, nostrils, mouth corners, the fold under a collar); a convex stroke that faces the
// lamp is raised toward the light (brow, cheekbone, nose bridge). Faces take it fully, other strokes at half.
export function formAccent(pc, curv, cav, lit, face, P) {
  const k = face ? 1 : 0.5, dark = Math.min(0.55, Math.max(0, cav - 0.12) * 1.1) * k, lift = curv > 0.15 && lit > 0.2 ? Math.min(0.35, (curv - 0.15) * 0.9 * lit) * k : 0;
  if (dark > 0) { const w = P && P.dark ? P.dark : [0.07, 0.045, 0.04]; for (let c = 0; c < 3; c++) pc[c] = pc[c] * (1 - dark) + w[c] * dark * 0.6; }
  if (lift > 0) for (let c = 0; c < 3; c++) pc[c] = Math.min(1, pc[c] * (1 + lift));
  return pc;
}
// Stroke light on figures (design/art/PAINT-LANGUAGE.md, "stroke light"): the same rule as the plates. A stroke whose
// normals face the ruling light is loaded toward the light's colour, more the more it faces it; the threshold is
// jittered per stroke by its key, so the terminator breaks (some light strokes reach into the shade, some fall
// short). key: the stroke's hash key; lit: the mean of n . L over the stroke; k: strength (0 off).
export function strokeLit(pc, lit, key, P, k = 1) {
  if (!k || !P || !P.light) return pc;
  const j = (((key * 2654435761) >>> 0) % 1000) / 1000 - 0.5, t = ss(0.1 + 0.3 * j, 0.6 + 0.3 * j, lit) * 0.42 * k;
  if (t <= 0) return pc;
  glaze(pc, P.light, t, 0.45 * t, T); pc[0] = T[0]; pc[1] = T[1]; pc[2] = T[2];
  return pc;
}
