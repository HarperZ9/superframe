// letter.mjs: words for sheets, captions and the PSA card, set in the house family from the typeface forge and
// returned as closed contours, so lettering boils, inks and prints like every other shape in the cartoon.
import { mintMaster } from '../../../typeface/forge/family/family.mjs';
import { flatten } from '../../../typeface/forge/family/svg.mjs';
import { contourToPolyline } from '../fill.mjs';

const masters = new Map();
function master(style, weight) {
  const k = `${style}/${weight}`;
  if (!masters.has(k)) {
    const m = mintMaster(style, weight, { noKern: true }), byChar = new Map();
    for (const [n, g] of Object.entries(m.glyphs)) if (g.unicode) byChar.set(g.unicode, n);
    masters.set(k, { m, byChar });
  }
  return masters.get(k);
}

// Width of a line in em units (1000 per em).
export function measure(text, { style = 'display', weight = 700, track = 0 } = {}) {
  const { m, byChar } = master(style, weight); let x = 0;
  for (const ch of text) { const n = byChar.get(ch.codePointAt(0)); x += (ch === ' ' ? 280 : n ? m.glyphs[n].advance : 300) + track; }
  return x;
}

// Set one line. size: px per em. align: 'left' | 'center' | 'right' about x. y: baseline. skew: italic shear
// (x shift per px of height). wobble(i): per-glyph [dx, dy, rot] for hand-set, bouncing type.
export function setLine(text, { x = 0, y = 0, size = 100, style = 'display', weight = 700, align = 'left', skew = 0, track = 0, wobble = null } = {}) {
  const { m, byChar } = master(style, weight), s = size / 1000, W = measure(text, { style, weight, track }) * s;
  let pen = align === 'center' ? x - W / 2 : align === 'right' ? x - W : x; const out = []; let i = 0;
  for (const ch of text) {
    const n = byChar.get(ch.codePointAt(0)), adv = (ch === ' ' ? 280 : n ? m.glyphs[n].advance : 300) * s;
    if (n && ch !== ' ') {
      const [dx, dy, rot] = wobble ? wobble(i) : [0, 0, 0], cx = pen + adv / 2, cy = y - size * 0.35, c = Math.cos(rot), sn = Math.sin(rot);
      for (const C of flatten(m.glyphs, n)) {
        const P = contourToPolyline(C, ([gx, gy]) => {
          let px = pen + gx * s + skew * gy * s, py = y - gy * s;
          const ux = px - cx, uy = py - cy; px = cx + c * ux - sn * uy + dx; py = cy + sn * ux + c * uy + dy;
          return [px, py];
        }, 5);
        if (P.length > 2) out.push(P);
      }
    }
    pen += adv + track * s; i++;
  }
  return out;
}
