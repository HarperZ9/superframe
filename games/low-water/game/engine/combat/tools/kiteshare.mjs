// The share of each fight Lamb spends opening the gap on the nearest opponent while in nobody's
// reach (sim/world.mjs W.kited), fair against kite, for setting WORLD.breakOff.kitedShare.
//   node tools/kiteshare.mjs   (run from game/engine/combat)
import { createGame } from "../../game.mjs";
import { installCombat } from "../encounter.mjs";
import { createPilot } from "../tools/pilot.mjs";
import { ACTS, STYLES } from "../tools/kite.mjs";
import { loadPlateArena, PLATE_OF } from "../data/plates.mjs";
for (const pol of ["fair", "kite"]) { const sh = [], ap = [];
for (const style of ["fist", "hands", "eye"]) for (const act of ["act1", "act2"]) {
  const defs = installCombat(createGame({ sources: ACTS[act](), seed: 1 })).defs;
  for (const id of Object.keys(defs).filter((i) => !i.includes(".sneak") && defs[i].foes.length)) {
    const G = createGame({ sources: ACTS[act](), seed: 2 }), C = installCombat(G), area = defs[id].area;
    try { C.usePlate(area, await loadPlateArena("../../../content", PLATE_OF[area] || area, { fightId: area })); } catch {}
    const W = C.start(id, { lamb: STYLES[style] }), P = createPilot(pol === "fair" ? {} : { style: "kite" });
    for (let i = 0; i < 7500 && !W.result; i++) C.step(P(W));
    sh.push(+((W.kited || 0) / W.tick).toFixed(2)); ap.push(+((W.apart || 0) / W.tick).toFixed(2));
  } }
  for (const [name, v] of [["opening the gap", sh], ["in nobody's reach", ap]]) { v.sort((a, b) => a - b); console.log(pol, name, "n", v.length, "min", v[0], "p10", v[Math.floor(v.length * 0.1)], "median", v[v.length >> 1], "p90", v[Math.floor(v.length * 0.9)], "max", v[v.length - 1]); }
}
