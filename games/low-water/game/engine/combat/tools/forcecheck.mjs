// The inner arena's played check (design/spine-plan/inferno/06-SYSTEMS.md section 6, `forcecheck`; bounds S1, S2
// and S5 in combat/PROGRESS.md 29). On the simulator, per flaw and seed, two kinds of scripted player
// (combat/tools/innerbots.mjs):
//   - a resolution bot per non-force verb must reach that verb's outcome within the flaw's limit (S1)
//   - a force bot must never reach a non-force outcome (fled, endured, laid, talk): it ends forced or down (S1)
//   - a meant-to-lose boss under the force bot never reaches 0 standing and never ends as win (S5)
//   - the story's state outside G.state.inner is the same before and after the run records the outcome (S2)
// The Adversary's movements have no force ending (DECISIONS inferno 1: force cannot end it), so only their
// resolutions are played. Controls must fail: an endure count it can never reach, a meant-to-lose boss with no floor.
//   node combat/tools/forcecheck.mjs [--seeds 1,2] [--only prudence,friday] [--json]
import { FLAWS, HOST } from "../data/flaws.mjs";
import { VERBS } from "../data/flaws-common.mjs";
import { createInnerWorld } from "../arena/innerworld.mjs";
import { createHostWorld } from "../arena/hostworld.mjs";
import { createInnerRun } from "../arena/inner.mjs";
import { forceBot, resolveBot } from "./innerbots.mjs";

export const LEVELS = { grip: 5, ballast: 5, coat: 5, knees: 5, pen: 4, nose: 4 }; // a fighter's build, as the arena run starts one
const NONFORCE = new Set(["fled", "endured", "laid", "talk"]);
const story = (G) => { const { inner, ...rest } = G.state; return JSON.stringify(rest); };

// one fight to its end; returns the result, the boss's lowest standing, and whether the story's state held
export function play({ makeG, flaw, verb, seed, host = null }) {
  const G = makeG();
  const W = host ? createHostWorld({ G, movement: host.movement, limbs: host.limbs, seed, levels: LEVELS }) : createInnerWorld({ G, flaw, seed, levels: LEVELS });
  const before = story(G); // after the world reads the night (the field's first read creates G.state.body)
  const bot = verb === "force" ? forceBot() : resolveBot(W, verb);
  let minHp = Infinity; const B = () => W.byId("boss");
  for (let i = 0; i < 60 * 300 && !W.result; i++) { W.step({ lamb: bot(W) }); if (B()) minHp = Math.min(minHp, B().hp); }
  const R = createInnerRun({ flaw: host ? "host" : flaw.id, flawRec: host ? null : flaw, G, seed });
  R.finish(W); if (R.stage().kind === "offer") R.choose(0);
  if (flaw && flaw.plantFate) G.state.bowls = { haldane: 4 }; // the control's plant: an outcome that wrote a fate
  return { result: W.result, secs: +(W.tick / 60).toFixed(1), minHp: +minHp.toFixed(2), storyHeld: story(G) === before };
}

export function checkFlawPlayed(makeG, flaw, seeds) {
  const rows = [], errs = [], err = (m) => errs.push(`${flaw.id}: ${m}`);
  const s = flaw.meantToLose ? [...seeds, Math.max(...seeds) + 1] : seeds;
  for (const seed of s) {
    const r = play({ makeG, flaw, verb: "force", seed }); rows.push({ flaw: flaw.id, seed, bot: "force", ...r });
    if (!r.result || NONFORCE.has(r.result.outcome)) err(`seed ${seed}: the force bot reached ${r.result && r.result.outcome} (S1)`);
    if (flaw.meantToLose && (r.minHp <= 0 || (r.result && r.result.outcome === "win"))) err(`seed ${seed}: meant to be lost, and the force bot brought it to ${r.minHp} standing (${r.result.outcome}) (S5)`);
    if (!r.storyHeld) err(`seed ${seed}: force changed the story's state outside G.state.inner (S2)`);
  }
  const verbs = Object.keys(flaw.verbs).filter((v) => v !== "lose" || flaw.meantToLose || flaw.loseEnds);
  for (const v of verbs) for (const seed of seeds) {
    const r = play({ makeG, flaw, verb: v, seed }); rows.push({ flaw: flaw.id, seed, bot: v, ...r });
    if (!r.result || r.result.outcome !== VERBS[v]) err(`seed ${seed}: the ${v} bot ended ${r.result ? `${r.result.outcome} (${r.result.reason})` : "nowhere"}, not ${VERBS[v]}, within ${flaw.limit / 60} s (S1)`);
    if (!r.storyHeld) err(`seed ${seed}: ${v} changed the story's state outside G.state.inner (S2)`);
  }
  return { rows, errs };
}

export function checkHostPlayed(makeG, seeds, limbs = ["prudence", "friday"]) {
  const rows = [], errs = [];
  HOST.movements.forEach((M, movement) => {
    const v = M.verbs.name ? "name" : "endure";
    for (const seed of seeds) {
      const r = play({ makeG, verb: v, seed, host: { movement, limbs } }); rows.push({ flaw: `host:${M.id}`, seed, bot: v, ...r });
      if (!r.result || r.result.outcome !== VERBS[v]) errs.push(`host ${M.id}: seed ${seed}: the ${v} bot ended ${r.result && r.result.outcome}, not ${VERBS[v]}`);
      if (!r.storyHeld) errs.push(`host ${M.id}: seed ${seed}: changed the story's state (S2)`);
    }
  });
  return { rows, errs };
}

const clone = (f, over) => ({ ...f, ...over });
export const CONTROLS = [
  ["an endure count it can never reach (rounds 999)", () => clone(FLAWS.check, { id: "check-999", verbs: { ...FLAWS.check.verbs, endure: { ...FLAWS.check.verbs.endure, rounds: 999 } } }), /endure bot ended/],
  ["a meant-to-lose boss with its floor removed", () => clone(FLAWS.friday, { id: "friday-nofloor", meantToLose: true, floor: 0 }), /S5/],
  ["an outcome that writes bowls(haldane)", () => clone(FLAWS.check, { id: "check-fate", plantFate: true }), /S2/],
];

if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("combat/tools/forcecheck.mjs")) {
  const { makeG } = await import("../tests/helpers.mjs");
  const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : null; };
  const seeds = (arg("seeds") || "1,2").split(",").map(Number), only = arg("only") ? arg("only").split(",") : Object.keys(FLAWS);
  const all = { rows: [], errs: [] };
  for (const id of only) { const r = checkFlawPlayed(makeG, FLAWS[id], seeds); all.rows.push(...r.rows); all.errs.push(...r.errs); }
  if (!arg("only")) { const h = checkHostPlayed(makeG, seeds); all.rows.push(...h.rows); all.errs.push(...h.errs); }
  const controls = CONTROLS.map(([name, make, want]) => { const r = checkFlawPlayed(makeG, make(), seeds); return { name, failed: r.errs.some((e) => want.test(e)), errs: r.errs }; });
  if (process.argv.includes("--json")) console.log(JSON.stringify({ ...all, controls }, null, 1));
  else {
    for (const r of all.rows) console.log(`  ${r.flaw.padEnd(16)} seed ${r.seed} ${r.bot.padEnd(7)} -> ${(r.result ? r.result.outcome : "none").padEnd(8)} ${(r.result ? r.result.reason : "").padEnd(10)} ${String(r.secs).padStart(6)} s  boss low ${r.minHp}`);
    console.log(`forcecheck: ${all.rows.length} fights, ${all.errs.length} errors`);
    for (const e of all.errs) console.log(`  ERROR ${e}`);
    for (const c of controls) console.log(`  control ${c.failed ? "fails, as it must" : "PASSES: the check is broken"}: ${c.name}`);
  }
  if (all.errs.length || controls.some((c) => !c.failed)) process.exit(1);
}
