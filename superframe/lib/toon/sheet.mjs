// sheet.mjs: the model sheet. One 4K plate per character: a five-view turnaround on blue-lined animation paper with
// head-height construction lines, six expression close-ups, and a colour key with the hex of every flat. The
// turnaround and the close-ups are the same puppet the animation uses, so the sheet cannot drift from the show.
import { canvas, fill, paint, coverage, lin } from './raster.mjs';
import { roundRect } from './geom.mjs';
import { drawPuppet, stage } from './puppet.mjs';
import { setLine } from './letter.mjs';

export const SHEET = { w: 3840, h: 2160, paper: '#ece3cf', rule: '#b9cddb', ink: '#17120e', faint: '#8d8371' };
const VIEWS = [['FRONT', 0], ['3/4', 45], ['SIDE', 90], ['3/4 BACK', 135], ['BACK', 180]];

const rect = (x, y, w, h, r = 0) => roundRect(x + w / 2, y + h / 2, w, h, Math.max(0.01, r));
function frame(K, x, y, w, h, t = 4, col = SHEET.ink) { fill(K, [rect(x - t, y - t, w + 2 * t, t), rect(x - t, y + h, w + 2 * t, t), rect(x - t, y, t, h), rect(x + w, y, t, h)], col); }
export function text(K, s, o) { fill(K, setLine(s, o), o.color ?? SHEET.ink); }

// Copy canvas S onto K at (x, y).
export function blit(K, S, x, y) {
  for (let j = 0; j < S.h; j++) { const Y = y + j; if (Y < 0 || Y >= K.h) continue;
    for (let i = 0; i < S.w; i++) { const X = x + i; if (X < 0 || X >= K.w) continue; const s = 3 * (j * S.w + i), d = 3 * (Y * K.w + X); K.px[d] = S.px[s]; K.px[d + 1] = S.px[s + 1]; K.px[d + 2] = S.px[s + 2]; } }
}

// The turnaround is drawn in its own crop of the sheet and pasted back, so a wide pose never spills into the
// close-up column.
function turnaround(K, c, box) {
  const [x0, y0, w, h] = box, px = (h - 190) / c.height, foot = h - 110, step = w / VIEWS.length, T = crop(K, x0, y0, w, h);
  for (let k = 0; k <= 8; k++) { const y = foot - (k / 8) * c.height * px; fill(T, [rect(0, y - 1, w, 2)], k % 4 === 0 ? SHEET.faint : SHEET.rule); }
  VIEWS.forEach(([, deg], i) => drawPuppet(T, c.build(c.pose ?? {}), deg * Math.PI / 180, stage(step * (i + 0.5), foot, px), { inkW: 7 }));
  blit(K, T, x0, y0);
  VIEWS.forEach(([label], i) => text(K, label, { x: x0 + step * (i + 0.5), y: y0 + h + 20, size: 44, style: 'mono', weight: 500, align: 'center', color: SHEET.faint }));
}
function crop(K, x, y, w, h) {
  const S = canvas(w, h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const s = 3 * ((y + j) * K.w + x + i), d = 3 * (j * w + i); S.px[d] = K.px[s]; S.px[d + 1] = K.px[s + 1]; S.px[d + 2] = K.px[s + 2]; }
  return S;
}

function closeups(K, c, box) {
  const [x0, y0, w, h] = box, cw = Math.floor((w - 40) / 2), ch = Math.floor((h - 2 * 70) / 3);
  c.expressions.forEach(([label, pose], i) => {
    const col = i % 2, row = Math.floor(i / 2), x = x0 + col * (cw + 40), y = y0 + row * (ch + 70);
    const S = canvas(cw, ch, '#f5efe0'), px = (ch * 0.5) / c.radius;
    for (let k = 1; k < 6; k++) fill(S, [rect(0, (k / 6) * ch - 1, cw, 2)], '#dde6ea');
    drawPuppet(S, c.build({ ...(c.pose ?? {}), ...pose }), (i === 3 ? 20 : -14) * Math.PI / 180, stage(cw / 2 - c.focus[0] * px, ch / 2 - c.focus[1] * px, px), { inkW: 5 });
    blit(K, S, x, y); frame(K, x, y, cw, ch, 5);
    text(K, label.toUpperCase(), { x: x + 6, y: y + ch + 52, size: 40, style: 'mono', weight: 500, color: SHEET.ink });
  });
}

function key(K, c, box) {
  const [x0, y0] = box, P = c.palette;
  c.keys.forEach((k, i) => {
    const x = x0 + i * 300;
    fill(K, [rect(x, y0, 110, 110, 14)], P[k]); fill(K, [rect(x - 3, y0 - 3, 116, 3), rect(x - 3, y0 + 110, 116, 3), rect(x - 3, y0, 3, 110), rect(x + 110, y0, 3, 110)], SHEET.ink);
    text(K, k.toUpperCase(), { x: x + 130, y: y0 + 46, size: 34, style: 'mono', weight: 600 });
    text(K, P[k].toUpperCase(), { x: x + 130, y: y0 + 92, size: 34, style: 'mono', weight: 400, color: SHEET.faint });
  });
}

export function modelSheet(c, { index = 1, of = 6 } = {}) {
  const K = canvas(SHEET.w, SHEET.h, SHEET.paper);
  for (let x = 0; x < SHEET.w; x += 48) fill(K, [rect(x, 0, 1, SHEET.h)], '#e6dcc6');
  text(K, c.name.toUpperCase(), { x: 90, y: 170, size: 150, style: 'display', weight: 800 });
  text(K, c.role, { x: 96, y: 245, size: 50, style: 'text', weight: 500, color: SHEET.faint });
  text(K, `CAST ${String(index).padStart(2, '0')} / ${String(of).padStart(2, '0')}`, { x: 2450, y: 110, size: 40, style: 'mono', weight: 500, align: 'right', color: SHEET.faint });
  turnaround(K, c, [40, 300, 2460, 1500]);
  closeups(K, c, [2560, 90, 1220, 1800]);
  key(K, c, [90, 1975]);
  return K;
}

export { paint, coverage, lin };
