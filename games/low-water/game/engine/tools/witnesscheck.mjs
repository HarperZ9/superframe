#!/usr/bin/env node
// The witness check (world/witness.mjs; design/spine-plan/02-WITNESS.md section 5). It replaces readbackcheck: the
// read-back's ledger is no longer shown, and survives only as the oracle the witness must answer.
// The lint (lintWitness, no play):
//   - the self-lie and said records still lint as before (readbackcheck's lintReadback)
//   - every @witness names nodes that exist (opens, dispatch, every beat, last); the dispatch node does wnext() and
//     has an alt "<beat> ? wat(<beat>)" for every beat
//   - Reach: a beat "seen <place>" names a place in the witness's reach and not in never; "heard <SOURCE>" names
//     one of her sources. What she never saw she cannot tell as seen
//   - No verdict from the game: no narration line or option label in the witness's nodes says guilty, murderer,
//     forgiven, hero, "good man", "you did right" and the like. Characters' lines are exempt: she may be unfair
//   - Count cap: no more than three figures spoken or narrated in the whole scene, outside lines marked
//     {count: cost} and the echoed self-lies (which are the character's own words, replayed)
//   - Echo: every @selflie has an echo step ({echo: <id>}) in some beat, word for word as it was heard
// The play (checkWitnessRuns): for each run that reached the witness,
//   - Echo: every self-lie heard on the run is echoed by a beat played on the run
//   - Oracle: every ledger row that holds on the run reads some state a played beat answers, or that is declared
//     unwitnessed
//   - Unskippable: the talk panel's gate refuses a second beat before the first's reading time and refuses to
//     close early, and closes once read
//   - Last: the scene closed on its last beat
//   - every beat is played on some run (a warning otherwise)
//   LW_STORY=quota node tools/witnesscheck.mjs [--seeds 1,2] [--lint] [--runs a.json,b.json]      (run from game/engine)
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { lintReadback } from "./readbackcheck.mjs";

export const VERDICT = /\b(guilty|murderers?|murdered|forgiven|forgive|forgiveness|hero|heroes|monster|innocent|evil|redeemed|good man|bad man|you did right|you did wrong|it was your fault|not your fault)\b/i;
const NUMBER = /\b(\d[\d,.]*|hundred|thousand|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\b/gi;

// the nodes a witness scene plays: its opening, its beats, and what those branch into before going back to the dispatch
export function witnessNodes(W, N) {
  const out = new Set(), stack = [W.opens, ...W.beats.map((b) => b.node), W.last];
  while (stack.length) {
    const id = stack.pop(); if (!id || out.has(id) || !N[id] || id === W.dispatch) continue; out.add(id);
    for (const s of N[id].steps || []) { const t = s.target || (["go", "call"].includes(s.kind) ? s.value : null); if (t) stack.push(t); }
  }
  return [...out];
}

export function lintWitness(C) {
  const out = [], N = C.book.nodes, W = (C.story && C.story.witness) || {}, SL = ((C.story && C.story.readback) || {}).selflies || {}, places = C.book.places || {};
  const err = (r, msg) => out.push({ level: "error", file: r.file, line: r.line, msg });
  for (const e of C.errors.filter((x) => /^witness /.test(x.msg))) out.push({ level: "error", ...e });
  const echoed = {};
  for (const w of Object.values(W)) {
    for (const k of ["opens", "dispatch", "last"]) if (!N[w[k]]) err(w, `witness ${w.id}: ${k}: no node ${w[k]}`);
    const d = N[w.dispatch];
    if (d) {
      const steps = d.steps || [];
      if (!steps.some((s) => s.kind === "do" && s.effects && s.effects.calls.has("wnext"))) err(d, `witness ${w.id}: the dispatch node ${w.dispatch} must do wnext()`);
      for (const b of w.beats) if (!steps.some((s) => s.kind === "alt" && s.target === b.node && s.cond && s.cond.calls.has("wat"))) err(d, `witness ${w.id}: the dispatch node has no "alt: ${b.node} ? wat(${b.node})"`);
    }
    for (const p of [...w.reach, ...w.never]) if (!places[p]) err(w, `witness ${w.id}: no @place ${p}`);
    for (const b of w.beats) {
      const at = { file: w.file, line: b.line };
      if (!N[b.node]) { err(at, `witness ${w.id}: beat ${b.node}: no such node`); continue; }
      if (b.how === "seen" && (w.never.includes(b.at) || !w.reach.includes(b.at))) err(at, `witness ${w.id}: beat ${b.node} is told as seen at ${b.at}, where ${w.who} ${w.never.includes(b.at) ? "never was" : "is not in reach"} (Reach)`);
      if (b.how === "heard" && !w.sources.includes(b.at)) err(at, `witness ${w.id}: beat ${b.node} is told as heard from ${b.at}, who is not one of ${w.who}'s sources (Reach)`);
      for (const s of N[b.node].steps || []) if (s.kind === "voice" && s.attrs && s.attrs.echo) (echoed[String(s.attrs.echo)] ||= []).push({ node: b.node, text: s.text, skill: s.skill });
    }
    // no verdict from the game, and the count cap, over every node the scene plays
    let figures = [];
    for (const id of witnessNodes(w, N)) for (const s of N[id].steps || []) {
      const text = s.kind === "nar" ? s.value : ["opt", "claim", "check"].includes(s.kind) ? s.label : null;
      if (text && VERDICT.test(text)) err({ file: N[id].file, line: s.line || N[id].line }, `witness ${w.id}: node ${id}: the game passes a verdict: "${text.match(VERDICT)[0]}" (No verdict; a character may say it, the narration may not)`);
      const spoken = s.kind === "nar" ? s.value : s.kind === "line" ? s.text : s.kind === "voice" && !(s.attrs && s.attrs.echo) ? s.text : null;
      if (spoken && !(s.attrs && s.attrs.count === "cost")) figures.push(...(spoken.match(NUMBER) || []).map((x) => `${id}: ${x}`));
    }
    if (figures.length > 3) err(w, `witness ${w.id}: ${figures.length} figures in the scene (at most three, each outside a {count: cost} line): ${figures.join("; ")}`);
  }
  // every self-lie has an echo, word for word
  for (const sl of Object.values(SL)) {
    const orig = Object.values(N).flatMap((n) => (n.steps || []).filter((s) => s.kind === "voice" && s.attrs && String(s.attrs.self) === sl.id).map((s) => ({ text: s.text, skill: s.skill })));
    const e = echoed[sl.id] || [];
    if (!e.length) err(sl, `selflie ${sl.id}: no witness beat echoes it (Echo)`);
    else if (orig.length && !e.some((x) => orig.some((o) => o.text === x.text && o.skill === x.skill))) err(sl, `selflie ${sl.id}: the echo in ${e[0].node} is not the line as it was heard, word for word`);
  }
  return out;
}

export function checkWitnessRuns(C, runs) {
  const W = C.story.witness, N = C.book.nodes, lines = []; let errors = 0, warns = 0;
  const e = (m) => { errors++; lines.push(`error: ${m}`); };
  const played = new Set();
  const echoesOf = (node) => ((N[node] || {}).steps || []).filter((s) => s.kind === "voice" && s.attrs && s.attrs.echo).map((s) => String(s.attrs.echo));
  for (const r of runs) {
    if (!r.witness) { if (r.finished) e(`${r.build}: finished without the witness`); continue; }
    for (const x of [...(r.witnesses || []), r.witness]) {
    const w = W[x.id]; if (!w) { e(`${r.build}: no @witness ${x.id}`); continue; }
    x.played.forEach((n) => played.add(n));
    for (const sl of x.selfLies) if (!x.played.some((n) => echoesOf(n).includes(sl))) e(`${r.build}: the self-lie ${sl} was heard and no beat played on the run echoes it (Echo)`);
    const answered = new Set([...w.beats.filter((b) => x.played.includes(b.node)).flatMap((b) => b.answers), ...w.unwitnessed.flatMap((u) => u.ids)]);
    for (const row of x.oracle) if (!row.ids.some((id) => answered.has(id))) e(`${r.build}: the ledger row "${row.when} | ${row.text.slice(0, 60)}" is answered by no beat played and is not declared unwitnessed (Oracle; it reads ${row.ids.join(", ")})`);
    if (!x.gate.secondRefused) e(`${r.build}: the second beat came before the first had its reading time (Unskippable)`);
    if (!x.gate.earlyRefused) e(`${r.build}: the scene could close before every beat was shown (Unskippable)`);
    if (!x.gate.closed) e(`${r.build}: the scene would not close once read`);
    if (!x.closed || !(r.visited || []).includes(w.last)) e(`${r.build}: the witness did not close on its last beat ${w.last} (Last)`);
    }
  }
  for (const w of Object.values(W)) for (const b of w.beats) if (!played.has(b.node)) { warns++; lines.push(`warn: ${w.id}: beat ${b.node} played on no run`); }
  const n = runs.reduce((a, r) => a + (r.witnesses || []).length + (r.witness ? 1 : 0), 0);
  lines.push(`${n} witness scenes in ${runs.length} runs; ${played.size} of ${Object.values(W).reduce((a, w) => a + w.beats.length, 0)} beats played; ${errors} error(s), ${warns} warning(s)`);
  return { lines, errors, warns };
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("tools/witnesscheck.mjs");
if (isMain) {
  const { STORY } = await import("./use-story.mjs"), { BUILDS, ROUTES } = await import("./use-policy.mjs");
  const { loadAct } = await import("../dialogue/book.mjs"), { loadContent, createFullGame } = await import("../full.mjs");
  if (!STORY.acts) { console.log("witnesscheck: this story names no act root (LW_STORY=quota has a witness)"); process.exit(0); }
  const argv = process.argv.slice(2), arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  const sources = (await loadAct(STORY.acts[0], (p) => readFile(p, "utf8"))).sources, C = loadContent(sources);
  const G = createFullGame({ content: C, seed: 1 }); G.create({ archetype: Object.keys(C.rs.archetypes)[0], enter: false });
  const lint = [...lintReadback(C, G, sources.map((s) => s.text).join("\n")), ...lintWitness(C)];
  for (const o of lint) console.log(`${o.file}:${o.line}: ${o.level}: ${o.msg}`);
  console.log(`lint: ${Object.keys(C.story.witness).length} witness scene(s), ${Object.keys(C.story.readback.selflies).length} self-lies, ${lint.length} problem(s)`);
  if (lint.length || argv.includes("--lint")) process.exit(lint.length ? 1 : 0);
  const out = new URL("../out/witnesscheck/", import.meta.url).pathname.replace(/^\/(\w:)/, "$1"); mkdirSync(out, { recursive: true });
  const all = [...Object.keys(BUILDS), ...Object.keys(ROUTES)].join(","), runs = arg("--runs") ? arg("--runs").split(",").flatMap((f) => JSON.parse(readFileSync(f, "utf8"))) : [];
  if (!runs.length) for (const s of (arg("--seeds") || "1,2").split(",")) {
    const f = `${out}runs-${s}.json`, r = spawnSync(process.execPath, ["tools/playthrough.mjs", "--build", all, "--seed", s, "--json", f], { stdio: ["ignore", "ignore", "inherit"] });
    if (r.status !== 0) { console.error(`witnesscheck: playthrough seed ${s} failed (${r.status})`); process.exit(2); }
    runs.push(...JSON.parse(readFileSync(f, "utf8")));
  }
  const res = checkWitnessRuns(C, runs);
  console.log(res.lines.join("\n"));
  process.exit(res.errors ? 1 : 0);
}
