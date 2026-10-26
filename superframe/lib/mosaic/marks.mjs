// lib/mosaic/marks.mjs: tone from the density of binary marks (CORE.md, "Marks"). One law family: a field of on/off
// marks reads as continuous tone once the eye low-passes it.
//
// Not a parallel engine. The dither laws are a JavaScript port of the native renderer's dither module, raw-native
// src/renderer/dither.cpp (HarperZ9/raw-native origin/main 9d71d6fa, read only): Bayer by bit interleaving, Floyd and
// Steinberg, Atkinson, Stucki, blue-noise thresholding, line fill and contour fill, at any number of levels. The
// blue-noise mask is a port of the browser runtime's void-and-cluster, HarperZ9.github.io origin/main 3ca65296,
// media/raw-native/post-0.8.0/web/shaders/dither/bluenoise.mjs (the same 64 x 64 mask the native noise::blue tiles).
// Added here, absent from both: the AM halftone at a stated angle, the ink-coverage wrappers and the eye.
//   dither(method, grey, W, H, { levels, period, bands }) -> Float32Array of levels in 0..1 (the native apply())
//   ordered / floydSteinberg / atkinson / stucki / blueNoise / lineFill / contourFill (ink, W, H) -> Uint8Array marks
//   amHalftone(ink, W, H, { cell, angle })
//   ink: Float32Array W*H, the share of each pixel to be covered (1 = solid ink); a mark is a dark pixel.
// Plain ES module, no imports: node and browser.

const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const quant = (v, levels) => { const s = levels - 1; return Math.floor(clamp01(v) * s + 0.5) / s; };
const orderedLevel = (v, t, levels) => { const s = levels - 1, x = clamp01(v) * s, lo = Math.floor(x); return (lo + (x - lo > t ? 1 : 0)) / s; };

// the native rank: the low bits of (x xor y, y) become the high bits of the rank ([[0, 2], [3, 1]] at n = 2)
export function bayerRank(n, x, y) {
  let k = 0; for (let m = n; m > 1; m >>= 1) ++k;
  let r = 0; for (let b = 0; b < k; b++) r |= ((((x ^ y) >> b) & 1) << (2 * (k - 1 - b) + 1)) | (((y >> b) & 1) << (2 * (k - 1 - b)));
  return r;
}
export const bayerMatrix = (n = 8) => Array.from({ length: n }, (_, y) => Array.from({ length: n }, (_, x) => bayerRank(n, x, y)));
export function bayerMask(n = 8) { const M = new Float32Array(n * n); for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) M[y * n + x] = (bayerRank(n, x, y) + 0.5) / (n * n); return { n, mask: M }; }

// ---- the site's void-and-cluster (Ulichney 1993), ported unchanged in method ----
function pcg(v) { const state = (Math.imul(v >>> 0, 747796405) + 2891336453) >>> 0; const word = Math.imul(((state >>> (((state >>> 28) + 4) >>> 0)) ^ state) >>> 0, 277803737) >>> 0; return ((word >>> 22) ^ word) >>> 0; }
function vacKernel(N, sigma) { const k = new Float64Array(N * N); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const dx = Math.min(x, N - x), dy = Math.min(y, N - y); k[y * N + x] = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma)); } return k; }
function vacSplat(E, K, N, p, sign) { const px = p % N, py = (p / N) | 0; for (let y = 0; y < N; y++) { const ky = ((y - py + N) % N) * N, row = y * N; for (let x = 0; x < N; x++) E[row + x] += sign * K[ky + ((x - px + N) % N)]; } }
function vacExtreme(E, bits, want, max) { let best = -1, v = max ? -Infinity : Infinity; for (let p = 0; p < E.length; p++) if (bits[p] === want && (max ? E[p] > v : E[p] < v)) { v = E[p]; best = p; } return best; }
export function vacRanks(N = 64, { sigma = 1.5, density = 0.1, seed = 20261010 } = {}) {
  const K = vacKernel(N, sigma), size = N * N, bits = new Uint8Array(size), E = new Float64Array(size);
  for (let p = 0; p < size; p++) if (pcg(p ^ pcg(seed)) / 4294967296 < density) { bits[p] = 1; vacSplat(E, K, N, p, 1); }
  for (let guard = 0; guard < size * 4; guard++) { const c = vacExtreme(E, bits, 1, true); bits[c] = 0; vacSplat(E, K, N, c, -1); const v = vacExtreme(E, bits, 0, false); bits[v] = 1; vacSplat(E, K, N, v, 1); if (v === c) break; }
  const proto = bits.slice(), protoE = E.slice(), ones = proto.reduce((a, b) => a + b, 0), rank = new Int32Array(size).fill(-1);
  for (let r = ones - 1; r >= 0; r--) { const c = vacExtreme(E, bits, 1, true); bits[c] = 0; vacSplat(E, K, N, c, -1); rank[c] = r; }
  bits.set(proto); E.set(protoE); let r = ones;
  for (; r < size / 2; r++) { const v = vacExtreme(E, bits, 0, false); bits[v] = 1; vacSplat(E, K, N, v, 1); rank[v] = r; }
  E.fill(0); for (let p = 0; p < size; p++) if (!bits[p]) vacSplat(E, K, N, p, 1);
  for (; r < size; r++) { const c = vacExtreme(E, bits, 0, true); bits[c] = 1; vacSplat(E, K, N, c, -1); rank[c] = r; }
  return rank;
}
const VAC = new Map();
export function voidAndCluster(N = 64, opts = {}) { const key = `${N}/${JSON.stringify(opts)}`; if (!VAC.has(key)) { const rank = vacRanks(N, opts), mask = new Float32Array(N * N); for (let i = 0; i < N * N; i++) mask[i] = (rank[i] + 0.5) / (N * N); VAC.set(key, { n: N, mask }); } return VAC.get(key); }

// ---- the native apply(), ported ----
const TAPS = {
  'floyd-steinberg': [[[1, 0, 7], [-1, 1, 3], [0, 1, 5], [1, 1, 1]], 16],
  atkinson: [[[1, 0, 1], [2, 0, 1], [-1, 1, 1], [0, 1, 1], [1, 1, 1], [0, 2, 1]], 8],
  stucki: [[[1, 0, 8], [2, 0, 4], [-2, 1, 2], [-1, 1, 4], [0, 1, 8], [1, 1, 4], [2, 1, 2], [-2, 2, 1], [-1, 2, 2], [0, 2, 4], [1, 2, 2], [2, 2, 1]], 42],
};
function diffuse(g, W, H, levels, taps, denom) {
  const e = Float32Array.from(g), out = new Float32Array(g.length);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, q = quant(e[i], levels), err = e[i] - q; out[i] = q;
    for (const [dx, dy, w] of taps) { const xx = x + dx, yy = y + dy; if (xx < 0 || xx >= W || yy >= H) continue; e[yy * W + xx] += err * w / denom; }
  }
  return out;
}
export const METHODS = Object.freeze(['bayer2', 'bayer4', 'bayer8', 'floyd-steinberg', 'atkinson', 'stucki', 'blue', 'line-fill', 'contour-fill']);
export function dither(method, g, W, H, { levels = 2, period = 6, bands = 6 } = {}) {
  levels = Math.max(2, levels); const out = new Float32Array(W * H), each = f => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) out[y * W + x] = f(g[y * W + x], x, y); return out; };
  if (/^bayer[248]$/.test(method)) { const n = +method.slice(5); return each((v, x, y) => orderedLevel(v, (bayerRank(n, x % n, y % n) + 0.5) / (n * n), levels)); }
  if (method === 'blue') { const { mask } = voidAndCluster(64); return each((v, x, y) => orderedLevel(v, mask[(y & 63) * 64 + (x & 63)], levels)); }
  if (TAPS[method]) return diffuse(g, W, H, levels, ...TAPS[method]);
  if (method === 'line-fill') { const p = Math.max(2, period); return each((v, x, y) => ((((x + y) % p + p) % p + 0.5) / p < 1 - clamp01(v) ? 0 : 1)); }
  if (method === 'contour-fill') {
    const b = Math.max(2, bands), band = v => Math.min(b - 1, Math.floor(clamp01(v) * b));
    return each((v, x, y) => { const k = band(v), edge = (x + 1 < W && band(g[y * W + x + 1]) !== k) || (y + 1 < H && band(g[(y + 1) * W + x]) !== k); return edge ? 0 : levels > 2 ? quant((k + 0.5) / b, levels) : 1; });
  }
  throw new Error(`dither: no method "${method}" (one of ${METHODS.join(', ')})`);
}

// binary marks from ink coverage: grey = 1 - ink, a mark where the native result is dark
const asMarks = method => (ink, W, H, o = {}) => { const g = Float32Array.from(ink, v => 1 - v), q = dither(method, g, W, H, { ...o, levels: 2 }), m = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) m[i] = q[i] < 0.5 ? 1 : 0; return m; };
export const ordered = (ink, W, H, { n = 8 } = {}) => asMarks(`bayer${n}`)(ink, W, H);
export const floydSteinberg = asMarks('floyd-steinberg'), atkinson = asMarks('atkinson'), stucki = asMarks('stucki'), blueNoise = asMarks('blue');
export const lineFill = (ink, W, H, { period = 6 } = {}) => asMarks('line-fill')(ink, W, H, { period });
export const contourFill = (ink, W, H, { bands = 6 } = {}) => asMarks('contour-fill')(ink, W, H, { bands });

// any tiled threshold mask on ink (the riso and xerox recipes use their own cells and phases)
export function thresholdMask(ink, W, H, { n, mask }, { ox = 0, oy = 0 } = {}) {
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; out[i] = ink[i] > mask[(((y + oy) % n) + n) % n * n + ((((x + ox) % n) + n) % n)] ? 1 : 0; }
  return out;
}

// AM halftone (new here): round dots on a lattice of `cell` px turned by `angle` degrees; the spot function's ranks
// over one cell are found once, so a flat ink a covers a share a of the paper
const SPOT = new Map();
function spotRank(res = 64) {
  if (SPOT.has(res)) return SPOT.get(res);
  const v = [], n = res * res;
  for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) { const u = (i + 0.5) / res, w = (j + 0.5) / res; v.push([0.5 - 0.25 * (Math.cos(2 * Math.PI * u) + Math.cos(2 * Math.PI * w)) + 1e-6 * (j * res + i) / n, j * res + i]); }
  v.sort((a, b) => a[0] - b[0]); const T = new Float32Array(n); v.forEach(([, k], r) => { T[k] = (r + 0.5) / n; });
  const out = { res, T }; SPOT.set(res, out); return out;
}
export function amHalftone(ink, W, H, { cell = 8, angle = 45 } = {}) {
  const { res, T } = spotRank(), a = angle * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const px = x + 0.5, py = y + 0.5, u = (px * ca + py * sa) / cell, v = (-px * sa + py * ca) / cell, fu = u - Math.floor(u), fv = v - Math.floor(v);
    out[y * W + x] = ink[y * W + x] > T[Math.min(res - 1, Math.floor(fv * res)) * res + Math.min(res - 1, Math.floor(fu * res))] ? 1 : 0;
  }
  return out;
}

export const LAWS = Object.freeze({ bayer: ordered, ordered, 'floyd-steinberg': floydSteinberg, atkinson, stucki, blue: blueNoise, 'line-fill': lineFill, 'contour-fill': contourFill, halftone: amHalftone });
export function marks(law, ink, W, H, opts = {}) { const f = LAWS[law]; if (!f) throw new Error(`marks: no law "${law}" (one of ${Object.keys(LAWS).join(', ')})`); return f(ink, W, H, opts); }

// the eye: a Gaussian low-pass (separable, edges clamped), for the readout checks and the far view
export function eye(field, W, H, sigma = 2) {
  const R = Math.max(1, Math.ceil(sigma * 3)), k = []; let s = 0;
  for (let d = -R; d <= R; d++) { const g = Math.exp(-(d * d) / (2 * sigma * sigma)); k.push(g); s += g; }
  for (let i = 0; i < k.length; i++) k[i] /= s;
  const a = new Float32Array(W * H), b = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = 0; for (let d = -R; d <= R; d++) v += k[d + R] * field[y * W + Math.min(W - 1, Math.max(0, x + d))]; a[y * W + x] = v; }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = 0; for (let d = -R; d <= R; d++) v += k[d + R] * a[Math.min(H - 1, Math.max(0, y + d)) * W + x]; b[y * W + x] = v; }
  return b;
}
