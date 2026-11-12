// Fights under Mother's beam: the quay and floor plates carry her lens (marks.lamps kind "beam"), and
// quay2.wardens is the Act 2 fight on the quay. Runs each fight with Mother dark and burning, in
// clear air and in fog, fair and kiting, per style; prints wins, seconds, Standing lost, and how
// often an opponent saw Lamb from farther than it could have without the beam.
//   node tools/beam.mjs [seeds=6]
import { createGame } from "../../game.mjs";
import { installCombat } from "../encounter.mjs";
import { createPilot } from "./pilot.mjs";
import { ACTS, STYLES } from "./kite.mjs";
import { BEST } from "./ablate.mjs";
import { loadPlateArena } from "../data/plates.mjs";
import { beamAt } from "../sim/field.mjs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const CONTENT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "content"), seeds = +(process.argv[2] || 6);
const FIGHTS = [["act2", "quay2.wardens"], ["act1", "e.wardens"], ["act1", "e.lamplighters"], ["act1", "e.salvors"], ["act1", "e.eels"]];
const plates = {};
const plateFor = async (area) => (plates[area] ||= await loadPlateArena(CONTENT, area === "floor" ? "floor" : "quay", { fightId: area }));

for (const fog of [0, 0.35]) for (const mother of ["dark", "burning"]) for (const pol of ["fair", "kite"]) {
  const t = { n: 0, won: 0, sec: 0, lost: 0, lit: 0, frames: 0 };
  for (const style of Object.keys(STYLES)) for (const [act, id] of FIGHTS) for (let s = 1; s <= seeds; s++) {
    const G = createGame({ sources: ACTS[act](), seed: s });
    if (mother === "burning") G.env.command(["restrike", "mother"]);
    if (fog) G.env.command(["setTerm", "fog", String(fog)]);
    const C = installCombat(G), area = C.defs[id].area;
    C.usePlate(area, await plateFor(area));
    const W = C.start(id, { lamb: STYLES[style] }), P = createPilot(pol === "fair" ? {} : { style: "kite", kite: BEST[style] });
    for (let i = 0; i < 7500 && !W.result; i++) { C.step(P(W)); const L = W.lamb(); t.frames++; if (beamAt(W.field, L.x, L.z) > 0) t.lit++; }
    const L = W.lamb(), o = W.result.outcome;
    t.n++; t.sec += W.tick / 60; t.lost += (L.hpMax - L.hp) / L.hpMax; if (o === "win" || o === "yield") t.won++;
  }
  console.log(`fog ${fog} mother ${mother.padEnd(7)} ${pol}`, JSON.stringify({ fights: t.n, won: t.won, meanSeconds: +(t.sec / t.n).toFixed(1), standingLost: +(t.lost / t.n).toFixed(2), lambInBeam: +(t.lit / t.frames).toFixed(3) }));
}
