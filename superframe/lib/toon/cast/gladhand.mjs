// gladhand.mjs: GLAD-HAND, the lobbyist, as a type and never as anyone. A refrigerator of a pinstripe suit on
// legs too short to carry it, a small head that is mostly grin, two rows of teeth too many, a hand held out that is
// bigger than the head it belongs to. He sweats. He is always about to shake on it. Design rules: the hand is the
// largest single shape; the grin breaks the head's outline on both sides; the eyes are tiny, close and wet; the tie
// hangs past the belt like a tongue. Grotesque is in the proportions and the close-up; no real face is referenced.
import { ellipse, curve, roundRect } from '../geom.mjs';
import { add3 } from '../rig.mjs';
import { eye, surfX } from '../face.mjs';
import { sym, MITTEN, MITTEN_SIDE } from './human.mjs';
import { stripes } from './patterns.mjs';

export const GLADHAND = {
  id: 'gladhand', name: 'Glad-Hand', role: 'grotesque type: the lobbyist',
  palette: { skin: '#f0a58c', skinShade: '#c46f5c', suit: '#27304d', suitShade: '#161c31', stripe: '#6b7499', shirt: '#f3efe2', tie: '#c8232c', tieShade: '#8e1219', hair: '#2a2119', hairShine: '#5b4a3a', gum: '#e07783', teeth: '#fbf4dc', shoe: '#141110', gold: '#d9b44a', sweat: '#bfe6f2', case: '#6e3b22', caseShade: '#4b2614' },
};

function grin(head, e) {
  const P = GLADHAND.palette, open = e.mouth?.open ?? 0.45, wide = (e.mouth?.width ?? 1) * 150, h = 40 + 70 * open, at = surfX(head, 0, 56, 6);
  if (e.mouth?.kind === 'o') return [{ id: 'mouth', kind: 'morph', at, front: ellipse(0, 20, 34, 46), side: ellipse(0, 20, 8, 46), fill: '#3d1316', bias: 6, inkW: 1, hide: t => Math.cos(t) < -0.1 }];
  const C = sym([[0, -h * 0.25], [wide * 0.6, -h * 0.5], [wide, -h * 0.95], [wide * 0.9, -h * 0.3], [wide * 0.55, h * 0.55], [0, h * 0.75]]);
  const teeth = [];
  for (let row = 0; row < 2; row++) for (let i = -7; i <= 7; i++) {
    const x = i * wide * 0.125, y = row ? h * 0.35 - Math.abs(i) * 1.5 : -h * 0.32 - Math.abs(i) ** 1.6 * 2.2;
    teeth.push({ id: `tooth${row}${i}`, stick: true, kind: 'morph', at: add3(at, [x, y, 4 + row]), front: roundRect(0, 0, wide * 0.115, h * 0.42, 6), side: roundRect(0, 0, 6, h * 0.42, 3), fill: P.teeth, clip: 'mouth', inkW: 0.45, bias: 7 + row * 0.1 });
  }
  return [
    { id: 'mouth', kind: 'morph', at, front: C, side: curve([[-10, -h * 0.4], [40, -h * 0.5], [46, h * 0.4], [-10, h * 0.6]]), fill: '#3d1316', bias: 6, inkW: 1.2, hide: t => Math.cos(t) < -0.1 },
    { id: 'gums', stick: true, kind: 'morph', at: add3(at, [0, -h * 0.55, 2]), front: sym([[0, -h * 0.4], [wide * 1.1, -h * 0.9], [wide * 1.1, 0], [0, h * 0.12]]), side: ellipse(0, 0, 40, h * 0.3), fill: P.gum, clip: 'mouth', inkW: 0.5, bias: 6.5 },
    ...teeth,
  ];
}

export function buildGladhand(pose = {}) {
  const P = GLADHAND.palette, e = pose.expr ?? {}, reach = pose.reach ?? 1, sweat = e.sweat ?? 1;
  const hipY = -260, chest = [0, -560, 0], neck = [0, -900, 0];
  const head = { id: 'head', kind: 'morph', at: add3(neck, [0, -70, 20]), rx: 105, ry: 110, rz: 105, front: sym([[0, -110], [70, -104], [100, -50], [108, 30], [96, 90], [0, 120]]), side: curve([[-10, -112], [70, -96], [104, -20], [112, 60], [80, 112], [-30, 116], [-96, 40], [-90, -70]]), fill: P.skin, shade: { fill: P.skinShade, off: 0.12 } };
  const hand = add3(chest, [-140 - 160 * reach, -40, 200 + 180 * reach]);
  const legs = ['L', 'R'].flatMap(s => { const sx = s === 'L' ? 1 : -1; return [
    { id: `leg${s}`, kind: 'tube', path: [[sx * 70, hipY, 0], [sx * 76, -130, 4], [sx * 80, -30, 6]], r: [44, 38, 30], fill: P.suit, shade: { fill: P.suitShade }, bias: -3, pattern: stripes(P.stripe, { gap: 22, w: 2.5 }) },
    { id: `shoe${s}`, kind: 'morph', at: [sx * 86, -18, 40], front: ellipse(0, 0, 44, 24), side: curve([[-50, -22], [60, -20], [140, 14], [-50, 22]]), fill: P.shoe, bias: -2 },
  ]; });
  const torso = { id: 'torso', kind: 'morph', at: chest, front: sym([[0, -320], [190, -330], [250, -280], [240, -40], [210, 200], [150, 300], [0, 320]]), side: curve([[-80, -320], [120, -310], [190, -150], [210, 120], [140, 300], [-120, 300], [-170, 120], [-150, -260]]), fill: P.suit, shade: { fill: P.suitShade, off: 0.1 }, pattern: stripes(P.stripe, { gap: 24, w: 2.5 }), bias: -1 };
  const parts = [
    ...legs, torso,
    { id: 'shirt', kind: 'morph', at: add3(chest, [0, -220, 150]), front: sym([[0, -110], [70, -110], [10, 120], [0, 130]]), side: ellipse(0, 0, 8, 100), fill: P.shirt, clip: 'torso', bias: 1, hide: t => Math.cos(t) < 0.15 },
    { id: 'tie', kind: 'morph', at: add3(chest, [0, 60, 205]), front: curve([[0, -330], [30, -316], [20, -290], [36, 200], [0, 330], [-36, 200], [-20, -290], [-30, -316]]), side: ellipse(0, 0, 6, 300), fill: P.tie, shade: { fill: P.tieShade, off: 0.3 }, bias: 3, hide: t => Math.cos(t) < 0.15 },
    { id: 'pin', kind: 'morph', at: add3(chest, [110, -200, 170]), front: curve([[0, -20], [14, -6], [6, 4], [6, 28], [-6, 28], [-6, 4], [-14, -6]]), side: ellipse(0, 0, 3, 20), fill: P.gold, inkW: 0.5, bias: 3, hide: t => Math.cos(t) < 0.15 },
    { id: 'neck', kind: 'tube', path: [add3(neck, [0, 30, 0]), add3(head.at, [0, 60, 0])], r: [95, 90], fill: P.skin, shade: { fill: P.skinShade }, depthOf: ['head', -0.01] },
    head,
    { id: 'hair', kind: 'morph', at: add3(head.at, [0, -40, -6]), front: sym([[0, -100], [80, -96], [118, -40], [112, 20], [96, -10], [40, -60], [0, -64]]), side: curve([[-40, -100], [70, -90], [100, -40], [60, -50], [-60, -20], [-120, 30], [-116, -50]]), fill: P.hair, bias: 2, boil: 0.6 },
    ...[-60, -20, 20, 60].map((x, i) => ({ id: `comb${i}`, kind: 'stroke', path: [-1, 0, 1].map(t => add3(head.at, [x + t * 40, -120 + Math.abs(t) * 18 + (x * x) / 160, 70 - (x * x) / 200])), w: 0.5, color: P.hairShine, clip: 'hair', bias: 3 })),
    ...eye('eyeL', head, { x: 26, dy: -20, rx: 15, ry: 15, lidFill: P.skinShade, white: '#f6eadd' }, { lid: 0.3, pupil: 1.4, ...e }),
    ...eye('eyeR', head, { x: -22, dy: -18, rx: 12, ry: 12, lidFill: P.skinShade, white: '#f6eadd' }, { lid: 0.25, pupil: 1.5, ...e }),
    ...[1, -1].map(s => ({ id: `bag${s}`, kind: 'stroke', path: [-1, 0, 1].map(t => surfX(head, s * 24 + t * 20, 0 + (1 - t * t) * 6, 3)), w: 0.45, clip: 'head', bias: 4 })),
    { id: 'nose', kind: 'morph', at: surfX(head, 0, 14, 24), front: ellipse(0, 0, 26, 18), side: curve([[-10, -20], [30, -8], [34, 14], [-10, 18]]), fill: P.skin, shade: { fill: P.skinShade, off: 0.3 }, bias: 5 },
    ...[1, -1].map(s => ({ id: `nostril${s}`, kind: 'morph', at: surfX(head, s * 10, 18, 44), front: ellipse(0, 0, 6, 8), side: ellipse(0, 0, 2, 7), fill: '#5a1f22', clip: 'nose', inkW: 0, bias: 6, hide: t => Math.cos(t) < 0.3 })),
    ...grin(head, e),
    { id: 'armR', kind: 'tube', path: [add3(chest, [-200, -230, 20]), add3(chest, [-260, -80, 120 * reach]), hand], r: [62, 56, 50], fill: P.suit, shade: { fill: P.suitShade }, pattern: stripes(P.stripe, { gap: 24, w: 2.5, deg: 30 }), bias: 20 },
    { id: 'cuff', kind: 'tube', path: [add3(hand, [30, -20, -30]), hand], r: [44, 44], fill: P.shirt, bias: 21 },
    { id: 'handR', kind: 'morph', at: add3(hand, [-30, 20, 30]), front: MITTEN.map(([x, y]) => [x * 3.1, y * 3.1]), side: MITTEN_SIDE.map(([x, y]) => [x * 3.1, y * 3.1]), rot: -1.1, fill: P.skin, shade: { fill: P.skinShade }, bias: 22 },
    { id: 'ring', kind: 'morph', at: add3(hand, [-90, -10, 60]), front: ellipse(0, 0, 22, 16), side: ellipse(0, 0, 8, 16), fill: P.gold, inkW: 0.6, bias: 23 },
    { id: 'armL', kind: 'tube', path: [add3(chest, [210, -230, 0]), add3(chest, [270, -40, 20]), add3(chest, [260, 140, 60])], r: [62, 56, 50], fill: P.suit, shade: { fill: P.suitShade }, pattern: stripes(P.stripe, { gap: 24, w: 2.5 }), bias: 10 },
    { id: 'case', kind: 'morph', at: add3(chest, [270, 300, 70]), front: roundRect(0, 0, 70, 220, 18), side: roundRect(0, 0, 300, 220, 22), fill: P.case, shade: { fill: P.caseShade }, bias: 11 },
    { id: 'caseMouth', kind: 'stroke', path: [-1, -0.5, 0, 0.5, 1].map(t => add3(chest, [270, 300 + Math.sin(t * 9) * 8, 70 + t * 130])), w: 0.7, bias: 12, hide: t => Math.abs(Math.sin(t)) < 0.4 },
    { id: 'handL', kind: 'morph', at: add3(chest, [262, 170, 70]), front: MITTEN.map(([x, y]) => [-x * 1.3, y * 1.3]), side: MITTEN_SIDE.map(([x, y]) => [x * 1.3, y * 1.3]), fill: P.skin, shade: { fill: P.skinShade }, bias: 12 },
  ];
  if (sweat > 0) parts.push(...[[-150, -1050, 1], [150, -1020, 0.8], [-170, -960, 0.7], [120, -1110, 0.9]].map(([x, y, s], i) => ({ id: `sweat${i}`, kind: 'flat', at: [x, y, 200], shape: curve([[0, -34 * s], [18 * s, 8 * s], [0, 26 * s], [-18 * s, 8 * s]]), fill: P.sweat, inkW: 0.7, bias: 30 })));
  return parts;
}
