// plates-structure.mjs: three plates on the colour's structure. Hue: an area rose on the CIELAB hue circle beside
// the swatches on the a*b* plane. Value: the picture in five lightness bands beside its L* histogram. Composition:
// the picture rebuilt from its swatches, where each swatch lives, and which swatches touch.
import { INK, PAGE, masthead, methodBlock, label, pct, num } from './kit.mjs';
import { labToRgb8, hex } from './cmath.mjs';

const ring = (cx, cy, r, n = 96) => Array.from({ length: n + 1 }, (_, k) => [cx + r * Math.cos(2 * Math.PI * k / n), cy + r * Math.sin(2 * Math.PI * k / n)]);
const greyHex = L => hex(labToRgb8([L, 0, 0]).rgb);

export function huePlate(M, subject, ctx) {
  const ops = [], { margin: m, w } = PAGE, H = M.hue, sw = M.palette.swatches;
  let y = masthead(ops, { ...ctx, title: 'Hue and chroma', question: 'Where the colour sits on the hue circle, and how strong it is', subject });
  const R = 200, cx = m + R + 10, cy = y + R + 30, mx = Math.max(1e-9, ...H.area), step = 360 / H.bins;
  for (const f of [0.25, 0.5, 1]) ops.push({ op: 'line', pts: ring(cx, cy, R * Math.sqrt(f)), width: 0.8, color: INK.rule });
  H.area.forEach((a, k) => {
    if (!a) return;
    const r = 40 + (R - 40) * Math.sqrt(a / mx), pts = [[cx, cy]];
    for (let t = 0; t <= 8; t++) { const ang = -(k * step + t * step / 8) * Math.PI / 180; pts.push([cx + r * Math.cos(ang), cy + r * Math.sin(ang)]); }
    ops.push({ op: 'poly', pts, fill: hex(labToRgb8(H.mean_lab[k]).rgb) });
  });
  ops.push({ op: 'circle', cx, cy, r: 40, fill: greyHex(50) });
  ops.push({ op: 'text', x: cx, y: cy + 7, text: pct(H.achromatic_share, 0), size: 17, style: 'mono', color: '#0d0b12', align: 'center' });
  for (const [ang, t] of [[0, '+a'], [90, '+b'], [180, '-a'], [270, '-b']]) { const a = -ang * Math.PI / 180; label(ops, cx + (R + 24) * Math.cos(a), cy + (R + 24) * Math.sin(a) + 5, t, { align: 'center', color: INK.faint }); }
  // a*b* plane
  const px = 560, side = 380, pcx = px + side / 2, pcy = y + 30 + side / 2, k = side / 2 / 110;
  ops.push({ op: 'rect', x: px, y: y + 30, w: side, h: side, fill: INK.panel });
  ops.push({ op: 'rect', x: pcx - 0.5, y: y + 30, w: 1, h: side, fill: INK.rule }); ops.push({ op: 'rect', x: px, y: pcy - 0.5, w: side, h: 1, fill: INK.rule });
  for (const s of [...sw].reverse()) {
    const r = Math.max(5, 46 * Math.sqrt(s.share)), x = pcx + Math.max(-110, Math.min(110, s.lab[1])) * k, yy = pcy - Math.max(-110, Math.min(110, s.lab[2])) * k;
    ops.push({ op: 'circle', cx: x, cy: yy, r: r + 1.6, fill: INK.text }); ops.push({ op: 'circle', cx: x, cy: yy, r, fill: s.hex });
  }
  label(ops, px + side - 6, pcy - 8, 'a*', { align: 'right', color: INK.faint }); label(ops, pcx + 8, y + 48, 'b*', { color: INK.faint });
  y += 2 * R + 110;
  const stats = [['MEAN HUE', H.mean_hue === null ? 'none' : `${num(H.mean_hue, 0)} deg`], ['CONCENTRATION', num(H.concentration, 2)], ['ACHROMATIC', pct(H.achromatic_share)], ['COLOURFULNESS M', num(M.colourfulness.M, 1)]];
  stats.forEach(([t, v], i) => { const x = m + i * 220; label(ops, x, y, t, { color: INK.faint }); ops.push({ op: 'text', x, y: y + 44, text: v, size: 34, style: 'display', weight: 500, color: INK.text }); });
  y += 90;
  const h = methodBlock(ops, y, `Rose: ${H.method}; petal length beyond the centre disc is proportional to the square root of the bin's area share relative to the largest bin; petal colour is the mean CIELAB colour of the bin; the centre disc gives the achromatic share. Plane: each swatch at its a*, b* (clamped to +-110), circle area proportional to share.`, [`Colourfulness: ${M.colourfulness.method}.`]);
  return { id: 'hue', title: 'Hue and chroma', w, h, ground: INK.ground, ops };
}

export function valuePlate(M, subject, ctx) {
  const ops = [], { margin: m, w } = PAGE, V = M.value, width = w - 2 * m;
  let y = masthead(ops, { ...ctx, title: 'Value structure', question: 'How light and dark are spread, read without hue', subject });
  const ar = subject.h / subject.w, iw = Math.min(width, 520 / ar), ih = iw * ar;
  ops.push({ op: 'image', x: m, y, w: iw, h: ih, src: 'value' });
  y += ih + 30;
  [10, 30, 50, 70, 90].forEach((L, i) => { const x = m + i * (width / 5); ops.push({ op: 'rect', x, y, w: 40, h: 40, fill: greyHex(L) }); label(ops, x + 52, y + 18, `L ${i * 20}-${i * 20 + 20}`, { size: 12.5 }); label(ops, x + 52, y + 38, pct(V.bands[i]), { size: 15, color: INK.text }); });
  y += 90;
  const hh = 240, bw = width / 20, mx = Math.max(1e-9, ...V.histogram_5L);
  V.histogram_5L.forEach((v, i) => { const bh = hh * v / mx; ops.push({ op: 'rect', x: m + i * bw + 2, y: y + hh - bh, w: bw - 4, h: Math.max(0.5, bh), fill: greyHex(i * 5 + 2.5) }); });
  ops.push({ op: 'rect', x: m, y: y + hh + 1, w: width, h: 1, fill: INK.rule });
  for (const [t, L] of [['p05', V.p05], ['p50', V.p50], ['p95', V.p95]]) { const x = m + L / 100 * width; ops.push({ op: 'rect', x: x - 0.6, y: y - 10, w: 1.2, h: hh + 20, fill: INK.signal }); label(ops, x, y - 16, `${t} ${num(L, 0)}`, { align: 'center', color: INK.signal }); }
  label(ops, m, y + hh + 26, 'L* 0', { color: INK.faint }); label(ops, w - m, y + hh + 26, '100', { align: 'right', color: INK.faint });
  y += hh + 80;
  [['MEAN L*', num(V.mean_L, 1)], ['KEY', V.key], ['RANGE p05-p95', num(V.range_p05_p95, 1)]].forEach(([t, v], i) => { const x = m + i * 280; label(ops, x, y, t, { color: INK.faint }); ops.push({ op: 'text', x, y: y + 44, text: v, size: 34, style: 'display', weight: 500, color: INK.text }); });
  y += 90;
  const h = methodBlock(ops, y, `${V.method}. The map paints each pixel at the middle grey of its L* band (CIELAB L* of the pixel itself).`);
  return { id: 'value', title: 'Value structure', w, h, ground: INK.ground, ops };
}

export function compositionPlate(M, subject, ctx) {
  const ops = [], { margin: m, w } = PAGE, C = M.composition, sw = M.palette.swatches, width = w - 2 * m;
  let y = masthead(ops, { ...ctx, title: 'Where each colour lives', question: 'How the swatches are placed: clumped or scattered, and which ones touch', subject });
  const ar = subject.h / subject.w, iw = Math.min(width, 440 / ar), ih = iw * ar;
  ops.push({ op: 'image', x: m, y, w: iw, h: ih, src: 'recon' });
  y += ih + 40;
  const side = 420, sx = m, sy = y, boxW = ar <= 1 ? side : side / ar, boxH = boxW * ar, u = Math.max(subject.w, subject.h) * boxW / subject.w;
  ops.push({ op: 'rect', x: sx, y: sy, w: boxW, h: boxH, fill: INK.panel });
  [...sw].reverse().forEach(sv => {
    const q = C.where[sv.i]; if (!q) return;
    const cx = sx + q.centroid[0] * u, cy = sy + q.centroid[1] * u;
    ops.push({ op: 'line', pts: ring(cx, cy, Math.max(4, q.spread * u)), width: 1.4, color: sv.hex, clip: [sx, sy, sx + boxW, sy + boxH] });
    ops.push({ op: 'circle', cx, cy, r: Math.max(4, 22 * Math.sqrt(sv.share)), fill: sv.hex });
  });
  label(ops, sx, sy + boxH + 24, 'CENTRE AND SPREAD OF EACH SWATCH', { color: INK.faint });
  // adjacency matrix
  const n = sw.length, mx0 = 500, cell = Math.min(40, (w - m - mx0 - 40) / Math.max(1, n)), mx = Math.max(1e-9, ...C.adjacency.flat());
  sw.forEach((a, i) => { ops.push({ op: 'rect', x: mx0, y: sy + 40 + i * cell + 3, w: 28, h: cell - 6, fill: a.hex }); ops.push({ op: 'rect', x: mx0 + 40 + i * cell + 3, y: sy, w: cell - 6, h: 28, fill: a.hex }); });
  sw.forEach((a, i) => sw.forEach((b, j) => { if (i === j) return; const v = C.adjacency[i][j] / mx, g = Math.round(22 + v * 210); ops.push({ op: 'rect', x: mx0 + 40 + j * cell + 1, y: sy + 40 + i * cell + 1, w: cell - 2, h: cell - 2, fill: hex([g, g, Math.min(255, g + 8)]) }); }));
  label(ops, mx0, sy + 40 + n * cell + 24, 'WHICH SWATCHES TOUCH (LIGHTER = MORE SHARED EDGE)', { color: INK.faint, size: 11 });
  y += Math.max(boxH, 40 + n * cell) + 80;
  label(ops, m, y, 'COHERENCE', { color: INK.faint });
  ops.push({ op: 'text', x: m, y: y + 50, text: pct(C.coherence), size: 44, style: 'display', weight: 600, color: INK.signal });
  ops.push({ op: 'para', x: m + 220, y: y + 22, w: width - 220, text: 'of neighbouring pixel pairs share a swatch. A shuffled copy of the picture keeps every swatch and share but loses this.', size: 18, lead: 26, color: INK.text });
  y += 110;
  const h = methodBlock(ops, y, `${C.method}. Rebuilt picture: each pixel painted with its swatch.`);
  return { id: 'composition', title: 'Composition', w, h, ground: INK.ground, ops };
}
