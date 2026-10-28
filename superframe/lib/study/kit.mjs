// kit.mjs: the plate grammar every criterion shares. A page 1000 units wide on the house dark ground; a masthead
// with the plate's number, name and question; a method block at the foot in small type. Plates are built as
// plain op lists (render.mjs), so a criterion only says what to draw, never how to rasterise it.
import { paraLines } from './render.mjs';
import { measure } from './type.mjs';

export const INK = { ground: '#0d0b12', panel: '#16131d', rule: '#2c2836', text: '#ebe8f2', muted: '#9a94ad', faint: '#5f5a70', signal: '#62d3e3' };
export const PAGE = { w: 1000, margin: 60 };
export const pct = (v, d = 1) => `${(v * 100).toFixed(d)}%`;
export const num = (v, d = 2) => (v === null || v === undefined ? 'n/a' : (+v).toFixed(d));
export const inkOn = sw => (sw.L ?? 50) > 58 ? '#0d0b12' : '#f4f2f8';
export const short = h => h.slice(0, 12);
const lum = hex => { const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
// A filled swatch rectangle; a colour too close to the dark ground gets a fine light edge so it stays visible.
export function swatchRect(ops, x, y, w, h, fill) {
  if (lum(fill) < 0.05) ops.push({ op: 'rect', x: x - 1.4, y: y - 1.4, w: w + 2.8, h: h + 2.8, fill: '#4a4458' });
  ops.push({ op: 'rect', x, y, w, h, fill });
}
// Shorten the middle of a long name so it fits width w at the given size.
export function fitName(name, size, w, o) { if (measure(name, size, o) <= w) return name; let k = name.length; while (k > 8 && measure(name.slice(0, Math.ceil(k / 2)) + '...' + name.slice(-Math.floor(k / 2)), size, o) > w) k--; return name.slice(0, Math.ceil(k / 2)) + '...' + name.slice(-Math.floor(k / 2)); }

// Masthead: plate number and criterion (small, tracked), the plate's name, its one-line question, and the subject.
export function masthead(ops, { n, of, criterion, title, question, subject }) {
  const { margin: m, w } = PAGE;
  ops.push({ op: 'text', x: m, y: 70, text: `${criterion.toUpperCase()}  ${String(n).padStart(2, '0')} / ${String(of).padStart(2, '0')}`, size: 13, style: 'mono', color: INK.signal, track: 80 });
  ops.push({ op: 'text', x: m, y: 128, text: title, size: 46, style: 'display', weight: 600, color: INK.text });
  ops.push({ op: 'text', x: m, y: 166, text: question, size: 19, color: INK.muted });
  ops.push({ op: 'text', x: w - m, y: 70, text: fitName(subject.file, 13, 420, { style: 'mono' }), size: 13, style: 'mono', color: INK.muted, align: 'right' });
  ops.push({ op: 'text', x: w - m, y: 92, text: `sha256 ${short(subject.sha256)}  ${subject.w} x ${subject.h}`, size: 11, style: 'mono', color: INK.faint, align: 'right' });
  ops.push({ op: 'rect', x: m, y: 194, w: w - 2 * m, h: 1.2, fill: INK.rule });
  return 236;                                              // first free y below the masthead
}

// Method block at y: a rule, the word METHOD, and the method text wrapped to the page. Returns the page height.
export function methodBlock(ops, y, text, extra = []) {
  const { margin: m, w } = PAGE, size = 12.5, lead = 19, width = w - 2 * m;
  ops.push({ op: 'rect', x: m, y, w: width, h: 1.2, fill: INK.rule });
  ops.push({ op: 'text', x: m, y: y + 34, text: 'METHOD', size: 11, style: 'mono', color: INK.faint, track: 120 });
  let yy = y + 60;
  for (const t of [text, ...extra]) {
    ops.push({ op: 'para', x: m, y: yy, w: width, text: t, size, lead, color: INK.muted });
    yy += paraLines(t, size, width, {}) * lead + 10;
  }
  return yy + 40;
}

// Label beneath or beside a mark: a small mono line.
export const label = (ops, x, y, text, o = {}) => ops.push({ op: 'text', x, y, text, size: o.size ?? 12, style: o.style ?? 'mono', color: o.color ?? INK.muted, align: o.align ?? 'left', weight: o.weight });
export const fits = (text, size, w, o) => measure(text, size, o) <= w;

// Shrink-to-fit: the largest size up to `size` at which text fits width w.
export function fitSize(text, size, w, o) { let s = size; while (s > 6 && !fits(text, s, w, o)) s -= 0.5; return s; }
