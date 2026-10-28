// plates-perception.mjs: two plates on how colours act on each other. Bezold: the same bands laced with white
// above and with black below, meeting at one edge so the shift reads along each band. Simultaneous contrast: one
// centre colour on four grounds taken from the picture's own palette, with the CIECAM02 lightness on each.
import { INK, PAGE, masthead, methodBlock, label, num, swatchRect } from './kit.mjs';
import { LACE } from './measures.mjs';

export function bezoldPlate(M, subject, ctx) {
  const ops = [], { margin: m, w } = PAGE, width = w - 2 * m, B = M.bezold, rows = B.rows;
  let y = masthead(ops, { ...ctx, title: 'Bezold lace', question: 'Do the same colours look like two palettes when one line turns from white to black', subject });
  if (!rows.length) { const h = methodBlock(ops, y + 20, 'No swatches.'); return { id: 'bezold', title: 'Bezold lace', w, h, ground: INK.ground, ops }; }
  const colW = width / rows.length, half = 330, colours = rows.map(r => r.hex);
  label(ops, m, y + 6, 'LACED WITH WHITE', { color: INK.faint });
  y += 22;
  ops.push({ op: 'lace', x: m, y, w: width, h: half, colours, lace: '#ffffff', period: colW * LACE.period, width: colW * LACE.width });
  ops.push({ op: 'lace', x: m, y: y + half, w: width, h: half, colours, lace: '#000000', period: colW * LACE.period, width: colW * LACE.width });
  y += 2 * half + 26;
  label(ops, m, y, 'LACED WITH BLACK', { color: INK.faint });
  y += 70;
  const rowsSpec = [['UNLACED', r => r.hex], ['MIXED, WHITE', r => r.with_white.hex], ['MIXED, BLACK', r => r.with_black.hex]];
  rowsSpec.forEach(([name, f], k) => {
    const ry = y + k * 96;
    label(ops, m, ry - 10, name, { color: INK.faint, size: 11 });
    rows.forEach((r, i) => swatchRect(ops, m + i * colW + 4, ry, colW * 0.42, 52, f(r)));
    rows.forEach((r, i) => label(ops, m + i * colW + colW * 0.42 + 14, ry + 32, f(r).toUpperCase(), { size: 12.5, color: k ? INK.muted : INK.text }));
  });
  y += 3 * 96;
  rows.forEach((r, i) => {
    ops.push({ op: 'text', x: m + i * colW + 4, y: y + 30, text: num(r.dE_white_vs_black, 1), size: 34, style: 'display', weight: 500, color: INK.text });
    label(ops, m + i * colW + 4, y + 56, 'dE white vs black', { size: 11.5 });
  });
  y += 100;
  const h = methodBlock(ops, y, `Bands: up to five swatches chosen to be far apart in CIELAB (the largest chromatic swatch first, then farthest-point). ${B.method}. dE is CIE76 between the two mixtures.`);
  return { id: 'bezold', title: 'Bezold lace', w, h, ground: INK.ground, ops };
}

export function simultaneousPlate(M, subject, ctx) {
  const ops = [], { margin: m, w } = PAGE, width = w - 2 * m, S = M.simultaneous;
  let y = masthead(ops, { ...ctx, title: 'One colour, four grounds', question: 'How much the picture\'s own grounds move the lightness of one of its colours', subject });
  if (!S.rows?.length) { const h = methodBlock(ops, y + 20, S.method); return { id: 'simultaneous', title: 'Simultaneous contrast', w, h, ground: INK.ground, ops }; }
  const n = S.rows.length, gap = 18, pw = (width - gap * (n - 1)) / n, ph = 560, cs = pw * 0.36;
  S.rows.forEach((r, k) => {
    const x = m + k * (pw + gap);
    swatchRect(ops, x, y, pw, ph, r.ground);
    ops.push({ op: 'rect', x: x + (pw - cs) / 2, y: y + (ph - cs) / 2, w: cs, h: cs, fill: S.centre.hex });
    label(ops, x, y + ph + 34, r.role.toUpperCase(), { color: INK.signal, size: 13 });
    label(ops, x, y + ph + 58, `ground ${r.ground.toUpperCase()}`, { size: 12.5 });
    ops.push({ op: 'text', x, y: y + ph + 118, text: `J ${num(r.J, 1)}`, size: 40, style: 'display', weight: 500, color: INK.text });
    label(ops, x, y + ph + 148, `${r.dJ_vs_grey20 >= 0 ? '+' : ''}${num(r.dJ_vs_grey20, 1)} vs 20% grey`, { size: 12.5, color: INK.muted });
  });
  y += ph + 200;
  swatchRect(ops, m, y, 60, 60, S.centre.hex);
  ops.push({ op: 'para', x: m + 80, y: y + 24, w: width - 80, text: `Centre ${S.centre.hex.toUpperCase()}. On a 20% grey ground its CIECAM02 lightness is J ${num(S.J_on_grey20, 1)}. Its code values never change between the four panels.`, size: 18, lead: 26, color: INK.text });
  y += 100;
  const h = methodBlock(ops, y, S.method + '.');
  return { id: 'simultaneous', title: 'Simultaneous contrast', w, h, ground: INK.ground, ops };
}
