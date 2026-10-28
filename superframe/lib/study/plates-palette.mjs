// plates-palette.mjs: the palette plate and the two contrast-of-extension plates (one per light scale).
import { INK, PAGE, masthead, methodBlock, label, pct, num, swatchRect } from './kit.mjs';

export function palettePlate(M, subject, ctx) {
  const ops = [], { margin: m, w } = PAGE, sw = M.palette.swatches;
  let y = masthead(ops, { ...ctx, title: 'Palette', question: 'Which colours make the picture, and how much of it does each one cover', subject });
  const ar = subject.h / subject.w, iw = Math.min((w - 2 * m - 20) / 2, 420 / ar), ih = iw * ar;
  ops.push({ op: 'image', x: m, y, w: iw, h: ih, src: 'subject' });
  ops.push({ op: 'image', x: m + iw + 20, y, w: iw, h: ih, src: 'recon' });
  label(ops, m, y + ih + 26, 'SUBJECT', { color: INK.faint });
  label(ops, m + iw + 20, y + ih + 26, `REBUILT FROM ${sw.length} SWATCHES, MEAN dE ${num(M.residual?.mean_dE, 1)}`, { color: INK.faint });
  y += ih + 70;
  const rowH = Math.min(78, 760 / Math.max(1, sw.length)), H = rowH * sw.length, colX = m, colW = 90, chipX = 300, chipW = 150;
  let acc = 0;
  sw.forEach((s, k) => {
    const y0 = y + acc * H, y1 = y + (acc + s.share) * H, ry = y + k * rowH; acc += s.share;
    swatchRect(ops, colX, y0, colW, Math.max(0.6, y1 - y0), s.hex);
    ops.push({ op: 'poly', pts: [[colX + colW + 4, y0], [chipX - 6, ry + 4], [chipX - 6, ry + rowH - 6], [colX + colW + 4, Math.max(y0 + 0.6, y1)]], fill: mix(s.hex) });
    swatchRect(ops, chipX, ry + 4, chipW, rowH - 10, s.hex);
    const ty = ry + rowH / 2;
    ops.push({ op: 'text', x: chipX + chipW + 26, y: ty + 2, text: s.hex.toUpperCase(), size: Math.min(24, rowH * 0.36), style: 'mono', color: INK.text });
    ops.push({ op: 'text', x: chipX + chipW + 26, y: ty + Math.min(24, rowH * 0.34), text: `L ${num(s.L, 1)}   C ${num(s.C, 1)}   h ${num(s.h, 0)}${s.gamut_clipped ? '   clipped to sRGB' : ''}`, size: Math.min(14, rowH * 0.22), style: 'mono', color: INK.muted });
    ops.push({ op: 'text', x: w - m, y: ty + 10, text: pct(s.share), size: Math.min(34, rowH * 0.48), style: 'display', weight: 500, color: INK.text, align: 'right' });
  });
  y += H + 40;
  const h = methodBlock(ops, y, `${M.palette.method.method}. Share: ${M.palette.method.share}. k at most ${M.palette.params.k}, merge below dE ${M.palette.params.mergeDE}, seed "${M.palette.params.seed}". Hex values are the swatch centres converted to 8-bit sRGB.`, [`Rebuilt picture: each pixel painted with its swatch. Residual: ${M.residual.method}.`]);
  return { id: 'palette', title: 'Palette', w, h, ground: INK.ground, ops };
}
// A dimmed version of a colour for ribbons: halfway to the ground.
function mix(hex) { const g = [13, 11, 18], c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); return '#' + c.map((v, i) => Math.round(v * 0.45 + g[i] * 0.55).toString(16).padStart(2, '0')).join(''); }

export function extensionPlate(M, subject, ctx, scaleId) {
  const B = M.extension[scaleId], ops = [], { margin: m, w } = PAGE, width = w - 2 * m;
  const sub = scaleId === 'goethe' ? "on Goethe's traditional light numbers" : 'on measured CIE L* lightness';
  let y = masthead(ops, { ...ctx, title: 'Contrast of extension', question: `How far the areas are from balance, ${sub}`, subject });
  const rows = B.rows;
  label(ops, m, y + 10, 'AS IT IS', { color: INK.faint }); label(ops, w - m, y + 10, 'SHARE OF THE INCLUDED AREA', { color: INK.faint, align: 'right' });
  const stripH = 64, gapH = 150, top = y + 26, bot = top + stripH + gapH;
  let a = 0, b = 0;
  for (const r of rows) {
    const x0 = m + a * width, x1 = m + (a + r.painted) * width, u0 = m + b * width, u1 = m + (b + r.balanced) * width; a += r.painted; b += r.balanced;
    swatchRect(ops, x0, top, Math.max(0.5, x1 - x0), stripH, r.hex);
    swatchRect(ops, u0, bot, Math.max(0.5, u1 - u0), stripH, r.hex);
    ops.push({ op: 'poly', pts: [[x0, top + stripH + 3], [x1, top + stripH + 3], [u1, bot - 3], [u0, bot - 3]], fill: mix(r.hex) });
  }
  label(ops, m, bot + stripH + 26, 'IN BALANCE', { color: INK.faint }); label(ops, w - m, bot + stripH + 26, 'AREA PROPORTIONAL TO 1 / LIGHT VALUE', { color: INK.faint, align: 'right' });
  y = bot + stripH + 80;
  const axis = 640, half = 250, rowH = Math.min(52, 560 / Math.max(1, rows.length)), mx = Math.max(1e-9, ...rows.flatMap(r => [r.painted, r.balanced]));
  label(ops, m, y, 'SWATCH', { color: INK.faint }); label(ops, 250, y, 'LIGHT', { color: INK.faint });
  label(ops, axis - 10, y, 'AS IT IS', { color: INK.faint, align: 'right' }); label(ops, axis + 10, y, 'IN BALANCE', { color: INK.faint });
  y += 22;
  rows.forEach((r, k) => {
    const ry = y + k * rowH, cy = ry + rowH / 2;
    swatchRect(ops, m, ry + 6, 44, rowH - 12, r.hex);
    ops.push({ op: 'text', x: m + 58, y: cy + 6, text: r.hex.toUpperCase(), size: 15, style: 'mono', color: INK.muted });
    ops.push({ op: 'text', x: 250, y: cy + 8, text: num(r.value, 1), size: 22, style: 'display', weight: 500, color: INK.text });
    const pw = r.painted / mx * half, bw = r.balanced / mx * half;
    swatchRect(ops, axis - 5 - pw, ry + 8, Math.max(0.5, pw), rowH - 16, r.hex);
    swatchRect(ops, axis + 5, ry + 8, Math.max(0.5, bw), rowH - 16, r.hex);
    label(ops, axis - pw - 13, cy + 5, pct(r.painted), { align: 'right', color: INK.text });
    label(ops, axis + bw + 13, cy + 5, pct(r.balanced), { color: INK.text });
  });
  ops.push({ op: 'rect', x: axis - 0.6, y: y - 4, w: 1.2, h: rows.length * rowH + 8, fill: INK.muted });
  y += rows.length * rowH + 70;
  ops.push({ op: 'text', x: m, y: y + 40, text: B.parts_in_100 + ' in 100', size: 72, style: 'display', weight: 600, color: INK.signal });
  const say = B.note ?? `parts of the surface would change colour to come into balance on this scale (d = ${num(B.distance, 4)}).`;
  ops.push({ op: 'para', x: m + 330, y: y + 4, w: width - 330, text: say, size: 19, lead: 27, color: INK.text });
  y += 110;
  if (B.excluded_share > 0) { ops.push({ op: 'para', x: m, y, w: width, text: `${pct(B.excluded_share)} of the picture is achromatic and has no value on this scale; it is left out and the rest renormalised.`, size: 15, lead: 22, color: INK.muted }); y += 50; }
  const h = methodBlock(ops, y + 10, `${B.scale_name}: ${B.method}.`, [`Distance: ${B.distance_method}.`]);
  return { id: `extension-${scaleId}`, title: `Contrast of extension (${B.scale_name})`, w, h, ground: INK.ground, ops };
}
