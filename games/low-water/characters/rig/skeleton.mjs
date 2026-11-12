// The Low Water skeleton: one joint tree for every person in Gullet, scaled per character by a
// proportions record. Pure math, runs in Node and the browser.
//
// Space: +Y up, +Z the way the character faces, +X the character's left. Every joint's rest frame is
// the identity; a pose rotates joints in their parent's frame. Poses are written in semantic
// channels (degrees) so clips read like a choreographer's notes:
//   spine joints (pelvis, spine, chest, neck, head): bend (forward +), side (toward own left +), turn (to own left +)
//   clav: lift (shrug +), fwd (forward +)
//   arm, thigh: fwd (swing forward +), out (away from the body +), twist
//   fore: bend (elbow, forward +), twist;  shin: bend (knee, back +);  hand: bend, side;  foot: bend (toe down +)
//   root: x y z (metres, character space), yaw (deg, to own left +), pitch (forward +), roll
//   skirt: swing (the panel's hem forward +), sway (outward +); hang: swing, sway (world vertical)
const D2R = Math.PI / 180;

export const JOINTS = [
  ["root", null], ["pelvis", "root"], ["spine", "pelvis"], ["chest", "spine"], ["neck", "chest"], ["head", "neck"],
  ["clavL", "chest"], ["armL", "clavL"], ["foreL", "armL"], ["handL", "foreL"],
  ["clavR", "chest"], ["armR", "clavR"], ["foreR", "armR"], ["handR", "foreR"],
  ["thighL", "pelvis"], ["shinL", "thighL"], ["footL", "shinL"],
  ["thighR", "pelvis"], ["shinR", "thighR"], ["footR", "shinR"],
  ["hangL", "handL"], ["hangR", "handR"], ["hangB", "pelvis"],
  ["skirtL", "pelvis"], ["skirtR", "pelvis"],   // coat-skirt panels: driven by springs at run time (secondary motion)   // hanging things (a lantern in a hand or on the belt): they keep to the vertical
];
export const INDEX = Object.fromEntries(JOINTS.map(([n], i) => [n, i]));

// Rest offsets from the parent, metres, from a proportions record (see cast/*.mjs).
//   h height (crown, standing straight), leg (hip height / h), head (head height, m),
//   neck (neck length, m), shoulder (half width, m), hip (half width, m), arm (shoulder to wrist, m),
//   hand (m), stoop (deg, the habitual forward set of the chest)
export function restOffsets(P) {
  const hip = P.h * P.leg, thigh = hip * 0.52, shin = hip * 0.44, ankle = hip * 0.04;
  const torso = P.h - hip - P.head - P.neck, upper = P.arm * 0.53, fore = P.arm * 0.47;
  return {
    root: [0, hip, 0], pelvis: [0, 0, 0], spine: [0, torso * 0.3, 0], chest: [0, torso * 0.42, 0],
    neck: [0, torso * 0.28, 0], head: [0, P.neck, 0],
    clavL: [P.shoulder * 0.25, torso * 0.22, -0.02], armL: [P.shoulder * 0.75, 0, 0], foreL: [0, -upper, 0], handL: [0, -fore, 0],
    clavR: [-P.shoulder * 0.25, torso * 0.22, -0.02], armR: [-P.shoulder * 0.75, 0, 0], foreR: [0, -upper, 0], handR: [0, -fore, 0],
    thighL: [P.hip, -0.02, 0], shinL: [0, -thigh, 0], footL: [0, -shin, 0],
    thighR: [-P.hip, -0.02, 0], shinR: [0, -thigh, 0], footR: [0, -shin, 0],
    hangL: [0, -0.1, 0.015], hangR: [0, -0.1, 0.015], hangB: [P.hip + 0.1, -0.04, 0.12], skirtL: [P.hip + 0.04, -0.06, 0], skirtR: [-P.hip - 0.04, -0.06, 0],
    _ankle: ankle,
  };
}

// 3 x 3 matrices, row-major arrays of 9.
export const mul = (a, b) => [
  a[0] * b[0] + a[1] * b[3] + a[2] * b[6], a[0] * b[1] + a[1] * b[4] + a[2] * b[7], a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
  a[3] * b[0] + a[4] * b[3] + a[5] * b[6], a[3] * b[1] + a[4] * b[4] + a[5] * b[7], a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
  a[6] * b[0] + a[7] * b[3] + a[8] * b[6], a[6] * b[1] + a[7] * b[4] + a[8] * b[7], a[6] * b[2] + a[7] * b[5] + a[8] * b[8]];
export const apply = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
export const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const rx = (a) => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
const ry = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
const rz = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
// yaw, then pitch, then roll
const euler = (x, y, z) => mul(mul(ry(y * D2R), rx(x * D2R)), rz(z * D2R));

// Semantic channels of one joint to its local rotation.
function localRot(name, c = {}) {
  const side = name.endsWith("L") ? 1 : name.endsWith("R") ? -1 : 0, base = side ? name.slice(0, -1) : name;
  switch (base) {
    case "root": return euler(c.pitch || 0, c.yaw || 0, c.roll || 0);
    case "pelvis": case "spine": case "chest": case "neck": case "head": return euler(c.bend || 0, c.turn || 0, -(c.side || 0));
    case "clav": return euler(-(c.fwd || 0), 0, side * (c.lift || 0));
    case "arm": case "thigh": return mul(euler(-(c.fwd || 0), 0, side * (c.out || 0)), ry(side * (c.twist || 0) * D2R));
    case "fore": return mul(rx(-(c.bend || 0) * D2R), ry(side * (c.twist || 0) * D2R));
    case "shin": return rx((c.bend || 0) * D2R);
    case "hand": return euler(-(c.bend || 0), 0, side * (c.side || 0));
    case "foot": return rx((c.bend || 0) * D2R);
    case "skirt": return euler(-(c.swing || 0), 0, side * (c.sway || 0));
  }
  return I3;
}

// Forward kinematics. pose: { joint: channels }. Returns per-joint { R (world 3x3), p (world pos) }
// in character space (root at the feet origin), plus the rest offsets.
export function solve(P, pose = {}, rest = restOffsets(P)) {
  const out = new Array(JOINTS.length);
  for (let i = 0; i < JOINTS.length; i++) {
    const [name, parent] = JOINTS[i], c = pose[name] || {};
    let L = localRot(name, c);
    if (name === "chest") L = mul(rx((P.stoop || 0) * D2R), L);   // the habitual stoop lives in the chest
    if (name === "neck") L = mul(rx(-(P.stoop || 0) * 0.6 * D2R), L);   // the head comes back up to look ahead
    if (!parent) {
      const off = rest.root, t = [(c.x || 0) + off[0], (c.y || 0) + off[1], (c.z || 0) + off[2]];
      out[i] = { R: L, p: t };
    } else {
      const pa = out[INDEX[parent]], off = rest[name], w = apply(pa.R, off);
      // a hanging joint swings about the world vertical (swing forward +, sway to own left +), not with the hand
      const R = name.startsWith("hang") ? mul(out[0].R, euler(-(c.swing || 0), 0, -(c.sway || 0))) : mul(pa.R, L);
      out[i] = { R, p: [pa.p[0] + w[0], pa.p[1] + w[1], pa.p[2] + w[2]] };
    }
  }
  return out;
}

// The rest (bind) frames: solve with an empty pose and no stoop, for skinning.
export function bind(P) { return solve({ ...P, stoop: 0 }, {}); }

// Mirror a pose left to right (a dodge left from a dodge right, a mirrored talk gesture).
export function mirror(pose) {
  const o = {};
  for (const [k, c] of Object.entries(pose)) {
    const k2 = k.endsWith("L") ? k.slice(0, -1) + "R" : k.endsWith("R") ? k.slice(0, -1) + "L" : k, c2 = { ...c };
    for (const f of ["side", "turn", "yaw", "roll", "x"]) if (f in c2) c2[f] = -c2[f];
    o[k2] = c2;
  }
  return o;
}
