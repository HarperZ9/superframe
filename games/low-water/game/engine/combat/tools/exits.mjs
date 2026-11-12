// Talk exits in a fight, per style: how often the exit is offered, whether Lamb could pay for it while
// it stood offered, whether the pilot chose it (tools/pilot.mjs TALK_RATE) and whether it was taken.
//   node tools/exits.mjs [encounter=e.strippers] [seeds=6]
import { createGame } from "../../game.mjs";
import { installCombat } from "../encounter.mjs";
import { createPilot } from "./pilot.mjs";
import { ACTS, STYLES } from "./kite.mjs";
import { loadPlateArena, PLATE_OF } from "../data/plates.mjs";
import { COMPOSURE, HAT_TALK } from "../data/build.mjs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const CONTENT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "content");
const id = process.argv.slice(2).find((a) => a.includes(".") && !a.endsWith(".mjs")) || "e.strippers", seeds = +(process.argv.find((a) => /^\d+$/.test(a)) || 6);
const act = Object.keys(ACTS).find((k) => { try { return !!installCombat(createGame({ sources: ACTS[k](), seed: 1 })).defs[id]; } catch { return false; } });
for (const style of Object.keys(STYLES)) {
  const t = { n: 0, offered: 0, couldPay: 0, chose: 0, taken: 0, won: 0, down: 0, composureAt10: [], offerAt: [] };
  for (let s = 1; s <= seeds; s++) {
    const G = createGame({ sources: ACTS[act](), seed: s }), C = installCombat(G), area = C.defs[id].area;
    C.usePlate(area, await loadPlateArena(CONTENT, PLATE_OF[area] || area, { fightId: area }));
    const W = C.start(id, { lamb: STYLES[style] }), P = createPilot({ talk: "auto" }), L = W.lamb();
    const cost = ((STYLES[style].levels.hat ?? 0) >= HAT_TALK) ? COMPOSURE.talkHat : COMPOSURE.talk;
    let offered = false, could = false, chose = false;
    for (let i = 0; i < 7500 && !W.result; i++) {
      const inp = P(W); if ((inp.press || []).includes("talk")) chose = true;
      C.step(inp);
      if (W.talk) { if (!offered) t.offerAt.push(+(W.tick / 60).toFixed(1)); offered = true; if (L.composure >= cost) could = true; }
      if (W.tick === 600) t.composureAt10.push(+L.composure.toFixed(1));
    }
    const o = W.result.outcome; t.n++;
    if (offered) t.offered++; if (could) t.couldPay++; if (chose) t.chose++; if (o === "talk") t.taken++; if (o === "win" || o === "yield") t.won++; if (o === "down" || o === "lose") t.down++;
  }
  console.log(style.padEnd(7), JSON.stringify(t));
}
