// One fight with a per-side breakdown, for tuning.  node tools/diag.mjs [seed] [frames]
import { makeWorld, makeG } from "../tests/helpers.mjs";
import { createPilot } from "./pilot.mjs";

const seed = +(process.argv[2] || 3), frames = +(process.argv[3] || 3600);
const W = makeWorld({ G: makeG({ clock: "23:30" }), seed, foes: [["holder", [8.5, 7.5]]] });
const pilot = createPilot(), ev = [];
for (let i = 0; i < frames && !W.result; i++) ev.push(...W.step({ lamb: pilot(W) }));
const by = (t, f) => ev.filter((e) => e.type === t && f(e));
const isL = (id) => id === "lamb";
const tally = (list, k) => Object.entries(list.reduce((o, e) => ((o[e[k]] = (o[e[k]] || 0) + 1), o), {}));
console.log({ result: W.result, tick: W.tick });
console.log("Lamb dealt", by("hit", (e) => isL(e.by)).reduce((s, e) => s + e.dmg, 0).toFixed(1), "in", by("hit", (e) => isL(e.by)).length, "hits");
console.log("Lamb took", by("hit", (e) => isL(e.id)).reduce((s, e) => s + e.dmg, 0).toFixed(1), "from", tally(by("hit", (e) => isL(e.id)), "move"));
console.log("Lamb evaded", by("evade", (e) => isL(e.id)).length, "foes evaded", by("evade", (e) => !isL(e.id)).length,
  "parries", by("parry", (e) => isL(e.id)).length, "blocks", by("block", (e) => isL(e.id)).length);
console.log("Lamb moves", tally(by("move", (e) => isL(e.id)), "move"));
console.log("breathless", by("breathless", (e) => isL(e.id)).length, "foes", W.fighters.map((F) => [F.id, F.hp.toFixed(1), F.out]));
