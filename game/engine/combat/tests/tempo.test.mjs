// Attributes scale animation speed and other variables (sim/tempo.mjs), inside hard limits, and a
// focused build is efficient while a spread build stays viable.
import { test } from "node:test";
import assert from "node:assert/strict";
import { tempoOf, scaleMove, TEMPO } from "../sim/tempo.mjs";
import { defineMoves } from "../sim/moves.mjs";
import { poseOf } from "../anim/drive.mjs";
import { makeWorld, run, press } from "./helpers.mjs";
import { BUILDS, runBuild } from "../tools/minmax.mjs";

test("the curves: GRIP quickens swings, NOSE quickens dodges and widens windows, BALLAST the parry, COAT shortens stun", () => {
  const base = tempoOf({}), up = tempoOf({ grip: 8, nose: 8, ballast: 8, coat: 8 });
  assert.equal(base.swing, 1); assert.equal(base.dodge, 1); assert.equal(base.stun, 1);
  assert.ok(up.swing < 1 && up.dodge < 1 && up.iframe > 0 && up.parry > 0 && up.cancel > 0 && up.stun < 1);
});

test("soft caps and hard limits: speed never runs past its limit, and load slows everything", () => {
  const max = tempoOf({ grip: 30, nose: 30, ballast: 30, coat: 30 });
  assert.ok(max.swing >= TEMPO.swing.min && max.dodge >= TEMPO.dodge.min && max.stun >= TEMPO.stun.min);
  assert.ok(max.iframe <= TEMPO.iframe.max && max.parry <= TEMPO.parry.max && max.cancel <= TEMPO.cancel.max);
  assert.ok(tempoOf({}, "heavy").swing > tempoOf({}, "medium").swing && tempoOf({}, "light").dodge < tempoOf({}, "medium").dodge);
  // the soft cap: the second five points buy less than the first
  const a = 1 - tempoOf({ grip: 6 }).swing, b = tempoOf({ grip: 6 }).swing - tempoOf({ grip: 9 }).swing;
  assert.ok(b < a);
});

test("scaling a move keeps its active frames and maps every window along", () => {
  const m = defineMoves({ x: { startup: 20, active: 6, recovery: 30, iframes: [2, 10], cancel: { roll: [36, 55] }, hits: [{ arc: [-30, 30], r: [0, 2] }] } }).x;
  const s = scaleMove(m, 0.8);
  assert.equal(s.active, 6); assert.equal(s.startup, 16); assert.equal(s.recovery, 24);
  assert.deepEqual(s.hits[0].at, [16, 21], "the hit still covers the active frames");
  assert.ok(s.cancel.roll[0] < m.cancel.roll[0] && s.cancel.roll[0] >= s.startup + s.active);
});

test("a quick build's strike and roll come out faster in the fight, and the clip plays faster to match", () => {
  const slow = makeWorld({ brains: false, foes: [] }), quick = makeWorld({ brains: false, foes: [], lamb: { grip: 9, nose: 9, coat: 6 } });
  assert.ok(quick.moves["lamb:light_1"].startup < slow.moves["lamb:light_1"].startup);
  assert.ok(quick.moves["lamb:roll"].recovery < slow.moves["lamb:roll"].recovery);
  run(slow, 1, press("light")); run(quick, 1, press("light"));
  const ps = poseOf(slow, slow.lamb()), pq = poseOf(quick, quick.lamb());
  assert.ok(pq.rate > ps.rate, `clip rate ${pq.rate} against ${ps.rate}`);
});

test("min-maxing pays: a focused fighter wins at least as often and ends fights sooner than a spread build", { timeout: 600000 }, () => {
  const f = runBuild(BUILDS.focused, 1), s = runBuild(BUILDS.spread, 1);
  assert.ok(f.rate >= s.rate, `focused ${f.rate} spread ${s.rate}`);
  assert.ok(f.meanWonSeconds < s.meanWonSeconds, `focused ${f.meanWonSeconds} s spread ${s.meanWonSeconds} s`);
  assert.ok(s.rate >= 0.6, `the spread build stays viable: ${s.rate}`);
});
