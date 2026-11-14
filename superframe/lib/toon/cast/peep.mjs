// peep.mjs: PEEP, the guide. A walking eyeball with a camera aperture for a pupil, a teal lid it wears like a
// beanie, backward-bending stilt legs and sneakers two sizes too big. Peep is the commons' witness: it never talks,
// it looks, and it carries a loupe because nothing vouches for itself. Design rules: the iris is always amber and
// always six blades; the aperture is the face (open = taking it in, pinhole = it has seen enough); the lid is the
// brow; the veins come out only when something is wrong. No mouth, ever.
import { ellipse, curve, star } from '../geom.mjs';
import { add3 } from '../rig.mjs';
import { rngFrom } from '../../seed.mjs';

export const PEEP = {
  id: 'peep', name: 'Peep', role: 'guide: the walking witness',
  palette: { ball: '#f7f2e3', ballShade: '#d9cfb4', iris: '#e3962a', irisShade: '#b86d1c', pupil: '#120f0c', lid: '#2c7c83', lidShade: '#1d5a60', vein: '#c8363b', leg: '#f2ead6', sock: '#d94a3a', shoe: '#e8e3d6', shoeShade: '#b5ad99', sole: '#d94a3a', glove: '#fbf8ee', loupe: '#3a3530', glass: '#bfe0e6' },
};

const R = 210;
const onBall = (c, lon, lat, out = 0) => { const r = R + out, a = lon * Math.PI / 180, b = lat * Math.PI / 180; return add3(c, [r * Math.sin(a) * Math.cos(b), -r * Math.sin(b), r * Math.cos(a) * Math.cos(b)]); };

function veins(c, amount) {
  if (amount <= 0) return [];
  const r = rngFrom('peep/veins'), out = [];
  for (let v = 0; v < 9; v++) {
    let lon = (v / 9) * 140 - 70 + r() * 10, lat = (r() - 0.5) * 80; const pts = [];
    const tlon = lon * 0.25, tlat = lat * 0.25;
    for (let k = 0; k < 6; k++) { pts.push(onBall(c, lon, lat, 2)); lon += (tlon - lon) * 0.25 + (r() - 0.5) * 12; lat += (tlat - lat) * 0.25 + (r() - 0.5) * 12; }
    out.push({ id: `vein${v}`, kind: 'stroke', path: pts, w: 0.35 + 0.5 * amount, color: PEEP.palette.vein, clip: 'ball', bias: 1, taper: [0.1, 0.9] });
  }
  return out;
}

// The aperture: a hexagonal opening plus six blade edges running from its corners to the iris rim.
function aperture(c, open, spin) {
  const P = PEEP.palette, rIris = 100, rOpen = 12 + 70 * open, rot = spin + open * 0.6, base = onBall(c, 0, 0, 0);
  const hex = star(0, 0, rOpen, rOpen, 3, rot);
  const blades = [];
  for (let k = 0; k < 6; k++) {
    const a = rot + (k / 6) * Math.PI * 2 - Math.PI / 2, p = [rOpen * Math.cos(a), rOpen * Math.sin(a)], b = a + 1.25;
    const q = [rIris * Math.cos(b), rIris * Math.sin(b)];
    blades.push({ id: `blade${k}`, stick: true, kind: 'stroke', path: [0, 0.5, 1].map(t => add3(base, [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, 4])), w: 0.45, color: P.irisShade, clip: 'iris', bias: 3, taper: [0, 0.6] });
  }
  return [
    { id: 'iris', kind: 'morph', at: add3(base, [0, 0, 1]), front: ellipse(0, 0, rIris, rIris, 64), side: ellipse(0, 0, 14, rIris, 32), fill: P.iris, shade: { fill: P.irisShade, off: 0.2 }, clip: 'ball', bias: 2, inkW: 0.8 },
    ...blades,
    { id: 'pupil', stick: true, kind: 'morph', at: add3(base, [0, 0, 6]), front: hex, side: ellipse(0, 0, 3, rOpen), fill: P.pupil, clip: 'iris', bias: 4, inkW: 0 },
    { id: 'glint', kind: 'morph', at: add3(base, [-44, 6, 8]), front: ellipse(0, 0, 20, 13, 20, -0.5), side: ellipse(0, 0, 3, 12), fill: '#ffffff', clip: 'ball', bias: 5, inkW: 0 },
  ];
}

// pose: { expr: { aperture 0..1, lid 0..1, lidTilt, veins 0..1, squash, squint 0..1, tear }, step (walk phase), loupe }
export function buildPeep(pose = {}) {
  const P = PEEP.palette, e = pose.expr ?? {}, sq = e.squash ?? 1, ph = (pose.step ?? 0) * Math.PI * 2, bob = Math.abs(Math.sin(ph)) * 18;
  const c = [0, -560 - bob, 0], lid = e.lid ?? 0.3, tilt = e.lidTilt ?? 0, ball = ellipse(0, 0, R / Math.sqrt(sq), R * sq, 72);
  const legs = ['L', 'R'].flatMap((s, i) => {
    const sx = s === 'L' ? 1 : -1, sw = Math.sin(ph + i * Math.PI) * (pose.step !== undefined ? 70 : 0), lift = Math.max(0, Math.cos(ph + i * Math.PI)) * (pose.step !== undefined ? 30 : 0);
    const hip = add3(c, [sx * 80, 170, 0]), ankle = [sx * 95, -40 - lift, sw], knee = [sx * 100, -230 - lift * 0.5, sw * 0.5 - 70];
    return [
      { id: `leg${s}`, kind: 'tube', path: [hip, knee, ankle], r: [16, 13, 12], fill: P.leg, shade: { fill: P.ballShade }, bias: -3 },
      { id: `sock${s}`, kind: 'tube', path: [add3(ankle, [0, -70, 0]), ankle], r: [17, 17], fill: P.sock, bias: -2.5 },
      { id: `shoe${s}`, kind: 'morph', at: add3(ankle, [0, 4, 40]), front: curve([[-62, -38], [62, -38], [74, 20], [54, 42], [-54, 42], [-74, 20]]), side: curve([[-70, -40], [20, -46], [96, -10], [124, 18], [110, 44], [-80, 44], [-86, 0]]), fill: P.shoe, shade: { fill: P.shoeShade }, bias: -2 },
      { id: `sole${s}`, kind: 'morph', at: add3(ankle, [0, 40, 40]), front: curve([[-60, -6], [60, -6], [58, 8], [-58, 8]]), side: curve([[-84, -6], [122, -6], [118, 8], [-82, 8]]), fill: P.sole, inkW: 0.6, bias: -1.9 },
    ];
  });
  const handR = add3(c, [-260, 60, 120]), handL = add3(c, [250, 110 + Math.sin(ph) * 20, 30]);
  const arms = [
    { id: 'armL', kind: 'tube', path: [add3(c, [190, 40, 0]), add3(c, [240, 90, 20]), handL], r: [11, 10, 10], fill: P.leg, bias: 1 },
    { id: 'armR', kind: 'tube', path: [add3(c, [-190, 40, 0]), add3(c, [-250, 40, 80]), handR], r: [11, 10, 10], fill: P.leg, bias: 600 },
    { id: 'gloveL', kind: 'morph', at: handL, front: ellipse(0, 0, 30, 34), side: ellipse(0, 0, 22, 34), fill: P.glove, shade: { fill: P.ballShade }, bias: 2 },
    { id: 'gloveR', kind: 'morph', at: handR, front: ellipse(0, 0, 30, 34), side: ellipse(0, 0, 22, 34), fill: P.glove, shade: { fill: P.ballShade }, bias: 602 },
  ];
  if (pose.loupe !== false) arms.push(
    { id: 'loupeHandle', kind: 'tube', path: [add3(handR, [0, 30, 0]), add3(handR, [-20, -60, 0])], r: [10, 12], fill: P.loupe, bias: 601 },
    { id: 'loupe', kind: 'morph', at: add3(handR, [-40, -140, 0]), front: ellipse(0, 0, 70, 70, 48), side: ellipse(0, 0, 14, 70), fill: P.glass, opacity: 0.45, inkW: 1.6, bias: 603 },
  );
  const lidY = -R * sq + 2 * R * sq * lid, cap = [[-R * 1.15, -R * 1.3], [R * 1.15, -R * 1.3], [R * 1.15, lidY - tilt * 60], [-R * 1.15, lidY + tilt * 60]];
  const shell = { id: 'lid', kind: 'morph', at: c, front: ellipse(0, 0, R / Math.sqrt(sq) + 10, R * sq + 10, 72), side: ellipse(0, 0, R / Math.sqrt(sq) + 10, R * sq + 10, 72), fill: P.lid, shade: { fill: P.lidShade, off: 0.1 }, bias: 400 };
  const lidParts = lid > 0.01 ? [{ ...shell, id: 'lidMask', fill: P.lid, opacity: 0, inkW: 0, shade: undefined, bias: 399 }, { id: 'lidCap', kind: 'morph', at: c, front: cap, side: cap, fill: P.lid, shade: { fill: P.lidShade, off: 0.12 }, clip: 'lidMask', bias: 401, inkW: 1.3 }] : [];
  const squint = (e.squint ?? 0) > 0 ? [{ id: 'lower', kind: 'morph', at: c, front: [[-R * 1.2, R * 1.4], [R * 1.2, R * 1.4], [R * 1.2, R * sq * (1 - 2 * e.squint)], [-R * 1.2, R * sq * (1 - 2 * e.squint)]], side: [[-R * 1.2, R * 1.4], [R * 1.2, R * 1.4], [R * 1.2, R * sq * (1 - 2 * e.squint)], [-R * 1.2, R * sq * (1 - 2 * e.squint)]], fill: P.lid, clip: 'lidMask', bias: 402, inkW: 1.2 }] : [];
  const tear = e.tear ? [{ id: 'tear', kind: 'flat', at: onBall(c, -25, -35, 30), shape: curve([[0, -30], [16, 6], [0, 24], [-16, 6]]), fill: '#9fd3e6', bias: 700, inkW: 0.7 }] : [];
  const hairs = [{ id: 'sprout', kind: 'stroke', path: [onBall(c, 0, 88, 0), add3(c, [10, -R * sq - 70, 0]), add3(c, [50, -R * sq - 110, 0]), add3(c, [30, -R * sq - 140, 0])], w: 0.8, bias: 450, taper: [0, 0.8] }];
  return [
    ...legs,
    { id: 'ball', kind: 'morph', at: c, front: ball, side: ball, fill: P.ball, shade: { fill: P.ballShade, off: 0.14 }, inkW: 1.25 },
    ...veins(c, e.veins ?? 0.25), ...aperture(c, e.aperture ?? 0.45, 0.2), ...arms, ...lidParts, ...squint, ...tear, ...hairs,
  ];
}
