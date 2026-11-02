import test from "node:test";
import { assert, near } from "./h.mjs";
import { ILL, BL, cmfB, MP, metaPair, solve3, labOf, dE, MACH, X2R, R2X, SENS } from "../core/spectra.js";
import { mv } from "../core/matrix.js";
import { CMF, D65 } from "../core/data/cie.js";

const xyz = (R, ill) => {
  const E = ILL[ill],
    v = [0, 0, 0];
  BL.forEach((_, i) => cmfB[i].forEach((c, k) => (v[k] += c * E[i] * R[i])));
  return v;
};
const lumi = (ill) => BL.reduce((s, _, i) => s + cmfB[i][1] * ILL[ill][i], 0);
const white = (ill) => {
  const X = [0, 0, 0];
  BL.forEach((_, i) => cmfB[i].forEach((c, k) => (X[k] += c * ILL[ill][i])));
  return X.map((a) => a / lumi(ill));
};
const de = (ill, t = (v) => v) => {
  const N = (v) => v.map((a) => a / lumi(ill));
  const W = t(white(ill));
  return dE(labOf(t(N(xyz(MP.R1, ill))), W), labOf(t(N(xyz(MP.R2, ill))), W));
};

test("the metamer pair matches under D65 and only there", () => {
  assert.ok(de("D65") < 1e-6, `dE D65 ${de("D65")}`);
  assert.ok(de("A") > 0.5, `dE A ${de("A")}`);
  assert.ok(de("LED") > 0.5, `dE LED ${de("LED")}`);
});
test("reflectances stay physical and the two spectra differ", () => {
  for (const R of [MP.R1, MP.R2]) for (const v of R) assert.ok(v >= 0.019 && v <= 0.961, String(v));
  assert.ok(MP.R1.some((v, i) => Math.abs(v - MP.R2[i]) > 0.02));
});
test("dichromat models move the match under tungsten", () => {
  for (const d of ["protan", "deutan", "tritan"]) {
    const t = (v) => mv(R2X, mv(MACH[d], mv(X2R, v)));
    assert.ok(de("A", t) > 0.05, d);
  }
});
test("colour matrices invert, and Machado rows sum to one", () => {
  const I = mv(X2R, mv(R2X, [0.2, 0.5, 0.7]));
  near(I[0], 0.2, 1e-3, "r");
  near(I[1], 0.5, 1e-3, "g");
  near(I[2], 0.7, 1e-3, "b");
  for (const m of Object.values(MACH)) for (const r of m) near(r[0] + r[1] + r[2], 1, 1e-3, "row sum");
});
test("solve3 solves", () => {
  const x = solve3(
    [
      [2, 0, 1],
      [0, 3, 0],
      [1, 0, 4],
    ],
    [3, 3, 5]
  );
  near(x[0], 1, 1e-12, "x");
  near(x[1], 1, 1e-12, "y");
  near(x[2], 1, 1e-12, "z");
});
test("illuminant A is Planck at 2848 K with c2 1.435e7 nm K, normalised at 560 nm", () => {
  const i = 9,
    l = BL[i],
    c2 = 1.435e7,
    T = 2848;
  const want = (100 * Math.pow(560 / l, 5) * (Math.exp(c2 / (T * 560)) - 1)) / (Math.exp(c2 / (T * l)) - 1);
  near(ILL.A[i], want, 1e-9, "A");
});
test("tables have the stated spans; D65 reads 100 at 560 nm; ybar reads 0.995 at 560 nm", () => {
  assert.equal(CMF.length, 33);
  assert.equal(D65.length, 37);
  assert.equal(D65[(560 - 340) / 10], 100);
  near(CMF[(560 - 380) / 10][1], 0.995, 1e-9, "ybar");
  assert.equal(SENS.bee.length, BL.length);
});
test("planted: a scaled copy of the second spectrum no longer matches", () => {
  const p = metaPair();
  const a = xyz(p.R1, "D65"),
    b = xyz(
      p.R2.map((v) => v * 1.01),
      "D65"
    );
  assert.ok(Math.abs(a[1] - b[1]) > 0.1);
});
