#!/usr/bin/env node
// The read-back check (world/readback.mjs). The lint (lintReadback, no play): every voice line tagged {self: id}
// names a @selflie, and every @selflie is tagged on some voice line; every @said record is a flag some option sets;
// every condition evaluates. The play (checkReadbackRuns): plays the story's builds and routes and, for each run
// that reached its read-back, checks that
//   - every self-lie the character heard is a row paired with something that happened (never "nothing recorded")
//   - every said row quotes the chosen words with its marker (said: <flag>), and the flag was set on that run
//   - the rows are in clock order, and each has what happened
//   - it cannot be skipped: a second row is refused before the first has had its reading time, and it cannot be
//     closed before every row is shown
//   - most inner lines are true: for each class over its runs, self-lies are under half the voice lines heard (an
//     error at half or more; over a quarter is a warning, since the trick dies once players learn to distrust them)
//   - over all runs every @selflie was heard and every @said reached (unreached ones are listed as warnings)
//   LW_STORY=quota node tools/readbackcheck.mjs [--seeds 1,2] [--lint] [--runs a.json,b.json]      (run from game/engine)
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { evaluate } from "../core/expr.mjs";

export function lintReadback(C, G, text = "") {
  const out = [], RB = (C.story && C.story.readback) || { selflies: {}, said: {}, docs: {} }, err = (r, msg) => out.push({ level: "error", file: r.file, line: r.line, msg });
  for (const e of C.errors.filter((x) => /^(selflie|said|readback) /.test(x.msg))) out.push({ level: "error", ...e });
  const tagged = new Set();
  for (const n of Object.values(C.book.nodes)) for (const s of n.steps || []) if (s.kind === "voice" && s.attrs && s.attrs.self) {
    tagged.add(String(s.attrs.self)); if (!RB.selflies[s.attrs.self]) err({ file: n.file, line: s.line || n.line }, `node ${n.id}: voice tagged self: ${s.attrs.self}, which no @selflie defines`);
  }
  for (const s of Object.values(RB.selflies)) if (!tagged.has(s.id)) err(s, `selflie ${s.id}: no voice line is tagged with it, so nobody can hear it`);
  for (const s of Object.values(RB.said)) if (!text.includes(`set(${s.id})`)) err(s, `said ${s.id}: no option sets that flag`);
  const conds = [...Object.values(RB.selflies), ...Object.values(RB.said)].flatMap((r) => r.happened.map((l) => [r, l])).concat(Object.values(RB.docs).flatMap((d) => [...d.rows, ...d.heads].map((l) => [d, l])));
  for (const [r, l] of conds) if (l.cond) { try { evaluate(l.cond, G.scope); } catch (e) { err({ file: r.file, line: l.line }, `${r.id}: the condition fails: ${e.message}`); } }
  return out;
}

export function checkReadbackRuns(C, runs) {
  const RB = C.story.readback, lines = []; let errors = 0, warns = 0;
  const e = (m) => { errors++; lines.push(`error: ${m}`); };
  const heard = new Set(), reached = new Set(), byClass = {};
  for (const r of runs) {
    const d = r.readback; if (!d) { if (r.finished) e(`${r.build}: finished without a read-back`); continue; }
    d.selfLies.forEach((x) => heard.add(x)); d.said.forEach((x) => reached.add(x.flag));
    for (const id of d.selfLies) { const row = d.doc.rows.find((x) => x.kind === "self" && x.id === id); if (!row) e(`${r.build}: the self-lie ${id} was heard and is not in the read-back`); else if (row.happened.includes("(nothing recorded)")) e(`${r.build}: the self-lie ${id} is paired with nothing that happened`); }
    for (const s of d.said) { const row = d.doc.rows.find((x) => x.kind === "said" && x.id === s.flag); if (!row || row.told.words !== s.words || row.told.marker !== `said: ${s.flag}`) e(`${r.build}: ${s.flag} is not quoted word for word with its marker`); else if (row.happened.includes("(nothing recorded)")) e(`${r.build}: ${s.flag} is paired with nothing that happened`); }
    for (let i = 1; i < d.doc.rows.length; i++) if (d.doc.rows[i].at < d.doc.rows[i - 1].at) e(`${r.build}: rows out of clock order at ${d.doc.rows[i].when}`);
    if (d.doc.rows.some((x) => !x.happened.length)) e(`${r.build}: a row with nothing in what happened`);
    if (!d.skip.secondRefused) e(`${r.build}: the second row came before the first had its reading time`);
    if (!d.skip.earlyRefused) e(`${r.build}: the read-back closed before every row was shown`);
    if (!d.skip.closed) e(`${r.build}: the read-back would not close once read`);
    const k = (r.endings && r.endings.class) || r.build, c = (byClass[k] ||= { lies: 0, voices: 0, runs: 0 }); c.lies += d.selfLies.length; c.voices += d.voices; c.runs++;
  }
  // most inner lines are true, as a player of a class hears them over its runs (the risk is learned distrust)
  for (const [k, c] of Object.entries(byClass)) {
    const share = c.voices ? c.lies / c.voices : 0, msg = `${k}: ${c.lies} self-lies in ${c.voices} voice lines over ${c.runs} runs (${Math.round(100 * share)}%)`;
    if (share >= 0.5) e(`${msg}: most inner lines must be true`);
    else if (share > 0.25) { warns++; lines.push(`warn: ${msg}: true, but near the edge of the voices being distrusted`); }
    else lines.push(`ok: ${msg}`);
  }
  for (const id of Object.keys(RB.selflies)) if (!heard.has(id)) { warns++; lines.push(`warn: the self-lie ${id} was heard on no run`); }
  for (const id of Object.keys(RB.said)) if (!reached.has(id)) { warns++; lines.push(`warn: ${id} was said on no run`); }
  lines.push(`${runs.filter((r) => r.readback).length} read-backs in ${runs.length} runs; ${heard.size} of ${Object.keys(RB.selflies).length} self-lies heard, ${reached.size} of ${Object.keys(RB.said).length} said rows reached; ${errors} error(s), ${warns} warning(s)`);
  return { lines, errors, warns };
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("tools/readbackcheck.mjs");
if (isMain) {
  const { STORY } = await import("./use-story.mjs"), { BUILDS, ROUTES } = await import("./use-policy.mjs");
  const { loadAct } = await import("../dialogue/book.mjs"), { loadContent, createFullGame } = await import("../full.mjs");
  if (!STORY.acts) { console.log("readbackcheck: this story names no act root (LW_STORY=quota has a read-back)"); process.exit(0); }
  const argv = process.argv.slice(2), arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  const sources = (await loadAct(STORY.acts[0], (p) => readFile(p, "utf8"))).sources, C = loadContent(sources);
  const G = createFullGame({ content: C, seed: 1 }); G.create({ archetype: Object.keys(C.rs.archetypes)[0], enter: false });
  const lint = lintReadback(C, G, sources.map((s) => s.text).join("\n"));
  for (const o of lint) console.log(`${o.file}:${o.line}: ${o.level}: ${o.msg}`);
  console.log(`lint: ${Object.keys(C.story.readback.selflies).length} self-lies, ${Object.keys(C.story.readback.said).length} said, ${lint.length} problem(s)`);
  if (lint.length || argv.includes("--lint")) process.exit(lint.length ? 1 : 0);
  const out = new URL("../out/readbackcheck/", import.meta.url).pathname.replace(/^\/(\w:)/, "$1"); mkdirSync(out, { recursive: true });
  const all = [...Object.keys(BUILDS), ...Object.keys(ROUTES)].join(","), runs = arg("--runs") ? arg("--runs").split(",").flatMap((f) => JSON.parse(readFileSync(f, "utf8"))) : [];
  if (!runs.length) for (const s of (arg("--seeds") || "1,2").split(",")) {
    const f = `${out}runs-${s}.json`, r = spawnSync(process.execPath, ["tools/playthrough.mjs", "--build", all, "--seed", s, "--json", f], { stdio: ["ignore", "ignore", "inherit"] });
    if (r.status !== 0) { console.error(`readbackcheck: playthrough seed ${s} failed (${r.status})`); process.exit(2); }
    runs.push(...JSON.parse(readFileSync(f, "utf8")));
  }
  const res = checkReadbackRuns(C, runs);
  console.log(res.lines.join("\n"));
  process.exit(res.errors ? 1 : 0);
}
