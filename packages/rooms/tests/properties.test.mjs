import test from "node:test";
import { assert, near } from "./h.mjs";
import { instrument, plainLabel, POTENTIAL, MEASURED, propertyObject, recordMeasurement } from "../properties/model.js";
import { POLARISATION, compilePath, rotateOnSphere, plateFor, stokes, jonesOf, applyJones } from "../properties/polarisation.js";
import { retarder } from "../core/film.js";
import { IMPEDANCE, compileMatch, gammaOf, zOf, singleStub, microstripWidth, gammaByLineSolver } from "../properties/impedance.js";
import { hammerstad } from "../solvers/pcb/formulas.js";

const H = [1, 0, 0], D = [0, 1, 0], R = [0, 0, 1], V = [-1, 0, 0];

test("a property must mark its coordinates as chosen and state its limits", () => {
  const ok = { id: "x", name: "x", stateSpace: { name: "s", shape: "disc", coordinates: { chosen: true, name: "c" } }, operations: [], fabrication: { route: "r", limits: ["l"] } };
  assert.ok(propertyObject(ok));
  assert.throws(() => propertyObject({ ...ok, stateSpace: { ...ok.stateSpace, coordinates: { name: "c" } } }), /chosen/);
  assert.throws(() => propertyObject({ ...ok, fabrication: { route: "r", limits: [] } }), /limits/);
  assert.equal(POLARISATION.stateSpace.coordinates.chosen, true);
  assert.equal(IMPEDANCE.stateSpace.coordinates.chosen, true);
});
test("an instrument stays potential on a passing verdict; only a measured part changes that", () => {
  const i = instrument({ property: "x", elements: [], path: [], verdict: { check: "c", pass: true } });
  assert.equal(i.state, POTENTIAL);
  assert.equal(plainLabel(i), "potential. Bench verdict: pass on c.");
  assert.throws(() => recordMeasurement(i, { part: "p" }), /missing/);
  const m = recordMeasurement(i, { part: "p", instrument: "meter", reading: 1, by: "a", date: "d" });
  assert.equal(m.state, MEASURED);
  assert.equal(i.state, POTENTIAL);
});
test("a plate is a rotation of the sphere: the drawing agrees with Jones matrices", () => {
  for (const [G, a, s] of [[Math.PI / 2, 0.2, [0.6, 0, 0.8]], [Math.PI, 0.7, D], [1.1, -0.3, R]]) {
    const out = stokes(applyJones(retarder(G, a), jonesOf(s))),
      rot = rotateOnSphere(s, G, a);
    for (let i = 0; i < 3; i++) near(out[i], rot[i], 1e-12, `component ${i}`);
  }
});
test("known plates: quarter wave at 45 degrees takes H to circular; half wave takes H to V", () => {
  const q = rotateOnSphere(H, Math.PI / 2, Math.PI / 4);
  near(Math.abs(q[2]), 1, 1e-12, "circular");
  const h = rotateOnSphere(H, Math.PI, Math.PI / 4);
  near(h[0], -1, 1e-12, "V");
});
test("a path on the sphere compiles to a quartz stack with a checked Jones result", () => {
  const t = 0.9;
  const ins = compilePath([H, [Math.cos(t), 0, Math.sin(t)], R, D, V]);
  assert.equal(ins.verdict.pass, true, JSON.stringify(ins.verdict));
  near(ins.verdict.fidelity, 1, 1e-9, "fidelity");
  assert.equal(ins.elements.length, 4);
  for (const p of ins.elements) assert.ok(p.thickness >= 5e4, `thickness ${p.thickness}`);
  assert.equal(ins.state, POTENTIAL);
  assert.ok(ins.limits[0].value < 1, "a multi-order stack is not achromatic, and the record says how far it falls");
});
test("planted: a stack with one wrong plate fails its verdict", () => {
  const ins = compilePath([H, R]);
  const p = ins.elements[0];
  const E = applyJones(retarder(p.retardance + 0.2, p.azimuth), jonesOf(H));
  const s = stokes(E);
  assert.ok((1 + s[2]) / 2 < 1 - 1e-3);
  assert.ok(Math.abs(plateFor(H, R).retardance) > 0);
});

test("Smith: gamma and z invert; 100 ohm on 50 has gamma one third", () => {
  near(gammaOf([2, 0])[0], 1 / 3, 1e-15, "gamma");
  const z = zOf(gammaOf([0.4, -1.3]));
  near(z[0], 0.4, 1e-12, "r");
  near(z[1], -1.3, 1e-12, "x");
});
test("Smith: single stub match lands at the centre", () => {
  for (const z of [[2, 0], [0.5, 0.8], [0.25, -1]]) {
    const m = singleStub(z);
    const end = m.path[m.path.length - 1].gamma;
    near(Math.hypot(end[0], end[1]), 0, 1e-9, `z ${z}`);
    near(Math.hypot(...m.path[1].gamma), Math.hypot(...m.path[0].gamma), 1e-12, "a line keeps the radius");
  }
});
test("microstrip width gives its impedance on the engine's formula", () => {
  const { w } = microstripWidth(50, 0.1999, 3.61);
  near(hammerstad(w, 0.1999, 3.61).z, 50, 1e-6, "Z0");
});
test("a matched path compiles to microstrip: both checks agree the reflection is small", () => {
  const ins = compileMatch({ R: 100, Cload: 0.4e-12, f: 2.4e9 });
  assert.equal(ins.verdict.pass, true, JSON.stringify(ins.verdict));
  assert.ok(ins.verdict.gammaMatrix < 1e-6, "matrix");
  assert.ok(ins.verdict.gammaLineSolver < 0.05, `line solver ${ins.verdict.gammaLineSolver}`);
  assert.equal(ins.elements.length, 3);
  assert.equal(ins.state, POTENTIAL);
  assert.match(plainLabel(ins), /^potential/);
});
test("the line solver alone reads an unmatched load's reflection", () => {
  const v = 1.6e8;
  const g = gammaByLineSolver({ Z0: 50, v, f: 2.4e9, feedMm: 30, lineMm: 10, stubMm: 0.01, loadR: 150, loadC: 0 });
  near(Math.hypot(g[0], g[1]), 0.5, 0.03, "(150-50)/(150+50)");
});
test("planted: the same stub lengths at another frequency are no longer matched", () => {
  const ins = compileMatch({ R: 100, Cload: 0.4e-12, f: 2.4e9 });
  const [feed, line, stub] = ins.elements;
  const lenLine = line.x2 - line.x1,
    lenStub = stub.y2 - stub.y1;
  const v = 299792458 / Math.sqrt(hammerstad(line.w, 0.1999, 3.61).e);
  const g = gammaByLineSolver({ Z0: 50, v, f: 3.2e9, feedMm: feed.x2, lineMm: lenLine, stubMm: lenStub, loadR: 100, loadC: 0.4e-12 });
  assert.ok(Math.hypot(g[0], g[1]) > 0.15, `off-frequency ${Math.hypot(g[0], g[1])}`);
});
