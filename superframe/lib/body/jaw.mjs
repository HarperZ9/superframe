// jaw.mjs: a two-phase mandible in the side view (millimetres; condyle centre at the origin, +x forward, +y up).
// Phase 1: pure rotation about the condyle up to ALPHA1 (12 deg, moderate confidence, about 20 mm at the incisors).
// Phase 2: the condyle also travels forward and down the articular eminence, an arc whose slope runs from 40 deg
// down to 10 deg over 16 mm (authored, moderate), coupled linearly to rotation beyond ALPHA1, with the coupling set
// so the incisor opening reaches 50 mm at full travel (moderate). Landmarks are authored, near adult averages.
// The neck front and the 8 mm of soft tissue under the chin are authored landmarks for the clearance check.
const RAD = Math.PI / 180;
export const JAW = {
  alpha1: 12, travel: 16, slope0: 40, slope1: 10, maxOpening: 50,
  incisor: [90, -28], menton: [78, -74],
  outline: [[0, 4], [6, 2], [8, -8], [4, -30], [-4, -50], [-2, -60], [10, -66], [40, -70], [70, -76], [80, -74], [86, -66], [88, -50], [90, -28], [80, -27], [60, -30], [36, -28], [28, -4], [20, -12], [12, -10], [6, 0]],
  neck: { top: [30, -86], dirDeg: -100 }, softTissue: 8,
};

// Condyle centre after s mm of travel along the eminence arc (closed form: slope varies linearly with s).
export function condyleAt(s, J = JAW) {
  if (s <= 0) return [0, 0];
  const a0 = -J.slope0 * RAD, k = (J.slope0 - J.slope1) * RAD / J.travel;   // tangent angle a(s) = a0 + k s
  if (Math.abs(k) < 1e-12) return [s * Math.cos(a0), s * Math.sin(a0)];
  return [(Math.sin(a0 + k * s) - Math.sin(a0)) / k, (Math.cos(a0) - Math.cos(a0 + k * s)) / k];
}

const rot = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
const add = (p, q) => [p[0] + q[0], p[1] + q[1]];

// Mandible pose at rotation alpha (deg, opening) with travel per degree `k` beyond alpha1 (mm/deg; 0 is a hinge).
export function jawPose(alphaDeg, k, J = JAW) {
  const s = Math.min(J.travel, Math.max(0, (alphaDeg - J.alpha1) * k)), c = condyleAt(s, J), a = -alphaDeg * RAD;
  const place = p => add(c, rot(p, a));
  return { alpha: alphaDeg, s, condyle: c, incisor: place(J.incisor), menton: place(J.menton), outline: J.outline.map(place) };
}
export const opening = (pose, J = JAW) => Math.hypot(pose.incisor[0] - J.incisor[0], pose.incisor[1] - J.incisor[1]);

// Rotation that gives a target opening (bisection; opening grows with alpha for both models here).
export function alphaFor(target, k, J = JAW) {
  let lo = 0, hi = 80;
  for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (opening(jawPose(m, k, J), J) < target) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

// Coupling (mm of travel per degree) such that full travel lands exactly at maxOpening.
export function couplingFor(J = JAW) {
  let lo = 0.05, hi = 20;
  const openAtFull = k => opening(jawPose(J.alpha1 + J.travel / k, k, J), J);
  for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (openAtFull(m) < J.maxOpening) hi = m; else lo = m; }   // faster coupling ends travel sooner
  return (lo + hi) / 2;
}
export const K_TWO_PHASE = couplingFor();

// Incisor path from closed to `to` mm of opening, sampled every `step` deg of rotation.
export function incisorPath(k, { to = JAW.maxOpening, step = 0.25, J = JAW } = {}) {
  const end = alphaFor(to, k, J), pts = [];
  for (let a = 0; a < end; a += step) pts.push(jawPose(a, k, J).incisor);
  pts.push(jawPose(end, k, J).incisor);
  return pts;
}

// Signed clearance (mm) of the chin's soft tissue in front of the neck line: menton distance minus soft tissue.
export function neckClearance(pose, J = JAW) {
  const d = [Math.cos(J.neck.dirDeg * RAD), Math.sin(J.neck.dirDeg * RAD)], n = [-d[1], d[0]];   // n points forward
  const v = [pose.menton[0] - J.neck.top[0], pose.menton[1] - J.neck.top[1]];
  return v[0] * n[0] + v[1] * n[1] - J.softTissue;
}
