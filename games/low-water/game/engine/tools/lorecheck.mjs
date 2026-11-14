#!/usr/bin/env node
// The lore check (design/quota/04-SYSTEMS.md section 7, PITCHES 3c.6). Two parts.
// The lint (lintLore, no play): every @lore names a layer, where it is found (a prop and its states, a node, a
// record event type the content makes) and requirements that exist (a class value the class variable takes, a
// fragment, a condition, a fact some fragment gives); a surface fragment needs nothing; a hidden one needs a
// class, a choice or a prior fact; a fragment found through a prop state that reads prior() requires that same
// fact, so every cross-run fragment names the earlier fact it needs; every @chain route lists fragments of the
// chain. The device rule (2026-10-23, design/DEVICE-AUDIT.md): no fragment is found by reading a document (a prop
// devicecheck calls a document), and a fragment an earlier run left is met in the world (a prop, a touch or an echo),
// never only in a scene's words.
// The play (playLore): plays the story's builds and routes fresh, then plays each class again seeded with each set
// of facts a fresh run kept (the world record an earlier run leaves), and checks that every fragment is found on
// at least one run (no orphans), and that every chain route is completable within its rule: one-run (one fresh
// run), two-classes (two fresh runs of different classes; and no single run may hold it all), across-runs (a
// seeded run); and every class completes every chain in one run by some one-run route (no gate the player cannot
// see, where a chain needs both classes and no run can hold it).
//   LW_STORY=quota node tools/lorecheck.mjs [--seeds 1,2] [--lint]     (run from game/engine; --lint skips the play)
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { DOC_PROP } from "./devicecheck.mjs";

export function lintLore(C, text = "") {
  const out = [], L = (C.story && C.story.lore) || { fragments: {}, chains: {} }, F = L.fragments, props = (C.story && C.story.props) || {};
  const err = (r, msg) => out.push({ level: "error", file: r.file, line: r.line, msg });
  for (const e of C.errors.filter((x) => /^(lore|chain) /.test(x.msg))) out.push({ level: "error", ...e });
  const classVar = String(C.book.meta["class-var"] || "class").trim();
  const classes = new Set([...text.matchAll(new RegExp(`\\b${classVar}\\s*=\\s*(\\w+)`, "g"))].map((m) => m[1]));
  const given = new Set(Object.values(F).flatMap((f) => f.gives));
  for (const f of Object.values(F)) {
    const p = `lore ${f.id}`, kinds = new Set(f.requires.map((q) => q.kind));
    if (f.chain && !L.chains[f.chain]) err(f, `${p}: no @chain ${f.chain}`);
    for (const w of f.where) {
      if (w.kind === "prop" || w.kind === "touch") {
        const pr = props[w.id]; if (!pr) { err(f, `${p}: where: no @prop ${w.id}`); continue; }
        if (DOC_PROP.test(pr.name)) err(f, `${p}: found by reading ${w.id} ("${pr.name}"), a document: the device rule asks for the thing, a touch or a changed place`);
        if (w.kind === "touch") { if (!(pr.touches || []).length) err(f, `${p}: where: touch ${w.id}, which has no touch:`); else if (w.states.length && !pr.touches.some((t) => t.kind === w.states[0])) err(f, `${p}: where: ${w.id} has no touch ${w.states[0]}`); continue; }
        for (const s of w.states) if (!pr.states.some((x) => x.id === s)) err(f, `${p}: where: the prop ${w.id} has no state ${s}`);
        // a state that reads prior() makes this a cross-run fragment: it must name the fact it needs
        for (const s of pr.states.filter((x) => !w.states.length || w.states.includes(x.id))) for (const m of String(s.when || "").matchAll(/prior\(([\w.]+)\)/g))
          if (!f.requires.some((q) => q.kind === "prior" && q.id === m[1])) err(f, `${p}: found through ${w.id} ${s.id}, which reads prior(${m[1]}), so it must say requires: prior ${m[1]}`);
      }
      if (w.kind === "node" && !C.book.nodes[w.id]) err(f, `${p}: where: no node ${w.id}`);
      if (w.kind === "echo" && !((C.story && C.story.echoes) || {})[w.id]) err(f, `${p}: where: no @echo ${w.id}`);
      if (w.kind === "record" && !text.includes(`record(${w.id}`)) err(f, `${p}: where: no scene makes a record event ${w.id}`);
    }
    for (const q of f.requires) {
      if (q.kind === "class" && !classes.has(q.id)) err(f, `${p}: requires class ${q.id}, a value ${classVar} never takes`);
      if (q.kind === "lore" && !F[q.id]) err(f, `${p}: requires lore ${q.id}, which does not exist`);
      if (q.kind === "prior" && !given.has(q.id)) err(f, `${p}: requires prior ${q.id}, which no fragment gives`);
      if (q.kind === "prior" && f.layer !== "hidden") err(f, `${p}: a fragment found across runs is hidden (layer ${f.layer})`);
    }
    if (kinds.has("prior") && !f.where.some((w) => ["prop", "touch", "echo"].includes(w.kind))) err(f, `${p}: what an earlier run left is met in the world: find it through a prop, a touch or an echo, not only a scene`);
    if (f.layer === "surface" && ["class", "choice", "prior"].some((k) => kinds.has(k))) err(f, `${p}: a surface fragment is for anyone, so it requires no class, choice or prior fact`);
    if (f.layer === "hidden" && !["class", "choice", "prior"].some((k) => kinds.has(k))) err(f, `${p}: a hidden fragment needs a class, a choice or a prior fact`);
  }
  for (const c of Object.values(L.chains)) for (const r of c.routes) for (const id of r.needs) {
    if (!F[id]) err({ file: c.file, line: r.line }, `chain ${c.id}: route ${r.rule} needs ${id}, which does not exist`);
    else if (F[id].chain !== c.id) err({ file: c.file, line: r.line }, `chain ${c.id}: route ${r.rule} needs ${id}, which is in chain ${F[id].chain}`);
  }
  return out;
}

// runs: [{ cls, lore: [ids], seeded: bool }]
export function checkLorePlay(C, runs) {
  const L = C.story.lore, F = L.fragments, lines = []; let errors = 0;
  const fresh = runs.filter((r) => !r.seeded), seeded = runs.filter((r) => r.seeded), has = (r, ids) => ids.every((id) => r.lore.includes(id));
  for (const f of Object.values(F)) if (!runs.some((r) => r.lore.includes(f.id))) { errors++; lines.push(`error: ${f.id} (${f.layer}): an orphan, found on no run`); }
  for (const c of Object.values(L.chains)) for (const rt of c.routes) {
    let ok = false;
    if (rt.rule === "one-run") ok = fresh.some((r) => has(r, rt.needs));
    if (rt.rule === "across-runs") ok = seeded.some((r) => has(r, rt.needs));
    if (rt.rule === "two-classes") {
      ok = fresh.some((a) => fresh.some((b) => a.cls !== b.cls && rt.needs.every((id) => a.lore.includes(id) || b.lore.includes(id))));
      const one = fresh.find((r) => has(r, rt.needs)); if (one) { errors++; lines.push(`error: ${c.id}: the two-classes route is held whole by one run (${one.build})`); }
    }
    if (!ok) { errors++; lines.push(`error: ${c.id}: route ${rt.rule} (${rt.needs.join(", ")}) is completed by no runs its rule allows`); }
    else lines.push(`ok: ${c.id}: route ${rt.rule} completes`);
  }
  // no hidden two-class gate: each class completes each chain in one fresh run by some one-run route
  const classes = [...new Set(fresh.map((r) => r.cls).filter(Boolean))];
  for (const c of Object.values(L.chains)) for (const cls of classes) {
    const ones = c.routes.filter((rt) => rt.rule === "one-run");
    if (!fresh.some((r) => r.cls === cls && ones.some((rt) => has(r, rt.needs)))) { errors++; lines.push(`error: ${c.id}: no ${cls} run completes it in one run (a gate the player cannot see: give that class a one-run route)`); }
  }
  for (const r of fresh) for (const id of r.lore) if (F[id] && F[id].requires.some((q) => q.kind === "prior")) { errors++; lines.push(`error: ${id} found on a fresh run (${r.build}), though it needs an earlier run's fact`); }
  lines.push(`${fresh.length} fresh runs, ${seeded.length} seeded; ${Object.keys(F).length} fragments, ${Object.keys(L.chains).length} chain(s); ${errors} error(s)`);
  return { lines, errors };
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("tools/lorecheck.mjs");
if (isMain) {
  const { STORY } = await import("./use-story.mjs"), { BUILDS, ROUTES } = await import("./use-policy.mjs");
  const { loadAct } = await import("../dialogue/book.mjs"), { loadContent } = await import("../full.mjs");
  if (!STORY.acts) { console.log("lorecheck: this story names no act root (LW_STORY=quota has lore)"); process.exit(0); }
  const argv = process.argv.slice(2), arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  const sources = (await loadAct(STORY.acts[0], (p) => readFile(p, "utf8"))).sources, C = loadContent(sources);
  const lint = lintLore(C, sources.map((s) => s.text).join("\n"));
  for (const o of lint) console.log(`${o.file}:${o.line}: ${o.level}: ${o.msg}`);
  console.log(`lint: ${Object.keys(C.story.lore.fragments).length} fragments, ${lint.length} problem(s)`);
  if (lint.length || argv.includes("--lint")) process.exit(lint.length ? 1 : 0);
  const out = new URL("../out/lorecheck/", import.meta.url).pathname.replace(/^\/(\w:)/, "$1"); mkdirSync(out, { recursive: true });
  const play = (builds, seed, f, prior = null) => {
    const r = spawnSync(process.execPath, ["tools/playthrough.mjs", "--build", builds, "--seed", String(seed), "--json", f, ...(prior ? ["--prior", prior] : [])], { stdio: ["ignore", "ignore", "inherit"] });
    if (r.status !== 0) { console.error(`lorecheck: playthrough failed (${r.status})`); process.exit(2); }
    return JSON.parse(readFileSync(f, "utf8"));
  };
  const all = [...Object.keys(BUILDS), ...Object.keys(ROUTES)].join(","), runs = [];
  for (const s of (arg("--seeds") || "1,2").split(",")) for (const r of play(all, s, `${out}fresh-${s}.json`)) runs.push({ build: r.build, cls: r.endings && r.endings.class, lore: r.lore || [], facts: r.facts || [], seeded: false });
  const sets = [...new Set(runs.map((r) => [...r.facts].sort().join(",")).filter(Boolean))];
  sets.forEach((set, i) => { for (const r of play(Object.keys(BUILDS).join(","), 1, `${out}seeded-${i}.json`, set)) runs.push({ build: `${r.build} after [${set}]`, cls: r.endings && r.endings.class, lore: r.lore || [], seeded: true }); });
  const res = checkLorePlay(C, runs);
  console.log(res.lines.join("\n"));
  process.exit(res.errors ? 1 : 0);
}
