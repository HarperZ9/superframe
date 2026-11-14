// A stroke's paint: its mean lit colour moved onto the palette's value planes, then glazed in
// pigment space: shadow planes toward violet on one side of the form and teal on the other, lit
// planes toward the ruling light, skin halftones toward olive and skin lights toward rose, and the
// plate's distance haze over the lot. Linear RGB in, linear RGB out. Original code.
//   paintOf(mean, side, face, P, haze, out) -> out
//   side: -1..1, the stroke's normal on the camera's right (+) or left (-); face: skin family
import { glaze, lum } from "./km.mjs";

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// Value planes: inside each band of P.planes the value is pulled toward the band's middle
// (geometric), with soft shoulders, so the figure reads as a few painted planes, never a staircase
export function planeValue(Lm, planes, pull = 0.6) {
  if (Lm <= 0) return 0;
  let lo = planes[0] * 0.4, hi = planes[0];
  for (let b = 0; b <= planes.length; b++) {
    lo = b === 0 ? planes[0] * 0.35 : planes[b - 1]; hi = b < planes.length ? planes[b] : planes[planes.length - 1] * 2.2;
    if (Lm < hi || b === planes.length) break;
  }
  const mid = Math.sqrt(lo * hi), t = ss(lo, hi, Lm), core = 1 - Math.abs(t - 0.5) * 2;   // 1 mid-band, 0 at an edge
  const k = pull * (0.35 + 0.65 * core);
  return Math.exp(Math.log(Lm) * (1 - k) + Math.log(mid) * k);
}

const A = [0, 0, 0], B = [0, 0, 0], T = [0, 0, 0];
// a figure keeps more of its own local colour in shadow than the plate does: at the plates' full glaze a dark
// coat took the ground's violet and read as see-through against it (gameplay lead, 2026-10-21)
export const FIG_SHADOW = 0.4;
export function paintOf(mean, side, face, P, haze = 0, out = [0, 0, 0]) {
  const Lm = lum(mean); if (Lm <= 1e-6) { out[0] = mean[0]; out[1] = mean[1]; out[2] = mean[2]; return out; }
  const Lq = planeValue(Lm, P.planes), g = Lq / Lm;
  A[0] = mean[0] * g; A[1] = mean[1] * g; A[2] = mean[2] * g;
  const pl = P.planes, sh = 1 - ss(pl[0], pl[2], Lq), li = ss(pl[2], pl[4], Lq);
  if (sh > 0) {   // shadow glaze, its hue by which side of the form it is on
    const t = ss(-0.6, 0.6, side);
    for (let c = 0; c < 3; c++) T[c] = P.shadowA[c] * (1 - t) + P.shadowB[c] * t;
    glaze(A, T, P.shadowK * FIG_SHADOW * sh, 0, B); A[0] = B[0]; A[1] = B[1]; A[2] = B[2];
  }
  if (li > 0) { glaze(A, P.light, P.lightK * li, 0, B); A[0] = B[0]; A[1] = B[1]; A[2] = B[2]; }
  if (face) {   // verdaccio halftones, rose where the light lands
    const mt = Math.max(0, 1 - Math.abs(Math.log(Lq / Math.sqrt(pl[1] * pl[3])) / 1.2));
    if (mt > 0) { glaze(A, P.skinMid, P.skinK * mt, 0, B); A[0] = B[0]; A[1] = B[1]; A[2] = B[2]; }
    if (li > 0) { glaze(A, P.skinLight, P.skinK * li, 0.04, B); A[0] = B[0]; A[1] = B[1]; A[2] = B[2]; }
  }
  // haze is light scattered in the air, not paint: it adds (transmittance and in-scatter), never past half
  if (haze > 0) { const t = Math.min(0.5, haze); for (let c = 0; c < 3; c++) A[c] = A[c] * (1 - t) + P.haze[c] * t; }
  out[0] = A[0]; out[1] = A[1]; out[2] = A[2]; return out;
}
