#!/usr/bin/env node
// The echo check (world/echo.mjs; the device rule, 2026-10-23, design/DEVICE-AUDIT.md): what happens to a person, and
// what an earlier run left, reaches the player as a changed place or a changed person, never as a line in a record.
// The lint: every @echo's places exist; what it tells exists (a fate, a world fact, a flag something sets, a lore
// fragment); its @sense exists; a person it shows is a @char. The play (the story's builds and routes, as propcheck
// plays them): every echo is felt on some run; and every fate that falls on some run has an echo that is felt on
// some run where that fate fell (the consequence is met, not only recorded).
//   LW_STORY=quota node tools/echocheck.mjs [--seeds 1,2] [--runs a.json,b.json] [--lint]     (run from game/engine)
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";

export function lintEchoes(C, text = "") {
  const out = [], E = (C.story && C.story.echoes) || {}, err = (r, msg) => out.push({ level: "error", file: r.file, line: r.line, msg });
  for (const e of C.errors.filter((x) => /^echo /.test(x.msg))) out.push({ level: "error", ...e });
  const fates = (C.community && C.community.fates) || {}, wf = (C.story && C.story.worldfacts) || {}, lore = (C.story && C.story.lore && C.story.lore.fragments) || {}, cues = (C.story && C.story.cues) || {}, chars = (C.rs && C.rs.chars) || {};
  for (const e of Object.values(E)) {
    for (const p of e.places) if (!C.book.places[p]) err(e, `echo ${e.id}: no @place ${p}`);
    for (const t of e.tells) {
      if (t.kind === "fate" && !fates[t.id]) err(e, `echo ${e.id}: tells fate ${t.id}, which is no @fate`);
      if ((t.kind === "fact" || t.kind === "worldfact") && !wf[t.id] && !Object.values(lore).some((f) => f.gives.includes(t.id))) err(e, `echo ${e.id}: tells fact ${t.id}, which no @worldfact or lore fragment keeps`);
      if (t.kind === "lore" && !lore[t.id]) err(e, `echo ${e.id}: tells lore ${t.id}, which does not exist`);
      if (t.kind === "flag" && !new RegExp(`set\\(${t.id.replace(/\./g, "\\.")}\\)`).test(text)) err(e, `echo ${e.id}: tells flag ${t.id}, which nothing sets`);
    }
    if (e.cue && !cues[e.cue]) err(e, `echo ${e.id}: no @sense ${e.cue}`);
    for (const s of e.show) if ((s.kind === "person" || s.kind === "absent") && !chars[s.id] && !/^q\.|^e\d/.test(s.id)) err(e, `echo ${e.id}: show ${s.kind} ${s.id}: no @char`);
    for (const g of e.gives) if (!lore[g]) err(e, `echo ${e.id}: gives ${g}, which is no lore fragment`);
  }
  return out;
}

// runs: [{ build, echoes: [ids], fates: { id: true } }]
export function checkEchoPlay(C, runs) {
  const E = (C.story && C.story.echoes) || {}, lines = []; let errors = 0;
  for (const e of Object.values(E)) if (!runs.some((r) => (r.echoes || []).includes(e.id))) { errors++; lines.push(`error: ${e.id} (${e.places.join(", ")}): felt on no run`); }
  const fates = (C.community && C.community.fates) || {};
  for (const f of Object.values(fates)) {
    const fell = runs.filter((r) => (r.fates || {})[f.id]); if (!fell.length) continue;
    const mine = Object.values(E).filter((e) => e.tells.some((t) => t.kind === "fate" && t.id === f.id)).map((e) => e.id);
    if (!fell.some((r) => (r.echoes || []).some((id) => mine.includes(id)))) { errors++; lines.push(`error: ${f.id} (${f.who || ""}) fell on ${fell.length} run(s) and no echo of it was felt on any of them`); }
    else lines.push(`ok: ${f.id}: fell on ${fell.length} run(s); felt on ${fell.filter((r) => (r.echoes || []).some((id) => mine.includes(id))).length}`);
  }
  lines.push(`${runs.length} runs, ${Object.keys(E).length} echoes; ${errors} error(s)`);
  return { lines, errors };
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("tools/echocheck.mjs");
if (isMain) {
  const { STORY } = await import("./use-story.mjs"), { BUILDS, ROUTES } = await import("./use-policy.mjs");
  const { loadAct } = await import("../dialogue/book.mjs"), { loadContent } = await import("../full.mjs");
  if (!STORY.acts) { console.log("echocheck: this story names no act root (LW_STORY=quota)"); process.exit(0); }
  const argv = process.argv.slice(2), arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  const sources = (await loadAct(STORY.acts[0], (p) => readFile(p, "utf8"))).sources, C = loadContent(sources);
  const lint = lintEchoes(C, sources.map((s) => s.text).join("\n"));
  for (const o of lint) console.log(`${o.file}:${o.line}: ${o.level}: ${o.msg}`);
  console.log(`lint: ${Object.keys(C.story.echoes || {}).length} echoes, ${lint.length} problem(s)`);
  if (lint.length || argv.includes("--lint")) process.exit(lint.length ? 1 : 0);
  let files = arg("--runs") ? arg("--runs").split(",") : [];
  if (!files.length) {
    const out = new URL("../out/echocheck/", import.meta.url).pathname.replace(/^\/(\w:)/, "$1"); mkdirSync(out, { recursive: true });
    const all = [...Object.keys(BUILDS), ...Object.keys(ROUTES)].join(",");
    for (const s of (arg("--seeds") || "1,2").split(",")) {
      const f = `${out}runs-${s}.json`; files.push(f);
      const r = spawnSync(process.execPath, ["tools/playthrough.mjs", "--build", all, "--seed", s, "--json", f], { stdio: ["ignore", "ignore", "inherit"] });
      if (r.status !== 0) { console.error(`echocheck: playthrough seed ${s} failed (${r.status})`); process.exit(2); }
    }
  }
  const res = checkEchoPlay(C, files.flatMap((f) => JSON.parse(readFileSync(f, "utf8"))));
  console.log(res.lines.join("\n"));
  process.exit(res.errors ? 1 : 0);
}
