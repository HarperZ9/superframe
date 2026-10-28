// plate.mjs: the demo plate as a resolution-free spec for lib/study/render.mjs. Four panels: leg sweep, foot-turn
// band against flexion, jaw sweep (two-phase beside hinge), contrapposto stances. Red marks a violation.
import { legSide, axialRange, footVsKneecap, aimFootHinge, checkLeg, FLEX_LIMITS } from './knee.mjs';
import { JAW, K_TWO_PHASE, jawPose, alphaFor, incisorPath, neckClearance, opening } from './jaw.mjs';
import { findBreak } from './fit.mjs';
import { buildPose, checkStance } from './pose.mjs';

export const INK = { ground: '#ebe5d8', ink: '#15130f', faint: '#9a917f', ghost: '#c9bfab', band: '#d8ccb2', path: '#a8521f', bad: '#b8261e', rule: '#bdb29c' };
const T = (ops, x, y, text, o = {}) => ops.push({ op: 'text', x, y, text, size: o.size ?? 15, style: o.style ?? 'text', weight: o.weight ?? 400, color: o.color ?? INK.ink, align: o.align });
const L = (ops, pts, width, color) => ops.push({ op: 'line', pts, width, color });
const dot = (ops, [x, y], r, fill) => ops.push({ op: 'circle', cx: x, cy: y, r, fill });
const cross = (ops, [x, y], r, color, w = 2.5) => { L(ops, [[x - r, y - r], [x + r, y + r]], w, color); L(ops, [[x - r, y + r], [x + r, y - r]], w, color); };
function dashed(ops, pts, width, color, on = 6, off = 5) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, b] = [pts[i], pts[i + 1]], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let s = 0; s < len; s += on + off) { const e = Math.min(len, s + on), p = t => [a[0] + (b[0] - a[0]) * t / len, a[1] + (b[1] - a[1]) * t / len]; L(ops, [p(s), p(e)], width, color); }
  }
}
const head = (ops, x, y, t, sub) => { T(ops, x, y, t, { size: 22, style: 'display', weight: 600 }); if (sub) T(ops, x, y + 26, sub, { size: 14, color: INK.faint }); };

// Panel A: side view, hip fixed, knee flexion swept 0 to 135 in 15 degree steps; 150 drawn red past the limit.
function legPanel(ops, x0, y0) {
  head(ops, x0, y0, 'Leg sweep', 'knee flexion 0 to 150 deg, axial range per pose');
  const s = 0.48, hip = [x0 + 330, y0 + 80], P = ([x, y]) => [hip[0] + x * s, hip[1] - y * s];
  const sweep = [0, 15, 30, 45, 60, 75, 90, 105, 120, 135];
  for (const f of sweep) { const g = legSide(0, f); L(ops, [P(g.knee), P(g.ankle), P(g.toe)], f === 0 ? 5 : 2.2, f === 0 ? INK.ink : INK.ghost); }
  const bad = legSide(0, 150); L(ops, [P(bad.knee), P(bad.ankle), P(bad.toe)], 3, INK.bad); cross(ops, P(bad.ankle), 9, INK.bad);
  T(ops, P(bad.ankle)[0] - 16, P(bad.ankle)[1] - 12, `150 deg, past the ${FLEX_LIMITS.max} limit`, { color: INK.bad, size: 14, align: 'right' });
  const g0 = legSide(0, 0); L(ops, [P([0, 0]), P(g0.knee)], 6, INK.ink); dot(ops, P([0, 0]), 7, INK.ink); dot(ops, P(g0.knee), 6, INK.ink);
  for (const f of [0, 30, 60, 90, 120]) {
    const g = legSide(0, f), r = axialRange(f), [ax, ay] = P(g.ankle);
    T(ops, ax - 10, ay + (f === 0 ? 30 : 22), `${f}: ${r.total.toFixed(1)} deg`, { size: 13, color: f === 0 ? INK.ink : INK.faint, align: 'right' });
  }
  T(ops, P(g0.knee)[0] + 16, P(g0.knee)[1] + 5, 'locked: 0.0 deg', { size: 14 });
}

// Panel B: foot turn against the kneecap's locked line, against flexion. Band = cord range about the coupled path.
function bandPanel(ops, x0, y0) {
  head(ops, x0, y0, 'Foot turn against the kneecap', 'cord range about the screw-home path; gate 2 deg under 5 deg flexion');
  const gx = x0 + 60, gy = y0 + 70, gw = 780, gh = 430, fMax = 120, yMin = -35, yMax = 35;
  const X = f => gx + f / fMax * gw, Y = d => gy + (yMax - d) / (yMax - yMin) * gh;
  const up = [], lo = [];
  for (let f = 0; f <= fMax; f += 1) { const r = axialRange(f); up.push([X(f), Y(footVsKneecap(f, r.outward))]); lo.push([X(f), Y(footVsKneecap(f, -r.inward))]); }
  ops.push({ op: 'poly', pts: [...up, ...lo.reverse()], fill: INK.band });
  for (let d = -30; d <= 30; d += 10) { L(ops, [[gx, Y(d)], [gx + gw, Y(d)]], d === 0 ? 1.4 : 0.7, INK.rule); T(ops, gx - 22, Y(d) + 5, `${d}`, { size: 13, color: INK.faint, align: 'right' }); }
  for (let f = 0; f <= fMax; f += 30) T(ops, X(f), gy + gh + 22, `${f}`, { size: 13, color: INK.faint, align: 'center' });
  T(ops, gx + gw, gy + gh + 44, 'knee flexion, deg', { size: 13, color: INK.faint, align: 'right' });
  T(ops, gx - 22, gy - 12, 'deg outward', { size: 13, color: INK.faint, align: 'right' });
  const path = []; for (let f = 0; f <= fMax; f += 1) path.push([X(f), Y(footVsKneecap(f, 0))]); L(ops, path, 2.4, INK.path);
  const box = [[X(0), Y(2)], [X(5), Y(2)], [X(5), Y(-2)], [X(0), Y(-2)], [X(0), Y(2)]]; L(ops, box, 1.6, INK.ink);
  [[10, 0], [20, 2], [30, 4]].forEach(([t, f]) => { const a = aimFootHinge(t), c = checkLeg({ flex: f, hip: a.hip, foot: a.reached }); cross(ops, [X(f), Y(c.dev)], 7, INK.bad); });
  T(ops, X(5) + 14, Y(30) + 5, 'plain hinge, straight leg: 10, 20, 30 deg flagged', { size: 13, color: INK.bad });
  T(ops, X(90) + 8, Y(footVsKneecap(90, axialRange(90).outward)) - 10, `+${axialRange(90).outward.toFixed(1)} collateral`, { size: 13 });
  T(ops, X(90) + 8, Y(footVsKneecap(90, -axialRange(90).inward)) + 24, `-${axialRange(90).inward.toFixed(1)} cruciate`, { size: 13 });
  T(ops, X(32), Y(-1) + 22, 'screw-home path', { size: 13, color: INK.path });
}

const jp = (o, s) => ([x, y]) => [o[0] + x * s, o[1] - y * s];
function oneJaw(ops, o, s, k, label) {
  const P = jp(o, s), ok = k > 0, aEnd = alphaFor(50, k), col = ok ? INK.ink : INK.bad;
  const nt = JAW.neck.top, d = [Math.cos(JAW.neck.dirDeg * Math.PI / 180), Math.sin(JAW.neck.dirDeg * Math.PI / 180)];
  L(ops, [P(nt), P([nt[0] + 42 * d[0], nt[1] + 42 * d[1]])], 4, INK.faint);
  const shut = jawPose(0, k), mid = jawPose(alphaFor(25, k), k);
  const endPose = jawPose(aEnd, k); ops.push({ op: 'poly', pts: endPose.outline.map(P), fill: ok ? '#dccfb6' : '#e5c7bb' });
  L(ops, [...mid.outline, mid.outline[0]].map(P), 1.4, INK.ghost);
  L(ops, [...shut.outline, shut.outline[0]].map(P), 2, INK.faint);
  const end = jawPose(aEnd, k); L(ops, [...end.outline, end.outline[0]].map(P), 2.6, col);
  L(ops, incisorPath(k).map(P), 2.4, ok ? INK.ink : INK.bad);
  const men = []; for (let a = 0; a <= aEnd; a += 0.5) men.push(jawPose(a, k).menton); L(ops, men.map(P), 1.6, ok ? INK.faint : INK.bad);
  const rr = Math.hypot(...JAW.incisor), circ = []; for (let a = 0; a <= 70; a += 2) circ.push([rr * Math.cos((-17 - a) * Math.PI / 180), rr * Math.sin((-17 - a) * Math.PI / 180)]);
  dashed(ops, circ.map(P), 1, INK.faint, 4, 5);
  if (ok) { const cp = []; for (let a = 0; a <= aEnd; a += 0.5) cp.push(jawPose(a, k).condyle); L(ops, cp.map(P), 3, INK.path); }
  dot(ops, P([0, 0]), 5, INK.ink); dot(ops, P(JAW.incisor), 4, INK.faint);
  const c = neckClearance(end), m = P(end.menton);
  cross(ops, m, 9, ok ? INK.ink : INK.bad, ok ? 1.6 : 3);
  T(ops, o[0] - 20, o[1] + 425, label, { size: 16, weight: 600, color: col });
  T(ops, o[0] - 20, o[1] + 447, `50 mm open, chin clearance ${c >= 0 ? '+' : ''}${c.toFixed(1)} mm`, { size: 13, color: col });
  return { end, c };
}

function jawPanel(ops, x0, y0) {
  head(ops, x0, y0, 'Jaw sweep', 'incisor path, chin path, condyle travel; dashed: circle about the condyle');
  const s = 3.2, k = K_TWO_PHASE;
  oneJaw(ops, [x0 + 90, y0 + 110], s, k, 'two-phase: rotate, then glide');
  oneJaw(ops, [x0 + 500, y0 + 110], s, 0, 'pure hinge: control');
  const b = findBreak(incisorPath(k)), bp = jp([x0 + 90, y0 + 110], s)(incisorPath(k)[b.index]);
  dot(ops, bp, 6, INK.path); T(ops, bp[0] + 12, bp[1] - 8, `break ${b.opening.toFixed(1)} mm`, { size: 13, color: INK.path });
  T(ops, x0 + 480, y0 + 110 + 469, 'one circle throughout: no break found', { size: 13, color: INK.bad });
}

function figure(ops, P0, base, s, title) {
  const r = checkStance(P0), col = r.flagged ? INK.bad : INK.ink, P = ([x, y]) => [base[0] + x * s, base[1] - y * s];
  const bones = [['hipL', 'kneeL'], ['kneeL', 'ankleL'], ['hipR', 'kneeR'], ['kneeR', 'ankleR'], ['shoulderL', 'elbowL'], ['elbowL', 'wristL'], ['shoulderR', 'elbowR'], ['elbowR', 'wristR'], ['neck', 'head']];
  L(ops, [[base[0] - 120, base[1]], [base[0] + 120, base[1]]], 1.2, INK.rule);
  const hm = [(P0.hipL[0] + P0.hipR[0]) / 2, (P0.hipL[1] + P0.hipR[1]) / 2]; L(ops, [P(hm), P(P0.neck)], 4, INK.ink);
  for (const [a, b] of bones) L(ops, [P(P0[a]), P(P0[b])], 3, INK.ink);
  dot(ops, P(P0.head), 10 * s / 2.6, INK.ink);
  const ext = (a, b, e = 0.35) => [[a[0] + (a[0] - b[0]) * e, a[1] + (a[1] - b[1]) * e], [b[0] + (b[0] - a[0]) * e, b[1] + (b[1] - a[1]) * e]];
  L(ops, ext(P0.shoulderL, P0.shoulderR).map(P), 2.6, r.cls === 'same-direction' ? INK.bad : INK.path);
  L(ops, ext(P0.hipL, P0.hipR).map(P), 2.6, r.cls === 'same-direction' ? INK.bad : INK.path);
  const sa = r.support === 'L' ? P0.ankleL : P0.ankleR; L(ops, [P([sa[0] - 4.5, 0]), P([sa[0] + 4.5, 0])], 6, INK.ink);
  dashed(ops, [P(r.com), P([r.com[0], 0])], 1.4, col, 5, 4); dot(ops, P(r.com), 6, col);
  if (r.flagged) cross(ops, P(r.com), 13, INK.bad, 3);
  T(ops, base[0], base[1] + 34, title, { size: 15, weight: 600, align: 'center', color: col });
  T(ops, base[0], base[1] + 54, `${r.cls}`, { size: 13, align: 'center', color: col });
  T(ops, base[0], base[1] + 72, `shoulder ${r.shoulder.toFixed(1)}, pelvis ${r.pelvis.toFixed(1)}, off ${r.offset.toFixed(1)} cm`, { size: 12, align: 'center', color: INK.faint });
}

function posePanel(ops, x0, y0) {
  head(ops, x0, y0, 'Contrapposto', 'shoulder and pelvis lines, centre of mass, support foot');
  const s = 2.45, y = y0 + 475;
  figure(ops, buildPose({ side: 'L', pelvisDeg: 7, shoulderDeg: -6 }), [x0 + 140, y], s, 'counter-tilt');
  figure(ops, buildPose({ side: 'R', pelvisDeg: 7, shoulderDeg: -6 }), [x0 + 430, y], s, 'same direction');
  figure(ops, buildPose({ side: 'L', pelvisDeg: 7, shoulderDeg: -6, extra: 11 }), [x0 + 720, y], s, 'mass off the foot');
}

export function platePlan() {
  const ops = [];
  T(ops, 60, 64, 'Joint limits and coupling', { size: 38, style: 'display', weight: 600 });
  T(ops, 1860, 64, 'lib/body, 2026-10-28', { size: 15, color: INK.faint, align: 'right' });
  ops.push({ op: 'rect', x: 60, y: 690, w: 1800, h: 1.2, fill: INK.rule });
  legPanel(ops, 60, 120); bandPanel(ops, 980, 120); jawPanel(ops, 60, 730); posePanel(ops, 980, 730);
  return { id: 'body-plate', title: 'Joint limits and coupling', w: 1920, h: 1340, ground: INK.ground, ops, images: {} };
}
export { opening };
