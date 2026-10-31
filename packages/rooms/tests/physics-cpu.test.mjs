// Known answers from the Lens Room page, rerun on the CPU reference so CI needs no GPU. The page's own GPU
// versions run in the view and are compared in a browser (see project-docs/DESIGN.md).
import test from "node:test";
import { assert, near } from "./h.mjs";
import * as T from "../core/trace.js";
import { dropProfile, ewCurv, G, liqValue } from "../core/liquid.js";
import { para, sagAt, spotStats } from "../core/train.js";

for (const [n, ex] of [
  [1.333, 48.6],
  [1.5, 41.8],
])
  test(`Snell window, n ${n}, against ${ex} degrees`, () => near(T.snellWindowDeg(n), ex, 0.06, "window"));
test("planted: the wrong index misses the n 1.5 window", () =>
  assert.ok(Math.abs(T.snellWindowDeg(1.4) - 41.8) > 1));

for (const [deg, c] of [
  [50, 0.2],
  [60, 0.2],
  [70, 0.2],
  [60, 0.05],
  [75, 0.05],
])
  test(`repeat count in a plate, ${deg} degrees, strength ${c}`, () => {
    const r = T.plateRepeats(deg, c, 1.5);
    assert.equal(r.measured, r.predicted);
  });

test("centre sphere in a globe appears n times larger", () =>
  near(T.centreSphereEdge(1.5, 0.3), 0.45, 1e-3, "edge"));

for (const r of [0, 0.3, 0.5, 0.8])
  test(`apparent radius of an axis point at r ${r}`, () => {
    const a = T.apparentRadius(1.5, r);
    near(a.measured, a.predicted, 2e-3, "refraction at a sphere");
  });

test("Luneburg: rays from a rim point leave parallel to the diameter", () => {
  const a = T.luneburgExit(32);
  assert.ok(a.rmsDeg < 0.1, `rms ${a.rmsDeg}`);
  assert.ok(a.maxDeg < 0.2, `max ${a.maxDeg}`);
  assert.ok(a.rays >= 30);
});
test("planted: a uniform ball does not pass the Luneburg check", () => {
  assert.ok(T.luneburgExit(32, () => 1.5 * 1.5).rmsDeg > 5);
});
test("Maxwell fisheye: rays from a point meet at the antipode", () => {
  const m = T.fisheyeAntipode(1);
  assert.ok(m.spread < 1e-3, `spread ${m.spread}`);
});
test("Eaton: a near-axis ray turns back on itself", () => {
  const e = T.eatonTurn(0.3);
  near(Math.abs(e.turnDeg), 180, 3, "turn");
});
test("weak gravity: deflection against 4GM/(b c^2) over the finite path", () => {
  const g = T.gravityDeflection(0.01, 4, 400);
  near(g.measured, g.finitePredicted, 0.01 * g.finitePredicted, "deflection");
});
test("Beer-Lambert in the medium: unscattered fraction", () => {
  for (const [sig, L] of [
    [1, 0.37],
    [2, 0.37],
    [2, 0.81],
    [4, 0.81],
  ]) {
    const m = T.slabTransport(sig, L, 40000, 7);
    near(m.unscattered, Math.exp(-sig * L), 0.012, `sigma ${sig} L ${L}`);
  }
});
test("diffusion: total transmission falls as one over thickness", () => {
  const s = T.diffusionSlope(40, [0.16, 0.264, 0.368, 0.472, 0.628], 4000, 11);
  near(s.slope, -1, 0.2, "log-log slope");
});
test("zero density leaves every ray alone", () => {
  assert.equal(T.slabTransport(0, 1, 2000, 3).unscattered, 1);
});
test("Malus: pass fraction half cos squared", () => {
  for (const a of [0, 30, 45, 60, 90])
    near(T.malus(a), 0.5 * Math.cos((a * Math.PI) / 180) ** 2, 1e-12, `angle ${a}`);
});
test("moire period of two grids", () => {
  const m = T.moireFromGratings(3, 0.1);
  near(m.measured, m.predicted, 0.02 * m.predicted, "p/(2 sin(a/2))");
  assert.ok(Math.abs(T.moireFromGratings(6, 0.1).measured - m.predicted) > 0.3 * m.predicted, "planted angle");
});

test("spinning liquid mirror: focus from rays against g/(2 w^2)", () => {
  for (const w of [1, 2, 4]) {
    const cv = liqValue({ shape: 52, omega: w });
    near(T.parabolaFocus(cv), G / (2 * w * w), 1e-3 * (G / (2 * w * w)) + 1e-6, `omega ${w}`);
  }
});
test("electrowetting: no voltage leaves the rest angle, and voltage moves it", () => {
  near(ewCurv(0), -Math.cos((160 * Math.PI) / 180), 1e-12, "no voltage");
  assert.notEqual(ewCurv(60), ewCurv(0), "curvature moves with V");
});
test("Young-Laplace: at zero gravity a drop is a spherical cap", () => {
  const d = dropProfile(0);
  const R = d.apexR,
    H = d.height;
  for (let i = 0; i < 33; i++) {
    const rho = Math.sqrt(i / 32) * 1.2;
    const cap = H - (R - Math.sqrt(R * R - rho * rho));
    near(d.h[i], cap, 4e-3, `height at ${i}`);
  }
});
test("gravity flattens a sessile drop", () => {
  assert.ok(dropProfile(4).height < dropProfile(0).height);
});

test("readout helpers: para, sag, spot", () => {
  const g = (k, row) => (row === 0 ? [0, 0, 0, 1] : row === 1 ? [0, 0.1, 0, 1] : [0, -0.05, 1, 1]);
  const p = para(g, 0, 0.1);
  near(p.f, 2, 1e-12, "f = h/slope");
  near(p.zF, 2, 1e-12, "focus z");
  near(sagAt({ R: 2, k: 0, a4: 0, a6: 0 }, 1), 2 - Math.sqrt(3), 1e-12, "sphere sag");
  near(sagAt({ R: 2, k: -1, a4: 0, a6: 0 }, 1), 0.25, 1e-12, "parabola sag");
  assert.equal(sagAt({ R: 1, k: 0, a4: 0, a6: 0 }, 2), null);
  const N = 4,
    px = new Float32Array(N * N * 4);
  for (let i = 0; i < N * N; i++) {
    px[i * 4] = i % 2 ? 1 : -1;
    px[i * 4 + 3] = 1;
  }
  const s = spotStats(px, N);
  assert.ok(s.n > 0);
  near(s.mx, 0, 0.4, "centroid");
});
