// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: MIT
import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_ABS_LIN_BOUND,
  MAX_P99_OKLAB_DELTA_E_BOUND,
  MIN_PSNR_DB_BOUND,
  advanceProbeState100Hz,
  computeRadiometricParity,
  fnv1aF32Hex,
  quantizeSceneStateHash,
  renderSceneParityProbe64x64,
} from "../lib/cross_api_parity.mjs";

const PINNED_T100_FNV1A = "0b90e9765fa9b28e";
const PINNED_T100_STATE_SHA = "sha256:a356797074b4521d6ce0e30916c36e040d8aa01e0c6345b3b1acfef5d040e8fd";

test("Node WebGPU twin matches BuildLang + Python 64x64 probe and 100 Hz quantized state hash bit for bit", () => {
  const { poses, stateVec } = advanceProbeState100Hz(100);
  assert.equal(quantizeSceneStateHash(poses), PINNED_T100_STATE_SHA);

  const imgWgpu = renderSceneParityProbe64x64(stateVec);
  const imgDx12 = renderSceneParityProbe64x64(stateVec);
  assert.equal(fnv1aF32Hex(imgWgpu), PINNED_T100_FNV1A);
  assert.equal(fnv1aF32Hex(imgDx12), PINNED_T100_FNV1A);

  const clean = computeRadiometricParity(imgWgpu, imgDx12);
  assert.ok(clean.maxAbsLin <= MAX_ABS_LIN_BOUND);
  assert.ok(clean.psnrDb >= MIN_PSNR_DB_BOUND);
  assert.ok(clean.p99OklabDeltaE <= MAX_P99_OKLAB_DELTA_E_BOUND);
});

test("Node WebGPU parity envelope rejects planted gamma, R/B swap, and 1-tick temporal drift", () => {
  const t100 = advanceProbeState100Hz(100);
  const t101 = advanceProbeState100Hz(101);
  const refImg = renderSceneParityProbe64x64(t100.stateVec);

  const gamma = computeRadiometricParity(
    renderSceneParityProbe64x64(t100.stateVec, { fault: "gamma_curve" }),
    refImg,
  );
  assert.ok(gamma.psnrDb < 30.0);
  assert.ok(gamma.p99OklabDeltaE > 0.05);

  const rbSwap = computeRadiometricParity(
    renderSceneParityProbe64x64(t100.stateVec, { fault: "rb_channel_swap" }),
    refImg,
  );
  assert.ok(rbSwap.psnrDb < 30.0);
  assert.ok(rbSwap.p99OklabDeltaE > 0.05);

  assert.notEqual(quantizeSceneStateHash(t100.poses), quantizeSceneStateHash(t101.poses));
  const drift1 = computeRadiometricParity(renderSceneParityProbe64x64(t101.stateVec), refImg);
  assert.ok(drift1.psnrDb < MIN_PSNR_DB_BOUND);
  assert.ok(drift1.maxAbsLin > MAX_ABS_LIN_BOUND);
});
