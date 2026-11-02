import test from "node:test";
import { assert } from "./h.mjs";
import * as R from "../core/registry.js";

test("every shape has a label, a body, and a place in the menu", () => {
  const all = R.shapes();
  assert.ok(all.length >= 55, `shapes ${all.length}`);
  for (const s of all) {
    assert.ok(s.label);
    assert.match(s.body, /return/);
  }
  const inMenu = new Set(R.shapeGroups().flatMap(([, ids]) => ids.map(String)));
  for (const s of all) assert.ok(inMenu.has(String(s.id)), `shape ${s.id} not in a group`);
});

test("index fields point at shapes and world fields carry a source", () => {
  for (const id of [30, 31, 32, 33]) {
    assert.ok(R.shape(id));
    assert.match(R.indexField(id), /return/);
  }
  assert.equal(R.indexField(0), null);
  for (const f of R.worldFields()) {
    assert.ok(f.name);
    assert.ok(f.note);
  }
});

test("scenes, materials and frames resolve; a material row keeps provenance beside its numbers", () => {
  for (const k of ["chart", "grove", "rain", "water", "night", "cell", "cave", "city", "patterns", "meta"]) {
    const s = R.scene(k);
    assert.ok(s.name);
    assert.match(R.sceneProgram(k), /vec3 shade/);
  }
  const g = R.materialRecord("glass");
  assert.equal(g.nd.value, 1.5168);
  assert.equal(g.nd.flag, null, "N-BK7 was checked against the SCHOTT table");
  const a = R.materialRecord("amber");
  assert.equal(a.V.flag, "from memory, unverified");
  for (const id of Object.keys(R.MAT)) assert.ok(R.materialRecord(id).source, id);
  assert.ok(R.frames().length >= 15);
});

test("a registered shape is reachable and an unsafe registration is refused", () => {
  const n = R.shapes().length;
  R.registerShape("t1", "Test ball", "return r-1.;", "Test");
  assert.equal(R.shapes().length, n + 1);
  assert.equal(R.shape("t1").label, "Test ball");
  assert.throws(() => R.registerShape("t1", "Again", "return r;", "Test"), /already/);
  assert.throws(() => R.registerShape("t2", "No return", "float q=1.;", "Test"), /return/);
  R.unregisterShape("t1");
  assert.equal(R.shapes().length, n);
});

test("every preset has a provenance row, and hand-entered prescriptions are flagged", () => {
  for (const k of Object.keys(R.PRESETS)) {
    const p = R.presetProvenance(k);
    assert.ok(p && p.source, k);
  }
  assert.equal(R.presetProvenance("cooke").flag, "from memory, unverified");
});
