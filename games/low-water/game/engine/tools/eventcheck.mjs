#!/usr/bin/env node
// The event coverage check: every @event in the three acts fires in at least one run of the six
// builds and the coverage routes (tools/policy.mjs ROUTES), or is a guard with its own test. Plays
// them all (seeds 1 and 2 by default, all three acts), then tools/runsummary.mjs --require-all, and
// reads every beat those runs showed with tools/tidelint.mjs and tools/clocklint.mjs. The runs play with
// the live world's interrupts on (--clockcheck), and any choice that moves the clock past its stated
// minutes fails too. Exit 1 on any.
//   node tools/eventcheck.mjs [--seeds 1,2]
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { BUILDS, ROUTES } from "./use-policy.mjs";
const argv = process.argv.slice(2), i = argv.indexOf("--seeds"), seeds = (i >= 0 ? argv[i + 1] : "1,2").split(",");
const out = new URL("../out/eventcheck/", import.meta.url).pathname.replace(/^\/(\w:)/, "$1"); mkdirSync(out, { recursive: true });
const all = [...Object.keys(BUILDS), ...Object.keys(ROUTES)].join(","), files = [], beats = [];
for (const s of seeds) {
  const f = `${out}runs-${s}.json`, bl = `${out}beats-${s}.jsonl`; files.push(f); beats.push(bl);
  const r = spawnSync(process.execPath, ["tools/playthrough.mjs", "--build", all, "--seed", s, "--json", f, "--beatlog", bl, "--clockcheck"], { stdio: ["ignore", "ignore", "inherit"] });
  if (r.status !== 0) { console.error(`eventcheck: playthrough seed ${s} failed (${r.status})`); process.exit(2); }
}
let bad = spawnSync(process.execPath, ["tools/runsummary.mjs", ...files, "--events", "--require-all"], { stdio: "inherit" }).status;
for (const bl of beats) for (const lint of ["tools/tidelint.mjs", "tools/clocklint.mjs"]) { const r = spawnSync(process.execPath, [lint, bl], { stdio: "inherit" }); bad = bad || r.status; }
process.exit(bad ? 1 : 0);
