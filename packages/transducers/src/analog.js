/* transducers/analog: the crossing between volts and counts, and the filters on the analog side. Filter maths is
   closed form here and cross-checked against the in-house circuit simulator in the tests. */
(function (g) {
  "use strict";
  const T = (g.Transducers = g.Transducers || {});
  const F = () => T.Field();

  T.adc = (bits, vref, o = {}) => {
    const L = 2 ** bits - 1, lsb = vref / L, sigma = o.sigma || 0, seed = o.seed || 1;
    return T.kernel({
      id: `adc ${bits}b`, group: "analog", axes: ["noise", "time"], claims: "homomorphism", from: { unit: "V", rep: "analog" }, to: { unit: "count", rep: "digital" },
      forward: (f) => {
        const r = T.rng(seed, "adc");
        return { values: Float64Array.from(f.values, (v) => Math.max(0, Math.min(L, Math.round((v + (sigma ? sigma * T.gauss(r) : 0)) / lsb)))), unit: "count",
          rep: { kind: "digital", bits, grain: 1, encoding: "uint" }, sigma: Math.sqrt((sigma / lsb) ** 2 + 1 / 12) };
      },
      keeps: { name: "codes track the input", check: (s, y) => {
        let a = 0; for (let i = 0; i < y.values.length; i++) a = Math.max(a, Math.abs(y.values[i] * lsb - Math.max(0, Math.min(vref, s.values[i]))));
        return { ok: a < lsb / 2 + 6 * sigma + 1e-12, detail: `max error ${a.toExponential(2)} V` };
      } },
      loss: (s, y) => T.condLoss(s, y, lsb / 64, 1),
    });
  };
  /* Ideal hold: every code is one voltage. Noise below half an LSB can still be read back exactly. */
  T.dac = (bits, vref, o = {}) => {
    const L = 2 ** bits - 1, lsb = vref / L, sigma = o.sigma || 0, seed = o.seed || 1;
    return T.kernel({
      id: `dac ${bits}b`, group: "analog", axes: ["noise", "time"], claims: "embedding", from: { unit: "count", rep: "digital" }, to: { unit: "V", rep: "analog" },
      forward: (f) => { const r = T.rng(seed, "dac"); return { values: Float64Array.from(f.values, (c) => c * lsb + (sigma ? sigma * T.gauss(r) : 0)), unit: "V", rep: T.ANALOG, sigma: Math.max(sigma, 1e-15) }; },
      inverse: (y) => Float64Array.from(y.values, (v) => Math.round(v / lsb)),
    });
  };
  /* The closed form every ADC is held to: a full-scale sine against quantisation noise alone. */
  T.idealSNRdB = (bits) => 6.0206 * bits + 1.7609;

  /* First-order RC low-pass on a sampled input held between samples: y[n] = a y[n-1] + (1 - a) x[n]. Mathematically
     invertible, so the float round trip keeps everything; at a noise floor the high modes are gone. */
  T.rcFilter = (R, C, dt, o = {}) => {
    const a = Math.exp(-dt / (R * C));
    return T.kernel({
      id: `rc tau=${(R * C).toExponential(2)}s`, group: "analog", axes: ["time", "noise"], claims: "embedding", tol: o.tol || 1e-6, from: { unit: "V", domain: "sequence" }, to: { unit: "V", domain: "sequence" },
      forward: (f) => { const v = new Float64Array(f.values.length); let y = o.y0 || 0; for (let i = 0; i < v.length; i++) { y = a * y + (1 - a) * f.values[i]; v[i] = y; } return { values: v }; },
      inverse: (y) => { const v = new Float64Array(y.values.length); let p = o.y0 || 0; for (let i = 0; i < v.length; i++) { v[i] = (y.values[i] - a * p) / (1 - a); p = y.values[i]; } return v; },
      loss: o.noise ? (s, y) => T.capacityLoss(s, y, o.noise) : undefined,
    });
  };
  /* Fourth-order Butterworth, perceive's biquad pair, passed through the adapter. */
  T.butterworth = (fs, fc, o = {}) => T.kernel({
    id: `butterworth fc=${fc}`, group: "analog", axes: ["time", "noise"], claims: "homomorphism", from: { domain: "sequence" }, to: { domain: "sequence" },
    forward: (f) => ({ values: T.Perceive().lowpass(f.values, fs, fc) }),
    keeps: { name: "DC gain is one", check: () => {
      const y = T.Perceive().lowpass(new Float64Array(4096).fill(1), fs, fc), e = Math.abs(y[4095] - 1);
      return { ok: e < 1e-6, detail: `DC error ${e.toExponential(2)}` };
    } },
    loss: (s, y) => T.capacityLoss(s, y, o.noise || 1e-6),
  });
  if (typeof module !== "undefined" && module.exports) module.exports = T;
})(globalThis);
