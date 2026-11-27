// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: MIT
import test from "node:test";
import assert from "node:assert/strict";
import {
  runLatencySim100Hz,
  verifyLatencyClock,
  runDejaVae10StepOracle,
} from "../lib/wave21b_sim_dejavae.mjs";

// Pinned numeric vectors from compiled BuildLang native/bld/wave25f_parity.bld.
const PINNED_FAST_RMSE = 0.640024566818;
const PINNED_FAST_OVER = 1.311357876416;
const PINNED_SLOW_RMSE = 1.376676765987;
const PINNED_SLOW_OVER = 2.543921244832;
const PINNED_NAIVE_DRIFT = 168.702939368658;

const E_PARITY = [
  [1.0, 0.5, -0.25, 0.25],
  [0.25, -0.5, 1.0, 0.5],
];
const D_BASE_PARITY = [
  [1.12, 0.18],
  [0.41, -0.62],
  [-0.19, 1.09],
  [0.31, 0.44],
];
const Z0_PARITY = [1.25, -0.75];

test("Node ESM 100 Hz sim matches BuildLang parity kernel to <= 1e-12", () => {
  const fast = runLatencySim100Hz({ seed: 42, latencyMs: 10.0, totalTicks: 500, gustScale: 0.0 });
  const slow = runLatencySim100Hz({ seed: 42, latencyMs: 180.0, totalTicks: 500, gustScale: 0.0 });

  assert.equal(fast.agentDecisions, 500);
  assert.equal(fast.staleTicks, 1);
  assert.equal(fast.collisionCount, 0);
  assert.ok(Math.abs(fast.trackingRmseM - PINNED_FAST_RMSE) <= 1e-12);
  assert.ok(Math.abs(fast.maxOvershootM - PINNED_FAST_OVER) <= 1e-12);

  assert.equal(slow.agentDecisions, 28);
  assert.equal(slow.staleTicks, 473);
  assert.equal(slow.collisionCount, 152);
  assert.ok(Math.abs(slow.trackingRmseM - PINNED_SLOW_RMSE) <= 1e-12);
  assert.ok(Math.abs(slow.maxOvershootM - PINNED_SLOW_OVER) <= 1e-12);

  assert.equal(verifyLatencyClock(fast).ok, true);
  assert.equal(verifyLatencyClock(slow).ok, true);
  assert.ok(fast.trackingRmseM < slow.trackingRmseM);
});

test("Node ESM Deja-VAE 10-step oracle matches BuildLang parity kernel and rejects planted distortion", () => {
  const deja = runDejaVae10StepOracle(E_PARITY, D_BASE_PARITY, Z0_PARITY, {
    steps: 10,
    tol: 1e-9,
    mode: "deja",
  });
  const naive = runDejaVae10StepOracle(E_PARITY, D_BASE_PARITY, Z0_PARITY, {
    steps: 10,
    tol: 1e-9,
    mode: "naive",
  });
  const distorted = runDejaVae10StepOracle(E_PARITY, D_BASE_PARITY, Z0_PARITY, {
    steps: 10,
    tol: 1e-9,
    mode: "deja",
    distort: (x) => [x[0] + 0.01, x[1], x[2], x[3]],
  });

  assert.equal(deja.verdict, "PASS");
  assert.ok(deja.maxDrift <= 1e-12);
  assert.equal(naive.verdict, "FAIL");
  assert.ok(Math.abs(naive.maxDrift - PINNED_NAIVE_DRIFT) <= 1e-9);
  assert.equal(distorted.verdict, "FAIL");
  assert.equal(distorted.reason, "roundtrip_drift_exceeded");
});
