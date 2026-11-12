// Counts the world's answers (punish events by kind) and what they cost Lamb, fair against the
// strongest kiter, per style, on the Act 1 and 2 plates. For design/COMBAT-WORLD.md.
//   node tools/punishes.mjs [seeds=2]
import { createGame } from "../../game.mjs";
import { installCombat } from "../encounter.mjs";
import { createPilot } from "./pilot.mjs";
import { ACTS, STYLES } from "./kite.mjs";
import { BEST } from "./ablate.mjs";
import { loadPlateArena, PLATE_OF } from "../data/plates.mjs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const CONTENT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "content"), seeds = +(process.argv[2] || 2);
for (const pol of ["fair", "kite"]) for (const style of Object.keys(STYLES)) {
  const c = { fights: 0, throw: 0, lunge: 0, chase: 0, landed: 0, dmg: 0, falls: 0, fallsFoe: 0, trips: 0, calls: 0 };
  for (const act of Object.keys(ACTS)) {
    const defs = installCombat(createGame({ sources: ACTS[act](), seed: 1 })).defs;
    for (const id of Object.keys(defs).filter((i) => !i.includes(".sneak") && defs[i].foes.length)) for (let s = 1; s <= seeds; s++) {
      const G = createGame({ sources: ACTS[act](), seed: s }), C = installCombat(G), area = defs[id].area;
      try { C.usePlate(area, await loadPlateArena(CONTENT, PLATE_OF[area] || area, { fightId: area })); } catch {}
      const W = C.start(id, { lamb: STYLES[style] }), P = createPilot(pol === "fair" ? {} : { style: "kite", kite: BEST[style] }), mine = new Set();
      for (let i = 0; i < 7500 && !W.result; i++) for (const e of C.step(P(W))) {
        if (e.type === "punish") { c[e.how]++; mine.add(e.id); }
        if (e.type === "hit" && e.id === "lamb" && (/world\.|thrown:stone/.test(e.move))) { c.landed++; c.dmg += e.dmg; }
        if (e.type === "ledgefall") e.id === "lamb" ? c.falls++ : c.fallsFoe++;
        if (e.type === "trip") c.trips++; if (e.type === "call") c.calls++;
      }
      c.fights++;
    }
  }
  console.log(pol, style.padEnd(6), JSON.stringify({ ...c, dmg: +c.dmg.toFixed(1) }));
}
