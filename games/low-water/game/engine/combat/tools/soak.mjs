// Soak: the pilot against opponents on the floor for many seeds; prints outcomes, Standing left
// and event counts. Lineups: holder, skirmisher, pair.
//   node tools/soak.mjs [lineup=pair] [seeds=20] [frames=3600] [build=plain|combat]
// combat: COAT 4, KNEES 6, BALLAST 6, GRIP 6 (a Lamb built to fight); plain: the middling defaults.
import { makeWorld, makeG } from "../tests/helpers.mjs";
import { createPilot } from "./pilot.mjs";

const LINEUPS = { holder: [["holder", [8.5, 7.5]]], skirmisher: [["skirmisher", [3, 8]]], pair: [["holder", [8.5, 7.5]], ["skirmisher", [3, 8]]],
  three: [["holder", [8.5, 7.5]], ["skirmisher", [3, 8]], ["skirmisher", [13, 8]]],
  four: [["skirmisher", [8.5, 7.5]], ["skirmisher", [3, 8]], ["skirmisher", [13, 8]], ["skirmisher", [8.5, 11]]] };
const lineup = process.argv[2] || "pair", seeds = +(process.argv[3] || 20), frames = +(process.argv[4] || 3600), build = process.argv[5] || "plain";
const LAMB = build === "combat" ? { coat: 4, knees: 6, ballast: 6, grip: 6 } : build === "fist" ? { coat: 4, knees: 8, ballast: 7, grip: 7 } : {};
const tally = {}, counts = {}, left = [], secs = [];
for (let s = 1; s <= seeds; s++) {
  const W = makeWorld({ G: makeG({ clock: "23:30" }), seed: s, foes: LINEUPS[lineup], lamb: LAMB });
  const pilot = createPilot();
  for (let i = 0; i < frames && !W.result; i++) for (const e of W.step({ lamb: pilot(W) })) counts[e.type] = (counts[e.type] || 0) + 1;
  const o = W.result ? W.result.outcome : "running", L = W.lamb();
  tally[o] = (tally[o] || 0) + 1; left.push(+L.hp.toFixed(1)); secs.push(+(W.tick / 60).toFixed(1));
  if (!isFinite(L.x + L.z + L.hp + L.st)) throw new Error(`seed ${s}: non-finite state`);
}
console.log(lineup, build, "outcomes", tally, "Lamb Standing left", left.join(" "), "seconds", secs.join(" "));
console.log("events per fight", Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, +(v / seeds).toFixed(1)])));
