#!/usr/bin/env node
// Every fight a non-fighter is forced into has a way through that is not fighting, for that build
// (coordinator, 2026-10-21). The non-fighter builds (Shadow, Eye, Tongue) never choose a fight, so every fight
// they meet is forced on them: by a scene, an event, a failed check or a sneak gone wrong. Each such
// fight must end, in at least one of their runs, by talk (the fight's talk exit: talking it down,
// reading the room) or by leaving (fled: slipping out by a way out). Plays the three builds over seeds
// 1 to 5 (all three acts), or reads runs already made, and lists every forced fight with its outcomes.
//   node tools/exitcheck.mjs [--seeds 1,2,3,4,5]        node tools/exitcheck.mjs out/runs/*.json
// Exit 1 when a build meets a forced fight it never gets through except by fighting.
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";

import { STORY } from "./use-story.mjs";
export const NON_FIGHTERS = STORY.nonFighters || ["shadow", "eye", "tongue"]; // the story's builds that never choose a fight
export const WAYS_THROUGH = ["talk", "fled"];

// { fightId: { "build:outcome": count } } over the non-fighters' runs
export function tally(runs) {
  const t = {};
  for (const r of runs) { const b = r.build.split(" ")[0]; if (!NON_FIGHTERS.includes(b)) continue; for (const f of r.fights || []) { const k = `${b}:${f.outcome}`; (t[f.id] ||= {})[k] = (t[f.id][k] || 0) + 1; } }
  return t;
}
export const through = (outcomes) => Object.keys(outcomes).some((k) => WAYS_THROUGH.includes(k.split(":")[1]));

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("tools/exitcheck.mjs");
if (isMain) {
  const argv = process.argv.slice(2), given = argv.filter((a) => !a.startsWith("--") && a.endsWith(".json"));
  let files = given;
  if (!files.length) {
    const i = argv.indexOf("--seeds"), seeds = (i >= 0 ? argv[i + 1] : "1,2,3,4,5").split(",");
    const out = new URL("../out/exitcheck/", import.meta.url).pathname.replace(/^\/(\w:)/, "$1"); mkdirSync(out, { recursive: true });
    files = seeds.map((s) => { const f = `${out}runs-${s}.json`; const r = spawnSync(process.execPath, ["tools/playthrough.mjs", "--build", NON_FIGHTERS.join(","), "--seed", s, "--json", f], { stdio: ["ignore", "ignore", "inherit"] }); if (r.status !== 0) { console.error(`exitcheck: seed ${s} failed`); process.exit(2); } return f; });
  }
  const runs = files.flatMap((f) => { const j = JSON.parse(readFileSync(f, "utf8")); return Array.isArray(j) ? j : j.runs || [j]; });
  // per build: every fight a build meets must end by talk or by leaving in at least one of that build's runs
  const t = tally(runs); let bad = 0, pairs = 0;
  for (const [id, o] of Object.entries(t).sort()) {
    const builds = [...new Set(Object.keys(o).map((k) => k.split(":")[0]))], miss = builds.filter((b) => !Object.keys(o).some((k) => k.startsWith(b + ":") && WAYS_THROUGH.includes(k.split(":")[1])));
    pairs += builds.length; bad += miss.length;
    console.log(`${miss.length ? "MISS" : "ok  "} ${id.padEnd(18)} ${Object.entries(o).map(([k, n]) => `${k} ${n}`).join(", ")}${miss.length ? `   no way through for ${miss.join(", ")}` : ""}`);
  }
  console.log(`${Object.keys(t).length} forced fights, ${pairs} build-and-fight pairs in ${runs.length} non-fighter runs; ${bad} pair${bad === 1 ? "" : "s"} with no way through but fighting`);
  process.exit(bad ? 1 : 0);
}
