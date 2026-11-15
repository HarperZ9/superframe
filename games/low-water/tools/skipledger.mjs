// The skip ledger: a node:test reporter that counts the tests that did not run in full against a written list
// (tools/skips.json). Two kinds are counted, and neither is a pass:
//   - a skipped test. Plate bakes are untracked renders, so a test that reads one skips on a checkout without them.
//   - an expected failure: a test whose rule does not hold today, kept in the run asserting its known failure, with
//     "(expected failure, issue N" in its name. It turns red by itself when the rule starts to hold.
// The reporter prints both counts and fails the run when either kind appears that the list does not name. A listed
// test that runs (the bake is present) is fine. Adding a name to the list is a reviewed change with an issue.
//   node --test --test-reporter=spec --test-reporter-destination=stdout \
//        --test-reporter=./games/low-water/tools/skipledger.mjs --test-reporter-destination=stdout <files>
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { relative, resolve, sep } from "node:path";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));   // games/low-water
export const LIST = fileURLToPath(new URL("./skips.json", import.meta.url));
export const keyOf = (file) => relative(ROOT, resolve(String(file || ""))).split(sep).join("/");
export const EXPECTED = /\(expected failure, issue (\d+)/;
const count = (table) => Object.values(table || {}).reduce((n, a) => n + a.length, 0);
const named = (table, t) => ((table || {})[t.file] || []).includes(t.name);

// seen: [{ file, name, why }] of the run's skipped tests; expected: [{ file, name, issue }] of its expected failures;
// list: the parsed skips.json
export function judge(seen, list, expected = []) {
  const unlisted = seen.filter((s) => !named(list.skips, s)), unlistedX = expected.filter((x) => !named(list.expected, x));
  const lines = [`${seen.length} tests skipped: ${list.reason} (the list allows ${count(list.skips)})`,
    `${expected.length} expected failures kept in the run${expected.length ? `: ${[...new Set(expected.map((x) => `issue ${x.issue}`))].join(", ")}` : ""} (the list allows ${count(list.expected)})`];
  for (const s of unlisted) lines.push(`skip not on the list: ${s.file}: "${s.name}" (${s.why})`);
  for (const x of unlistedX) lines.push(`expected failure not on the list: ${x.file}: "${x.name}"`);
  const n = unlisted.length + unlistedX.length;
  if (n) lines.push(`${n} test(s) are not in games/low-water/tools/skips.json: fix the test, or list it there with its issue in a reviewed change`);
  return { ok: n === 0, unlisted, unlistedX, lines };
}

export default async function* skipLedger(source) {
  const seen = [], expected = [];
  for await (const e of source) {
    if (e.type !== "test:pass" && e.type !== "test:fail") continue;
    const why = e.data.skip, file = keyOf(e.data.file), name = e.data.name, x = EXPECTED.exec(name);
    if (why !== undefined && why !== false) seen.push({ file, name, why: why === true || why === "" ? "no reason given" : String(why) });
    else if (x) expected.push({ file, name, issue: x[1] });
  }
  const v = judge(seen, JSON.parse(readFileSync(LIST, "utf8")), expected);
  if (!v.ok) process.exitCode = 1;
  yield `\n${v.lines.join("\n")}\n`;
}
