// SPDX-License-Identifier: MIT
// scene-read.mjs: what the measure and shape properties take from a scene. Measurement is a weighted read over
// everything that carries it, so a probe reads a point and a body of water given the property reads itself whole.
// Shape dimensions what carries it by its second moments, and every dimension carries a tolerance or it is refused,
// by the rule of the CAD core (packages/diagram/cad/src/param.js, C.hasTol; tests/parity.test.mjs holds this copy to it).
import { CORES } from "./properties.mjs";

// The CAD core's rule, word for word: a dimension has plus-minus, unilateral, basic, reference or limits.
export const hasTol = (t) => !!t && (t.pm !== undefined || (t.plus !== undefined && t.minus !== undefined) || t.basic === true || t.ref === true || (Array.isArray(t.limits) && t.limits.length === 2));

const fmt = (v, d) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(d));
// [id, name, unit, decimals, value at cell k]
function quantities(s, traceZ0) {
  const { g, size: { nx, w, mmPerUnit, stepsPerSecond } } = s, hc = w / nx;
  const grad = (k) => { const i = k % nx, gx = (g.n2[Math.min(k + 1, g.n2.length - 1)] - g.n2[Math.max(k - 1, 0)]) / (2 * hc), gy = (g.n2[Math.min(k + nx, g.n2.length - 1)] - g.n2[Math.max(k - nx, 0)]) / (2 * hc); return i === 0 || i === nx - 1 ? 0 : Math.hypot(gx, gy) / 2; };
  return [
    ["n", "index", "", 3, (k) => Math.sqrt(g.n2[k])],
    ["grad", "index gradient", "per 100 mm", 2, grad],
    ["speed", "flow speed", "mm/s", 1, (k) => Math.hypot(g.u[k], g.v[k]) * hc * mmPerUnit * stepsPerSecond],
    ["dye", "dye", "of full", 2, (k) => g.dye[k]],
    ["pressure", "sound pressure", "of the drive", 2, (k) => s.wave.p[k] / 0.05],
    ["z0", "trace impedance", "ohm", 1, (k) => traceZ0(g.n2[k], g.s.circuit[k])],
  ];
}

export function measureField(s, { traceZ0 }) {
  const W = s.g.s.measure, n = W.length;
  let sum = 0, sq = 0, circ = 0;
  for (let k = 0; k < n; k++) { sum += W[k]; sq += W[k] * W[k]; circ += W[k] * s.g.s.circuit[k]; }
  const ids = s.els.filter((e) => e.carries.measure > 0).map((e) => e.id);
  if (sum < 1e-9) return { readings: [], weight: 0, nEff: 0, instrument: null, label: "Nothing carries measurement, so nothing is read." };
  const readings = quantities(s, traceZ0).map(([id, name, unit, d, at]) => {
    let m = 0;
    for (let k = 0; k < n; k++) if (W[k]) m += W[k] * at(k);
    m /= sum;
    let v = 0;
    for (let k = 0; k < n; k++) if (W[k]) { const e = at(k) - m; v += W[k] * e * e; }
    const spread = Math.sqrt(v / sum), show = id !== "z0" || circ / sum > 1e-3;
    return { id, name, value: m, spread, unit, show, text: `${fmt(m, d)}${unit ? ` ${unit}` : ""} (spread ${fmt(spread, d)})` };
  });
  const finite = readings.every((r) => Number.isFinite(r.value));
  const ins = CORES.instrument({ property: "measure", elements: ids, path: "a weighted read over the measuring region", verdict: { check: "every reading is a finite number", pass: finite }, limits: ["simulated, not a measured part"] });
  return { readings, weight: sum * (s.size.w / s.size.nx) ** 2, nEff: (sum * sum) / sq, instrument: ins, label: CORES.plainLabel(ins) };
}

// Second moments of q = shape strength, with dye adding mass where the flow carries it.
export function dimsOf(s) {
  const { g, els, size: { nx, ny, w, mmPerUnit } } = s, hc = w / nx;
  let M = 0, mx = 0, my = 0;
  const q = (k) => g.s.shape[k] * (1 + g.dye[k] * g.s.flow[k]);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const m = q(j * nx + i); M += m; mx += m * (i + 0.5); my += m * (j + 0.5); }
  if (M < 1e-6) return null;
  mx /= M; my /= M;
  let xx = 0, yy = 0, xy = 0;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const m = q(j * nx + i), dx = i + 0.5 - mx, dy = j + 0.5 - my; xx += m * dx * dx; yy += m * dy * dy; xy += m * dx * dy; }
  xx = xx / M + 1 / 12; yy = yy / M + 1 / 12; xy /= M;   // + 1/12: each cell is a square, not a point
  const tr = (xx + yy) / 2, det = Math.sqrt(Math.max(0, ((xx - yy) / 2) ** 2 + xy * xy)), l1 = tr + det, l2 = Math.max(0, tr - det);
  const angle = 0.5 * Math.atan2(2 * xy, xx - yy), carriers = els.filter((e) => e.carries.shape > 0), wsum = carriers.reduce((a, e) => a + e.carries.shape, 0);
  const rim = wsum ? carriers.reduce((a, e) => a + e.carries.shape * e.edge, 0) / wsum : 0, pm = (0.5 * hc + 0.25 * rim) * mmPerUnit;
  const dim = (id, label, units) => { const value = units * mmPerUnit, d = { id, label, value, unit: "mm", tol: { pm }, text: `${value.toFixed(0)} mm ± ${pm.toFixed(1)}` }; if (!hasTol(d.tol)) throw new Error(`shape: ${id} has no tolerance`); return d; };
  const major = dim("major", "long diameter", 4 * Math.sqrt(l1) * hc), minor = dim("minor", "short diameter", 4 * Math.sqrt(l2) * hc);
  return { centroid: [mx * hc, my * hc], angle, major, minor, area: M * hc * hc * mmPerUnit * mmPerUnit, dims: [major, minor] };
}
