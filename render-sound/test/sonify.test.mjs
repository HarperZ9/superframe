/**
 * sonify.test.mjs — node:test suite for render-sound.
 *
 * Asserts:
 *   1. Output is Uint8Array of length 256 with values in 0..255.
 *   2. DETERMINISTIC — same input produces bit-identical output on repeated calls.
 *   3. INJECTIVE — distinct (kind, n) pairs produce distinct spectra (zero collisions),
 *      the E4 zero-collision property across {cube, simplex, orthoplex} × n ∈ [3..8].
 *   4. spectrumBands() (from sense-core) reads a sonify output into the expected band count.
 *   5. Generic { partials } path works and also produces valid output.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { sonify, sonifyPolytope, polytopeCounts, sonifyGraph, G_N_DECLARED } from "../../render-sound/index.mjs";
import { spectrumBands } from "../../sense-core/index.mjs";

// ── Test corpus ───────────────────────────────────────────────────────────────

const KINDS  = ["cube", "simplex", "orthoplex"];
const N_VALS = [3, 4, 5, 6, 7, 8];

const CORPUS = [];
for (const kind of KINDS) {
  for (const n of N_VALS) {
    CORPUS.push({ kind, n });
  }
}

// ── Helper ────────────────────────────────────────────────────────────────────

// Serialize a Uint8Array to a hex string for fast equality comparison.
function hex(buf) {
  return Buffer.from(buf).toString("hex");
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("render-sound / sonify — output shape and range", () => {

  it("sonify({ kind, n }) returns Uint8Array of length 256", () => {
    const out = sonify({ kind: "cube", n: 4 });
    assert.ok(out instanceof Uint8Array, "must be Uint8Array");
    assert.equal(out.length, 256, "length must be 256");
  });

  it("all values are in 0..255", () => {
    for (const { kind, n } of CORPUS) {
      const out = sonify({ kind, n });
      for (let i = 0; i < 256; i++) {
        assert.ok(out[i] >= 0 && out[i] <= 255,
          `${kind}(${n}) bin[${i}]=${out[i]} out of range`);
      }
    }
  });

  it("sonifyPolytope agrees with sonify for all corpus entries", () => {
    for (const { kind, n } of CORPUS) {
      const a = sonify({ kind, n });
      const b = sonifyPolytope({ kind, n });
      assert.deepEqual(a, b, `sonify vs sonifyPolytope disagree for ${kind}(${n})`);
    }
  });

  it("at least one bin is non-zero (spectrum is not silent)", () => {
    for (const { kind, n } of CORPUS) {
      const out = sonify({ kind, n });
      const maxVal = Math.max(...out);
      assert.ok(maxVal > 0, `${kind}(${n}) produced an all-zero spectrum`);
    }
  });

});

describe("render-sound / sonify — determinism", () => {

  it("same input produces bit-identical output on three consecutive calls", () => {
    for (const { kind, n } of CORPUS) {
      const a = hex(sonify({ kind, n }));
      const b = hex(sonify({ kind, n }));
      const c = hex(sonify({ kind, n }));
      assert.equal(a, b, `${kind}(${n}) call 1 ≠ call 2`);
      assert.equal(b, c, `${kind}(${n}) call 2 ≠ call 3`);
    }
  });

});

describe("render-sound / sonify — injectivity (E4 zero-collision property)", () => {

  it("all (kind, n) pairs in corpus produce distinct spectra — zero collisions", () => {
    const seen = new Map(); // hex → label
    const collisions = [];

    for (const { kind, n } of CORPUS) {
      const key = hex(sonify({ kind, n }));
      const label = `${kind}(${n})`;
      if (seen.has(key)) {
        collisions.push(`${label} collides with ${seen.get(key)}`);
      } else {
        seen.set(key, label);
      }
    }

    assert.equal(
      collisions.length, 0,
      `Spectral collisions found:\n  ${collisions.join("\n  ")}`
    );
  });

  it("distinct invariants: every (kind, n) has a unique (V, E, D) triple", () => {
    const triples = new Map();
    const dupes = [];

    for (const { kind, n } of CORPUS) {
      const { V, E, D } = polytopeCounts({ kind, n });
      const key = `V=${V},E=${E},D=${D}`;
      const label = `${kind}(${n})`;
      if (triples.has(key)) {
        dupes.push(`${label} shares invariants with ${triples.get(key)} (${key})`);
      } else {
        triples.set(key, label);
      }
    }

    assert.equal(
      dupes.length, 0,
      `Invariant collisions (same mapping inputs):\n  ${dupes.join("\n  ")}`
    );
  });

});

describe("render-sound / sense-core integration — spectrumBands", () => {

  it("spectrumBands(sonify(...), 8) returns an array of length 8", () => {
    const out = sonify({ kind: "cube", n: 4 });
    const bands = spectrumBands(out, 8);
    assert.equal(bands.length, 8, "spectrumBands must return 8 elements");
  });

  it("spectrumBands values are in [0, 1]", () => {
    for (const { kind, n } of CORPUS) {
      const out = sonify({ kind, n });
      const bands = spectrumBands(out, 8);
      for (let b = 0; b < 8; b++) {
        assert.ok(bands[b] >= 0 && bands[b] <= 1,
          `${kind}(${n}) band[${b}]=${bands[b]} out of [0,1]`);
      }
    }
  });

  it("spectrumBands(sonify(...), 16) returns an array of length 16", () => {
    const out = sonify({ kind: "simplex", n: 5 });
    const bands = spectrumBands(out, 16);
    assert.equal(bands.length, 16);
  });

  it("at least one band is non-zero for every corpus entry", () => {
    for (const { kind, n } of CORPUS) {
      const out = sonify({ kind, n });
      const bands = spectrumBands(out, 8);
      const maxBand = Math.max(...bands);
      assert.ok(maxBand > 0, `${kind}(${n}) all bands are zero`);
    }
  });

});

describe("render-sound / generic partials path", () => {

  it("sonify({ partials }) returns Uint8Array[256]", () => {
    const out = sonify({ partials: [{ bin: 10, amp: 200 }, { bin: 50, amp: 100 }] });
    assert.ok(out instanceof Uint8Array);
    assert.equal(out.length, 256);
  });

  it("sonify({ partials: [] }) returns all-zero buffer", () => {
    const out = sonify({ partials: [] });
    const maxVal = Math.max(...out);
    assert.equal(maxVal, 0, "empty partials should produce silence");
  });

  it("partials path is also deterministic", () => {
    const input = { partials: [{ bin: 32, amp: 180 }, { bin: 64, amp: 90 }] };
    assert.equal(hex(sonify(input)), hex(sonify(input)));
  });

  it("throws TypeError on unknown structure", () => {
    assert.throws(
      () => sonify({ foo: "bar" }),
      TypeError,
      "should throw on unrecognized structure"
    );
  });

  it("throws on unknown kind", () => {
    assert.throws(
      () => sonify({ kind: "tesseract-custom", n: 4 }),
      Error,
      "should throw on unknown kind"
    );
  });

});

// ── sonifyGraph tests ─────────────────────────────────────────────────────────

describe("render-sound / sonifyGraph — output shape and range", () => {

  it("returns Uint8Array of length 256", () => {
    const out = sonifyGraph({ nodeCount: 10, edgeCount: 15, components: 1 });
    assert.ok(out instanceof Uint8Array, "must be Uint8Array");
    assert.equal(out.length, 256, "length must be 256");
  });

  it("all values are in 0..255", () => {
    const cases = [
      { nodeCount: 5,  edgeCount: 4,  components: 1 },
      { nodeCount: 10, edgeCount: 13, components: 1 },
      { nodeCount: 37, edgeCount: 42, components: 1 },
      { nodeCount: 20, edgeCount: 5,  components: 3 },
    ];
    for (const c of cases) {
      const out = sonifyGraph(c);
      for (let i = 0; i < 256; i++) {
        assert.ok(out[i] >= 0 && out[i] <= 255,
          `N=${c.nodeCount},E=${c.edgeCount} bin[${i}]=${out[i]} out of range`);
      }
    }
  });

  it("at least one bin is non-zero for non-empty graphs", () => {
    const out = sonifyGraph({ nodeCount: 10, edgeCount: 15, components: 1 });
    assert.ok(Math.max(...out) > 0, "spectrum must not be silent for non-empty graph");
  });

  it("empty graph (nodeCount=0) returns all-zero buffer", () => {
    const out = sonifyGraph({ nodeCount: 0, edgeCount: 0, components: 0 });
    assert.equal(Math.max(...out), 0, "empty graph must return silence");
  });

  it("spectrumBands reads sonifyGraph output into expected band count", () => {
    const out = sonifyGraph({ nodeCount: 37, edgeCount: 42, components: 1 });
    const bands = spectrumBands(out, 8);
    assert.equal(bands.length, 8);
    assert.ok(Math.max(...bands) > 0, "at least one band must be non-zero");
  });

});

describe("render-sound / sonifyGraph — determinism", () => {

  it("same criterion produces bit-identical output on three consecutive calls", () => {
    const corpus = [
      { nodeCount: 5,  edgeCount: 4,  components: 1 },
      { nodeCount: 10, edgeCount: 13, components: 1 },
      { nodeCount: 37, edgeCount: 42, components: 1 },
      { nodeCount: 20, edgeCount: 8,  components: 2 },
      { nodeCount: 15, edgeCount: 20, components: 3 },
    ];
    for (const c of corpus) {
      const a = hex(sonifyGraph(c));
      const b = hex(sonifyGraph(c));
      const cc = hex(sonifyGraph(c));
      assert.equal(a, b, `N=${c.nodeCount},E=${c.edgeCount},C=${c.components}: call 1 ≠ call 2`);
      assert.equal(b, cc, `N=${c.nodeCount},E=${c.edgeCount},C=${c.components}: call 2 ≠ call 3`);
    }
  });

});

describe("render-sound / sonifyGraph — injectivity", () => {

  it("distinct (nodeCount, edgeCount, components) triples produce distinct spectra — zero collisions", () => {
    // Corpus of distinct graph invariant triples
    const graphCorpus = [
      { nodeCount: 3,  edgeCount: 2,  components: 1 },
      { nodeCount: 3,  edgeCount: 3,  components: 1 },
      { nodeCount: 4,  edgeCount: 3,  components: 1 },
      { nodeCount: 4,  edgeCount: 4,  components: 1 },
      { nodeCount: 5,  edgeCount: 4,  components: 1 },
      { nodeCount: 5,  edgeCount: 6,  components: 1 },
      { nodeCount: 10, edgeCount: 9,  components: 1 },
      { nodeCount: 10, edgeCount: 13, components: 1 },
      { nodeCount: 12, edgeCount: 11, components: 1 },
      { nodeCount: 12, edgeCount: 15, components: 2 },
      { nodeCount: 20, edgeCount: 19, components: 1 },
      { nodeCount: 20, edgeCount: 25, components: 1 },
      { nodeCount: 30, edgeCount: 29, components: 1 },
      { nodeCount: 30, edgeCount: 35, components: 2 },
      { nodeCount: 37, edgeCount: 36, components: 1 },
      { nodeCount: 37, edgeCount: 42, components: 1 },
      { nodeCount: 40, edgeCount: 39, components: 1 },
      { nodeCount: 40, edgeCount: 50, components: 1 },
    ];

    const seen = new Map(); // hex → label
    const collisions = [];

    for (const c of graphCorpus) {
      const key = hex(sonifyGraph(c));
      const label = `N=${c.nodeCount},E=${c.edgeCount},C=${c.components}`;
      if (seen.has(key)) {
        collisions.push(`${label} collides with ${seen.get(key)}`);
      } else {
        seen.set(key, label);
      }
    }

    assert.equal(
      collisions.length, 0,
      `Graph spectral collisions found:\n  ${collisions.join("\n  ")}`
    );
  });

});

describe("render-sound / sonifyGraph — declared-class injectivity (systematic sample)", () => {

  it("G_N_DECLARED is exported and is a positive integer", () => {
    assert.ok(typeof G_N_DECLARED === "number" && G_N_DECLARED > 0 && Number.isInteger(G_N_DECLARED),
      `G_N_DECLARED must be a positive integer, got: ${G_N_DECLARED}`);
  });

  it("all distinct (N, E) pairs within the declared class (N ≤ G_N_DECLARED, C=1) produce distinct spectra", () => {
    // Systematically sample the declared class:
    //   N in [1..G_N_DECLARED], E in [0..N], C=1 (fixed)
    //
    // The injectivity guarantee is for (N, E) pairs with C fixed.
    // C (components) affects numPartials via max(2,C) but does NOT guarantee
    // distinct spectra across different C values — e.g. C=1 and C=2 both give
    // numPartials=2 and produce the same spectrum for the same (N, E).
    // Injectivity is declared for (N, E) pairs with C held constant (C=1 here).
    //
    // This is a complete systematic sample of the declared class,
    // NOT a fixed corpus — catches any floor() collision the old *8 multiplier
    // caused (widened to *G_N_DECLARED in the fix).
    const seen = new Map(); // hex → label
    const collisions = [];

    for (let N = 1; N <= G_N_DECLARED; N++) {
      for (let E = 0; E <= N; E++) {
        const criterion = { nodeCount: N, edgeCount: E, components: 1 };
        const key = hex(sonifyGraph(criterion));
        const label = `N=${N},E=${E}`;
        if (seen.has(key)) {
          collisions.push(`${label} collides with ${seen.get(key)}`);
        } else {
          seen.set(key, label);
        }
      }
    }

    assert.equal(
      collisions.length, 0,
      `Declared-class (N≤${G_N_DECLARED}) (N,E) spectral collisions found:\n  ${collisions.join("\n  ")}`
    );
  });

  it("C (components) is NOT an injectivity dimension: C=1 and C=2 may produce same spectrum for same (N,E)", () => {
    // This test DOCUMENTS the known limitation: C differentiates only when
    // numPartials=max(2,C) gives a different count (i.e., C≥3 may add a 3rd partial).
    // For C=1 vs C=2, both give numPartials=2, so the spectra are identical.
    // This is a design choice: injectivity is guaranteed on (N,E) pairs, not (N,E,C).
    const c1 = sonifyGraph({ nodeCount: 10, edgeCount: 5, components: 1 });
    const c2 = sonifyGraph({ nodeCount: 10, edgeCount: 5, components: 2 });
    // C=1 and C=2: max(2,1)=2 and max(2,2)=2 → same numPartials → same spectrum.
    assert.deepEqual(c1, c2,
      "C=1 and C=2 with same (N,E) must produce identical spectra (numPartials=max(2,C)=2 in both cases)"
    );

    // C=3 adds a 3rd partial → different spectrum
    const c3 = sonifyGraph({ nodeCount: 10, edgeCount: 5, components: 3 });
    const anyDiff = c1.some((v, i) => v !== c3[i]);
    assert.ok(anyDiff, "C=3 should produce a different spectrum than C=1 (numPartials=3 vs 2)");
  });

});
