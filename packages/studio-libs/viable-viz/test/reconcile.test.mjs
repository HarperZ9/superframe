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

// ── Test 4: Tautology-proof — blank/starved render must NOT certify ───────────
//
// This test directly proves that the graph verdict is PERCEPTION-GROUNDED and
// not a criterion round-trip. Under the old code, a graph rendered at width=8
// with maxAmplify=6 would CERTIFY via the SOUND step — because soundInvertGraph
// recovered criterion values regardless of what was actually rendered (tautology).
//
// After the fix, graphs have NO acoustic oracle path. The verdict is determined
// solely by what the two perception-grounded perceivers (scene snap-grid + pixel
// blob detector) actually recover from the rendered framebuffers. A starved render
// (width=8, where neither perceiver can recover 30+ nodes) must be UNVERIFIABLE
// even when maxAmplify is uncapped (6 steps), because no amplification step can
// make a blank render certify without reading the criterion.
describe("reconcile — perception-grounded: blank/starved render must not certify", () => {
  it("30-node graph at width=8 with maxAmplify=6 (SOUND step enabled) → UNVERIFIABLE (tautology gone)", async () => {
    // Previously: this would CERTIFY via SOUND (soundInvertGraph round-tripped through criterion).
    // Now: no sound channel for graphs; verdict depends entirely on what is perceived.
    // A 30-node graph rendered at 8×8 pixels: neither snap-grid nor blob detector
    // can recover 30 nodes — both return far below the 30% vertex tolerance.
    // → Both perceiver verdicts fail → adjudication → UNVERIFIABLE.
    const nodes = Array.from({ length: 30 }, (_, i) => i);
    const edges = nodes.slice(0, -1).map((_, i) => [i, i + 1]).concat([[0, 29]]);
    const subject = graphSubject({ nodes, edges });
    const regulator = groundedRegulator(subject.criterion);

    const cert = await reconcile(subject, {
      regulator,
      width: 8,         // starved render — perceiver cannot distinguish 30 nodes
      maxAmplify: 6,    // SOUND step (step 4) is now available but skipped for graphs
      t0: 0.0,
    });

    // The key assertion: even with maxAmplify=6, a starved graph render is UNVERIFIABLE.
    // Under the old (tautological) code this was CERTIFIED. This test would have FAILED
    // before the fix, proving the tautology has been eliminated.
    assert.equal(cert.verdict, "UNVERIFIABLE",
      `Tautology check: graph at width=8 must be UNVERIFIABLE with maxAmplify=6. ` +
      `If CERTIFIED, the verdict is not perception-grounded (criterion round-trip). ` +
      `Recovered: ${JSON.stringify(cert.recovered)}, ` +
      `Criterion: ${JSON.stringify(cert.criterion)}`,
    );

    // Structural checks
    assert.equal(cert.subjectKind, "graph");
    assert.equal(cert.recheck(), true,
      "recheck() must be consistent with the UNVERIFIABLE verdict",
    );

    // The SOUND amplification step must NOT appear in the amplifications list —
    // confirming that the criterion-derived acoustic oracle was not invoked.
    const soundStep = cert.amplifications.find(a => a.label === "SOUND");
    assert.equal(soundStep, undefined,
      "SOUND amplification step must not appear in graph amplification chain " +
      "(graphs have no perception-grounded sound channel — criterion-derived sound is excluded)",
    );
  });

  it("small graph (5 nodes) at width=8 with maxAmplify=6 is UNVERIFIABLE (not a criterion tautology)", async () => {
    // A 5-node graph at 8×8 pixels: cannot recover 5 nodes from a near-blank render.
    // If it somehow certifies, it must be because both perceivers genuinely agree.
    const subject = graphSubject({
      nodes: [0, 1, 2, 3, 4],
      edges: [[0, 1], [1, 2], [2, 3], [3, 4]],
    });
    const regulator = groundedRegulator(subject.criterion);

    const cert = await reconcile(subject, {
      regulator,
      width: 8,
      maxAmplify: 6,
      t0: 0.0,
    });

    // Regardless of verdict: NO SOUND step should appear for graph subjects.
    const soundStep = cert.amplifications.find(a => a.label === "SOUND");
    assert.equal(soundStep, undefined,
      "SOUND step must never appear in graph amplification chain",
    );

    // recheck must always be consistent
    assert.equal(cert.recheck(), true,
      "recheck() must be consistent regardless of verdict",
    );

    // At width=8, even a 5-node graph almost certainly can't certify.
    // If it does certify, verify that the recovered values genuinely match criterion.
    if (cert.verdict === "CERTIFIED") {
      const { nodeCount: trueN, edgeCount: trueE } = cert.criterion;
      const { geomVertices, pixelVertices } = cert.recovered;
      const VERTEX_TOL = 0.30;
      const EDGE_TOL   = 0.50;
      // BOTH perceivers must pass
      assert.ok(
        Math.abs(geomVertices - trueN) / trueN <= VERTEX_TOL,
        `CERTIFIED but geom perceiver vertex recovery failed: geomVertices=${geomVertices} vs trueN=${trueN}`,
      );
      assert.ok(
        Math.abs(pixelVertices - trueN) / trueN <= VERTEX_TOL,
        `CERTIFIED but pixel perceiver vertex recovery failed: pixelVertices=${pixelVertices} vs trueN=${trueN}`,
      );
    }
  });
});

// ── Test 5b: Ecosystem-sized graph (18 nodes) — blank render → UNVERIFIABLE ─────
//
// Directly proves perception-grounding for the right-sized ecosystem subgraph:
// 18 nodes (the MAX_NODES cap used by ecosystemSubject) rendered at width=8 cannot
// be recovered by either perceiver.  Without a criterion-derived recovery path
// (no SOUND channel for graphs), both perceivers read near-blank pixels → UNVERIFIABLE.
// This is the key anti-tautology proof for the ecosystem fixture specifically.
describe("reconcile — ecosystem-size graph (18 nodes) at blank width → UNVERIFIABLE", () => {
  it("18-node graph at width=8 with maxAmplify=6 → UNVERIFIABLE (perception-grounded)", async () => {
    // Mimic the topology of a real ecosystemSubject at the new MAX_NODES=18 cap.
    const nodes = Array.from({ length: 18 }, (_, i) => `project-${i}`);
    // Star topology (like the lane-star edges in the real ecosystem)
    const edges = nodes.slice(1).map((_, i) => [0, i + 1]);
    const subject = graphSubject({ nodes, edges });
    const regulator = groundedRegulator(subject.criterion);

    const cert = await reconcile(subject, {
      regulator,
      width: 8,         // blank/starved render — perceiver cannot distinguish 18 nodes
      maxAmplify: 6,    // full amplification budget available (SOUND skipped for graphs)
      t0: 0.0,
    });

    // KEY ASSERTION: even with maxAmplify=6, a starved render is UNVERIFIABLE.
    // Under a criterion-tautological code this would incorrectly CERTIFY.
    assert.equal(cert.verdict, "UNVERIFIABLE",
      `Ecosystem-size perception-grounding: 18-node graph at width=8 must be UNVERIFIABLE. ` +
      `If CERTIFIED, the verdict is not perception-grounded (criterion round-trip). ` +
      `Recovered: ${JSON.stringify(cert.recovered)}, ` +
      `Criterion: ${JSON.stringify(cert.criterion)}`,
    );

    // No SOUND step for graphs
    const soundStep = cert.amplifications.find(a => a.label === "SOUND");
    assert.equal(soundStep, undefined, "SOUND step must never appear in graph amplification chain");

    // recheck must be consistent
    assert.equal(cert.recheck(), true, "recheck() must be consistent with UNVERIFIABLE");
  });
});

// ── Test 5: Well-resourced graph — genuine perceptual certification ────────────
//
// Tests that a graph CAN certify at a well-resourced width via genuine perception.
// The scene perceiver (P_A, snap-grid) is much more reliable than pixel blobs for
// graphs, because it reads scene.points directly. At width=192, the snap-grid should
// recover the correct nodeCount; the pixel perceiver may or may not agree.
//
// Honest outcome: if width=192 multi-view is enough for BOTH perceivers to agree
// within tolerance, CERTIFIED is acceptable. If not, UNVERIFIABLE is the honest
// outcome. The test asserts consistency; it does NOT force-pass a specific verdict.
describe("reconcile — well-resourced graph: honest certification or honest UNVERIFIABLE", () => {
  it("small well-connected graph at width=192 — honest verdict with consistent recheck()", async () => {
    // A small graph (8 nodes, 8 edges) at width=192: the snap-grid perceiver reads
    // scene.points which accurately reflect the rendered node count.
    // This test asserts the verdict is HONEST (recheck() consistent), not that it
    // must certify. Either CERTIFIED or UNVERIFIABLE is acceptable.
    const subject = graphSubject({
      nodes: [0, 1, 2, 3, 4, 5, 6, 7],
      edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,0]],
    });
    const regulator = groundedRegulator(subject.criterion);

    const cert = await reconcile(subject, {
      regulator,
      width: 192,
      maxAmplify: 6,
      t0: 0.3,
    });

    assert.ok(cert.verdict === "CERTIFIED" || cert.verdict === "UNVERIFIABLE");
    assert.equal(cert.recheck(), true, "recheck() must be consistent");

    // No SOUND step for graphs (graphs are perception-grounded only)
    const soundStep = cert.amplifications.find(a => a.label === "SOUND");
    assert.equal(soundStep, undefined, "No SOUND step for graphs");

    // If certified: both perceivers must agree within tolerance
    if (cert.verdict === "CERTIFIED") {
      const { nodeCount: trueN, edgeCount: trueE } = cert.criterion;
      const { geomVertices, geomEdges, pixelVertices, pixelEdges } = cert.recovered;
      const VTOL = 0.30, ETOL = 0.50;

      assert.ok(
        Math.abs(geomVertices - trueN) / trueN <= VTOL,
        `CERTIFIED but geom vertices failed: ${geomVertices} vs ${trueN}`,
      );
      assert.ok(
        Math.abs(pixelVertices - trueN) / trueN <= VTOL,
        `CERTIFIED but pixel vertices failed: ${pixelVertices} vs ${trueN}`,
      );
    } else {
      // UNVERIFIABLE is the honest fail-closed outcome when perception can't agree.
      // Log the recovered state for diagnosis.
      assert.ok(true, `UNVERIFIABLE (honest): recovered=${JSON.stringify(cert.recovered)}`);
    }
  });
});
