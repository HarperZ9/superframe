// scene.mjs: what the three animated tests share: a shot clock that animates on twos, captions in the house face
// with an ink rim, flat set dressing, and the render loop that writes held frames once and repeats them.
import { canvas, fill, coverage, paint } from './raster.mjs';
import { roundRect, ellipse } from './geom.mjs';
import { inkClosed } from './ink.mjs';
import { setLine } from './letter.mjs';
import { movie, writePng } from './out.mjs';

export const W = 3840, H = 2160, FPS = 24;
export const rect = (x, y, w, h, r = 0.01) => roundRect(x + w / 2, y + h / 2, w, h, Math.max(0.01, r));
export const box = (K, x, y, w, h, col, r) => fill(K, [rect(x, y, w, h, r)], col);
export const disc = (K, x, y, r, col) => fill(K, [ellipse(x, y, r, r, 64)], col);

// Outline any closed contours in ink (silhouette weighted).
export function inked(K, Cs, fillCol, { ink = '#17120e', w = 6 } = {}) {
  fill(K, Cs, fillCol);
  paint(K, coverage(Cs.flatMap(C => inkClosed(C, { w })), K.w, K.h), ink);
}

// A caption: house face, centred, paper-white with an ink rim, on the lower third.
export function caption(K, text, { y = H - 150, size = 92, color = '#fbf6e8', weight = 700, style = 'display' } = {}) {
  if (!text) return;
  const Cs = setLine(text, { x: K.w / 2, y, size, weight, style, align: 'center' });
  paint(K, coverage(Cs.flatMap(C => inkClosed(C, { w: size * 0.13, spread: 0.3 })), K.w, K.h), '#120e0b');
  fill(K, Cs, color);
}

// The line on screen at time t from a script of [t0, t1, text].
export const lineAt = (script, t) => script.find(([a, b]) => t >= a && t < b)?.[2] ?? '';

// Smooth ramps for acting curves.
export const ramp = (t, a, b) => (t <= a ? 0 : t >= b ? 1 : (t - a) / (b - a));
export const ease = x => x * x * (3 - 2 * x);
export const pulse = (t, a, b) => (t < a || t > b ? 0 : Math.sin(Math.PI * (t - a) / (b - a)));

// Render a clip: draw(f, t) returns a canvas for each held frame (every `hold` frames); held frames are written
// `hold` times. stills: frame indices to also save as PNG for inspection. Returns the movie result.
export async function renderClip(path, { seconds, draw, hold = 2, audio = null, stills = [], stillDir = null, log = true }) {
  const N = Math.round(seconds * FPS), mv = movie(path, { w: W, h: H, fps: FPS, audio }); let K = null;
  const t0 = Date.now();
  for (let f = 0; f < N; f++) {
    if (f % hold === 0 || !K) K = draw(f, f / FPS);
    await mv.push(K);
    if (stillDir && stills.includes(f)) await writePng(`${stillDir}/f${String(f).padStart(4, '0')}.png`, K);
    if (log && f % 48 === 0) console.log(`  ${path.split('/').pop()} frame ${f}/${N} ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  return mv.close();
}
export { canvas };
