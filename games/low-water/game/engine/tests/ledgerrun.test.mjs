// tools/ledgerrun.mjs (W1-A, 2026-10-22): it must cover every row of the ledger's measurement record, read
// each tool's output to the right verdict, and fail where a check fails. Controls plant a failing output or
// command and expect FAIL; no test here starts a browser or a checker.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { checks, nodeTest, playtime, dialogue, visual, bench, events, harness, shell, runCheck, runAll, table } from "../tools/ledgerrun.mjs";

const ledger = readFileSync(new URL("../../../design/COMPLETION.md", import.meta.url), "utf8");
const section5 = () => { const s = ledger.slice(ledger.indexOf("## 5. Measurement record")), end = s.indexOf("\n---"); return s.slice(0, end).split("\n").filter((l) => /^\| /.test(l) && !/^\| What \|/.test(l)).map((l) => l.split("|")[1].trim().replace(/ \(\d{4}-\d\d-\d\d, W\d-[A-Z]\)$/, "")); };   // a package's dated row, "(2026-10-23, W1-C)", is named without its tag

test("every row of COMPLETION.md section 5 has a check, and every check belongs to a row", () => {
  const rows = section5(), list = checks(tmpdir(), 8791);
  assert.ok(rows.length >= 25, `section 5 read as ${rows.length} rows`);
  for (const r of rows) assert.ok(list.some((c) => c.what.startsWith(r)), `no check for the row "${r}": add one to tools/ledgerrun.mjs`);
  for (const c of list) assert.ok(rows.some((r) => c.what.startsWith(r)), `check ${c.id} ("${c.what}") has no row in section 5`);
  assert.equal(new Set(list.map((c) => c.id)).size, list.length, "check ids are unique");
});

test("node --test summaries: a fail count of 0 passes, any other fails (control)", () => {
  const out = (f) => `ℹ tests 319\nℹ pass ${319 - f}\nℹ fail ${f}\nℹ duration_ms 12142.4`;
  assert.deepEqual(nodeTest(out(0), 0), { result: "319 tests, 319 pass, 0 fail, 12.1 s", gate: "PASS" });
  assert.equal(nodeTest(out(1), 1).gate, "FAIL");
  assert.equal(nodeTest("crashed before the runner", 1).gate, "FAIL");
});

test("playtime: a run that reads 0 words fails the gate (S24), named classes alone pass", () => {
  const named = "inspector act 1: 71 min (57 to 93); 14991 words in 39 beats, 12 choices\nmilitia  act 1: 88 min (69 to 115); 18120 words in 54 beats, 15 choices\n";
  assert.deepEqual(playtime(named, 0), { result: "inspector 71 min (57 to 93); militia 88 min (69 to 115)", gate: "PASS" });
  const random = "random:1 act 1: 1 min (0 to 2); 0 words in 0 beats, 14 choices\nrandom:2 act 1: 1 min (0 to 1); 0 words in 0 beats, 11 choices\n";
  assert.deepEqual(playtime(random, 0), { result: "random 2 runs, 2 read as 0 words", gate: "FAIL" });
  assert.equal(playtime("", 0).gate, "FAIL");
});

test("dialogue lint: the six hard rules gate, mirrored-pair only reports", () => {
  const out = (h) => `524 spoken lines read, 45 flagged (8.6 percent)\n  self-definition            ${h}  x\n  corrective-negation        0  x\n  mirrored-pair             42  x\n`;
  assert.deepEqual(dialogue(out(1), 0), { result: "524 lines, 45 flagged; hard rules 1 (self-definition 1), mirrored-pair 42", gate: "FAIL" });
  assert.equal(dialogue(out(0), 0).gate, "PASS");
});

test("visual check: views, controls and a blind control are counted apart", () => {
  const out = ["pass  q-returns              figures 3", "FAIL  q-office               figures 4", "ctrl  control-two-in-one-spot failed as it must", "FAIL  control-lit-floor-dark-figures PASSED: the check is blind to what this control plants", "", "VISUAL CHECK FAILED: 2 of 4 views"].join("\n");
  assert.deepEqual(visual(out, 1), { result: "1 of 2 views pass, 1 controls fail as they must, 1 control(s) blind; failing: q-office, control-lit-floor-dark-figures", gate: "FAIL" });
});

test("bench: a busy machine reads NOT QUIET, a failed view FAIL, a quiet frame under 16.7 ms PASS", () => {
  const view = { gpu: { frameMs: 16.67, frameP95: 16.7, shownMs: { lamb: 17.5 }, pool: { jobs: 479 } } };
  assert.equal(bench({ "quota-granary": view, _machine: { quiet: false, loadBefore: 96, loadAfter: 85 } }).gate, "NOT QUIET");
  assert.equal(bench({ "quota-square": { gpu: { error: "Unexpected token 'E'" } }, _machine: { quiet: true } }).gate, "FAIL");
  assert.equal(bench({ "quota-granary": view, _machine: { quiet: true, loadBefore: 4, loadAfter: 6 } }).gate, "PASS");
  assert.equal(bench({ "quota-granary": { gpu: { ...view.gpu, frameP95: 18.2 } }, _machine: { quiet: true } }).gate, "FAIL");
  assert.equal(bench(null).gate, "FAIL");
});

test("eventcheck and the harness: one disagreement or one unfinished run fails (controls)", () => {
  assert.equal(events("231 beats read, 0 statements of the time, 0 disagree with the clock\n231 beats read, 0 tide lines disagree with the tide clock\nwaiting row: 0 offers of the state the tide is already in", 0).gate, "PASS");
  assert.equal(events("231 beats read, 1 tide lines disagree with the tide clock", 0).gate, "FAIL");
  assert.equal(harness("== inspector (menu shuffle 101): FINISHED (12 steps); fights won 0 of 0\n== militia (menu shuffle 101): STUCK at q.x; fights won 1 of 1", 0).gate, "FAIL");
});

test("a command that exits non-zero is reported with its exit code and fails the gate (control)", async () => {
  const bad = await runCheck({ id: "x", at: "root", cmd: ["node", "-e", "console.log('22 file(s), 194 nodes, 0 error(s), 0 warning(s)'); process.exit(3)"], parse: (o, rc) => ({ result: o.trim(), gate: rc === 0 ? "PASS" : "FAIL" }) });
  assert.equal(bad.tool, "exit 3"); assert.equal(bad.gate, "FAIL");
  const good = await runCheck({ id: "y", at: "root", cmd: ["node", "-e", "console.log(process.env.LW_STORY)"], parse: (o) => ({ result: o.trim(), gate: "PASS" }) });
  assert.equal(good.result, "quota", "the checkers run with LW_STORY=quota");
});

test("a check waits for the checks it reads (after), and the table escapes pipes", async () => {
  const order = [], mk = (id, ms, after) => ({ id, what: id, at: "root", after, cmd: ["node", "-e", `setTimeout(() => {}, ${ms})`], parse: () => ({ result: "a | b", gate: "PASS" }) });
  const rows = await runAll([mk("reader", 0, ["writer"]), mk("writer", 300)], 2, (c) => order.push(c.id));
  assert.deepEqual(order, ["writer", "reader"]);
  const t = table(rows);
  assert.match(t, /\| a \\\| b \|/);
  assert.equal(t.split("\n").length, 4);
});

test("a browser row measured on plain figures fails, whatever else it says (controls)", () => {
  const sum = { cls: 1, steps: [{ n: 1 }, { chose: "x" }], stills: ["a.png"], fights: 1, ended: true, stalls: [], logs: ["warning: something else"] };
  assert.equal(shell(sum, 0).gate, "PASS");
  const plain = shell({ ...sum, logs: ["warning: figures: character pipeline not loaded (Failed to fetch); plain figures"] }, 0);
  assert.equal(plain.gate, "FAIL"); assert.match(plain.result, /^PLAIN FIGURES/);
  const out = ["pass  q-returns              figures 3", "ctrl  control-two-in-one-spot failed as it must"].join("\n");
  assert.equal(visual(out, 0, [{ view: "q-returns", logs: [] }]).gate, "PASS");
  assert.equal(visual(out, 0, [{ view: "q-returns", logs: ["warning: figures: character pipeline not loaded (x); plain figures"] }]).gate, "FAIL");
  const v = { gpu: { frameMs: 16.67, frameP95: 16.7, shownMs: {}, pool: null } };
  assert.match(bench({ "quota-talk": v, _machine: { quiet: true } }).result, /no figure images drawn/);
  assert.equal(bench({ "quota-talk": v, _machine: { quiet: false } }).gate, "FAIL");
});
