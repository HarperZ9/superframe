/* transducers/demos: the four chains, as data the ledger and the page both run. Each returns { name, src, kernels, opt }. */
(function (g) {
  "use strict";
  const T = (g.Transducers = g.Transducers || {});
  const F = () => T.Field();

  /* A test scene with edges and a gradient, in photons per pixel. */
  T.scene = (N, peak = 2000, comps = 1, seed = 1) => {
    const v = new Float64Array(N * N * comps), r = T.rng(seed, "scene");
    const blobs = Array.from({ length: 7 }, () => [r() * N, r() * N, 3 + r() * N * 0.18, 0.3 + r() * 0.7, r(), r(), r()]);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) for (let c = 0; c < comps; c++) {
      let s = 0.1 + (0.2 * x) / N;
      for (const b of blobs) if ((x - b[0]) ** 2 + (y - b[1]) ** 2 < b[2] ** 2) s = Math.max(s, b[3] * (comps > 1 ? 0.35 + 0.65 * b[4 + c] : 1));
      v[(y * N + x) * comps + c] = peak * s;
    }
    return v;
  };
  /* Run a one-channel kernel on each component and join. */
  T.perChannel = (k, comps = 3) => T.kernel({
    id: k.id + " (each channel)", group: k.group, axes: k.axes, claims: k.claims, physics: k.physics, from: { domain: k.from.domain, rep: k.from.rep }, to: { domain: k.to.domain, rep: k.to.rep },
    forward: (f) => {
      const n = f.values.length / comps, o = new Float64Array(f.values.length); let s = f.sigma;
      for (let c = 0; c < comps; c++) {
        const ch = F().derive(f, { values: Float64Array.from({ length: n }, (_, i) => f.values[i * comps + c]), components: 1, sigma: typeof f.sigma === "number" ? f.sigma : null, method: "channel" });
        const y = k.forward(ch); s = y.sigma === undefined ? s : y.sigma;
        for (let i = 0; i < n; i++) o[i * comps + c] = y.values[i];
      }
      return { values: o, components: comps, sigma: s };
    },
    keeps: k.keeps ? { name: k.keeps.name, check: (s) => k.keeps.check(F().derive(s, { values: new Float64Array(s.values.length / comps), components: 1, sigma: null, method: "channel" })) } : undefined,
    loss: (s, y) => {
      let bits = 0, method = "";
      for (let c = 0; c < comps; c++) {
        const pick = (f) => Float64Array.from({ length: f.values.length / comps }, (_, i) => f.values[i * comps + c]), a = T.grid("a", ...s.domain.shape, pick(s)), b = T.grid("b", ...s.domain.shape, pick(y)), L = k.spec_loss(a, b);
        bits += L.bits; method = L.method;
      }
      return { bits, method: method + ", per channel" };
    },
  });
  /* Electrons to volts at a stated conversion gain. A straight line, so it inverts within float tolerance. */
  T.conversionGain = (voltsPerE) => T.kernel({
    id: `sensor.gain ${voltsPerE} V/e`, group: "analog", axes: ["light"], claims: "embedding", tol: 1e-6, from: { unit: "count" }, to: { unit: "V", rep: "analog" },
    forward: (f) => ({ values: Float64Array.from(f.values, (x) => x * voltsPerE), unit: "V", rep: T.ANALOG, sigma: typeof f.sigma === "number" ? f.sigma * voltsPerE : null }),
    inverse: (y) => Float64Array.from(y.values, (v) => v / voltsPerE),
  });

  const meanNoise = (s) => Math.max(s.values.reduce((a, b) => a + b, 0) / s.values.length, 1e-9);
  /* Photon to pixel. A singlet at f/10, a mirror, the Bayer filter, shot noise, read-out and the ADC, then a code. */
  T.demoCamera = (N = 64, o = {}) => {
    const peak = o.peak || 2000, v = T.scene(N, peak, 3), m = v.reduce((a, b) => a + b, 0) / v.length;
    const src = T.grid("photons", N, N, v, "count", { components: 3, sigma: 0, prov: { status: "defined", method: "synthetic scene, expected photons" } });
    const glass = T.hasData("schott") ? T.glass(o.glass || "N-BK7") : null;
    const lensCore = glass ? T.thinLens({ glass, fMm: 50, apertureMm: 5, dxUm: 2, N, noiseOf: meanNoise }) : T.convolvePsf(gaussPsf(N, 1.5), { id: "lens.gauss", noiseOf: meanNoise });
    lensCore.spec_loss = (a, b) => T.capacityLoss(a, b, meanNoise(a));
    const R = T.hasData("materials") ? T.nk("aluminium", 550) : null;
    const mirror = R ? T.metalMirror("aluminium", 550, { noiseOf: meanNoise }) : T.mirror(0.9, { noiseOf: meanNoise });
    const gain = 1e-4, read = 3e-4, vref = 1.0;
    const kernels = [T.shot({ seed: 11 }), T.perChannel(lensCore, 3), mirror, T.bayer(1), T.conversionGain(gain), T.johnsonForRead(read), T.adc(o.bits || 10, vref, { seed: 12 }), T.entropyCode()];
    return { name: "photon to pixel", src, kernels, opt: { axis: "space", dx: 2e-6, dt: 1 / 60, grain: 1 } };
  };
  const gaussPsf = (N, s) => {
    const p = new Float64Array(N * N); let t = 0;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const a = x < N / 2 ? x : x - N, b = y < N / 2 ? y : y - N, w = Math.exp(-(a * a + b * b) / (2 * s * s)); p[y * N + x] = w; t += w; }
    return p.map((x) => x / t);
  };
  T.gaussPsf = gaussPsf;
  T.johnsonForRead = (vr, o = {}) => T.kernel({
    id: `sensor.read ${vr} V`, group: "noise", axes: ["noise"], claims: "homomorphism", from: { unit: "V" }, to: { unit: "V", rep: "analog" },
    forward: (f) => { const r = T.rng(o.seed || 21, "read"), s0 = typeof f.sigma === "number" ? f.sigma : 0; return { values: Float64Array.from(f.values, (x) => x + vr * T.gauss(r)), sigma: Math.hypot(s0, vr), rep: T.ANALOG }; },
    keeps: { name: "mean kept", check: (s, y) => { const a = T.varOf(y.values) >= 0; return { ok: a, detail: "variance defined" }; } },
    loss: (s) => T.channelLoss(s, vr * vr, vr),
  });

  /* Photon to spike. Slow modulated light through the eye's media, the catch, the cascade, the compression, the spike. */
  T.demoRetina = (n = 4096, o = {}) => {
    const dt = 0.001, r = T.rng(o.seed || 2, "light"), mean = o.mean || 40, v = new Float64Array(n);
    let a = 0; for (let i = 0; i < n; i++) { a += (T.gauss(r) - a) * 0.01; v[i] = mean * Math.max(0.05, 1 + 3 * a); }
    const m = v.reduce((p, x) => p + x, 0) / n;
    const src = T.seq("photons per ms", v, "count", { sigma: 0, prov: { status: "defined", method: "synthetic flicker, expected photons" } });
    const media = T.attenuator(0.5, { id: "eye.media T=0.5", group: "organic", axes: ["light"], physics: [{ status: "from_memory", source: "ocular media transmission about 0.5, textbook, not read" }], noiseOf: meanNoise });
    const kernels = [T.shot({ seed: 30 }), media, T.photonCatch(0.25, { seed: 31 }), T.cascade(4, 0.02, dt, { noiseOf: meanNoise, noise: m * 0.125 }), T.hill(3, 5, 1, { id: "retina.compress", group: "organic", domain: "sequence", tol: 0.25, physics: [{ status: "from_memory", source: "Naka-Rushton form, K chosen for this demo" }] }), T.lif(dt, 0.02, { win: 64, grain: 0.05 })];
    return { name: "photon to spike", src, kernels, opt: { axis: "time", dt, dx: 2e-6, grain: 1 } };
  };

  /* Word positions as a numeric sequence: the mark that lets a motif have a spectrum. */
  T.wordMarks = (word) => T.kernel({
    id: `marks "${word}"`, group: "bio", axes: ["time"], claims: "homomorphism", from: { unit: "symbol" }, to: { domain: "sequence", unit: "1" },
    forward: (f) => {
      const a = Array.from(f.values), L = word.length, o = new Float64Array(a.length);
      for (let i = 0; i + L <= a.length; i++) if (a.slice(i, i + L).join("") === word) o[i] = 1;
      return { values: o, unit: "1", rep: { kind: "digital", bits: 1, grain: 1, encoding: "mark" }, sigma: 0 };
    },
    keeps: { name: "marks equal the word count", check: (s, y) => { const c = T.kmerCounts(Array.from(s.values), word.length).get(word) || 0, m = y.values.reduce((a, b) => a + b, 0); return { ok: c === m, detail: `${m} marks, ${c} words` }; } },
    loss: (s, y) => ({ bits: Math.max(0, s.values.length * T.entropy(Array.from(s.values)) - y.values.length * T.entropy(y.values)), method: "entropy budget, symbols against marks" }),
  });
  /* Text to motif spectrum. A planted refrain every period words; field's pad, spectrum and magnitude do the rest. */
  T.demoText = (o = {}) => {
    const words = ["lens", "mirror", "field", "pixel", "grain", "spike", "root", "wave", "light", "time", "shade", "gate", "loop"], r = T.rng(o.seed || 3, "text"), period = o.period || 37, out = [];
    for (let i = 0; out.join(" ").length < (o.chars || 3000); i++) out.push(i % period === 0 ? "kernel" : words[Math.floor(r() * words.length)]);
    const text = out.join(" "), Fd = F(), src = T.seq("text", Array.from(text), "symbol", { rep: { kind: "digital", encoding: "utf-8 chars" } });
    return { name: "text to motif spectrum", src, text, kernels: [T.wordMarks("kernel"), Fd.C.pad(), Fd.C.spectrum(), Fd.C.magnitude(1 / 256)], opt: { axis: "time" } };
  };
  /* DNA to alignment. A synthetic reference, a mutated read, local alignment, then word spectrum on the aligned span. */
  T.demoDNA = (o = {}) => {
    const ref = T.randomDNA(o.len || 160, o.seed || 4, "ref"), read = T.randomDNA(20, o.seed || 4, "flank1") + T.mutate(ref.slice(40, 120), 0.05, 5) + T.randomDNA(20, o.seed || 4, "flank2");
    return { name: "DNA to alignment", src: T.dna("read", read), ref, kernels: [T.alignKernel(ref, { match: 2, mismatch: -1, gap: -2 }, { local: true }), T.kmer(3)], opt: { axis: "space" } };
  };
  if (typeof module !== "undefined" && module.exports) module.exports = T;
})(globalThis);
