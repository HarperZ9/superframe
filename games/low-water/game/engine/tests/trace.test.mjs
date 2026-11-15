// The trace recorder (tools/tracer.mjs): the same seed gives a byte-identical trace, a different seed does not,
// and the checked-in golden subset still matches what the engine records now. The full corpus is regenerated
// with tools/record-corpus.sh and checked against tests/traces/manifest.json.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const here = dirname(fileURLToPath(import.meta.url)), root = join(here, ".."), T = join(here, "traces");
const act = join(T, "content", "slice.lwd"), tmp = mkdtempSync(join(tmpdir(), "lwtrace-"));
const record = (build, seed, name, extra = []) => {
  const out = join(tmp, name);
  execFileSync(process.execPath, [join(root, "tools", "playthrough.mjs"), "--acts", act, "--build", build, "--seed", String(seed), "--tracefile", out, ...extra], { cwd: root, env: { ...process.env, LW_STORY: "quota" }, stdio: "ignore" });
  return readFileSync(out);
};

test("same seed, byte-identical trace (both classes)", () => {
  for (const b of ["inspector", "militia"]) assert.ok(record(b, 4, `a-${b}`).equals(record(b, 4, `b-${b}`)), b);
});
test("a different seed changes the trace", () => {
  assert.ok(!record("militia", 4, "s4").equals(record("militia", 5, "s5")));
});
test("the era 1 cut is a prefix run that ends in a stop record", () => {
  const a = record("inspector", 2, "e1a", ["--until", "e1."]).toString(), b = record("inspector", 2, "e1b", ["--until", "e1."]).toString();
  assert.equal(a, b);
  const last = a.trimEnd().split("\n").pop();
  assert.equal(JSON.parse(last).t, "stop");
});
test("every record is one canonical JSON line with a known type", () => {
  const known = new Set("begin node line offer take var flag time place end rng h ev talk next scene after stop".split(" "));
  for (const l of record("militia", 1, "c").toString().trimEnd().split("\n")) { const o = JSON.parse(l); assert.ok(known.has(o.t), l.slice(0, 60)); assert.equal(JSON.stringify(o), l); }
});
test("the golden subset matches a fresh recording and the manifest hashes", () => {
  const m = JSON.parse(readFileSync(join(T, "manifest.json"), "utf8"));
  for (const [file, build, seed, extra] of [["inspector-s01.jsonl", "inspector", 1, []], ["militia-s01.jsonl", "militia", 1, []], ["e1-inspector-s01.jsonl", "inspector", 1, ["--until", "e1."]], ["e1-militia-s01.jsonl", "militia", 1, ["--until", "e1."]]]) {
    const gold = readFileSync(join(T, file)), fresh = record(build, seed, file, extra);
    assert.ok(gold.equals(fresh), `${file} differs from a fresh recording`);
    assert.equal(m.traces.find((r) => r.file === file).sha256, createHash("sha256").update(gold).digest("hex"));
  }
});
