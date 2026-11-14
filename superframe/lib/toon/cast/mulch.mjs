// mulch.mjs: MULCH, the shredder of records, as a type. An office shredder that grew a face where the slot was:
// a mouth of cutter teeth across its whole front, two googly eyes on stalks, a smoked plastic bin for a belly
// that you can see the confetti through, four rubber feet and a power cord it drags like a tail. It is not evil.
// It is hungry, and someone keeps feeding it the minutes. Design rules: the mouth is the full width of the head;
// strips of ruled paper always hang from it; the eyes never look at the same thing; the belly shows what it ate.
import { ellipse, curve, roundRect } from '../geom.mjs';
import { add3 } from '../rig.mjs';
import { dots } from './patterns.mjs';
import { rngFrom } from '../../seed.mjs';

export const MULCH = {
  id: 'mulch', name: 'Mulch', role: 'grotesque type: the shredder of records',
  palette: { body: '#b8bcb4', bodyShade: '#8a8f86', lid: '#5a5f5a', lidShade: '#3e423e', bin: '#7d8a8e', binShade: '#5b676b', confetti: '#f2eee2', mouth: '#1d1515', steel: '#dfe2dc', paper: '#f5f2e7', rule: '#8fb2d8', eye: '#fbf9f0', foot: '#1f1c1b', cord: '#2b2a2a', plug: '#d8d2c0', gum: '#9a3f48' },
};

function teeth(id, at, wide, h, dir, n = 11) {
  const C = [], step = (2 * wide) / n;
  C.push([-wide, -dir * h]);
  for (let i = 0; i < n; i++) { C.push([-wide + i * step, 0]); C.push([-wide + (i + 0.5) * step, dir * h]); }
  C.push([wide, 0]); C.push([wide, -dir * h]);
  return { id, stick: true, kind: 'morph', at, front: C, side: [[-10, -dir * h], [10, -dir * h], [10, dir * h], [-10, dir * h]], fill: MULCH.palette.steel, clip: 'mouth', inkW: 0.5, bias: 5 };
}

function strips(at, open, n = 7) {
  const r = rngFrom('mulch/strips'), out = [];
  for (let i = 0; i < n; i++) {
    const x = -130 + i * 44 + r() * 10, L = 80 + r() * 160 + open * 60, curl = (r() - 0.5) * 40;
    const C = curve([[-11, 0], [11, 0], [11 + curl * 0.5, L * 0.6], [13 + curl, L], [-9 + curl, L], [-11 + curl * 0.5, L * 0.6]], { seg: 4 });
    out.push({ id: `strip${i}`, kind: 'morph', at: add3(at, [x, 0, 6 + i * 0.1]), front: C, side: C.map(([px, py]) => [px * 0.3, py]), fill: MULCH.palette.paper, inkW: 0.5, bias: 8,
      pattern: (K, A, Cs, k) => ruled(K, A, k) });
  }
  return out;
}
// Ruled lines across a strip (blue rules every 22 units), drawn horizontally in screen space.
function ruled(K, A, k) {
  const G = 22 * k;
  for (let y = 0; y < A.h; y++) { const Y = y + A.y0, d = Math.abs(((Y % G) + G) % G - G / 2); if (d > 1) continue;
    for (let x = 0; x < A.w; x++) { const a = A.a[y * A.w + x] * (1 - d); if (a <= 0) continue; const p = 3 * (Y * K.w + x + A.x0); K.px[p] += (0.27 - K.px[p]) * a; K.px[p + 1] += (0.45 - K.px[p + 1]) * a; K.px[p + 2] += (0.69 - K.px[p + 2]) * a; } }
}

// pose: { expr: { open 0..1, look [x, y] per eye pair, lid 0..1, sweat }, chew (0..1 phase), squash }
export function buildMulch(pose = {}) {
  const P = MULCH.palette, e = pose.expr ?? {}, open = e.open ?? 0.35, sq = pose.squash ?? 1, top = -520 * sq;
  const head = [0, -390 * sq, 0], bin = [0, -170, 0];
  const lookL = e.look ?? [0.4, -0.2], lookR = e.lookR ?? [-0.5, 0.3];
  const eyeAt = s => add3(head, [s * 90, top + 390 * sq - 170 * sq - 40, 40]);
  const eyes = [1, -1].flatMap(s => { const at = eyeAt(s), lk = s > 0 ? lookL : lookR, r = s > 0 ? 58 : 50; return [
    { id: `stalk${s}`, kind: 'tube', path: [add3(head, [s * 80, -120 * sq, 20]), add3(at, [0, 40, -10])], r: [16, 12], fill: P.lid, bias: -0.5 },
    { id: `eye${s}`, kind: 'morph', at, front: ellipse(0, 0, r, r * 1.08), side: ellipse(0, 0, r * 0.9, r * 1.08), fill: P.eye, inkW: 1, bias: 2 },
    { id: `pupil${s}`, kind: 'morph', at: add3(at, [lk[0] * r * 0.45, lk[1] * r * 0.45, r * 0.5]), front: ellipse(0, 0, r * 0.38, r * 0.38), side: ellipse(0, 0, r * 0.15, r * 0.38), fill: '#141110', clip: `eye${s}`, inkW: 0, bias: 3 },
    ...((e.lid ?? 0) > 0 ? [{ id: `lid${s}`, kind: 'morph', at: add3(at, [0, 0, r * 0.6]), front: [[-r * 1.3, -r * 1.3], [r * 1.3, -r * 1.3], [r * 1.3, -r + 2 * r * e.lid], [-r * 1.3, -r + 2 * r * e.lid]], side: [[-r, -r * 1.3], [r, -r * 1.3], [r, -r + 2 * r * e.lid], [-r, -r + 2 * r * e.lid]], fill: P.body, clip: `eye${s}`, inkW: 0.8, bias: 4 }] : []),
  ]; });
  const mouthH = 24 + 150 * open, mouthAt = add3(head, [0, 10, 135]);
  const parts = [
    { id: 'cord', kind: 'tube', path: [add3(bin, [-60, 100, -120]), [-180, -20, -260], [-320, -14, -200], [-420, -10, -60]], r: [12, 12, 12, 12], fill: P.cord, bias: -5 },
    { id: 'plug', kind: 'morph', at: [-450, -24, -40], front: roundRect(0, 0, 50, 40, 6), side: roundRect(0, 0, 60, 40, 6), fill: P.plug, inkW: 0.7, bias: -4 },
    ...[[-120, 110], [120, 110], [-120, -110], [120, -110]].map(([x, z], i) => ({ id: `foot${i}`, kind: 'morph', at: [x, -22, z], front: roundRect(0, 0, 70, 44, 14), side: roundRect(0, 0, 70, 44, 14), fill: P.foot, bias: -3 })),
    { id: 'bin', kind: 'morph', at: bin, front: curve([[-170, -130], [170, -130], [150, 130], [-150, 130]], { seg: 3 }), side: curve([[-130, -130], [130, -130], [116, 130], [-116, 130]], { seg: 3 }), fill: P.bin, shade: { fill: P.binShade }, bias: -1, pattern: dots(P.confetti, { gap: 30, r: 5 }) },
    { id: 'head', kind: 'morph', at: head, front: roundRect(0, 0, 400 / Math.sqrt(sq), 300 * sq, 40), side: roundRect(0, 0, 300, 300 * sq, 40), fill: P.body, shade: { fill: P.bodyShade, off: 0.12 }, bias: 0 },
    { id: 'lidTop', kind: 'morph', at: add3(head, [0, -120 * sq, 4]), front: roundRect(0, 0, 410 / Math.sqrt(sq), 64, 26), side: roundRect(0, 0, 310, 64, 26), fill: P.lid, shade: { fill: P.lidShade }, bias: 1 },
    { id: 'switch', kind: 'morph', at: add3(head, [130, -124 * sq, 60]), front: roundRect(0, 0, 50, 26, 8), side: roundRect(0, 0, 30, 26, 8), fill: e.on === false ? '#5a5f5a' : '#58c26a', inkW: 0.6, bias: 1.5 },
    { id: 'mouth', kind: 'morph', at: mouthAt, front: roundRect(0, 0, 330, mouthH, Math.min(20, mouthH / 2)), side: roundRect(0, 0, 20, mouthH, 6), fill: P.mouth, inkW: 1.1, bias: 4, hide: t => Math.cos(t) < 0.05 },
    { id: 'gum', stick: true, kind: 'morph', at: add3(mouthAt, [0, mouthH * 0.25, 1]), front: ellipse(0, 0, 120, mouthH * 0.3), side: ellipse(0, 0, 8, mouthH * 0.3), fill: P.gum, clip: 'mouth', inkW: 0, bias: 4.5 },
    teeth('teethTop', add3(mouthAt, [0, -mouthH / 2, 2]), 165, 16 + 18 * open, 1),
    teeth('teethBot', add3(mouthAt, [0, mouthH / 2, 2]), 165, 16 + 18 * open, -1),
    ...strips(add3(mouthAt, [0, mouthH / 2 - 6, 4]), open),
    ...eyes,
    ...[1, -1].map(s => ({ id: `arm${s}`, kind: 'tube', path: [add3(head, [s * 195, 40, 30]), add3(head, [s * 250, 110, 80]), add3(head, [s * 230 + (pose.wave ?? 0) * s * 60, 190 - (pose.wave ?? 0) * 240, 120])], r: [16, 14, 12], fill: P.lid, bias: 6 })),
    ...[1, -1].map(s => ({ id: `mitt${s}`, kind: 'morph', at: add3(head, [s * 230 + (pose.wave ?? 0) * s * 60, 200 - (pose.wave ?? 0) * 240, 130]), front: ellipse(0, 0, 26, 30), side: ellipse(0, 0, 20, 30), fill: P.body, shade: { fill: P.bodyShade }, bias: 7 })),
  ];
  if (e.sweat) parts.push(...[[-210, -640], [200, -600]].map(([x, y], i) => ({ id: `sweat${i}`, kind: 'flat', at: [x, y, 300], shape: curve([[0, -30], [16, 6], [0, 24], [-16, 6]]), fill: '#bfe6f2', inkW: 0.7, bias: 30 })));
  return parts;
}
