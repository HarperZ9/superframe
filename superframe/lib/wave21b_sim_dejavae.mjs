// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: MIT
// Clean-room Superframe ESM kernel for Wave 21B-3:
//   1. DrivingBench v2 latency-faithful 100 Hz fixed-timestep simulation mode
//   2. Deja-VAE training-free null-space back-projection & 10-step PasteBench drift oracle.

export const SIM_HZ = 100.0;
export const SIM_DT = 0.01;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function refLaneY(t) {
  return (
    0.9 * Math.sin(1.4 * t) +
    1.35 * Math.exp(-(((t - 1.8) / 0.35) ** 2)) -
    1.25 * Math.exp(-(((t - 4.0) / 0.35) ** 2))
  );
}

export function runLatencySim100Hz({ seed = 42, latencyMs = 10.0, totalTicks = 500, gustScale = 1.1 } = {}) {
  if (latencyMs < 0) throw new Error("latencyMs must be non-negative");
  const ticksPerDecision = Math.max(1, Math.ceil(latencyMs / (SIM_DT * 1000)));
  const rng = mulberry32(seed);
  let y = 0, vy = 0, gust = 0, t = 0;
  let heldAy = 0, pendingAy = 0;
  let ticksUntilApply = ticksPerDecision;
  let decisions = 1, staleTicks = 0, collisions = 0;
  let sqErr = 0, maxOvershoot = 0;

  for (let tick = 0; tick < totalTicks; tick++) {
    const targetY = refLaneY(t);
    if (ticksUntilApply <= 0) {
      heldAy = pendingAy;
      pendingAy = Math.max(-9.5, Math.min(9.5, 14.0 * (targetY - y) - 4.8 * vy));
      ticksUntilApply = ticksPerDecision;
      decisions += 1;
    } else {
      staleTicks += 1;
    }
    const alpha = Math.exp(-SIM_DT / 0.4);
    const noise = gustScale > 0 ? (rng() + rng() - 1.0) * gustScale : 0.0;
    gust = alpha * gust + Math.sqrt(1 - alpha * alpha) * noise;
    const ay = heldAy + gust - 0.18 * vy;
    vy += ay * SIM_DT;
    y += vy * SIM_DT;
    t += SIM_DT;
    ticksUntilApply -= 1;

    const err = Math.abs(y - refLaneY(t));
    sqErr += err * err;
    if (err > maxOvershoot) maxOvershoot = err;
    if (err > 1.6) collisions += 1;
  }
  return {
    simHz: SIM_HZ,
    latencyMs,
    ticksPerDecision,
    worldTicks: totalTicks,
    agentDecisions: decisions,
    staleTicks,
    trackingRmseM: Math.sqrt(sqErr / totalTicks),
    maxOvershootM: maxOvershoot,
    collisionCount: collisions,
  };
}

export function verifyLatencyClock(res) {
  const expected = Math.max(1, Math.ceil(res.latencyMs / (SIM_DT * 1000)));
  if (res.ticksPerDecision < expected) return { ok: false, reason: "clock_cheat_ticks_per_decision" };
  if (res.latencyMs > 10 && res.staleTicks <= 0) return { ok: false, reason: "clock_cheat_zero_stale_ticks" };
  if (res.worldTicks < (res.agentDecisions - 1) * expected) return { ok: false, reason: "clock_cheat_world_paused" };
  return { ok: true, reason: "latency_faithful_100hz_verified" };
}

function matVec(A, v) {
  return A.map((row) => row.reduce((acc, aij, j) => acc + aij * v[j], 0));
}

function transpose(A) {
  return A[0].map((_, j) => A.map((row) => row[j]));
}

function matMul(A, B) {
  const cols = B[0].length;
  return A.map((row) =>
    Array.from({ length: cols }, (_, j) => row.reduce((s, a, k) => s + a * B[k][j], 0)),
  );
}

function invertSquare(M) {
  const n = M.length;
  const aug = M.map((row, i) => [
    ...row.map(Number),
    ...Array.from({ length: n }, (_, j) => (i === j ? 1.0 : 0.0)),
  ]);
  for (let i = 0; i < n; i++) {
    let piv = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(aug[r][i]) > Math.abs(aug[piv][i])) piv = r;
    if (Math.abs(aug[piv][i]) < 1e-12) return null;
    [aug[i], aug[piv]] = [aug[piv], aug[i]];
    const diag = aug[i][i];
    for (let c = 0; c < 2 * n; c++) aug[i][c] /= diag;
    for (let r = 0; r < n; r++) {
      if (r === i) continue;
      const f = aug[r][i];
      for (let c = 0; c < 2 * n; c++) aug[r][c] -= f * aug[i][c];
    }
  }
  return aug.map((row) => row.slice(n));
}

export function rightPseudoinverse(A) {
  const At = transpose(A);
  const gram = matMul(A, At);
  const gramInv = invertSquare(gram);
  if (!gramInv) return null;
  return matMul(At, gramInv);
}

export function nullspaceBackproject(x, y, A, aPinv = null) {
  const pinv = aPinv || rightPseudoinverse(A);
  if (!pinv) throw new Error("non_invertible_operator");
  const ax = matVec(A, x);
  const resid = y.map((yi, i) => yi - ax[i]);
  const corr = matVec(pinv, resid);
  return x.map((xi, i) => xi + corr[i]);
}

export function runDejaVae10StepOracle(E, DBase, z0, { steps = 10, tol = 1e-9, mode = "deja", distort = null } = {}) {
  const ePinv = rightPseudoinverse(E);
  if (!ePinv) return { verdict: "FAIL", reason: "non_invertible_operator", maxDrift: Infinity };
  let zCur = [...z0];
  let maxDrift = 0;
  for (let s = 0; s < steps; s++) {
    let xHat = matVec(DBase, zCur);
    if (mode === "deja") xHat = nullspaceBackproject(xHat, zCur, E, ePinv);
    if (distort) xHat = distort(xHat);
    const zNext = matVec(E, xHat);
    const err = Math.hypot(...zNext.map((v, i) => v - z0[i]));
    if (err > maxDrift) maxDrift = err;
    zCur = zNext;
  }
  if (!Number.isFinite(maxDrift) || maxDrift > tol) {
    return { verdict: "FAIL", reason: "roundtrip_drift_exceeded", maxDrift };
  }
  return { verdict: "PASS", reason: "exact_invertibility_conserved", maxDrift };
}
