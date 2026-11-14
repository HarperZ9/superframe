// face.mjs: features that ride on a head part. A head is { id, at, rx, rz } (half width from the front, half depth
// from the side). Features are placed on that ellipsoid by their front-view x offset, so a face is authored the way
// it is drawn on a model sheet, and the turnaround follows from the head's shape.
// Expression vocabulary (every key optional):
//   lid 0..1 (upper lid drop; deadpan sits near 0.5), lidTilt (+ angry, - sad), pupil (scale), look [x, y] -1..1,
//   brow [raise, angle], mouth { kind: 'line' | 'open' | 'grin' | 'o', curve, width, open (0..1, through rig.jaw) }.
import { ellipse, mirrored, roundRect } from './geom.mjs';
import { jaw } from './rig.mjs';

export function surfX(head, x, dy, out = 0) {
  const s = Math.max(-0.999, Math.min(0.999, x / head.rx)), lon = Math.asin(s), squash = Math.sqrt(Math.max(0, 1 - (dy / (head.ry ?? head.rx * 1.3)) ** 2));
  return [head.at[0] + (head.rx + out) * s * squash, head.at[1] + dy, head.at[2] + (head.rz + out) * Math.cos(lon) * squash];
}
const thin = (C, k = 0.22) => C.map(([x, y]) => [x * k, y]);

// One eye: white, pupil, upper lid. o: { x, dy, rx, ry, white, lidFill, pupilFill, out }.
export function eye(id, head, o, e = {}) {
  const at = surfX(head, o.x, o.dy, o.out ?? 0), lid = e.lid ?? 0.3, tilt = (e.lidTilt ?? 0) * Math.sign(o.x || 1), look = e.look ?? [0, 0];
  const W = ellipse(0, 0, o.rx, o.ry, 48), pr = o.rx * 0.32 * (e.pupil ?? 1);
  const lidY = -o.ry + 2 * o.ry * lid, lidC = [[-o.rx * 1.4, -o.ry * 1.6], [o.rx * 1.4, -o.ry * 1.6], [o.rx * 1.4, lidY - tilt * o.ry * 0.5], [-o.rx * 1.4, lidY + tilt * o.ry * 0.5]];
  const P = [0.5 * o.rx * look[0], 0.45 * o.ry * look[1] + (lid > 0.4 ? (lid - 0.4) * o.ry * 0.6 : 0)];
  const parts = [
    { id: `${id}`, kind: 'morph', at, front: W, side: thin(W), fill: o.white ?? '#fbf8ee', clip: head.id, inkW: o.inkW ?? 0.65, bias: 1 },
    { id: `${id}.pupil`, kind: 'morph', at: [at[0] + P[0], at[1] + P[1], at[2] + 2], front: ellipse(0, 0, pr, pr * (o.pupilTall ?? 1), 24), side: ellipse(0, 0, pr * 0.3, pr * (o.pupilTall ?? 1), 24), fill: o.pupilFill ?? '#17120e', clip: id, inkW: 0, bias: 2 },
  ];
  if (lid > 0.02) parts.push({ id: `${id}.lid`, kind: 'morph', at: [at[0], at[1], at[2] + 3], front: lidC, side: thin(lidC, 0.3), fill: o.lidFill ?? head.fill, clip: id, inkW: o.lidInk ?? 0.8, bias: 3 });
  return parts;
}

// A brow as an inked stroke over an eye.
export function brow(id, head, o, e = {}) {
  const [raise, angle] = e.brow ?? [0, 0], sx = Math.sign(o.x || 1), y0 = o.dy - o.ry * 1.25 - raise * o.ry * 0.8;
  const pts = [-1, -0.33, 0.33, 1].map(t => { const x = o.x + t * o.rx * 1.15; return surfX(head, x, y0 + (t * sx) * angle * o.ry * 0.5 - (1 - t * t) * o.ry * 0.12, 3); });
  return [{ id, kind: 'stroke', path: pts, w: o.w ?? 1.1, clip: head.id, bias: 4, taper: [0.3, 0.5], color: o.color }];
}

// The mouth. o: { x, dy, width, inside, tongue, teeth, lip }.
export function mouth(id, head, o, e = {}) {
  const m = e.mouth ?? { kind: 'line' }, wd = (m.width ?? 1) * o.width, J = jaw(m.open ?? 0), base = surfX(head, o.x ?? 0, o.dy, 2);
  if (m.kind === 'line' || (m.kind !== 'grin' && J.open < 0.02)) {
    const pts = [-1, -0.5, 0, 0.5, 1].map(t => surfX(head, (o.x ?? 0) + t * wd / 2, o.dy - (m.curve ?? 0) * (1 - t * t) * o.width * 0.25 + (m.skew ?? 0) * t * o.width * 0.1, 3));
    return [{ id, kind: 'stroke', path: pts, w: o.w ?? 1.0, clip: head.id, bias: 4, taper: [0.25, 0.25] }];
  }
  const h = m.kind === 'grin' ? o.width * 0.32 * (0.4 + (m.open ?? 0.5)) : o.width * 0.75 * J.open + o.width * 0.06, half = wd / 2;
  const top = -(m.curve ?? 0) * o.width * 0.12;
  const C = m.kind === 'o' ? ellipse(0, h * 0.4, wd * 0.22, h * 0.6, 32)
    : mirrored([[0, top - h * 0.12], [half * 0.6, top - h * 0.05], [half, top + (m.curve ?? 0) * -o.width * 0.12], [half * 0.55, h * (0.75 + J.drop)], [0, h * (0.95 + J.drop)]], { seg: 6 });
  const at = [base[0], base[1] + J.fwd * o.width * 0.1, base[2]], parts = [{ id, kind: 'morph', at, front: C, side: thin(C, 0.2), fill: o.inside ?? '#4a1d1c', clip: head.id, inkW: 0.9, bias: 4 }];
  if (m.kind !== 'o') parts.push({ id: `${id}.tongue`, kind: 'morph', at: [at[0], at[1] + h * 0.85, at[2] + 1], front: ellipse(0, 0, half * 0.55, h * 0.35, 24), side: ellipse(0, 0, half * 0.12, h * 0.35), fill: o.tongue ?? '#c4555a', clip: id, inkW: 0.4, bias: 5 });
  if (o.teeth !== false) parts.push({ id: `${id}.teeth`, kind: 'morph', at: [at[0], at[1] + top - h * 0.1, at[2] + 2], front: o.teethShape ?? roundRect(0, 0, wd * 0.95, Math.max(h * 0.32, o.width * 0.09), 3), side: thin(roundRect(0, 0, wd, h * 0.3, 3), 0.15), fill: o.teethFill ?? '#f4efdc', clip: id, inkW: 0.45, bias: 6, pattern: o.teethPattern });
  return parts;
}

// A bulb nose that sticks out of the face (front: blob; side: a wedge toward +x).
export function nose(id, head, o) {
  const at = surfX(head, 0, o.dy, o.out ?? head.rz * 0.18);
  return [{ id, kind: 'morph', at, front: o.front ?? ellipse(0, 0, o.rx, o.ry, 40), side: o.side ?? mirrored([[0, -o.ry * 1.6], [o.rx * 1.3, o.ry * 0.2], [o.rx * 0.6, o.ry], [0, o.ry * 0.8]]), fill: o.fill ?? head.fill, shade: o.shade, inkW: 0.85, bias: 5 }];
}

// An ear at the side of the head; hidden from the far side by the depth sort.
export function ear(id, head, o, sign) {
  const at = [head.at[0] + sign * head.rx * 0.95, head.at[1] + o.dy, head.at[2] - head.rz * 0.1];
  const F = ellipse(0, 0, o.rx * 0.45, o.ry, 32), S = ellipse(0, 0, o.rx, o.ry, 32);
  return [{ id, kind: 'morph', at, front: F, side: S, fill: o.fill ?? head.fill, shade: o.shade, inkW: 0.8 }];
}
