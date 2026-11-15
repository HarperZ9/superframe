// The registrar's front counter at harvest (era 1, e1.s08): Edwin Mott's census. Built in stages (LW_STAGE 1 to 4):
//   1 shell: limewashed walls on a board wainscot, the street door propped open, one window, the floor, the ceiling beam.
//   2 furniture: the counter, the pigeonhole wall, the clerk's desk and stool, the waiting bench, the stove, the coat rack.
//   3 clutter: ledgers and census slips, the clock, the notice board with the rule, the queue rail, the rug, jug and cups.
//   4 close detail: cobwebs, a crate of blank forms, a sample sack, the bucket, the lamp (cold), floor paper.
// Original (2026-10-23). Uses render/props/civic.mjs and the shared library.
// Parameters: dressCensus(W, L, marks, { HX, HZ, H, stage = 4 }); half sizes 3.0 x 2.2, wall height 2.8; the counter runs along x at z = 0.
import { ID } from "./kinds.mjs";
import { boardShell } from "./shell.mjs";
import { timber, bench, stool, bucket, doorLeaf, boardWall } from "./wood.mjs";
import { sack, hookLantern, cobweb, ropeCoil } from "./gear.mjs";
import { jug, cup } from "./food.mjs";
import { highDesk } from "./mill.mjs";
import { counter, pigeonholes, chair, stove, paperStack, noticeBoard, rug, casement, wallClock, coatRack, queueRail } from "./civic.mjs";

export function dressCensus(W, L, marks, { HX, HZ, H, stage = 4 }) {
  const add = (p) => W.add(p);
  W.ground((x, y, z, T) => boardShell(T, x, y, z, { hx: HX, hz: HZ, hBack: () => H, hLeft: () => H, floor: ID.greyz, mix: true, floors: [ID.greyx, ID.oakz], wallId: ID.limewash, bw: 1.15, sill: 0.45, seed: 21, cuts: [[-HX - 0.12, 1.05, 0.95, 0.3, 1.05, 0.55], [-HX - 0.12, 1.65, -1.25, 0.3, 0.6, 0.55]] }));
  add({ name: "wainscot", bb: [-HX, 0, -HZ, HX, 1.0, HZ], f: (x, y, z, T) => { if (y > 1.1) return; T(boardWall(x, y, z + HZ - 0.02, { hu: HX, y1: 0.95, th: 0.025, bw: 0.14, seed: 3 }), ID.greyy); T(boardWall(z, y, x + HX - 0.02, { hu: HZ, y1: 0.95, th: 0.025, bw: 0.14, seed: 4 }), ID.greyy); } });
  add(timber("ceiling_beam", [0, H - 0.12, -0.2], [HX, 0.12, 0.1], ID.beamoak)); add(timber("door_lintel_post", [-HX + 0.1, 1.0, 0.3], [0.07, 1.0, 0.07], ID.beamoak));
  add(doorLeaf([-HX + 0.1, 0, 0.4], 1.0, 2.05, 0.75, { name: "street_door_leaf", seed: 9 })); add(casement(-HX + 0.1, 1.65, -1.25, { w: 1.1, h: 1.2, face: "x", open: 1.0 }));
  marks.exits.push({ id: "street", at: [-HX + 0.6, 0, 0.95], note: "the street door, propped open on the morning" });
  if (stage < 2) return;
  add(counter(0.3, 0.0, { len: 3.6 })); add(pigeonholes(0.4, 0.55, -HZ + 0.02, { w: 2.8, h: 1.7, cols: 9, rows: 6, seed: 5 })); add(highDesk(2.0, -1.2, {})); add(stool(1.3, -1.1)); add(chair(-0.9, -0.9, { a: 2.6 }));
  add(bench(1.6, 1.85, 0.9, { id: ID.greyx, name: "waiting_bench" })); add(stove(-2.4, -1.7)); add(coatRack(2.6, 0.9));
  marks.spots.push({ id: "counter", verb: "read", at: [0.3, 0, 0.9], note: "the counter: where a man gives his name and has another written" });
  if (stage < 3) return;
  for (const [x, z, a] of [[-1.0, 0.0, 0.1], [-0.2, -0.05, -0.2], [1.2, 0.05, 0.3], [2.0, -0.02, 0]]) add(paperStack(x, 1.03, z, { n: 7, a, name: "census_slips" }));
  add(wallClock(-0.5, 2.3, -HZ + 0.05)); add(noticeBoard(-1.9, 1.7, -HZ + 0.03, { w: 1.2, h: 0.85, seed: 3 })); add(rug(-1.0, 1.4, 1.1, 0.6, { a: 0.1 }));
  add(queueRail([[-2.1, 1.6], [-0.8, 1.6], [-0.8, 0.65]])); add(jug(2.9, 1.03, 0.0, { s: 0.9 })); add(cup(2.55, 1.03, 0.05)); add(cup(2.7, 1.03, -0.08, { name: "pewter_cup" }));
  [-1.2, -0.1, 1.0, 2.1].forEach((px, i) => L.push({ pos: [px, 1.6, 0.05], type: 1, I: 3.2, reach: 6, cone: [0, -1, 0], mode: 1, key: `pool${i}`, group: "pool" }));   // a pool over the counter
  if (stage < 4) return;
  add(cobweb([-HX + 0.03, H - 0.05, -HZ + 0.03], [1, 0, 0], [0, 0, 1], { size: 0.6, seed: 31 })); add(timber("forms_crate", [2.7, 0.2, -1.8], [0.3, 0.2, 0.22], ID.oakx, 0.02)); add(paperStack(2.7, 0.41, -1.8, { n: 10, name: "blank_forms" }));
  add(sack(-2.6, 0, -0.6, { s: 0.26, a: 0.4, seed: 4, id: ID.sackcloth, name: "sample_sack" })); add(bucket(-2.7, 0, 1.9)); add(ropeCoil(2.4, 0.01, 1.5, { r: 0.12, n: 3 }));
  add(hookLantern(-1.3, 1.14, 0.05, { drop: 0.0, name: "cold_counter_lamp" })); L.push({ pos: [-1.3, 1.14, 0.05], type: 1, I: 3, reach: 5, key: "lamp0", group: "lantern" });
  add(paperStack(-1.9, 0.01, 1.0, { n: 1, a: 0.7, name: "dropped_slip" }));
}
