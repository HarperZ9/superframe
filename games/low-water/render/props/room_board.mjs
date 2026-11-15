// The registrar's upstairs room at harvest (era 1, e1.s04): the census board meets in a warm room: a long table, a fire, a
// decanter, the windows open on the afternoon. Built in stages (LW_STAGE 1 to 4):
//   1 shell: limewashed walls on a wainscot, two windows in the back wall, the fireplace breast, the floor, a beam.
//   2 furniture: the long table and its chairs, the sideboard, the pigeonholes, the coat rack, the rug.
//   3 clutter: decanters and glasses, papers and ledgers, candle dishes, the clock, the map board.
//   4 close detail: cobwebs, a dropped paper, a stack of minute books, the cold stove.
// Original (2026-10-23). Uses render/props/civic.mjs and the shared library.
// Parameters: dressBoard(W, L, marks, { HX, HZ, H, stage = 4 }); half sizes 3.2 x 2.4, wall height 2.9; the table is at (0.2, 0.3).
import { ID } from "./kinds.mjs";
import { boardShell } from "./shell.mjs";
import { timber, boardWall, bucket, stool } from "./wood.mjs";
import { highDesk } from "./mill.mjs";
import { cobweb } from "./gear.mjs";
import { jug, cup, candle, plate } from "./food.mjs";
import { counter, pigeonholes, chair, longTable, stove, fireplace, decanter, glass, paperStack, noticeBoard, rug, casement, wallClock, coatRack } from "./civic.mjs";

export function dressBoard(W, L, marks, { HX, HZ, H, stage = 4 }) {
  const add = (p) => W.add(p), TX = 0.2, TZ = 0.3;
  W.ground((x, y, z, T) => boardShell(T, x, y, z, { hx: HX, hz: HZ, hBack: () => H, hLeft: () => H, floor: ID.oakx, mix: true, floors: [ID.greyx, ID.oakz], wallId: ID.limewash, bw: 1.2, sill: 0.45, seed: 25, cuts: [[-1.3, 1.7, -HZ - 0.12, 0.55, 0.6, 0.3], [1.3, 1.7, -HZ - 0.12, 0.55, 0.6, 0.3]] }));
  add({ name: "wainscot", bb: [-HX, 0, -HZ, HX, 1.0, HZ], f: (x, y, z, T) => { if (y > 1.1) return; T(boardWall(x, y, z + HZ - 0.02, { hu: HX, y1: 0.95, th: 0.025, bw: 0.15, seed: 7 }), ID.greyy); } });
  add(timber("ceiling_beam", [0, H - 0.12, -0.2], [HX, 0.12, 0.1], ID.beamoak)); add(timber("ceiling_beam", [0, H - 0.12, 1.4], [HX, 0.12, 0.1], ID.beamoak));
  add(casement(-1.3, 1.7, -HZ + 0.1, { w: 1.1, h: 1.2, face: "z", open: 1.1 })); add(casement(1.3, 1.7, -HZ + 0.1, { w: 1.1, h: 1.2, face: "z", open: 1.1 }));
  add(fireplace(-HX, 0.2, { H, lit: true })); L.push({ pos: [-HX + 0.7, 0.5, 0.2], type: 1, I: 5, reach: 6, key: "fire", group: "fire" });
  if (stage < 2) return;
  add(longTable(TX, TZ, 1.7, 0.6)); for (const s of [-1, 1]) for (let k = 0; k < 4; k++) add(chair(TX - 1.2 + k * 0.8, TZ + s * 0.95, { a: s > 0 ? 3.14 : 0 }));
  add(chair(TX - 2.1, TZ, { a: 1.57, name: "ladderback_chair" })); add(chair(TX + 2.1, TZ, { a: -1.57 }));
  add(counter(2.35, -1.95, { len: 1.5, depth: 0.5, h: 0.9, name: "sideboard" })); add(pigeonholes(-2.7, 0.45, -HZ + 0.02, { w: 1.1, h: 2.0, cols: 4, rows: 6, seed: 12 }));
  add(coatRack(-2.7, -1.5)); add(rug(TX, TZ, 2.2, 1.2, { a: 0 }));
  marks.spots.push({ id: "table", verb: "read", at: [TX, 0, TZ + 1.6], note: "the long table: the board's chairs and the rule laid out before them" });
  if (stage < 3) return;
  add(decanter(TX - 0.3, 0.76, TZ)); add(decanter(TX + 0.9, 0.76, TZ + 0.1)); add(decanter(2.1, 0.9, -1.95, {}));
  for (let k = 0; k < 6; k++) add(glass(TX - 1.2 + k * 0.5, 0.76, TZ + (k % 2 ? 0.28 : -0.28)));
  for (let k = 0; k < 4; k++) { add(paperStack(TX - 1.3 + k * 0.85, 0.76, TZ + 0.38, { n: 5, a: 0.1 * k })); add(paperStack(TX - 0.9 + k * 0.85, 0.76, TZ - 0.38, { n: 4, a: -0.1 * k, name: "paper_stack" })); }
  add(candle(TX - 0.7, 0.76, TZ - 0.1, { lit: false })); add(candle(TX + 0.5, 0.76, TZ + 0.12, { lit: false, name: "candle_dish" })); add(plate(TX + 1.4, 0.76, TZ - 0.2, { r: 0.12 })); add(jug(TX + 1.3, 0.76, TZ + 0.2, { s: 0.85 })); add(cup(TX + 1.0, 0.76, TZ - 0.3, {}));
  add(wallClock(-2.7, 2.35, -HZ + 0.05)); add(noticeBoard(-HX + 0.03, 1.7, -1.5, { w: 1.1, h: 0.9, face: "x", seed: 6, name: "district_map_board" }));
  [-0.6, 1.0].forEach((px, i) => L.push({ pos: [px, 2.3, TZ], type: 1, I: 9, reach: 7, cone: [0, -1, 0], mode: 1, key: `pool${i}`, group: "pool" }));   // a pool over the long table
  if (stage < 4) return;
  add(cobweb([-HX + 0.03, H - 0.05, -HZ + 0.03], [1, 0, 0], [0, 0, 1], { size: 0.6, seed: 33 })); add(paperStack(1.9, 0.01, 1.7, { n: 1, a: 1.1, name: "dropped_paper" })); add(paperStack(2.5, 0.9, -1.95, { n: 14, a: 0.3, name: "minute_books" }));
  add(stove(2.9, 1.7)); add(highDesk(-2.0, 1.8, {})); add(bucket(-2.6, 0, 1.2, { name: "coal_bucket" })); add(stool(-1.3, 1.6));
}
