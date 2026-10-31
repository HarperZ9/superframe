// Cases: starts, drives and readouts per case. Each sets the solver's terms and nothing else.
const TAU = 2 * Math.PI, lump = (X, Y, r) => Math.exp(-(X * X + Y * Y) / (r * r));
const wrap = (d) => ((d + Math.PI) % TAU + TAU) % TAU - Math.PI;
const stripes = (n) => (x, y) => { const s = Math.sin(n * x + 0.5 * Math.sin(y)) > 0; return s ? [1, 0, 0, 1] : [0, 0, 0, 1]; };
const combed = (x, y) => {
  const b = Math.floor((x / TAU) * 12) % 3;
  return [b === 0 ? 1 : 0, b === 1 ? 1 : 0, b === 2 ? 1 : 0, 1];
};
const noiseField = (seed, a, kmax) => {
  let s = seed;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647, m = Array.from({ length: 60 }, () => [Math.round((2 * r() - 1) * kmax), Math.round((2 * r() - 1) * kmax), TAU * r(), (2 * r() - 1) * a]);
  return (x, y) => m.reduce((t, [kx, ky, ph, A]) => t + A * Math.sin(kx * x + ky * y + ph), 0);
};
const CASES = {
  marble: { label: "Marbling: a stirred stripe", nu: 3e-4, dt: 1, view: 3, gain: 0.25, note: "Dye moves by a display transport with its own numerical blur. Reverse time shows how far the wound stripes return.", start(g) { g.drive = 0; g.setVorticity((x, y) => noiseField(3, 0.35, 3)(x, y)); g.setDye(combed); } },
  tg: { label: "Taylor-Green decay, checked", nu: 0.02, dt: 1, view: 0, gain: 0.5, note: "Energy has a closed form here: the readout shows the ratio to it.", exact: (t, nu) => 0.25 * Math.exp(-4 * nu * t), start(g) { g.setVorticity((x, y) => 2 * Math.sin(x) * Math.sin(y)); g.setDye(stripes(6)); } },
  kolmogorov: { label: "Kolmogorov flow", nu: 0.02, dt: 1, view: 0, gain: 0.25, note: "Held by sin(4y) forcing. On this square box the first long-wave mode is k = 1, and the band above sqrt 2 only opens at long wavelength.", start(g) { const kf = 4, A = 4; g.kf = kf; g.drive = -0.5 * A * g.nu * kf * kf * g.N * g.N; const n = noiseField(5, 0.02, 6); g.setVorticity((x, y) => -A * Math.cos(kf * y) + n(x, y)); g.setDye(stripes(4)); } },
  shear: { label: "Shear layers roll up", nu: 2e-4, dt: 1, view: 0, gain: 0.12, note: "The double shear layer. Thin layers need the finest grid.", start(g) { g.setVorticity((x, y) => (Math.exp(-(((y - Math.PI / 2) / 0.12) ** 2)) - Math.exp(-(((y - 1.5 * Math.PI) / 0.12) ** 2))) * (8 + 0.8 * Math.cos(3 * x))); g.setDye((x, y) => (y > Math.PI / 2 && y < 1.5 * Math.PI ? [1, 0, 0, 1] : [0, 0, 1, 1])); } },
  turb: { label: "Decaying 2D turbulence", nu: 1e-4, dt: 1, view: 0, gain: 0.22, note: "With no third dimension, energy moves to large scales and vortices merge. Compare the 3D cases.", start(g) { const n = noiseField(11, 2.2, 22); g.setVorticity(n); g.setDye(combed); } },
  bowl: { label: "Bowl with a drain", nu: 0.003, dt: 0.5, view: 3, gain: 0.12, note: "2D model. Wall: Brinkman penalty. Drain: fixed sink disc and source ring. Not modelled: free surface, air core, floor. Its stretching is a divergence in the plane.", bowl: true, start(g) {
    const sim = bowl({ N: g.N, nu: g.nu, a: 1.2, R: 0.45, Rw: 2.7, V: 1.2, eta: 0.06, wallWidth: 0.14, dyes: 0 });
    const fx = centredDiv(sim.flow, g.N);
    g.setStatics({ ux: sim.flow.ux, uy: sim.flow.uy, div: fx }, sim.wall);
    g.setVorticity((x, y) => 0.1 * Math.sin(x + 2 * y) + 0.05 * lump(wrap(x - 2), wrap(y - 3), 0.6));
    g.setDye((x, y) => { const a = Math.atan2(y - Math.PI, x - Math.PI), b = Math.floor(((a + Math.PI) / TAU) * 12) % 3, r = Math.hypot(x - Math.PI, y - Math.PI); return r > 2.7 ? [0, 0, 0, 1] : [b === 0 ? 1 : 0, b === 1 ? 1 : 0, b === 2 ? 1 : 0, 1]; });
  } },
  tg3: { label: "3D: Taylor-Green, vortex stretching", three: "tg", nu: 1 / 400, n: 32, view: 0, note: "CPU reference in a worker, 32 cubed. Resolution runs out at high Re: watch the spectrum tail rise." },
  link3: { label: "3D: linked vortex rings, helicity", three: "linked", nu: 2e-3, n: 32, view: 2, note: "Two linked rings. Helicity reads 2 Lk Gamma squared, within the coarse core this grid allows." },
};
/** Divergence of the fixed flow on the grid, spectral, as the plane's stretching term. */
function centredDiv(flow, N) {
  const re = Float64Array.from(flow.ux), im = Float64Array.from(flow.uy);
  fft2d(re, im, N, N);
  const dr = new Float64Array(N * N), di = new Float64Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const q = j * N + i, kx = waveInt(i, N), ky = waveInt(j, N), q2 = ((N - j) % N) * N + (N - i) % N;
    const ax = 0.5 * (re[q] + re[q2]), bx = 0.5 * (im[q] - im[q2]), ay = 0.5 * (im[q] + im[q2]), by = 0.5 * (re[q2] - re[q]);
    dr[q] = -kx * bx - ky * by; di[q] = kx * ax + ky * ay;
  }
  ifft2d(dr, di, N, N);
  return dr;
}
