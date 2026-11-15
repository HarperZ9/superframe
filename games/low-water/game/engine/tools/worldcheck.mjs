#!/usr/bin/env node
// The world record check (save/worldrecord.mjs): plays a run of each class into a fresh record, then a run of the
// other class from it, through the harness's file storage (tools/playthrough.mjs --world), and checks that
//   - each finished run left one entry: its class, end, facts, the households it harmed, its kept variables, and
//     the line its character said
//   - the next run, whatever its class, started from it: the earlier facts read by prior(), the last line, the
//     count of runs
//   - the record survives what a player can do short of clearing the site's data: deleting a save slot, deleting
//     either copy, and a copy damaged by hand (each is healed from the other)
// Run from game/engine. Exit 1 on any failure.
//   LW_STORY=quota node tools/worldcheck.mjs [--seed 1]
import { spawnSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { STORY } from "./use-story.mjs";
import { BUILDS } from "./use-policy.mjs";
import { fileStorage } from "./worldfile.mjs";
import { createWorldRecord } from "../save/worldrecord.mjs";

if (!STORY.name) { console.log("worldcheck: this story keeps no world record (LW_STORY=quota does)"); process.exit(0); }
const argv = process.argv.slice(2), seed = argv.includes("--seed") ? argv[argv.indexOf("--seed") + 1] : "1";
const out = new URL("../out/worldcheck/", import.meta.url).pathname.replace(/^\/(\w:)/, "$1");
const fails = [], ok = (c, msg) => { if (!c) fails.push(msg); console.log(`${c ? "ok  " : "FAIL"} ${msg}`); };
const play = (build, dir, f) => {
  const r = spawnSync(process.execPath, ["tools/playthrough.mjs", "--build", build, "--seed", seed, "--world", dir, "--json", f], { stdio: ["ignore", "ignore", "inherit"] });
  if (r.status !== 0) { console.error(`worldcheck: playthrough ${build} failed (${r.status})`); process.exit(2); }
  return JSON.parse(readFileSync(f, "utf8"))[0];
};
const classes = Object.keys(BUILDS);
for (const [a, b] of classes.flatMap((x) => classes.filter((y) => y !== x).map((y) => [x, y]))) {
  const dir = join(out, `${a}-then-${b}`); rmSync(dir, { recursive: true, force: true });
  const r1 = play(a, dir, join(out, `${a}-${b}-1.json`)), W = createWorldRecord(fileStorage(dir), STORY.name);
  const e = W.runs();
  ok(e.length === 1 && e[0].class === BUILDS[a].cls && e[0].end, `${a}: the finished run left one entry (class ${e[0] && e[0].class}, end ${e[0] && e[0].end})`);
  ok(e[0] && (r1.facts || []).every((f) => e[0].facts.includes(f)), `${a}: the entry keeps the run's lore facts (${(r1.facts || []).join(", ") || "none"}) and its world facts (${e[0] ? e[0].facts.filter((f) => f.startsWith("world.")).join(", ") || "none" : "?"})`);
  ok(e[0] && e[0].line && e[0].line.words, `${a}: the entry quotes the character: "${e[0] && e[0].line ? e[0].line.words : ""}"`);
  const r2 = play(b, dir, join(out, `${a}-${b}-2.json`));
  ok(r2.prior && r2.prior.runs === 1 && JSON.stringify([...r2.prior.facts].sort()) === JSON.stringify([...e[0].facts].sort()), `${b} after ${a}: the next run started from the record (${r2.prior ? r2.prior.facts.length : 0} facts)`);
  ok(r2.prior && r2.prior.line === e[0].line.words, `${b} after ${a}: it carries the last character's line`);
  ok(W.runs().length === 2, `${b} after ${a}: the record now holds both runs`);
  // what a player can do short of clearing the site's data
  const S = fileStorage(dir);
  S.set("lowwater.save.1", "{}"); S.remove("lowwater.save.1"); ok(W.runs().length === 2, "a save slot written and deleted beside it leaves the record (tests/worldrecord.test.mjs plays it through the saves)");
  S.remove(W.keys[0]); ok(W.runs().length === 2 && S.get(W.keys[0]), "deleting the first copy: healed from the second");
  S.remove(W.keys[1]); ok(W.runs().length === 2 && S.get(W.keys[1]), "deleting the second copy: healed from the first");
  writeFileSync(join(dir, `${W.keys[0]}.json`), S.get(W.keys[0]).replace(/"runs":\[/, '"runs":[{"run":"forged"},')); ok(W.runs().length === 2 && !W.runs().some((x) => x.run === "forged"), "a copy edited by hand: its sum fails, and it is rewritten from the other");
}
console.log(`${fails.length ? fails.length + " failure(s)" : "world record: every check passed"}`);
process.exit(fails.length ? 1 : 0);
