// darlene.mjs: DARLENE VOSS, night-desk clerk at the county records office, 47. Everyday and deadpan. Teased hair
// set like a helmet, blue shadow on lids that never fully lift, reading glasses on a beaded chain, a mauve cardigan
// with the sleeves pushed up, an ID lanyard she has stopped noticing. She knows where every record is and which
// ones are gone. Design rules: the hair is one solid mass that moves only with the head; the mouth is a thin coral
// line that barely changes; all her acting is in the lids and the timing of the blink.
import { ellipse, curve, roundRect } from '../geom.mjs';
import { standing, add3, mid3 } from '../rig.mjs';
import { eye, brow, mouth, nose, ear, surfX } from '../face.mjs';
import { limbs, neck, sym } from './human.mjs';

export const DARLENE = {
  id: 'darlene', name: 'Darlene Voss', role: 'everyday: county records clerk, night desk',
  palette: {
    skin: '#f2cdb0', skinShade: '#cf9f84', shirt: '#a77a9a', shirtShade: '#7d5674', pants: '#38425e', pantsShade: '#252c42',
    shoe: '#2a2320', shoeShade: '#171210', hair: '#d6b25e', hairShade: '#a8853b', shadow: '#aac3e2', blouse: '#e8dcc6', lip: '#c8584a', lanyard: '#c23b2f', badge: '#f6f3ea',
  },
};

const HEAD_FRONT = sym([[0, -110], [58, -104], [80, -60], [82, 10], [70, 74], [44, 108], [0, 120]]);
const HEAD_SIDE = curve([[-10, -112], [56, -96], [84, -30], [90, 30], [80, 78], [60, 112], [10, 120], [-50, 80], [-84, 0], [-70, -80]]);
const HAIR_SIDE = curve([[-30, -232], [70, -214], [120, -150], [110, -90], [70, -80], [60, -40], [10, 10], [-60, 60], [-150, 30], [-170, -80], [-140, -180]]);
const HAIR_BACK = sym([[0, -232], [96, -222], [156, -170], [172, -80], [160, 40], [110, 74], [0, 70]]);
const TORSO_FRONT = sym([[0, -160], [70, -160], [116, -136], [120, -60], [112, 20], [128, 110], [130, 170], [0, 176]]);
const TORSO_SIDE = curve([[-30, -162], [40, -156], [86, -100], [96, -30], [80, 40], [96, 130], [80, 176], [-70, 176], [-92, 100], [-80, -20], [-76, -120]]);

export function buildDarlene(pose = {}) {
  const P = DARLENE.palette, e = pose.expr ?? {}, rig = standing({ u: 5.6, side: pose.side ?? 'L', pelvisDeg: pose.pelvis ?? 6, shoulderDeg: -3, stance: 20 });
  const head = { id: 'head', kind: 'morph', at: add3(rig.neck, [pose.lean ?? 0, -118, 8]), rx: 82, ry: 112, rz: 88, front: HEAD_FRONT, side: HEAD_SIDE, fill: P.skin, shade: { fill: P.skinShade, off: 0.12 }, bias: 0.5 };
  const hand = pose.hand ?? 0, deskR = add3(rig.shoulderR, [-30, 230, 140]);
  const L = limbs(rig, { ...P, k: 0.92, longSleeves: true, thigh: 1.15 }, { arms: { R: { wrist: mid3(add3(rig.shoulderR, [-36, 262, 10]), deskR, hand), pole: add3(rig.shoulderR, [-100, 120, -160]) } } });
  const chest = mid3(rig.neck, rig.hipMid, 0.5), aim = [rig.neck, rig.hipMid];
  const badgeAt = add3(chest, [0, 70, 108]);
  return [
    ...L.parts, neck(rig, head, P, 40),
    { id: 'hips', kind: 'morph', at: add3(rig.hipMid, [0, 0, 0]), front: sym([[0, -60], [124, -56], [132, 40], [96, 86], [0, 70]]), side: curve([[-80, -60], [90, -60], [104, 30], [50, 80], [-90, 80], [-120, 20]]), fill: P.pants, shade: { fill: P.pantsShade }, aim, bias: -1.2 },
    { id: 'blouse', kind: 'morph', at: add3(chest, [0, -10, 10]), front: sym([[0, -160], [44, -160], [12, -40], [0, -30]]), side: ellipse(30, -100, 50, 60), fill: P.blouse, aim, bias: -1.1 },
    { id: 'torso', kind: 'morph', at: add3(chest, [0, 10, 0]), front: TORSO_FRONT, side: TORSO_SIDE, fill: P.shirt, shade: { fill: P.shirtShade }, aim, bias: -1,
      pattern: undefined },
    { id: 'lanyard', kind: 'stroke', path: [add3(rig.neck, [-50, 10, 40]), add3(chest, [-20, 0, 105]), badgeAt, add3(chest, [20, 0, 105]), add3(rig.neck, [50, 10, 40])], w: 1.4, color: P.lanyard, bias: 2, hide: t => Math.cos(t) < 0.2 },
    { id: 'badge', kind: 'morph', at: add3(badgeAt, [0, 40, 4]), front: roundRect(0, 0, 70, 90, 8), side: roundRect(0, 0, 8, 90, 3), fill: P.badge, inkW: 0.7, bias: 3, hide: t => Math.cos(t) < 0.2 },
    { id: 'badgePhoto', kind: 'morph', at: add3(badgeAt, [0, 30, 6]), front: roundRect(0, 0, 40, 40, 4), side: roundRect(0, 0, 4, 40, 2), fill: P.shadow, clip: 'badge', inkW: 0.4, bias: 4 },
    { id: 'hairBack', kind: 'morph', at: add3(head.at, [0, 40, -40]), front: HAIR_BACK, back: HAIR_BACK, side: HAIR_SIDE, fill: P.hair, shade: { fill: P.hairShade, off: 0.1 }, bias: -0.4, boil: 1.3 },
    head,
    ...ear('earL', head, { dy: 6, rx: 26, ry: 34, shade: { fill: P.skinShade } }, 1), ...ear('earR', head, { dy: 6, rx: 26, ry: 34, shade: { fill: P.skinShade } }, -1),
    { id: 'hairFront', kind: 'morph', at: add3(head.at, [0, 40, 30]), front: sym([[0, -236], [80, -226], [118, -170], [96, -120], [40, -128], [0, -118]]), side: curve([[-40, -236], [60, -220], [112, -160], [96, -122], [30, -128], [-40, -140]]), fill: P.hair, shade: { fill: P.hairShade, off: 0.1 }, bias: 1.2, hide: t => Math.cos(t) < -0.2, boil: 1.3 },
    ...['L', 'R'].flatMap(s => { const x = s === 'L' ? 31 : -31, o = { x, dy: -4, rx: 23, ry: 26, lidFill: P.shadow, lidInk: 1 }; return [...eye(`eye${s}`, head, o, { lid: 0.55, ...e }), ...brow(`brow${s}`, head, { ...o, color: P.hairShade, w: 0.8 }, e)]; }),
    ...nose('nose', head, { dy: 30, rx: 13, ry: 14, shade: { fill: P.skinShade, off: 0.3 } }),
    ...mouth('mouth', head, { dy: 72, width: 56, w: 1.3, inside: '#5a2220' }, e),
    { id: 'lip', kind: 'stroke', path: [-1, 0, 1].map(t => surfX(head, t * 22, 70 + Math.abs(t) * 2, 3)), w: 1.6, color: P.lip, clip: 'head', bias: 4.5, hide: () => (e.mouth?.open ?? 0) > 0.05 },
    { id: 'chain', kind: 'stroke', path: [surfX(head, 78, 0, 6), add3(head.at, [92, 110, 40]), add3(rig.neck, [60, 40, 60]), add3(chest, [0, -60, 100]), add3(rig.neck, [-60, 40, 60]), add3(head.at, [-92, 110, 40]), surfX(head, -78, 0, 6)], w: 0.5, color: '#b0894a', bias: 5, hide: t => Math.cos(t) < 0.2 },
    ...['L', 'R'].map(s => ({ id: `glass${s}`, kind: 'morph', at: add3(chest, [s === 'L' ? 26 : -26, -64, 112]), front: roundRect(0, 0, 44, 30, 12), side: ellipse(0, 0, 5, 15), fill: '#dfe7ea', opacity: 0.5, inkW: 0.6, bias: 6, hide: t => Math.cos(t) < 0.2 })),
  ];
}
