// ink.mjs: the ink line. A line is a ribbon of quads and round joints, all wound the same way, so the nonzero fill
// unions them into one stroke with no seams. Two weight rules, both authored conventions of cel inking:
//   - silhouette weight: a closed outline is thicker where its outward normal faces away from the key light
//     (lower right for a light at upper left), the "weight on the shadow side" rule;
//   - pressure: an open stroke swells in the middle and tapers to its ends, as a brush does under a lifting hand.
// The boil is the third rule: every drawing is redrawn a little differently each hold, from a smooth noise field,
// so neighbouring points move together and the line shimmers instead of tearing.
import { orient, ellipse, area } from './geom.mjs';
import { rngFrom } from '../seed.mjs';

export const KEY_LIGHT = [-0.55, -0.83];   // direction toward the key light, screen y down (upper left); authored

function disc(c, r) { return ellipse(c[0], c[1], r, r, Math.max(6, Math.min(24, Math.round(r * 1.2)))); }

// A ribbon along points P with full widths W. closed joins the last point to the first.
export function ribbon(P, W, closed = false) {
  const out = [], n = P.length, segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const a = P[i], b = P[(i + 1) % n], wa = W[i] / 2, wb = W[(i + 1) % n] / 2;
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); if (l < 1e-6 || (wa < 0.05 && wb < 0.05)) continue;
    const nx = -dy / l, ny = dx / l;
    out.push(orient([[a[0] + nx * wa, a[1] + ny * wa], [b[0] + nx * wb, b[1] + ny * wb], [b[0] - nx * wb, b[1] - ny * wb], [a[0] - nx * wa, a[1] - ny * wa]], 1));
  }
  for (let i = 0; i < n; i++) if (W[i] > 0.6 && (closed || (i > 0 && i < n - 1) || W[i] > 1.5)) out.push(orient(disc(P[i], W[i] / 2), 1));
  return out;
}

// Outward unit normal at each vertex of a closed contour (screen y down; works for either winding).
export function normals(C) {
  const s = Math.sign(area(C)) || 1, n = C.length;
  return C.map((_, i) => {
    const a = C[(i - 1 + n) % n], b = C[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    return [s * dy / l, -s * dx / l];
  });
}

// Silhouette ink on a closed contour. w is the mean width in px; spread sets how far the weight swings with the light.
export function inkClosed(C, { w = 4, light = KEY_LIGHT, spread = 0.75, floor = 0.45 } = {}) {
  const N = normals(C), away = [-light[0], -light[1]];
  const W = N.map(([nx, ny]) => w * Math.max(floor, 1 + spread * (nx * away[0] + ny * away[1])));
  return ribbon(C, W, true);
}

// Brush pressure along an open stroke: 0 at the ends (scaled by taper), 1 in the middle.
export const pressure = (s, { taper = [0.35, 0.35], min = 0.12 } = {}) => {
  const a = taper[0] > 0 ? Math.min(1, s / taper[0]) : 1, b = taper[1] > 0 ? Math.min(1, (1 - s) / taper[1]) : 1;
  return Math.max(min, Math.sin((Math.PI / 2) * Math.min(a, b)));
};
export function inkOpen(P, { w = 3, taper, min } = {}) {
  const L = [0]; for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const T = L[L.length - 1] || 1;
  return ribbon(P, L.map(l => w * pressure(l / T, { taper, min })), false);
}

// ---- boil and holds
// Smooth 2D value noise, one lattice per (seed, step); returns a function of (x, y) in -1..1.
export function noise2(seed) {
  const r = rngFrom(seed), G = 64, T = Float32Array.from({ length: G * G }, () => r() * 2 - 1);
  const v = (i, j) => T[((j % G) + G) % G * G + (((i % G) + G) % G)];
  return (x, y) => {
    const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = v(i, j) + (v(i + 1, j) - v(i, j)) * sx, b = v(i, j + 1) + (v(i + 1, j + 1) - v(i, j + 1)) * sx;
    return a + (b - a) * sy;
  };
}
// Which drawing of the boil cycle frame f shows: a new drawing every `hold` frames, cycling through `cycle` redraws.
export const boilStep = (f, { hold = 2, cycle = 3 } = {}) => Math.floor(f / hold) % cycle;
// The frame whose pose is shown at frame f when animating on `hold`s (twos: hold = 2).
export const heldFrame = (f, hold = 2) => f - (((f % hold) + hold) % hold);

const fields = new Map();
function field(seed, step) { const k = `${seed}/${step}`; if (!fields.has(k)) { if (fields.size > 64) fields.clear(); fields.set(k, [noise2(`${k}/x`), noise2(`${k}/y`)]); } return fields.get(k); }
// Displace every point by up to amp px, coherent over `cell` px. amp 0 returns the contours untouched.
export function boil(contours, { amp = 0, cell = 60, seed = 'boil', step = 0 } = {}) {
  if (!amp) return contours;
  const [fx, fy] = field(seed, step);
  return contours.map(C => C.map(([x, y]) => [x + amp * fx(x / cell, y / cell), y + amp * fy(x / cell, y / cell)]));
}
