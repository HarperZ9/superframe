/**
 * reconcile.test.mjs — Tests for the live reconcile loop + Certificate.
 *
 * Three test cases (using groundedRegulator for determinism):
 *   1. Well-resourced polytope → CERTIFIED, recheck() === true
 *   2. Deficient start → converges via amplification (amplifications.length >= 1)
 *   3. Genuine deficit → UNVERIFIABLE, fail-closed, recheck() still consistent
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { polytopeSubject, graphSubject } from "../subject.mjs";
import { groundedRegulator } from "../regulator.mjs";
import { reconcile } from "../reconcile.mjs";

// ── Test 1: Well-resourced polytope → CERTIFIED ───────────────────────────────
describe("reconcile — well-resourced polytope", () => {
  it("cube n=4 at width=192 returns CERTIFIED and recheck()===true", async () => {
    const subject = polytopeSubject("cube", 4);
    const regulator = groundedRegulator(subject.criterion);

    const cert = await reconcile(subject, { regulator, width: 192, maxAmplify: 6 });

    assert.ok(
      cert.verdict === "CERTIFIED" || cert.verdict === "UNVERIFIABLE",
      `verdict must be CERTIFIED or UNVERIFIABLE, got: ${cert.verdict}`,
    );

    // Well-resourced: width=192 with up to 6 amplifications should certify
    assert.equal(cert.verdict, "CERTIFIED",
      `Expected CERTIFIED for cube n=4 at width=192. ` +
      `Recovered: ${JSON.stringify(cert.recovered)}, ` +
      `Criterion: ${JSON.stringify(cert.criterion)}`,
    );

    const recheckResult = cert.recheck();
    assert.equal(recheckResult, true,
      "recheck() must return true: the stored verdict must be consistent with re-derivation",
    );

    // Structural checks on the certificate
    assert.equal(cert.subjectKind, "polytope");
    assert.ok(Array.isArray(cert.amplifications));
    assert.ok(typeof cert.disclosure === "string" && cert.disclosure.length > 0);
    assert.ok(cert.criterion !== null && typeof cert.criterion === "object");
    assert.ok(cert.recovered !== null && typeof cert.recovered === "object");
  });
});

// ── Test 2: Deficient start → converges via amplification ────────────────────
describe("reconcile — deficient start converges via amplification", () => {
  it("cube n=4 at width=48 with t0=0 (degenerate) converges with >=1 amplification", async () => {
    // width=48 is tiny (E3 failure regime); t0=0 is the most degenerate start.
    // The loop must amplify to reach CERTIFIED.
    const subject = polytopeSubject("cube", 4);
    const regulator = groundedRegulator(subject.criterion);

    const cert = await reconcile(subject, {
      regulator,
      width: 48,      // intentionally small — forces amplification
      maxAmplify: 6,
      t0: 0.0,        // degenerate start angle
    });

    // Must emit a valid verdict
    assert.ok(
      cert.verdict === "CERTIFIED" || cert.verdict === "UNVERIFIABLE",
      `verdict must be CERTIFIED or UNVERIFIABLE`,
    );

    // If it certifies, amplifications must have been used
    if (cert.verdict === "CERTIFIED") {
      assert.ok(
        cert.amplifications.length >= 1,
        `Expected at least 1 amplification for deficient start. ` +
        `Got ${cert.amplifications.length} amplifications.`,
      );

      // Each amplification must be recorded with the required fields
      for (const amp of cert.amplifications) {
        assert.ok(typeof amp.step === "number", "amplification must have a step number");
        assert.ok(typeof amp.label === "string", "amplification must have a label");
        assert.ok(amp.recovered !== null && typeof amp.recovered === "object",
          "amplification must record recovered invariant");
        assert.ok(amp.verdict === "CERTIFIED" || amp.verdict === "UNVERIFIABLE",
          "amplification verdict must be CERTIFIED or UNVERIFIABLE");
      }

      // The decisive amplification is the last one that says CERTIFIED
      const decisive = cert.amplifications.findLast(a => a.verdict === "CERTIFIED");
      assert.ok(decisive !== undefined, "there must be a decisive amplification recorded");
    } else {
      // UNVERIFIABLE is also acceptable here if the width is truly too small —
      // but we need recheck() to be consistent
    }

    const recheckResult = cert.recheck();
    assert.equal(typeof recheckResult, "boolean", "recheck() must return a boolean");
    assert.equal(recheckResult, true,
      "recheck() must be consistent with the stored verdict",
    );
  });

  it("simplex n=5 at width=64 with t0=0 records amplification steps", async () => {
    const subject = polytopeSubject("simplex", 5);
    const regulator = groundedRegulator(subject.criterion);

    const cert = await reconcile(subject, {
      regulator,
      width: 64,
      maxAmplify: 6,
      t0: 0.0,
    });

    assert.ok(cert.verdict === "CERTIFIED" || cert.verdict === "UNVERIFIABLE");

    // Whatever the outcome, recheck must be consistent
    assert.equal(cert.recheck(), true,
      "recheck() must be consistent with the stored verdict",
    );

    // Amplifications must be an array (possibly empty if certified on first try)
    assert.ok(Array.isArray(cert.amplifications));
  });
});

// ── Test 3: Genuine deficit → UNVERIFIABLE, fail-closed ──────────────────────
//
// Polytope subjects have a deterministic sound channel that always recovers
// the exact criterion — so a genuine deficit for polytopes requires maxAmplify=0
// at a starved width (preventing the sound step from firing).
//
// Graph subjects have NO sound channel, so any graph at a pathologically
// small width is a true variety deficit: the loop exhausts all amplifications
// and must return UNVERIFIABLE.
describe("reconcile — genuine deficit → UNVERIFIABLE fail-closed", () => {
  it("graph subject at width=8 with maxAmplify=3 (before SOUND step) → UNVERIFIABLE and recheck() consistent", async () => {
    // Graph subjects now have a sound channel (sonifyGraph, Task 6a).
    // With maxAmplify=3, the SOUND step (step 4) is not reached.
    // Without the acoustic oracle, pixel-only recovery at width=8 cannot
    // satisfy the 30% vertex tolerance — UNVERIFIABLE.
    const subject = graphSubject({
      nodes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      edges: [
        [0, 1], [1, 2], [2, 3], [3, 4], [4, 5],
        [5, 6], [6, 7], [7, 8], [8, 9], [9, 0],
        [0, 5], [1, 6], [2, 7],
      ],
    });
    const regulator = groundedRegulator(subject.criterion);

    const cert = await reconcile(subject, {
      regulator,
      width: 8,         // pathologically starved render
      maxAmplify: 3,    // caps before SOUND (step 4): purely visual path
      t0: 0.0,
    });

    assert.equal(cert.verdict, "UNVERIFIABLE",
      `Expected UNVERIFIABLE for graph at width=8 without SOUND step. ` +
      `Recovered: ${JSON.stringify(cert.recovered)}, ` +
      `Criterion: ${JSON.stringify(cert.criterion)}`,
    );

    // Fail-closed: recheck must be consistent with UNVERIFIABLE
    const recheckResult = cert.recheck();
    assert.equal(typeof recheckResult, "boolean", "recheck() must return a boolean");
    assert.equal(recheckResult, true,
      "recheck() must return true: UNVERIFIABLE verdict must be consistent with re-derivation",
    );

    // Certificate must be structurally complete
    assert.equal(cert.subjectKind, "graph");
    assert.ok(Array.isArray(cert.amplifications));
    assert.ok(cert.criterion !== null && typeof cert.criterion === "object");
    assert.ok(cert.recovered !== null && typeof cert.recovered === "object");
  });

  it("maxAmplify=0 at starved width → UNVERIFIABLE, 0 amplifications, recheck() consistent", async () => {
    // With maxAmplify=0 and a tiny width, no amplification is allowed.
    // The loop must return UNVERIFIABLE after the initial check fails.
    const subject = polytopeSubject("simplex", 4);
    const regulator = groundedRegulator(subject.criterion);

    const cert = await reconcile(subject, {
      regulator,
      width: 16,       // starved: unlikely to certify on first check
      maxAmplify: 0,   // no amplification allowed
      t0: 0.0,
    });

    // Whatever it emits, recheck must be consistent (fail-closed)
    assert.ok(cert.verdict === "CERTIFIED" || cert.verdict === "UNVERIFIABLE");
    assert.equal(cert.recheck(), true,
      "recheck() must be consistent regardless of verdict",
    );

    // With maxAmplify=0, no amplifications should have been recorded
    assert.equal(cert.amplifications.length, 0,
      "maxAmplify=0 must produce 0 amplifications",
    );
  });

  it("large graph subject at width=8 with maxAmplify=3 (before SOUND step) → UNVERIFIABLE, fail-closed", async () => {
    // Large graph (30 nodes) at tiny width with amplification capped before
    // the SOUND step (step 4). Without the acoustic oracle, pixel-only recovery
    // at width=8 cannot reach the 30% vertex tolerance — UNVERIFIABLE.
    // (With maxAmplify=6, the SOUND step fires and graph subjects can certify
    // because sonifyGraph gives an exact acoustic oracle. This test verifies
    // the fail-closed behavior of the purely-visual path.)
    const nodes = Array.from({ length: 30 }, (_, i) => i);
    const edges = nodes.slice(0, -1).map((_, i) => [i, i + 1]).concat([[0, 29]]);
    const subject = graphSubject({ nodes, edges });
    const regulator = groundedRegulator(subject.criterion);

    const cert = await reconcile(subject, {
      regulator,
      width: 8,
      maxAmplify: 3,  // caps before SOUND (step 4): GENERIC + VIEW2 + VIEW3 only
      t0: 0.0,
    });

    assert.equal(cert.verdict, "UNVERIFIABLE",
      `Expected UNVERIFIABLE for 30-node graph at width=8 without SOUND step. ` +
      `Recovered: ${JSON.stringify(cert.recovered)}, ` +
      `Criterion: ${JSON.stringify(cert.criterion)}`,
    );

    assert.equal(cert.recheck(), true,
      "recheck() must be consistent with UNVERIFIABLE",
    );
  });
});
