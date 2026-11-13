/* transducers/noise: the noise axis. Each kernel adds a stated noise and prices it as a Gaussian channel: what
   the source held at its grain, minus what 0.5 log2(1 + S / N) can still carry per value. */
(function (g) {
  "use strict";
  const T = (g.Transducers = g.Transducers || {});
  const F = () => T.Field();
  T.varOf = (v) => { let m = 0, s = 0; for (const x of v) m += x; m /= v.length; for (const x of v) s += (x - m) ** 2; return s / v.length; };
  const meanOf = (v) => { let m = 0; for (const x of v) m += x; return m / v.length; };
  /* Channel loss: never more than the source had. */
  T.channelLoss = (src, noiseVar, grain) => {
    const n = src.values.length, h = T.entropy(src.values, grain), carried = 0.5 * Math.log2(1 + T.varOf(src.values) / Math.max(noiseVar, 1e-300));
    return { bits: n * Math.max(0, h - carried), method: `Gaussian channel, N=${noiseVar.toPrecision(3)}, grain ${grain}` };
  };
  const noisy = (id, axes, physics, addFn, varFn, grain, o = {}) => T.kernel({
    id, group: "noise", axes, claims: "homomorphism", physics, from: o.from || {}, to: o.to || {},
    forward: (f) => { const r = T.rng(o.seed || 1, id), v = addFn(f, r); return { values: v, sigma: Math.sqrt(varFn(f)) }; },
    keeps: o.keeps || { name: "mean within six standard errors", check: (s, y) => {
      const e = Math.abs(meanOf(s.values) - meanOf(y.values)), se = 6 * Math.sqrt(varFn(s) / s.values.length) + 1e-12;
      return { ok: e <= se, detail: `mean shift ${e.toExponential(2)}, limit ${se.toExponential(2)}` };
    } },
    loss: (s) => T.channelLoss(s, varFn(s), grain),
  });

  /* Shot noise: photons arrive as a Poisson process, variance = mean. */
  T.shot = (o = {}) => noisy("noise.shot", ["light", "noise"], [], (f, r) => Float64Array.from(f.values, (m) => T.poisson(r, Math.max(0, m))), (f) => Math.max(meanOf(f.values), 1e-12), 1,
    Object.assign({ from: { unit: "count" }, to: { unit: "count" } }, o));
  /* Johnson noise: one-sided density 4 k T R, Boltzmann's constant read from CODATA. */
  T.johnsonRms = (R, Tk, B) => Math.sqrt(4 * T.codata("Boltzmann constant").value * Tk * R * B);
  T.johnson = (R, Tk, B, o = {}) => {
    const vr = T.johnsonRms(R, Tk, B);
    return noisy(`noise.johnson R=${R} T=${Tk}`, ["noise"], [T.codata("Boltzmann constant")], (f, r) => Float64Array.from(f.values, (v) => v + vr * T.gauss(r)), () => vr * vr, o.grain || vr / 8,
      Object.assign({ from: { unit: "V" }, to: { unit: "V" } }, o));
  };
  /* 1/f noise: white Gaussian shaped by |f|^(-alpha/2) through the field FFT, scaled to a stated rms. */
  T.flickerSeries = (n, alpha, rms, seed = 1) => {
    const r = T.rng(seed, "flicker"), v = new Float64Array(2 * n);
    for (let i = 0; i < n; i++) v[2 * i] = T.gauss(r);
    const Fd = F(), f = Fd.make({ name: "w", domain: { kind: "sequence", shape: [n] }, values: v, components: 2, unit: "1", sigma: null, prov: { status: "defined" }, rep: { kind: "digital", bits: 64 } });
    const s = Fd.fft(f).values;
    for (let k = 0; k < n; k++) { const m = Math.min(k, n - k), w = m ? m ** (-alpha / 2) : 0; s[2 * k] *= w; s[2 * k + 1] *= w; }
    const t = Fd.ifft(Fd.make({ name: "s", domain: { kind: "sequence", shape: [n] }, values: s, components: 2, unit: "1", sigma: null, prov: { status: "defined" }, rep: { kind: "digital", bits: 64 } })).values;
    const o = new Float64Array(n); for (let i = 0; i < n; i++) o[i] = t[2 * i];
    const sc = rms / Math.sqrt(T.varOf(o));
    return o.map((x) => x * sc);
  };
  T.spectralSlope = (v) => {
    const P = T.powerSpectrum(v, 1, v.length), n = v.length; let sx = 0, sy = 0, sxx = 0, sxy = 0, m = 0;
    for (let k = 2; k < n / 4; k++) { const x = Math.log(k), y = Math.log(P[k] + 1e-300); sx += x; sy += y; sxx += x * x; sxy += x * y; m++; }
    return (m * sxy - sx * sy) / (m * sxx - sx * sx);
  };
  T.flicker = (alpha, rms, o = {}) => noisy(`noise.flicker a=${alpha}`, ["noise", "time"], [], (f) => {
    const n = f.values.length, e = T.flickerSeries(n, alpha, rms, o.seed || 1);
    return f.values.map((x, i) => x + e[i]);
  }, () => rms * rms, o.grain || rms / 8, o);

  /* Film grain from the measured granularity: rms density noise at a 48 um aperture as a function of density, per
     layer. Selwyn's law scales it with the aperture: sigma(a) = sigma(48) * 48 / a. */
  const lerpCurve = (c, x) => {
    if (x <= c[0][0]) return c[0][1];
    for (let i = 1; i < c.length; i++) if (c[i][0] >= x) { const u = (x - c[i - 1][0]) / (c[i][0] - c[i - 1][0]); return c[i - 1][1] * (1 - u) + c[i][1] * u; }
    return c[c.length - 1][1];
  };
  T.lerpCurve = lerpCurve;
  T.selwyn = (sigma48, apertureUm, ref = 48) => (sigma48 * ref) / apertureUm;
  T.grainSigma = (channel, logE) => {
    const g2 = T.filmCurves().granularity;
    return lerpCurve(g2.sigmaD[channel], logE);
  };
  T.filmGrain = (channel, pitchUm, o = {}) => {
    const G = T.filmCurves(), ap = G.granularity.aperture_um;
    const sigmaOf = (logE) => T.selwyn(lerpCurve(G.granularity.sigmaD[channel], logE), pitchUm, ap);
    const v = (f) => { let s = 0; for (const x of f.values) s += sigmaOf(x) ** 2; return s / f.values.length; };
    return noisy(`noise.film-grain ${channel}`, ["light", "noise", "space"], [G.prov], (f, r) => Float64Array.from(f.values, (x) => x + sigmaOf(x) * T.gauss(r)), v, 0.01, Object.assign({}, o, { seed: o.seed || 1 }));
  };

  /* Stochastic resonance: a threshold detector and a hidden input. The binary input sits below threshold, so with no
     noise the output never moves and carries zero bits. The closed form is the mutual information of the binary
     channel at each noise level; it rises from zero, peaks and falls. */
  T.Phi = (z) => { /* Abramowitz and Stegun 26.2.17, from memory, tested against known values */
    const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.39894228 * Math.exp((-z * z) / 2);
    const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    return z > 0 ? 1 - p : p;
  };
  const h2 = (p) => (p <= 0 || p >= 1 ? 0 : -p * Math.log2(p) - (1 - p) * Math.log2(1 - p));
  T.resonanceMI = (a, th, sigma) => {
    if (sigma === 0) return (a > th ? 1 : 0);
    const p1 = 1 - T.Phi((th - a) / sigma), p0 = 1 - T.Phi(th / sigma);
    return h2((p0 + p1) / 2) - (h2(p0) + h2(p1)) / 2;
  };
  T.resonance = (a, th, sigma, o = {}) => T.kernel({
    id: `noise.resonance s=${sigma}`, group: "noise", axes: ["noise", "time"], claims: "homomorphism", from: { domain: "sequence" }, to: { domain: "sequence" },
    forward: (f) => { const r = T.rng(o.seed || 1, "sr"); return { values: Float64Array.from(f.values, (x) => (x * a + sigma * T.gauss(r) > th ? 1 : 0)), unit: "1", rep: { kind: "digital", bits: 1, grain: 1 } }; },
    keeps: { name: "output is binary", check: (s, y) => ({ ok: y.values.every((v) => v === 0 || v === 1), detail: "values 0 and 1" }) },
    loss: (s, y) => T.condLoss(s, y, 1, 1),
  });
  if (typeof module !== "undefined" && module.exports) module.exports = T;
})(globalThis);
