// One row of the ablation table (design/COMBAT-WORLD.md): fair play against the strongest kiter found
// per style (tools/kite.mjs --search, after the world rules), summed over the five styles, with the
// rules named in COMBAT_WORLD_OFF switched off. Run once per configuration:
//   COMBAT_WORLD_OFF=pursuit node tools/ablate.mjs [seeds=2]
import { runPolicy, STYLES } from "./kite.mjs";
import { OFF } from "../data/world.mjs";

export const BEST = { fist: { ring: 4.5, after: 25, approach: true }, tongue: { ring: 4.5, after: 25, approach: true }, shadow: { ring: 4.5, after: 25, approach: true }, hands: { ring: 2.6, after: 25, approach: true }, eye: { ring: 3.4, after: 25, approach: true } };
if (process.argv[1] && process.argv[1].endsWith("ablate.mjs")) await main();
async function main() {
const seeds = +(process.argv[2] || 2), sum = { fair: { won: 0, down: 0, sec: 0, lost: 0, n: 0 }, kite: { won: 0, down: 0, sec: 0, lost: 0, n: 0, timeWon: 0 } };
for (const style of Object.keys(STYLES)) for (const pol of ["fair", "kite"]) {
  const r = await runPolicy(style, pol === "fair" ? "fair" : BEST[style], { seeds }), s = sum[pol];
  s.won += r.won; s.down += r.down; s.sec += r.meanSeconds * r.fights; s.lost += r.standingLost * r.fights; s.n += r.fights; if (pol === "kite") s.timeWon += r.wonAtTime;
}
const f = (s) => ({ won: `${s.won}/${s.n}`, down: s.down, meanSeconds: +(s.sec / s.n).toFixed(1), standingLost: +(s.lost / s.n).toFixed(2), ...(s.timeWon != null ? { wonAtTime: s.timeWon } : {}) });
console.log(`off=[${[...OFF].join(",")}]`, "fair", JSON.stringify(f(sum.fair)), "kite", JSON.stringify(f(sum.kite)));
}
