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

import { sonify, sonifyPolytope, polytopeCounts } from "../../render-sound/index.mjs";
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
