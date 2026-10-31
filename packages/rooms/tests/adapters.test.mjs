import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { assert, near } from "./h.mjs";
import { fromVbenchPresets, fromLensDesign } from "../core/adapters/studies.js";
import { trainEFL } from "../core/train-trace.js";
import { achromat } from "../core/train.js";

const GLASS = { "N-BK7": { nd: 1.5168, vd: 64.17 }, F2: { nd: 1.62004, vd: 36.37 } };
// A worked design in lenspipe.design/1, written for this test: a 100 mm cemented doublet from the thin achromat.
const ach = achromat(0, 100, 12.5, 1.5168, 64.17, 1.62004, 36.37);
const design = {
  schema: "lenspipe.design/1",
  id: "fixture",
  units: "mm",
  intent: { efl: 100, fno: 8 },
  surfaces: [
    { r: null, t: 3, material: null, semi: 6.25, stop: true },
    { r: ach[0].R, t: ach[1].z, material: "N-BK7", semi: 6.8 },
    { r: ach[1].R, t: ach[2].z - ach[1].z, material: "F2", semi: 6.8 },
    { r: ach[2].R, t: 98, material: null, semi: 6.8 },
  ],
};
test("lenspipe design traces to its stated focal length", () => {
  const p = fromLensDesign(design, (n) => GLASS[n] || null);
  assert.equal(p.s[p.s.length - 1].ty, 3);
  near(trainEFL({ make: () => p }), 100, 1.5, "efl");
});
test("planted: a design naming an unknown glass is refused", () => {
  const bad = { ...design, surfaces: design.surfaces.map((q) => (q.material === "F2" ? { ...q, material: "N-BK77" } : q)) };
  assert.throws(() => fromLensDesign(bad, (n) => GLASS[n] || null), /unknown glass N-BK77/);
});
const vb = {
  schema: "vbench.presets/1",
  presets: [
    { key: "lm", name: "Liquid mirror", note: "n", fieldDeg: 0.1, label: "unbuilt", surfaces: [{ z: 0, R: -60, k: -1, n: 1, ap: 10, ty: 1 }] },
  ],
};
test("vbench presets become unbuilt entries that trace", () => {
  const P = fromVbenchPresets(vb);
  assert.match(P.lm.group, /Unbuilt/);
  near(trainEFL(P.lm), 30, 0.01, "parabola of radius 60");
});
test("an unknown schema is refused", () => {
  assert.throws(() => fromVbenchPresets({ schema: "x", presets: [] }), /schema/);
});
const live = new URL("../../../../mission-control/2026-10-31-unbuilt-instruments/PRESETS.json", import.meta.url);
test("the bench's own file parses, when it is present", { skip: existsSync(live) ? false : "bench file is not in this checkout" }, () => {
  assert.ok(Object.keys(fromVbenchPresets(JSON.parse(readFileSync(live)))).length > 0);
});
