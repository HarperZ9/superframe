/* transducers/machine: a tiny network trained here on the CPU, and a linear probe on its hidden layer, priced the same
   way as a lens. The task is XOR of two input bits among noise bits, which no linear readout of the raw input can do. */
(function (g) {
  "use strict";
  const T = (g.Transducers = g.Transducers || {});
  const F = () => T.Field();

  T.xorData = (n, d, seed, tag = "data") => {
    const r = T.rng(seed, tag), X = new Float64Array(n * d), y = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < d; j++) X[i * d + j] = r() < 0.5 ? 0 : 1;
      y[i] = X[i * d] !== X[i * d + 1] ? 1 : 0;
    }
    return { X, y, n, d };
  };
  const sig = (z) => 1 / (1 + Math.exp(-z));
  const hiddenOf = (m, x, off, out, oo) => {
    for (let k = 0; k < m.H; k++) { let a = m.b[k]; for (let j = 0; j < m.d; j++) a += m.W[k * m.d + j] * x[off + j]; out[oo + k] = Math.tanh(a); }
  };
  /* Full-batch gradient descent on cross entropy. Same seed, same weights, in one engine. */
  const trainStep = (m, D, lr, hid) => {
    const gW = new Float64Array(m.W.length), gb = new Float64Array(m.H), gv = new Float64Array(m.H); let gc = 0;
    for (let i = 0; i < D.n; i++) {
      hiddenOf(m, D.X, i * m.d, hid, 0);
      let z = m.c; for (let k = 0; k < m.H; k++) z += m.v[k] * hid[k];
      const e = sig(z) - D.y[i]; gc += e;
      for (let k = 0; k < m.H; k++) {
        gv[k] += e * hid[k];
        const dk = e * m.v[k] * (1 - hid[k] * hid[k]); gb[k] += dk;
        for (let j = 0; j < m.d; j++) gW[k * m.d + j] += dk * D.X[i * m.d + j];
      }
    }
    const s = lr / D.n;
    for (let i = 0; i < m.W.length; i++) m.W[i] -= s * gW[i];
    for (let k = 0; k < m.H; k++) { m.b[k] -= s * gb[k]; m.v[k] -= s * gv[k]; }
    m.c -= s * gc;
  };
  T.trainTiny = (o = {}) => {
    const d = o.d || 8, H = o.H || 8, seed = o.seed || 1, D = T.xorData(o.n || 400, d, seed), r = T.rng(seed, "init");
    const m = { d, H, W: Float64Array.from({ length: H * d }, () => T.gauss(r) * 0.5), b: Float64Array.from({ length: H }, () => T.gauss(r) * 0.5), v: Float64Array.from({ length: H }, () => T.gauss(r) * 0.5), c: 0 };
    const hid = new Float64Array(H);
    for (let it = 0; it < (o.iters || 1500); it++) trainStep(m, D, o.lr || 1, hid);
    return m;
  };
  T.hiddenLayer = (m, X, n) => { const o = new Float64Array(n * m.H); for (let i = 0; i < n; i++) hiddenOf(m, X, i * m.d, o, i * m.H); return o; };
  T.modelAcc = (m, D) => {
    const h = T.hiddenLayer(m, D.X, D.n); let ok = 0;
    for (let i = 0; i < D.n; i++) { let z = m.c; for (let k = 0; k < m.H; k++) z += m.v[k] * h[i * m.H + k]; if ((z > 0 ? 1 : 0) === D.y[i]) ok++; }
    return ok / D.n;
  };
  /* Logistic regression, the probe. */
  T.fitProbe = (X, y, n, d, iters = 800, lr = 0.5) => {
    const w = new Float64Array(d); let b = 0;
    for (let it = 0; it < iters; it++) {
      const g2 = new Float64Array(d); let gb = 0;
      for (let i = 0; i < n; i++) { let z = b; for (let j = 0; j < d; j++) z += w[j] * X[i * d + j]; const e = sig(z) - y[i]; gb += e; for (let j = 0; j < d; j++) g2[j] += e * X[i * d + j]; }
      for (let j = 0; j < d; j++) w[j] -= (lr * g2[j]) / n;
      b -= (lr * gb) / n;
    }
    return { w, b, d };
  };
  T.probePredict = (p, X, n) => { const o = new Float64Array(n); for (let i = 0; i < n; i++) { let z = p.b; for (let j = 0; j < p.d; j++) z += p.w[j] * X[i * p.d + j]; o[i] = z > 0 ? 1 : 0; } return o; };
  T.condBitsPerLabel = (y, yhat) => {
    const Y = Array.from(y), H2 = Array.from(yhat);
    return Math.max(0, T.entropy(Y.map((v, i) => v + "|" + H2[i])) - T.entropy(H2));
  };

  /* A neuron as a kernel: bits in, hidden activations out. */
  T.neuronLayer = (m, grain = 1 / 16) => T.kernel({
    id: `machine.hidden H=${m.H}`, group: "machine", axes: ["noise"], claims: "homomorphism", from: { domain: "grid" }, to: { domain: "grid" },
    forward: (f) => { const n = f.domain.shape[0]; return { values: T.hiddenLayer(m, f.values, n), domain: { kind: "grid", shape: [n, m.H] }, components: 1, sigma: null }; },
    keeps: { name: "activations stay in -1..1", check: (s, y) => ({ ok: y.values.every((v) => Math.abs(v) <= 1), detail: "tanh range" }) },
    loss: (s, y) => T.budgetLoss(s, y, 1, grain),
  });
  /* A probe as a kernel: its output is one bit a row, and the row's bits about the label are recorded beside the
     row's bits about the input, so it reads in the same ledger as a photosite. labels is what it should read. */
  T.probeKernel = (p, labels, o = {}) => T.kernel({
    id: o.id || "machine.probe", group: "machine", axes: ["noise"], claims: "homomorphism", from: { domain: "grid" }, to: { domain: "sequence" },
    forward: (f) => { const n = f.domain.shape[0]; return { values: T.probePredict(p, f.values, n), domain: { kind: "sequence", shape: [n] }, components: 1, rep: { kind: "digital", bits: 1, grain: 1 }, sigma: 0 }; },
    keeps: { name: "beats the shuffled-label control", check: (s, y) => {
      const a = T.condBitsPerLabel(labels, y.values), b = T.condBitsPerLabel(T.shuffle(labels, 3, "probe"), y.values);
      return { ok: a < b - 0.05, detail: `H(label|probe) ${a.toFixed(3)} against shuffled ${b.toFixed(3)} bits` };
    } },
    loss: (s, y) => T.budgetLoss(s, y, o.grain || 1 / 16, 1),
  });
  if (typeof module !== "undefined" && module.exports) module.exports = T;
})(globalThis);
