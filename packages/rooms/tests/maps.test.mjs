import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { assert, near } from "./h.mjs";
import { parseUnit, groupResidual, unitFaults, statusFrom, mapFaults, WORDS } from "../maps/map.js";
import { threeSystems, omega0, zeta, runThree, nrmse, pipeRe, deriv } from "../maps/bond.js";
import { mapRoomPage } from "../views/map-room/build.mjs";

const REG = JSON.parse(readFileSync(new URL("../maps/registry.json", import.meta.url), "utf8"));
const chirp = (t) => Math.sin(2 * Math.PI * (0.1 * t + 0.05 * t * t)) * (t < 12 ? 1 : 0);

test("units: parsing and a group that must vanish", () => {
  assert.deepEqual(parseUnit("M L2 T-2"), { M: 1, L: 2, T: -2 });
  assert.deepEqual(groupResidual({ c: 1, k: -0.5, m: -0.5 }, { c: "M T-1", k: "M T-2", m: "M" }), {});
  assert.throws(() => parseUnit("Q2"));
});

test("a group that is not dimensionless is a fault, so the check can fail", () => {
  const m = { quantities: [{ a: "m", a_unit: "M", b: "L", b_unit: "M L2 T-2 I-2" }], groups: [{ name: "bad", expr_a: { m: 1 } }] };
  assert.equal(unitFaults(m).length, 1);
});

test("status rule: homology, broken and analogy", () => {
  assert.equal(statusFrom({ held_out_pass: true, passed_region: true }), "homology");
  assert.equal(statusFrom({ held_out_pass: false, passed_region: true, break_point: "here" }), "broken");
  assert.equal(statusFrom({ held_out_pass: true, passed_region: true, break_point: "here" }), "broken");
  assert.equal(statusFrom({ held_out_pass: false, passed_region: false }), "analogy");
  assert.equal(statusFrom({ held_out_pass: null }), "analogy");
});

test("bond layer: mass, RLC and pipe share omega0 and zeta", () => {
  const S = threeSystems();
  for (const k of Object.keys(S)) {
    near(omega0(S[k]), 5, 1e-9, `${k} omega0`);
    near(zeta(S[k]), 0.2, 2e-3, `${k} zeta`);
  }
});

test("bond layer: one disturbance gives one line below Re 2300 and the pipe leaves it above", () => {
  const low = runThree(chirp, 16, 0.002, 1);
  near(nrmse(low.rlc, low.mass), 0, 1e-10, "RLC against mass");
  assert.ok(nrmse(low.pipe, low.mass) < 0.02, "laminar pipe against mass");
  const high = runThree(chirp, 16, 0.002, 30);
  assert.ok(nrmse(high.pipe, high.mass) > 0.3, `turbulent pipe must leave: ${nrmse(high.pipe, high.mass)}`);
  near(nrmse(high.rlc, high.mass), 0, 1e-10, "RLC stays linear");
});

test("bond layer: power balance holds step by step in the mass system", () => {
  const s = threeSystems().mass;
  const y = [0.1, 0.3], e = 2;
  const [dq, df] = deriv(s, y, e);
  near(e * y[1], s.I * y[1] * df + (y[0] / s.C) * dq + s.R * y[1] * y[1], 1e-12, "effort times flow = store + dissipate");
  near(pipeRe(1e-5), 3183, 1, "Re of 10 mL/s in the 2 mm pipe");
});

test("registry: every map states what a map must state", () => {
  assert.ok(REG.maps.length >= 22);
  for (const m of REG.maps) assert.deepEqual(mapFaults(m), [], m.id);
});

test("registry: exact controls are homology, planted false maps are not", () => {
  const fam = (f) => REG.maps.filter((m) => m.family === f);
  assert.equal(fam("exact").length, 6);
  for (const m of fam("exact")) assert.equal(m.status, "homology", m.id);
  assert.equal(fam("planted_false").length, 2);
  for (const m of fam("planted_false")) assert.notEqual(m.status, "homology", m.id);
});

test("registry: a pass does not set shared mechanism, and no total exists", () => {
  for (const m of REG.maps) {
    assert.ok(!/homology|passed/i.test(m.shared_mechanism), `${m.id}: ${m.shared_mechanism}`);
    assert.ok(!("score" in m));
    assert.deepEqual(Object.keys(m.words).sort(), [...WORDS].sort());
  }
});

test("registry: its text carries no local path", () => {
  assert.doesNotMatch(JSON.stringify(REG), /[A-Z]:[\\/]|mission-control/);
});

test("Map Room: the generated page parses with no module syntax or token left", () => {
  const page = mapRoomPage();
  for (const [, s] of page.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
    new vm.Script(s);
    assert.doesNotMatch(s, /^(import|export)\s/m);
  }
  assert.doesNotMatch(page, /\{\{\w+\}\}|ROOM-SCRIPT/);
});
