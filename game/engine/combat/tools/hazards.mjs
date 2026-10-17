// Proposed nets, ropes and loose ground for three plates (design/HAZARDS-PROPOSAL.md, for the director to
// author into place.json "terrain"), and their measurement: each plate's fights with and without them,
// fair and kiting, per style.   node tools/hazards.mjs [seeds=4] [--check]
import { createGame } from "../../game.mjs";
import { installCombat } from "../encounter.mjs";
import { createPilot } from "./pilot.mjs";
import { ACTS, STYLES } from "./kite.mjs";
import { BEST } from "./ablate.mjs";
import { loadPlateArena } from "../data/plates.mjs";
import { terrainAt } from "../sim/terrain.mjs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const CONTENT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "content");
export const PROPOSED = {
  quay: [
    { id: "quay_nets", kind: "net", at: [19.6, 0, -6.0], r: 1.2, note: "drift nets hung to dry over the crates by the mole root, a heap of them on the stones" },
    { id: "quay_warp", kind: "rope", rect: [22.0, -2.2, 25.5, -1.7], note: "the ferry's mooring warp laid along the quay edge to the bollard at the mole steps" },
  ],
  spit: [
    { id: "spit_painter", kind: "rope", rect: [12.6, 4.2, 16.2, 4.8], note: "the strippers' painter between the barges, slack on the shingle until the flood takes it up" },
    { id: "spit_coal", kind: "loose", at: [18.6, 0, 5.6], r: 1.3, note: "coal spilled from the Ann Tull's open hatches" },
    { id: "spit_patience", kind: "slick", at: [10.0, 0, 3.4], r: 1.4, note: "frost on the Patience's tilted deck boards" },
  ],
  ropewalk: [
    { id: "ropewalk_strand", kind: "rope", rect: [6.5, 2.7, 18.5, 3.1], note: "a strand laid out down the walk between the old rope posts, waiting to be twisted" },
    { id: "ropewalk_coil", kind: "net", at: [10.4, 0, 1.2], r: 0.8, note: "a coil of telegraph wire under the post where the Vane hangs" },
  ],
};
const FIGHTS = { quay: [["act1", "e.wardens"], ["act1", "e.lamplighters"], ["act2", "quay2.wardens"]], spit: [["act2", "e.strippers"]], ropewalk: [["act2", "ropewalk.e.door"], ["act2", "ropewalk.e.door4"]] };

async function arena(plate, withHazards) {
  const A = await loadPlateArena(CONTENT, plate, { fightId: plate });
  return withHazards ? { ...A, terrain: { ...(A.terrain || {}), hazards: PROPOSED[plate] } } : A;
}

if (process.argv.includes("--check")) {
  for (const plate of Object.keys(PROPOSED)) {
    const A = await arena(plate, true);
    for (const h of PROPOSED[plate]) {
      const pts = h.rect ? [[h.rect[0], h.rect[1]], [h.rect[2], h.rect[3]], [(h.rect[0] + h.rect[2]) / 2, (h.rect[1] + h.rect[3]) / 2]] : [[h.at[0], h.at[2]]];
      console.log(plate, h.id, pts.map(([x, z]) => `${x},${z}: ${A.grid ? (terrainAt(A, x, z).hazard || "-") : "?"} walk=${!!A.grid.cells[Math.floor((z - A.origin[1]) / A.cell) * A.grid.w + Math.floor((x - A.origin[0]) / A.cell)]}`).join(" | "));
    }
  }
} else if (process.argv[1] && process.argv[1].endsWith("hazards.mjs")) {
  const seeds = +(process.argv.find((a) => /^\d+$/.test(a)) || 4);
  for (const plate of Object.keys(PROPOSED)) for (const haz of [false, true]) for (const pol of ["fair", "kite"]) {
    const t = { n: 0, won: 0, sec: 0, lost: 0, tripsL: 0, tripsF: 0 };
    const A = await arena(plate, haz);
    for (const style of Object.keys(STYLES)) for (const [act, id] of FIGHTS[plate]) for (let s = 1; s <= seeds; s++) {
      const G = createGame({ sources: ACTS[act](), seed: s }), C = installCombat(G);
      C.usePlate(C.defs[id].area, A);
      const W = C.start(id, { lamb: STYLES[style] }), P = createPilot(pol === "fair" ? {} : { style: "kite", kite: BEST[style] });
      for (let i = 0; i < 7500 && !W.result; i++) for (const e of C.step(P(W))) if (e.type === "trip") e.id === "lamb" ? t.tripsL++ : t.tripsF++;
      const L = W.lamb(), o = W.result.outcome;
      t.n++; t.sec += W.tick / 60; t.lost += (L.hpMax - L.hp) / L.hpMax; if (o === "win" || o === "yield") t.won++;
    }
    console.log(plate.padEnd(8), haz ? "hazards" : "bare   ", pol, JSON.stringify({ fights: t.n, won: t.won, meanSeconds: +(t.sec / t.n).toFixed(1), standingLost: +(t.lost / t.n).toFixed(2), lambTrips: t.tripsL, foeTrips: t.tripsF }));
  }
}
