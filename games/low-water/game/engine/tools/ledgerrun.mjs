// One command for the completion ledger's measurement record (design/COMPLETION.md section 5, W1-A,
// 2026-10-22): runs every checker the record names and prints its table, one row per check, with what the
// tool said, the ledger's gate on it and the wall time. The engine's checkers run from game/engine with
// LW_STORY=quota, as the ledger states; the rest from the project root.
//   node tools/ledgerrun.mjs [--browser] [--only id,id] [--jobs 4] [--port 8791] [--json file] [--work dir]
// Without --browser the browser rows (the shell, the visual check, the frame bench) are listed as not run.
// With it a private server starts on --port (or one already there is used), the shell and the visual check
// run under one heavy-cpu lock with the rest, and the bench runs last, outside that lock (it waits for heavy
// jobs to end). Columns: Tool is the exit status; Gate is the ledger's condition on the result (PASS, FAIL,
// "-" for none, NOT QUIET for a frame time on a busy machine). Exits 1 when any gate fails or a tool errs.
import { spawn } from "node:child_process";
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { cpus, tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ENGINE = join(dirname(fileURLToPath(import.meta.url)), ".."), ROOT = join(ENGINE, "..", "..");
const num = (re, s, d = null) => { const m = re.exec(s); return m ? +m[1] : d; };
const last = (s, re) => s.split(/\r?\n/).filter((l) => re.test(l)).pop() || "";
const gate = (ok) => (ok ? "PASS" : "FAIL");
// a browser row measured on plain figures is not a measurement of the game: the page says so when the
// character pipeline fails to load (ui/figures.mjs), and that fails the row
const PLAIN = /character pipeline not loaded/;

// ---------------------------------------------------------------- parsers: (out, rc) -> { result, gate }
export function nodeTest(out, rc) {
  const n = num(/ℹ tests (\d+)/, out), p = num(/ℹ pass (\d+)/, out), f = num(/ℹ fail (\d+)/, out), ms = num(/ℹ duration_ms ([\d.]+)/, out);
  if (n == null) return { result: "no test summary in the output", gate: "FAIL" };
  return { result: `${n} tests, ${p} pass, ${f} fail, ${(ms / 1000).toFixed(1)} s`, gate: gate(rc === 0 && f === 0) };
}
export function characters(outs) {
  const bad = outs.filter((o) => o.rc !== 0 || /^(FAIL|not ok)\b/m.test(o.out)), pick = (name, re) => { const o = outs.find((x) => x.name === name); return o ? last(o.out, re).trim() : null; };
  const notes = [pick("heads_test", /^heads:/), pick("quota_test", /^quota:/), pick("anim_bounds_test", /^anim bounds:/)].filter(Boolean);
  return { result: `${outs.length} files, ${outs.length - bad.length} end on ok lines${bad.length ? ` (failing: ${bad.map((o) => o.name).join(", ")})` : ""}; ${notes.join("; ")}`, gate: gate(!bad.length) };
}
export const lastLine = (re, ok) => (out, rc) => { const l = last(out, re).trim(); return { result: l || "no summary line", gate: !l ? "FAIL" : ok ? gate(rc === 0 && ok(l, out)) : rc === 0 ? "-" : "FAIL" }; };
export function harness(out, rc) {
  const runs = (out.match(/^== .*$/gm) || []), done = runs.filter((l) => /FINISHED/.test(l)), won = [...out.matchAll(/fights won (\d+) of (\d+)/g)];
  const fights = won.reduce((a, m) => [a[0] + +m[1], a[1] + +m[2]], [0, 0]);
  return { result: `${done.length} of ${runs.length} FINISHED; fights won ${fights[0]} of ${fights[1]}`, gate: gate(rc === 0 && runs.length > 0 && done.length === runs.length) };
}
// playtime: each run's minutes; a run that reads 0 words fails the gate (S24: the model misses random runs)
export function playtime(out, rc) {
  const rows = [...out.matchAll(/^(\S+)\s+act 1: (\d+) min \((\d+) to (\d+)\); (\d+) words/gm)].map((m) => ({ who: m[1], min: +m[2], lo: +m[3], hi: +m[4], words: +m[5] }));
  if (!rows.length) return { result: "no runs in the output", gate: "FAIL" };
  const zero = rows.filter((r) => r.words === 0), named = rows.filter((r) => !/^random:/.test(r.who));
  const text = named.map((r) => `${r.who} ${r.min} min (${r.lo} to ${r.hi})`);
  if (rows.length > named.length) text.push(`random ${rows.length - named.length} runs, ${zero.length} read as 0 words`);
  return { result: text.join("; "), gate: gate(rc === 0 && !zero.length) };
}
// eventcheck prints one summary per lint (the clock, the tide, the waiting row); every count must be 0
export function events(out, rc) {
  const d = [...out.matchAll(/(\d+) (?:disagree|tide lines disagree|offers of the state)/g)].map((m) => +m[1]), t = d.reduce((a, b) => a + b, 0), beats = Math.max(0, ...[...out.matchAll(/(\d+) beats read/g)].map((m) => +m[1]));
  return { result: `${t} disagreements in ${d.length} lint summaries, up to ${beats} beats read`, gate: gate(rc === 0 && d.length > 0 && t === 0) };
}
export function dialogue(out, rc) {
  const read = num(/(\d+) spoken lines read/, out), flagged = num(/, (\d+) flagged/, out), rule = (k) => num(new RegExp(`^\\s+${k}\\s+(\\d+)`, "m"), out, 0);
  const hard = ["semicolon-pair", "there-here", "abstract-definition", "self-definition", "corrective-negation", "summary-zinger"].map((k) => [k, rule(k)]).filter(([, n]) => n);
  const h = hard.reduce((a, [, n]) => a + n, 0);
  return { result: `${read} lines, ${flagged} flagged; hard rules ${h}${hard.length ? ` (${hard.map(([k, n]) => `${k} ${n}`).join(", ")})` : ""}, mirrored-pair ${rule("mirrored-pair")}`, gate: gate(rc === 0 && h === 0) };
}
export function shell(sum, rc) {
  if (!sum) return { result: "no summary.json", gate: "FAIL" };
  const errs = sum.logs.filter((l) => /^(exception|error):/.test(l)).length, warns = sum.logs.filter((l) => /^warning:/.test(l)).length, choices = sum.steps.filter((s) => s.chose).length;
  const plain = sum.logs.some((l) => PLAIN.test(l));
  return { result: `${plain ? "PLAIN FIGURES (the character pipeline did not load); " : ""}class ${sum.cls}: ${sum.steps.length} steps (${choices} choices), ${sum.stills.length} stills, ${sum.fights} fight(s), ${sum.ended ? "ended" : "did not end"}, ${sum.stalls.length} stalls, ${errs} errors, ${warns} warnings`, gate: gate(rc === 0 && sum.ended && !sum.stalls.length && !errs && !plain) };
}
export function visual(out, rc, report = null) {
  const n = (re) => (out.match(re) || []).length, pass = n(/^pass {2}/gm), fail = n(/^FAIL {2}(?!control)/gm), ctrl = n(/^ctrl {2}/gm), blind = n(/^FAIL {2}\S+.*PASSED: the check is blind/gm);
  const failed = [...out.matchAll(/^FAIL {2}(\S+)/gm)].map((m) => m[1]), plain = !!report && report.some((r) => (r.logs || []).some((l) => PLAIN.test(l)));
  return { result: `${plain ? "PLAIN FIGURES (the character pipeline did not load); " : ""}${pass} of ${pass + fail} views pass, ${ctrl} controls fail as they must, ${blind} control(s) blind${failed.length ? `; failing: ${failed.join(", ")}` : ""}`, gate: gate(rc === 0 && !plain) };
}
export function bench(res) {
  if (!res) return { result: "no bench output", gate: "FAIL" };
  const M = res._machine || {}, rows = Object.entries(res).filter(([k]) => k !== "_machine").map(([id, R]) => {
    const g = R.gpu || {}; if (g.error || g.frameMs == null) return { id, txt: `${id} failed (${g.error || "no frames"})`, ok: false };
    if (!g.pool) return { id, txt: `${id} failed (no figure images drawn: plain figures)`, ok: false };
    const shown = g.shownMs && (g.shownMs.lamb ?? Object.values(g.shownMs)[0]);
    return { id, txt: `${id} ${g.frameMs} ms (p95 ${g.frameP95})${shown != null ? `, shown ${shown} ms` : ""}${g.errors ? ` [${g.errors.join("; ").slice(0, 120)}]` : ""}`, ok: g.frameP95 <= 16.7 };
  });
  const quiet = !!M.quiet, all = rows.length && rows.every((r) => r.ok);
  return { result: `${rows.map((r) => r.txt).join("; ")}; load ${M.loadBefore} % before, ${M.loadAfter} % after${quiet ? "" : ", NOT QUIET"}`, gate: !rows.every((r) => !/failed/.test(r.txt)) ? "FAIL" : quiet ? gate(all) : "NOT QUIET" };
}

// ---------------------------------------------------------------- the checks, in section 5's order
const E = "engine", R = "root", node = (...a) => ["node", ...a];
const okNoErr = (l) => / 0 error\(s\)/.test(l);
export function checks(work, port) {
  const chars = readdirSync(join(ROOT, "characters", "proto")).filter((f) => /_test\.mjs$/.test(f)).sort();
  const q = "../../content/quota/slice.lwd", P = String(port);
  return [
    { id: "tests", what: "Engine tests", at: E, cmd: node("--test", "tests/*.test.mjs"), parse: nodeTest },
    { id: "combat", what: "Combat tests", at: E, cmd: node("--test", "combat/tests/*.test.mjs"), parse: nodeTest },
    { id: "characters", what: "Character tests", at: R, show: `node characters/proto/<name>_test.mjs for ${chars.length} files`, cmds: chars.map((f) => ({ name: f.replace(/\.mjs$/, ""), cmd: node(`characters/proto/${f}`) })), parseAll: characters },
    { id: "validate", what: "Validator", at: E, cmd: node("tools/validate.mjs", q), parse: lastLine(/nodes,/, (l) => / 0 error\(s\), 0 warning\(s\)/.test(l)) },
    { id: "validate-wiring", what: "Validator, with wiring", at: E, cmd: node("tools/validate.mjs", q, "wiring/quota-areas.lwd", "wiring/era1-areas.lwd", "wiring/era3-areas.lwd", "wiring/era4-areas.lwd", "wiring/era5-areas.lwd"), parse: lastLine(/nodes,/, (l) => / 0 error\(s\), 0 warning\(s\)/.test(l)) },
    { id: "proplint", what: "proplint", at: E, cmd: node("tools/proplint.mjs"), parse: lastLine(/props;/, (l) => / 0 error\(s\)/.test(l)) },
    { id: "dirlint", what: "dirlint", at: E, cmd: node("tools/dirlint.mjs", "../../content/quota"), parse: lastLine(/^dirlint:/, (l) => / 0 errors/.test(l)) },
    { id: "flags", what: "flags", at: E, cmd: node("tools/flags.mjs", q), parse: lastLine(/flags set/, (l) => / 0 never read/.test(l)) },
    { id: "communitycheck", what: "communitycheck", at: E, cmd: node("tools/communitycheck.mjs", "--quiet"), parse: lastLine(/seen from a lens|not seen/, (l) => /^every record event's effect is seen/.test(l)) },
    { id: "discoursecheck", what: "discoursecheck", at: E, cmd: node("tools/discoursecheck.mjs"), parse: lastLine(/error\(s\)/, okNoErr) },
    { id: "fatecheck", what: "fatecheck", at: E, cmd: node("tools/fatecheck.mjs"), parse: lastLine(/finished runs/, okNoErr) },
    { id: "witnesscheck", what: "witnesscheck", at: E, cmd: node("tools/witnesscheck.mjs"), parse: lastLine(/witness scenes in/, (l, o) => okNoErr(l) && /0 problem\(s\)/.test(o)) },
    { id: "lorecheck", what: "lorecheck", at: E, cmd: node("tools/lorecheck.mjs"), parse: lastLine(/fresh runs/, okNoErr) },
    { id: "worldcheck", what: "worldcheck", at: E, cmd: node("tools/worldcheck.mjs"), parse: lastLine(/^world record: every check|^FAIL|failed/i, (l) => /every check passed/.test(l)) },
    { id: "dreamcheck", what: "dreamcheck", at: E, cmd: node("tools/dreamcheck.mjs"), parse: lastLine(/dream\(s\) over/, okNoErr) },
    { id: "perspectivecheck", what: "perspectivecheck", at: E, cmd: node("tools/perspectivecheck.mjs"), parse: lastLine(/chapters played/, okNoErr) },
    { id: "devicecheck", what: "devicecheck (no device works by reading or bookkeeping)", at: E, cmd: node("tools/devicecheck.mjs"), parse: lastLine(/^devicecheck:/, (l) => / 0 finding\(s\)/.test(l)) },
    { id: "echocheck", what: "echocheck (fates and world facts met in the world)", at: E, cmd: node("tools/echocheck.mjs"), parse: lastLine(/echoes; /, okNoErr) },
    { id: "propcheck", what: "propcheck", at: E, cmd: node("tools/propcheck.mjs"), parse: lastLine(/never seen/, (l) => / 0 never seen/.test(l)) },
    { id: "eventcheck", what: "eventcheck (with clocklint and tidelint)", at: E, cmd: node("tools/eventcheck.mjs"), parse: events },
    { id: "exitcheck", what: "exitcheck", at: E, cmd: node("tools/exitcheck.mjs"), parse: lastLine(/no way through/, (l) => / 0 pairs with no way through/.test(l)) },
    { id: "harness", what: "Harness", at: E, cmd: node("tools/playthrough.mjs", "--build", "all", "--shuffle", "3", "--beatlog", join(work, "b.jsonl"), "--json", join(work, "t.json")), show: "node tools/playthrough.mjs --build all --shuffle 3 --beatlog b.jsonl --json t.json", parse: harness },
    { id: "harness-random", what: "Harness, random", at: E, cmd: node("tools/playthrough.mjs", "--build", "all", "--shuffle", "3", "--random", "10", "--beatlog", join(work, "br.jsonl"), "--json", join(work, "tr.json")), show: "the same with --random 10", parse: harness },
    { id: "playtime", what: "Playtime", at: E, after: ["harness", "harness-random"], cmd: node("tools/playtime.mjs", join(work, "b.jsonl"), join(work, "t.json")), show: "node tools/playtime.mjs b.jsonl t.json", parse: playtime },
    { id: "playtime-random", what: "Playtime, random", at: E, after: ["harness-random"], cmd: node("tools/playtime.mjs", join(work, "br.jsonl"), join(work, "tr.json")), show: "node tools/playtime.mjs br.jsonl tr.json", parse: playtime },
    { id: "dialogue", what: "Dialogue lint", at: R, cmd: ["python", "content/tools/dialogue_lint.py", "--acts", "content/quota"], parse: dialogue },
    { id: "uicontrast", what: "UI contrast", at: E, cmd: node("tools/uicontrast.mjs"), parse: (o, rc) => ({ result: `rc ${rc}${rc ? "" : ", no ink under 4.5:1"}`, gate: gate(rc === 0) }) },
    { id: "filestore", what: "File store and crash reports", at: E, cmd: node("--test", "tests/filestore.test.mjs"), parse: nodeTest },
    // the traits package's dated row (section 5). Its row also records a before-and-after run of this whole table, which no check can repeat; the part that can fail is its own test file.
    { id: "traits", what: "The traits pass (2026-10-23, feat/traits-embodied, design/TRAITS.md)", at: E, cmd: node("--test", "tests/traits.test.mjs"), parse: nodeTest },
    ...[1, 2].map((c) => ({ id: `shell-${c}`, what: `Browser shell, class ${c}`, at: R, browser: true, cmd: node("game/engine/tools/quota-shell.mjs", "--class", String(c), "--port", P, "--out", join(work, `shell${c}`)), show: `node game/engine/tools/quota-shell.mjs --class ${c} --port ${P} --out <dir>`, parse: (o, rc) => shell(readJson(join(work, `shell${c}`, "summary.json")), rc) })),
    { id: "visual-gullet", what: "Visual check, Gullet views", at: R, browser: true, cmd: node("game/engine/tools/visual-check.mjs", "--port", P, "--out", join(work, "vc-gullet")), show: `node game/engine/tools/visual-check.mjs --port ${P} --out <dir>`, parse: (o, rc) => visual(o, rc, readJson(join(work, "vc-gullet", "report.json"))) },
    { id: "visual-quota", what: "Visual check, Quota views", at: R, browser: true, cmd: node("game/engine/tools/visual-check.mjs", "--port", P, "--query", "content=quota", "--out", join(work, "vc-quota")), show: `node game/engine/tools/visual-check.mjs --port ${P} --query content=quota --out <dir>`, parse: (o, rc) => visual(o, rc, readJson(join(work, "vc-quota", "report.json"))) },
    { id: "bench", what: "Frame bench", at: R, browser: true, outsideHeavy: true, cmd: node("tools/bench.mjs", "--port", P, "--gpu", "1", "--views", "quota-square,quota-granary,quota-talk", "--query", "content=quota", "--out", join(work, "bench.json")), show: `node tools/bench.mjs --port ${P} --gpu 1 --views quota-square,quota-granary,quota-talk --query content=quota`, parse: () => bench(readJson(join(work, "bench.json"))) },
  ];
}
const readJson = (f) => { try { return JSON.parse(readFileSync(f, "utf8")); } catch { return null; } };

// ---------------------------------------------------------------- running
export function run(cmd, cwd, env = {}) {
  return new Promise((res) => {
    const t0 = Date.now(), p = spawn(cmd[0], cmd.slice(1), { cwd, env: { ...process.env, LW_STORY: "quota", ...env }, windowsHide: true });
    let out = ""; p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (out += d));
    p.on("error", (e) => res({ rc: -1, out: `${out}\nledgerrun: could not start ${cmd[0]}: ${e.message}`, ms: Date.now() - t0 }));
    p.on("close", (rc) => res({ rc: rc ?? -1, out, ms: Date.now() - t0 }));
  });
}
export async function runCheck(c) {
  const cwd = c.at === E ? ENGINE : ROOT;
  if (c.cmds) { const outs = []; let ms = 0; for (const x of c.cmds) { const r = await run(x.cmd, cwd); ms += r.ms; outs.push({ name: x.name, ...r }); } const p = c.parseAll(outs); return { ...p, tool: outs.every((o) => o.rc === 0) ? "ok" : "exit !0", ms }; }
  const r = await run(c.cmd, cwd); let p;
  try { p = c.parse(r.out, r.rc); } catch (e) { p = { result: `ledgerrun: could not read the output: ${e.message}`, gate: "FAIL" }; }
  return { ...p, tool: r.rc === 0 ? "ok" : `exit ${r.rc}`, ms: r.ms, tail: r.rc === 0 ? undefined : r.out.trim().split(/\r?\n/).slice(-6).join("\n") };
}
// a pool of `jobs` workers; a check waits for the checks named in its `after`
export async function runAll(list, jobs, onDone = () => {}) {
  const done = new Map(), waiting = new Map(list.map((c) => [c.id, null])), queue = [...list];
  const ready = (c) => (c.after || []).every((id) => done.has(id) || !waiting.has(id));
  async function worker() {
    for (;;) { const i = queue.findIndex(ready); if (i < 0) { if (!queue.length) return; await new Promise((r) => setTimeout(r, 200)); continue; }
      const [c] = queue.splice(i, 1), r = await runCheck(c); done.set(c.id, r); onDone(c, r); }
  }
  await Promise.all(Array.from({ length: Math.max(1, jobs) }, worker));
  return list.map((c) => ({ check: c, r: done.get(c.id) }));
}
export async function cpuLoad(ms = 3000) {
  const snap = () => cpus().map((c) => c.times), a = snap(); await new Promise((r) => setTimeout(r, ms)); const b = snap(); let busy = 0, all = 0;
  b.forEach((t, i) => { const d = (k) => t[k] - a[i][k], tot = d("user") + d("nice") + d("sys") + d("idle") + d("irq"); all += tot; busy += tot - d("idle"); });
  return all ? Math.round((1000 * busy) / all) / 10 : 0;
}

// ---------------------------------------------------------------- the table
const cell = (s) => String(s).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
export const shown = (c) => c.show || c.cmd.join(" ");
export function table(rows) {
  const out = ["| What | Command | Result | Tool | Gate | Time |", "|---|---|---|---|---|---|"];
  for (const { check: c, r } of rows) out.push(`| ${cell(c.what)} | \`${cell(shown(c))}\` | ${cell(r ? r.result : "not run (needs --browser)")} | ${r ? r.tool : "-"} | ${r ? r.gate : "NOT RUN"} | ${r ? `${(r.ms / 1000).toFixed(1)} s` : "-"} |`);
  return out.join("\n");
}

async function main() {
  const argv = process.argv.slice(2), opt = {};
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
  const port = +(opt.port || 8791), work = opt.work || join(tmpdir(), `ledgerrun-${process.pid}`); mkdirSync(work, { recursive: true });
  let list = checks(work, port); if (opt.only) list = list.filter((c) => opt.only.split(",").includes(c.id));
  const want = list.filter((c) => !c.browser || opt.browser), head = (await run(["git", "rev-parse", "--short", "HEAD"], ROOT)).out.trim(), dirty = (await run(["git", "status", "--porcelain"], ROOT)).out.split("\n").filter(Boolean).length;
  console.log(`ledgerrun: ${want.length} of ${list.length} checks at ${head} (${dirty} paths dirty in the tree); work in ${work}`);
  const { acquireHeavy } = await import(pathToFileURL(join(ROOT, "tools", "gpu-lock.mjs")).href);
  const server = opt.browser ? await serve(port) : null, load0 = await cpuLoad(), heavy = await acquireHeavy({ job: "ledgerrun", log: () => {} });
  const say = (c, r) => console.log(`  ${r.gate.padEnd(9)} ${c.id.padEnd(17)} ${(r.ms / 1000).toFixed(1).padStart(6)} s  ${r.result.slice(0, 150)}${r.tail ? `\n${r.tail.replace(/^/gm, "            | ")}` : ""}`);
  let got;
  try { got = await runAll(want.filter((c) => !c.outsideHeavy && !c.browser), +(opt.jobs || 4), say); got.push(...await runAll(want.filter((c) => c.browser && !c.outsideHeavy), 1, say)); }
  finally { heavy.release(); }
  try { got.push(...await runAll(want.filter((c) => c.outsideHeavy), 1, say)); } finally { if (server) server.kill(); }
  const load1 = await cpuLoad(), rows = list.map((c) => got.find((g) => g.check === c) || { check: c, r: null }), quiet = load0 <= 15 && load1 <= 15;
  console.log(`\n${table(rows)}\n\nMachine load ${load0} % before, ${load1} % after: ${quiet ? "quiet" : "NOT QUIET"}; times are wall times on that machine.`);
  const bad = rows.filter(({ r }) => r && (r.gate === "FAIL" || r.tool !== "ok"));
  console.log(`ledgerrun: ${rows.filter(({ r }) => r).length} run, ${rows.filter(({ r }) => r && r.gate === "PASS").length} gates PASS, ${bad.length} FAIL or erred${bad.length ? `: ${bad.map(({ check }) => check.id).join(", ")}` : ""}`);
  if (opt.json) writeFileSync(opt.json, JSON.stringify({ head, dirty, load: [load0, load1], rows: rows.map(({ check: c, r }) => ({ id: c.id, what: c.what, command: shown(c), ...r })) }, null, 1));
  process.exit(bad.length ? 1 : 0);
}
// the game's server for the browser rows: one already answering on the port is used as it is
async function serve(port) {
  try { await fetch(`http://127.0.0.1:${port}/engine/play.html`); console.log(`ledgerrun: using the server on ${port}`); return null; } catch { /* none there */ }
  const p = spawn("node", [join(ROOT, "game", "serve.mjs"), "--port", String(port)], { stdio: "ignore", windowsHide: true });
  for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${port}/engine/play.html`); return p; } catch { await new Promise((r) => setTimeout(r, 200)); } }
  p.kill(); throw new Error(`ledgerrun: no server on ${port}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((e) => { console.error(`ledgerrun: ${e.stack || e.message}`); process.exit(2); });
