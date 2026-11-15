// Orme's back store at the mill, built in stages (the staged room-rebuild method, 23 October video catalogue #9):
//   1 shell: board walls on a stone plinth, the floor, ceiling beams, the window cut, the door.
//   2 furniture: the scale, the high desk, the cart, the pallets, the jar shelf.
//   3 clutter: the year's sacks to the beams, the weights, the ledger and lamp, the strap, the boots, sweepings.
//   4 close geometry: spilled grain, the broom and scoop, the window frame, cobwebs, a slit sack.
//   5 materials: sackcloth weave, grain and flour kinds on the sacks and the spill.
// LW_STAGE picks how far a bake goes (default 5), so each stage can be baked and judged alone. Original (2026-10-23).
// Parameters: dressBackstore(W, L, marks, { HX, HZ, H, stage = 5 }); W is a makeWorld, L the room lamp list, marks the spots/hides/exits record;
// HX, HZ half room sizes (2.8, 2.2), H wall height (2.7); stage 1 to 5.
import { ID } from "./kinds.mjs";
import { box } from "./prim.mjs";
import { boardShell } from "./shell.mjs";
import { timber, bucket, stool, barrel } from "./wood.mjs";
import { drift, wisps } from "./straw.mjs";
import { sack, hookLantern, ropeCoil, cobweb } from "./gear.mjs";
import { beamScale, weights, highDesk, handCart, spilledGrain, boots, strapOnNail, windowFrame, broom, scoop, pallet, jarShelf } from "./mill.mjs";

export function dressBackstore(W, L, marks, { HX, HZ, H, stage = 5 }) {
  const add = (p) => W.add(p), cloth = stage >= 5 ? ID.sackcloth : ID.sack;
  // stage 1: the shell
  W.ground((x, y, z, T) => boardShell(T, x, y, z, { hx: HX, hz: HZ, hBack: () => H, hLeft: () => H, floor: ID.chaff, mix: true, sill: 0.4, seed: 11, cuts: [[-HX - 0.12, 1.3, -1.1, 0.3, 0.38, 0.4]] }));
  for (const [cx, cz, hx, hz] of [[0, -HZ + 0.15, HX, 0.14], [-HX + 0.15, 0, 0.14, HZ]]) add({ name: "stone_plinth", bb: [cx - hx - 0.05, 0, cz - hz - 0.05, cx + hx + 0.05, 0.5, cz + hz + 0.05], f: (x, y, z, T) => T(Math.max(box(x, y, z, cx, 0.25, cz, hx, 0.25, hz) - 0.01, -(box(x, y, z, -HX - 0.12, 1.3, -1.1, 0.3, 0.38, 0.4))) - (Math.sin(x * 7 + z * 7) * 0.006), ID.wall) });
  for (const px of [-HX + 0.12, -0.9, 1.0, HX - 0.12]) add(timber("store_post", [px, H / 2, -HZ + 0.12], [0.1, H / 2, 0.1]));
  for (const bx of [-0.8, 0.8]) add(timber("ceiling_beam", [bx, H - 0.1, -0.6], [0.09, 0.1, 1.6]));
  add(timber("door_lintel", [HX - 0.1, 2.0, 1.4], [0.08, 0.07, 0.55])); add(timber("door_post", [HX - 0.1, 1.0, 0.85], [0.08, 1.0, 0.07]));
  marks.exits.push({ id: "mill", at: [HX - 0.5, 0, 1.4], note: "the door through to the mill" });
  if (stage < 2) return;
  // stage 2: furniture
  add(beamScale(0.9, -0.4)); add(highDesk(2.0, -1.55)); add(handCart(-0.6, 1.2)); add(pallet(-1.9, -1.5, 1.3, 0.45)); add(pallet(-2.35, 0.2, 0.45, 1.2));
  add(jarShelf(0.0, 1.5, -HZ + 0.06)); add(stool(1.4, -0.9)); add(barrel(-2.3, 0, 1.6, { r: 0.27, h: 0.8, name: "sweepings_barrel" })); add(bucket(2.3, 0, 0.2));
  marks.spots.push({ id: "scale", verb: "read", at: [0.8, 0, 0.3], note: "the beam scale: the brass pan worn bright where the sacks go on" });
  marks.spots.push({ id: "ledger", verb: "read", at: [2.1, 0, -0.6], note: "the ledger: the year's weights in Orme's hand, columns that come out even" });
  if (stage < 3) return;
  // stage 3: clutter
  for (let i = 0; i < 9; i++) for (let j = 0; j < 4; j++) add(sack(-2.3 + i * 0.5 + (j % 2) * 0.1, 0.1 + j * 0.4, -HZ + 0.4, { s: 0.28, a: ((i * 7 + j) % 5 - 2) * 0.07, seed: i * 7 + j, id: cloth }));
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) add(sack(-HX + 0.4 + (j % 2) * 0.1, 0.1 + j * 0.4, 0.2 + i * 0.55, { s: 0.28, a: 1.57 + (i + j) * 0.05, seed: i + j * 3 + 90, id: cloth }));
  for (const [x, z] of [[-0.6, 1.2], [-0.35, 1.3]]) add(sack(x, 0.55, z, { s: 0.26, a: 0.3, seed: 70, id: cloth, name: "carted_sack" })); add(sack(0.45, 0.78, -0.4, { s: 0.2, a: 0.4, seed: 5, id: cloth, name: "sack_on_pan" }));
  add(weights(1.5, -0.3)); add(strapOnNail(1.7, 1.9, -HZ + 0.05)); add(boots(-1.5, 0.9)); add(drift("sweepings", -1.0, 0.2, 0.7, 0.4, 0.06)); add(wisps("chaff_wisps", 0, 0, 36, 2.0, 8)); add(ropeCoil(-1.9, 0.03, 1.6));
  add(hookLantern(2.55, 1.28, -1.6, { drop: 0.0 })); L.push({ pos: [2.55, 1.28, -1.6], type: 1, I: 2.6, reach: 5, key: "lamp0", group: "lantern" });
  if (stage < 4) return;
  // stage 4: close geometry
  add(spilledGrain(-1.7, -0.9, 0.45)); add(spilledGrain(-0.2, 1.7, 0.3, "grain_trickle")); add(broom([-2.55, 0, -1.9], [-2.45, 1.6, -2.05])); add(scoop(-1.4, -0.3));
  add(windowFrame(-HX + 0.08, 1.3, -1.1)); add(cobweb([-HX + 0.03, H - 0.05, -HZ + 0.03], [1, 0, 0], [0, 0, 1], { size: 0.6, seed: 12 })); add(cobweb([HX - 0.05, H - 0.1, -HZ + 0.03], [-1, 0, 0], [0, 0, 1], { size: 0.45, seed: 13 }));
  add(timber("sack_hook_rail", [0, 2.35, -HZ + 0.1], [HX, 0.04, 0.04], ID.oakx));
}
