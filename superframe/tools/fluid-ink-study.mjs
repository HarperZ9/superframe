// fluid-ink-study.mjs: the pre-registered test in docs/prereg/FLUID-INK-PREREG.md. Does a
// simulated thin-layer viscous flow (lib/fluid/stokes.mjs) move ink the way the bath's closed-form maps do?
//   node tools/fluid-ink-study.mjs [OUT.json]
import { writeFileSync } from 'node:fs';
import { makeGrid, sourceKernel, forceKernel, drop, tine, torusOffset as off } from '../lib/fluid/stokes.mjs';
import { provenance } from '../lib/marble/bath.mjs';

const W = 0.004, LAM = 0.04, g = makeGrid(256);
const SK = sourceKernel(g, { w: W }), FK = forceKernel(g, { w: W, lambda: LAM }), FK0 = forceKernel(g, { w: W, lambda: Infinity });
const median = a => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
const ring = (c, rho, n = 16) => Array.from({ length: n }, (_, a) => [c + rho * Math.cos(2 * Math.PI * a / n + 0.1), c + rho * Math.sin(2 * Math.PI * a / n + 0.1)]);
const out = {};

// P1: drop against sqrt(rho^2 + r^2), error against r (expect slope -2 from the periodic sink)
const RHOS = [0.02, 0.03, 0.05, 0.08, 0.12, 0.2];
out.P1 = [0.04, 0.06, 0.08, 0.12].map(r => {
  const errs = [];
  for (const rho of RHOS) {
    if (rho < 3 * W) continue;
    const P = ring(0.5, rho); drop(g, P, { cx: 0.5, cy: 0.5, r, steps: 2000, kernel: SK });
    for (const p of P) { const R = Math.hypot(off(p[0] - 0.5), off(p[1] - 0.5)), pred = Math.sqrt(rho * rho + r * r); errs.push(Math.abs(R - pred) / pred); }
  }
  return { r, median_rel_err: median(errs), max_rel_err: Math.max(...errs) };
});
{ const x = out.P1.map(e => Math.log(e.r)), y = out.P1.map(e => Math.log(e.median_rel_err)), mx = x.reduce((a, b) => a + b) / x.length, my = y.reduce((a, b) => a + b) / y.length;
  out.P1_slope = x.reduce((a, v, i) => a + (v - mx) * (y[i] - my), 0) / x.reduce((a, v) => a + (v - mx) ** 2, 0); }

// P2, P3: tine profile against z exp(-|d| / lambda), z predicted, nothing fitted
const DS = []; for (let d = 3 * W; d <= 5 * LAM + 1e-9; d += 0.004) DS.push(d);
function tineProfile(zOverLam, kernel = FK, lambda = LAM) {
  const z = zOverLam * LAM, P = DS.flatMap(d => [[0.3, 0.5 + d], [0.7, 0.5 - d]]), S = P.map(p => [...p]);
  tine(g, P, { y0: 0.5, z, lambda, kernel, steps: 1000 });
  return DS.map((d, i) => { const a = off(P[2 * i][0] - S[2 * i][0]), b = off(P[2 * i + 1][0] - S[2 * i + 1][0]), pred = z * Math.exp(-d / LAM); return { d, dx: (a + b) / 2, pred, rel: ((a + b) / 2 - pred) / pred }; });
}
const prof = {};
for (const q of [0.25, 0.5, 1, 2]) prof[q] = tineProfile(q);
out.P2 = { z_over_lambda: [0.25, 0.5], median_rel_err: [0.25, 0.5].map(q => median(prof[q].map(r => Math.abs(r.rel)))) };
out.P3 = [0.25, 0.5, 1, 2].map(q => ({ z_over_lambda: q, median_rel_err: median(prof[q].map(r => Math.abs(r.rel))), at_d_3w: prof[q][0].rel }));
out.P2_profile_half = prof[0.5].filter((_, i) => i % 5 === 0);

// P4: area of tracer triangles after a drop then a tine (triangles not containing the drop centre)
{
  const n = 41, a = 0.3, b = 0.7, step = (b - a) / (n - 1), G0 = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) G0.push([a + i * step, a + j * step]);
  const G = G0.map(p => [...p]);
  drop(g, G, { cx: 0.5, cy: 0.5, r: 0.06, steps: 2000, kernel: SK });
  tine(g, G, { y0: 0.53, z: 0.02, lambda: LAM, kernel: FK, steps: 1000 });
  const area = (P, i, j, k) => 0.5 * Math.abs(off(P[j][0] - P[i][0]) * off(P[k][1] - P[i][1]) - off(P[k][0] - P[i][0]) * off(P[j][1] - P[i][1]));
  const ratios = [], ratiosFar = [];
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
    const p = j * n + i, q = p + 1, s = p + n, t = s + 1;
    const cx = a + (i + 0.5) * step, cy = a + (j + 0.5) * step;
    if (Math.hypot(cx - 0.5, cy - 0.5) < 2 * step) continue;           // skip cells around the source itself
    for (const [x, y, z] of [[p, q, s], [q, t, s]]) { const r = area(G, x, y, z) / area(G0, x, y, z); ratios.push(Math.abs(r - 1)); }
  }
  out.P4 = { median_abs_area_change: median(ratios), sink_prediction: Math.PI * 0.06 * 0.06, note: 'uniform sink of the periodic domain contracts all area by about pi r^2 / L^2' };
  // the same with the uniform sink's contraction divided out, to separate it from the flow's own error
  out.P4.median_abs_area_change_sink_removed = median(ratios.map(v => Math.abs((1 - v) / (1 - Math.PI * 0.0036) - 1)));
}

// P5: reversibility: forward drop + tine, then the same forcing backward
{
  const P0 = []; for (let i = 0; i < 400; i++) P0.push([0.2 + 0.6 * ((i * 0.618034) % 1), 0.2 + 0.6 * ((i * 0.381966 + 0.5) % 1)]);
  const P = P0.map(p => [...p]);
  drop(g, P, { cx: 0.5, cy: 0.5, r: 0.06, steps: 2000, kernel: SK }); tine(g, P, { y0: 0.53, z: 0.02, lambda: LAM, kernel: FK, steps: 1000 });
  tine(g, P, { y0: 0.53, z: 0.02, lambda: LAM, kernel: FK, steps: 1000, sign: -1 }); drop(g, P, { cx: 0.5, cy: 0.5, r: 0.06, steps: 2000, kernel: SK, sign: -1 });
  const e = P.map((p, i) => Math.hypot(off(p[0] - P0[i][0]), off(p[1] - P0[i][1])));
  out.P5 = { median_return_err: median(e), max_return_err: Math.max(...e) };
}

// P6: the ink pattern of 3 drops and 2 tines, closed form (bath.mjs provenance) against the fluid, per pixel at 128^2
const OPS = [
  { kind: 'drop', src: 0, cx: 0.42, cy: 0.45, r: 0.12 }, { kind: 'drop', src: 1, cx: 0.6, cy: 0.55, r: 0.1 }, { kind: 'drop', src: 2, cx: 0.48, cy: 0.62, r: 0.08 },
  { kind: 'tine', bx: 0, by: 0.5, mx: 1, my: 0, z: 0.02, u: Math.exp(-1 / LAM) }, { kind: 'tine', bx: 0.5, by: 0, mx: 0, my: 1, z: -0.02, u: Math.exp(-1 / LAM) },
].map(o => (o.kind === 'drop' ? { ...o, r2: o.r * o.r } : o));
const PIX = 128, STEPS = { drop: 600, tine: 500 };
function fluidLabel(x, y) {
  const p = [[x, y]];
  for (let q = OPS.length - 1; q >= 0; q--) {
    const op = OPS[q];
    if (op.kind === 'tine') { tine(g, p, op.mx === 1 ? { dir: 'x', y0: op.by, z: op.z, lambda: LAM, kernel: FK, steps: STEPS.tine, sign: -1 } : { dir: 'y', x0: op.bx, z: op.z, lambda: LAM, kernel: FK, steps: STEPS.tine, sign: -1 }); continue; }
    if (Math.hypot(off(p[0][0] - op.cx), off(p[0][1] - op.cy)) <= op.r) return op.src;
    drop(g, p, { cx: op.cx, cy: op.cy, r: op.r, kernel: SK, steps: STEPS.drop, sign: -1 });
  }
  return -1;
}
// C3: ink spread by diffusion in place of transport: drops placed as disks, no tines, then 20 diffusion steps
function diffusedLabels() {
  const fr = OPS.filter(o => o.kind === 'drop').map(o => { const f = new Float64Array(PIX * PIX); for (let j = 0; j < PIX; j++) for (let i = 0; i < PIX; i++) f[j * PIX + i] = Math.hypot((i + 0.5) / PIX - o.cx, (j + 0.5) / PIX - o.cy) <= o.r ? 1 : 0; return f; });
  for (let it = 0; it < 20; it++) for (const f of fr) { const c = Float64Array.from(f); for (let j = 0; j < PIX; j++) for (let i = 0; i < PIX; i++) { const at = (a, b) => c[((b + PIX) % PIX) * PIX + ((a + PIX) % PIX)]; f[j * PIX + i] = (at(i, j) * 4 + at(i - 1, j) + at(i + 1, j) + at(i, j - 1) + at(i, j + 1)) / 8; } }
  return Array.from({ length: PIX * PIX }, (_, p) => { let best = -1, bv = 0.5; fr.forEach((f, k) => { if (f[p] >= bv) { bv = f[p]; best = k; } }); return best; });
}
{
  const t0 = Date.now(), closed = [], fluid = [];
  for (let j = 0; j < PIX; j++) for (let i = 0; i < PIX; i++) { const x = (i + 0.5) / PIX, y = (j + 0.5) / PIX; closed.push(provenance({ ops: OPS }, x, y).src); fluid.push(fluidLabel(x, y)); }
  const agree = (A, B) => { let n = 0, m = 0; A.forEach((a, k) => { if (a >= 0 || B[k] >= 0) { n++; if (a === B[k]) m++; } }); return m / n; };
  const diff = diffusedLabels();
  // where the disagreements sit: distance to the nearest tine path, in stylus widths
  const near = []; closed.forEach((a, k) => { if (a !== fluid[k] && (a >= 0 || fluid[k] >= 0)) { const x = ((k % PIX) + 0.5) / PIX, y = (Math.floor(k / PIX) + 0.5) / PIX; near.push(Math.min(Math.abs(y - 0.5), Math.abs(x - 0.5)) / W); } });
  out.P6 = { pixels: PIX * PIX, agreement_over_ink: agree(closed, fluid), disagreements: near.length, disagreements_within_2w_of_tine: near.filter(v => v <= 2).length, seconds: (Date.now() - t0) / 1000 };
  out.C3 = { agreement_over_ink: agree(closed, diff) };
  out.P6_maps = { closed, fluid };
}

// C1: a compressible radial push of constant speed (same displacement at rho = r) against the drop map
{
  const r = 0.06, push = (Math.SQRT2 - 1) * r, errs = [], areas = [];
  for (const rho of RHOS) { const pred = Math.sqrt(rho * rho + r * r); errs.push(Math.abs(rho + push - pred) / pred); areas.push(Math.abs(((rho + push) / rho) - 1)); }
  out.C1 = { median_rel_err: median(errs), median_area_change: median(areas) };   // radial push: area ratio (rho + push) / rho per unit angle-width strip
}

// C2: no floor friction (plain 2D Stokes, mean flow removed): does the tine profile still fit an exponential?
{
  const P = tineProfile(0.5, FK0, Infinity).filter(r => r.dx > 0);
  const x = P.map(r => r.d), y = P.map(r => Math.log(r.dx)), mx = x.reduce((a, b) => a + b) / x.length, my = y.reduce((a, b) => a + b) / y.length;
  const b = x.reduce((a, v, i) => a + (v - mx) * (y[i] - my), 0) / x.reduce((a, v) => a + (v - mx) ** 2, 0), c = my - b * mx;
  const ssr = y.reduce((a, v, i) => a + (v - (c + b * x[i])) ** 2, 0), sst = y.reduce((a, v) => a + (v - my) ** 2, 0);
  const Pf = prof[0.5], yf = Pf.map(r => Math.log(r.dx)), xf = Pf.map(r => r.d), mxf = xf.reduce((a, v) => a + v) / xf.length, myf = yf.reduce((a, v) => a + v) / yf.length;
  const bf = xf.reduce((a, v, i) => a + (v - mxf) * (yf[i] - myf), 0) / xf.reduce((a, v) => a + (v - mxf) ** 2, 0), cf = myf - bf * mxf;
  const r2f = 1 - yf.reduce((a, v, i) => a + (v - (cf + bf * xf[i])) ** 2, 0) / yf.reduce((a, v) => a + (v - myf) ** 2, 0);
  out.C2 = { positive_points: P.length, of: DS.length, r2_log_exponential_no_friction: 1 - ssr / sst, r2_log_exponential_with_friction: r2f, fitted_decay_length_with_friction: -1 / bf };
}

const { P6_maps, ...summary } = out;
console.log(JSON.stringify(summary, null, 1));
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(out));
