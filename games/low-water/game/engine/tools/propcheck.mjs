#!/usr/bin/env node
// The prop coverage check: plays the story's builds and coverage routes (as tools/eventcheck.mjs does) with
// the attentive player (the story's beat hook looks at every prop at the place, tools/quota/story.mjs), then
// reads which prop states each run showed. Every prop must be seen on at least one run (error); each state
// of the played era that no run reaches is listed (a warning: some states need a route the harness has not
// got, and the list says which). Run from game/engine; LW_STORY picks the story.
//   LW_STORY=quota node tools/propcheck.mjs [--seeds 1,2] [--runs out/runs-1.json,...]   (--runs: read runs already made)
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { BUILDS, ROUTES } from "./use-policy.mjs";
import { STORY } from "./use-story.mjs";
import { loadAct } from "../dialogue/book.mjs";
import { loadContent } from "../full.mjs";
import { checkPropCoverage } from "./proplint.mjs";

if (!STORY.acts) { console.log("propcheck: this story names no act root with props (LW_STORY=quota has them)"); process.exit(0); }
const argv = process.argv.slice(2), arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const out = new URL("../out/propcheck/", import.meta.url).pathname.replace(/^\/(\w:)/, "$1"); mkdirSync(out, { recursive: true });
let files = arg("--runs") ? arg("--runs").split(",") : [];
if (!files.length) {
  const all = [...Object.keys(BUILDS), ...Object.keys(ROUTES)].join(",");
  for (const s of (arg("--seeds") || "1,2").split(",")) {
    const f = `${out}runs-${s}.json`; files.push(f);
    const r = spawnSync(process.execPath, ["tools/playthrough.mjs", "--build", all, "--seed", s, "--json", f], { stdio: ["ignore", "ignore", "inherit"] });
    if (r.status !== 0) { console.error(`propcheck: playthrough seed ${s} failed (${r.status})`); process.exit(2); }
  }
}
const runs = files.flatMap((f) => JSON.parse(readFileSync(f, "utf8")));
const C = loadContent((await loadAct(STORY.acts[0], (p) => readFile(p, "utf8"))).sources);
const res = checkPropCoverage(C, runs);
console.log(res.lines.join("\n"));
process.exit(res.errors ? 1 : 0);
