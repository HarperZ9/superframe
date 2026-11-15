// The exchange hall at harvest (era 1, e1.s02): the weigh-house in its trading year, the louvres laying the afternoon in gold
// bars across the floor, the scale level, the price chalked on the board, the hands paid by the sack. Built in stages
// (LW_STAGE 1 to 4):
//   1 shell: grey board walls with open seams on the sun side, the plank floor, tie-beams, the loading doors cut in the back wall.
//   2 furniture: the weighbridge and its beam scale, the gallery over the back wall with its stair, the paying counter, the price board.
//   3 clutter: sacks on pallets and the scale, hand carts, crates and barrels, coin boxes, ledgers, lanterns (cold), hoist tackle.
//   4 close detail: chaff on the boards, cobwebs, a slit sack and its spill, rope, buckets, dropped papers.
// Original (2026-10-23). Uses render/props/civic.mjs, mill.mjs and the shared library.
// Parameters: dressExchange(W, L, marks, { HX, HZ, H, stage = 4 }); half sizes 4.2 x 3.0, wall height 3.8; the sun side is the -x wall.
import { ID } from "./kinds.mjs";
import { box } from "./prim.mjs";
import { boardShell } from "./shell.mjs";
import { timber, brace, ladder, barrel, bucket, stool, bench } from "./wood.mjs";
import { sack, hookLantern, hook, ropeCoil, cobweb, hoist } from "./gear.mjs";
import { wisps, drift } from "./straw.mjs";
import { beamScale, weights, handCart, pallet, spilledGrain, highDesk } from "./mill.mjs";
import { counter, paperStack, priceBoard, chair, wallClock } from "./civic.mjs";
import { jug, cup, plate } from "./food.mjs";

export function dressExchange(W, L, marks, { HX, HZ, H, stage = 4 }) {
  const add = (p) => W.add(p);
  W.ground((x, y, z, T) => boardShell(T, x, y, z, { hx: HX, hz: HZ, hBack: () => H, hLeft: () => H, floor: ID.chaff, mix: true, floors: [ID.greyx, ID.greyz], gap: 0.03, gapFrac: 0.7, sill: 0.5, seed: 41, cuts: [[1.0, 1.3, -HZ - 0.12, 1.0, 1.3, 0.3]] }));
  for (const px of [-HX + 0.12, -1.8, 0.4, 2.6]) add(timber("hall_post", [px, H / 2, -HZ + 0.12], [0.12, H / 2, 0.12]));
  for (const bx of [-2.6, 0, 2.6]) { add(timber("tie_beam", [bx, H - 0.2, -0.3], [0.1, 0.14, HZ - 0.3])); add(brace([bx, H - 1.0, -HZ + 0.15], [bx, H - 0.3, -1.4], 0.04, "knee_brace")); }
  add(timber("hall_girt", [0, 1.1, -HZ + 0.1], [HX, 0.06, 0.06])); add(timber("side_post", [-HX + 0.12, H / 2, 0.2], [0.12, H / 2, 0.12]));
  if (stage < 2) return;
  add(pallet(0.0, 0.5, 1.5, 1.0)); add(beamScale(0.0, 0.5, { name: "beam_scale" })); add(beamScale(-1.2, 1.5, { name: "beam_scale" }));
  add(timber("gallery_floor", [0.4, 2.3, -HZ + 0.8], [HX - 0.3, 0.06, 0.8], ID.greyx)); for (const px of [-HX + 0.7, -1.2, 1.2, HX - 0.5]) add(timber("gallery_post", [px, 1.15, -HZ + 1.55], [0.07, 1.15, 0.07], ID.beamoak));
  add(timber("gallery_rail", [0.4, 2.85, -HZ + 1.6], [HX - 0.3, 0.04, 0.03], ID.oakx)); for (let k = 0; k < 14; k++) add(timber("gallery_baluster", [-HX + 0.9 + k * 0.5, 2.55, -HZ + 1.6], [0.025, 0.25, 0.025], ID.oaky));
  add(ladder([HX - 0.8, 0, -HZ + 1.9], [HX - 0.8, 2.35, -HZ + 1.55], "gallery_stair", 0.5, 11)); add(highDesk(-1.0, -HZ + 0.9, {}).bb ? highDesk(-1.0, -HZ + 0.9, {}) : null);
  add(counter(-2.6, 1.2, { len: 1.8, depth: 0.5, h: 1.0, name: "paying_counter" })); add(priceBoard(3.1, 0, 1.3, { w: 1.7, h: 1.5, seed: 4 })); add(chair(-2.6, 0.5, { a: 3.1 }));
  marks.spots.push({ id: "scale", verb: "read", at: [0.0, 0, 1.9], note: "the scale, level: a sack on one pan, the weights on the other" });
  marks.spots.push({ id: "board", verb: "read", at: [3.1, 0, 2.2], note: "the price board: this week's price chalked, rubbed, chalked again" });
  marks.exits.push({ id: "gate", at: [HX - 0.6, 0, 1.2], note: "the gate to the yard where the hands are paid by the sack" });
  if (stage < 3) return;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3 - (i % 2); j++) add(sack(-3.4 + i * 0.5, 0.1 + j * 0.4, -1.7, { s: 0.28, a: ((i + j) % 3 - 1) * 0.08, seed: i * 3 + j, id: ID.sackcloth }));
  add(sack(-0.35, 0.78, 0.5, { s: 0.2, a: 0.4, seed: 9, id: ID.sackcloth, name: "sack_on_pan" })); add(weights(0.55, 0.9)); add(handCart(2.0, 2.0, { a: -0.2 })); add(handCart(-3.0, 2.2, { a: 0.4, name: "hand_cart" }));
  add(barrel(3.3, 0, -1.8, { r: 0.3, h: 0.85, name: "grain_barrel" })); add(timber("coin_box", [-2.6, 1.14, 1.2], [0.2, 0.1, 0.14], ID.oakx, 0.01)); add(paperStack(-2.2, 1.01, 1.2, { n: 8, name: "tally_slips" })); add(paperStack(-2.9, 1.01, 1.15, { n: 5, a: 0.3, name: "tally_slips" }));
  for (const [x, z, y] of [[-2.6, -0.3, 2.4], [2.6, -0.3, 2.4]]) { add(hookLantern(x, y, z, { drop: 0.6 })); add(hook(x, H - 0.3, z)); L.push({ pos: [x, y, z], type: 1, I: 3, reach: 6, key: `lamp${L.length}`, group: "lantern" }); }
  add(hoist(1.5, H - 0.4, -0.3, { drop: 1.6 })); add(wallClock(-1.2, 3.1, -HZ + 0.06)); add(bench(-1.0, 2.5, 0.9, { id: ID.greyx, name: "waiting_bench" })); add(jug(-2.35, 1.02, 1.3, { s: 0.85 })); add(cup(-2.1, 1.02, 1.1, {}));
  [[-0.6, 2.7, 0.5], [0.6, 2.7, 0.5]].forEach(([px, py, pz], i) => L.push({ pos: [px, py, pz], type: 1, I: 7, reach: 7, cone: [0, -1, 0], mode: 1, key: `pool${i}`, group: "pool" })); L.push({ pos: [-2.6, 1.8, 1.2], type: 1, I: 3, reach: 6, cone: [0, -1, 0], mode: 1, key: "pool1", group: "pool" });   // pools over the scales and the paying counter
  if (stage < 4) return;
  add(wisps("chaff", 0, 0.5, 70, 3.6, 4)); add(cobweb([-HX + 0.03, H - 0.05, -HZ + 0.03], [1, 0, 0], [0, 0, 1], { size: 0.7, seed: 51 })); add(spilledGrain(1.6, -1.2, 0.5)); add(sack(1.3, 0, -1.3, { s: 0.28, a: 0.9, seed: 21, id: ID.sackcloth, open: true, name: "slit_sack" }));
  add(ropeCoil(-3.4, 0.01, 0.4)); add(bucket(2.9, 0, 0.1)); add(stool(-3.5, 1.2)); add(drift("sweepings", -3.4, 1.9, 0.5, 0.3, 0.05)); add(plate(-2.8, 1.02, 1.4, { r: 0.1 }));
}
void box;
