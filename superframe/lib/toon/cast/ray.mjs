// ray.mjs: RAY PRUITT, county water-meter reader, 51. Everyday and deadpan. A long face that has heard it all,
// a push-broom moustache, tinted aviators, a polo tucked hard into khakis over a gut he carries like a toolbox.
// Design rules: the head is a long egg with the weight in the jaw; the eyes sit close and half-lidded behind the
// lenses; nothing on him is exaggerated past what a real man in a county truck looks like. The comedy is timing.
import { ellipse, curve, roundRect, mirrored } from '../geom.mjs';
import { standing, add3, mid3 } from '../rig.mjs';
import { eye, brow, mouth, nose, ear, surfX } from '../face.mjs';
import { limbs, neck, sym } from './human.mjs';

export const RAY = {
  id: 'ray', name: 'Ray Pruitt', role: 'everyday: county water-meter reader',
  palette: {
    skin: '#eec4a0', skinShade: '#c99474', shirt: '#5e9b93', shirtShade: '#3f736c', pants: '#c8b386', pantsShade: '#9f8a60',
    shoe: '#6a4a30', shoeShade: '#4a3220', hair: '#6c5944', hairShade: '#4d3f30', lens: '#c9d7c4', belt: '#3f2d21', cup: '#f3f0e6',
  },
};

const HEAD_FRONT = sym([[0, -128], [62, -120], [86, -70], [90, 10], [84, 80], [62, 120], [0, 134]]);
const HEAD_SIDE = curve([[-10, -130], [60, -112], [92, -40], [100, 20], [112, 46], [96, 78], [92, 112], [50, 132], [-20, 120], [-70, 70], [-96, -10], [-80, -90]]);
const TORSO_FRONT = sym([[0, -180], [78, -178], [124, -150], [134, -100], [126, -20], [140, 70], [134, 150], [0, 178]]);
const TORSO_SIDE = curve([[-30, -182], [40, -178], [84, -120], [100, -30], [138, 70], [118, 150], [50, 180], [-62, 178], [-92, 110], [-88, 0], [-80, -130]]);
const SEAT_FRONT = sym([[0, -60], [142, -58], [150, 30], [100, 80], [0, 64]]);
const SEAT_SIDE = curve([[-80, -60], [90, -60], [110, 20], [60, 70], [-70, 76], [-110, 20]]);

export function buildRay(pose = {}) {
  const P = RAY.palette, e = pose.expr ?? {}, rig = standing({ u: 6.2, side: pose.side ?? 'R', pelvisDeg: pose.pelvis ?? 5, shoulderDeg: -4, stance: 24 });
  const head = { id: 'head', kind: 'morph', at: add3(rig.neck, [pose.lean ?? 0, -135, 6]), rx: 90, ry: 128, rz: 100, front: HEAD_FRONT, side: HEAD_SIDE, fill: P.skin, shade: { fill: P.skinShade, off: 0.12 }, bias: 0.5 };
  const sip = pose.sip ?? 0, cupTarget = mid3(add3(rig.shoulderR, [-10, 260, 60]), add3(head.at, [-10, 70, 130]), sip);
  const L = limbs(rig, { ...P, k: 1 }, { arms: { R: { wrist: cupTarget, pole: add3(rig.shoulderR, [-120, 120, -160]), bias: sip > 0.3 ? 2 : 0 } } });
  const hip = rig.hipMid, chest = mid3(rig.neck, hip, 0.5);
  const parts = [
    ...L.parts, neck(rig, head, P, 48),
    { id: 'seat', kind: 'morph', at: add3(hip, [0, -6, 0]), front: sym([[0, -60], [124, -58], [128, 30], [90, 80], [0, 64]]), side: SEAT_SIDE, fill: P.pants, shade: { fill: P.pantsShade }, aim: [rig.neck, hip], bias: -1.2 },
    { id: 'torso', kind: 'morph', at: add3(chest, [0, 20, 0]), front: TORSO_FRONT, side: TORSO_SIDE, fill: P.shirt, shade: { fill: P.shirtShade }, aim: [rig.neck, hip], bias: -1 },
    { id: 'belt', kind: 'morph', at: add3(hip, [0, -62, 8]), front: roundRect(0, 0, 286, 26, 6), side: roundRect(20, 0, 250, 26, 6), fill: P.belt, aim: [rig.neck, hip], bias: -0.8 },
    { id: 'buckle', kind: 'morph', at: add3(hip, [0, -62, 150]), front: roundRect(0, 0, 44, 32, 5), side: roundRect(0, 0, 8, 32, 3), fill: '#b9a46a', inkW: 0.6, bias: 2, hide: t => Math.cos(t) < 0.2 },
    { id: 'collar', kind: 'morph', at: add3(rig.neck, [0, 0, 30]), front: sym([[0, -14], [48, -20], [54, 2], [22, 16], [0, 4]]), side: curve([[-50, -20], [40, -20], [50, 20], [-50, 20]]), fill: P.shirt, shade: { fill: P.shirtShade }, bias: 0.2 },
    head,
    ...ear('earL', head, { dy: 0, rx: 30, ry: 40, shade: { fill: P.skinShade } }, 1), ...ear('earR', head, { dy: 0, rx: 30, ry: 40, shade: { fill: P.skinShade } }, -1),
    { id: 'fringeL', kind: 'morph', at: add3(head.at, [76, -40, -30]), front: ellipse(0, 0, 30, 48), side: ellipse(0, 0, 70, 50), fill: P.hair, shade: { fill: P.hairShade }, bias: -0.2 },
    { id: 'fringeR', kind: 'morph', at: add3(head.at, [-76, -40, -30]), front: ellipse(0, 0, 30, 48), side: ellipse(0, 0, 70, 50), fill: P.hair, shade: { fill: P.hairShade }, bias: -0.2 },
    { id: 'fringeBack', kind: 'morph', at: add3(head.at, [0, 0, -70]), front: ellipse(0, 0, 92, 46), side: ellipse(0, 0, 60, 50), fill: P.hair, shade: { fill: P.hairShade }, bias: -0.1, hide: t => Math.cos(t) > 0.3 },
    { id: 'shine', kind: 'morph', at: surfX(head, -28, -96, 2), front: ellipse(0, 0, 26, 12, 24, -0.4), side: ellipse(0, 0, 14, 10), fill: '#f8dfc4', inkW: 0, clip: 'head', bias: 1 },
    ...['L', 'R'].flatMap(s => { const x = s === 'L' ? 33 : -33, o = { x, dy: -8, rx: 25, ry: 29, lidFill: P.skin }; return [...eye(`eye${s}`, head, o, { lid: 0.45, ...e }), ...brow(`brow${s}`, head, { ...o, color: P.hair }, e)]; }),
    ...nose('nose', head, { dy: 30, rx: 24, ry: 22, shade: { fill: P.skinShade, off: 0.25 } }),
    ...mouth('mouth', head, { dy: 92, width: 74 }, e),
    { id: 'stache', kind: 'morph', at: surfX(head, 0, 64, 16), front: sym([[0, -16], [30, -20], [56, -6], [60, 18], [30, 14], [0, 12]]), side: curve([[-6, -16], [28, -12], [34, 14], [-10, 16]]), fill: P.hair, shade: { fill: P.hairShade, off: 0.3 }, bias: 7, boil: 1.4 },
    ...['L', 'R'].map(s => ({ id: `lens${s}`, kind: 'morph', at: surfX(head, s === 'L' ? 36 : -36, -4, 22), front: curve(s === 'L' ? [[-36, -28], [36, -30], [42, 6], [24, 34], [-18, 32], [-38, 8]] : [[-36, -30], [36, -28], [38, 8], [18, 32], [-24, 34], [-42, 6]]), side: ellipse(0, 0, 6, 30), fill: P.lens, opacity: 0.42, inkW: 0.7, bias: 8, hide: t => Math.cos(t) < -0.05 })),
    { id: 'bridge', hide: t => Math.cos(t) < 0.2, kind: 'stroke', path: [surfX(head, -8, -22, 26), surfX(head, 0, -26, 28), surfX(head, 8, -22, 26)], w: 0.8, bias: 8 },
    { id: 'cup', kind: 'morph', at: add3(L.hands.R, [0, -40, 30]), front: [[-28, -40], [28, -40], [21, 40], [-21, 40]], side: [[-28, -40], [28, -40], [21, 40], [-21, 40]], fill: P.cup, shade: { fill: '#d6d0c0' }, bias: 3 },
  ];
  return parts;
}
