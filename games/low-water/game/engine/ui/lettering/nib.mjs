// A broad nib held at an angle (the UI art lead's, 2026-10-22, round two): the mark is the nib's edge swept along
// the stroke, not a round dab, so thick and thin follow the direction of travel and every foot and head ends
// in the nib's own angle (the diamond feet of textura, the wedges of the insular hand). Its imperfections
// come from first principles of a dip pen: the ink pools where the pen stops; the tines catch and split for
// a moment on a rough fibre, leaving a pale hairline down the middle of the mark; the hand wobbles a little;
// and now and then a drop leaves the pen (a blot). Pure: no DOM.
//   nibStroke(img, W, H, pts, T, P, s)   pts in pixels; T the tool; P the stroke's own draw (key, weight, catches)
//   blotInto(img, W, H, x, y, r, key)
import { U, hash4 } from "../../paint/strokes.mjs";

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// points no more than a third of a pixel apart, so the swept edge leaves no gaps between its places
function dense(pts) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], k = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.33)); for (let j = 1; j <= k; j++) out.push([x0 + ((x1 - x0) * j) / k, y0 + ((y1 - y0) * j) / k]); }
  return out;
}

export function nibStroke(img, W, H, pts0, T, P, s) {
  const pts = dense(pts0), n = pts.length; if (n < 2) return;
  const cum = new Float32Array(n); for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  const L = Math.max(cum[n - 1], 1e-3), h = Math.max(0.8, T.edge * s), best = new Map();
  const ang = ((T.angle + (U(P.key, 7) - 0.5) * 2 * T.angleJit) * Math.PI) / 180;
  for (let i = 0; i < n; i++) {
    const t = cum[i] / L, a = ang + (t - 0.5) * T.twist * (Math.PI / 180), ca = Math.cos(a), sa = -Math.sin(a);   // y down in pixels
    const half = 0.5 * T.nib * s * P.weight * (t < 0.05 || t > 0.95 ? T.pool : 1), [cx, cy] = pts[i];
    const x0 = Math.max(0, Math.floor(cx - half - h - 1)), x1 = Math.min(W - 1, Math.ceil(cx + half + h + 1)), y0 = Math.max(0, Math.floor(cy - half - h - 1)), y1 = Math.min(H - 1, Math.ceil(cy + half + h + 1));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const ox = x + 0.5 - cx, oy = y + 0.5 - cy, u = ox * ca + oy * sa, uc = clamp(u, -half, half), d = Math.hypot(ox - uc * ca, oy - uc * sa);
      if (d > h + 0.8) continue;
      const p = y * W + x, b = best.get(p);
      if (!b || d < b[0]) best.set(p, [d, t, half ? u / half : 0]);
    }
  }
  for (const [p, [d, t, v]] of best) {
    let dens = P.alpha;
    if (t < 0.06 || t > 0.94) dens = 1;                                                     // ink pooled where the pen stopped
    for (const c of P.catches) if (Math.abs(t - c.at) < c.len && Math.abs(v - c.v) < 0.18) dens *= 0.18;   // the tines caught and split
    if (t > 0.6) dens *= 1 - T.fade * (t - 0.6) / 0.4;                                     // the nib running low toward the end
    const rag = T.rag * (U(hash4(p, P.key, 3, 1), 0) - 0.5);
    const a = clamp(h + rag - d + 0.5, 0, 1) * dens; if (a > 0) img[p] = 1 - (1 - img[p]) * (1 - a);
  }
}

// a drop off the pen: a round blot with a ragged rim and a darker crescent where it landed first
export function blotInto(img, W, H, x, y, r, key) {
  const x0 = Math.max(0, Math.floor(x - r * 1.4)), x1 = Math.min(W - 1, Math.ceil(x + r * 1.4)), y0 = Math.max(0, Math.floor(y - r * 1.4)), y1 = Math.min(H - 1, Math.ceil(y + r * 1.4));
  for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
    const dx = i + 0.5 - x, dy = j + 0.5 - y, th = Math.atan2(dy, dx), rr = r * (0.85 + 0.3 * U(hash4(Math.round(th * 5), key, 9, 2), 0)), d = Math.hypot(dx, dy);
    const a = clamp(rr - d + 0.5, 0, 1) * 0.95; if (a > 0) img[j * W + i] = 1 - (1 - img[j * W + i]) * (1 - a);
  }
}

// the stroke's own draw for a nib: where (if anywhere) the tines catch, how hard the pen presses
export function nibDraw(T, key) {
  const catches = []; for (let k = 0; k < 2; k++) if (U(key, 40 + k) < T.catch) catches.push({ at: 0.2 + U(key, 50 + k) * 0.6, len: 0.025 + U(key, 60 + k) * 0.04, v: (U(key, 70 + k) - 0.5) * 0.5 });
  return { key, weight: 0.94 + U(key, 1) * 0.12, alpha: 0.93 + U(key, 5) * 0.07, catches };
}
