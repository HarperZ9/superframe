// The export train's headlamp crossing the square (era 2, beat 2): a cone light that runs along the siding,
// slows into the yard and stops at the loading dock, so the light sweeps the queue's faces once and rests
// on the sacks. A place gives the line as `train: { path: [[x,y,z], ...], speed, dwell, period, height }`
// (place.json); without one there is no train. Original code.
//   trainAt(spec, t)     -> { at, dir, moving } the lamp's position and heading at time t (seconds)
//   trainLights(pj, t)   -> [] or [{ at, kind: "headlamp", I, reach, cone }] a place light for the model
//   coneK(L, P)          -> 0..1, how far point P sits inside the lamp's beam
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function lengths(path) { const L = [0]; for (let i = 1; i < path.length; i++) L.push(L[i - 1] + Math.hypot(...path[i].map((v, k) => v - path[i - 1][k]))); return L; }
export function trainAt(spec, t) {
  const path = spec.path, L = lengths(path), total = L[L.length - 1], v = spec.speed || 4, run = total / v, dwell = spec.dwell ?? 20, period = Math.max(spec.period || run + dwell + 10, run + dwell);
  const u = ((t % period) + period) % period;
  // ease out over the last fifth (the train braking into the dock), stand at the end through the dwell
  let s = u < run ? total * (1 - (1 - u / run) ** 1.6) : total;
  if (u >= run + dwell) return { at: path[0], dir: [0, 0, 0], moving: false, off: true };
  let k = 1; while (k < L.length - 1 && L[k] < s) k++;
  const seg = L[k] - L[k - 1] || 1, at = lerp3(path[k - 1], path[k], Math.min(1, (s - L[k - 1]) / seg)), d = path[k].map((q, j) => q - path[k - 1][j]), l = Math.hypot(...d) || 1;
  return { at: [at[0], at[1] + (spec.height ?? 2.4), at[2]], dir: d.map((q) => q / l), moving: u < run, off: false };
}
export function trainLights(pj, t, spec = pj && pj.train) {
  if (!spec || !spec.path || spec.path.length < 2) return [];
  const T = trainAt(spec, t); if (T.off) return [];
  return [{ at: T.at, kind: "headlamp", I: spec.I ?? 60, reach: spec.reach ?? 40, cone: { dir: T.dir, cos: Math.cos(((spec.beamDeg ?? 18) * Math.PI) / 180) }, decay: false, moving: T.moving }];
}
export function coneK(L, P) {
  if (!L.cone) return 1;
  const d = [P[0] - L.at[0], P[1] - L.at[1], P[2] - L.at[2]], l = Math.hypot(...d) || 1, c = (d[0] * L.cone.dir[0] + d[1] * L.cone.dir[1] + d[2] * L.cone.dir[2]) / l;
  return c <= L.cone.cos ? 0 : Math.min(1, (c - L.cone.cos) / ((1 - L.cone.cos) * 0.4));
}
