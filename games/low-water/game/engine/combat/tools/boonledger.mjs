// The inner arena's boons and what they cost (design/spine-plan/inferno/06-SYSTEMS.md sections 4 and 6; bounds B1
// and B2 in combat/PROGRESS.md 29).
//   B1  an offer exists only after force (`forced`): one offer, the flaw's own, which the player can decline;
//       refusing, enduring, yielding, losing and naming offer nothing
//   B2  every boon has a cost: who is a @char in content/quota, scene is a content file, the beat is written;
//       taking it sends `boon.cost` through onRecord at once, with those fields; declining sends nothing
//   and the boon sharpens the harmful verb: the next fight's character differs where the boon says
// Not checked here, and waiting on the story lead: that the named scene plays the beat (it reads the record:
// innerboon(id), G.state.inner, combat/arena/inner.mjs).
// Controls must fail: a run that offers after a yield; a boon with no cost; a cost on "a family".
//   node combat/tools/boonledger.mjs
import { FLAWS } from "../data/flaws.mjs";
import { createInnerRun } from "../arena/inner.mjs";
import { innerLamb } from "../arena/innerspawn.mjs";

const OUTCOMES = [["forced", "force"], ["laid", "yield"], ["endured", "endure"], ["fled", "refuse"], ["down", "lose"], ["talk", "name"]];

export function checkBoons(ctx, { flaws = FLAWS, makeRun = createInnerRun } = {}) {
  const errs = [];
  for (const f of Object.values(flaws)) {
    const err = (m) => errs.push(`${f.id}: ${m}`);
    if (f.boon) {
      const c = f.boon.cost;
      if (!c) err(`boon ${f.boon.id} has no cost (B2)`);
      else {
        if (!ctx.chars.has(c.who)) err(`boon ${f.boon.id}: who (${c.who}) is not a @char (B2)`);
        if (!ctx.scenes.has(c.scene)) err(`boon ${f.boon.id}: scene ${c.scene} is not a content file (B2)`);
        if (!c.beat || c.beat.length < 20) err(`boon ${f.boon.id}: no written beat (B2)`);
      }
      if (!f.boon.effect || !Object.keys(f.boon.effect).length) err(`boon ${f.boon.id} changes nothing in the fight`);
      // it sharpens the harmful verb: the character differs where the boon says
      else if (!sharpens(f)) err(`boon ${f.boon.id}: the next fight's character is the same with it as without`);
    }
    // B1: played over every outcome
    for (const [outcome, verb] of OUTCOMES) {
      const got = [], R = makeRun({ flaw: f.id, flawRec: f, onRecord: (e) => got.push(e) });
      R.finish({ result: { outcome, verb, reason: "check" } });
      const st = R.stage();
      if (st.kind === "offer" && outcome !== "forced") err(`an offer after ${outcome} (B1)`);
      if (outcome === "forced" && f.boon && st.kind !== "offer") err(`no offer after force (B1)`);
      if (st.kind === "offer") {
        if (!st.boon || st.boon.id !== (f.boon || {}).id) err(`the offer is not the flaw's own boon (B1)`);
        const n = got.length; R.choose(0); const ev = got.slice(n).find((e) => e.type === "boon.cost");
        if (!ev) err(`taking ${st.boon && st.boon.id} recorded no boon.cost at once (B2)`);
        else for (const k of ["who", "scene", "beat"]) if (!ev[k] || (f.boon && f.boon.cost && ev[k] !== f.boon.cost[k])) err(`boon.cost.${k} is not the boon's own (B2)`);
        const D = makeRun({ flaw: f.id, flawRec: f, onRecord: (e) => got.push(e) }), m = got.length;
        D.finish({ result: { outcome, verb, reason: "check" } }); if (D.stage().kind === "offer") D.choose(1);
        if (got.slice(m).some((e) => e.type === "boon.cost")) err(`declining the boon still recorded a cost (B1)`);
        if (D.stage().kind !== "morning") err(`after declining, the run does not go on to the morning`);
      }
    }
  }
  return errs;
}

// the boon's effect shows in the character the next fight builds
function sharpens(f) {
  const a = innerLamb(f, {}), b = innerLamb(f, { boons: [f.boon] }), e = f.boon.effect;
  if (e.ways) return b.def.ways === true;
  if (e.keepFeet) return b.def.keepFeet === true;
  return JSON.stringify(a.def) !== JSON.stringify(b.def) || JSON.stringify(a.moves) !== JSON.stringify(b.moves);
}

const clone = (x) => JSON.parse(JSON.stringify(x));
export const CONTROLS = [
  ["a run that offers after a yield (B1)", { makeRun: (o) => { const R = createInnerRun(o); const f0 = R.finish; R.finish = (W) => { f0(W); if (W.result.outcome === "laid") { R.state.offer = o.flawRec.boon; R.state.phase = "offer"; } }; return R; }, flaws: { forty: FLAWS.forty } }, /B1/],
  ["a boon with no cost (B2)", { flaws: { only: { ...clone(FLAWS.only), boon: { ...clone(FLAWS.only.boon), cost: null } } } }, /B2/],
  ["a cost on a family, not a person (B2)", { flaws: { only: { ...clone(FLAWS.only), boon: { ...clone(FLAWS.only.boon), cost: { ...FLAWS.only.boon.cost, who: "a family" } } } } }, /B2/],
];

if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("combat/tools/boonledger.mjs")) {
  const { loadContent } = await import("./innerctx.mjs");
  const ctx = loadContent(), errs = checkBoons(ctx);
  const withBoon = Object.values(FLAWS).filter((f) => f.boon);
  console.log(`boonledger: ${withBoon.length} boons (${withBoon.map((f) => `${f.boon.name}: ${f.boon.cost.who}`).join("; ")}), ${errs.length} errors`);
  for (const e of errs) console.log(`  ERROR ${e}`);
  const controls = CONTROLS.map(([name, opt, want]) => { const e = checkBoons(ctx, opt); return { name, failed: e.some((x) => want.test(x)) }; });
  for (const c of controls) console.log(`  control ${c.failed ? "fails, as it must" : "PASSES: the check is broken"}: ${c.name}`);
  if (errs.length || controls.some((c) => !c.failed)) process.exit(1);
}
