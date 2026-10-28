// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// hidden.mjs: a picture that looks the same as another in daylight and becomes a different picture by candlelight.
// For each colour p of the day picture, the metamer set (metamers.mjs) is convex. Two of its members are found by
// linear programming: E- and E+, the spectra that make the candle-lit luminance smallest and largest while matching p
// exactly under D65. A pixel of the hidden picture with brightness t blends toward E+ (from the plain spectrum, or from
// E-; see makeHidden's base). Every such blend lies in
// the set, so under D65 the pixel reads p exactly; by candlelight its luminance follows t. The hidden picture is
// carried by luminance, within the range each colour allows; saturated, very dark and very light colours allow little.
import { BANDS } from './spectral.mjs';
import { observerRows, read, reflectanceOf } from './metamers.mjs';

// maximise c.x subject to A x = b, x >= 0 (dense two-phase simplex, Bland's rule; small problems only)
export function lpMax(A, b, c, eps = 1e-11) {
  const m = A.length, n = c.length, N = n + m;
  const T = A.map((row, i) => { const s = b[i] < 0 ? -1 : 1, r = new Float64Array(N + 1); for (let j = 0; j < n; j++) r[j] = s * row[j]; r[n + i] = 1; r[N] = s * b[i]; return r; });
  const basis = Array.from({ length: m }, (_, i) => n + i);
  const run = (cost, allowed) => {
    for (let it = 0; it < 5000; it++) {
      let enter = -1;
      for (let j = 0; j < N && enter < 0; j++) {
        if (!allowed(j) || basis.includes(j)) continue;
        let rc = cost[j]; for (let i = 0; i < m; i++) rc -= cost[basis[i]] * T[i][j];
        if (rc > eps) enter = j;
      }
      if (enter < 0) return true;
      let leave = -1, best = Infinity;
      for (let i = 0; i < m; i++) if (T[i][enter] > eps) { const q = T[i][N] / T[i][enter]; if (q < best - 1e-15 || (Math.abs(q - best) <= 1e-15 && basis[i] < basis[leave])) { best = q; leave = i; } }
      if (leave < 0) throw new Error('lpMax: unbounded');
      const pv = T[leave][enter]; for (let j = 0; j <= N; j++) T[leave][j] /= pv;
      for (let i = 0; i < m; i++) if (i !== leave && T[i][enter] !== 0) { const f = T[i][enter]; for (let j = 0; j <= N; j++) T[i][j] -= f * T[leave][j]; }
      basis[leave] = enter;
    }
    throw new Error('lpMax: no convergence');
  };
  run(Array.from({ length: N }, (_, j) => (j >= n ? -1 : 0)), () => true);
  let art = 0; for (let i = 0; i < m; i++) if (basis[i] >= n) art += T[i][N];
  if (art > 1e-8) throw new Error('lpMax: infeasible');
  // drive zero-valued artificials out of the basis where a real column can replace them
  for (let i = 0; i < m; i++) if (basis[i] >= n) {
    const j = [...Array(n).keys()].find(k => Math.abs(T[i][k]) > 1e-9 && !basis.includes(k));
    if (j === undefined) continue;
    const pv = T[i][j]; for (let k = 0; k <= N; k++) T[i][k] /= pv;
    for (let r = 0; r < m; r++) if (r !== i && T[r][j] !== 0) { const f = T[r][j]; for (let k = 0; k <= N; k++) T[r][k] -= f * T[i][k]; }
    basis[i] = j;
  }
  run(Array.from({ length: N }, (_, j) => (j < n ? c[j] : 0)), j => j < n);
  const x = new Float64Array(n); for (let i = 0; i < m; i++) if (basis[i] < n) x[basis[i]] = T[i][N];
  return x;
}

// the extreme metamers of spectrum R0: matching it for `observer` under `day`, with the candle-lit luminance (row Y
// of the standard observer under `night`) smallest and largest; bands in [lo, hi]
export function extremes(R0, { day = 'D65', night = 'candle', lo = 0.001, hi = 0.999 } = {}) {
  // widen the bounds to hold R0 itself, so the start is always feasible (smooth spectra of saturated colours can dip
  // below 0.001 in some band); still inside (0, 1)
  lo = Math.min(lo, ...R0); hi = Math.max(hi, ...R0);
  const rows = observerRows('standard', day), y = observerRows('standard', night)[1], u = hi - lo;
  const t = read(rows, R0).map((v, k) => v - rows[k].reduce((s, a) => s + a * lo, 0));
  // variables: y_i = x_i - lo (16) and slacks s_i with y_i + s_i = u (16)
  const A = [...rows.map(r => [...r, ...new Array(BANDS).fill(0)]), ...Array.from({ length: BANDS }, (_, i) => { const r = new Array(2 * BANDS).fill(0); r[i] = 1; r[BANDS + i] = 1; return r; })];
  const b = [...t, ...new Array(BANDS).fill(u)];
  const solve = sign => { const x = lpMax(A, b, [...y.map(v => sign * v), ...new Array(BANDS).fill(0)]); return Array.from({ length: BANDS }, (_, i) => lo + x[i]); };
  return { min: solve(-1), max: solve(1) };
}

// encode: day picture (linear RGB) and hidden brightness t in [0, 1], per pixel; colours are cached on the prism's
// 6-bit grid. Returns the spectra's colours under each light (linear RGB) and each pixel's candle luminance range.
// base 'plain' (default): t = 0 keeps the plain smooth spectrum, so outside the hidden shape the candle-lit picture is
// the plain one, and t = 1 goes to the brighter extreme. base 'extremes': t runs from the darker extreme to the
// brighter one, which carries more contrast but recolours the whole picture by candlelight.
export function makeHidden(dayRGB, hiddenT, n, { day = 'D65', night = 'candle', render, base = 'plain' }) {
  let failed = 0;
  const cache = new Map(), outDay = new Float32Array(3 * n), outNight = new Float32Array(3 * n), range = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = [dayRGB[3 * i], dayRGB[3 * i + 1], dayRGB[3 * i + 2]], R0 = reflectanceOf(p), key = R0;
    let e = cache.get(key);
    if (!e) {
      let x;
      // a colour whose extremes cannot be solved keeps its plain spectrum (it carries no hidden signal) and is counted
      try { x = extremes(R0, { day, night }); } catch (err) { if (!/lpMax/.test(err.message)) throw err; x = { min: R0, max: R0 }; failed++; } const low = base === 'plain' ? R0 : x.min, Yn = observerRows('standard', night)[1];
      e = { x, d: [render(low, day), render(x.max, day)], nt: [render(low, night), render(x.max, night)], y: [read([Yn], low)[0], read([Yn], x.max)[0]] }; cache.set(key, e); }
    const t = hiddenT[i];
    for (let c = 0; c < 3; c++) {
      // the colour of a blend is the blend of the colours: the readout is linear in the spectrum
      outDay[3 * i + c] = (1 - t) * e.d[0][c] + t * e.d[1][c];
      outNight[3 * i + c] = (1 - t) * e.nt[0][c] + t * e.nt[1][c];
    }
    range[i] = e.y[1] - e.y[0];
  }
  return { day: outDay, night: outNight, range, colours: cache.size, failed };
}
