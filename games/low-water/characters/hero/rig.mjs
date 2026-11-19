// The hero rig: the Low Water skeleton (rig/skeleton.mjs) bound in an A pose (arms out, so sleeves
// and coat are meshed apart), skin weights from distance to bone segments, and clips baked to the
// joint-local quaternions native/raw/scene/skin.hpp poses (rest rotation, then the pose rotation).
//   bindPose(P) -> B (solve() frames)       weigher(B) -> (p, allowed, sigma) -> [[joint, w] x 4]
//   skeletonJson(B) / bakeClip(P, B, sample, frames) -> char.json parts
import { solve, JOINTS, INDEX, restOffsets } from "../rig/skeleton.mjs";

export const APOSE = { armL: { out: 28 }, armR: { out: 28 }, foreL: { bend: 8 }, foreR: { bend: 8 }, thighL: { out: 2.5 }, thighR: { out: 2.5 } };
export const bindPose = (P) => solve({ ...P, stoop: 0 }, APOSE);
export const J = (B, n) => B[INDEX[n]].p;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const addv = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const app = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const tr = (m) => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
const mul = (a, b) => [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c]));

// each joint's bone as a segment in the bind pose (the joint to its child, or a stub)
export function bones(B) {
  const p = (n) => J(B, n), R = (n) => B[INDEX[n]].R, seg = {};
  seg.pelvis = [p("pelvis"), p("spine")]; seg.spine = [p("spine"), p("chest")]; seg.chest = [p("chest"), p("neck")]; seg.neck = [p("neck"), p("head")];
  seg.head = [p("head"), addv(p("head"), [0, 0.2, 0.02])];
  for (const s of ["L", "R"]) {
    seg["clav" + s] = [p("clav" + s), p("arm" + s)]; seg["arm" + s] = [p("arm" + s), p("fore" + s)]; seg["fore" + s] = [p("fore" + s), p("hand" + s)];
    seg["hand" + s] = [p("hand" + s), addv(p("hand" + s), app(R("hand" + s), [0, -0.09, 0]))];
    seg["thigh" + s] = [p("thigh" + s), p("shin" + s)]; seg["shin" + s] = [p("shin" + s), p("foot" + s)];
    seg["foot" + s] = [p("foot" + s), addv(p("foot" + s), [0, -0.02, 0.15])];
    seg["skirt" + s] = [p("skirt" + s), addv(p("skirt" + s), [0, -0.5, 0])]; seg["hang" + s] = [p("hang" + s), addv(p("hang" + s), [0, -0.2, 0])];
  }
  seg.hangB = [p("hangB"), addv(p("hangB"), [0, -0.2, 0])]; seg.root = [p("root"), p("root")];
  return seg;
}
function segDist(p, [a, b]) {
  const ab = sub(b, a), ap = sub(p, a), L = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2];
  const t = L > 0 ? Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / L)) : 0;
  return Math.hypot(ap[0] - ab[0] * t, ap[1] - ab[1] * t, ap[2] - ab[2] * t);
}
// weights: exp(-(d - dmin) / sigma) over the allowed bones, the four largest, summing to one
export function weigher(B) {
  const seg = bones(B);
  return (p, allowed, sigma = 0.03) => {
    const ds = allowed.map((n) => [n, segDist(p, seg[n])]), dmin = Math.min(...ds.map((d) => d[1]));
    const ws = ds.map(([n, d]) => [INDEX[n], Math.exp(-(d - dmin) / sigma)]).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const s = ws.reduce((a, w) => a + w[1], 0);
    while (ws.length < 4) ws.push([0, 0]);
    return ws.map(([j, w]) => [j, w / s]);
  };
}

function quat(m) {   // row-major 3x3 to (x, y, z, w)
  const t = m[0] + m[4] + m[8];
  let q;
  if (t > 0) { const s = Math.sqrt(t + 1) * 2; q = [(m[7] - m[5]) / s, (m[2] - m[6]) / s, (m[3] - m[1]) / s, 0.25 * s]; }
  else if (m[0] > m[4] && m[0] > m[8]) { const s = Math.sqrt(1 + m[0] - m[4] - m[8]) * 2; q = [0.25 * s, (m[1] + m[3]) / s, (m[2] + m[6]) / s, (m[7] - m[5]) / s]; }
  else if (m[4] > m[8]) { const s = Math.sqrt(1 + m[4] - m[0] - m[8]) * 2; q = [(m[1] + m[3]) / s, 0.25 * s, (m[5] + m[7]) / s, (m[2] - m[6]) / s]; }
  else { const s = Math.sqrt(1 + m[8] - m[0] - m[4]) * 2; q = [(m[2] + m[6]) / s, (m[5] + m[7]) / s, 0.25 * s, (m[3] - m[1]) / s]; }
  const l = Math.hypot(...q); return q.map((v) => +(v / l).toFixed(6));
}
const localR = (S, i) => { const par = JOINTS[i][1]; return par ? mul(tr(S[INDEX[par]].R), S[i].R) : S[i].R; };

// the skeleton in the bind pose: rest translation in the parent's frame, rest rotation local
export function skeletonJson(P, B) {
  const rest = restOffsets({ ...P, stoop: 0 });
  return JOINTS.map(([name, parent], i) => ({ name, parent: parent ? INDEX[parent] : -1, t: (parent ? rest[name] : rest.root).map((v) => +v.toFixed(6)), r: quat(localR(B, i)) }));
}
// a clip: sample(f) -> a pose record for rig/skeleton.mjs solve(); per frame each joint's pose
// rotation (rest^-1 * local) and the root's translation offset
export function bakeClip(P, B, sample, frames, fps = 30, extra = {}) {
  const rest = restOffsets(P), rot = [], root = [];
  const restL = JOINTS.map((_, i) => localR(B, i));
  for (let f = 0; f < frames; f++) {
    const S = solve(P, sample(f), rest);
    rot.push(JOINTS.map((_, i) => quat(mul(tr(restL[i]), localR(S, i)))));
    root.push(sub(S[0].p, rest.root).map((v) => +v.toFixed(5)));
  }
  return { fps, frames, rot, root, ...extra };
}
