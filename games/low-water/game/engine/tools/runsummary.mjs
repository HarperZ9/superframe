#!/usr/bin/env node
// Summary of many full playthroughs (tools/playthrough.mjs --json, one file per seed): per build, how
// many finished, run length in steps and in choices per act, stalls, dead ends, errors, fight results,
// and the events that never fired in any run (and in every run).
// With --events it lists, for every event, the routes and builds it fired in (seeded routes marked
// "seeded"); with --require-all it exits 1 when an event never fired (the coverage check for CI;
// guards that the script never needs are covered by tests/events.test.mjs and listed in GUARDS).
//   node tools/runsummary.mjs out/runs/seed*.json [--events] [--require-all]
import { readFileSync } from "node:fs";
const args = process.argv.slice(2), files = args.filter((a) => !a.startsWith("--"));
import { GUARDS } from "./use-story.mjs"; // fallbacks the script never needs (a test fires them)
const runs = files.flatMap((f) => { const j = JSON.parse(readFileSync(f, "utf8")); return (Array.isArray(j) ? j : j.runs || [j]).map((r) => ({ ...r, file: f })); });
const by = {}; for (const r of runs) (by[r.build.split(" ")[0]] ||= []).push(r);
const stat = (xs) => { const s = [...xs].sort((a, b) => a - b); return `${s[0]} to ${s[s.length - 1]}, median ${s[Math.floor(s.length / 2)]}`; };
for (const [b, rs] of Object.entries(by)) {
  console.log(`== ${b}: ${rs.filter((r) => r.finished).length} of ${rs.length} finished; steps ${stat(rs.map((r) => r.steps))}`);
  for (const a of [1, 2, 3]) { const acts = rs.map((r) => r.acts.find((x) => x.act === a)).filter(Boolean); if (acts.length) console.log(`   act ${a}: choices ${stat(acts.map((x) => x.choices))}; ends ${[...new Set(acts.map((x) => x.end))].join(", ")}`); }
  const stalls = rs.filter((r) => r.stall), dead = rs.flatMap((r) => r.deadEnds || []), errs = rs.flatMap((r) => r.errors || []);
  console.log(`   stalls ${stalls.length}${stalls.length ? ": " + stalls.map((r) => `${r.file.split(/[\/]/).pop()} act ${r.stall.act} at ${r.stall.node} (${r.stall.why})`).join("; ") : ""}; dead ends ${dead.length}; errors ${errs.length}${errs.length ? ": " + [...new Set(errs)].slice(0, 3).join(" | ") : ""}`);
  const f = {}; for (const r of rs) for (const x of r.fights || []) { const k = x.id || x[0] || String(x); const o = x.outcome || x[1] || ""; (f[k] ||= {})[o] = ((f[k] || {})[o] || 0) + 1; }
  console.log(`   fights: ${Object.entries(f).map(([k, o]) => `${k} ${Object.entries(o).map(([w, n]) => `${w} ${n}`).join("/")}`).join("; ")}`);
}
const unf = {}; for (const r of runs) for (const a of r.acts) for (const e of a.unfired || []) unf[`act ${a.act} ${e}`] = (unf[`act ${a.act} ${e}`] || 0) + 1;
const all = Object.entries(unf).filter(([, n]) => n === runs.length).map(([k]) => k), some = Object.entries(unf).filter(([, n]) => n < runs.length).map(([k, n]) => `${k} (${n})`);
console.log(`\n${runs.length} runs. Events that never fired in any run (${all.length}): ${all.join(", ")}`);
console.log(`Events unfired in some runs only (${some.length}): ${some.join(", ")}`);

if (args.includes("--events") || args.includes("--require-all")) {
  // every event any act declares (unfired in some run, or fired in all), and where it fired
  const fired = {}, seen = new Set();
  for (const r of runs) for (const a of r.acts) for (const e of a.unfired || []) seen.add(`act ${a.act} ${e}`);
  for (const k of seen) for (const r of runs) { const a = r.acts.find((x) => `act ${x.act} ` === k.slice(0, 6)); if (a && !(a.unfired || []).includes(k.slice(6))) (fired[k] ||= new Set()).add(r.build.split(" ")[0] + ((r.seeded || []).some((n) => n <= +k[4]) ? " (seeded)" : "")); }
  const never = [...seen].filter((k) => !fired[k] && !GUARDS.includes(k));
  if (args.includes("--events")) for (const k of [...seen].sort()) console.log(`${k}: ${fired[k] ? [...fired[k]].join(", ") : GUARDS.includes(k) ? "a guard, fired by tests/events.test.mjs" : "NEVER"}`);
  console.log(`events not fired in any run: ${never.length}${never.length ? ": " + never.join(", ") : ""}`);
  // --clockcheck runs: choices that moved the clock past their stated minutes (a re-entrant advance)
  const cf = runs.flatMap((r) => (r.clockFindings || []).map((f) => ({ build: r.build.split(" ")[0], ...f })));
  if (runs.some((r) => r.clockFindings)) console.log(`clock check: ${cf.length} choice${cf.length === 1 ? "" : "s"} moved the clock past their stated minutes${cf.length ? ": " + cf.slice(0, 5).map((f) => `${f.build} act ${f.act} ${f.node} "${f.label}" ${f.moved} for ${f.stated}`).join("; ") : ""}`);
  if (args.includes("--require-all") && (never.length || cf.length)) process.exitCode = 1;
}
