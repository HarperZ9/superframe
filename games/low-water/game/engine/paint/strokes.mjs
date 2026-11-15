// The stroke field: brush strokes stored in a figure's bind space (ART-DIRECTION 7.2). Space is cut
// into cubic cells of side s; each cell holds one stroke, fixed by a hash of the cell, the layer and
// the material: a centre jittered in the cell, a direction, a length, a width and a paint order. A
// surface point belongs to the topmost stroke (by paint order) whose tapered ellipse holds it.
// Everything is a function of the bind-space point, so a stroke rides the body through any pose and
// never swims. A stroke's direction is the form's (round the body, or down it for drapes) unless the
// painter has fixed one for it at birth (dirs: key -> [x, y, z]); a fixed one never changes after.
// Original code.
//   strokeAt(p0, p1, p2, s, layer, group, flow, full, dirs, out, cache) -> out { key, u, v, m, ord } or null
//   formDir(key, cell centre, flow) -> [x, y, z]      cellOf(p, s) -> [i, j, k]      keyOf(i, j, k, layer, group)
//   bristle(key, u, v, n) -> { k, cover }

// 32-bit integer hash (a mix of multiply and xorshift rounds)
export function hash4(a, b, c, d) {
  let h = Math.imul(a | 0, 0x8da6b343) ^ Math.imul(b | 0, 0xd8163841) ^ Math.imul(c | 0, 0xcb1ab31f) ^ Math.imul(d | 0, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39); return (h ^ (h >>> 15)) >>> 0;
}
export const U = (h, k) => { let x = Math.imul(h ^ Math.imul(k, 0x9e3779b9), 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
export const keyOf = (i, j, k, layer, group) => hash4(i, j, k, layer * 131 + group);

// shape constants, in cells: half-length and half-width (each scaled by a per-stroke random)
export const HALF_LEN = 0.85, HALF_WID = 0.36;

// the jittered centre of cell (i, j, k)'s stroke, written into c
export function centreOf(h, i, j, k, s, c) { c[0] = (i + 0.5 + (U(h, 1) - 0.5) * 0.8) * s; c[1] = (j + 0.5 + (U(h, 2) - 0.5) * 0.8) * s; c[2] = (k + 0.5 + (U(h, 3) - 0.5) * 0.8) * s; return c; }
// the form's direction for a stroke centred at c: round the body's vertical axis (the bind pose
// stands on the origin) with a random lean, or down it with a wander (flow 1, a drape)
export function formDir(h, c, flow, d = [0, 0, 0]) {
  const r = Math.hypot(c[0], c[2]) || 1, ax = -c[2] / r, az = c[0] / r, lean = (U(h, 4) - 0.5) * 0.9;
  let dx = ax * (1 - flow) + (U(h, 5) - 0.5) * 0.5 * flow, dy = flow + lean * (1 - flow) * 0.6, dz = az * (1 - flow) + (U(h, 6) - 0.5) * 0.5 * flow;
  const l = Math.hypot(dx, dy, dz) || 1; d[0] = dx / l; d[1] = dy / l; d[2] = dz / l; return d;
}

const C = [0, 0, 0], D = [0, 0, 0], tmp = { key: 0, u: 0, v: 0, m: 0, ord: 0 };
// one stroke's frame: centre, direction, half-length, half-width, order (cached per figure: cache
// must be cleared when s changes, and an entry dropped when its stroke is born)
function frameOf(h, i, j, k, s, flow, dirs, cache) {
  let F = cache && cache.get(h); if (F) return F;
  centreOf(h, i, j, k, s, C);
  const d = (dirs && dirs.get(h)) || formDir(h, C, flow, D);
  F = new Float32Array([C[0], C[1], C[2], d[0], d[1], d[2], s * HALF_LEN * (0.8 + 0.5 * U(h, 7)), s * HALF_WID * (0.8 + 0.4 * U(h, 8)), U(h, 9)]);
  if (cache) cache.set(h, F);
  return F;
}
// The stroke a point belongs to in one layer. full: a layer that must cover every point (the ground
// coat): with no stroke over the point, the nearest one by membership is taken.
// the eight frames round the last base cell, reused while neighbouring pixels share it
// and a ring of 256 such base cells, direct-mapped, so a row of pixels that crosses back into a cell it
// left a few pixels ago finds its eight frames without eight hashes and eight map lookups (the
// performance engineer's measure: about 8 percent of the painter). Same frames, same bytes; any change to
// the cache (a birth, a new cell size) empties the ring.
const RING = 256, ringK = new Float64Array(RING * 5).fill(NaN), ringC = new Array(RING).fill(null), ringF = Array.from({ length: RING }, () => new Array(8)), ringH = Array.from({ length: RING }, () => new Uint32Array(8));
let ringGen = 0; const ringG = new Uint32Array(RING);
export function strokeAt(p0, p1, p2, s, layer, group, flow, full, dirs = null, out = tmp, cache = null) {
  const bi = Math.floor(p0 / s - 0.5), bj = Math.floor(p1 / s - 0.5), bk = Math.floor(p2 / s - 0.5), g = layer * 131 + group;
  let H, Fs;
  if (cache) {
    const slot = (Math.imul(bi, 73856093) ^ Math.imul(bj, 19349663) ^ Math.imul(bk, 83492791) ^ Math.imul(g, 2654435761)) & (RING - 1), o = slot * 5;
    H = ringH[slot]; Fs = ringF[slot];
    if (ringG[slot] !== ringGen || ringK[o] !== bi || ringK[o + 1] !== bj || ringK[o + 2] !== bk || ringK[o + 3] !== g || ringK[o + 4] !== s || ringC[slot] !== cache) {
      for (let n = 0; n < 8; n++) { const i = bi + (n & 1), j = bj + ((n >> 1) & 1), k = bk + ((n >> 2) & 1), h = hash4(i, j, k, g); H[n] = h; Fs[n] = frameOf(h, i, j, k, s, flow, dirs, cache); }
      ringK[o] = bi; ringK[o + 1] = bj; ringK[o + 2] = bk; ringK[o + 3] = g; ringK[o + 4] = s; ringC[slot] = cache; ringG[slot] = ringGen;
    }
  } else {
    H = noH; Fs = noF; for (let n = 0; n < 8; n++) { const i = bi + (n & 1), j = bj + ((n >> 1) & 1), k = bk + ((n >> 2) & 1), h = hash4(i, j, k, g); H[n] = h; Fs[n] = frameOf(h, i, j, k, s, flow, dirs, cache); }
  }
  let best = -1, bestM = 0, bestOrd = -1, bu = 0, bv = 0, near = -1, nearM = -1e9, nu = 0, nv = 0;
  for (let n = 0; n < 8; n++) {
    const h = H[n], F = Fs[n], L = F[6], w = F[7], ord = F[8];
    const qx = p0 - F[0], qy = p1 - F[1], qz = p2 - F[2], along = qx * F[3] + qy * F[4] + qz * F[5], u = along / L;
    const px = qx - along * F[3], py = qy - along * F[4], pz = qz - along * F[5], taper = 1 - 0.45 * u * u;
    const v = Math.sqrt(px * px + py * py + pz * pz) / (w * (taper > 0.2 ? taper : 0.2)), m = 1 - u * u - v * v;
    if (m > 0 && ord > bestOrd) { best = h; bestOrd = ord; bestM = m; bu = u; bv = v; }
    if (m > nearM) { near = h; nearM = m; nu = u; nv = v; }
  }
  if (best >= 0) { out.key = best; out.u = bu; out.v = bv; out.m = bestM; out.ord = bestOrd; return out; }
  if (!full) return null;
  out.key = near; out.u = nu; out.v = nv; out.m = 0; out.ord = 0; return out;
}
// forget the reused ring (a cache entry changed under it)
export const resetRing = () => { ringGen = (ringGen + 1) >>> 0; if (ringGen === 0) ringG.fill(0xffffffff); };
const noH = new Uint32Array(8), noF = new Array(8);
// the cell a point is in (the stroke born there)
export const cellOf = (p0, p1, p2, s, o = [0, 0, 0]) => { o[0] = Math.floor(p0 / s); o[1] = Math.floor(p1 / s); o[2] = Math.floor(p2 / s); return o; };

// Bristle texture across a stroke (v 0..1 from the axis out, mirrored; u -1..1 along), n bristles (the painter keeps
// one bristle to two screen pixels or more so it never aliases), a dry break toward the tail.
const BR = { k: 1, cover: 1 };
export function bristle(key, u, v, n) {
  if (n < 2) { const av = Math.abs(v); BR.k = av > 0.72 ? 1 - 0.1 * Math.min(1, (av - 0.72) / 0.28) : 1; BR.cover = 1; return BR; }
  const x = Math.min(0.999, Math.abs(v)) * n * 0.5, b = Math.floor(x), f = x - b, r = U(key, 20 + b);
  const groove = 0.5 - 0.5 * Math.cos(f * Math.PI * 2);   // a bristle's middle carries more paint
  // the paint's relief: a ridge of paint at the stroke's edge sits darker, its spine catches light
  const av = Math.abs(v), ridge = av > 0.72 ? -0.14 * Math.min(1, (av - 0.72) / 0.28) : av < 0.3 ? 0.05 * (1 - av / 0.3) : 0;
  BR.k = 1 + (r - 0.5) * 0.18 + (groove - 0.5) * 0.06 + ridge;
  BR.cover = u > 0.4 && r < 0.4 ? 1 - Math.min(1, (u - 0.4) / 0.5) : 1;   // some bristles run dry before the tail
  return BR;
}
