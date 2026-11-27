// SPDX-License-Identifier: MIT
// The field's kernel against its BuildLang source of record, the element rules, and blend continuity: every output
// the page shows changes smoothly as each weight goes from 0 to 1, with a control that a hard switch fails.
//   node --test packages/world/tests/field.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as F from "../field.mjs";
import { createScene, DEFAULTS } from "../scene.mjs";

const SMALL = { w: 2, h: 1.2, nx: 40, ny: 24, mmPerUnit: 100, stepsPerSecond: 60 };
const src = (p) => fileURLToPath(new URL(p, import.meta.url));

test("the kernel matches its BuildLang source of record", () => {
  const expected = readFileSync(src("../src/field_kernel.expected"), "utf8").replace(/\r/g, "");
  assert.equal(F.kernelTable(), expected);
  assert.equal(F.smooth(0, 1, 0.5), 0.5); assert.equal(F.union2(0.5, 0.5), 0.75); assert.equal(F.luneburgN2(0, 1), 2);
  const buildc = process.env.BUILDC;
  if (!buildc) return;   // when a BuildLang compiler is named, the program runs again and must print the same lines
  const run = spawnSync(buildc, ["run", src("../src/field_kernel.bld")], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout.replace(/\r/g, ""), expected);
});

test("an element has a soft rim, known properties and weights from 0 to 1", () => {
  assert.throws(() => F.element({ id: "a", x: 0, y: 0, radius: 1, edge: 0 }), /gradient/);
  assert.throws(() => F.element({ id: "a", x: 0, y: 0, radius: 1, carries: { gravity: 1 } }), /not a property/);
  assert.throws(() => F.element({ id: "a", x: 0, y: 0, radius: 1, carries: { lens: 1.5 } }), /from 0 to 1/);
  const e = F.element({ id: "a", x: 0, y: 0, radius: 1, carries: { lens: 0.4 } });
  assert.deepEqual(Object.keys(e.carries), [...F.PROPERTY_IDS].sort((a, b) => (a === "lens" ? -1 : b === "lens" ? 1 : F.PROPERTY_IDS.indexOf(a) - F.PROPERTY_IDS.indexOf(b))));
  assert.equal(F.carryAt(e, "lens", 0, 0), 0.4); assert.equal(F.carryAt(e, "flow", 0, 0), 0);
});

test("where two carriers meet, strength is their union and value their mixture", () => {
  const a = F.element({ id: "a", x: 0, y: 0, radius: 1, carries: { lens: 0.6 } }), b = F.element({ id: "b", x: 0.5, y: 0, radius: 1, carries: { lens: 0.5 } });
  const m = F.mixture([a, b], "lens", 0.25, 0, (el) => (el.id === "a" ? 2 : 1.5));
  assert.ok(Math.abs(m.strength - F.union2(F.carryAt(a, "lens", 0.25, 0), F.carryAt(b, "lens", 0.25, 0))) < 1e-12);
  assert.ok(m.value > 1.5 && m.value < 2 && m.strength <= 1);
  assert.equal(F.mixture([a, b], "flow", 0, 0, () => 9).value, 0, "nothing carries flow, so it has no value");
});

// One output of the scene for a weight w, after `steps` steps from the same start.
function output(id, prop, read, steps = 0, patch = null) {
  return (w) => {
    const s = createScene({ size: SMALL });
    s.set(id, patch ? patch(w) : { carries: { [prop]: w } });
    for (let i = 0; i < steps; i++) s.step();
    return read(s);
  };
}
const at = (s, f, x, y) => { const { nx, w } = s.size, hc = w / nx; return f[Math.floor(y / hc) * nx + Math.floor(x / hc)]; };
const reading = (id) => (s) => s.read().readings.find((r) => r.id === id).value;
const CASES = [
  ["lens: water's refraction, n^2 where glass and water meet", output("water", "lens", (s) => s.n2At(0.95, 0.6))],
  ["lens: a ray's turn through the glass", output("glass", "lens", (s) => s.trace(5)[1].turn)],
  ["lens: the glass moved across the water, n^2 at a fixed point", output("glass", null, (s) => s.n2At(1.1, 0.62), 0, (w) => ({ x: 0.62 + 0.68 * w }))],
  ["flow: speed read at the probe after 20 steps", output("water", "flow", reading("speed"), 20)],
  ["flow: dye at the probe after 20 steps", output("water", "flow", reading("dye"), 20)],
  ["measure: the water given measurement, speed over probe and water", output("water", "measure", reading("speed"), 12)],
  ["measure: the measured area as the probe's weight grows", output("probe", "measure", (s) => s.read().weight)],
  ["shape: the glass given shape, the long diameter of glass and water", output("glass", "shape", (s) => s.dims().major.value)],
  ["sound: pressure at the probe after 30 steps", output("voice", "sound", reading("pressure"), 30)],
  ["map: map strength at a point", output("ground", "map", (s) => at(s, s.g.s.map, 1, 0.6))],
  ["circuit: trace impedance at the probe", output("probe", "circuit", reading("z0"))],
];

for (const [name, f] of CASES) test(`continuous as the weight goes 0 to 1: ${name}`, () => {
  const c = F.continuity(f, { n: 40 });
  assert.ok(c.continuous, `largest step ${c.coarse} at 40 samples, ${c.fine} at 80: it did not shrink (ratio ${c.ratio.toFixed(2)})`);
  assert.ok(Number.isFinite(f(0)) && Number.isFinite(f(1)));
});

test("control: a hard switch fails the continuity check, in the kernel and in the scene", () => {
  const smoothF = (w) => F.n2Blend(w, 2), hard = (w) => F.n2Blend(w > 0.5 ? 1 : 0, 2);
  assert.ok(F.continuity(smoothF).continuous);
  assert.equal(F.continuity(hard).continuous, false, "a property switched on at half weight must be caught");
  // the scene with its rim made a hard edge: the glass crossing a point jumps the index there
  const edge = (e) => output("glass", null, (s) => s.n2At(1.1, 0.62), 0, (w) => ({ x: 0.62 + 0.68 * w, edge: e }));
  assert.equal(F.continuity(edge(1e-6), { n: 40 }).continuous, false, "a boundary with no gradient is caught");
  assert.ok(F.continuity(edge(DEFAULTS[0].edge), { n: 40 }).continuous);
});
