// Small numbers shared by the camera, the controller and the animator. No browser or GPU here:
// every module in play/ runs the same in node, in a page and in any host that can call a module.
// Deterministic math (design/DETMATH.md): sin, cos, atan2 and exp from the combat sim's own module,
// and log here by the same rules, so the camera gives the same bits in JS and in its BuildLang port
// (play/native/). Only + - * / sqrt floor and comparisons, in the order written.
import { dsin, dcos, datan2, dexp, DPI } from "../../game/engine/combat/sim/math.mjs";
export { dsin, dcos, datan2, dexp, DPI };
const LN2_HI = 6.93147180369123816490e-1, LN2_LO = 1.90821492927058770002e-10, SQRT2 = Math.sqrt(2), SQRTH = Math.sqrt(0.5);
const LC = Array.from({ length: 15 }, (_, n) => 1 / (2 * n + 1));
// log: x = m 2^k with m in [sqrt 1/2, sqrt 2), the scale exact; log m = 2 atanh((m - 1)/(m + 1)) by its series
export function dlog(x) {
  if (!(x > 0)) return x === 0 ? -Infinity : NaN;
  let m = x, k = 0;
  while (m >= SQRT2) { m = m / 2; k = k + 1; }
  while (m < SQRTH) { m = m * 2; k = k - 1; }
  const t = (m - 1) / (m + 1), z = t * t; let p = LC[14];
  for (let n = 13; n >= 0; n--) p = LC[n] + z * p;
  return k * LN2_HI + (2 * t * p + k * LN2_LO);
}
export const dtan = (x) => dsin(x) / dcos(x);
export const dpow = (a, b) => dexp(b * dlog(a));
export const hyp3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
const HALF_LN = -LN2_HI - LN2_LO;   // log 0.5, so 0.5^(dt/half) is dexp(dt/half * HALF_LN)
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => { const u = clamp(t, 0, 1); return u * u * (3 - 2 * u); };
export const wrap = (a) => { while (a > DPI) a -= 2 * DPI; while (a < -DPI) a += 2 * DPI; return a; };
export const lerpAngle = (a, b, t) => a + wrap(b - a) * t;
// move x toward target so that half the gap is gone after `half` seconds, whatever the frame rate
export const damp = (x, target, half, dt) => (half <= 0 ? target : target + (x - target) * dexp((dt / half) * HALF_LN));
export const dampAngle = (x, target, half, dt) => x + wrap(target - x) * (1 - dexp((dt / Math.max(1e-4, half)) * HALF_LN));
export const v3 = { add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], scl: (a, s) => [a[0] * s, a[1] * s, a[2] * s], len: (a) => Math.hypot(a[0], a[1], a[2]), lerp: (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2] };
// yaw 0 looks north (-z), 90 degrees east; pitch up is positive (walk/mat.mjs)
export const forward = (yaw, pitch = 0) => [dsin(yaw) * dcos(pitch), dsin(pitch), -dcos(yaw) * dcos(pitch)];
export const heading = (dx, dz) => datan2(dx, -dz);
