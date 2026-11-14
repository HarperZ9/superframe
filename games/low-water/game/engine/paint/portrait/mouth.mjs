// The mouth's corners, painted: a short dark accent at each end of the lips, turned up or down by the mood
// (portraitCue's corners, -1 down .. 1 up), and the lit fold of the cheek beside it. The old head has no
// slider for the corners, so this is where its mood reaches the mouth; on the sculpted head it only
// sharpens what the form already does. Original code.
//   paintMouth(canvas, G, { w, h, corners, study, paint }) -> { x0, x1, y } (the lips' span; paint false only measures)
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const LIP = 16;
export function paintMouth(canvas, G, { w, h, corners = 0, study, dark = [0.12, 0.06, 0.05], paint = true }) {
  let x0 = w, x1 = -1, sy0 = 0, sy1 = 0, n0 = 0, n1 = 0, ys = 0, n = 0, ymin = h, ymax = 0;
  for (let i = 0; i < w * h; i++) if (G.id[i] === LIP) { const x = i % w, y = (i / w) | 0; ys += y; n++; ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); if (x < x0) x0 = x; if (x > x1) x1 = x; }
  if (n < 8) return null;
  if (!paint) return { x0, x1, y: ys / n };
  const my = ys / n, mw = x1 - x0 + 1;
  for (let i = 0; i < w * h; i++) if (G.id[i] === LIP) { const x = i % w, y = (i / w) | 0; if (x - x0 < mw * 0.12) { sy0 += y; n0++; } if (x1 - x < mw * 0.12) { sy1 += y; n1++; } }
  const ends = [[x0, n0 ? sy0 / n0 : my, -1], [x1, n1 ? sy1 / n1 : my, 1]], len = Math.max(3, mw * 0.16), th = Math.max(1, (ymax - ymin) * 0.12);
  const set = (i, c, a) => { for (let k = 0; k < 3; k++) canvas[i * 3 + k] = canvas[i * 3 + k] * (1 - a) + c[k] * a; };
  for (const [ex, ey, side] of ends) {
    // the accent runs out from the corner and bends up (a smile) or down (a frown) along a short arc
    for (let s = 0; s <= 1; s += 0.5 / len) {
      const x = ex + side * s * len * 0.8, y = ey - corners * s * s * len * 0.9 + s * th * 0.3, a = (1 - s) * 0.75 * (0.35 + 0.65 * Math.abs(corners) + 0.3);
      for (let dy = -Math.ceil(th); dy <= Math.ceil(th); dy++) for (let dx = -1; dx <= 1; dx++) {
        const px = Math.round(x + dx), py = Math.round(y + dy); if (px < 0 || py < 0 || px >= w || py >= h) continue;
        const d = Math.hypot(px - x, py - y); set(py * w + px, dark, clamp(th + 0.5 - d) * a);
      }
    }
    // the cheek's lit fold beside a smile (light rising out of the corner)
    if (corners > 0.2) for (let s = 0; s <= 1; s += 0.5 / len) {
      const x = ex + side * (len * 0.5 + s * len * 0.4), y = ey - len * (0.3 + 0.9 * s) * corners, i = Math.round(y) * w + Math.round(x);
      if (x < 0 || y < 0 || x >= w || y >= h || !G.id[i]) continue;
      set(i, [study[i * 3], study[i * 3 + 1], study[i * 3 + 2]].map((v) => Math.min(1, v * 1.2 + 0.03)), 0.35 * corners * (1 - s));
    }
  }
  return { x0, x1, y: my };
}
