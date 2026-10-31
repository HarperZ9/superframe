/* transducers/time: the time axis. A shutter is a box filter, a phosphor is a causal decay, film is a running sum,
   a delay must be causal, and no window beats the Gabor limit. */
(function (g) {
  "use strict";
  const T = (g.Transducers = g.Transducers || {});
  const F = () => T.Field();
  T.GABOR = 1 / (4 * Math.PI);

  /* Shutter: a moving average over M samples, circular. Its transfer is the Dirichlet kernel, sinc in the limit. */
  T.shutterGain = (fCyclesPerSample, M) => (fCyclesPerSample === 0 ? 1 : Math.abs(Math.sin(Math.PI * fCyclesPerSample * M) / (M * Math.sin(Math.PI * fCyclesPerSample))));
  T.shutter = (M, o = {}) => T.kernel({
    id: `shutter ${M}`, group: "time", axes: ["time", "light"], claims: "homomorphism", from: { domain: "sequence" }, to: { domain: "sequence" },
    forward: (f) => {
      const n = f.values.length, v = new Float64Array(n); let s = 0;
      for (let i = 0; i < M; i++) s += f.values[(n - i) % n];
      for (let i = 0; i < n; i++) { v[i] = s / M; s += f.values[(i + 1) % n] - f.values[(n + i + 1 - M) % n]; }
      return { values: v, sigma: typeof f.sigma === "number" ? f.sigma / Math.sqrt(M) : f.sigma };
    },
    keeps: { name: "total exposure", check: (s, y) => {
      const a = s.values.reduce((p, x) => p + x, 0), b = y.values.reduce((p, x) => p + x, 0), e = Math.abs(a - b) / (s.values.reduce((p, x) => p + Math.abs(x), 0) + 1e-300);
      return { ok: e < 1e-9, detail: `relative change ${e.toExponential(2)}` };
    } },
    loss: (s, y) => T.capacityLoss(s, y, o.noise || 1e-6),
    budgetMap: (b) => Object.assign({}, b, { dt: b.dt * M, nt: b.nt / M }),
  });

  /* Persistence: a causal decay h(tau) sampled every dt, convolved on the input. The kernel takes any h; the phosphor
     below takes its law from the measured P22 fit. */
  T.decayConvolve = (h, id, o = {}) => T.kernel({
    id, group: "time", axes: ["time", "light"], claims: "homomorphism", physics: o.physics || [], from: { domain: "sequence" }, to: { domain: "sequence" },
    forward: (f) => {
      const n = f.values.length, v = new Float64Array(n);
      for (let i = 0; i < n; i++) if (f.values[i]) for (let k = 0; k < h.length && i + k < n; k++) v[i + k] += f.values[i] * h[k];
      const g2 = Math.sqrt(h.reduce((a, x) => a + x * x, 0));
      return { values: v, sigma: typeof f.sigma === "number" ? f.sigma * g2 : f.sigma };
    },
    keeps: { name: "causal: nothing before the first input", check: (s, y) => {
      const a = s.values.findIndex((x) => x !== 0), b = y.values.findIndex((x) => x !== 0);
      return { ok: b === -1 || b >= a, detail: `first input ${a}, first output ${b}` };
    } },
    loss: (s, y) => T.capacityLoss(s, y, o.noiseOf ? o.noiseOf(s) : o.noise || 1e-6),
  });
  /* The P22 law: Kuhn 2002, sum a_i exp(-2 pi f_i tau) + A (tau + t0)^-n, normalised to its value at 0. */
  T.p22Decay = (channel, tau) => {
    const m = T.p22().model[channel]; let s = 0, s0 = 0;
    for (const e of m.exp) { s += e.a * Math.exp(-2 * Math.PI * e.f_hz * tau); s0 += e.a; }
    if (m.power) { s += m.power.A * (tau + m.power.t0_s) ** -m.power.n; s0 += m.power.A * m.power.t0_s ** -m.power.n; }
    return s / s0;
  };
  T.phosphor = (channel, dt, n, o = {}) => T.decayConvolve(Float64Array.from({ length: n }, (_, k) => T.p22Decay(channel, k * dt)), `persist.p22-${channel}`, Object.assign({ physics: [T.p22().prov] }, o));
  /* Film keeps the running sum of exposure, and a difference gets each frame back. */
  T.filmIntegrate = () => T.kernel({
    id: "persist.film", group: "time", axes: ["time", "light"], claims: "isomorphism", tol: 1e-9, from: { domain: "sequence" }, to: { domain: "sequence" },
    forward: (f) => { const v = new Float64Array(f.values.length); let s = 0; for (let i = 0; i < v.length; i++) { s += f.values[i]; v[i] = s; } return { values: v }; },
    inverse: (y) => { const v = new Float64Array(y.values.length); let p = 0; for (let i = 0; i < v.length; i++) { v[i] = y.values[i] - p; p = y.values[i]; } return v; },
    targets: (s, y) => F().derive(y, { values: y.values.map((x, i) => x + Math.sin(i)), method: "target" }),
  });

  /* Delay. The tail falls off the end, which the round trip prices. A negative delay reads the future; the causality
     check drives an impulse through it and refuses. */
  T.delayValues = (x, d) => { const n = x.length, v = new Float64Array(n); for (let i = 0; i < n; i++) { const j = i - d; if (j >= 0 && j < n) v[i] = x[j]; } return v; };
  T.delay = (d, o = {}) => T.kernel({
    id: `delay ${d}`, group: "time", axes: ["time"], claims: "homomorphism", tol: o.tol || 1e-9, from: { domain: "sequence" }, to: { domain: "sequence" },
    forward: (f) => ({ values: T.delayValues(f.values, d) }),
    inverse: (y) => T.delayValues(y.values, -d),
    keeps: { name: "causal impulse response", check: () => {
      const c = Math.abs(d) + 1, imp = new Float64Array(2 * c + 1); imp[c] = 1;
      const at = T.delayValues(imp, d).indexOf(1);
      return { ok: at >= c, detail: `impulse at ${c} comes out at ${at}` };
    } },
  });

  /* The time-frequency limit. A spectrogram with a window declares its cell dt x df. The measured spreads of the
     window and of its spectrum are checked against the declaration, and the product against 1 / 4 pi. */
  const spread = (w, step, centred) => {
    let s = 0, m = 0, v = 0;
    for (let i = 0; i < w.length; i++) s += w[i] * w[i];
    for (let i = 0; i < w.length; i++) m += (centred(i) * w[i] * w[i]) / s;
    for (let i = 0; i < w.length; i++) v += ((centred(i) - m) ** 2 * w[i] * w[i]) / s;
    return Math.sqrt(v) * step;
  };
  T.windowSpreads = (w, dtS) => {
    const n = 8 * T.pad2(w.length), re = new Float64Array(n), im = new Float64Array(n);
    re.set(w); T.Perceive().fft(re, im);
    const mag = Float64Array.from(re, (x, i) => Math.hypot(x, im[i]));
    const st = spread(w, dtS, (i) => i), sf = spread(mag, 1 / (n * dtS), (i) => (i < n / 2 ? i : i - n));
    return { st, sf, product: st * sf };
  };
  T.gaussWindow = (M, s) => Float64Array.from({ length: M }, (_, i) => Math.exp(-((i - (M - 1) / 2) ** 2) / (2 * s * s)));
  T.boxWindow = (M) => new Float64Array(M).fill(1);
  const stft = (x, win, hop) => {
    const M = win.length, frames = Math.floor((x.length - M) / hop) + 1, o = new Float64Array(frames * (M / 2));
    for (let t = 0; t < frames; t++) {
      const re = new Float64Array(M), im = new Float64Array(M);
      for (let i = 0; i < M; i++) re[i] = x[t * hop + i] * win[i];
      T.Perceive().fft(re, im);
      for (let k = 0; k < M / 2; k++) o[t * (M / 2) + k] = Math.hypot(re[k], im[k]);
    }
    return { values: o, frames, bins: M / 2 };
  };
  T.spectrogram = (win, hop, dtS, o = {}) => {
    const sp = T.windowSpreads(win, dtS), claim = o.claimCell || { dt: sp.st, df: sp.sf };
    return T.kernel({
      id: o.id || `stft M=${win.length}`, group: "time", axes: ["time", "space"], claims: "homomorphism", from: { domain: "sequence" }, to: { domain: "grid" },
      forward: (f) => { const s = stft(f.values, win, hop); return { values: s.values, domain: { kind: "grid", shape: [s.frames, s.bins] } }; },
      keeps: { name: "declared cell obeys dt df >= 1 / 4 pi and matches the window", check: () => {
        const p = claim.dt * claim.df, ok = p >= T.GABOR * (1 - 1e-3) && claim.dt >= sp.st * (1 - 1e-6) && claim.df >= sp.sf * (1 - 1e-6);
        return { ok, detail: `claimed product ${p.toExponential(3)}, limit ${T.GABOR.toExponential(3)}, measured ${sp.product.toExponential(3)}` };
      } },
      loss: (s, y) => T.budgetLoss(s, y, o.grain || 1 / 256, o.grain || 1 / 256),
    });
  };
  if (typeof module !== "undefined" && module.exports) module.exports = T;
})(globalThis);
