#!/usr/bin/env node
// The perspective check (world/perspective.mjs). The lint: every @perspective names an archetype, a start node that
// says perspective(<id>) and a return node that exist; every path from the start reaches endperspective() before any
// end of the act, and the chapter's nodes lead back to its return node. The play: plays the builds and routes and,
// for every run that played a chapter, checks that while it lasted the player was the chapter's person (the sheet,
// the figure) and that afterwards the run's own character came back exactly as they were (the sheet, the pack, the
// cabinet, the checks' memory, the figure), while what the chapter did to the world stayed; and that every chapter
// was played on some run.
//   LW_STORY=quota node tools/perspectivecheck.mjs [--seeds 1,2] [--lint] [--runs a.json,b.json]     (from game/engine)
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";

export function lintPerspectives(C) {
  const out = [], P = (C.story && C.story.perspectives) || {}, N = C.book.nodes, err = (r, msg) => out.push({ level: "error", file: r.file, line: r.line, msg: `perspective ${r.id}: ${msg}` });
  for (const e of C.errors.filter((x) => /^perspective /.test(x.msg))) out.push({ level: "error", ...e });
  const says = (n, re) => (n.steps || []).some((s) => re.test(JSON.stringify(s)));
  const nexts = (n) => (n.steps || []).flatMap((s) => [s.target, s.fail, s.kind === "go" || s.kind === "alt" ? s.value || s.target : null]).filter((x) => x && N[x]);
  for (const p of Object.values(P)) {
    if (!C.rs.archetypes[p.archetype]) err(p, `no archetype ${p.archetype}`);
    if (!N[p.start]) { err(p, `no start node ${p.start}`); continue; }
    if (!N[p.ret]) err(p, `no return node ${p.ret}`);
    if (!says(N[p.start], new RegExp(`perspective\\(${p.id.replace(/\./g, "\\.")}\\)`))) err(p, `the start node ${p.start} does not say perspective(${p.id})`);
    // walk from the start: every path ends the chapter before an end, and the chapter leads to its return node
    const seen = new Set(), stack = [p.start]; let returns = false;
    while (stack.length) {
      const id = stack.pop(); if (seen.has(id)) continue; seen.add(id); const n = N[id];
      const ends = says(n, /endperspective/);
      if (!ends && (n.steps || []).some((s) => s.kind === "end")) err(p, `the node ${id} ends the act inside the chapter`);
      if (ends) { if (nexts(n).includes(p.ret)) returns = true; else err(p, `the node ${id} ends the chapter but does not go to ${p.ret}`); continue; }
      for (const x of nexts(n)) if (x !== p.ret) stack.push(x); else err(p, `the node ${id} goes to ${p.ret} without ending the chapter`);
    }
    if (!returns) err(p, `no path from ${p.start} ends the chapter`);
  }
  return out;
}

export function checkPerspectiveRuns(C, runs) {
  const P = C.story.perspectives, lines = []; let errors = 0;
  const e = (m) => { errors++; lines.push(`error: ${m}`); };
  const played = new Map();
  for (const r of runs) for (const x of r.perspectives || []) {
    played.set(x.id, (played.get(x.id) || 0) + 1);
    if (!x.ended) { if (r.finished) e(`${r.build}: ${x.id} never ended`); continue; }
    if (x.during.archetype !== P[x.id].archetype) e(`${r.build}: ${x.id}: the sheet in the chapter was ${x.during.archetype}, not ${P[x.id].archetype}`);
    if (P[x.id].figure && x.during.figure !== P[x.id].figure) e(`${r.build}: ${x.id}: the figure in the chapter was ${x.during.figure}`);
    for (const k of x.changed) e(`${r.build}: ${x.id}: the run's own ${k} came back changed`);
    if (x.figureAfter !== x.figureBefore) e(`${r.build}: ${x.id}: the figure came back as ${x.figureAfter}, not ${x.figureBefore}`);
    if (!x.worldKept) e(`${r.build}: ${x.id}: what the chapter did to the world was undone`);
  }
  for (const id of Object.keys(P)) if (!played.has(id)) e(`${id}: played on no run`);
  lines.push(`${[...played.values()].reduce((a, b) => a + b, 0)} chapters played over ${runs.length} runs (${[...played].map(([k, n]) => `${k} ${n}`).join(", ") || "none"}); ${errors} error(s)`);
  return { lines, errors };
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("tools/perspectivecheck.mjs");
if (isMain) {
  const { STORY } = await import("./use-story.mjs"), { BUILDS, ROUTES } = await import("./use-policy.mjs");
  const { loadAct } = await import("../dialogue/book.mjs"), { loadContent } = await import("../full.mjs");
  if (!STORY.acts) { console.log("perspectivecheck: this story names no act root (LW_STORY=quota has a chapter)"); process.exit(0); }
  const argv = process.argv.slice(2), arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  const C = loadContent((await loadAct(STORY.acts[0], (p) => readFile(p, "utf8"))).sources), lint = lintPerspectives(C);
  for (const o of lint) console.log(`${o.file}:${o.line}: ${o.level}: ${o.msg}`);
  console.log(`lint: ${Object.keys(C.story.perspectives).length} chapter(s), ${lint.length} problem(s)`);
  if (lint.length || argv.includes("--lint")) process.exit(lint.length ? 1 : 0);
  const out = new URL("../out/perspectivecheck/", import.meta.url).pathname.replace(/^\/(\w:)/, "$1"); mkdirSync(out, { recursive: true });
  const all = [...Object.keys(BUILDS), ...Object.keys(ROUTES)].join(","), runs = arg("--runs") ? arg("--runs").split(",").flatMap((f) => JSON.parse(readFileSync(f, "utf8"))) : [];
  if (!runs.length) for (const s of (arg("--seeds") || "1,2").split(",")) {
    const f = `${out}runs-${s}.json`, r = spawnSync(process.execPath, ["tools/playthrough.mjs", "--build", all, "--seed", s, "--json", f], { stdio: ["ignore", "ignore", "inherit"] });
    if (r.status !== 0) { console.error(`perspectivecheck: playthrough seed ${s} failed (${r.status})`); process.exit(2); }
    runs.push(...JSON.parse(readFileSync(f, "utf8")));
  }
  const res = checkPerspectiveRuns(C, runs);
  console.log(res.lines.join("\n"));
  process.exit(res.errors ? 1 : 0);
}
