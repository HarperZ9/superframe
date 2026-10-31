// Known answers for the 3D solver. Each has a planted bad value that must fail.
import test from "node:test";
import { assert, near } from "./h.mjs";
import { Spectral3, taylorGreen3, abc, BRACHET_TABLE3, within } from "../solvers/fluid/index.js";

const tgAt = (n, tEnd, dt, o) => {
  const s = new Spectral3(n, o);
  s.setVelocity(taylorGreen3);
  for (let i = 0; i < Math.round(tEnd / dt); i++) s.step(dt);
  return s;
};
test("Inviscid Taylor-Green enstrophy matches Brachet 1983 table 3 at t = 1; a wrong table value is caught", () => {
  const s = tgAt(32, 1, 0.05, { nu: 0 });
  const ref = BRACHET_TABLE3.find(([t]) => t === 1)[1];
  assert.ok(within(s.enstrophy(), ref, 1e-5).ok, `enstrophy ${s.enstrophy()} against ${ref}`);
  assert.ok(!within(s.enstrophy(), BRACHET_TABLE3.find(([t]) => t === 2)[1], 1e-3).ok, "planted row must fail");
  const v = tgAt(32, 1, 0.05, { nu: 0.05 });
  assert.ok(!within(v.enstrophy(), ref, 1e-3).ok, "planted viscosity must fail");
});
test("Divergence stays near machine zero; switching the projection off is caught", () => {
  const start = (x, y, z) => { const a = abc(1, 0.7, 0.5)(x, y, z); return [a[0] + 0.2 * Math.sin(2 * y + z), a[1] + 0.1 * Math.cos(x - 3 * z), a[2]]; };
  const s = new Spectral3(16, { nu: 0.01 });
  s.setVelocity(start);
  for (let i = 0; i < 10; i++) s.step(0.02);
  assert.ok(s.maxDivergence() < 1e-12, `divergence ${s.maxDivergence()}`);
  const bad = new Spectral3(16, { nu: 0.01, project: false });
  bad.setVelocity((x, y, z) => [Math.sin(x), Math.sin(y), 0]);
  for (let i = 0; i < 10; i++) bad.step(0.02);
  assert.ok(bad.maxDivergence() > 0.1, `planted ${bad.maxDivergence()}`);
});
const helical = (x, y, z) => {
  const a = abc(1, 0.8, 0.6)(x, y, z);
  return [a[0] + 0.3 * Math.sin(2 * y) * Math.cos(z), a[1] + 0.3 * Math.cos(2 * z + x), a[2] + 0.3 * Math.sin(x + 2 * y)];
};
test("Energy and helicity are conserved in the inviscid truncated limit; a tampered nonlinear term is caught", () => {
  const run = (forceFn) => {
    const s = new Spectral3(16, { nu: 0, forceFn });
    s.setVelocity(helical);
    const E0 = s.energy(), H0 = s.helicity();
    for (let i = 0; i < 40; i++) s.step(0.025);
    return { dE: Math.abs(s.energy() / E0 - 1), dH: Math.abs(s.helicity() / H0 - 1) };
  };
  const good = run(null);
  assert.ok(good.dE < 1e-7 && good.dH < 1e-7, `drift E ${good.dE}, H ${good.dH}`);
  const tampered = run((out) => { for (let i = 0; i < out[0].re.length; i++) { out[0].re[i] *= 1.05; out[0].im[i] *= 1.05; } });
  assert.ok(tampered.dE > 1e-4 && tampered.dH > 1e-4, `planted drift E ${tampered.dE}, H ${tampered.dH}`);
});
test("Beltrami flow: ABC decays exactly, helicity is omega times energy", () => {
  const nu = 0.1, s = new Spectral3(16, { nu });
  s.setVelocity(abc(1, 0.8, 0.6));
  near(s.helicity(), 2 * s.energy(), 1e-12, "H = 2 E for curl u = u");
  const E0 = s.energy();
  for (let i = 0; i < 20; i++) s.step(0.05);
  near(s.energy(), E0 * Math.exp(-2 * nu), 1e-10, "exact decay");
  assert.ok(Math.abs(s.energy() - E0 * Math.exp(-nu)) > 1e-2, "planted rate must fail");
});
test("Q integrates to zero, and is positive in a solid-body core", () => {
  const s = new Spectral3(32, { nu: 0 });
  s.setVelocity(taylorGreen3);
  const Q = s.qField();
  near(Q.reduce((a, b) => a + b, 0) / Q.length, 0, 1e-12, "mean Q on a torus");
  const v = new Spectral3(32);
  v.setVelocity((x, y, z) => [-Math.sin(y), Math.sin(x), 0]); // near x = y = 0 this is rigid rotation
  near(v.qField()[0], 1, 1e-10, "Q = omega^2 / 4 for rigid rotation at rate 1");
  near(v.vorticity()[2][0], 2, 1e-10, "vorticity 2");
});
test("Spectrum sums to energy", () => {
  const s = new Spectral3(16);
  s.setVelocity(helical);
  near(s.spectrum().reduce((a, b) => a + b, 0), s.energy(), 1e-10, "Parseval");
});
