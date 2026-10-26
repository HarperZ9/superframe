// Synthetic letter masks for the tests: no canvas in node, so shapes are drawn analytically with 4x supersampling.
export function shapeMask(w, h, inside) {
  const m = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let c = 0; for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) c += inside(x + (sx + 0.5) / 4, y + (sy + 0.5) / 4) ? 1 : 0;
    m[y * w + x] = c / 16;
  }
  return m;
}
const box = (x, y, x0, y0, x1, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
// a capital L, 120 x 100, stroke 16
export const L = () => ({ w: 120, h: 100, mask: shapeMask(120, 100, (x, y) => box(x, y, 20, 10, 36, 90) || box(x, y, 20, 74, 100, 90)) });
// a ring (an o), radius 30 to 46
export const O = () => ({ w: 120, h: 120, mask: shapeMask(120, 120, (x, y) => { const r = Math.hypot(x - 60, y - 60); return r >= 30 && r <= 46; }) });
// a T
export const T = () => ({ w: 120, h: 110, mask: shapeMask(120, 110, (x, y) => box(x, y, 10, 10, 110, 26) || box(x, y, 52, 10, 68, 100)) });
// "i": a stem and a separate dot
export const I = () => ({ w: 60, h: 120, mask: shapeMask(60, 120, (x, y) => box(x, y, 22, 40, 38, 110) || Math.hypot(x - 30, y - 18) < 9) });
