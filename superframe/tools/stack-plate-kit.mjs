// stack-plate-kit.mjs: the plate grammar for lib/stack's demo, on lib/study's renderer (3840 px wide, house type).
// A plate is a page 1000 units wide; images are rendered at exactly the pixel size of their panel, so nothing is
// resampled on the way to the file.
import { writeFileSync, mkdirSync } from 'node:fs';
import { renderPlate, pngOf } from '../lib/study/render.mjs';
import { INK } from '../lib/study/kit.mjs';
import { rgbaOf, toDisplay } from '../lib/stack/frame.mjs';

export const WIDTH = 3840, S = WIDTH / 1000, M = 60;
export const px = u => Math.round(u * S);
export { INK };

export function newPlate(id, n, title, question) {
  const ops = [], images = {};
  ops.push({ op: 'text', x: M, y: 70, text: `SECTION STACK  ${String(n).padStart(2, '0')} / 04`, size: 13, style: 'mono', color: INK.signal, track: 80 });
  ops.push({ op: 'text', x: M, y: 128, text: title, size: 46, style: 'display', weight: 600, color: INK.text });
  ops.push({ op: 'text', x: M, y: 166, text: question, size: 19, color: INK.muted });
  ops.push({ op: 'text', x: 1000 - M, y: 70, text: 'lib/stack  2026-10-28', size: 13, style: 'mono', color: INK.muted, align: 'right' });
  ops.push({ op: 'rect', x: M, y: 194, w: 1000 - 2 * M, h: 1.2, fill: INK.rule });
  return { id, ops, images };
}

// Place a linear frame (or 8-bit frame) in a panel w x h units at (x, y), with a caption line beneath. The frame is
// display-encoded unless it is already 8-bit, and upscaled by whole pixels with nearest neighbour when `scale` > 1.
export function panel(P, key, F, x, y, w, h, caption, { scale = 1, encode = true } = {}) {
  const img = rgbaOf(F.b || !encode ? F : toDisplay(F), scale);
  if (img.w !== px(w) || img.h !== px(h)) throw new Error(`panel ${key}: image ${img.w}x${img.h}, panel ${px(w)}x${px(h)}`);
  P.images[key] = img;
  P.ops.push({ op: 'rect', x: x - 1, y: y - 1, w: w + 2, h: h + 2, fill: INK.rule });
  P.ops.push({ op: 'image', x, y, w, h, src: key });
  if (caption) P.ops.push({ op: 'para', x, y: y + h + 24, w, text: caption, size: 12, lead: 18, style: 'mono', color: INK.muted });
}
// The panel size in units for an image of W x H pixels (exact at this scale).
export const units = (W, H) => [W / S, H / S];

export const text = (P, x, y, t, o = {}) => P.ops.push({ op: 'text', x, y, text: t, size: o.size ?? 13, style: o.style ?? 'mono', color: o.color ?? INK.muted, align: o.align ?? 'left', weight: o.weight });
export const para = (P, x, y, w, t, o = {}) => P.ops.push({ op: 'para', x, y, w, text: t, size: o.size ?? 14, lead: o.lead ?? 21, color: o.color ?? INK.muted });

// A bar chart in a box: values 0..1 (or vmin..vmax), one bar per entry, labels under each, a highlighted index.
export function bars(P, x, y, w, h, values, { labels = [], hi = -1, color = INK.faint, hiColor = INK.signal, vmin = 0, vmax = 1, title = '' } = {}) {
  P.ops.push({ op: 'rect', x, y: y + h, w, h: 1, fill: INK.rule });
  const bw = w / values.length;
  values.forEach((v, i) => {
    const t = Math.max(0, Math.min(1, (v - vmin) / (vmax - vmin))), bh = Math.max(0.6, t * h);
    P.ops.push({ op: 'rect', x: x + i * bw + bw * 0.18, y: y + h - bh, w: bw * 0.64, h: bh, fill: i === hi ? hiColor : color });
    if (labels[i] !== undefined) text(P, x + i * bw + bw / 2, y + h + 18, String(labels[i]), { size: 11, align: 'center' });
  });
  if (title) text(P, x, y - 10, title, { size: 12, color: INK.text });
}

export async function writePlate(P, h) {
  mkdirSync('out/stack', { recursive: true });
  const R = renderPlate({ id: P.id, w: 1000, h, ground: INK.ground, ops: P.ops, images: P.images }, { width: WIDTH });
  const path = `out/stack/${P.id}.png`; writeFileSync(path, Buffer.from(await pngOf(R)));
  console.log(`${path}  ${R.w} x ${R.h}`); return path;
}
export const hex = rgb => '#' + rgb.map(v => Math.round(Math.min(1, Math.max(0, v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)) * 255).toString(16).padStart(2, '0')).join('');
