// gulp.mjs: GULP, the engagement algorithm as a creature. A phone-shaped slab of a body whose screen is a lamprey
// mouth: rings of hooked teeth around a throat that goes down forever. Little red notification eyes bloom all over
// it. Its arms end in thumbs. It has no legs; it rides an endless scroll of cards that it lays down ahead of itself
// and eats behind itself. When it wants you it wears a smiley sticker over the mouth (the lure). Design rules: the
// body is always a phone slab; the eyes are notification red and never blink together; the tail never ends on
// screen; the lure is the only round friendly shape on it, and it is stuck on crooked.
import { ellipse, curve, roundRect, star } from '../geom.mjs';
import { add3 } from '../rig.mjs';
import { rngFrom } from '../../seed.mjs';

export const GULP = {
  id: 'gulp', name: 'Gulp', role: 'grotesque type: the engagement algorithm',
  palette: { body: '#3b2c59', bodyShade: '#251a3b', bezel: '#1a1426', gum: '#ef6c93', gumShade: '#b8406a', throat: '#2a0d16', tooth: '#fbf1d6', eye: '#e3262f', eyeShade: '#a3131b', pupil: '#fff6ea', thumb: '#e8a98c', thumbShade: '#bf7a60', nail: '#f6dccd', card: '#f6f3ec', cardShade: '#d1ccbf', heart: '#e3262f', lure: '#f6c81e', lureShade: '#d39c0c' },
};

function lamprey(at, open, spin) {
  const P = GULP.palette, rr = 150 + 30 * open, parts = [
    { id: 'gums', kind: 'morph', at, front: ellipse(0, 0, rr, rr * 1.15, 64), side: ellipse(0, 0, 24, rr * 1.15), fill: P.gum, shade: { fill: P.gumShade, off: 0.15 }, clip: 'screen', inkW: 1, bias: 2 },
    { id: 'throat', stick: true, kind: 'morph', at: add3(at, [0, 0, 2]), front: ellipse(0, 0, rr * (0.25 + 0.3 * open), rr * 1.15 * (0.25 + 0.3 * open), 48), side: ellipse(0, 0, 6, rr * 0.4), fill: P.throat, clip: 'gums', inkW: 0.8, bias: 4 },
  ];
  [[0.93, 22, 26], [0.72, 16, 22], [0.52, 12, 18]].forEach(([f, n, len], ring) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + spin * (ring % 2 ? -1 : 1) + ring * 0.2, cx = Math.cos(a) * rr * f, cy = Math.sin(a) * rr * 1.15 * f;
      const ang = a + Math.PI / 2 + 0.5, inward = [-Math.cos(a), -Math.sin(a)];
      const tip = [cx + inward[0] * len * 1.6 + Math.cos(ang) * 8, cy + inward[1] * len * 1.6 + Math.sin(ang) * 8];
      const C = [[cx + Math.cos(ang) * len * 0.5, cy + Math.sin(ang) * len * 0.5], tip, [cx - Math.cos(ang) * len * 0.5, cy - Math.sin(ang) * len * 0.5]];
      parts.push({ id: `tooth${ring}.${i}`, stick: true, kind: 'morph', at: add3(at, [0, 0, 3 + ring]), front: C, side: C.map(([x, y]) => [x * 0.05, y]), fill: P.tooth, clip: 'gums', inkW: 0.35, bias: 3 + ring * 0.1 });
    }
  });
  return parts;
}

function scroll(phase) {
  const P = GULP.palette, out = [];
  for (let i = 0; i < 9; i++) {
    const t = i + (phase % 1), x = 30 + t * 112, y = -190 + t * 16 - Math.sin(t * 0.9) * 22, z = -30 - t * 34;
    out.push({ id: `card${i}`, kind: 'flat', at: [x, y, z], shape: roundRect(0, 0, 150, 96, 12), fill: P.card, shade: { fill: P.cardShade, off: 0.2 }, inkW: 0.7, bias: -10 - i });
    out.push({ id: `heart${i}`, kind: 'flat', at: [x - 36, y - 10, z + 1], shape: curve([[0, -6], [10, -16], [20, -6], [0, 16], [-20, -6], [-10, -16]]), fill: P.heart, inkW: 0, clip: `card${i}`, bias: -9.9 - i });
    out.push({ id: `line${i}`, kind: 'flat', at: [x + 24, y - 10, z + 1], shape: roundRect(0, 0, 70, 12, 6), fill: P.cardShade, inkW: 0, clip: `card${i}`, bias: -9.8 - i });
  }
  return out;
}

// pose: { expr: { open 0..1, lure bool, spin, blink (0..1 phase) }, scroll (phase), reach 0..1 }
export function buildGulp(pose = {}) {
  const P = GULP.palette, e = pose.expr ?? {}, c = [0, -560, 0], sway = Math.sin((pose.scroll ?? 0) * 2) * 10, reach = pose.reach ?? 0;
  const r = rngFrom('gulp/eyes'), eyes = [];
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + r() * 0.4, x = Math.cos(a) * 150, y = Math.sin(a) * 320 + 20, rad = 14 + r() * 20, shut = ((e.blink ?? 0) * 7 + i * 0.37) % 1 < 0.12;
    const at = add3(c, [x + sway, y, 92]);
    eyes.push({ id: `ne${i}`, kind: 'morph', at, front: ellipse(0, 0, rad, shut ? rad * 0.15 : rad), side: ellipse(0, 0, rad * 0.2, shut ? rad * 0.15 : rad), fill: P.eye, shade: { fill: P.eyeShade, off: 0.25 }, clip: 'body', inkW: 0.5, bias: 5 });
    if (!shut) eyes.push({ id: `nep${i}`, stick: true, kind: 'morph', at: add3(at, [rad * 0.15, -rad * 0.1, 2]), front: ellipse(0, 0, rad * 0.32, rad * 0.32), side: ellipse(0, 0, rad * 0.1, rad * 0.3), fill: P.pupil, clip: `ne${i}`, inkW: 0, bias: 6 });
  }
  const thumbs = [1, -1].flatMap(s => {
    const sh = add3(c, [s * 175, -150, 10]), el = add3(c, [s * 330, -40 - reach * 120, 60 + reach * 100]), tip = add3(c, [s * (300 + reach * 120), -260 - reach * 160, 150 + reach * 160]);
    return [
      { id: `arm${s}`, kind: 'tube', path: [sh, el, tip], r: [34, 30, 40], fill: P.thumb, shade: { fill: P.thumbShade }, bias: 8 },
      { id: `nail${s}`, kind: 'morph', at: add3(tip, [0, -12, 30]), front: roundRect(0, 0, 50, 40, 14), side: roundRect(0, 0, 16, 40, 8), fill: P.nail, inkW: 0.6, bias: 9 },
    ];
  });
  const slab = roundRect(0, 0, 360, 720, 70), side = roundRect(0, 0, 110, 720, 40);
  const mouthAt = add3(c, [sway, 40, 70]);
  const parts = [
    ...scroll(pose.scroll ?? 0),
    { id: 'body', kind: 'morph', at: add3(c, [sway, 0, 0]), front: slab, side, fill: P.body, shade: { fill: P.bodyShade, off: 0.1 }, inkW: 1.3 },
    { id: 'screen', kind: 'morph', at: add3(c, [sway, 40, 56]), front: roundRect(0, 0, 320, 440, 40), side: roundRect(0, 0, 10, 440, 6), fill: P.bezel, clip: 'body', inkW: 0.8, bias: 1, hide: t => Math.cos(t) < 0.05 },
    ...lamprey(mouthAt, e.open ?? 0.5, e.spin ?? 0),
    ...eyes,
    { id: 'speaker', kind: 'morph', at: add3(c, [sway, -320, 58]), front: roundRect(0, 0, 90, 14, 7), side: roundRect(0, 0, 4, 14, 3), fill: P.bezel, clip: 'body', inkW: 0, bias: 1, hide: t => Math.cos(t) < 0.05 },
    ...thumbs,
  ];
  const drop = e.lureDrop ?? 0, lureAt = add3(mouthAt, [10 + drop * 160, -10 + drop * drop * 900, 40 + drop * 60]), dr = -0.18 - drop * 1.4;
  const onLure = (dx, dy, dz) => { const c = Math.cos(dr + 0.18), s = Math.sin(dr + 0.18); return add3(lureAt, [c * dx - s * dy, s * dx + c * dy, dz]); };
  if (e.lure) parts.push(
    { id: 'lure', kind: 'morph', at: lureAt, front: ellipse(0, 0, 150, 150, 64), side: ellipse(0, 0, 8, 150), rot: dr, fill: P.lure, shade: { fill: P.lureShade, off: 0.12 }, inkW: 1.1, bias: 20, hide: t => Math.cos(t) < 0.05 },
    ...[-1, 1].map(s => ({ id: `lureEye${s}`, stick: true, kind: 'morph', at: onLure(s * 50, -40, 4), front: ellipse(0, 0, 14, 30), side: ellipse(0, 0, 3, 30), fill: '#2a1d0a', inkW: 0, clip: 'lure', bias: 21 })),
    { id: 'lureSmile', stick: true, kind: 'stroke', path: [-1, -0.5, 0, 0.5, 1].map(t => onLure(t * 90, 50 + (1 - t * t) * 40 - t * 10, 6)), w: 1.4, color: '#2a1d0a', clip: 'lure', bias: 22 },
    { id: 'lureGlint', stick: true, kind: 'morph', at: onLure(-80, -70, 5), front: star(0, 0, 22, 7, 4), side: ellipse(0, 0, 2, 20), fill: '#fffbe8', inkW: 0, clip: 'lure', bias: 23 },
  );
  return parts;
}
