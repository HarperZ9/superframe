// The Ropewalk fights on the director's authored terrain (content/ropewalk/place.json, 96864fd) against
// the same plate with its terrain stripped: five styles, fair and the strongest kiter, 4 seeds.
//   node tools/ropewalk-authored.mjs
import { createGame } from "../../game.mjs";
import { installCombat } from "../encounter.mjs";
import { createPilot } from "./pilot.mjs";
import { ACTS, STYLES } from "./kite.mjs";
import { BEST } from "./ablate.mjs";
import { loadPlateArena } from "../data/plates.mjs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const CONTENT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "content");
const authored = await loadPlateArena(CONTENT, "ropewalk", { fightId: "ropewalk" }), bare = { ...authored, terrain: null };
console.log("authored hazards:", JSON.stringify((authored.terrain || {}).hazards || []));
for (const [name, A] of [["bare", bare], ["authored", authored]]) for (const pol of ["fair", "kite"]) {
  const t = { n: 0, won: 0, sec: 0, lost: 0, tripL: 0, tripF: 0 };
  for (const style of Object.keys(STYLES)) for (const id of ["ropewalk.e.door", "ropewalk.e.door4"]) for (let s = 1; s <= 4; s++) {
    const G = createGame({ sources: ACTS.act2(), seed: s }), C = installCombat(G); C.usePlate("ropewalk", A);
    const W = C.start(id, { lamb: STYLES[style] }), P = createPilot(pol === "fair" ? {} : { style: "kite", kite: BEST[style] });
    for (let i = 0; i < 7500 && !W.result; i++) for (const e of C.step(P(W))) if (e.type === "trip") e.id === "lamb" ? t.tripL++ : t.tripF++;
    const L = W.lamb(), o = W.result.outcome; t.n++; t.sec += W.tick / 60; t.lost += (L.hpMax - L.hp) / L.hpMax; if (o === "win" || o === "yield") t.won++;
  }
  console.log(name.padEnd(8), pol, JSON.stringify({ fights: t.n, won: t.won, meanSeconds: +(t.sec / t.n).toFixed(1), standingLost: +(t.lost / t.n).toFixed(2), lambTrips: t.tripL, foeTrips: t.tripF }));
}
