/* transducers/pattern: Turing's reaction-diffusion (Brusselator, whose threshold is closed form) and phyllotaxis. */
(function (g) {
  "use strict";
  const T = (g.Transducers = g.Transducers || {});

  /* Turing threshold of the Brusselator: B_c = (1 + A sqrt(Du / Dv))^2, critical wavenumber k^2 = A / sqrt(Du Dv). */
  T.turingThreshold = (A, Du, Dv) => (1 + A * Math.sqrt(Du / Dv)) ** 2;
  T.turingWavelength = (A, Du, Dv) => (2 * Math.PI) / Math.sqrt(A / Math.sqrt(Du * Dv));
  T.brusselatorInit = (N, A, B, seed = 1, amp = 0.01) => {
    const r = T.rng(seed, "turing"), v = new Float64Array(2 * N * N);
    for (let i = 0; i < N * N; i++) { v[2 * i] = A + amp * (r() - 0.5); v[2 * i + 1] = B / A + amp * (r() - 0.5); }
    return v;
  };
  const stepBrusselator = (u, w, nu, nw, N, p) => {
    const { A, B, Du, Dv, dt } = p;
    for (let y = 0; y < N; y++) {
      const ym = ((y + N - 1) % N) * N, yp = ((y + 1) % N) * N, y0 = y * N;
      for (let x = 0; x < N; x++) {
        const xm = (x + N - 1) % N, xp = (x + 1) % N, i = y0 + x, U = u[i], V = w[i];
        const lu = u[ym + x] + u[yp + x] + u[y0 + xm] + u[y0 + xp] - 4 * U, lv = w[ym + x] + w[yp + x] + w[y0 + xm] + w[y0 + xp] - 4 * V, c = U * U * V;
        nu[i] = U + dt * (A - (B + 1) * U + c + Du * lu);
        nw[i] = V + dt * (B * U - c + Dv * lv);
      }
    }
  };
  T.turing = (p) => T.kernel({
    id: `turing A=${p.A} B=${p.B} steps=${p.steps}`, group: "biologic", axes: ["space", "time"], claims: "homomorphism", from: { domain: "grid" }, to: { domain: "grid" },
    forward: (f) => {
      const { h: N } = T.gridOf(f); let u = new Float64Array(N * N), w = new Float64Array(N * N), nu = new Float64Array(N * N), nw = new Float64Array(N * N);
      for (let i = 0; i < N * N; i++) { u[i] = f.values[2 * i]; w[i] = f.values[2 * i + 1]; }
      for (let s = 0; s < p.steps; s++) { stepBrusselator(u, w, nu, nw, N, p); [u, nu] = [nu, u]; [w, nw] = [nw, w]; }
      const o = new Float64Array(2 * N * N);
      for (let i = 0; i < N * N; i++) { o[2 * i] = u[i]; o[2 * i + 1] = w[i]; }
      return { values: o, sigma: null };
    },
    keeps: { name: "stays finite", check: (s, y) => ({ ok: y.values.every(Number.isFinite), detail: "all values finite" }) },
    loss: (s, y) => T.condLoss(s, y, p.grain || 0.002, p.grain || 0.002),
  });
  /* Dominant wavelength in grid cells, from the radial peak of the spectrum, mean removed. */
  T.dominantWavelength = (v, N) => {
    let m = 0; for (const x of v) m += x; m /= v.length;
    const P = T.powerSpectrum(v.map((x) => x - m), N, N), rings = new Float64Array(N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const a = x < N / 2 ? x : x - N, b = y < N / 2 ? y : y - N, r = Math.round(Math.hypot(a, b)); if (r < N) rings[r] += P[y * N + x]; }
    let best = 1; for (let r = 2; r < N / 2; r++) if (rings[r] > rings[best]) best = r;
    return { wavelength: N / best, power: rings[best], amp: Math.sqrt(T.varOf(v)) };
  };

  T.GOLDEN_ANGLE = 180 * (3 - Math.sqrt(5));
  /* Vogel's model: floret n at angle n * angle and radius c sqrt(n). Radius alone inverts it. */
  T.phyllotaxis = (angleDeg = T.GOLDEN_ANGLE, c = 1) => T.kernel({
    id: `phyllotaxis ${angleDeg.toFixed(3)}`, group: "biologic", axes: ["space"], claims: "embedding", tol: 1e-6, from: { domain: "sequence" }, to: { domain: "sequence" },
    forward: (f) => {
      const n = f.values.length, o = new Float64Array(2 * n);
      for (let i = 0; i < n; i++) { const k = f.values[i], r = c * Math.sqrt(k), a = (k * angleDeg * Math.PI) / 180; o[2 * i] = r * Math.cos(a); o[2 * i + 1] = r * Math.sin(a); }
      return { values: o, components: 2, unit: "1" };
    },
    inverse: (y) => { const n = y.values.length / 2, o = new Float64Array(n); for (let i = 0; i < n; i++) o[i] = (y.values[2 * i] ** 2 + y.values[2 * i + 1] ** 2) / (c * c); return o; },
  });
  /* The index differences to each point's nearest neighbours: the parastichy numbers. */
  T.neighbourDiffs = (xy, nn = 2) => {
    const n = xy.length / 2, counts = new Map();
    for (let i = Math.floor(n / 2); i < n; i++) {
      const d = [];
      for (let j = 0; j < n; j++) if (j !== i) d.push([(xy[2 * i] - xy[2 * j]) ** 2 + (xy[2 * i + 1] - xy[2 * j + 1]) ** 2, Math.abs(i - j)]);
      d.sort((a, b) => a[0] - b[0]);
      for (let k = 0; k < nn; k++) counts.set(d[k][1], (counts.get(d[k][1]) || 0) + 1);
    }
    return counts;
  };
  T.fibonacciShare = (counts) => {
    const fib = new Set([1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610]); let a = 0, t = 0;
    for (const [d, c] of counts) { t += c; if (fib.has(d)) a += c; }
    return a / t;
  };
  if (typeof module !== "undefined" && module.exports) module.exports = T;
})(globalThis);
