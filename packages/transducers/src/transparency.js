/* transducers/transparency: absorption, index matching, compositing, film density and a map of what a crossing
   let through. Absorption is the flat end of the lens's transfer function, so it reuses the attenuator. */
(function (g) {
  "use strict";
  const T = (g.Transducers = g.Transducers || {});
  /* Beer-Lambert: transmittance exp(-a d), with a per metre and d in metres. */
  T.beerLambert = (a, d, o = {}) => T.attenuator(Math.exp(-a * d), Object.assign({ id: `absorb a=${a} d=${d}`, group: "transparency", axes: ["light", "space"] }, o));
  /* Index matching. N pairs of interfaces between n1 and n2, summed incoherently: each interface passes 1 - R. */
  T.layersT = (n1, n2, layers) => (1 - T.fresnelNormal(n2, 0, n1)) ** (2 * layers);
  T.indexMatch = (n1, n2, layers, o = {}) => T.attenuator(T.layersT(n1, n2, layers), Object.assign({ id: `index ${n1}|${n2} x${layers}`, group: "transparency", axes: ["light", "space"],
    physics: [{ status: "from_memory", source: "tissue indices 1.33 to 1.40, textbook range, not read" }] }, o));

  /* Porter-Duff on premultiplied layers: components are (aC, a, bC, b); output (oC, o). */
  const PD = {
    clear: () => [0, 0], src: () => [1, 0], dst: () => [0, 1], over: (a) => [1, 1 - a], under: (a, b) => [1 - b, 1],
    in: (a, b) => [b, 0], out: (a, b) => [1 - b, 0], atop: (a, b) => [b, 1 - a], xor: (a, b) => [1 - b, 1 - a],
  };
  T.PD_OPS = Object.keys(PD);
  T.porterDuff = (op, grain = 1 / 255) => T.kernel({
    id: "composite." + op, group: "transparency", axes: ["light"], claims: "homomorphism", from: { rep: "digital" }, to: { rep: "digital" },
    forward: (f) => {
      const n = f.values.length / 4, o = new Float64Array(2 * n), v = f.values, fn = PD[op];
      for (let i = 0; i < n; i++) {
        const [Fa, Fb] = fn(v[4 * i + 1], v[4 * i + 3]);
        o[2 * i] = Fa * v[4 * i] + Fb * v[4 * i + 2]; o[2 * i + 1] = Fa * v[4 * i + 1] + Fb * v[4 * i + 3];
      }
      return { values: o, components: 2 };
    },
    keeps: { name: "output alpha stays in 0..1", check: (s, o) => {
      let bad = 0;
      for (let i = 1; i < o.values.length; i += 2) if (o.values[i] < -1e-12 || o.values[i] > 1 + 1e-12) bad++;
      return { ok: bad === 0, detail: bad + " alphas outside 0..1" };
    } },
    loss: (s, o) => T.budgetLoss(s, o, grain, grain),
  });

  /* A film density stack: per-layer densities in components. Density adds and the sum is all that survives, so the
     layers cannot be told apart afterwards. */
  T.densityStack = (grain = 0.01) => T.kernel({
    id: "film.density-stack", group: "transparency", axes: ["light"], claims: "homomorphism", from: { rep: "digital" }, to: { rep: "digital" },
    forward: (f) => {
      const c = f.components, n = f.values.length / c, o = new Float64Array(n);
      for (let i = 0; i < n; i++) { let d = 0; for (let k = 0; k < c; k++) d += f.values[i * c + k]; o[i] = 10 ** -d; }
      return { values: o, components: 1 };
    },
    keeps: { name: "transmittance is 10^-(sum of densities)", check: (s, o) => {
      const c = s.components; let e = 0;
      for (let i = 0; i < o.values.length; i++) { let d = 0; for (let k = 0; k < c; k++) d += s.values[i * c + k]; e = Math.max(e, Math.abs(-Math.log10(o.values[i]) - d)); }
      return { ok: e < 1e-9, detail: "max density error " + e.toExponential(2) };
    } },
    loss: (s, o) => T.budgetLoss(s, o, grain, grain / 10),
  });
  /* Dye density at a wavelength from the measured curves. */
  T.dyeDensity = (dye, nm) => {
    const c = T.filmCurves().dyes[dye].curve;
    if (nm <= c[0][0]) return c[0][1];
    for (let i = 1; i < c.length; i++) if (c[i][0] >= nm) { const u = (nm - c[i - 1][0]) / (c[i][0] - c[i - 1][0]); return c[i - 1][1] * (1 - u) + c[i][1] * u; }
    return c[c.length - 1][1];
  };

  /* The transparency map: tile by tile, the bits the output carries about the source (opacity) over the residual
     (clear). Input components are (x, y); output is bits per pixel, one value per tile. */
  T.transparencyMap = (tile = 8, grain = 1 / 32) => T.kernel({
    id: "map.transparency", group: "transparency", axes: ["space", "noise"], claims: "homomorphism", from: { domain: "grid" }, to: { domain: "grid", unit: "bit" },
    forward: (f) => {
      const { h, w } = T.gridOf(f), H2 = Math.floor(h / tile), W2 = Math.floor(w / tile), o = new Float64Array(H2 * W2);
      for (let a = 0; a < H2; a++) for (let b = 0; b < W2; b++) {
        const X = [], Y = [];
        for (let y = 0; y < tile; y++) for (let x = 0; x < tile; x++) {
          const i = (a * tile + y) * w + b * tile + x;
          X.push(Math.round(f.values[2 * i] / grain)); Y.push(Math.round(f.values[2 * i + 1] / grain));
        }
        o[a * W2 + b] = Math.max(0, T.entropy(X) + T.entropy(Y) - T.entropy(X.map((v, i) => v + "|" + Y[i])));
      }
      return { values: o, domain: { kind: "grid", shape: [H2, W2] }, components: 1, unit: "bit" };
    },
    keeps: { name: "carried bits never exceed the tile's own", check: (s, o) => ({ ok: o.values.every((v) => v <= Math.log2(tile * tile) + 1e-9), detail: "at most log2(tile^2)" }) },
    loss: (s, o) => T.budgetLoss(s, o, grain, 0.1),
  });
  if (typeof module !== "undefined" && module.exports) module.exports = T;
})(globalThis);
