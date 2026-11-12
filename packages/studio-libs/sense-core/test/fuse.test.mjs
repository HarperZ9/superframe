/**
 * fuse.test.mjs — tests for zNormalize and fuseChannels.
 *
 * Covers:
 *  1. zNormalize: mean ≈ 0, std ≈ 1 on non-constant input
 *  2. zNormalize: constant input → all zeros (std=0 guard)
 *  3. zNormalize: empty input → empty output
 *  4. fuseChannels: output length = sum of channel lengths
 *  5. fuseChannels: 1-NN class separation — a DISCRIMINATIVE low-variance
 *     channel fused with a NOISY high-variance channel preserves separation
 *     (balanced fusion), whereas naive raw-concatenation fails.
 *  6. fuseChannels: per-channel weights scale the normalized output correctly
 *  7. fuseChannels: mismatched weights throws
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { zNormalize, fuseChannels, coherenceWeights, fuseWeighted } from "../fuse.mjs";

// ── helpers ───────────────────────────────────────────────────────────────────

function mean(arr) {
  return arr.reduce((s, x) => s + x, 0) / arr.length;
}

function std(arr) {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length);
}

function euclidean(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return Math.sqrt(s);
}

/** 1-NN LOO accuracy on items = [{label, feat}] */
function loo1NN(items) {
  let correct = 0;
  for (let i = 0; i < items.length; i++) {
    let best = Infinity, bestLabel = null;
    for (let j = 0; j < items.length; j++) {
      if (i === j) continue;
      const d = euclidean(items[i].feat, items[j].feat);
      if (d < best) { best = d; bestLabel = items[j].label; }
    }
    if (bestLabel === items[i].label) correct++;
  }
  return correct / items.length;
}

/** Deterministic LCG — same seed → same sequence. */
function makeLCG(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; };
}

// ── Test 1: zNormalize mean ≈ 0 and std ≈ 1 ──────────────────────────────────

test("zNormalize: mean ≈ 0, std ≈ 1 on a non-constant vector", () => {
  // Use a known non-trivial input so this isn't vacuously true.
  const input = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const out   = zNormalize(input);

  assert.equal(out.length, input.length, "output length preserved");
  assert.ok(Math.abs(mean(out)) < 1e-10, `mean should be ~0, got ${mean(out)}`);
  assert.ok(Math.abs(std(out)  - 1) < 1e-10, `std should be ~1, got ${std(out)}`);
});

// ── Test 2: zNormalize constant input → all zeros ─────────────────────────────

test("zNormalize: constant input (std=0) → all zeros, no NaN/Inf", () => {
  const input = [7, 7, 7, 7, 7];
  const out   = zNormalize(input);
  for (const v of out) {
    assert.ok(isFinite(v), "no Inf/NaN");
    assert.equal(v, 0);
  }
});

// ── Test 3: zNormalize empty ──────────────────────────────────────────────────

test("zNormalize: empty array → empty array", () => {
  assert.deepEqual(zNormalize([]), []);
});

// ── Test 4: fuseChannels output length ───────────────────────────────────────

test("fuseChannels: output length = sum of channel feature lengths", () => {
  const ch = [
    { name: "a", features: [1, 2, 3, 4] },
    { name: "b", features: [10, 20] },
    { name: "c", features: [0.1, 0.2, 0.3] },
  ];
  const out = fuseChannels(ch);
  assert.equal(out.length, 4 + 2 + 3);
});

// ── Test 5: Class separation — the core correctness claim ─────────────────────
//
// The E8 finding: a high-magnitude, high-dimension channel overwhelms a
// low-magnitude, discriminative channel in naive raw-concatenation Euclidean
// distance. Balanced fusion (z-normalize each channel independently) equalizes
// per-dimension variance across channels, restoring the discriminative signal.
//
// Setup: 2 classes (A and B), 6 items each.
//   Channel 1 (discriminative, LOW magnitude): ramp [0..3] for class A,
//     ramp [100..103] for class B. Per-item values vary so within-vector
//     z-norm is non-trivial, but the two classes' z-normalized representations
//     are IDENTICAL (same ramp shape shifted by 100, same z-norm result).
//     Wait — that's still collapsed. We need asymmetric class shapes.
//
// Revised: class A disc = linearly increasing ramp [0,1,2,3],
//          class B disc = linearly decreasing ramp [3,2,1,0].
//   These have DIFFERENT z-norm shapes (one is monotone up, one down), so
//   after z-norm they are clearly separated (opposite sign patterns).
//   Small within-class jitter (±0.01) doesn't change the shape enough to
//   confuse same-class items with cross-class items.
//
//   Channel 2 (NOISY, HIGH magnitude): independent LCG noise with raw values
//     in range ±500. Within-item z-norm compresses it to ±~3 but still random.
//     Its L2 contribution dominates naive concatenation because raw disc ≤ 3.
//
// Naive raw-concat: each item's raw features span [0..3] disc + [-500..500] noise.
//   L2 distance is dominated by noise channel → intra ≈ inter in raw space.
// Balanced fusion: z-normalize each channel. Disc z-norm maps [0,1,2,3] →
//   symmetric pattern ≈ [-1.3,-0.4,0.4,1.3] and [3,2,1,0] → opposite sign.
//   Within-class items (same ramp shape + tiny jitter) are close; cross-class
//   items (opposite ramp) are far → 1-NN correctly classifies all items.
//
// We assert:
//   (a) Raw intra/inter ratio ≈ 1.0 (noise dominates, classifier degenerates).
//   (b) Balanced fusion accuracy = 100%.

test("fuseChannels: discriminative channel survives fusion with noisy high-dim channel", () => {
  const lcg = makeLCG(7);

  const NOISE_DIM = 64;
  const NOISE_MAG = 500;   // raw noise dominates naive L2; disc values are 0..3

  // Discriminative prototypes: same shape norm (linear ramp) but opposite direction.
  // After z-normalization: class A → ascending z-scores, class B → descending.
  const discProtoA = [0, 1, 2, 3];        // z-norm ≈ [-1.34, -0.45, 0.45, 1.34]
  const discProtoB = [3, 2, 1, 0];        // z-norm ≈ [+1.34, +0.45, -0.45, -1.34]

  const items = [];
  for (let i = 0; i < 6; i++) {
    // Within-class: tiny additive jitter on the ramp (preserves z-norm shape).
    const jitter = () => (lcg() - 0.5) * 0.02;
    const disc = discProtoA.map(v => v + jitter());
    const noise = Array.from({ length: NOISE_DIM }, () => (lcg() - 0.5) * 2 * NOISE_MAG);
    items.push({ label: "A", disc, noise });
  }
  for (let i = 0; i < 6; i++) {
    const jitter = () => (lcg() - 0.5) * 0.02;
    const disc = discProtoB.map(v => v + jitter());
    const noise = Array.from({ length: NOISE_DIM }, () => (lcg() - 0.5) * 2 * NOISE_MAG);
    items.push({ label: "B", disc, noise });
  }

  // ── Assert naive raw-concat: noise dominates (intra ≈ inter in raw space) ──
  const raw = items.map(it => [...it.disc, ...it.noise]);
  let intraSum = 0, intraCount = 0, interSum = 0, interCount = 0;
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const d = euclidean(raw[i], raw[j]);
      if (items[i].label === items[j].label) { intraSum += d; intraCount++; }
      else                                    { interSum += d; interCount++; }
    }
  }
  const rawRatio = (intraSum / intraCount) / (interSum / interCount);
  assert.ok(rawRatio > 0.85,
    `Raw intra/inter ratio should be ≈1 (noise drowns signal), got ${rawRatio.toFixed(4)}`);

  // ── Assert balanced fusion: 100% accuracy ────────────────────────────────
  const fusedItems = items.map(it => ({
    label: it.label,
    feat: fuseChannels([
      { name: "disc",  features: it.disc },
      { name: "noise", features: it.noise },
    ]),
  }));
  const fusedAcc = loo1NN(fusedItems);
  assert.equal(fusedAcc, 1.0,
    `Expected balanced fusion accuracy = 100%, got ${(fusedAcc * 100).toFixed(1)}%`);
});

// ── Test 6: per-channel weights scale the normalized output ───────────────────

test("fuseChannels: per-channel weight scales normalized output", () => {
  const ch = [
    { name: "x", features: [1, 2, 3, 4, 5] },
    { name: "y", features: [10, 20, 30] },
  ];

  // With weight 2 for channel "x" its normalized values should be doubled.
  const outW1 = fuseChannels(ch, { weights: [1, 1] });
  const outW2 = fuseChannels(ch, { weights: [2, 1] });

  // First 5 elements (channel x) should be 2× the unit-weight values.
  for (let i = 0; i < 5; i++) {
    assert.ok(
      Math.abs(outW2[i] - outW1[i] * 2) < 1e-10,
      `element ${i}: expected ${outW1[i] * 2}, got ${outW2[i]}`
    );
  }
  // Last 3 elements (channel y, weight=1) should be identical.
  for (let i = 5; i < 8; i++) {
    assert.ok(
      Math.abs(outW2[i] - outW1[i]) < 1e-10,
      `element ${i}: channel y should be unchanged`
    );
  }
});

// ── Test 7: mismatched weights throws ─────────────────────────────────────────

test("fuseChannels: mismatched weights length throws", () => {
  const ch = [
    { name: "a", features: [1, 2] },
    { name: "b", features: [3, 4] },
  ];
  assert.throws(
    () => fuseChannels(ch, { weights: [1, 2, 3] }),
    /weights\.length.*channels\.length/
  );
});

// ── Test 8: coherenceWeights — anti-discriminative channel gets near-zero weight ─────

test("coherenceWeights: anti-discriminative channel gets near-zero weight, discriminative gets high weight", () => {
  // 6 samples, 2 classes (A: 0-2, B: 3-5).
  //
  // Discriminative channel: class A all [0], class B all [10].
  //   inter > intra → score >> 1 → high weight.
  //
  // Anti-discriminative channel: mixed — intra-class samples are far, inter-class
  //   samples are close. Class A = [0, 100] (spread of 100), class B = [1, 2] (spread of 1).
  //   Mean intra: classA pair = 100, classB pairs = 1 → meanIntra >> meanInter.
  //   Score ≈ 0 → near-zero weight.

  const labels = ["A", "A", "A", "B", "B", "B"];

  // Good channel: each sample is a 1-D feature vector
  const goodCh = [
    [0], [0.1], [0.2],   // class A
    [10], [10.1], [9.9], // class B
  ];

  // Bad (anti-discriminative) channel:
  // intra-A: [0,0],[0,50],[0.1,50],[0,50] etc. — far apart
  // intra-B: [5,5],[5.1,5],[5,5.1] — close together
  // inter-A-B: mixed distances, some close
  const badCh = [
    [0, 0],   // A
    [0, 50],  // A — very far from first A sample (intra >> inter for A)
    [0, 25],  // A
    [5, 5],   // B
    [5, 6],   // B — close to other B
    [5, 5.5], // B
  ];

  const weights = coherenceWeights([goodCh, badCh], labels);

  assert.equal(weights.length, 2, "should return one weight per channel");

  const totalWeight = weights[0] + weights[1];
  assert.ok(Math.abs(totalWeight - 1.0) < 1e-9, `weights should sum to 1, got ${totalWeight}`);

  // Good channel should get most of the weight
  assert.ok(weights[0] > 0.8,
    `good channel weight should be > 0.8, got ${weights[0].toFixed(4)}`);

  // Bad channel should get near-zero weight
  assert.ok(weights[1] < 0.2,
    `anti-discriminative channel weight should be < 0.2, got ${weights[1].toFixed(4)}`);
});

// ── Test 9: fuseWeighted classifies 2-class set by the good channel ──────────
//
// Design note: zNormalize operates per-sample vector, not across the channel corpus.
// That means each sample's feature vector must have at least 2+ elements (else std=0
// and zNorm returns all-zeros). We use 4-element vectors here.
//
// Good channel: class A vectors are monotone-ascending [0,1,2,3],
//               class B vectors are monotone-descending [3,2,1,0].
//               z-norm preserves the shape sign → clear separation.
//               Intra-class vectors are identical (spread=0) → intra dist=0 → huge score.
//
// Bad channel: each sample's vector is random-like but same shape across classes.
//   Intra-class L2 (same-class pairs differ) > inter-class L2 (cross-class similar)
//   → anti-discriminative → score ≈ 0 → near-zero weight.
//
// With coherence weighting, good channel dominates → 100% LOO accuracy.

test("fuseWeighted: correct classification when bad channel has near-zero weight", () => {
  const labels = ["A", "A", "A", "B", "B", "B"];

  // Good channel: tight intra (identical vectors per class), large inter-class distance
  const goodCh = [
    [0, 1, 2, 3],  // A — ascending ramp
    [0, 1, 2, 3],  // A
    [0, 1, 2, 3],  // A
    [3, 2, 1, 0],  // B — descending ramp
    [3, 2, 1, 0],  // B
    [3, 2, 1, 0],  // B
  ];

  // Bad (anti-discriminative) channel: all samples same vector → intra=0 AND inter=0.
  // Score = 0/0+ε ≈ 0 → near-zero weight.
  // We need intra > inter, so use: within-class samples differ a lot, cross-class similar.
  // A0=[0,0,0,0], A1=[10,10,10,10], A2=[5,5,5,5] — spread of 10
  // B0=[3,3,3,3], B1=[7,7,7,7], B2=[2,2,2,2] — spread of 5; inter-A-B distances ≈ 3..9
  const badCh = [
    [0, 0, 0, 0],    // A — intra spread = 10
    [10, 10, 10, 10],// A
    [5, 5, 5, 5],    // A
    [3, 3, 3, 3],    // B — intra spread = 5; inter-AB ≈ 3..8 < intra-A spread
    [7, 7, 7, 7],    // B
    [2, 2, 2, 2],    // B
  ];

  const weights = coherenceWeights([goodCh, badCh], labels);

  // Good channel should dominate
  assert.ok(weights[0] > weights[1],
    `good channel weight (${weights[0].toFixed(4)}) should exceed bad channel weight (${weights[1].toFixed(4)})`);

  const fused = fuseWeighted([goodCh, badCh], weights);
  assert.equal(fused.length, 6, "should return one fused vector per sample");

  // 1-NN LOO on fused vectors
  const items = fused.map((feat, i) => ({ label: labels[i], feat }));
  const acc = loo1NN(items);

  assert.equal(acc, 1.0,
    `Expected 100% 1-NN LOO accuracy with coherence-weighted fusion, got ${(acc * 100).toFixed(1)}%`);
});
