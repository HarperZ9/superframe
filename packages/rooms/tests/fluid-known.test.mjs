// Known answers for the 2D solver and the closed forms. Each has a planted bad value that must fail.
import test from "node:test";
import { assert, near } from "./h.mjs";
import {
  Spectral2, within, taylorGreen2Omega, taylorGreen2Energy, poiseuille, annularCouette, rankine, lambOseen, lambOseenOmega,
  burgersOmega, burgersBudget, kolmogorovGrowth, kolmogorovCritical, spectralSlope, drainFlow, bowlWall, radialProfile, azimuthal, FLUID_CONSTANTS,
} from "../solvers/fluid/index.js";
import { taylorCycle } from "../solvers/fluid/reversal.js";
import { dominantFrequency } from "../solvers/fluid/karman.js";
import { fft2d } from "../solvers/fluid/fftn.js";

const decay = (nu, N = 32) => {
  const s = new Spectral2(N, N, { nu });
  s.setField(0, taylorGreen2Omega(1, 0.1, 0));
  for (let i = 0; i < 100; i++) s.step(0.01);
  return s.energy();
};
test("2D Taylor-Green decays exactly; double viscosity is caught", () => {
  const ref = taylorGreen2Energy(1, 0.1, 1);
  assert.ok(within(decay(0.1), ref, 1e-12).ok, `energy ${decay(0.1)} against ${ref}`);
  assert.ok(!within(decay(0.2), ref, 1e-3).ok, "planted viscosity must fail");
});
test("SSP RK3, as on the GPU, converges at third order", () => {
  const run = (dt) => {
    const s = new Spectral2(32, 32, { nu: 0.1, scheme: "ssp3" });
    s.setField(0, (x, y) => taylorGreen2Omega(1, 0.1, 0)(x, y) + 0.3 * Math.cos(2 * x) * Math.sin(y));
    for (let i = 0; i < Math.round(1 / dt); i++) s.step(dt);
    return s;
  };
  const ref = new Spectral2(32, 32, { nu: 0.1 });
  ref.setField(0, (x, y) => taylorGreen2Omega(1, 0.1, 0)(x, y) + 0.3 * Math.cos(2 * x) * Math.sin(y));
  for (let i = 0; i < 400; i++) ref.step(0.0025);
  const e1 = Math.abs(run(0.1).energy() - ref.energy()), e2 = Math.abs(run(0.05).energy() - ref.energy());
  near(e1 / e2, 8, 2.5, "convergence ratio on halving the step");
});
test("Poiseuille through penalised walls matches the parabola; the soft wall's error is stated", () => {
  const nu = 1, g = 1, y0 = 1, y1 = 1 + Math.PI, Ny = 128, eta = 0.002;
  const s = new Spectral2(4, Ny, { nu, dynamicMean: true });
  const chi = new Float64Array(s.n);
  for (let j = 0; j < Ny; j++) for (let i = 0; i < 4; i++) {
    const y = j * s.dy, inside = 0.5 * (Math.tanh((y - y0) / (0.5 * s.dy)) - Math.tanh((y - y1) / (0.5 * s.dy)));
    chi[j * 4 + i] = 1 - inside;
  }
  s.wall = { chi, ux: new Float64Array(s.n), uy: new Float64Array(s.n), eta };
  s.meanForce = [(g * chi.reduce((a, c) => a + 1 - c, 0)) / s.n, 0];
  // Force as g(y) = g inside, balanced by the wall: curl = -dg/dy, set in spectral space from the mask.
  const f = new Float64Array(s.n), fi = new Float64Array(s.n);
  for (let i = 0; i < s.n; i++) f[i] = g * (1 - chi[i]);
  fft2d(f, fi, 4, Ny);
  s.drive = (q) => [s.ky[q] * fi[q], -s.ky[q] * f[q]]; // -i ky F
  for (let i = 0; i < 2000; i++) s.step(0.0015);
  const { u } = s.velocity();
  for (let i = 0; i < s.n; i++) u[i] += s.Umean[0];
  const exact = poiseuille(g, nu, y0, y1), uMax = g * Math.PI ** 2 / (8 * nu);
  let err = 0;
  for (let j = 0; j < Ny; j++) { const y = j * s.dy; if (y > y0 + 0.3 && y < y1 - 0.3) err = Math.max(err, Math.abs(u[j * 4] - exact(y))); }
  assert.ok(err / uMax < 0.05, `peak relative error ${err / uMax}`);
  const planted = poiseuille(g, 2 * nu, y0, y1);
  assert.ok(Math.abs(u[Math.round((y0 + y1) / 2 / s.dy) * 4] - planted((y0 + y1) / 2)) / uMax > 0.3, "planted viscosity must fail");
});
test("Kolmogorov threshold: the Galerkin matrix gives sqrt 2 and the solver agrees on growth", () => {
  near(kolmogorovCritical(0.02), FLUID_CONSTANTS.kolmogorovRec.value, 0.003, "Re_c at long wavelength");
  assert.ok(kolmogorovGrowth(1, 200) < 0, "alpha of 1 stays stable, Meshalkin and Sinai");
  assert.ok(!within(kolmogorovCritical(0.02), 2.5, 0.05).ok, "planted threshold fails");
  const growth = (Re) => {
    const alpha = 0.25, Nx = 16, Ny = 32, nu = 1 / Re, s = new Spectral2(Nx, Ny, { nu, Lx: (2 * Math.PI) / alpha });
    // U = sin y, omega = -dU/dy = -cos y, held by forcing nu k^2 omega.
    let qA = -1, qB = -1;
    for (let i = 0; i < s.n; i++) if (s.kx[i] === 0 && Math.abs(s.ky[i]) === 1) { if (s.ky[i] > 0) qA = i; else qB = i; }
    s.setField(0, (x, y) => -Math.cos(y) + 1e-4 * Math.cos(alpha * x) * Math.cos(y) + 1e-4 * Math.sin(alpha * x));
    const base = [s.fields[0].re[qA], s.fields[0].re[qB]];
    s.drive = (q) => (q === qA ? [nu * base[0], 0] : q === qB ? [nu * base[1], 0] : null);
    const pert = () => {
      let m = 0;
      for (let i = 0; i < s.n; i++) if (s.kx[i] !== 0) m += s.fields[0].re[i] ** 2 + s.fields[0].im[i] ** 2;
      return 0.5 * Math.log(m);
    };
    for (let i = 0; i < 200; i++) s.step(0.05);
    const a = pert();
    for (let i = 0; i < 200; i++) s.step(0.05);
    return (pert() - a) / 10;
  };
  near(growth(4), kolmogorovGrowth(0.25, 4), 2e-3, "growth above threshold");
  near(growth(1.2), kolmogorovGrowth(0.25, 1.2), 2e-3, "decay below threshold");
  assert.ok(growth(1.2) < 0 && growth(4) > 0, "the sign flips across the threshold");
});
const vortexBox = (N, nu, G, width) => {
  const s = new Spectral2(N, N, { nu });
  s.setField(0, (x, y) => (G / (Math.PI * width * width)) * Math.exp(-((x - Math.PI) ** 2 + (y - Math.PI) ** 2) / (width * width)));
  return s;
};
test("Lamb-Oseen spreads as published; wrong viscosity is caught", () => {
  const nu = 0.02, G = 1, t0 = 0.5, s = vortexBox(64, nu, G, Math.sqrt(4 * nu * t0));
  for (let i = 0; i < 100; i++) s.step(0.01);
  const tEnd = t0 + 1, w = s.physical(0), peak = Math.max(...w) + G / (4 * Math.PI ** 2);
  const ref = lambOseenOmega(G, nu, tEnd)(0);
  assert.ok(within(peak, ref, 0.01 * ref).ok, `peak ${peak} against ${ref}`);
  assert.ok(!within(peak, lambOseenOmega(G, 2 * nu, tEnd)(0), 0.01 * ref).ok, "planted viscosity must fail");
  const prof = radialProfile(s, azimuthal(s), 40), near1 = prof.find((p) => p.r > 0.5), exact = lambOseen(G, nu, tEnd)(near1.r);
  near(near1.v, exact, 0.03 * exact, "u_theta at r = 0.5, box images allowed for");
});
test("Rankine: spectral inversion returns the profile; wrong circulation is caught", () => {
  const G = 1, a = 0.6, N = 128, s = new Spectral2(N, N);
  // Slight smoothing of the edge: a true jump would ring.
  s.setField(0, (x, y) => (G / (Math.PI * a * a)) * 0.5 * (1 + Math.tanh((a - Math.hypot(x - Math.PI, y - Math.PI)) / 0.03)));
  const prof = radialProfile(s, azimuthal(s), 60), R = rankine(G, a);
  for (const p of prof.filter((q) => q.r > 0.15 && q.r < 1.2 && Math.abs(q.r - a) > 0.1)) {
    // Periodic images and the neutralising background add a solid-body term of -G r / (2 L^2) on average.
    const want = R(p.r) - (G * p.r) / (2 * (2 * Math.PI) ** 2);
    near(p.v, want, 0.015, `u_theta at r = ${p.r.toFixed(2)}`);
  }
  const R2 = rankine(1.3 * G, a), q = prof.find((p) => p.r > 1);
  assert.ok(Math.abs(q.v - R2(q.r)) > 0.02, "planted circulation must fail");
});
test("Burgers vortex: the plane's drain gives the stretched core; the budget closes", () => {
  const a = 2, nu = 0.02, G = 1, f = burgersOmega(G, a, nu);
  for (const r of [0.05, 0.1, 0.3, 0.4]) {
    const b = burgersBudget(f, a, nu, r);
    near(b.residual, 0, 1e-3 * Math.abs(b.strain) + 1e-3, `budget at ${r}`);
    assert.ok(Math.abs(b.strain) > 0.01, "the balance has terms to balance");
  }
  const planted = burgersBudget(burgersOmega(G, a, 2 * nu), a, nu, 0.1);
  assert.ok(Math.abs(planted.residual) > 0.1 * Math.abs(planted.strain), "planted core width breaks the budget");
  // On a torus a uniform background would be stretched too, so the neutralising vorticity sits outside the source ring.
  const s = new Spectral2(128, 128, { nu }), ringR = 3.05, ringW = 0.08;
  s.setField(0, (x, y) => {
    const r = Math.hypot(x - Math.PI, y - Math.PI);
    return (G / (Math.PI * 0.25)) * Math.exp((-r * r) / 0.25) - (G / (2 * Math.PI ** 1.5 * ringR * ringW)) * Math.exp(-(((r - ringR) / ringW) ** 2));
  });
  s.flow = drainFlow(s, a, 1.6, 2.6, 0.1);
  for (let i = 0; i < 250; i++) s.step(0.01);
  const w = s.physical(0), inner = radialProfile(s, w, 120);
  // Circulation held in the core, from the field itself, then the peak the Burgers formula gives for it.
  let circ = 0;
  for (const p of inner) if (p.r < 0.8) circ += p.v * 2 * Math.PI * p.r * (Math.PI / 120);
  const peak = Math.max(...w), ref = burgersOmega(circ, a, nu)(0);
  near(peak / ref, 1, 0.05, "peak against Burgers");
  near(circ, G, 0.1, "circulation stayed in the core");
  assert.ok(!within(peak, burgersOmega(circ, 2 * a, nu)(0), 0.05 * ref).ok, "planted strain must fail");
  assert.ok(peak > 2.5 * (G / (Math.PI * 0.25)), "the drain stretched the core");
});
test("Stokes annulus: penalised walls give the Couette profile", () => {
  const a = 0.96, b = 2.4, Om = 1, N = 64, nu = 1, eta = 0.003, s = new Spectral2(N, N, { nu });
  const chi = new Float64Array(s.n), ux = new Float64Array(s.n), uy = new Float64Array(s.n);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const X = i * s.dx - Math.PI, Y = j * s.dy - Math.PI, r = Math.hypot(X, Y), q = j * N + i;
    const inner = 0.5 * (1 + Math.tanh((a - r) / (0.5 * s.dx))), outer = 0.5 * (1 + Math.tanh((r - b) / (0.5 * s.dx)));
    chi[q] = Math.min(1, inner + outer);
    if (r < (a + b) / 2) { ux[q] = -Om * Y; uy[q] = Om * X; }
  }
  s.wall = { chi, ux, uy, eta };
  for (let i = 0; i < 600; i++) s.step(0.002);
  const prof = radialProfile(s, azimuthal(s), 25), exact = annularCouette(a, b, Om);
  for (const p of prof.filter((q) => q.r > a + 0.25 && q.r < b - 0.25)) near(p.v, exact(p.r), 0.04, `u_theta at ${p.r.toFixed(2)}`);
  const m = prof.find((p) => p.r > 1.6);
  assert.ok(Math.abs(m.v - annularCouette(a, b, 2 * Om)(m.r)) > 0.1, "planted wall speed must fail");
});
test("Stokes reversal matches the null-space study; a half-turn kick does not return", () => {
  assert.equal(taylorCycle({ count: 2000 }), 1);
  assert.equal(taylorCycle({ count: 2000, kick: Math.PI }), 0);
  // taylor_result.json in the working notes: half the blob returns near Peclet 2.8e6, at 1e8 almost all, at 1e4 almost none.
  const lo = taylorCycle({ count: 1500, peclet: 3e5 }), mid = taylorCycle({ count: 1500, peclet: 2.8e6 }), hi = taylorCycle({ count: 1500, peclet: 1e8 });
  assert.ok(lo < 0.3 && hi > 0.85, `recovery ${lo}, ${hi}`);
  near(mid, 0.5, 0.15, "half recovery at the study's Peclet number");
});
test("Passive dye returns under reversal without diffusion; diffusion breaks it", () => {
  const run = (kappa) => {
    const s = new Spectral2(64, 64, { dyes: 1, kappa });
    const ux = new Float64Array(s.n), uy = new Float64Array(s.n);
    for (let j = 0; j < 64; j++) for (let i = 0; i < 64; i++) { ux[j * 64 + i] = Math.sin(j * s.dy); uy[j * 64 + i] = 0; }
    s.flow = { ux, uy };
    s.setField(1, (x, y) => Math.exp(2 * (Math.cos(x - 2) + Math.cos(y - 3)) - 4));
    const c0 = s.physical(1);
    for (let i = 0; i < 80; i++) s.step(0.02);
    s.flow = { ux: ux.map((v) => -v), uy };
    for (let i = 0; i < 80; i++) s.step(0.02);
    const c1 = s.physical(1);
    return Math.sqrt(c0.reduce((a, v, i) => a + (v - c1[i]) ** 2, 0) / c0.reduce((a, v) => a + v * v, 0));
  };
  assert.ok(run(0) < 1e-4, `no diffusion ${run(0)}`);
  assert.ok(run(0.02) > 0.05, `planted diffusion ${run(0.02)}`);
});
test("2D cascade: nonlinearity moves energy to larger scales and enstrophy to smaller; a frozen flow does not", () => {
  const make = () => {
    const s = new Spectral2(64, 64);
    let seed = 7;
    const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647, phases = Array.from({ length: 80 }, () => [6 + 6 * r(), 2 * Math.PI * r(), 2 * Math.PI * r()]);
    s.setField(0, (x, y) => phases.reduce((a, [k, th, ph]) => a + Math.cos(Math.round(k * Math.cos(th)) * x + Math.round(k * Math.sin(th)) * y + ph), 0) / 6);
    return s;
  };
  const centroid = (s) => { const E = s.spectrum(); let a = 0, b = 0; E.forEach((e, k) => { a += k * e; b += e; }); return a / b; };
  const s = make(), c0 = centroid(s), Z0 = s.enstrophy(), E0 = s.energy();
  const maxU = Math.sqrt(2 * E0) * 3;
  for (let i = 0; i < 300; i++) s.step(0.4 * s.dx / maxU);
  assert.ok(centroid(s) < 0.85 * c0, `energy centroid ${c0} to ${centroid(s)}`);
  near(s.energy() / E0, 1, 1e-3, "inviscid energy");
  near(s.enstrophy() / Z0, 1, 2e-2, "inviscid enstrophy before the cut-off is reached");
  const frozen = make();
  frozen.rhs = (st) => st.map(() => ({ re: new Float64Array(frozen.n), im: new Float64Array(frozen.n) }));
  for (let i = 0; i < 300; i++) frozen.step(0.01);
  near(centroid(frozen), c0, 1e-9, "planted: no nonlinearity, no transfer");
});
test("Spectrum sums to energy, and the slope reader returns a planted slope", () => {
  const s = vortexBox(64, 0, 1, 0.4), E = s.spectrum();
  near(E.reduce((a, b) => a + b, 0), s.energy(), 1e-12, "Parseval");
  const fake = Array.from({ length: 64 }, (_, k) => (k ? k ** (-5 / 3) : 0));
  near(spectralSlope(fake, 4, 30), -5 / 3, 1e-9, "planted -5/3");
  assert.ok(Math.abs(spectralSlope(fake.map((v, k) => v * (k ? k ** -0.5 : 1)), 4, 30) + 5 / 3) > 0.3, "planted steeper slope is told apart");
});
test("Frequency reader finds a planted tone", () => {
  const x = Array.from({ length: 800 }, (_, i) => Math.sin(2 * Math.PI * 0.164 * i * 0.1));
  near(dominantFrequency(x, 0.1), 0.164, 2e-3, "tone");
});
