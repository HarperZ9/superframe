// Pilot input export for the combat step port: for each of the 40 corpus fights, the world as
// createWorld leaves it (defs, the move table, fighters, arena, props), the brain configs, and the
// environment the step reads from the game (the field's terms at every refresh, the clock at every
// hash, the footing grip table). Run from the game's engine folder: node <this> <out.json>
import { writeFileSync } from "node:fs";
import { makeWorld, makeG } from "./combat/tests/helpers.mjs";
import { ARENAS } from "./combat/data/arenas.mjs";
import { ARCHETYPES } from "./combat/data/foes.mjs";
import { corpusRun } from "./combat/tools/trace.mjs";
import { createPilot } from "./combat/tools/pilot.mjs";

const KINDS = ["stone", "mud", "wood", "weed", "shingle", "sand", "frost", "water"];
const runs = [];
for (let i = 0; i < 40; i++) {
  const { arena, seed, foes, name } = corpusRun(i);
  const W = makeWorld({ G: makeG({ clock: "23:30" }), arena: ARENAS[arena], seed, foes, minutesPerFrame: 1 / 240 });
  const grip = {};
  for (const k of KINDS) { grip[k] = W.field.gripOf(k); grip[`wet ${k}`] = W.field.gripOf(`wet ${k}`); }
  const setup = {
    name, arena, seed,
    defs: W.defs, moves: W.moves, fighters: W.fighters, props: W.props, opening: W.opening,
    field: { arena: W.field.arena, bounds: W.field.bounds, terms0: { ...W.field.terms } },
    brains: Object.fromEntries(W.fighters.filter((F) => W.brains[F.id]).map((F) => [F.id, ARCHETYPES[W.defs[F.id].style].brain])),
    grip, clock0: W.G.env.clock(),
  };
  const setupText = JSON.stringify(setup);
  // run the fight as the corpus does, sampling the environment the step reads
  const pilot = createPilot(), terms = [], clocks = [];
  for (let f = 0; f < 900 && !W.result; f++) {
    W.step({ lamb: pilot(W) });
    if (W.tick % W.envEvery === 1) terms.push({ tick: W.tick, terms: { ...W.field.terms } });
    clocks.push(W.G.env.clock());
  }
  runs.push({ ...JSON.parse(setupText), terms, clocks, ticks: W.tick });
}
writeFileSync(process.argv[2], JSON.stringify({ runs }) + "\n");
console.log(`${runs.length} fights`);
