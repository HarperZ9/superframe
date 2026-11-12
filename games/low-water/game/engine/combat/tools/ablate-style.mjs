// Per-style rows for one ablation configuration (see tools/ablate.mjs): the strongest kiter per style.
//   COMBAT_WORLD_OFF=pursuit node tools/ablate-style.mjs [seeds=2]
import { runPolicy, STYLES } from "./kite.mjs";
import { BEST } from "./ablate.mjs";
import { OFF } from "../data/world.mjs";
const seeds = +(process.argv[2] || 2);
for (const style of Object.keys(STYLES)) { const { per, ...r } = await runPolicy(style, BEST[style], { seeds }); console.log(`off=[${[...OFF]}]`, style, JSON.stringify(r)); }
