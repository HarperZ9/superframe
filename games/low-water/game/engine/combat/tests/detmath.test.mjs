// P0: the combat sim's math is the deterministic set in sim/math.mjs (design/DETMATH.md), and the
// same seed gives a byte-identical combat trace.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { HERE } from "./helpers.mjs";
import { dsin, dcos, datan2, dasin, dacos, dexp, dhypot, DPI } from "../sim/math.mjs";
import { traceCorpusRun, ARENA_IDS } from "../tools/trace.mjs";

const bits = (x) => { const b = new DataView(new ArrayBuffer(8)); b.setFloat64(0, x); return b.getBigUint64(0).toString(16).padStart(16, "0"); };

test("the deterministic set stays within 2 ulp-scale of libm over the sim's range", () => {
  let s = 7; const r = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let i = 0; i < 20000; i++) {
    const x = (r() - 0.5) * 40, y = (r() - 0.5) * 40, u = r() * 2 - 1, z = (r() - 0.5) * 20;
    assert.ok(Math.abs(dsin(x) - Math.sin(x)) < 3e-16 && Math.abs(dcos(x) - Math.cos(x)) < 3e-16, `sin/cos ${x}`);
    assert.ok(Math.abs(datan2(y, x) - Math.atan2(y, x)) < 1e-15, `atan2 ${y} ${x}`);
    assert.ok(Math.abs(dasin(u) - Math.asin(u)) < 1e-15 && Math.abs(dacos(u) - Math.acos(u)) < 1e-15, `asin/acos ${u}`);
    assert.ok(Math.abs(dexp(z) / Math.exp(z) - 1) < 5e-16, `exp ${z}`);
  }
  assert.equal(datan2(0, -1), DPI); assert.equal(datan2(-0, -1), -DPI); assert.ok(Object.is(datan2(-0, 1), -0));
  assert.equal(dexp(0), 1); assert.equal(dexp(-800), 0); assert.equal(dhypot(3, 4), 5);
});

// Golden bits: the C++ port's math test checks these same 12 values (design/DETMATH.md section 3).
// A change here is a change to the specified algorithm, and DETMATH.md changes with it.
test("golden bit patterns for the C++ port", () => {
  const got = [dsin(0.5), dsin(-2.75), dcos(1.25), dcos(10), datan2(1, 3), datan2(-2, -0.5), dasin(0.3), dacos(-0.7), dexp(-0.0333), dexp(4.2), dhypot(1.5, 2.25), dsin(1000)].map(bits);
  const want = JSON.parse(readFileSync(join(HERE, "detmath-golden.json"), "utf8"));
  assert.deepEqual(got, want);
});

test("no libm call is left in the combat sim or AI", () => {
  const dirs = ["sim", "ai"].map((d) => join(HERE, "..", d));
  const files = dirs.flatMap((d) => readdirSync(d).filter((f) => f.endsWith(".mjs") && f !== "math.mjs").map((f) => join(d, f)));
  files.push(join(HERE, "..", "encounter.mjs"), join(HERE, "..", "arena", "innerworld.mjs"), join(HERE, "..", "arena", "innerspawn.mjs"), join(HERE, "..", "arena", "hostworld.mjs"));
  const bad = files.flatMap((f) => (readFileSync(f, "utf8").match(/Math\.(sin|cos|tan|atan2?|asin|acos|pow|exp|log\w*|hypot|cbrt|sinh|cosh|tanh)\(/g) || []).map((m) => `${f}: ${m}`));
  assert.deepEqual(bad, []);
});

test("the same seed gives a byte-identical combat trace, over every arena", () => {
  const n = Math.max(ARENA_IDS.length, 14);
  for (let i = 0; i < n; i++) {
    const a = traceCorpusRun(i, 600), b = traceCorpusRun(i, 600);
    assert.equal(a.text, b.text, a.name);
    assert.ok(a.text.split("\n")[0].startsWith('{"t":"cbegin","v":1,'), a.name);
    assert.match(a.text, /"t":"cend"/);
  }
  assert.notEqual(traceCorpusRun(0, 300).text, traceCorpusRun(ARENA_IDS.length, 300).text); // a different seed differs
});
