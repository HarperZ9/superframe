// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* field/converters: the standard converters every field can use, each with its claim and its test.
     pad(shape)        zero-pad to a larger shape: an embedding (crop undoes it; random tails show the
                       target holds more than pad can make)
     spectrum(tol)     the complex DFT: an isomorphism (the inverse DFT undoes it, both ways, within tol)
     magnitude(grain)  |X|: a homomorphism that keeps energy (Parseval) and drops phase; its loss is measured
                       in the source space by rebuilding with zero phase and coding the residual at grain
     quantize(grain)   round to a grain: an embedding within tol = grain / 2, and not lossless below it */
(function (g) {
  "use strict";
  const F = (g.Field = g.Field || {});
  F.C = F.C || {};

  const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  F.rng = rng;
  const nextPow2 = (n) => { let p = 1; while (p < n) p <<= 1; return p; };

  /* Copy between a small array of shape sshape and a big one of shape bshape (row-major, last axis fastest).
     into = true writes small into big; into = false reads the box back out of big. */
  const copyBox = (small, sshape, big, bshape, comps, into) => {
    const nd = sshape.length, idx = new Array(nd).fill(0), n = sshape.reduce((a, b) => a * b, 1);
    for (let k = 0; k < n; k++) {
      let rem = k, bi = 0;
      for (let a = nd - 1; a >= 0; a--) { idx[a] = rem % sshape[a]; rem = Math.floor(rem / sshape[a]); }
      for (let a = 0; a < nd; a++) bi = bi * bshape[a] + idx[a];
      for (let c = 0; c < comps; c++) { if (into) big[bi * comps + c] = small[k * comps + c]; else small[k * comps + c] = big[bi * comps + c]; }
    }
  };

  F.C.pad = (shapeFn) => F.converter({
    id: "pad", claims: "embedding", tol: 0,
    forward: (f) => {
      const shape = shapeFn ? shapeFn(f.domain.shape) : f.domain.shape.map(nextPow2);
      const v = new Float64Array(shape.reduce((a, b) => a * b, 1) * f.components);
      copyBox(f.values, f.domain.shape, v, shape, f.components, true);
      return { values: v, domain: Object.assign({}, f.domain, { shape, padded_from: f.domain.shape }), unit: f.unit, sigma: typeof f.sigma === "number" ? f.sigma : null, components: f.components };
    },
    inverse: (out) => {
      const from = out.domain.padded_from, v = new Float64Array(from.reduce((a, b) => a * b, 1) * out.components);
      copyBox(v, from, out.values, out.domain.shape, out.components, false);
      return v;
    },
    targets: (src, out) => { const r = rng(7); return F.derive(out, { values: Float64Array.from(out.values, () => r() - 0.5), method: "random target" }); },
  });

  F.C.spectrum = (tol = 1e-9) => F.converter({
    id: "spectrum", claims: "isomorphism", tol,
    forward: (f) => { const X = F.fft(f); return { values: X.values, domain: Object.assign({}, X.domain, { fromComponents: f.components }), components: 2, sigma: X.sigma, rep: X.rep, unit: f.unit }; },
    inverse: (out) => {
      const x = F.ifft(F.derive(out, { method: "inverse test" })), n = x.values.length / 2, v = new Float64Array(n);
      for (let i = 0; i < n; i++) v[i] = x.values[2 * i];
      return out.domain.fromComponents === 2 ? x.values : v;
    },
    targets: (src, out) => {
      /* the DFT of a real signal is Hermitian; the real-valued inverse only covers that part of the space,
         so the reverse test draws a random real signal's spectrum, not an arbitrary complex array */
      const r = rng(11), v = Float64Array.from(src.values, () => r() - 0.5);
      return F.derive(out, { values: F.fft(F.derive(src, { values: v, method: "random real" })).values, method: "random target" });
    },
  });

  const energy = (v) => { let s = 0; for (let i = 0; i < v.length; i++) s += v[i] * v[i]; return s; };

  F.C.magnitude = (grain) => F.converter({
    id: "magnitude", claims: "homomorphism",
    forward: (f) => ({ values: F.power(f, true).values, components: 1, sigma: null, rep: f.rep, unit: f.unit, domain: f.domain }),
    keeps: { name: "energy (Parseval)", check: (src, out) => {
      const a = energy(src.values), b = energy(out.values), rel = Math.abs(a - b) / Math.max(1e-300, a);
      return { ok: rel < 1e-12, detail: "relative energy change " + rel.toExponential(2) };
    } },
    lossEstimate: grain ? (src, out) => {
      const back = (vals) => { const x = F.ifft(F.derive(src, { values: vals, method: "rebuild" })); return Float64Array.from({ length: x.values.length / 2 }, (_, i) => x.values[2 * i]); };
      const zero = new Float64Array(src.values.length);
      for (let i = 0; i < out.values.length; i++) zero[2 * i] = out.values[i];
      const L = F.roundTripLoss(back(src.values), back(zero), { residual: "abs", tol: grain / 2 });
      return { bits: L.bitsLost, method: `zero-phase rebuild, residual coded at ${grain} in the source space (${L.nBad} of ${L.n} values off)` };
    } : undefined,
  });

  F.C.quantize = (grain, tol = grain / 2) => F.converter({
    id: "quantize " + grain, claims: "embedding", tol,
    forward: (f) => ({ values: Float64Array.from(f.values, (x) => Math.round(x / grain) * grain), rep: Object.assign({}, f.rep, { kind: "digital", grain }) }),
    inverse: (out) => out.values,
  });

  if (typeof module !== "undefined" && module.exports) module.exports = F;
})(typeof globalThis !== "undefined" ? globalThis : this);
