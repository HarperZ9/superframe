#!/usr/bin/env node
// Play a path through the content from the command line.
//   node tools/quick.mjs <root.lwd | files.lwd ...> [options]
//   --start node            the node to start at (default: @meta start)
//   --path "1,2,Ask about"  choices in order: an option number (1-based) or part of its label
//   --archetype id          make the character first; --attrs wits=3,nerve=3 for a spread
//   --set flag,flag         flags set before play     --var name=value,...
//   --clock hh:mm           move the night to this time first   --place id
//   --mode fixed|dice       override @rules check-mode           --strain n  strain every check
//   --runs win|lose|off     how Tide Runs end (default: win, by walking at the goal)
//   --quiet                 print only the final beat and the state summary
// Prints each beat: its lines, then its options with check sums and lock reasons.
import { readFile } from "node:fs/promises";
import { loadAct } from "../dialogue/book.mjs";
import { loadContent, createFullGame as createGame } from "../full.mjs";
import { toMin } from "../core/expr.mjs";

const argv = process.argv.slice(2), files = [], opt = {};
for (let i = 0; i < argv.length; i++) { if (argv[i].startsWith("--")) { const k = argv[i].slice(2); opt[k] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true; } else files.push(argv[i]); }
if (!files.length) { console.error("usage: node tools/quick.mjs <root.lwd | files.lwd ...> [--start node] [--path \"1,Ask\"] [--archetype id] ..."); process.exit(2); }

const sources = [];
for (const f of files) { const { sources: s, errors } = await loadAct(f.replace(/\\/g, "/"), (p) => readFile(p, "utf8")); for (const e of errors) console.error(`${e.file}:${e.line}: ${e.msg}`); sources.push(...s.filter((x) => !sources.some((y) => y.file === x.file))); }
const C = loadContent(sources);
for (const e of C.errors) console.error(`${e.file}:${e.line}: ${e.level || "error"}: ${e.msg}`);
const G = createGame({ content: C });
if (opt.mode) G.rs.rules["check-mode"] = opt.mode;
const list = (v) => (typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean) : []);
if (opt.archetype || opt.attrs) { const attrs = opt.attrs ? Object.fromEntries(list(opt.attrs).map((p) => { const [k, v] = p.split("="); return [k, +v]; })) : null; const errs = G.create({ archetype: opt.archetype || null, attrs, enter: false }); if (errs.length) { console.error(errs.join("\n")); process.exit(1); } }
for (const f of list(opt.set)) G.setFlag(f, true);
for (const p of list(opt.var)) { const [k, v] = p.split("="); G.scope.assign(k, isNaN(+v) ? v : +v); }
if (opt.place) G.setPlace(opt.place);
if (opt.clock) G.advance(toMin(opt.clock) - G.clock());
if (opt.runs === "off") G.state.runsOff = true;

const clock = () => { const c = G.clock(); return `${String(Math.floor(c / 60) % 24).padStart(2, "0")}:${String(Math.floor(c % 60)).padStart(2, "0")}`; };
function show(beat) {
  console.log(`\n--- ${clock()}  ${G.activeTalk ? G.activeTalk.node : ""}`);
  for (const l of beat.lines) console.log(l.kind === "nar" ? `  ${l.text}` : `  ${(l.who || l.kind).toUpperCase()}: ${l.text}`);
  if (beat.run) console.log(`  [Tide Run ${beat.run}]`);
  if (beat.fight) console.log(`  [fight ${beat.fight}]`);
  (beat.options || []).forEach((o, i) => {
    let tail = "";
    if (o.check) tail = `   (${o.check.skillName} ${o.check.total} vs ${o.check.dc}${o.check.red ? ", ink" : ", pencil"}${o.check.mode === "dice" ? `, ${Math.round(o.check.odds * 100)}%` : ""}${o.locked ? `; ${o.locked}` : ""})`;
    console.log(`  ${i + 1}. ${o.label}${tail}`);
  });
  if (beat.end) console.log(`  [END ${beat.end}]`); else if (beat.exit) console.log(`  [EXIT ${beat.exit}]`); else if (beat.deadEnd) console.log(`  [DEAD END at ${beat.deadEnd}]`);
}
function runOut(t) {
  const r = G.runs.start(t.beat.run, { mode: "stepped" }), goal = r.state.def.goal;
  if (opt.runs === "lose") { G.env.command(["setTerm", "tide", "9"]); r.stepMove(0, 1); }
  for (let i = 0; i < 5000 && !r.state.done; i++) r.stepMove(goal.x - r.state.x, goal.z - r.state.z);
  console.log(`  [run ${r.state.outcome}: ${r.state.reason}]`);
  G.env.command(["clearTerm", "tide"]);
  return t.afterRun();
}

// A fight in the terminal: Lamb stands still (no input) until combat ends it; --fights idle.
function fightOut(t) {
  const id = t.beat.fight; G.ext.combat.start(id); G.loop.clockRate = G.ext.combat.clockRate || 8; // combat's own rate
  let end = null; const off = G.on("fight.end", (e) => { end = e; });
  for (let i = 0; i < 60 * 900 && !end; i++) G.loop.step();
  off(); G.loop.clockRate = 0;
  if (!end) { console.error(`  [fight ${id} did not end in 15 minutes of play]`); process.exit(1); }
  console.log(`  [fight ${id}: ${end.outcome}]`);
  return t.afterFight();
}

const t = G.talk(opt.start || G.rs.rules["start-node"] || C.book.meta.start);
let beat = t.beat;
for (const step of list(opt.path)) {
  if (!opt.quiet) show(beat);
  if (beat.run) beat = runOut(t);
  if (beat.fight) { show(beat); beat = fightOut(t); }
  const os = beat.options || [], k = /^\d+$/.test(step) ? +step - 1 : os.findIndex((o) => o.label.toLowerCase().includes(step.toLowerCase()));
  if (!os[k]) { console.error(`\nno option "${step}" here`); process.exit(1); }
  console.log(`\n> ${os[k].label}`);
  beat = t.choose(k, { strain: +opt.strain || 0 });
}
if (beat.run) { show(beat); beat = runOut(t); }
if (beat.fight) { show(beat); beat = fightOut(t); }
show(beat);
console.log(`\nstate: clock ${clock()}, place ${G.state.place || "-"}, flags ${G.state.flags.length}, pages ${G.state.sheet.points}, meters ${Object.keys(C.meters).map((m) => `${m} ${G.pressure.meter(m).toFixed(1)}`).join(", ") || "-"}`);
