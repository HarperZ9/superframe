// echo.mjs: the frame-offset echo and the onion skin, both reads of the time axis. An echo is a copy of a moving layer
// delayed by k frames, recoloured as tint x luma and composited under the base (Porter-Duff over, exact). The onion
// skin draws flat ghosts of past and future frames. Tints and ghost colours are authored conventions.
// The checks run the echo backwards: subtract the base-only render, cross-correlate the residual with the base's
// brightness over lags, and fit the tint by least squares on the delayed base.
import { layer, luma } from './frame.mjs';
import { readStack } from './stack.mjs';
import { rngFrom } from '../seed.mjs';

// A hard-edged sprite (pixel art: rows of palette indices, 0 transparent) stamped at whole-pixel positions along a path.
export function spriteSeq({ w, h, rows, palette, path }) {
  const sh = rows.length, sw = rows[0].length;
  return n => {
    const L = layer(w, h), [px, py] = path(n), x0 = Math.round(px - sw / 2), y0 = Math.round(py - sh / 2);
    for (let j = 0; j < sh; j++) for (let i = 0; i < sw; i++) {
      const k = rows[j][i], x = x0 + i, y = y0 + j; if (!k || x < 0 || y < 0 || x >= w || y >= h) continue;
      const d = y * w + x; L.a[d] = 1; for (let c = 0; c < 3; c++) L.px[3 * d + c] = palette[k][c];
    }
    return L;
  };
}

// Per-frame delay for a copy: fixed k, or k plus a uniform integer jitter in [-j, j] drawn from a seeded stream.
export function delays(k, n, { jitter = 0, seed = 'echo' } = {}) {
  const r = rngFrom(`${seed}/${k}/${jitter}`), out = [];
  for (let i = 0; i < n; i++) out.push(k + (jitter ? Math.floor(r() * (2 * jitter + 1)) - jitter : 0));
  return out;
}

// The echoed frame n: copies oldest first, then the base on top. copies = [{ k, tint, opacity, jitterOf }].
export function echoFrame(seq, n, { ground, copies }) {
  const order = [...copies].sort((a, b) => b.k - a.k);
  const entries = order.map(c => ({ layer: seq(n - (c.delay ? c.delay[n] : c.k)), tint: c.tint, opacity: c.opacity ?? 1 }));
  entries.push({ layer: seq(n) });
  return readStack(ground, entries);
}
export const baseFrame = (seq, n, ground) => readStack(ground, [{ layer: seq(n) }]);

// Onion skin: ghosts at offsets -past..-1 and 1..future, opacity falling linearly with distance, under the base.
// `only` keeps a single ghost (for measuring it); `offsets: false` is the control that draws every ghost at frame n.
export function onionFrame(seq, n, { ground, past = 3, future = 3, pastRGB = [0.85, 0.25, 0.2], futureRGB = [0.2, 0.55, 0.95], peak = 0.55, offsets = true, only = null }) {
  const entries = [], add = (j, rgb, far) => { if (only === null || only === j) entries.push({ layer: seq(offsets ? n + j : n), flat: rgb, opacity: peak * (1 - (Math.abs(j) - 1) / far) }); };
  for (let j = past; j >= 1; j--) add(-j, pastRGB, past + 1);
  for (let j = future; j >= 1; j--) add(j, futureRGB, future + 1);
  entries.push({ layer: seq(n) });
  return readStack(ground, entries);
}

// The echo's predicted shape under the base at frame n for lag k: P = opacity * alpha' * luma' * (1 - alpha_n), and
// the ground it covers Q = opacity * alpha' * (1 - alpha_n). Residual = tint * P - ground * Q, channel by channel.
function predictor(seq, n, k, opacity) {
  const B = seq(n), D = seq(n - k), Y = luma(D), N = B.w * B.h, P = new Float32Array(N), Q = new Float32Array(N);
  for (let i = 0; i < N; i++) { const m = opacity * (1 - B.a[i]); P[i] = m * Y[i]; Q[i] = m * D.a[i]; }
  return { P, Q };
}

// Least-squares tint from output frames (8-bit or float) at frames ns, assuming lag k. support is sum P^2; with no
// support the tint is unrecoverable and comes back null.
export function recoverTint(outs, seq, ns, { k, opacity = 1, ground }) {
  const num = [0, 0, 0]; let den = 0;
  ns.forEach((n, idx) => {
    const O = outs[idx], Bf = baseFrame(seq, n, ground), { P, Q } = predictor(seq, n, k, opacity);
    for (let i = 0; i < P.length; i++) { if (P[i] === 0) continue; den += P[i] * P[i];
      for (let c = 0; c < 3; c++) num[c] += P[i] * (O.px[3 * i + c] - Bf.px[3 * i + c] + ground.rgb[c] * Q[i]); }
  });
  return den < 1e-9 ? { tint: null, support: den } : { tint: num.map(v => v / den), support: den };
}

// Pearson correlation of the residual's luma with the base's brightness (alpha x luma) at each lag 0..maxLag.
export function lagCorrelation(outs, seq, ns, { ground, maxLag = 12 }) {
  const res = ns.map((n, idx) => { const O = outs[idx], Bf = baseFrame(seq, n, ground), r = new Float32Array(O.w * O.h), Yo = luma(O), Yb = luma(Bf); for (let i = 0; i < r.length; i++) r[i] = Yo[i] - Yb[i]; return r; });
  const out = [];
  for (let L = 0; L <= maxLag; L++) out.push(pearson(res, ns.map(n => luma(seq(n - L)))));
  return out;
}
function pearson(As, Bs) {
  let n = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
  for (let f = 0; f < As.length; f++) for (let i = 0; i < As[f].length; i++) { const a = As[f][i], b = Bs[f][i]; n++; sa += a; sb += b; saa += a * a; sbb += b * b; sab += a * b; }
  const cov = sab / n - sa * sb / n / n, va = saa / n - (sa / n) ** 2, vb = sbb / n - (sb / n) ** 2;
  return va > 0 && vb > 0 ? cov / Math.sqrt(va * vb) : 0;
}

// Centroid of the change one ghost makes to the base-only render: where a reader of the output sees that ghost.
export function ghostCentroid(seq, n, j, opts) {
  const base = baseFrame(seq, n, opts.ground), one = onionFrame(seq, n, { ...opts, only: j });
  let s = 0, sx = 0, sy = 0;
  for (let y = 0; y < base.h; y++) for (let x = 0; x < base.w; x++) {
    const p = 3 * (y * base.w + x); let d = 0; for (let c = 0; c < 3; c++) d += Math.abs(one.px[p + c] - base.px[p + c]);
    s += d; sx += d * (x + 0.5); sy += d * (y + 0.5);
  }
  return s > 0 ? [sx / s, sy / s] : null;
}
