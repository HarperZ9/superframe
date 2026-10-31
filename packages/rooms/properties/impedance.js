// SPDX-License-Identifier: FSL-1.1-MIT
// Impedance on the Smith chart. A line of length l rotates reflection about the centre, a shunt stub moves along a circle of
// constant conductance. A matched path compiles to microstrip on the PCB engine's stackups, with two checks: the transfer
// matrix at the design frequency, and the engine's time-domain line solver.
import { hammerstad } from "../solvers/pcb/formulas.js";
import { TLine } from "../solvers/pcb/tline.js";
import { RULES, STACKS } from "../solvers/pcb/constants.js";
import { instrument, propertyObject } from "./model.js";

const C0 = 299792458;
const cx = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1]],
  mul: (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]],
  div: (a, b) => {
    const d = b[0] ** 2 + b[1] ** 2;
    return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
  },
  abs: (a) => Math.hypot(a[0], a[1]),
};
const ONE = [1, 0];
export const gammaOf = (z) => cx.div(cx.sub(z, ONE), cx.add(z, ONE));
export const zOf = (g) => cx.div(cx.add(ONE, g), cx.sub(ONE, g));
const rot = (g, t) => cx.mul(g, [Math.cos(-2 * t), Math.sin(-2 * t)]);

export const IMPEDANCE = propertyObject({
  id: "impedance",
  name: "Impedance at one frequency",
  stateSpace: {
    name: "Passive reflection coefficients",
    shape: "unit disc",
    coordinates: { chosen: true, name: "Smith chart, reflection against the line impedance", note: "The disc depends on the reference impedance chosen, here the line's." },
  },
  operations: [
    { id: "line", name: "Rotate about the centre", element: "series length of line" },
    { id: "stub", name: "Move along a constant conductance circle", element: "open shunt stub" },
  ],
  fabrication: {
    route: "Copper microstrip on a fabricator's stackup, etched from Gerber files",
    limits: ["Minimum trace width of the stackup", "Etch and dielectric tolerance moves impedance", "Stub end fringe, junction and connector are not modelled"],
  },
});

/** The single shunt stub match, as lengths in radians at the design frequency. */
export function singleStub(zL) {
  const g0 = gammaOf(zL);
  const yAt = (t) => cx.div(ONE, zOf(rot(g0, t)));
  const N = 4000;
  let prev = yAt(0)[0] - 1;
  for (let i = 1; i <= N; i++) {
    const t = (i / N) * Math.PI,
      v = yAt(t)[0] - 1;
    if (v === 0 || prev * v < 0) {
      let a = ((i - 1) / N) * Math.PI,
        b = t;
      for (let k = 0; k < 60; k++) {
        const m = (a + b) / 2;
        if ((yAt(a)[0] - 1) * (yAt(m)[0] - 1) <= 0) b = m;
        else a = m;
      }
      const d = (a + b) / 2,
        y = yAt(d);
      let s = Math.atan(-y[1]);
      if (s < 0) s += Math.PI;
      const path = [
        { step: "load", gamma: g0 },
        { step: "line", gamma: rot(g0, d) },
        { step: "stub", gamma: gammaOf(cx.div(ONE, [y[0], y[1] + Math.tan(s)])) },
      ];
      return { line: d, stub: s, path };
    }
    prev = v;
  }
  return null;
}
/** Width for an impedance by bisection on the engine's Hammerstad formula. */
export function microstripWidth(Z0, h, er) {
  let a = h * 0.02,
    b = h * 20;
  for (let i = 0; i < 80; i++) {
    const m = Math.sqrt(a * b);
    if (hammerstad(m, h, er).z > Z0) a = m;
    else b = m;
  }
  const w = Math.sqrt(a * b);
  return { w, e: hammerstad(w, h, er).e };
}
function gammaByMatrix(zL, thetaLine, thetaStub) {
  // From the load to the feed, normalised to the line.
  const t = Math.tan(thetaLine);
  const zIn = cx.div(cx.add(zL, [0, t]), cx.add(ONE, cx.mul([0, t], zL)));
  const y = cx.add(cx.div(ONE, zIn), [0, Math.tan(thetaStub)]);
  return gammaOf(cx.div(ONE, y));
}
/** The engine's leapfrog on a branched graph: a pulse goes in, and reflection at f comes from the input voltage. */
export function gammaByLineSolver({ Z0, v, f, feedMm, lineMm, stubMm, loadR, loadC }) {
  const edges = [],
    C = [];
  let n = 0;
  const run = (from, mm, cellMm = 0.05) => {
    const m = Math.max(2, Math.round(mm / cellMm)),
      cell = mm / m,
      L = (Z0 / v) * cell * 1e-3,
      Cc = (cell * 1e-3) / (Z0 * v);
    let a = from;
    for (let i = 0; i < m; i++) {
      const b = ++n;
      edges.push({ a, b, L, R: 0 });
      C[a] = (C[a] || 0) + Cc / 2;
      C[b] = (C[b] || 0) + Cc / 2;
      a = b;
    }
    return a;
  };
  const junction = run(0, feedMm);
  const load = run(junction, lineMm);
  run(junction, stubMm);
  const tr = 0.2 / f;
  const tl = new TLine(n + 1, edges, Float64Array.from({ length: n + 1 }, (_, i) => C[i]), { Rs: Z0, src: 0, tr, loads: [{ n: load, R: loadR, C: loadC }], courant: 0.99 });
  const T = 60 / f,
    w = 2 * Math.PI * f;
  let re = 0,
    im = 0,
    ri = 0,
    ii = 0,
    prev = 0,
    prevInc = 0;
  while (tl.t < T) {
    tl.step();
    const V = tl.V[0],
      inc = 0.5 * Math.min(1, tl.t / tr);
    const h = 0.5 + 0.5 * Math.cos((Math.PI * tl.t) / T);
    const dV = (V - prev) * h,
      dI = inc - prevInc;
    prev = V;
    prevInc = inc;
    re += dV * Math.cos(w * tl.t);
    im -= dV * Math.sin(w * tl.t);
    ri += dI * Math.cos(w * tl.t);
    ii -= dI * Math.sin(w * tl.t);
  }
  return cx.sub(cx.div([re, im], [ri, ii]), ONE);
}
/** Compile a match of a parallel R and C load at frequency f to microstrip on stack `layers`. */
export function compileMatch({ R, Cload = 0, f, Z0 = 50, layers = 4 }) {
  const stack = STACKS[layers],
    rule = RULES[layers];
  const h = stack.diel[0];
  const { w, e } = microstripWidth(Z0, h, stack.er);
  const v = C0 / Math.sqrt(e),
    beta = (2 * Math.PI * f) / v;
  const Y = [1 / R, 2 * Math.PI * f * Cload];
  const zL = cx.mul(cx.div(ONE, Y), [1 / Z0, 0]);
  const m = singleStub(zL);
  if (!m) throw new Error("no single stub match for this load");
  const lineMm = (m.line / beta) * 1e3,
    stubMm = (m.stub / beta) * 1e3,
    feedMm = ((Math.PI / beta) * 1e3) | 0 || 10;
  const gM = gammaByMatrix(zL, m.line, m.stub);
  const gT = gammaByLineSolver({ Z0, v, f, feedMm, lineMm, stubMm, loadR: R, loadC: Cload });
  const widthOk = w >= rule.trace;
  const tracks = [
    { x1: 0, y1: 0, x2: feedMm, y2: 0, w, name: "feed" },
    { x1: feedMm, y1: 0, x2: feedMm + lineMm, y2: 0, w, name: "line" },
    { x1: feedMm, y1: 0, x2: feedMm, y2: stubMm, w, name: "open stub" },
  ];
  return instrument({
    property: IMPEDANCE.id,
    elements: tracks,
    path: m.path,
    verdict: {
      check: "Reflection at the feed, by transfer matrix and by the time-domain line solver",
      gammaMatrix: cx.abs(gM),
      gammaLineSolver: cx.abs(gT),
      widthRule: rule.trace,
      pass: cx.abs(gM) < 0.01 && cx.abs(gT) < 0.05 && widthOk,
    },
    limits: [{ what: "Trace width against the stackup's minimum", value: w, minimum: rule.trace }],
    unmodelled: ["Open end fringe and T junction", "Copper and dielectric loss", "Dispersion", "Connector"],
  });
}
