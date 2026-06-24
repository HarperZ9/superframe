/**
 * flagship.test.mjs — Tests for the orchestration layer (Task 4).
 *
 * Two test cases:
 *   1. runFlagship(polytopeSubject("cube",4), { regulator }) → certificate + witnessLog
 *   2. runFlagship(ecosystemSubject(), { regulator }) → runs without throwing, emits certificate
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

import { polytopeSubject, ecosystemSubject } from "../subject.mjs";
import { groundedRegulator } from "../regulator.mjs";
import { runFlagship } from "../flagship.mjs";

// ── Test 1: polytope subject ──────────────────────────────────────────────────

describe("runFlagship — polytope subject", () => {
  it("cube n=4 returns {certificate, witnessLog} with valid verdict and non-empty log", async () => {
    const subject = polytopeSubject("cube", 4);
    const regulator = groundedRegulator(subject.criterion);

    const result = await runFlagship(subject, { regulator });

    // Must return the two-key object
    assert.ok(result !== null && typeof result === "object",
      "runFlagship must return an object");
    assert.ok("certificate" in result,
      "result must have a certificate field");
    assert.ok("witnessLog" in result,
      "result must have a witnessLog field");

    const { certificate, witnessLog } = result;

    // Verdict must be one of the two valid values
    assert.ok(
      certificate.verdict === "CERTIFIED" || certificate.verdict === "UNVERIFIABLE",
      `certificate.verdict must be CERTIFIED or UNVERIFIABLE, got: ${certificate.verdict}`,
    );

    // witnessLog must be a non-empty array
    assert.ok(Array.isArray(witnessLog),
      "witnessLog must be an array");
    assert.ok(witnessLog.length >= 1,
      `witnessLog must have at least 1 step, got ${witnessLog.length}`);

    // Certificate must have the required fields
    assert.ok(certificate.criterion !== null && typeof certificate.criterion === "object",
      "certificate must have a criterion");
    assert.ok(certificate.recovered !== null && typeof certificate.recovered === "object",
      "certificate must have a recovered field");
    assert.ok(typeof certificate.disclosure === "string" && certificate.disclosure.length > 0,
      "certificate must have a disclosure string");
    assert.ok(Array.isArray(certificate.amplifications),
      "certificate must have an amplifications array");
    assert.ok(typeof certificate.recheck === "function",
      "certificate must have a recheck() function");
  });

  it("onStep callback is called for each witnessed step", async () => {
    const subject = polytopeSubject("cube", 4);
    const regulator = groundedRegulator(subject.criterion);

    const steps = [];
    const result = await runFlagship(subject, {
      regulator,
      onStep: (step) => steps.push(step),
    });

    // Both the onStep-collected steps and the witnessLog must have the same count
    assert.ok(steps.length >= 1,
      `onStep must be called at least once, got ${steps.length} calls`);
    assert.equal(steps.length, result.witnessLog.length,
      "onStep call count must match witnessLog.length");
  });
});

// ── Test 2: ecosystem (graph) subject ────────────────────────────────────────

describe("runFlagship — ecosystem subject", () => {
  let ecosubject;

  before(async () => {
    // ecosystemSubject is async and must never throw
    ecosubject = await ecosystemSubject();
  });

  it("runs on the graph subject without throwing and emits a certificate", async () => {
    const regulator = groundedRegulator(ecosubject.criterion);

    let threw = false;
    let result;
    try {
      result = await runFlagship(ecosubject, { regulator });
    } catch (err) {
      threw = true;
      assert.fail(`runFlagship threw on ecosystem subject: ${err.message}`);
    }

    assert.equal(threw, false, "runFlagship must not throw on a graph subject");
    assert.ok(result !== null && typeof result === "object");

    const { certificate, witnessLog } = result;

    assert.ok(
      certificate.verdict === "CERTIFIED" || certificate.verdict === "UNVERIFIABLE",
      `certificate.verdict must be CERTIFIED or UNVERIFIABLE, got: ${certificate.verdict}`,
    );

    assert.ok(Array.isArray(witnessLog) && witnessLog.length >= 1,
      `witnessLog must have at least 1 step, got: ${witnessLog?.length}`);
  });

  it("recheck() returns a boolean and is consistent with the stored verdict", async () => {
    const regulator = groundedRegulator(ecosubject.criterion);
    const { certificate } = await runFlagship(ecosubject, { regulator });

    const recheckResult = certificate.recheck();
    assert.equal(typeof recheckResult, "boolean",
      "recheck() must return a boolean");
    assert.equal(recheckResult, true,
      "recheck() must be consistent with the stored verdict");
  });
});
