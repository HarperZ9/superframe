// regulator.test.mjs — Task 2 regulator tests (node:test)
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { groundedRegulator, modelRegulator } from "../regulator.mjs";

// ── helpers ─────────────────────────────────────────────────────────────────

/**
 * Build two synthetic 2-class channels over N samples per class.
 *
 * Channel A (discriminative): class-0 samples cluster around 0, class-1 around 5.
 *   Inter-class distance >> intra-class distance → high coherence weight.
 *
 * Channel B (anti-discriminative / noise): all samples drawn from the SAME
 *   distribution (fixed seed values mixed across classes).
 *   Inter ≈ intra → low coherence weight (near 0 after normalization).
 */
function makeTwoClassData(nPerClass = 8) {
  const labels = [];
  const chA = []; // discriminative
  const chB = []; // anti-discriminative (noise)

  // class-0 samples
  for (let i = 0; i < nPerClass; i++) {
    labels.push(0);
    // tightly clustered around 0
    chA.push([i * 0.01]);
    // all identical — inter == intra
    chB.push([1.0 + i * 0.001]);
  }
  // class-1 samples
  for (let i = 0; i < nPerClass; i++) {
    labels.push(1);
    // tightly clustered around 5 (far from class-0)
    chA.push([5 + i * 0.01]);
    // interleave identical values with class-0 → same distribution
    chB.push([1.0 + i * 0.001]);
  }

  return { labels, channelA: chA, channelB: chB };
}

// A minimal criterion for tests that need one
const minimalCriterion = { vertices: 4, edges: 4 };

// ── groundedRegulator ────────────────────────────────────────────────────────

describe("groundedRegulator", () => {
  it("returns an object with the expected shape", () => {
    const reg = groundedRegulator(minimalCriterion);
    assert.strictEqual(reg.connected, false);
    assert.ok(typeof reg.disclosure === "string" && reg.disclosure.length > 0);
    assert.ok(typeof reg.weigh === "function");
    assert.ok(typeof reg.adjudicate === "function");
  });

  it("weigh: discriminative channel gets high weight, anti-discriminative near zero", () => {
    const { labels, channelA, channelB } = makeTwoClassData(10);
    const reg = groundedRegulator(minimalCriterion);
    const weights = reg.weigh([channelA, channelB], labels);

    assert.strictEqual(weights.length, 2);

    // Both weights must be non-negative
    assert.ok(weights[0] >= 0, `channelA weight should be >=0, got ${weights[0]}`);
    assert.ok(weights[1] >= 0, `channelB weight should be >=0, got ${weights[1]}`);

    // Discriminative channel (A) must dominate anti-discriminative channel (B)
    // by a significant margin (at least 5x)
    assert.ok(
      weights[0] > weights[1] * 5,
      `channelA weight (${weights[0].toFixed(4)}) should be >> channelB weight (${weights[1].toFixed(4)})`
    );
  });

  it("weigh with a single channel: returns weight of 1", () => {
    const { labels, channelA } = makeTwoClassData(4);
    const reg = groundedRegulator(minimalCriterion);
    const weights = reg.weigh([channelA], labels);
    assert.strictEqual(weights.length, 1);
    assert.ok(Math.abs(weights[0] - 1.0) < 1e-9, `single channel weight should be 1, got ${weights[0]}`);
  });

  it("adjudicate: CERTIFIED when verdicts agree and match criterion", () => {
    const reg = groundedRegulator(minimalCriterion);
    // Verdicts that all say recovered=true and criterion matched
    const verdicts = [true, true, true];
    assert.strictEqual(reg.adjudicate(verdicts), "CERTIFIED");
  });

  it("adjudicate: UNVERIFIABLE when verdicts disagree", () => {
    const reg = groundedRegulator(minimalCriterion);
    const verdicts = [true, false, true];
    assert.strictEqual(reg.adjudicate(verdicts), "UNVERIFIABLE");
  });

  it("adjudicate: UNVERIFIABLE when all verdicts are false", () => {
    const reg = groundedRegulator(minimalCriterion);
    const verdicts = [false, false];
    assert.strictEqual(reg.adjudicate(verdicts), "UNVERIFIABLE");
  });

  it("adjudicate: handles object verdicts {recovered, matches}", () => {
    const reg = groundedRegulator(minimalCriterion);
    const verdicts = [
      { recovered: true, matches: true },
      { recovered: true, matches: true },
    ];
    assert.strictEqual(reg.adjudicate(verdicts), "CERTIFIED");
  });

  it("adjudicate: UNVERIFIABLE when object verdict has matches:false", () => {
    const reg = groundedRegulator(minimalCriterion);
    const verdicts = [
      { recovered: true, matches: true },
      { recovered: true, matches: false },
    ];
    assert.strictEqual(reg.adjudicate(verdicts), "UNVERIFIABLE");
  });

  it("adjudicate: single verdict that passes → CERTIFIED", () => {
    const reg = groundedRegulator(minimalCriterion);
    assert.strictEqual(reg.adjudicate([true]), "CERTIFIED");
  });

  it("adjudicate: empty verdicts → UNVERIFIABLE", () => {
    const reg = groundedRegulator(minimalCriterion);
    assert.strictEqual(reg.adjudicate([]), "UNVERIFIABLE");
  });

  it("disclosure mentions 'grounded' or 'criterion'", () => {
    const reg = groundedRegulator(minimalCriterion);
    const lower = reg.disclosure.toLowerCase();
    assert.ok(
      lower.includes("grounded") || lower.includes("criterion"),
      `disclosure should mention 'grounded' or 'criterion': "${reg.disclosure}"`
    );
  });
});

// ── modelRegulator ───────────────────────────────────────────────────────────

describe("modelRegulator — unreachable endpoint falls back gracefully", () => {
  it("resolves (does not throw) when endpoint is unreachable", async () => {
    // port 9 is discard; should refuse immediately or time out fast
    let result;
    let threw = false;
    try {
      result = await modelRegulator({
        endpoint: "http://127.0.0.1:9/nope",
        criterion: minimalCriterion,
      });
    } catch {
      threw = true;
    }
    assert.strictEqual(threw, false, "modelRegulator must never throw");
    assert.ok(result, "should return a regulator object");
  });

  it("fallback regulator has connected:false", async () => {
    const reg = await modelRegulator({
      endpoint: "http://127.0.0.1:9/nope",
      criterion: minimalCriterion,
    });
    assert.strictEqual(reg.connected, false);
  });

  it("fallback disclosure mentions fallback / model unreachable", async () => {
    const reg = await modelRegulator({
      endpoint: "http://127.0.0.1:9/nope",
      criterion: minimalCriterion,
    });
    const lower = reg.disclosure.toLowerCase();
    assert.ok(
      lower.includes("fallback") || lower.includes("unreachable") || lower.includes("grounded"),
      `fallback disclosure should mention fallback/unreachable/grounded: "${reg.disclosure}"`
    );
  });

  it("fallback weigh/adjudicate still work (functional grounded fallback)", async () => {
    const reg = await modelRegulator({
      endpoint: "http://127.0.0.1:9/nope",
      criterion: minimalCriterion,
    });
    const { labels, channelA, channelB } = makeTwoClassData(6);
    const weights = reg.weigh([channelA, channelB], labels);
    assert.strictEqual(weights.length, 2);
    assert.ok(weights[0] > weights[1], "discriminative channel should dominate even in fallback");

    const verdict = reg.adjudicate([true, true]);
    assert.strictEqual(verdict, "CERTIFIED");
  });
});

describe("modelRegulator — injected fake fetch (connected path)", () => {
  it("connected:true when fetch returns a valid model response", async () => {
    // Fake fetchImpl that returns a canned chat completion response
    const cannedResponse = {
      id: "chatcmpl-test",
      object: "chat.completion",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: JSON.stringify({
              channelRanks: [1, 0],
              adjudication: "CERTIFIED",
            }),
          },
          finish_reason: "stop",
        },
      ],
    };

    const fakeFetch = async (_url, _opts) => ({
      ok: true,
      status: 200,
      json: async () => cannedResponse,
    });

    const reg = await modelRegulator({
      endpoint: "http://fake-model-endpoint/v1",
      key: "test-key",
      model: "test-model",
      criterion: minimalCriterion,
      fetchImpl: fakeFetch,
    });

    assert.strictEqual(reg.connected, true);
    assert.ok(typeof reg.disclosure === "string" && reg.disclosure.length > 0);
  });

  it("connected model weigh/adjudicate are callable", async () => {
    const cannedResponse = {
      choices: [
        {
          message: {
            role: "assistant",
            content: JSON.stringify({
              channelRanks: [1, 0],
              adjudication: "CERTIFIED",
            }),
          },
          finish_reason: "stop",
        },
      ],
    };

    const fakeFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => cannedResponse,
    });

    const reg = await modelRegulator({
      endpoint: "http://fake/v1",
      criterion: minimalCriterion,
      fetchImpl: fakeFetch,
    });

    const { labels, channelA, channelB } = makeTwoClassData(4);
    const weights = reg.weigh([channelA, channelB], labels);
    assert.strictEqual(weights.length, 2);

    const verdict = reg.adjudicate([true, true]);
    assert.ok(
      verdict === "CERTIFIED" || verdict === "UNVERIFIABLE",
      `adjudicate must return CERTIFIED or UNVERIFIABLE, got "${verdict}"`
    );
  });

  it("falls back (connected:false) when fetch returns non-200", async () => {
    const fakeFetch = async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: "server error" }),
    });

    const reg = await modelRegulator({
      endpoint: "http://fake/v1",
      criterion: minimalCriterion,
      fetchImpl: fakeFetch,
    });

    assert.strictEqual(reg.connected, false);
  });

  it("falls back (connected:false) when fetch throws", async () => {
    const fakeFetch = async () => {
      throw new Error("network failure");
    };

    const reg = await modelRegulator({
      endpoint: "http://fake/v1",
      criterion: minimalCriterion,
      fetchImpl: fakeFetch,
    });

    assert.strictEqual(reg.connected, false);
  });
});
