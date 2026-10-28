// lines.mjs: straight-line segments from an image. Level-line orientations (unoriented, mod 180 degrees) are grown
// into regions of pixels that agree within tau, each region is boxed as a rectangle, and the rectangle is kept only
// when its number of false alarms is below eps: the count of aligned pixels must be very unlikely under independent
// uniform orientations. That validation is the noise floor; nothing is tuned to an image. Each kept segment carries
// its gradient-weighted second moments, so collinear pieces can be pooled into one exact total-least-squares fit.
import { log10BinomTail, log10Tests } from './stats.mjs';

const TAU = Math.PI / 8;                  // 22.5 degrees, LSD's angle tolerance
const P_ALIGN = 2 * TAU / Math.PI;        // chance an unoriented orientation falls within +-tau: 0.25
const BINS = 1024;

// Separable Gaussian blur of a w x h plane, edges clamped. sigma 0 returns the plane unchanged.
export function blur(L, w, h, sigma) {
  if (!(sigma > 0)) return L;
  const r = Math.ceil(3 * sigma), k = Array.from({ length: 2 * r + 1 }, (_, i) => Math.exp(-((i - r) ** 2) / (2 * sigma * sigma))), sk = k.reduce((a, b) => a + b);
  const T = new Float32Array(w * h), O = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = 0; for (let i = -r; i <= r; i++) v += k[i + r] * L[y * w + Math.min(w - 1, Math.max(0, x + i))]; T[y * w + x] = v / sk; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = 0; for (let i = -r; i <= r; i++) v += k[i + r] * T[Math.min(h - 1, Math.max(0, y + i)) * w + x]; O[y * w + x] = v / sk; }
  return O;
}

// 2x2 gradient of sRGB luma (optionally Gaussian-smoothed first), located at pixel corners (x + 1, y + 1);
// orientation is the level-line angle mod pi.
export function gradient(rgba, w, h, smooth = 0) {
  let L = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) L[i] = (0.2126 * rgba[4 * i] + 0.7152 * rgba[4 * i + 1] + 0.0722 * rgba[4 * i + 2]) / 255;
  L = blur(L, w, h, smooth);
  const mag = new Float32Array(w * h), ang = new Float32Array(w * h);
  for (let y = 0; y < h - 1; y++) for (let x = 0; x < w - 1; x++) {
    const i = y * w + x, a = L[i], b = L[i + 1], c = L[i + w], d = L[i + w + 1];
    const gx = (b + d - a - c) / 2, gy = (c + d - a - b) / 2;
    mag[i] = Math.hypot(gx, gy);
    let t = Math.atan2(gx, -gy); if (t < 0) t += Math.PI; if (t >= Math.PI) t -= Math.PI;
    ang[i] = t;
  }
  return { mag, ang, w, h };
}

const angDiff = (a, b) => { let d = Math.abs(a - b) % Math.PI; return d > Math.PI / 2 ? Math.PI - d : d; };

// Pixels with gradient above rho, ordered strongest first by a 1024-bin pseudo-sort.
function ordered(G, rho) {
  const { mag } = G; let mx = 0;
  for (let i = 0; i < mag.length; i++) if (mag[i] > mx) mx = mag[i];
  const bin = i => Math.min(BINS - 1, Math.floor(mag[i] / mx * BINS)), cnt = new Int32Array(BINS + 1);
  for (let i = 0; i < mag.length; i++) if (mag[i] > rho) cnt[BINS - bin(i)]++;
  for (let b = 1; b <= BINS; b++) cnt[b] += cnt[b - 1];
  const out = new Int32Array(cnt[BINS]), at = cnt.slice();
  for (let i = 0; i < mag.length; i++) if (mag[i] > rho) out[at[BINS - 1 - bin(i)]++] = i;
  return out;
}

function grow(G, seed, used, rho, stack) {
  const { mag, ang, w, h } = G; let n = 0, sc = Math.cos(2 * ang[seed]), ss = Math.sin(2 * ang[seed]), theta = ang[seed];
  stack[n++] = seed; used[seed] = 1;
  for (let k = 0; k < n; k++) {
    const p = stack[k], x = p % w, y = (p - x) / w;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const X = x + dx, Y = y + dy, q = Y * w + X;
      if (X < 0 || Y < 0 || X >= w - 1 || Y >= h - 1 || used[q] || mag[q] <= rho || angDiff(ang[q], theta) > TAU) continue;
      used[q] = 1; stack[n++] = q; sc += Math.cos(2 * ang[q]); ss += Math.sin(2 * ang[q]);
      theta = Math.atan2(ss, sc) / 2; if (theta < 0) theta += Math.PI;
    }
  }
  return stack.slice(0, n);
}

// Gradient-weighted moments of a pixel set (coordinates at the 2x2 gradient's centre, x + 1, y + 1).
export function moments(G, px) {
  const m = { s: 0, x: 0, y: 0, xx: 0, xy: 0, yy: 0 };
  for (const p of px) { const wt = G.mag[p], x = (p % G.w) + 1, y = Math.floor(p / G.w) + 1; m.s += wt; m.x += wt * x; m.y += wt * y; m.xx += wt * x * x; m.xy += wt * x * y; m.yy += wt * y * y; }
  return m;
}
export function poolMoments(list) {
  const m = { s: 0, x: 0, y: 0, xx: 0, xy: 0, yy: 0 };
  for (const q of list) for (const k in m) m[k] += q[k];
  return m;
}
// Total-least-squares line through moments: centre and unit direction (the major axis of the weighted scatter).
export function tls(m) {
  const cx = m.x / m.s, cy = m.y / m.s, a = m.xx / m.s - cx * cx, b = m.xy / m.s - cx * cy, c = m.yy / m.s - cy * cy;
  const th = 0.5 * Math.atan2(2 * b, a - c), l1 = (a + c) / 2 + Math.hypot((a - c) / 2, b), l2 = (a + c) / 2 - Math.hypot((a - c) / 2, b);
  return { cx, cy, dx: Math.cos(th), dy: Math.sin(th), l1, l2: Math.max(0, l2) };
}

// The region's rectangle and its log10 NFA, counting aligned pixels on a 1-pixel lattice inside it.
function rectNFA(G, px, fit, logNT) {
  const { cx, cy, dx, dy } = fit; let lo = Infinity, hi = -Infinity, wl = Infinity, wh = -Infinity;
  for (const p of px) { const x = (p % G.w) + 1 - cx, y = Math.floor(p / G.w) + 1 - cy, a = x * dx + y * dy, b = -x * dy + y * dx; lo = Math.min(lo, a); hi = Math.max(hi, a); wl = Math.min(wl, b); wh = Math.max(wh, b); }
  const theta = ((Math.atan2(dy, dx) % Math.PI) + Math.PI) % Math.PI; let n = 0, k = 0;
  for (let a = lo; a <= hi + 1e-9; a += 1) for (let b = wl; b <= wh + 1e-9; b += 1) {
    const X = Math.round(cx + a * dx - b * dy) - 1, Y = Math.round(cy + a * dy + b * dx) - 1;
    if (X < 0 || Y < 0 || X >= G.w - 1 || Y >= G.h - 1) continue;
    n++; const q = Y * G.w + X; if (G.mag[q] > 0 && angDiff(G.ang[q], theta) <= TAU) k++;
  }
  return { lo, hi, width: wh - wl + 1, n, k, log10NFA: logNT + log10BinomTail(n, k, P_ALIGN) };
}

// Detect segments. rgba: 8-bit sRGB. Returns [{ x1, y1, x2, y2, len, angle, mx, my, width, log10NFA, m }].
// angle: degrees counterclockwise as seen on screen, in (-90, 90].
export function detectLines(rgba, w, h, { rho = 2 / 255 / Math.sin(TAU), log10eps = 0, minPx = 6, smooth = 0 } = {}) {
  const G = gradient(rgba, w, h, smooth), order = ordered(G, rho), used = new Uint8Array(w * h), stack = new Int32Array(w * h);
  const logNT = log10Tests(w, h), out = [];
  for (const s of order) {
    if (used[s]) continue;
    const px = grow(G, s, used, rho, stack);
    if (px.length < minPx) continue;
    const m = moments(G, px), fit = tls(m), r = rectNFA(G, px, fit, logNT);
    if (!(r.log10NFA < log10eps)) continue;
    const x1 = fit.cx + r.lo * fit.dx, y1 = fit.cy + r.lo * fit.dy, x2 = fit.cx + r.hi * fit.dx, y2 = fit.cy + r.hi * fit.dy;
    let angle = Math.atan2(-fit.dy, fit.dx) * 180 / Math.PI; if (angle <= -90) angle += 180; if (angle > 90) angle -= 180;
    out.push({ x1, y1, x2, y2, len: r.hi - r.lo, angle, mx: fit.cx, my: fit.cy, width: r.width, log10NFA: r.log10NFA, n: r.n, k: r.k, m });
  }
  return out;
}
