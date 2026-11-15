// The skip ledger (tools/skipledger.mjs): a skipped test is counted, a skip the list does not name fails the run,
// and a listed test that ran is fine. The last test runs the reporter on a planted file and reads its exit code.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { judge, LIST, EXPECTED } from "../skipledger.mjs";

const list = { reason: "plate bake absent", skips: { "a.test.mjs": ["reads the plate", "reads the geo"] } };

test("listed skips are counted and pass; fewer skips than the list pass", () => {
  const all = judge([{ file: "a.test.mjs", name: "reads the plate", why: "no bake" }, { file: "a.test.mjs", name: "reads the geo", why: "no bake" }], list);
  assert.equal(all.ok, true); assert.equal(all.lines[0], "2 tests skipped: plate bake absent (the list allows 2)");
  const none = judge([], list);
  assert.equal(none.ok, true); assert.equal(none.lines[0], "0 tests skipped: plate bake absent (the list allows 2)");
});

test("control: a skip the list does not name fails, by name and by file", () => {
  const byName = judge([{ file: "a.test.mjs", name: "a new skip", why: "later" }], list);
  assert.equal(byName.ok, false); assert.match(byName.lines.join("\n"), /skip not on the list: a\.test\.mjs: "a new skip" \(later\)/);
  const byFile = judge([{ file: "b.test.mjs", name: "reads the plate", why: "no bake" }], list);
  assert.equal(byFile.ok, false, "the same name in another file is another test");
});

test("an expected failure is counted by its issue, and one the list does not name fails (control)", () => {
  const X = { file: "p.test.mjs", name: "the lock is current (expected failure, issue 7: behind)", issue: "7" };
  const ok = judge([], { ...list, expected: { "p.test.mjs": [X.name] } }, [X]);
  assert.equal(ok.ok, true); assert.equal(ok.lines[1], "1 expected failures kept in the run: issue 7 (the list allows 1)");
  const bad = judge([], list, [X]);
  assert.equal(bad.ok, false); assert.match(bad.lines.join(" | "), /expected failure not on the list: p\.test\.mjs/);
});

test("the list on disk names tests that exist, each once", () => {
  const L = JSON.parse(readFileSync(LIST, "utf8")), root = new URL("../../", import.meta.url);
  assert.ok(L.reason && L.why);
  for (const names of Object.values(L.expected)) for (const n of names) assert.match(n, EXPECTED, "an expected failure names its issue");
  for (const [file, names] of [...Object.entries(L.skips), ...Object.entries(L.expected)]) {
    const src = readFileSync(new URL(file, root), "utf8");
    assert.equal(new Set(names).size, names.length, `${file}: a name twice`);
    // a name built from a template (`${enc} on the ${plate} plate: ...`) is matched on its fixed tail
    for (const n of names) assert.ok(src.includes(n) || src.includes(n.slice(n.indexOf(" plate: ") + 1)), `${file}: no test named "${n}"`);
  }
});

test("control: the reporter turns a passing run red when a test skips off the list", () => {
  const dir = mkdtempSync(join(tmpdir(), "lwskip-")), f = join(dir, "planted.test.mjs");
  writeFileSync(f, 'import { test } from "node:test";\ntest("runs", () => {});\ntest("planted skip", { skip: "to get a merge" }, () => {});\n');
  const reporter = new URL("../skipledger.mjs", import.meta.url).href;   // a file: URL, which the loader takes on every platform
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;   // the child is its own run, not a subtest of this one
  const r = spawnSync(process.execPath, ["--test", `--test-reporter=${reporter}`, "--test-reporter-destination=stdout", f], { encoding: "utf8", env });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /1 tests skipped: plate bake absent/);
  assert.match(r.stdout, /skip not on the list: .*planted\.test\.mjs: "planted skip" \(to get a merge\)/);
  assert.match(r.stdout, /0 expected failures kept in the run \(the list allows 1\)/);
});
