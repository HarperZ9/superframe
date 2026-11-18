// SPDX-License-Identifier: FSL-1.1-MIT
// Each property in the scene does what its core says, with known answers where the core has one.
//   node --test packages/world/tests/scene.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createScene } from "../scene.mjs";
import { hasTol } from "../scene-read.mjs";
import { PROPERTIES, BOARD, traceZ0 } from "../properties.mjs";
import { PROPERTY_IDS } from "../field.mjs";
import { hammerstad } from "../../rooms/solvers/pcb/formulas.js";
import { MATERIAL_RECORDS } from "../../rooms/core/constants.js";

const SMALL = { w: 2, h: 1.2, nx: 60, ny: 36, mmPerUnit: 100, stepsPerSecond: 60 };
const quiet = () => createScene({ size: SMALL }).set("water", { carries: { lens: 0, flow: 0 } }).set("voice", { carries: { sound: 0 } });

test("every property is a full record with its core named", () => {
  assert.deepEqual(Object.keys(PROPERTIES), [...PROPERTY_IDS]);
  for (const p of Object.values(PROPERTIES)) {
    assert.ok(p.stateSpace.coordinates.chosen && p.fabrication.limits.length && p.core.file && p.core.exports.length, p.id);
  }
});

test("lens: with nothing carrying it, light goes straight", () => {
  const s = quiet().set("glass", { carries: { lens: 0 } });
  for (const r of s.trace(9)) assert.ok(Math.abs(r.turn) < 1e-9, `turned ${r.turn}`);
});

test("lens: a Luneburg glass brings parallel light to a focus at its far rim", () => {
  const s = quiet(), g = s.elements.find((e) => e.id === "glass"), y0 = g.y;
  // rays a quarter of the radius off the axis cross it near x = centre + R (Luneburg 1944); the soft rim moves it a little
  const rays = 33, crossings = [];
  for (const r of s.trace(rays)) {
    const off = r.points[0][1] - y0; if (Math.abs(off) > 0.3 * g.radius || Math.abs(off) < 1e-6) continue;
    for (let i = 1; i < r.points.length; i++) { const a = r.points[i - 1], b = r.points[i]; if ((a[1] - y0) * (b[1] - y0) < 0) { crossings.push(a[0] + ((b[0] - a[0]) * (y0 - a[1])) / (b[1] - a[1])); break; } }
  }
  assert.ok(crossings.length >= 2, "paraxial rays cross the axis");
  for (const x of crossings) assert.ok(Math.abs(x - (g.x + g.radius)) < g.edge + 0.04, `crossed at ${x.toFixed(3)}, rim at ${(g.x + g.radius).toFixed(3)}`);
});

test("lens: water alone has the index of water from the constants table", () => {
  const s = createScene({ size: SMALL }).set("voice", { carries: { sound: 0 } }).set("water", { carries: { flow: 0 } });
  assert.ok(Math.abs(Math.sqrt(s.n2Point(1.3, 0.6)) - MATERIAL_RECORDS.water.nd.value) < 1e-6);
});

test("flow: the stir carries dye, and outside the water the water stays still", () => {
  const s = createScene({ size: SMALL }).set("voice", { carries: { sound: 0 } });
  for (let i = 0; i < 90; i++) s.step();
  const { nx, ny, w } = s.size, hc = w / nx;
  let inside = 0, outside = 0, fast = 0;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, d = Math.hypot((i + 0.5) * hc - 1.3, (j + 0.5) * hc - 0.6), sp = Math.hypot(s.g.u[k], s.g.v[k]);
    if (d < 0.25) { inside += s.g.dye[k]; fast = Math.max(fast, sp); } else if (d > 0.6) outside = Math.max(outside, sp);
  }
  assert.ok(inside > 1 && fast > 0.05, `dye ${inside}, fastest ${fast}`);
  assert.ok(outside < 0.02 * fast, `outside the water the flow is ${outside}, inside ${fast}`);
});

test("measure: nothing carrying it reads nothing; the probe reads water's index and states it is simulated", () => {
  const off = quiet().set("probe", { carries: { measure: 0 } }).read();
  assert.equal(off.readings.length, 0); assert.match(off.label, /nothing is read/);
  const s = createScene({ size: SMALL }).set("voice", { carries: { sound: 0 } }).set("water", { carries: { flow: 0 } }), r = s.read();
  assert.ok(Math.abs(r.readings.find((q) => q.id === "n").value - 1.333) < 1e-3);
  assert.equal(r.instrument.state, "potential"); assert.match(r.label, /^potential\. Bench verdict: pass/);
});

test("shape: still water is dimensioned at its diameter, every dimension toleranced by the CAD core's rule", () => {
  const s = createScene({ size: SMALL }).set("voice", { carries: { sound: 0 } }).set("water", { carries: { flow: 0 } }), d = s.dims();
  const want = 2 * 0.36 * 100;
  for (const dim of d.dims) { assert.ok(Math.abs(dim.value - want) < dim.tol.pm + 2, `${dim.id} ${dim.value} against ${want}`); assert.ok(hasTol(dim.tol)); }
  assert.equal(createScene({ size: SMALL }).set("water", { carries: { shape: 0 } }).dims(), null, "nothing carrying shape has no dimensions");
  const { C } = createRequire(import.meta.url)("../../diagram/cad/load.js");
  for (const t of [{ pm: 0.1 }, { plus: 0.1, minus: 0 }, { plus: 0.1 }, { basic: true }, { ref: true }, { limits: [1, 2] }, { limits: [1] }, {}, null, undefined])
    assert.equal(hasTol(t), C.hasTol(t), `the copy of hasTol agrees with the CAD core on ${JSON.stringify(t)}`);
});

test("sound: no voice, no wave; a voice sends one that reaches the probe", () => {
  const quietS = createScene({ size: SMALL }).set("voice", { carries: { sound: 0 } });
  for (let i = 0; i < 40; i++) quietS.step();
  assert.equal(Math.max(...quietS.wave.p.map(Math.abs)), 0);
  const loud = createScene({ size: SMALL });
  let peak = 0;
  for (let i = 0; i < 120; i++) { loud.step(); peak = Math.max(peak, Math.abs(loud.read().readings.find((q) => q.id === "pressure").value)); }
  assert.ok(peak > 0.05, `peak at the probe ${peak}`);
});

test("circuit: the trace on the full board is Hammerstad's 50 ohm line; on air it is higher", () => {
  assert.equal(traceZ0(1, 1), hammerstad(BOARD.w, BOARD.h, BOARD.er).z);
  assert.ok(Math.abs(traceZ0(1, 1) - 50) < 1.5 && traceZ0(1, 0) > 85);
});

test("the scene says what it shows in words", () => {
  const text = createScene({ size: SMALL }).describe();
  assert.match(text, /Light enters from the left in 17 rays/); assert.match(text, /Refraction is carried by glass at 100 percent/);
  assert.match(text, /reads index/); assert.match(text, /mm ± /); assert.ok(!/—/.test(text), "no em dash");
});
