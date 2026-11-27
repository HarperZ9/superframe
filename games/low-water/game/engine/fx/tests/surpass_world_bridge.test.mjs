// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: MIT
// Known-answer and planted-failure tests for Low Water Wave 13B clean-room bridge.
import { test } from "node:test";
import assert from "node:assert/strict";
import { regionState } from "../../../../world/weather.mjs";
import {
  bt2020Luminance,
  createLivingWorldScheduler,
  evalDarkMistAndCaustic,
  stepTreeBiomechanics,
  verifyWhiteFurnace,
  wetLeafPbr,
} from "../surpass_world_bridge.mjs";

test("tree biomechanics responds to Low Water region weather and obeys white-furnace & energy bounds", () => {
  const calm = regionState(20261118, 9, 1, 16);
  const snowRegion = regionState(20261118, 1, 1, 16);
  const sCalm = stepTreeBiomechanics({ disp: 0, vel: 0, stiffness: 280, mass: 26, area: 8 }, calm, 0.02);
  const sSnow = stepTreeBiomechanics({ disp: 0, vel: 0, stiffness: 280, mass: 26, area: 8 }, snowRegion, 0.02);
  assert.ok(sSnow.sagZ > sCalm.sagZ);
  assert.ok(sSnow.omegaEff < sCalm.omegaEff);
  assert.equal(sSnow.leaf.whiteFurnaceOk, true);

  // Free damped oscillation must never gain energy (including prestress potential)
  let cur = { disp: 0.4, vel: 0, stiffness: 280, mass: 26, area: 8, zeta: 0.08, prestress: 45.0 };
  let prevE = 0.5 * cur.stiffness * cur.disp * cur.disp + cur.prestress * 1.8 * Math.log(Math.cosh(cur.disp / 1.8));
  for (let i = 0; i < 40; i++) {
    cur = stepTreeBiomechanics(cur, { wind: 0, rain: 0, snow: 0 }, 0.005);
    assert.ok(cur.energy <= prevE + 1e-6, `energy gain at step ${i}`);
    prevE = cur.energy;
  }

  // Planted white-furnace trap MUST be rejected
  assert.equal(verifyWhiteFurnace([0.94, 0.9, 0.85], 0.15), false);
  const wet = wetLeafPbr(0.68, [0.16, 0.31, 0.14], 0.9, 0, 0.72);
  assert.ok(wet.roughness < 0.35 && wet.whiteFurnaceOk);
});

test("DS-08 dark-mist shadow preservation and water caustic flux conservation", () => {
  assert.ok(Math.abs(bt2020Luminance([1, 1, 1]) - 1) < 1e-12);
  const darkWorks = { fog: 1.5, gloom: 0.9 };
  const naiveFog = { fog: 1.5, gloom: 0.0 };
  const resDark = evalDarkMistAndCaustic([0.008, 0.01, 0.014], 200, darkWorks, [1.0, 0.75, 0.4], 0.6, 2.0);
  const resNaive = evalDarkMistAndCaustic([0.008, 0.01, 0.014], 200, naiveFog, [1.0, 0.75, 0.4], 0.6, 2.0);
  assert.ok(resDark.lumaBt2020 < resNaive.lumaBt2020 * 0.35);
  assert.ok(resDark.causticFlux > 0 && resDark.causticFlux <= 1.0);
  assert.ok(resDark.transmittance > 0 && resDark.transmittance <= 1.0);
});

test("NOH-3 living-world scheduler holds >70% ticks on 1000 quiet actors and quarantines planted faults", () => {
  const actors = Array.from({ length: 1000 }, (_, i) => ({
    id: i,
    lScale: i % 10 === 0 ? 120.0 : 4.0,
    vScale: i % 10 === 0 ? 30.0 : 2.0,
    x: 0,
    vx: 0,
  }));
  const sched = createLivingWorldScheduler(actors);
  const active = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  let stats = null;
  for (let s = 1; s <= 15; s++) {
    const faults = s === 3 ? { 50: { vx: Number.NaN }, 120: { vx: 1e6 } } : {};
    stats = sched.tick(8.0, active, faults, 0.02);
  }
  assert.equal(stats.actorCount, 1000);
  assert.ok(stats.heldTickRatio > 0.70, `expected >0.70 held ratio, got ${stats.heldTickRatio}`);
  assert.equal(stats.quarantined, 2);
  assert.ok(sched.actors.every((a) => Number.isFinite(a.x) && Number.isFinite(a.vx)));
});
