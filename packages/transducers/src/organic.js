/* transducers/organic: one response form for enzyme, receptor, film and sensor, and the retina as a chain. Hill's
   y = V x^n / (K^n + x^n) is a logistic in log x, so a film's characteristic curve is the same form if it fits.
   fitResponse measures how far that holds against other four-parameter forms. */
(function (g) {
  "use strict";
  const T = (g.Transducers = g.Transducers || {});
  const F = () => T.Field();

  T.hillValue = (x, V, K, n) => (x <= 0 ? 0 : (V * x ** n) / (K ** n + x ** n));
  /* grain: what a receiver can resolve at the output. Near saturation, many inputs share one output code. */
  T.hill = (V, K, n, o = {}) => {
    const grain = o.grain || V / 256;
    return T.kernel({
      id: o.id || `hill K=${K} n=${n}`, group: o.group || "organic", axes: o.axes || ["light", "noise"], claims: "homomorphism", tol: o.tol || K / 64, physics: o.physics || [],
      from: { domain: o.domain }, to: { domain: o.domain, unit: o.unitOut },
      forward: (f) => ({ values: Float64Array.from(f.values, (x) => T.hillValue(x, V, K, n)), unit: o.unitOut, sigma: null }),
      inverse: (y) => Float64Array.from(y.values, (r) => { const q = Math.min(V - grain, Math.round(r / grain) * grain); return q <= 0 ? 0 : K * (q / (V - q)) ** (1 / n); }),
      keeps: { name: "half response at K, and monotone", check: () => {
        const e = Math.abs(T.hillValue(K, V, K, n) - V / 2);
        return { ok: e < 1e-9 * V && T.hillValue(2 * K, V, K, n) > T.hillValue(K, V, K, n), detail: `error at K ${e.toExponential(2)}` };
      } },
    });
  };
  T.michaelisMenten = (Vmax, Km, o = {}) => T.hill(Vmax, Km, 1, Object.assign({ id: `michaelis-menten Km=${Km}` }, o));
  /* Lineweaver-Burk: 1 / v against 1 / s is a line; slope Km / Vmax, intercept 1 / Vmax. */
  T.lineweaverBurk = (s, v) => {
    const X = s.map((x) => 1 / x), Y = v.map((x) => 1 / x), n = s.length, mx = X.reduce((a, b) => a + b) / n, my = Y.reduce((a, b) => a + b) / n;
    let sxx = 0, sxy = 0;
    for (let i = 0; i < n; i++) { sxx += (X[i] - mx) ** 2; sxy += (X[i] - mx) * (Y[i] - my); }
    const m = sxy / sxx, c = my - m * mx;
    return { Vmax: 1 / c, Km: m / c };
  };

  /* Nelder-Mead in a few lines: enough for four parameters and fully deterministic. */
  T.nelderMead = (fn, x0, step, iters = 4000) => {
    const d = x0.length, S = [x0.slice()].concat(x0.map((_, i) => x0.map((v, j) => (i === j ? v + step[i] : v)))).map((x) => ({ x, f: fn(x) }));
    const combo = (c, a, w) => c.map((v, i) => v + w * (a[i] - v));
    for (let it = 0; it < iters; it++) {
      S.sort((a, b) => a.f - b.f);
      const c = new Array(d).fill(0);
      for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) c[j] += S[i].x[j] / d;
      const worst = S[d], r = combo(c, worst.x, -1), fr = fn(r);
      if (fr < S[0].f) { const e = combo(c, worst.x, -2), fe = fn(e); S[d] = fe < fr ? { x: e, f: fe } : { x: r, f: fr }; }
      else if (fr < S[d - 1].f) S[d] = { x: r, f: fr };
      else {
        const k = combo(c, worst.x, 0.5), fk = fn(k);
        if (fk < worst.f) S[d] = { x: k, f: fk };
        else for (let i = 1; i <= d; i++) { S[i].x = combo(S[0].x, S[i].x, 0.5); S[i].f = fn(S[i].x); }
      }
    }
    S.sort((a, b) => a.f - b.f);
    return { x: S[0].x, f: S[0].f };
  };
  const erf = (z) => 2 * T.Phi(z * Math.SQRT2) - 1;
  const FORMS = {
    hill: (lx, p) => p[0] + p[1] / (1 + 10 ** (-p[3] * (lx - p[2]))),
    erf: (lx, p) => p[0] + (p[1] * (1 + erf(p[3] * (lx - p[2])))) / 2,
    cubic: (lx, p) => p[0] + lx * (p[1] + lx * (p[2] + lx * p[3])),
  };
  /* Four-parameter forms against one curve. rows [[log10 x, y]]. Returns rms residual of each. */
  T.fitResponse = (rows) => {
    const ys = rows.map((r) => r[1]), lo = Math.min(...ys), hi = Math.max(...ys), mid = rows.reduce((b, r) => (Math.abs(r[1] - (lo + hi) / 2) < Math.abs(b[1] - (lo + hi) / 2) ? r : b))[0];
    const out = {};
    for (const [name, fn] of Object.entries(FORMS)) {
      const start = name === "cubic" ? [lo, 0.1, 0.01, 0.001] : [lo, hi - lo, mid, 1], step = name === "cubic" ? [0.2, 0.2, 0.05, 0.01] : [0.1, 0.3, 0.3, 0.2];
      const loss = (p) => { let s = 0; for (const r of rows) s += (fn(r[0], p) - r[1]) ** 2; return s / rows.length; };
      const fit = T.nelderMead(loss, start, step);
      out[name] = { rms: Math.sqrt(fit.f), p: fit.x };
    }
    return out;
  };
  /* A curve's response field: exposures in, density out, through the measured table. */
  T.filmCurve = (channel, o = {}) => {
    const C = T.filmCurves();
    return T.kernel({
      id: `film.curve ${channel}`, group: "organic", axes: ["light"], claims: "homomorphism", physics: [C.prov], from: { rep: "digital" }, to: { rep: "digital" },
      forward: (f) => ({ values: Float64Array.from(f.values, (lx) => T.lerpCurve(C.curves[channel], lx)), sigma: null }),
      keeps: { name: "density rises with exposure in the table", check: () => {
        const c = C.curves[channel], ok = c[c.length - 1][1] > c[0][1];
        return { ok, detail: `density ${c[0][1]} to ${c[c.length - 1][1]}` };
      } },
      loss: (s, y) => T.condLoss(s, y, o.gx || 0.01, o.gy || 0.01),
    });
  };
  /* A silicon photosite: linear up to full well, then clipped, the case the shared form must also meet. */
  T.sensorResponse = (x, fullWell) => Math.min(x, fullWell);

  const RETINA_MEMORY = (what) => ({ status: "from_memory", source: what + " (rod values, textbook range, not read)" });
  /* Photon catch: each photon passes with a quantum efficiency, a binomial thinning of the count. */
  const binomial = (r, n, p) => { let c = 0; for (let i = 0; i < n; i++) if (r() < p) c++; return c; };
  T.photonCatch = (qe = 0.25, o = {}) => T.kernel({
    id: `retina.catch qe=${qe}`, group: "organic", axes: ["light", "noise"], claims: "homomorphism", physics: [RETINA_MEMORY("quantum efficiency")], from: { unit: "count" }, to: { unit: "count" },
    forward: (f) => {
      const r = T.rng(o.seed || 1, "catch"), v = Float64Array.from(f.values, (m) => binomial(r, Math.round(Math.max(0, m)), qe)), mean = v.reduce((a, b) => a + b, 0) / v.length;
      return { values: v, sigma: Math.sqrt(Math.max(mean, 1e-12)) };
    },
    keeps: { name: "mean catch is qe times the mean", check: (s, y) => {
      const a = (s.values.reduce((p, x) => p + x, 0) * qe) / s.values.length, b = y.values.reduce((p, x) => p + x, 0) / y.values.length, lim = 6 * Math.sqrt((a + 1e-9) / y.values.length);
      return { ok: Math.abs(a - b) < lim + 1e-12, detail: `want ${a.toFixed(3)}, got ${b.toFixed(3)}` };
    } },
    loss: (s) => T.channelLoss(s, Math.max(s.values.reduce((p, x) => p + x, 0) / s.values.length, 1e-12) * (1 - qe), o.grain || 1),
  });
  /* The transduction cascade: n first-order stages in a row give h(t) = t^(n-1) exp(-t/tau) / (tau^n (n-1)!), peak at
     (n-1) tau, area one. Lamb and Pugh's small-signal rise goes as a power of t. */
  T.gammaIR = (n, tau, dt, len) => {
    let fact = 1; for (let i = 2; i < n; i++) fact *= i;
    return Float64Array.from({ length: len }, (_, k) => { const t = k * dt; return (dt * t ** (n - 1) * Math.exp(-t / tau)) / (tau ** n * fact); });
  };
  T.cascade = (n = 4, tau = 0.05, dt = 0.005, o = {}) => {
    const h = T.gammaIR(n, tau, dt, Math.ceil((tau * 12 * n) / dt / 4) + 1);
    const k = T.decayConvolve(h, `retina.cascade n=${n} tau=${tau}`, Object.assign({ physics: [RETINA_MEMORY("cascade stages and tau")] }, o));
    k.budgetMap = (b) => Object.assign({}, b, { dt: Math.max(b.dt, (n - 1) * tau * 0.5), nt: b.nt * Math.min(1, b.dt / ((n - 1) * tau * 0.5)) });
    k.axes = ["time", "light"];
    return k;
  };
  /* Leaky integrate-and-fire. Rate for constant drive I > 1 is 1 / (tau ln(I / (I - 1))). */
  T.lifRate = (I, tau) => (I <= 1 ? 0 : 1 / (tau * Math.log(I / (I - 1))));
  T.lifSpikes = (x, dt, tau) => {
    const o = new Float64Array(x.length); let v = 0;
    for (let i = 0; i < x.length; i++) { v += (dt * (x[i] - v)) / tau; if (v >= 1) { o[i] = 1; v = 0; } }
    return o;
  };
  /* What a spike train keeps: mean drive per window against spike count per window, H(drive | count). */
  T.windowLoss = (src, spikes, win, gx) => {
    const X = [], Y = [];
    for (let i = 0; i + win <= src.values.length; i += win) { let a = 0, b = 0; for (let k = 0; k < win; k++) { a += src.values[i + k]; b += spikes[i + k]; } X.push(Math.round(a / win / gx)); Y.push(b); }
    const hj = T.entropy(X.map((v, i) => v + "|" + Y[i])), hy = T.entropy(Y);
    return { bits: Math.max(0, hj - hy) * X.length, method: `H(drive | count) in windows of ${win}, grain ${gx}` };
  };
  T.lif = (dt = 0.001, tau = 0.02, o = {}) => T.kernel({
    id: `spike.lif tau=${tau}`, group: "organic", axes: ["time", "noise"], claims: "homomorphism", from: { domain: "sequence" }, to: { domain: "sequence", unit: "count" },
    forward: (f) => ({ values: T.lifSpikes(f.values, dt, tau), unit: "count", rep: { kind: "digital", bits: 1, grain: 1, encoding: "spike" }, sigma: 0 }),
    keeps: { name: "more drive, no fewer spikes", check: (s) => {
      const c = (k) => T.lifSpikes(s.values.map((x) => x * k), dt, tau).reduce((a, b) => a + b, 0), a = c(1), b = c(2);
      return { ok: b >= a, detail: `${a} spikes, ${b} at double drive` };
    } },
    loss: (s, y) => T.windowLoss(s, y.values, o.win || 40, o.grain || 0.05),
    budgetMap: (b) => Object.assign({}, b, { dt: Math.max(b.dt, tau) }),
  });
  if (typeof module !== "undefined" && module.exports) module.exports = T;
})(globalThis);
