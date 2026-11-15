// The arena mode played by the scripted player (combat/tools/pilot.mjs), to measure the ladder:
// how far a committed build climbs and how far a spread build gets, over seeds, with the tuning numbers
// (combat/arena/metrics.mjs): time to kill by archetype, dodge success, blows taken and deaths by pattern,
// and every boss fight.
//   node tools/arenarun.mjs [--seeds 1-5] [--builds committed,spread] [--max 12] [--mods frost,fog]
//     [--arena floor] [--json out/arena.json]
// Builds pick between rounds:
//   committed   one tool kept, and one family (grip, ballast, coat; the tool's temper first)
//   spread      whatever lifts the lowest level, and a new tool when one is offered
// Heavy: run a few seeds a call (each run is a minute or two of CPU), under the heavy-cpu lock.
import { writeFile } from "node:fs/promises";
import { createGame } from "../game.mjs";
import { ARENAS } from "../combat/data/arenas.mjs";
import { createRun, LEVELS } from "../combat/arena/run.mjs";
import { createPilot } from "../combat/tools/pilot.mjs";
import { readFileSync } from "node:fs";

const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
const [s0, s1] = String(opt.seeds || "1-5").split("-").map(Number), SEEDS = Array.from({ length: (s1 || s0) - s0 + 1 }, (_, i) => s0 + i);
const BUILDS = String(opt.builds || "committed,spread").split(","), MAX = +(opt.max || 12), MODS = opt.mods ? String(opt.mods).split(",") : [];
const SKIN = opt.skin || null; // --skin bread | club: The Quota's venues (combat/data/skins-quota.mjs)
const ARENA = ARENAS[opt.arena || (SKIN ? { bread: "millyard", club: "clubring" }[SKIN] : "floor")], LWD = readFileSync(new URL("../combat/test-content/arena.lwd", import.meta.url), "utf8");

// both start the same, as a fighter (the story's Lamb is built to avoid fights): 23 level points and a stick
// (--tool another); they differ only in what they take between rounds
const BASE = { grip: 4, ballast: 4, coat: 4, knees: 4, pen: 4, nose: 3 }, TOOL = opt.tool || "w.stick";
const START = { committed: { tool: TOOL, levels: { ...BASE } }, spread: { tool: TOOL, levels: { ...BASE } } };
const FAMILY = String(opt.family || "grip,ballast,coat").split(","); // --family pen,coat,nose: the committed build's levels, first first
function pick(build, R, choices) {
  const S = R.state, lv = (k) => S.levels[k] ?? (k === "coat" ? 2 : 3);
  const score = (o) => {
    if (build === "committed" && o.kind === "boon") return o.boon === (opt.boon || "edge") ? 6 : 0.4; // the committed build takes its one boon whenever offered
    if (build === "spread" && o.kind === "boon") return 3.5 - ((R.state.taken || {})[o.boon] || 0); // the spread one any boon it has least of
    if (build === "committed") return o.kind === "level" && o.lv === FAMILY[0] ? 5 : o.kind === "temper" ? 4.5 : o.kind === "level" && FAMILY.includes(o.lv) ? 4 - FAMILY.indexOf(o.lv) * 0.5 : o.kind === "mend" ? 1 : o.kind === "level" ? 0.5 : -1;
    return o.kind === "level" ? 4 - (lv(o.lv) - Math.min(...LEVELS.map(lv))) : o.kind === "tool" ? 2.5 : o.kind === "temper" ? 2 : 1;
  };
  return choices.map((o, i) => [i, score(o)]).sort((a, b) => b[1] - a[1])[0][0];
}

function play(build, seed) {
  const R = createRun({ seed, mods: MODS, start: START[build], skin: SKIN });
  for (let guard = 0; guard < 200; guard++) {
    const st = R.stage();
    if (st.kind === "over") break;
    if (st.kind === "offer") { R.choose(pick(build, R, st.choices)); if (R.state.round > MAX) break; continue; }
    const G = createGame({ sources: [{ file: "arena.lwd", text: LWD }], seed });
    const W = R.world(G, ARENA), p = createPilot();
    for (let i = 0; i < 60 * 240 && !W.result; i++) W.step({ lamb: p(W) });
    R.finish(W);
  }
  return { build, ...R.summary() };
}

const rows = [];
for (const b of BUILDS) for (const s of SEEDS) { const t0 = Date.now(), r = play(b, s); rows.push(r); console.log(`${b.padEnd(9)} seed ${s}: cleared ${r.cleared} rounds (reached ${r.reached}); ${r.tool} temper ${r.temper}; levels ${JSON.stringify(r.levels)}; ${((Date.now() - t0) / 1000).toFixed(0)} s`); }
const med = (xs) => { const s = [...xs].sort((a, b) => a - b), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
for (const b of BUILDS) { const g = rows.filter((r) => r.build === b); console.log(`${b}: median rounds cleared ${med(g.map((r) => r.cleared))} (${g.map((r) => r.cleared).join(", ")})`); }
// the tuning numbers over every run
const all = { ttk: {}, dodges: { tried: 0, evaded: 0 }, deaths: {}, taken: {}, bosses: [] };
for (const r of rows) {
  const m = r.metrics; for (const [k, v] of Object.entries(m.ttk)) (all.ttk[k] ||= []).push(v.median);
  all.dodges.tried += m.dodges.tried; all.dodges.evaded += m.dodges.evaded;
  for (const [k, n] of Object.entries(m.deaths)) all.deaths[k] = (all.deaths[k] || 0) + n;
  for (const [k, t] of Object.entries(m.taken)) { const a = (all.taken[k] ||= { n: 0, dmg: 0 }); a.n += t.n; a.dmg = +(a.dmg + t.dmg).toFixed(1); }
  all.bosses.push(...m.bosses.map((x) => ({ build: r.build, seed: r.seed, ...x })));
}
console.log(`time to kill (median of run medians, s): ${Object.entries(all.ttk).sort().map(([k, xs]) => `${k} ${med(xs)}`).join(", ")}`);
console.log(`dodges: ${all.dodges.evaded} of ${all.dodges.tried} let a blow through (${all.dodges.tried ? Math.round((100 * all.dodges.evaded) / all.dodges.tried) : 0}%)`);
console.log(`deaths by pattern: ${Object.entries(all.deaths).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(", ") || "none"}`);
console.log(`most damage taken: ${Object.entries(all.taken).sort((a, b) => b[1].dmg - a[1].dmg).slice(0, 8).map(([k, t]) => `${k} ${t.dmg} (${t.n})`).join(", ")}`);
console.log(`bosses: ${all.bosses.map((x) => `${x.build}/${x.seed} ${x.boss} r${x.round} ${x.outcome} ${x.secs}s phase ${x.phase} left ${x.left}`).join("; ") || "none reached"}`);
if (opt.json) await writeFile(opt.json, JSON.stringify(rows, null, 1));
