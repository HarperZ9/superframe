// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* Demo: one floating-point computation, fused and unfused, graded against its own specification.
   The spec is saxpy, y' = a x + y in float32, rounded once (IEEE 754 fusedMultiplyAdd). Inputs follow
   F122: a = 2.5, x and y drawn on the 2^-24 grid in [0, 1), so every input is an exact float32.
     saxpy.fused     one rounding. Computed exactly here: a x is exact in float64 (48 significant bits), the
                     sum's rounding error is recovered by TwoSum, and the one tie case float64 can hide (the
                     sum landing on a float32 midpoint) is broken by that error's sign.
     saxpy.unfused   two roundings: fround(fround(a x) + y). The second sum is correctly rounded (53 >= 2*24+2),
                     so the only difference from the spec is the first rounding.
   Each lowering claims isomorphism with the spec at 0 ULP. The residual is the ULP distance, so the loss is
   counted in representable values, and the rounding class is recorded in the ledger. */
"use strict";
const F = require("../src/index.js");
const fr = Math.fround;

const twoSum = (a, b) => { const s = a + b, bb = s - a, e = (a - (s - bb)) + (b - bb); return [s, e]; };
const nextUp32 = (x) => { const f = new Float32Array([x]), i = new Int32Array(f.buffer); i[0] += x >= 0 ? 1 : -1; return f[0]; };
const nextDown32 = (x) => { const f = new Float32Array([x]), i = new Int32Array(f.buffer); i[0] += x > 0 ? -1 : 1; return f[0]; };

/* round(a*x + y) to float32 with one rounding, for float32 inputs */
const fma32 = (a, x, y) => {
  const [s, e] = twoSum(a * x, y), f = fr(s);
  if (f === s || e === 0) return f;
  const other = s > f ? nextUp32(f) : nextDown32(f);
  if (s - f !== other - s) return f;
  return e > 0 === other > f ? other : f;
};
const unfused32 = (a, x, y) => fr(fr(a * x) + y);

const inputs = (n, seed = 20261031) => {
  const r = F.rng(seed), v = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) { v[3 * i] = 2.5; v[3 * i + 1] = Math.floor(r() * 16777216) / 16777216; v[3 * i + 2] = Math.floor(r() * 16777216) / 16777216; }
  return F.make({ name: "saxpy inputs", domain: { kind: "sequence", shape: [n] }, values: v, components: 3, unit: "1", sigma: 0,
    prov: { status: "defined", source: "demos/float.js seeded draw on the 2^-24 grid", method: "F122 input recipe" },
    rep: { kind: "digital", encoding: "float32", bits: 32 } });
};

const evalWith = (fn, f) => { const n = f.values.length / 3, o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = fn(f.values[3 * i], f.values[3 * i + 1], f.values[3 * i + 2]); return o; };
const spec = (f) => evalWith(fma32, f);

const lowering = (id, fn, rounding, opt = {}) => F.converter({ id, claims: opt.claims || "isomorphism", residual: "ulp32", tol: opt.tolUlp || 0, rounding,
  forward: (f) => ({ values: opt.plant ? opt.plant(evalWith(fn, f)) : evalWith(fn, f), components: 1, sigma: null,
    rep: { kind: "digital", encoding: "float32", bits: 32, rounding } }),
  reference: spec,
  keeps: { name: "within 1 ULP of the one-rounding result", check: (src, out) => {
    const ref = spec(src);
    let worst = 0;
    for (let i = 0; i < ref.length; i++) worst = Math.max(worst, Math.abs(F.ulpDiff32(ref[i], out.values[i])));
    return { ok: worst <= 1, detail: "worst " + worst + " ULP" };
  } },
});

const C = {
  fused: lowering("saxpy.fused (one rounding)", fma32, "one rounding (fused)"),
  unfused: lowering("saxpy.unfused (two roundings)", unfused32, "two roundings (mul, add)"),
  unfused1: lowering("saxpy.unfused at a 1 ULP budget", unfused32, "two roundings (mul, add)", { tolUlp: 1 }),
  plantedOne: lowering("saxpy.fused with one planted ULP", fma32, "one rounding (fused)", { plant: (o) => { o[12345] = nextUp32(o[12345]); return o; } }),
};

const run = (n = 1 << 22) => {
  const f = inputs(n), out = {};
  for (const [k, c] of Object.entries(C)) out[k] = F.apply(c, f, { strict: false }).verdict;
  return { n, rate_unfused: out.unfused.nBad / n, f122: { mismatched: 655540, of: 4194304, rate: 655540 / 4194304 }, verdicts: out };
};

module.exports = { run, C, fma32, unfused32, inputs, nextUp32 };
