// print.mjs: halftone, duotone and two-ink overprint. Physics first:
//   - an ink film transmits a fraction T per channel (linear RGB), so ink on paper reflects P*T and two stacked
//     inks reflect P*T1*T2 (Beer-Lambert for thin transparent layers);
//   - a halftone's mean reflectance is the area-weighted sum of its parts (Murray-Davies; with two inks, Neugebauer
//     with Demichel weights). Optical dot gain (Yule-Nielsen) is NOT modelled: a stated blind spot.
// The screen is area-true: the cosine spot function is ranked by an area table, so a tone c inks exactly c of a
// cell. Thresholding the spot function directly (`areaTrue: false`) is kept as the control.
import { lin8, enc, parseHex } from '../study/cmath.mjs';

const RAD = Math.PI / 180, BINS = 4096;
const spot = (u, v) => 0.5 - 0.25 * (Math.cos(2 * Math.PI * u) + Math.cos(2 * Math.PI * v));

// Area table: cdf[k] = fraction of the cell where spot < k / BINS.
const CDF = (() => {
  const N = 512, hist = new Float64Array(BINS + 1);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) hist[Math.min(BINS, Math.floor(spot((i + 0.5) / N, (j + 0.5) / N) * BINS)) + 0]++;
  const cdf = new Float64Array(BINS + 1); let s = 0;
  for (let k = 0; k <= BINS; k++) { cdf[k] = s / (N * N); s += hist[k]; }
  return cdf;
})();
const rank = f => { const x = f * BINS, k = Math.min(BINS - 1, Math.floor(x)); return CDF[k] + (CDF[k + 1] - CDF[k]) * (x - k); };

export const linOf = hex => parseHex(hex).map(lin8);
const enc8 = v => Math.round(255 * enc(Math.min(1, Math.max(0, v))));

// Ink coverage of pixel (x, y) by a screen of `cell` px at `angle` degrees, for tone c, from ss x ss subsamples.
export function screenCover(x, y, c, { cell = 8, angle = 45, ss = 4, areaTrue = true }) {
  if (c <= 0) return 0; if (c >= 1) return 1;
  const ca = Math.cos(angle * RAD), sa = Math.sin(angle * RAD); let hit = 0;
  for (let j = 0; j < ss; j++) for (let i = 0; i < ss; i++) {
    const px = x + (i + 0.5) / ss, py = y + (j + 0.5) / ss, u = (ca * px + sa * py) / cell, v = (-sa * px + ca * py) / cell;
    const f = spot(u - Math.floor(u), v - Math.floor(v));
    if ((areaTrue ? rank(f) : f) < c) hit++;
  }
  return hit / (ss * ss);
}

// Coverage field to an image: per pixel P * prod(1 - a_k (1 - T_k)). Returns 8-bit RGBA and the linear floats.
export function inksToImage(w, h, paper, inks, covers) {
  const lin = new Float32Array(w * h * 3), rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) for (let c = 0; c < 3; c++) {
    let r = paper[c]; inks.forEach((T, k) => { r *= 1 - covers[k][i] * (1 - T[c]); });
    lin[3 * i + c] = r; rgba[4 * i + c] = enc8(r); rgba[4 * i + 3] = 255;
  }
  return { w, h, rgba, lin };
}

const lumOf = (rgba, i) => 0.2126729 * lin8(rgba[4 * i]) + 0.7151522 * lin8(rgba[4 * i + 1]) + 0.0721750 * lin8(rgba[4 * i + 2]);

// One ink: the tone needed so the area-weighted mean luminance equals the source's (Murray-Davies, solved for c).
export function halftone({ w, h, rgba }, { ink = '#15130f', paper = '#f2ede1', cell = 8, angle = 45, ss = 4, areaTrue = true } = {}) {
  const P = linOf(paper), T = linOf(ink).map((v, c) => v / P[c]), Yp = lumOf(Uint8Array.from([...parseHex(paper), 255]), 0);
  const Yi = 0.2126729 * P[0] * T[0] + 0.7151522 * P[1] * T[1] + 0.0721750 * P[2] * T[2], cov = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; cov[i] = screenCover(x, y, (Yp - lumOf(rgba, i)) / (Yp - Yi), { cell, angle, ss, areaTrue }); }
  return inksToImage(w, h, P, [T], [cov]);
}

// Duotone as a one-axis map: linear luminance t picks a point on the segment from the dark ink to the light ink, in
// linear RGB. Every output lies on that segment by construction; `stops` with more than two entries is the control.
export function duotone({ w, h, rgba }, { stops = ['#1d2a44', '#f0d9a8'] } = {}) {
  const S = stops.map(linOf), n = S.length - 1, lin = new Float64Array(w * h * 3), out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const t = Math.min(1, Math.max(0, lumOf(rgba, i))) * n, k = Math.min(n - 1, Math.floor(t)), f = t - k;
    for (let c = 0; c < 3; c++) { const v = S[k][c] + f * (S[k + 1][c] - S[k][c]); lin[3 * i + c] = v; out[4 * i + c] = enc8(v); }
    out[4 * i + 3] = 255;
  }
  return { w, h, rgba: out, lin };
}

// Largest distance of linear-RGB points from their best-fit line (principal axis by power iteration).
export function lineResidual(lin) {
  const n = lin.length / 3, m = [0, 0, 0];
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) m[c] += lin[3 * i + c] / n;
  const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < n; i++) { const d = [0, 1, 2].map(c => lin[3 * i + c] - m[c]); for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) C[a][b] += d[a] * d[b]; }
  let v = [1, 0.7, 0.3]; for (let it = 0; it < 200; it++) { const u = C.map(r => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]), L = Math.hypot(...u) || 1; v = u.map(x => x / L); }
  let worst = 0;
  for (let i = 0; i < n; i++) { const d = [0, 1, 2].map(c => lin[3 * i + c] - m[c]), p = d[0] * v[0] + d[1] * v[1] + d[2] * v[2]; worst = Math.max(worst, Math.hypot(d[0] - p * v[0], d[1] - p * v[1], d[2] - p * v[2])); }
  return worst;
}

// Solid two-ink overprint and the alpha-blend control, as 8-bit sRGB: [paper, ink1, ink2, overlap, alphaMid].
export function solidOverprint(paper, ink1, ink2) {
  const P = linOf(paper), T1 = linOf(ink1).map((v, c) => v / P[c]), T2 = linOf(ink2).map((v, c) => v / P[c]);
  const one = T => P.map((p, c) => p * T[c]), both = P.map((p, c) => p * T1[c] * T2[c]), mid = P.map((p, c) => (one(T1)[c] + one(T2)[c]) / 2);
  return { paper: P.map(enc8), ink1: one(T1).map(enc8), ink2: one(T2).map(enc8), overlap: both.map(enc8), alphaMid: mid.map(enc8), productLin: both, T1, T2, P };
}

export { enc8 };
