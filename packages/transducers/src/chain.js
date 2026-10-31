/* transducers/chain: compose any kernels, and report at each crossing the bytes, the time, the bits kept and the shared
   budget on four axes: signal, noise floor, time resolution, space resolution. The budget is
      I = (space-bandwidth) x (time-bandwidth) x log2(1 + SNR)
   and the prediction under test is that it bounds the bits kept at every step. Each real sample is one degree of
   freedom carrying 0.5 log2(1 + SNR), so the half form is also reported, as the tight version of the same bound.
   Bits kept at the source are measured at a grain, so a grain finer than the noise floor counts noise as bits. */
(function (g) {
  "use strict";
  const T = (g.Transducers = g.Transducers || {});
  const F = () => T.Field();
  class BudgetError extends Error { constructor(m, row) { super(m); this.name = "BudgetError"; this.row = row; } }
  T.BudgetError = BudgetError;

  /* One component of a field as a flat array. */
  const channel = (f, k) => { const c = f.components; if (c === 1) return f.values; const n = f.values.length / c, o = new Float64Array(n); for (let i = 0; i < n; i++) o[i] = f.values[i * c + k]; return o; };
  const pow2Shape = (f) => {
    const d = f.domain, n = f.values.length / f.components;
    if (f.symbolic || !["sequence", "grid"].includes(d.kind) || n < 2) return null;
    const h = d.kind === "grid" ? d.shape[0] : 1, w = d.kind === "grid" ? d.shape[1] : n;
    return (h & (h - 1)) === 0 && (w & (w - 1)) === 0 ? { h, w } : null;
  };
  /* How many modes of a field stand above its noise floor: the space-bandwidth or time-bandwidth on the data. */
  T.effectiveModes = (f, noise) => {
    const sh = pow2Shape(f);
    if (!sh) return f.values.length;
    let e = 0;
    for (let k = 0; k < f.components; k++) {
      const x = channel(f, k); let m = 0;
      for (const v of x) m += v;
      m /= x.length;
      const P = T.powerSpectrum(Float64Array.from(x, (v) => v - m), sh.h, sh.w);
      for (let i = 0; i < x.length; i++) if (P[i] / x.length > noise) e++;
    }
    return Math.max(1, e + 1);
  };
  const rmsSigma = (f) => (f.sigma === null ? null : typeof f.sigma === "number" ? f.sigma : Math.sqrt(f.sigma.reduce((a, s) => a + s * s, 0) / f.sigma.length));
  const grainVar = (f) => (f.rep.grain ? f.rep.grain ** 2 / 12 : 0);
  /* One step of the budget. axis names which bandwidth a field's samples belong to: "space" or "time". */
  T.budgetOf = (f, prev, axis, base) => {
    if (f.symbolic) {
      const A = new Set(Array.from(f.values)).size, n = f.values.length;
      return { signal: Math.max(A, 1), symbolic: true, noise: 0, total: 0, tight: null, snr: Math.max(A - 1, 0), sbw: axis === "time" ? 1 : n, tbw: axis === "time" ? n : 1, dx: base.dx, dt: base.dt, I: n * Math.log2(Math.max(A, 1)), half: 0.5 * n * Math.log2(Math.max(A, 1)) };
    }
    const v = T.varOf(f.values), carried = prev && !prev.symbolic ? (prev.noise * v) / Math.max(prev.total, 1e-300) : 0, s = rmsSigma(f);
    const N = Math.max(s === null ? carried : s * s, grainVar(f), v * 1e-30, 1e-300), snr = Math.max(v - N, 0) / N;
    const modes = T.effectiveModes(f, N), full = f.values.length;
    const sbw = axis === "time" ? 1 : modes, tbw = axis === "time" ? modes : 1, scale = Math.sqrt(full / modes);
    const tight = T.modeBudget(f, N);
    return { signal: v, noise: N, total: v, snr, tight, sbw, tbw, dx: base.dx * (axis === "time" ? 1 : scale), dt: base.dt * (axis === "time" ? scale ** 2 : 1), I: sbw * tbw * Math.log2(1 + snr), half: 0.5 * sbw * tbw * Math.log2(1 + snr) };
  };
  const headEntropy = (f, grain) => (f.symbolic ? f.values.length * T.entropy(Array.from(f.values)) : f.values.length * T.entropy(f.values, grain));

  /* Bits the output holds about the source, measured from their cross spectrum and independent of the budget: each mode
     carries -0.5 log2(1 - gamma^2). Coherence is averaged in bands (rings on a grid, blocks in a sequence), with its
     small-sample bias removed; conjugate pairs mean a band of m bins holds m / 2 independent complex values. Fields of
     unlike components compare as luma, so a Bayer mosaic reads against the scene's mean channel. */
  const luma = (f) => { const c = f.components, n = f.values.length / c, o = new Float64Array(n); for (let i = 0; i < n; i++) { let s = 0; for (let k = 0; k < c; k++) s += f.values[i * c + k]; o[i] = s / c; } return o; };
  const bandsOf = (h, w) => {
    const n = h * w, b = new Int32Array(n), K = 24;
    for (let i = 0; i < n; i++) { const y = Math.floor(i / w), x = i % w, a = (x < w / 2 ? x : x - w) / (w / 2), c = h > 1 ? (y < h / 2 ? y : y - h) / (h / 2) : 0; b[i] = Math.min(K - 1, Math.floor((Math.hypot(a, c) / (h > 1 ? Math.SQRT2 : 1)) * K)); }
    return { b, K };
  };
  const spec2 = (v, h, w) => {
    const re = Float64Array.from(v), im = new Float64Array(v.length); let m = 0;
    for (const x of re) m += x;
    m /= re.length;
    for (let i = 0; i < re.length; i++) re[i] -= m;
    if (h > 1) T.fft2c(re, im, h, w, false); else T.Perceive().fft(re, im);
    return { re, im };
  };
  const pairBits = (x, y, h, w) => {
    const X = spec2(x, h, w), Y = spec2(y, h, w), { b: band, K } = bandsOf(h, w), xr = new Float64Array(K), xi = new Float64Array(K), xx = new Float64Array(K), yy = new Float64Array(K), cnt = new Float64Array(K);
    for (let i = 0; i < x.length; i++) { const k = band[i]; xr[k] += X.re[i] * Y.re[i] + X.im[i] * Y.im[i]; xi[k] += X.im[i] * Y.re[i] - X.re[i] * Y.im[i]; xx[k] += X.re[i] ** 2 + X.im[i] ** 2; yy[k] += Y.re[i] ** 2 + Y.im[i] ** 2; cnt[k]++; }
    let bits = 0;
    for (let k = 0; k < K; k++) {
      if (!cnt[k] || xx[k] <= 0 || yy[k] <= 0) continue;
      const m = cnt[k] / 2, g0 = (xr[k] ** 2 + xi[k] ** 2) / (xx[k] * yy[k]), g2 = m > 1 ? Math.max(0, (m * g0 - 1) / (m - 1)) : 0;
      bits += cnt[k] * -0.5 * Math.log2(Math.max(1 - g2, 1e-15));
    }
    return bits;
  };
  T.coherenceBits = (x0, y0) => {
    const sa = pow2Shape(x0), sb = pow2Shape(y0);
    if (!sa || !sb || sa.h !== sb.h || sa.w !== sb.w) return null;
    if (x0.components !== y0.components) return pairBits(luma(x0), luma(y0), sa.h, sa.w);
    let t = 0;
    for (let k = 0; k < x0.components; k++) t += pairBits(channel(x0, k), channel(y0, k), sa.h, sa.w);
    return t;
  };
  /* The tight form of the budget: every mode against the floor, with no averaging of SNR across modes. */
  T.modeBudget = (f, noise) => {
    const sh = pow2Shape(f);
    if (!sh) return null;
    let t = 0;
    for (let k = 0; k < f.components; k++) {
      const x = channel(f, k); let m = 0;
      for (const v of x) m += v;
      m /= x.length;
      t += T.modeBits(Float64Array.from(x, (v) => v - m), sh.h, sh.w, noise).total;
    }
    return t;
  };

  /* Run a pipeline. opt: { grain, axis, dx, dt, strict, truth }. Each row holds three kept numbers: the ledger's
     (source entropy minus losses), that capped by the output's entropy, and the coherence measured against the truth.
     strict refuses a step whose measured or claimed kept bits exceed the budget. */
  const keptRow = (r, kept, cap, measured, budget, claimed, running) => {
    const best = claimed === null ? measured : claimed;
    return Object.assign({}, r, { bitsKept: kept, keptCapped: cap, keptMeasured: measured, claimed, grade: r.measured, budget, running, overLedger: kept > budget.I + 1e-6,
      overBudget: best !== null && best > budget.I + 1e-6, overRunning: best !== null && best > running + 1e-6, overTight: budget.tight !== null && measured !== null && measured > budget.tight + 1e-6 });
  };
  /* The step whose output holds the fewest bits about the source, compared with the step before it. */
  const worstDrop = (rows, head) => {
    let prev = head, id = null, big = -1;
    for (const r of rows.slice(1)) { if (r.keptMeasured === null) continue; const d = prev - r.keptMeasured; if (d > big) { big = d; id = r.id; } prev = r.keptMeasured; }
    return id;
  };
  T.chain = (src, kernels, opt = {}) => {
    const axis = opt.axis || (src.domain.kind === "grid" ? "space" : "time"), base = { dx: opt.dx || 1, dt: opt.dt || 1 };
    const grain = opt.grain || 1 / 256, head = headEntropy(src, grain), truth = opt.truth || src, b0 = T.budgetOf(src, null, axis, base);
    const rows = [{ id: "source", bitsLost: 0, bitsKept: head, keptCapped: head, keptMeasured: null, bytes: T.bytesOf(src), ms: 0, grade: null, budget: b0, n: src.values.length, unit: src.unit.name, status: src.prov.status, overBudget: false, overTight: false, overLedger: head > b0.I }];
    let f = src, kept = head, lastMeasured = null, running = b0.I;
    rows[0].running = running;
    for (const k of kernels) {
      const out = T.run(k, f), budget = T.budgetOf(out, rows[rows.length - 1].budget, axis, base), r = out.row;
      kept = Math.max(0, kept - r.bitsLost);
      const cap = Math.min(kept, out.symbolic ? Infinity : out.values.length * T.entropy(out.values, out.rep.grain || grain));
      const c = out.symbolic || f.symbolic ? null : T.coherenceBits(truth, out), measured = c === null ? lastMeasured : c;
      lastMeasured = measured;
      running = Math.min(running, budget.I);
      const row = keptRow(r, kept, cap, measured, budget, k.claimKept ? k.claimKept(rows, out) : null, running);
      rows.push(row);
      if (opt.strict && row.overBudget) throw new BudgetError(`${k.id}: ${(row.claimed === null ? measured : row.claimed).toFixed(0)} bits kept against a budget of ${budget.I.toFixed(0)}`, row);
      f = out;
    }
    const worst = rows.slice(1).reduce((b, r) => (r.bitsLost > b.bitsLost ? r : b), { bitsLost: -1, id: null });
    return { rows, out: f, worst: worst.id, worstMeasured: worstDrop(rows, head), head, grain, axis, ledgerOk: F().verifyLedger(f.ledger).ok };
  };

  /* The four axes as one closed form, so they can trade live. Area A, duration D, photon rate L per unit area and time,
     pixel side p, shutter t, read noise r. S = L t p^2; SNR = S^2 / (S + r^2) (scene contrast one); budget as above. */
  T.fourAxes = (o) => {
    const S = o.L * o.t * o.p * o.p, snr = (S * S) / (S + o.r * o.r), sbw = o.A / (o.p * o.p), tbw = o.D / o.t;
    return { photons: S, noise: Math.sqrt(S + o.r * o.r), snr, sbw, tbw, dx: o.p, dt: o.t, I: sbw * tbw * Math.log2(1 + snr), half: 0.5 * sbw * tbw * Math.log2(1 + snr), bitsPerPhoton: (sbw * tbw * Math.log2(1 + snr)) / (o.A * o.D * o.L) };
  };
  if (typeof module !== "undefined" && module.exports) module.exports = T;
})(globalThis);
