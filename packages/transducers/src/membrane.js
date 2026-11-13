/* transducers/membrane: the membrane cable and the Hodgkin-Huxley neuron. The Hodgkin-Huxley constants are the
   1952 squid values as written in textbooks (shifted so rest is near -65 mV), from memory, so anything through this
   kernel is marked from_memory. */
(function (g) {
  "use strict";
  const T = (g.Transducers = g.Transducers || {});
  const HH_PROV = { status: "from_memory", source: "Hodgkin and Huxley 1952 constants, textbook form, not read" };

  /* Thomas algorithm. a, b, c: sub, main, super; d: right side. */
  T.tridiag = (a, b, c, d) => {
    const n = b.length, cp = new Float64Array(n), dp = new Float64Array(n), x = new Float64Array(n);
    cp[0] = c[0] / b[0]; dp[0] = d[0] / b[0];
    for (let i = 1; i < n; i++) { const m = b[i] - a[i] * cp[i - 1]; cp[i] = c[i] / m; dp[i] = (d[i] - a[i] * dp[i - 1]) / m; }
    x[n - 1] = dp[n - 1];
    for (let i = n - 2; i >= 0; i--) x[i] = dp[i] - cp[i] * x[i + 1];
    return x;
  };
  /* Steady cable: lambda^2 V'' - V = -r I. Discretised with sealed ends. Dense enough, the point source decays as
     exp(-x / lambda) with lambda = sqrt(r_m / r_a), the textbook answer. Invertible, so the round trip is exact. */
  T.cable = (lambdaM, dxM, rm, o = {}) => {
    const k = (lambdaM / dxM) ** 2;
    return T.kernel({
      id: `cable lambda=${lambdaM}m`, group: "biologic", axes: ["space"], claims: "embedding", tol: o.tol || 1e-6, from: { domain: "sequence", unit: "A" }, to: { domain: "sequence", unit: "V" },
      forward: (f) => {
        const n = f.values.length, a = new Float64Array(n).fill(-k), c = new Float64Array(n).fill(-k), b = new Float64Array(n).fill(1 + 2 * k);
        b[0] = b[n - 1] = 1 + k;
        return { values: T.tridiag(a, b, c, Float64Array.from(f.values, (x) => x * rm)), unit: "V", rep: T.ANALOG };
      },
      inverse: (y) => {
        const n = y.values.length, v = y.values, o2 = new Float64Array(n);
        for (let i = 0; i < n; i++) { const l = i ? v[i - 1] : v[i], r = i < n - 1 ? v[i + 1] : v[i]; o2[i] = ((1 + 2 * k) * v[i] - k * (l + r)) / rm; }
        return o2;
      },
      loss: o.noise ? (s, y) => T.capacityLoss(s, y, o.noise) : undefined,
    });
  };

  const rates = (V) => {
    const x = V + 65;
    const am = Math.abs(25 - x) < 1e-7 ? 1 : (0.1 * (25 - x)) / (Math.exp((25 - x) / 10) - 1);
    const bm = 4 * Math.exp(-x / 18);
    const ah = 0.07 * Math.exp(-x / 20), bh = 1 / (Math.exp((30 - x) / 10) + 1);
    const an = Math.abs(10 - x) < 1e-7 ? 0.1 : (0.01 * (10 - x)) / (Math.exp((10 - x) / 10) - 1);
    const bn = 0.125 * Math.exp(-x / 80);
    return { am, bm, ah, bh, an, bn };
  };
  T.hhRest = (V = -65) => { const r = rates(V); return { V, m: r.am / (r.am + r.bm), h: r.ah / (r.ah + r.bh), n: r.an / (r.an + r.bn) }; };
  const deriv = (s, I) => {
    const r = rates(s.V), gNa = 120 * s.m ** 3 * s.h, gK = 36 * s.n ** 4, gL = 0.3;
    return { V: I - gNa * (s.V - 50) - gK * (s.V + 77) - gL * (s.V + 54.387), m: r.am * (1 - s.m) - r.bm * s.m, h: r.ah * (1 - s.h) - r.bh * s.h, n: r.an * (1 - s.n) - r.bn * s.n };
  };
  const step = (s, I, dt) => {
    const add = (a, d, k) => ({ V: a.V + k * d.V, m: a.m + k * d.m, h: a.h + k * d.h, n: a.n + k * d.n });
    const k1 = deriv(s, I), k2 = deriv(add(s, k1, dt / 2), I), k3 = deriv(add(s, k2, dt / 2), I), k4 = deriv(add(s, k3, dt), I);
    return { V: s.V + (dt / 6) * (k1.V + 2 * k2.V + 2 * k3.V + k4.V), m: s.m + (dt / 6) * (k1.m + 2 * k2.m + 2 * k3.m + k4.m), h: s.h + (dt / 6) * (k1.h + 2 * k2.h + 2 * k3.h + k4.h), n: s.n + (dt / 6) * (k1.n + 2 * k2.n + 2 * k3.n + k4.n) };
  };
  /* I in uA/cm^2 per sample, dtMs in ms. Returns membrane potential in mV. */
  T.hhTrace = (I, dtMs) => {
    let s = T.hhRest(); const v = new Float64Array(I.length);
    for (let i = 0; i < I.length; i++) { s = step(s, I[i], dtMs); v[i] = s.V; }
    return v;
  };
  T.spikesOf = (v, th = 0) => { const o = new Float64Array(v.length); for (let i = 1; i < v.length; i++) if (v[i - 1] < th && v[i] >= th) o[i] = 1; return o; };
  T.hh = (dtMs = 0.01, o = {}) => T.kernel({
    id: "hh", group: "biologic", axes: ["time", "noise"], claims: "homomorphism", physics: [HH_PROV], from: { domain: "sequence" }, to: { domain: "sequence", unit: "V" },
    forward: (f) => ({ values: T.hhTrace(f.values, dtMs).map((x) => x * 1e-3), unit: "V", rep: T.ANALOG, sigma: null }),
    keeps: { name: "no drive, no spikes; strong drive, spikes", check: () => {
      const n = Math.round(100 / dtMs), a = T.spikesOf(T.hhTrace(new Float64Array(n), dtMs)).reduce((p, x) => p + x, 0), b = T.spikesOf(T.hhTrace(new Float64Array(n).fill(20), dtMs)).reduce((p, x) => p + x, 0);
      return { ok: a === 0 && b > 0, detail: `${a} spikes at rest, ${b} at 20 uA/cm2` };
    } },
    loss: (s, y) => T.windowLoss(s, T.spikesOf(y.values.map((x) => x * 1e3)), o.win || Math.round(25 / dtMs), o.grain || 1),
  });
  if (typeof module !== "undefined" && module.exports) module.exports = T;
})(globalThis);
