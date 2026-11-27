// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: MIT
// Wave 21B-3 Node tests for 100 Hz latency-faithful sim & Deja-VAE 10-step drift oracle.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SIM_HZ,
  nullspaceBackproject,
  rightPseudoinverse,
  runDejaVae10StepOracle,
  runLatencySim100Hz,
  verifyLatencyClock,
} from "../lib/wave21b_sim_dejavae.mjs";

test("100 Hz latency-faithful sim penalizes overthinking and catches freeze-time cheats", () => {
  const fastA = runLatencySim100Hz({ seed: 42, latencyMs: 10, totalTicks: 500 });
  const fastB = runLatencySim100Hz({ seed: 42, latencyMs: 10, totalTicks: 500 });
  const slow = runLatencySim100Hz({ seed: 42, latencyMs: 180, totalTicks: 500 });

  assert.deepEqual(fastA, fastB);
  assert.equal(fastA.simHz, SIM_HZ);
  assert.ok(slow.trackingRmseM > fastA.trackingRmseM * 1.5, `expected staleness penalty: ${slow.trackingRmseM} vs ${fastA.trackingRmseM}`);
  assert.ok(slow.staleTicks > 400);
  assert.equal(verifyLatencyClock(slow).ok, true);

  // Planted freeze-time cheat (zero stale ticks under 180 ms think time) MUST be rejected
  assert.equal(verifyLatencyClock({ ...slow, staleTicks: 0 }).ok, false);
  assert.equal(verifyLatencyClock({ ...slow, ticksPerDecision: 1 }).ok, false);
});

test("Deja-VAE null-space back-projection passes 10-step round-trip and rejects planted distortions", () => {
  // Full-row-rank 2x4 encoder + intentionally mismatched baseline decoder
  const E = [
    [0.6, 0.8, 0.0, 0.0],
    [0.0, 0.0, 0.8, -0.6],
  ];
  const DBase = [
    [0.72, 0.05],
    [0.71, -0.04],
    [0.06, 0.88],
    [-0.03, -0.49],
  ];
  const z0 = [0.75, -0.42];

  const pinv = rightPseudoinverse(E);
  assert.ok(pinv !== null);
  const xProj = nullspaceBackproject([0.1, -0.2, 0.3, 0.4], z0, E, pinv);
  const checkY = [
    E[0].reduce((s, a, i) => s + a * xProj[i], 0),
    E[1].reduce((s, a, i) => s + a * xProj[i], 0),
  ];
  assert.ok(Math.hypot(checkY[0] - z0[0], checkY[1] - z0[1]) < 1e-12);

  const deja = runDejaVae10StepOracle(E, DBase, z0, { steps: 10, tol: 1e-9, mode: "deja" });
  const naive = runDejaVae10StepOracle(E, DBase, z0, { steps: 10, tol: 1e-9, mode: "naive" });
  assert.equal(deja.verdict, "PASS");
  assert.ok(deja.maxDrift < 1e-11);
  assert.equal(naive.verdict, "FAIL");
  assert.equal(naive.reason, "roundtrip_drift_exceeded");
  assert.ok(naive.maxDrift > 0.05);

  // Planted control 1: singular non-invertible encoder MUST fail closed
  const ESingular = [
    [0.6, 0.8, 0.0, 0.0],
    [0.6, 0.8, 0.0, 0.0],
  ];
  const sing = runDejaVae10StepOracle(ESingular, DBase, z0, { steps: 10, mode: "deja" });
  assert.equal(sing.verdict, "FAIL");
  assert.equal(sing.reason, "non_invertible_operator");

  // Planted control 2: nonlinear clipping distortion MUST fail closed
  const clipped = runDejaVae10StepOracle(E, DBase, z0, {
    steps: 10,
    mode: "deja",
    distort: (x) => x.map((v) => Math.max(-0.2, Math.min(0.2, v))),
  });
  assert.equal(clipped.verdict, "FAIL");
  assert.equal(clipped.reason, "roundtrip_drift_exceeded");
});
