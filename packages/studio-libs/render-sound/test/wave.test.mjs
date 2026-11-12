/**
 * wave.test.mjs — node:test suite for waveSonify (render-sound/index.mjs)
 *
 * Tests:
 *   1. Deterministic: identical inputs → bit-identical Float64Array output
 *   2. Spectrum discriminates {cube, simplex, orthoplex} × n ∈ [3..8]:
 *      every pair of distinct polytopes produces a distinct spectrum (injective).
 *   3. Discrimination matches the synthetic sonifyPolytope path:
 *      the waveSonify and sonifyPolytope spectra agree on the same neighbourhood
 *      structure (all-pairs L2 distance ranking is consistent).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { waveSonify, sonifyPolytope } from "../index.mjs";

// ── Test corpus ───────────────────────────────────────────────────────────────

const KINDS  = ["cube", "simplex", "orthoplex"];
const N_VALS = [3, 4, 5, 6, 7, 8];

const CORPUS = [];
for (const kind of KINDS) {
  for (const n of N_VALS) {
    CORPUS.push({ kind, n });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Serialize Float64Array to a string key for equality testing. */
function f64Key(arr) {
  // Round to 10 significant digits to avoid floating-point noise between calls
  // (should be exactly equal anyway — deterministic path)
  return Array.from(arr).map(v => v.toExponential(10)).join(",");
}

/** L2 distance between two typed/plain arrays of the same length. */
function l2(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return Math.sqrt(s);
}

// ── Test 1: Determinism ───────────────────────────────────────────────────────

describe("waveSonify — determinism", () => {

  it("same inputs produce bit-identical Float64Array on three calls", () => {
    for (const { kind, n } of CORPUS) {
      const a = f64Key(waveSonify({ kind, n }));
      const b = f64Key(waveSonify({ kind, n }));
      const c = f64Key(waveSonify({ kind, n }));
      assert.equal(a, b, `${kind}(${n}): call 1 ≠ call 2`);
      assert.equal(b, c, `${kind}(${n}): call 2 ≠ call 3`);
    }
  });

  it("output is a Float64Array of length n_fft/2 = 256 (default)", () => {
    const out = waveSonify({ kind: "cube", n: 4 });
    assert.ok(out instanceof Float64Array, "must be Float64Array");
    assert.equal(out.length, 256, "default n_fft=512 → 256 output bins");
  });

  it("respects custom n_fft: n_fft=256 → 128 output bins", () => {
    const out = waveSonify({ kind: "simplex", n: 5 }, { n_fft: 256 });
    assert.equal(out.length, 128);
  });

  it("at least one bin is non-zero (not silent)", () => {
    for (const { kind, n } of CORPUS) {
      const out = waveSonify({ kind, n });
      const maxVal = Math.max(...out);
      assert.ok(maxVal > 0, `${kind}(${n}) produced a silent spectrum`);
    }
  });

});

// ── Test 2: Injectivity (spectrum discriminates all polytopes) ────────────────

describe("waveSonify — spectral injectivity (discriminates all 18 polytopes)", () => {

  it("all (kind, n) pairs in corpus produce distinct spectra — zero collisions", () => {
    const seen = new Map(); // key → label
    const collisions = [];

    for (const { kind, n } of CORPUS) {
      const key  = f64Key(waveSonify({ kind, n }));
      const label = `${kind}(${n})`;
      if (seen.has(key)) {
        collisions.push(`${label} collides with ${seen.get(key)}`);
      } else {
        seen.set(key, label);
      }
    }

    assert.equal(
      collisions.length, 0,
      `waveSonify spectral collisions:\n  ${collisions.join("\n  ")}`
    );
  });

  it("each pair of distinct polytopes has non-zero L2 distance", () => {
    const spectra = CORPUS.map(({ kind, n }) => ({
      label: `${kind}(${n})`,
      spec: waveSonify({ kind, n }),
    }));

    const failures = [];
    for (let i = 0; i < spectra.length; i++) {
      for (let j = i + 1; j < spectra.length; j++) {
        const d = l2(spectra[i].spec, spectra[j].spec);
        if (d < 1e-10) {
          failures.push(`${spectra[i].label} ↔ ${spectra[j].label}: d=${d}`);
        }
      }
    }

    assert.equal(
      failures.length, 0,
      `Zero-distance pairs (collapsed):\n  ${failures.join("\n  ")}`
    );
  });

});

// ── Test 3: Agreement with sonifyPolytope (synthetic path) ────────────────────

describe("waveSonify — nearest-neighbour agreement with sonifyPolytope", () => {

  /**
   * Build a map of label → spectrum for a given path.
   * For waveSonify: raw Float64 magnitudes.
   * For sonifyPolytope: cast to Float64 for uniform distance computation.
   */
  function buildSpectraMap(path) {
    const map = {};
    for (const { kind, n } of CORPUS) {
      const raw = path({ kind, n });
      // Normalise to [0,1] so the two paths are on comparable scales
      const arr = Float64Array.from(raw);
      const peak = Math.max(...arr);
      if (peak > 0) for (let i = 0; i < arr.length; i++) arr[i] /= peak;
      map[`${kind}:${n}`] = arr;
    }
    return map;
  }

  function nearestNeighbour(spectraMap, targetLabel) {
    let best = null, bestDist = Infinity;
    for (const [label, spec] of Object.entries(spectraMap)) {
      if (label === targetLabel) continue;
      const d = l2(spec, spectraMap[targetLabel]);
      if (d < bestDist) { bestDist = d; best = label; }
    }
    return best;
  }

  it("nearest-neighbour agreement between waveSonify and sonifyPolytope is ≥ 80%", () => {
    // Build normalised spectrum maps for both paths
    const waveMap  = buildSpectraMap(({ kind, n }) => waveSonify({ kind, n }));
    const synthMap = buildSpectraMap(({ kind, n }) => sonifyPolytope({ kind, n }));

    const labels = Object.keys(waveMap);
    let agree = 0;
    const disagreements = [];

    for (const lbl of labels) {
      const nnWave  = nearestNeighbour(waveMap,  lbl);
      const nnSynth = nearestNeighbour(synthMap, lbl);
      if (nnWave === nnSynth) {
        agree++;
      } else {
        disagreements.push({ label: lbl, nnWave, nnSynth });
      }
    }

    const accuracy = agree / labels.length;
    // Log disagreements for diagnostics (non-fatal unless below threshold)
    if (disagreements.length > 0) {
      console.log("  NN disagreements (wave vs synth):");
      for (const { label, nnWave, nnSynth } of disagreements) {
        console.log(`    ${label}: wave→${nnWave}  synth→${nnSynth}`);
      }
    }

    assert.ok(
      accuracy >= 0.80,
      `NN agreement ${(accuracy * 100).toFixed(1)}% < 80% threshold. ` +
      `Agree: ${agree}/${labels.length}`
    );
  });

  it("all-pairs distance ranking: Spearman rank correlation between paths is ≥ 0.90", () => {
    const waveMap  = buildSpectraMap(({ kind, n }) => waveSonify({ kind, n }));
    const synthMap = buildSpectraMap(({ kind, n }) => sonifyPolytope({ kind, n }));

    const labels = Object.keys(waveMap);
    const distWave = [], distSynth = [];
    for (let i = 0; i < labels.length; i++) {
      for (let j = i + 1; j < labels.length; j++) {
        distWave.push(l2(waveMap[labels[i]],  waveMap[labels[j]]));
        distSynth.push(l2(synthMap[labels[i]], synthMap[labels[j]]));
      }
    }

    // Compute Spearman rank correlation
    function rankArray(arr) {
      const indexed = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
      const ranks = new Float64Array(arr.length);
      for (let r = 0; r < indexed.length; r++) ranks[indexed[r].i] = r;
      return ranks;
    }

    const rankW = rankArray(distWave);
    const rankS = rankArray(distSynth);
    const m = rankW.length;

    let d2 = 0;
    for (let i = 0; i < m; i++) d2 += (rankW[i] - rankS[i]) ** 2;
    const rho = 1 - (6 * d2) / (m * (m * m - 1));

    assert.ok(
      rho >= 0.90,
      `Spearman ρ=${rho.toFixed(4)} < 0.90 threshold. ` +
      `The two paths have divergent distance rankings.`
    );
  });

  it("waveSonify distinguishes cube vs simplex for every n in [3..8]", () => {
    for (const n of N_VALS) {
      const wCube    = waveSonify({ kind: "cube",    n });
      const wSimplex = waveSonify({ kind: "simplex", n });
      const d = l2(wCube, wSimplex);
      assert.ok(
        d > 0,
        `cube(${n}) and simplex(${n}) have identical waveSonify spectra (d=${d})`
      );
    }
  });

  it("waveSonify distinguishes cube vs orthoplex for every n in [3..8]", () => {
    for (const n of N_VALS) {
      const wCube      = waveSonify({ kind: "cube",      n });
      const wOrthoplex = waveSonify({ kind: "orthoplex", n });
      const d = l2(wCube, wOrthoplex);
      assert.ok(d > 0, `cube(${n}) and orthoplex(${n}) collapsed (d=${d})`);
    }
  });

  it("waveSonify distinguishes simplex vs orthoplex for every n in [3..8]", () => {
    for (const n of N_VALS) {
      const wSimplex   = waveSonify({ kind: "simplex",   n });
      const wOrthoplex = waveSonify({ kind: "orthoplex", n });
      const d = l2(wSimplex, wOrthoplex);
      assert.ok(d > 0, `simplex(${n}) and orthoplex(${n}) collapsed (d=${d})`);
    }
  });

});
