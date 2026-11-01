// The regime gate must speak when a run leaves its regime, and Blasius must hold where it can and fail where it can't.
import test from "node:test";
import { assert, near } from "./h.mjs";
import { regimeGate, MODEL_LIMITS } from "../solvers/fluid/regime.js";
import { blasiusShear, blasiusProfile, plate, plateReading } from "../solvers/fluid/blasius.js";

const ids = (r) => r.outside.map((x) => x.id);
test("Gate: a good run passes; each planted bad run names its fault", () => {
  const good = Array.from({ length: 64 }, (_, k) => (k ? Math.exp(-k / 2) : 0));
  assert.ok(regimeGate({ N: 192, nu: 0.02, dt: 0.004, umax: 1, spectrum: good, wall: { eta: 0.06 } }).valid);
  const flat = Array.from({ length: 64 }, (_, k) => (k ? k ** (-5 / 3) : 0));
  assert.ok(ids(regimeGate({ N: 192, nu: 1e-4, dt: 0.004, umax: 1, spectrum: flat })).includes("resolution"));
  assert.ok(ids(regimeGate({ N: 192, nu: 1e-3, dt: 0.1, umax: 2 })).includes("cfl"));
  assert.ok(ids(regimeGate({ N: 192, nu: 0, dt: 0.004, umax: 1, wall: { eta: 0.02 } })).includes("inviscid-wall"));
  assert.ok(ids(regimeGate({ N: 512, nu: 2e-4, dt: 0.002, umax: 1, wall: { eta: 0.02 } })).includes("wall-layer"));
  // The study B case: Re 0.03 on grid 192, where return read 1.0 because nothing moved.
  assert.ok(ids(regimeGate({ N: 192, nu: 46, dt: 0.004, umax: 1, wall: { eta: 0.012 } })).includes("stiff-wall"));
  assert.ok(ids(regimeGate({ N: 64, umax: NaN, dt: 0.01 })).includes("unstable"));
  assert.ok(MODEL_LIMITS.wallLayer.text.includes("Blasius"));
});
test("Blasius constants by shooting", () => {
  near(blasiusShear(), 0.33206, 1e-4, "wall shear constant");
  near(blasiusProfile().displacement, 1.7208, 1e-3, "displacement constant");
  assert.ok(Math.abs(blasiusShear() - 0.47) > 0.1, "planted: the Falkner-Skan normalisation value is told apart");
});
test("Blasius field satisfies x momentum with viscosity; the inviscid mode fails", () => {
  const nu = 0.01, U = 1, B = blasiusProfile();
  const F = (eta) => { let s = 0; for (let e = 0; e < eta; e += 0.01) s += B.at(e + 0.005) * 0.01; return s; };
  const u = (x, y) => U * B.at(y * Math.sqrt(U / (nu * x)));
  const v = (x, y) => { const eta = y * Math.sqrt(U / (nu * x)); return 0.5 * Math.sqrt((nu * U) / x) * (eta * B.at(eta) - F(eta)); };
  const res = (x, y, n) => {
    const hy = 0.02, hx = 0.05;
    const ux = (u(x + hx, y) - u(x - hx, y)) / (2 * hx), uy = (u(x, y + hy) - u(x, y - hy)) / (2 * hy), uyy = (u(x, y + hy) - 2 * u(x, y) + u(x, y - hy)) / (hy * hy);
    return { adv: u(x, y) * ux + v(x, y) * uy, visc: n * uyy };
  };
  for (const y of [0.15, 0.3, 0.5]) {
    const r = res(3, y, nu), bad = res(3, y, 0);
    assert.ok(Math.abs(r.adv - r.visc) < 0.2 * Math.abs(r.visc), `viscous residual at y ${y}: ${r.adv} against ${r.visc}`);
    assert.ok(Math.abs(bad.adv - bad.visc) > 0.5 * Math.abs(r.visc), `inviscid must fail at y ${y}`);
  }
});
test("Penalised plate: viscous beats inviscid, and still misses Blasius (a recorded null)", () => {
  const run = (nu) => { const s = plate({ nu }); for (let i = 0; i < 500; i++) s.step(0.01); return plateReading(s, 2, 0.01); };
  const v = run(0.01), i = run(0);
  assert.ok(i.profileErr > 2 * v.profileErr, `inviscid ${i.profileErr} against viscous ${v.profileErr}`);
  // When this starts failing the method improved: update MODEL_LIMITS.wallLayer and project-docs/FLUID-ROOM.md.
  assert.ok(v.profileErr > 0.1, `plate error ${v.profileErr}`);
});
