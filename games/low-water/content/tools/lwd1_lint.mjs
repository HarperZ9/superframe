// Writers' lint for Low Water LWD/1 content. Director's tool, private.
//   node content/tools/lwd1_lint.mjs content/act1/act1.lwd [--file quay.lwd] [--json out.json]
// Reads the act (root plus include: lines) with the engine's own parser (game/engine/dialogue,
// read-only), then checks what a writer can break: parse errors, go/alt/opt/check/claim/passive/
// call targets that do not exist, checks without a failure node, flags read but never set,
// flags set but never declared, nodes nobody can reach, records referenced but undefined
// (items, traits, quests, factions, skills, projects, runs), speakers without a @char, and
// em dashes. Prints word counts per file. --file limits the report to one file's problems.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const engine = join(here, "..", "..", "game", "engine");
const { parseRecords, parseStep } = await import("file://" + join(engine, "dialogue", "parse.mjs").replace(/\\/g, "/"));

const args = process.argv.slice(2);
const root = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--carry" && args[i - 1] !== "--file" && args[i - 1] !== "--json") || join(here, "..", "act1", "act1.lwd");
const only = args.includes("--file") ? args[args.indexOf("--file") + 1] : null;
const _carryArg = args.includes("--carry") ? args[args.indexOf("--carry") + 1] : null;
const jsonOut = args.includes("--json") ? args[args.indexOf("--json") + 1] : null;

const problems = [];
const P = (file, line, msg, level = "error") => problems.push({ file: basename(file || ""), line, msg, level });

// ---- load
const rootText = readFileSync(root, "utf8");
const files = [{ file: root, text: rootText }];
for (const r of parseRecords(rootText, root).recs.filter((r) => r.kind === "meta"))
  for (const kv of r.kv.filter((x) => x.key === "include")) {
    const p = join(dirname(root), kv.value.trim());
    try { files.push({ file: p, text: readFileSync(p, "utf8") }); } catch { P(root, kv.line, `include ${kv.value.trim()}: missing`, "warn"); }
  }

const recs = [], ids = {}, words = {};
for (const f of files) {
  const { recs: rs, errors } = parseRecords(f.text, f.file);
  errors.forEach((e) => P(f.file, e.line, e.msg));
  rs.forEach((r) => recs.push(r));
  let w = 0;
  for (const r of rs) for (const kv of r.kv)
    if (["nar", "line", "inst", "voice", "opt", "check", "claim", "about", "say", "name", "stage"].includes(kv.key)) w += kv.value.replace(/\{[^{}]*\}\s*$/, "").split(/\s+/).filter(Boolean).length;
  words[basename(f.file)] = w;
  f.text.split("\n").forEach((l, i) => { if (l.includes("—")) P(f.file, i + 1, "em dash", "warn"); });
}
for (const r of recs) {
  const t = (ids[r.kind] ||= {});
  if (r.id && t[r.id]) P(r.file, r.line, `duplicate @${r.kind} ${r.id} (first in ${basename(t[r.id].file)}:${t[r.id].line})`);
  else if (r.id) t[r.id] = r;
}
const has = (kind, id) => !!(ids[kind] && ids[kind][id]);
const nodes = ids.node || {};

// ---- steps
const reads = new Map(), sets = new Map(), edges = new Map(), speakers = new Set(Object.values(ids.char || {}).map((c) => (c.kv.find((k) => k.key === "speaker") || {}).value?.trim()).filter(Boolean));
speakers.add("LAMB");
["CANDLEMAS", "THE GLASS", "THE ALMANAC", "THE DAMP", "THE VANE"].forEach((s) => speakers.add(s));
const addMap = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
const target = (r, line, t, from) => {
  if (!t || t.startsWith("^")) return;
  addMap(edges, from, t);
  if (!nodes[t]) P(r.file, line, `target "${t}" is not a node`);
};
const CALL_KIND = { give: "item", take: "item", equip: "item", count: "item", worn: "item", offer: "trait", research: "trait", trait: "trait", quest: "quest", rep: "faction", project: "project", skill: "skill", run: "run", meter: "meter", fight: "encounter" };
function scanExpr(r, line, src) {
  if (!src) return;
  // trait(id) returns a status word (none, found, researching, done, forgotten), never false, so a
  // bare trait(...) or !trait(...) as a truth value is always true or always false. Compare it.
  for (const m of src.matchAll(/(!\s*)?\btrait\(\s*[\w.]+\s*\)(?!\s*(==|!=))/g))
    P(r.file, line, `bare ${m[0].trim()} used as a truth value: trait() returns a word; write trait(id) == none / != none / == done`);
  for (const m of src.matchAll(/\b(has|set|clear|give|take|equip|count|worn|offer|research|trait|quest|rep|project|skill|run|meter|fight)\(\s*([\w.]+)/g)) {
    const [, fn, id] = m;
    if (fn === "has") addMap(reads, id, { file: r.file, line });
    else if (fn === "set") addMap(sets, id, { file: r.file, line });
    else if (CALL_KIND[fn] && !has(CALL_KIND[fn], id)) P(r.file, line, `${fn}(${id}): no @${CALL_KIND[fn]} ${id}`);
  }
  for (const m of src.matchAll(/\bquest\(\s*([\w.]+)\s*,\s*([\w.]+)\s*\)/g)) {
    const q = ids.quest && ids.quest[m[1]];
    if (q && !q.kv.some((k) => k.key === "stage" && k.value.split(":")[0].trim() === m[2])) P(r.file, line, `quest ${m[1]} has no stage "${m[2]}"`);
  }
  for (const m of src.matchAll(/\b(skill)\.(\w+)/g)) if (!has("skill", m[2])) P(r.file, line, `skill.${m[2]}: no @skill`);
  for (const m of src.matchAll(/\bat\(\s*([\w.]+)\s*\)/g)) if (!has("place", m[1])) P(r.file, line, `at(${m[1]}): no @place`);
}
for (const r of recs) {
  if (r.kind !== "node" && r.kind !== "event") {
    for (const kv of r.kv) if (["when", "do", "mod", "while", "unlock", "rise"].includes(kv.key)) scanExpr(r, kv.line, kv.value);
    if (r.kind === "project") for (const kv of r.kv.filter((k) => k.key === "stage")) scanExpr(r, kv.line, kv.value);
    continue;
  }
  let speaker = "";
  for (const kv of r.kv) {
    let s; try { s = parseStep(kv.key, kv.value, { file: r.file, line: kv.line, node: r.id }); } catch (e) { P(r.file, kv.line, e.message); continue; }
    if (s.kind === "unknown" && !["at", "when"].includes(kv.key)) P(r.file, kv.line, `unknown key "${kv.key}"`, "warn");
    if (s.kind === "speaker") speaker = s.value;
    if (s.kind === "place" && !has("place", s.value)) P(r.file, kv.line, `place "${s.value}" is not a @place`);
    if (["go", "call"].includes(s.kind)) target(r, kv.line, s.value, r.id);
    if (s.kind === "else") target(r, kv.line, s.value, r.id);
    if (s.kind === "alt") { target(r, kv.line, s.target, r.id); scanExpr(r, kv.line, s.cond && s.cond.src); }
    if (s.kind === "passive") { target(r, kv.line, s.target, r.id); if (!has("skill", s.skill)) P(r.file, kv.line, `passive: no @skill ${s.skill}`); }
    if (["opt", "claim", "check"].includes(s.kind)) {
      target(r, kv.line, s.target, r.id); if (s.fail) target(r, kv.line, s.fail, r.id);
      scanExpr(r, kv.line, s.cond && s.cond.src); scanExpr(r, kv.line, s.attrs.do); scanExpr(r, kv.line, s.attrs.show);
      if (s.kind === "check") {
        if (!has("skill", s.attrs.skill)) P(r.file, kv.line, `check: no @skill ${s.attrs.skill}`);
        if (s.attrs.dc == null) P(r.file, kv.line, "check without dc");
      }
    }
    if (["do", "set", "clear"].includes(s.kind)) scanExpr(r, kv.line, s.kind === "do" ? kv.value : `${s.kind}(${s.value})`);
    if (s.kind === "if" || s.kind === "when") scanExpr(r, kv.line, kv.value);
    if (s.kind === "voice") { if (!has("skill", s.skill)) P(r.file, kv.line, `voice: no @skill "${s.skill}"`); scanExpr(r, kv.line, s.attrs.when); }
    if (s.kind === "line" || s.kind === "inst") { const who = s.who || speaker; if (!who) P(r.file, kv.line, "line with no speaker", "warn"); else if (!speakers.has(who)) P(r.file, kv.line, `speaker "${who}" has no @char`, "warn"); }
  }
}
// bare trait() anywhere a condition can hide (nar/line/inst {when:} blocks are not compiled above)
for (const r of recs) if (r.kind === "node" || r.kind === "event") for (const kv of r.kv) {
  if (["nar", "line", "inst"].includes(kv.key)) {
    const m = kv.value.match(/\{([^{}]*)\}\s*$/);
    if (m) {
      scanExpr(r, kv.line, m[1].replace(/\b(once|dc|below)\b[^,]*/g, ""));
      // Engine request R15: until the runner honours {when:}/{once} on nar/line/inst, such a line plays
      // unconditionally (nar would even print the braces). R15 landed 2026-10-16; set ENGINE_R15=0 to check against an older engine.
      if (process.env.ENGINE_R15 === "0" && /\b(when|once)\b/.test(m[1])) P(r.file, kv.line, `conditioned ${kv.key}: plays unconditionally until engine request R15 lands`, "warn");
    }
  }
}
// flags carried from an earlier act (--carry <root>): anything that act sets counts as set here
if (args.includes("--carry")) {
  const croot = args[args.indexOf("--carry") + 1], ct = readFileSync(croot, "utf8");
  const cfiles = [croot, ...[...ct.matchAll(/^include:\s*(\S+)/gm)].map((m) => join(dirname(croot), m[1]))];
  for (const f of cfiles) { try { for (const m of readFileSync(f, "utf8").matchAll(/\bset\(([\w.]+)\)/g)) addMap(sets, m[1], { file: f, line: 0 }); } catch (e) { console.error("carry:", f, e.message); } }
}
// flags
for (const [id, where] of reads) if (!/^(struck|fought|down)./.test(id) && !sets.has(id) && !(ids.fact && ids.fact[id] && false)) {
  const setByRules = recs.some((r) => r.kind !== "node" && r.kv.some((k) => k.value.includes(`set(${id})`)));
  if (!setByRules) where.slice(0, 1).forEach((w) => P(w.file, w.line, `flag "${id}" is read but never set`, "warn"));
}
for (const [id, where] of sets) if (!has("fact", id) && !/^(ev|lamp|margin|said|lied|heard|book|cause|prov|down|struck|fought)\./.test(id)) where.slice(0, 1).forEach((w) => P(w.file, w.line, `flag "${id}" is set but has no @fact`, "warn"));
// reachability from start, events and convention nodes
const meta = (ids.meta && Object.values(ids.meta)[0]) || recs.find((r) => r.kind === "meta");
const startIds = new Set();
const ruleStart = recs.find((r) => r.kind === "rules")?.kv.find((k) => k.key === "start-node");
if (ruleStart) startIds.add(ruleStart.value.trim());
if (meta) for (const k of meta.kv) if (["start", "at-end"].includes(k.key)) startIds.add(k.value.trim());
for (const r of recs) if (r.kind === "event") for (const k of r.kv) if (k.key === "go") startIds.add(k.value.trim());
for (const r of recs) for (const k of r.kv) if (["win", "lose", "full", "on-zero", "yield", "fled", "down"].includes(k.key)) startIds.add(k.value.trim());
for (const r of recs) if (r.kind === "encounter") for (const k of r.kv) if (k.key === "talk") startIds.add(k.value.split("|")[0].trim());
for (const id of Object.keys(nodes)) if (/^(nod|small|chilled|bench|wall)\b/.test(id) || /\.hub$/.test(id)) startIds.add(id);
const seen = new Set(), stack = [...startIds];
while (stack.length) { const n = stack.pop(); if (seen.has(n) || !nodes[n]) continue; seen.add(n); (edges.get(n) || []).forEach((t) => stack.push(t)); }
for (const [id, r] of Object.entries(nodes)) if (!seen.has(id)) P(r.file, r.line, `node "${id}" cannot be reached`, "warn");

// ---- report
const shown = problems.filter((p) => !only || p.file === only);
const errs = shown.filter((p) => p.level === "error"), warns = shown.filter((p) => p.level !== "error");
for (const p of [...errs, ...warns].slice(0, 400)) console.log(`${p.level === "error" ? "ERROR" : "warn "} ${p.file}:${p.line} ${p.msg}`);
const total = Object.values(words).reduce((a, b) => a + b, 0);
console.log(`\n${Object.keys(nodes).length} nodes, ${recs.length} records, ${errs.length} errors, ${warns.length} warnings${only ? ` (in ${only})` : ""}`);
console.log("words: " + Object.entries(words).map(([f, w]) => `${f} ${w}`).join(", ") + `; total ${total}`);
if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ nodes: Object.keys(nodes).length, words, total, problems }, null, 1));
process.exitCode = errs.length ? 1 : 0;
