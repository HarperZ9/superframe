// human.mjs: the limbs every everyday human in the cast shares, hung on the lib/body skeleton (rig.standing).
// Legs are tubes through the solved hip, knee and ankle; shoes and hands are morph parts aimed down their bones;
// arms reach with rig.ik2, so a raised cup or a pointed finger is a target, never a hand-placed elbow.
import { curve, ellipse, mirrored } from '../geom.mjs';
import { ik2, add3 } from '../rig.mjs';

export const MITTEN = curve([[0, -20], [26, -14], [34, 20], [30, 52], [12, 66], [-12, 64], [-28, 46], [-30, 18], [-44, 2], [-40, -12], [-24, -14]]);
export const MITTEN_SIDE = curve([[0, -20], [14, -10], [16, 30], [8, 62], [-8, 62], [-16, 30], [-14, -10]]);
const SHOE = ellipse(0, 0, 58, 34, 40);
const SHOE_SIDE = curve([[-50, -30], [10, -34], [60, -18], [92, 4], [84, 30], [-60, 30], [-66, 0]]);

// One arm: sleeve on the upper bone (short or long), skin or sleeve on the forearm, a hand at the wrist.
function arm(tag, sh, o, s, k) {
  const l1 = 150 * k, l2 = 140 * k, { elbow, wrist } = ik2(sh, o.wrist, l1, l2, o.pole);
  const sleeveEnd = s.longSleeves ? elbow : add3(sh, elbow.map((v, i) => (v - sh[i]) * 0.55));
  const fore = s.longSleeves ? s.shirt : s.skin, bias = o.bias ?? 0;
  const parts = [
    { id: `arm${tag}.upper`, kind: 'tube', path: [sh, s.longSleeves ? elbow : sleeveEnd], r: [36 * k, 30 * k], fill: s.longSleeves ? s.shirt : s.skin, shade: { fill: s.longSleeves ? s.shirtShade : s.skinShade }, bias },
    { id: `arm${tag}.fore`, kind: 'tube', path: [s.longSleeves ? elbow : sleeveEnd, elbow, wrist], r: [27 * k, 25 * k, 21 * k], fill: fore, shade: { fill: s.longSleeves ? s.shirtShade : s.skinShade }, bias },
  ];
  if (!s.longSleeves) parts.push({ id: `arm${tag}.sleeve`, kind: 'tube', path: [sh, sleeveEnd], r: [48 * k, 40 * k], fill: s.shirt, shade: { fill: s.shirtShade }, bias: bias + 0.5 });
  const hand = { id: `hand${tag}`, kind: 'morph', at: add3(wrist, [0, 0, 1]), front: tag === 'L' ? MITTEN.map(([x, y]) => [-x * k, y * k]) : MITTEN.map(([x, y]) => [x * k, y * k]), side: MITTEN_SIDE.map(([x, y]) => [x * k, y * k]), aim: [elbow, wrist], fill: s.skin, shade: { fill: s.skinShade }, bias: bias + 1 };
  parts.push(hand);
  return { parts, elbow, wrist };
}

// Legs, shoes and arms. rig: rig.standing() output. s: palette and options. pose.arms: { L, R } targets.
export function limbs(rig, s, pose = {}) {
  const k = s.k ?? 1, parts = [];
  for (const tag of ['L', 'R']) {
    const hip = rig[`hip${tag}`], knee = rig[`knee${tag}`], ankle = rig[`ankle${tag}`];
    parts.push({ id: `leg${tag}`, kind: 'tube', path: [hip, knee, ankle], r: [50 * k * (s.thigh ?? 1), 40 * k, 33 * k], fill: s.pants, shade: { fill: s.pantsShade }, bias: -2 });
    parts.push({ id: `shoe${tag}`, kind: 'morph', at: add3(ankle, [0, -6 * k, 26 * k]), front: SHOE.map(([x, y]) => [x * k, y * k]), side: SHOE_SIDE.map(([x, y]) => [x * k, y * k]), fill: s.shoe, shade: { fill: s.shoeShade }, bias: -1 });
  }
  const hang = (sh, sx) => ({ wrist: add3(sh, [sx * 40 * k, 285 * k, 10 * k]), pole: add3(sh, [sx * 40 * k, 150 * k, -200 * k]) });
  const L = arm('L', rig.shoulderL, pose.arms?.L ?? hang(rig.shoulderL, 1), s, k), R = arm('R', rig.shoulderR, pose.arms?.R ?? hang(rig.shoulderR, -1), s, k);
  parts.push(...L.parts, ...R.parts);
  return { parts, hands: { L: L.wrist, R: R.wrist }, elbows: { L: L.elbow, R: R.elbow } };
}

// A neck tube from the collar into the head.
export const neck = (rig, head, s, r = 40) => ({ id: 'neck', kind: 'tube', path: [add3(rig.neck, [0, 20, -10]), add3(head.at, [0, head.ry * 0.62, -10])], r: [r, r * 0.95], fill: s.skin, shade: { fill: s.skinShade, off: 0.3 }, depthOf: ['head', -0.01] });

// Scale a half profile by k (helper for mirrored shapes).
export const sym = (half, k = 1, opts) => mirrored(half.map(([x, y]) => [x * k, y * k]), opts);
