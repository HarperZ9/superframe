#!/usr/bin/env node
// The dream check (world/dreams.mjs). The lint: every @dream has at least two readings (both kept), looks ahead at
// least a day, ends its see: lines with one that has no condition (so the dreamer always sees something), and has
// conditions and fear effects that run; every dream is dreamed by some scene ({{dream(id)}}); dreaming leaves the
// real model, the flags and the variables as they were. The play: plays the builds and routes (run from game/engine)
// and, for each dream, checks that it was dreamed on some run, that it was set against its day on the runs that
// reached that day, and that both readings stay open for each class: over its runs it came true on some and not on others. A
// dream that always comes true has closed the fear reading; one that never does has closed the premonition.
//   LW_STORY=quota node tools/dreamcheck.mjs [--seeds 1,2] [--lint] [--runs a.json,b.json]
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { evaluate } from "../core/expr.mjs";

export function lintDreams(C, G, text = "") {
  const out = [], D = (C.story && C.story.dreams) || {}, err = (r, msg) => out.push({ level: "error", file: r.file, line: r.line, msg: `dream ${r.id}: ${msg}` });
  for (const e of C.errors.filter((x) => /^dream /.test(x.msg))) out.push({ level: "error", ...e });
  for (const d of Object.values(D)) {
    if (d.readings.length < 2) err(d, "needs two readings at least (reading: premonition | ... and reading: fear | ...): both are kept");
    if (!(d.days >= 1)) err(d, "days: looks ahead at least a day");
    if (d.see[d.see.length - 1].cond) err(d, "the last see: has a condition, so the dreamer can see nothing");
    for (const s of d.see) if (s.cond) { try { evaluate(s.cond, G.scope); } catch (e) { err(d, `see ${s.id}: the condition fails: ${e.message}`); } }
    if (!text.includes(`dream(${d.id})`)) err(d, "no scene dreams it ({{dream(id)}})");
    if (G.dreams && G.community) {
      const before = JSON.stringify([G.community.state, G.state.vars, G.state.flags]), seen = [];
      const off = G.on("community.rule", () => seen.push(1));
      try { G.dreams.project(d.id); } catch (e) { err(d, `the projection fails: ${e.message}`); }
      off && off();
      if (JSON.stringify([G.community.state, G.state.vars, G.state.flags]) !== before) err(d, "dreaming changed the real model, flags or variables");
      if (seen.length) err(d, "dreaming let the model's events out");
    }
  }
  return out;
}

export function checkDreamRuns(C, runs) {
  const D = C.story.dreams, lines = []; let errors = 0;
  const e = (m) => { errors++; lines.push(`error: ${m}`); };
  for (const d of Object.values(D)) {
    const got = runs.flatMap((r) => (r.dreams || []).filter((x) => x.id === d.id).map((x) => ({ ...x, build: r.build, cls: (r.endings && r.endings.class) || "" })));
    if (!got.length) { e(`${d.id}: dreamed on no run`); continue; }
    const due = got.filter((x) => x.matched != null), hit = due.filter((x) => x.matched), miss = due.filter((x) => !x.matched);
    const unsettled = got.filter((x) => x.matched == null && x.finished); for (const x of unsettled) e(`${d.id}: ${x.build} finished without setting the dream against its day`);
    if (!due.length) e(`${d.id}: no run reached the dream's day`);
    // both readings stay open for every class that dreams it: a class that always sees it come true has a prophecy,
    // one that never does has only fear (2026-10-22: the sergeant's runs never matched, from a settle read mid-tick)
    for (const cls of [...new Set(due.map((x) => x.cls))]) {
      const c = due.filter((x) => x.cls === cls), ch = c.filter((x) => x.matched).length, who = cls || "(no class)";
      if (ch === c.length) e(`${d.id}: for ${who} it came true on all ${c.length} runs, so the fear reading is closed (it is a prophecy)`);
      else if (!ch) e(`${d.id}: for ${who} it came true on none of ${c.length} runs, so the premonition reading is closed`);
      else lines.push(`ok: ${d.id}: for ${who} it came true on ${ch} of ${c.length} runs`);
    }
    lines.push(`${d.id}: dreamed on ${got.length} runs; came true on ${hit.length} of ${due.length} (${hit.map((x) => x.build).join(", ") || "none"}); not on ${miss.map((x) => x.build).join(", ") || "none"}`);
  }
  lines.push(`${Object.keys(D).length} dream(s) over ${runs.length} runs; ${errors} error(s)`);
  return { lines, errors };
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("tools/dreamcheck.mjs");
if (isMain) {
  const { STORY } = await import("./use-story.mjs"), { BUILDS, ROUTES } = await import("./use-policy.mjs");
  const { loadAct } = await import("../dialogue/book.mjs"), { loadContent, createFullGame } = await import("../full.mjs");
  if (!STORY.acts) { console.log("dreamcheck: this story names no act root (LW_STORY=quota has dreams)"); process.exit(0); }
  const argv = process.argv.slice(2), arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  const sources = (await loadAct(STORY.acts[0], (p) => readFile(p, "utf8"))).sources, C = loadContent(sources);
  const G = createFullGame({ content: C, seed: 1 }); G.create({ archetype: Object.keys(C.rs.archetypes)[0], enter: false });
  const lint = lintDreams(C, G, sources.map((s) => s.text).join("\n"));
  for (const o of lint) console.log(`${o.file}:${o.line}: ${o.level}: ${o.msg}`);
  console.log(`lint: ${Object.keys(C.story.dreams).length} dream(s), ${lint.length} problem(s)`);
  if (lint.length || argv.includes("--lint")) process.exit(lint.length ? 1 : 0);
  const out = new URL("../out/dreamcheck/", import.meta.url).pathname.replace(/^\/(\w:)/, "$1"); mkdirSync(out, { recursive: true });
  const all = [...Object.keys(BUILDS), ...Object.keys(ROUTES)].join(","), runs = arg("--runs") ? arg("--runs").split(",").flatMap((f) => JSON.parse(readFileSync(f, "utf8"))) : [];
  if (!runs.length) for (const s of (arg("--seeds") || "1,2").split(",")) {
    const f = `${out}runs-${s}.json`, r = spawnSync(process.execPath, ["tools/playthrough.mjs", "--build", all, "--seed", s, "--json", f], { stdio: ["ignore", "ignore", "inherit"] });
    if (r.status !== 0) { console.error(`dreamcheck: playthrough seed ${s} failed (${r.status})`); process.exit(2); }
    runs.push(...JSON.parse(readFileSync(f, "utf8")));
  }
  const res = checkDreamRuns(C, runs.map((r) => ({ ...r, dreams: (r.dreams || []).map((x) => ({ ...x, finished: r.finished })) })));
  console.log(res.lines.join("\n"));
  process.exit(res.errors ? 1 : 0);
}
