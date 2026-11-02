// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* diagram/sim/analyses: DC operating point (Newton with step limiting), AC small-signal sweep, transient
   (backward Euler start, then trapezoidal or BDF2), and small-signal noise with every source propagated to one
   output or to the cross-spectrum of two outputs. */
(function (g) {
  "use strict";
  const D = (g.Diagram = g.Diagram || {});
  const S = (D.SIM = D.SIM || {});

  const solveReal = (M) => S.luSolve(S.luFactor(M.A, M.n), M.b);
  const vAt = (x, i) => (i < 0 ? 0 : x[i]);

  /* Newton on the real system at time t; history h for transient steps. */
  const newton = (ck, ctx, x0) => {
    let x = x0 ? Float64Array.from(x0) : new Float64Array(ck.size);
    if (!ck.nonlinear) return solveReal(S.assembleReal(ck, Object.assign({}, ctx, { x })));
    for (let it = 0; it < 200; it++) {
      const xn = solveReal(S.assembleReal(ck, Object.assign({}, ctx, { x })));
      let dmax = 0;
      for (const e of ck.elements) if (e.t === "D") {   /* limit each junction's step to 2 thermal voltages per iteration */
        const Vt = S.kB * (e.T || 300) / S.q * (e.N || 1), vo = vAt(x, e.i[0]) - vAt(x, e.i[1]), vn = vAt(xn, e.i[0]) - vAt(xn, e.i[1]);
        if (vn - vo > 2 * Vt && vn > 0.3) { const f = (vo + 2 * Vt - vo) / (vn - vo); for (let k = 0; k < xn.length; k++) xn[k] = x[k] + (xn[k] - x[k]) * f; }
      }
      for (let k = 0; k < xn.length; k++) dmax = Math.max(dmax, Math.abs(xn[k] - x[k]));
      x = xn;
      if (dmax < 1e-12 + 1e-9 * Math.max(...x.map(Math.abs))) return x;
    }
    throw new Error("sim: Newton did not converge");
  };

  S.dc = (ck, opt = {}) => {
    const x = newton(ck, { t: opt.t || 0, gmin: opt.gmin }, opt.x0);
    return { x, t: opt.t || 0, v: (name) => vAt(x, S.nodeIndex(ck, name)), i: (el) => x[ck.elements.find((e) => e.name === el).br] };
  };

  /* AC: one complex solve per frequency; returns a reader of complex node voltages. */
  S.ac = (ck, freqs, opt = {}) => {
    const op = opt.op || S.dc(ck), out = [];
    for (const f of freqs) {
      const M = S.assembleC(ck, 2 * Math.PI * f, op), F = S.luFactorC(M.Ar, M.Ai, M.n);
      out.push(Object.assign({ f }, S.luSolveC(F, M.br, M.bi)));
    }
    const at = (k, name) => { const i = S.nodeIndex(ck, name); return i < 0 ? [0, 0] : [out[k].re[i], out[k].im[i]]; };
    return { op, freqs, out, at, mag: (k, name) => Math.hypot(...at(k, name)), ph: (k, name) => Math.atan2(at(k, name)[1], at(k, name)[0]) };
  };

  const gauss = (r) => { let u = r(); if (u < 1e-300) u = 1e-300; return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); };

  /* history after a solve: capacitor voltage and current, inductor current and voltage, one step back kept */
  const updateHist = (ck, H, x, dt, m) => {
    for (const e of ck.elements) {
      if (e.t !== "C" && e.t !== "L") continue;
      const h = H.get(e), v = vAt(x, e.i[0]) - vAt(x, e.i[1]);
      if (e.t === "C") {
        const i = m === "trap" ? 2 * e.C / dt * (v - h.v) - h.i : m === "bdf2" ? e.C * (3 * v - 4 * h.v + h.v1) / (2 * dt) : e.C * (v - h.v) / dt;
        h.v1 = h.v; h.v = v; h.i = i;
      } else { h.i1 = h.i; h.i = x[e.br]; h.v = v; }
    }
  };

  /* Transient. opt: { tstop, dt, method: "trap" | "bdf2" | "be", record: [node names], ic: "op" | "zero",
     noise: { seed } adds white samples of every noise source (variance S / (2 dt), one-sided PSD S up to 1/(2 dt)) }.
     A linear, time-invariant circuit factors its matrix once per method and reuses it every step. */
  S.tran = (ck, opt) => {
    const dt = opt.dt, n = Math.round(opt.tstop / dt), m = opt.method || "trap", rec = (opt.record || []).map((nm) => S.nodeIndex(ck, nm));
    const H = new Map();
    let x = opt.ic === "zero" ? new Float64Array(ck.size) : S.dc(ck, { t: 0 }).x;
    for (const e of ck.elements) if (e.t === "C" || e.t === "L") { const v = vAt(x, e.i[0]) - vAt(x, e.i[1]); H.set(e, { v, v1: v, i: e.t === "L" ? x[e.br] : 0, i1: e.t === "L" ? x[e.br] : 0 }); }
    const out = rec.map(() => new Float64Array(n + 1)), ts = new Float64Array(n + 1);
    rec.forEach((r, k) => (out[k][0] = vAt(x, r)));
    const rng = opt.noise ? D.rng(opt.noise.seed || 1) : null, cache = new Map();
    const linear = !ck.nonlinear && !ck.timeVarying;
    for (let s = 1; s <= n; s++) {
      const t = s * dt, meth = s === 1 ? "be" : m;
      let noise = null;
      if (rng) { noise = new Map(); for (const q of ck.noise) noise.set(q.el, gauss(rng) * Math.sqrt(q.S({ x, t }) / (2 * dt))); }
      const ctx = { t, dt, method: meth, h: H, noise, x };
      if (linear) {
        if (!cache.has(meth)) { const M0 = S.assembleReal(ck, ctx); cache.set(meth, S.luFactor(M0.A, M0.n)); }
        x = S.luSolve(cache.get(meth), S.assembleReal(ck, Object.assign(ctx, { bOnly: true })).b);
      } else x = newton(ck, ctx, x);
      updateHist(ck, H, x, dt, meth);
      ts[s] = t;
      rec.forEach((r, k) => (out[k][s] = vAt(x, r)));
    }
    return { t: ts, v: Object.fromEntries((opt.record || []).map((nm, k) => [nm, out[k]])) };
  };

  /* Noise: every source's transfer to the output(s) at each frequency, one factor per frequency.
     Returns the output PSD (V^2/Hz), the cross-spectrum of two outputs when outB is given, and the PSD split by
     element group so a budget can name each term. */
  S.noise = (ck, freqs, outA, outB, opt = {}) => {
    const op = opt.op || S.dc(ck), ia = S.nodeIndex(ck, outA), ib = outB ? S.nodeIndex(ck, outB) : -1;
    const rows = [];
    for (const f of freqs) {
      const M = S.assembleC(ck, 2 * Math.PI * f, op), F = S.luFactorC(M.Ar, M.Ai, M.n), z = new Float64Array(M.n);
      let SA = 0, SB = 0, Xr = 0, Xi = 0;
      const by = {}, byX = {};
      for (const q of ck.noise) {
        const br = new Float64Array(M.n), e = q.el;
        if (q.kind === "i") { if (e.i[0] >= 0) br[e.i[0]] -= 1; if (e.i[1] >= 0) br[e.i[1]] += 1; } else br[e.br] = 1;
        const x = S.luSolveC(F, br, z), Sk = q.S(op);
        const ar = ia < 0 ? 0 : x.re[ia], ai = ia < 0 ? 0 : x.im[ia], pa = Sk * (ar * ar + ai * ai);
        SA += pa; by[e.group] = (by[e.group] || 0) + pa;
        if (ib >= 0) { const br2 = x.re[ib], bi2 = x.im[ib]; SB += Sk * (br2 * br2 + bi2 * bi2); const xr = Sk * (ar * br2 + ai * bi2); Xr += xr; Xi += Sk * (ai * br2 - ar * bi2); byX[e.group] = (byX[e.group] || 0) + xr; }
      }
      rows.push({ f, SA, SB, Xr, Xi, by, byX });
    }
    return { op, rows };
  };

  /* integral of y over x by the trapezoid rule */
  S.trapz = (xs, ys) => { let s = 0; for (let i = 1; i < xs.length; i++) s += 0.5 * (ys[i] + ys[i - 1]) * (xs[i] - xs[i - 1]); return s; };
  S.logspace = (a, b, n) => Array.from({ length: n }, (_, i) => a * Math.pow(b / a, i / (n - 1)));
  S.linspace = (a, b, n) => Array.from({ length: n }, (_, i) => a + (b - a) * i / (n - 1));

  if (typeof module !== "undefined" && module.exports) module.exports = S;
})(typeof globalThis !== "undefined" ? globalThis : this);
