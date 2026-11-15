// Orme's barn laid for the harvest supper, dressed from the authored prop library (render/props/). The room: board
// walls on a post-and-tie-beam frame, the yard door standing open on the last blue, two clothed trestle tables end to end
// with benches, the tied last sheaf at the head, hooked lanterns on the tie-beams, a wall of bound bales, the threshing
// floor with flail and winnowing basket, tools hung on the back wall, cobwebs in the roof corners. Original (2026-10-23).
// Parameters: dressBarn(W, L, marks, { HX, HZ, H, TZ }); half sizes 4.4 x 2.8, wall height 3.6, TZ the table line (z = -0.3). No stage switch.
import { ID } from "./kinds.mjs";
import { box } from "./prim.mjs";
import { boardShell } from "./shell.mjs";
import { timber, brace, trestleTable, bench, barrel, bucket, stool, doorLeaf } from "./wood.mjs";
import { bale, brokenBale, sheaf, cornDolly, wisps, fork, rake, drift } from "./straw.mjs";
import { loaf, plait, cutLoaf, jug, cup, plate, trencher, cheese, pear, pearSlices, knife, appleBowl, candle, cloth, runner } from "./food.mjs";
import { hookLantern, hook, sack, ropeCoil, harness, flail, winnowBasket, scythe, cobweb, blanket } from "./gear.mjs";

export function dressBarn(W, L, marks, { HX, HZ, H, TZ }) {
  const add = (p) => W.add(p), lamp = (x, y, z, I) => L.push({ pos: [x, y, z], type: 1, I, reach: 7, key: `lamp${L.length}`, group: "lantern" });
  W.ground((x, y, z, T) => boardShell(T, x, y, z, { hx: HX, hz: HZ, hBack: () => H, hLeft: () => H, floor: ID.chaff, mix: true, sill: 0.45, seed: 3, cuts: [[-HX - 0.12, 1.3, 0.6, 0.3, 1.3, 1.0]] }));
  // the frame: posts, tie-beams over the far half, braces, girts for hanging, rafters and a purlin
  for (const px of [-HX + 0.12, -2.8, 0, 2.8]) add(timber("barn_post", [px, H / 2, -HZ + 0.12], [0.1, H / 2, 0.1]));
  for (const pz of [-1.0, 0.8]) add(timber("barn_wall_post", [-HX + 0.12, H / 2, pz], [0.1, H / 2, 0.1]));
  for (const bx of [-2.8, 0, 2.8]) { add(timber("tie_beam", [bx, 3.05, -0.6], [0.07, 0.1, 2.2])); add(brace([bx, 2.2, -HZ + 0.15], [bx, 3.0, -1.7], 0.032, "knee_brace")); }
  add(timber("wall_girt", [0, 1.05, -HZ + 0.1], [HX, 0.05, 0.05])); add(timber("wall_girt_high", [0, 2.15, -HZ + 0.1], [HX, 0.05, 0.05])); add(timber("side_girt", [-HX + 0.1, 1.9, 0], [0.05, 0.05, HZ]));
  for (let i = -3; i <= 3; i++) add(brace([i * 1.2, H - 0.05, -HZ + 0.05], [i * 1.2, H + 1.1, -0.1], 0.038, "rafter"));
  add(timber("purlin", [0, H + 0.65, -1.45], [HX, 0.07, 0.07]));
  add(cobweb([-HX + 0.02, H - 0.05, -HZ + 0.02], [1, 0, 0], [0, 0, 1], { size: 0.65, seed: 2 })); add(cobweb([2.7, 3.0, -HZ + 0.02], [-1, 0, 0], [0, 0, 1], { size: 0.5, seed: 5 })); add(cobweb([-2.8, 2.98, -1.0], [1, 0, 0], [0, 0, -1], { size: 0.4, seed: 8, name: "beam_cobweb" }));
  // the yard door, one leaf swung in
  add(doorLeaf([-HX + 0.08, 0, -0.4], 1.0, 2.5, 0.35, { name: "yard_door_leaf", seed: 4 }));
  // tables, cloths, benches
  const tops = [[-1.25, 1.33], [1.7, 1.33]], TOP = 0.76;
  tops.forEach(([cx, hx], i) => {
    add(trestleTable(cx, TZ, hx, 0.45, { seed: i + 1 })); add(cloth(cx, TOP + 0.012, TZ, hx - 0.02, 0.43, { seed: i + 3, drop: 0.2 }));
    for (const s of [-1, 1]) add(bench(cx, TZ + s * 0.72, hx - 0.05, { seed: i, id: ID.greyx }));
    add(runner(cx, TOP + 0.012, TZ, 0.1, 0.43));
    for (let k = 0; k < 5; k++) for (const s of [-1, 1]) { const px = cx - hx + 0.4 + k * 0.5; add(plate(px, TOP + 0.02, TZ + s * 0.27, { name: "pewter_plate" })); add(cup(px + 0.17, TOP + 0.014, TZ + s * 0.35, { id: (k + i) % 3 === 0 ? ID.oakx : ID.pewter, name: (k + i) % 3 === 0 ? "wooden_cup" : "pewter_cup" })); }
  });
  for (const [x, z, a, s] of [[-2.3, TZ + 0.05, 0.4, 1], [-0.95, TZ - 0.06, 1.1, 1], [-0.2, TZ + 0.08, 2, 1.1], [1.0, TZ + 0.03, 0.2, 1], [2.55, TZ - 0.05, 1.6, 1]]) add(loaf(x, TOP + 0.014, z, { a, seed: Math.round(x * 10) }));
  add(plait(-1.65, TOP + 0.014, TZ + 0.02, { a: 0.1 })); add(plait(2.2, TOP + 0.014, TZ + 0.04, { a: -0.15, name: "plaited_loaf" }));
  add(trencher(-0.55, TOP + 0.014, TZ - 0.05, { a: 0.1 })); add(cutLoaf(-0.55, TOP + 0.04, TZ - 0.05, { a: 0.1 }));
  add(trencher(1.45, TOP + 0.014, TZ + 0.08)); add(cheese(1.4, TOP + 0.05, TZ + 0.08, { a: 0.5 })); add(knife(1.7, TOP + 0.014, TZ + 0.12, 0.6));
  add(jug(-1.85, TOP + 0.014, TZ - 0.12, { s: 1.0 })); add(jug(-0.05, TOP + 0.014, TZ - 0.15, { s: 1.15, a: 1 })); add(jug(1.95, TOP + 0.014, TZ + 0.1, { s: 1.05 })); add(jug(0.9, TOP + 0.014, TZ - 0.1, { s: 0.9 }));
  add(pear(-2.35, TOP + 0.014, TZ - 0.12)); add(pear(-2.2, TOP + 0.014, TZ - 0.15, { s: 0.9, name: "pear" })); add(pearSlices(-2.0, TOP + 0.02, TZ + 0.12)); add(appleBowl(0.55, TOP + 0.014, TZ + 0.0));
  add(candle(-1.35, TOP + 0.014, TZ + 0.15)); add(candle(2.7, TOP + 0.014, TZ - 0.12, { name: "candle_dish" }));
  // the last sheaf at the head, tied with red
  add(sheaf(-2.95, 0.24, TZ + 0.1, { h: 1.35, lean: 0.05 })); add(timber("sheaf_stool", [-2.95, 0.12, TZ + 0.1], [0.22, 0.12, 0.22], ID.oakx, 0.01));
  marks.spots.push({ id: "sheaf", verb: "read", at: [-2.6, 0, TZ + 1.0], note: "the last sheaf: cut by hand, tied with red, set at the head where Orme sits" });
  // the wall of bales along the back wall, two courses with a step, the broken one at the right end
  for (let i = 0; i < 8; i++) { const bx = -HX + 0.6 + i * 0.97; add(bale(bx, 0, -HZ + 0.32, { a: (i % 3 - 1) * 0.03, seed: i, hx: 0.46 })); if (i % 3 !== 1 && i < 7) add(bale(bx + 0.2, 0.45, -HZ + 0.33, { a: (i % 2 ? 0.04 : -0.03), seed: i + 20 })); }
  for (let i = 0; i < 2; i++) add(bale(3.4 + i * 0.1, 0.9 + 0.0, -HZ + 0.34 + 0.0, { seed: 41 + i, name: "bale" }));
  for (const p of brokenBale(1.7, 0, -1.85, { seed: 60, a: 0.15 })) add(p);
  add(drift("spilled_straw", 3.2, -1.7, 0.7, 0.45, 0.07)); add(wisps("straw_wisps", 0, 1.0, 40, 3.0, 2)); add(wisps("straw_wisps_wall", -3.2, -1.7, 24, 1.2, 5));
  // barrels and the beer, lanterns, hooks
  add(barrel(3.5, 0.34, -1.3, { r: 0.27, h: 0.8, lying: true, a: 0, tap: true, name: "beer_barrel" })); add(timber("barrel_cradle", [3.5, 0.17, -1.3], [0.45, 0.17, 0.3], ID.oakx, 0.01)); add(barrel(-3.9, 0, -1.9, { r: 0.28, h: 0.85, name: "grain_barrel" }));
  add(bucket(3.2, 0.0, 0.0)); add(stool(-3.3, 1.9)); add(ropeCoil(-3.7, 0, 1.6)); add(blanket(3.6, 0, 1.2, { a: 0.3 }));
  // the lanterns: on the tie-beams over the tables and two on the back posts
  for (const [x, z, y] of [[-2.8, TZ - 1.1, 2.5], [0, TZ, 1.95], [2.8, TZ, 1.95], [-1.4, -HZ + 0.4, 2.1], [1.4, -HZ + 0.4, 2.1]]) { add(hookLantern(x, y, z, { drop: z > -HZ + 0.6 ? 3.0 - y - 0.1 : 0.0 })); lamp(x, y, z, z > -HZ + 0.6 ? 1.0 : 0.4); if (z > -HZ + 0.6) add(hook(x, 3.0, z)); }
  // a pool of light over each table: a lamp with a narrow cone, so the tables lead and the walls fall away
  [-2.0, -1.25, -0.5, 1.0, 1.7, 2.4].forEach((px, i) => L.push({ pos: [px, 1.5, TZ], type: 1, I: 4.5, reach: 6, cone: [0, -1, 0], mode: 1, key: `pool${i}`, group: "lantern" }));
  // the threshing floor in front: a raised board floor, the flail and basket, a sack of grain, the fork and rake leaned
  add({ name: "threshing_floor", bb: [-2.2, 0, 0.7, 1.9, 0.06, 2.55], f: (x, y, z, T) => T(box(x, y, z, -0.15, 0.015, 1.62, 2.05, 0.015, 0.92) * 0.95 + 0.002 * Math.sin(z * 33), ID.oakx) });
  add(flail(-0.5, 0.03, 1.5, { a: 0.35 })); add(winnowBasket(1.0, 0.03, 1.8, { a: 0.4 })); add(sack(-1.6, 0.03, 2.0, { s: 0.3, a: 0.5, open: true, seed: 3, name: "grain_sack_open" })); add(sack(-1.1, 0.0, -1.9 + 0.0, { s: 0.3, a: 0.2, seed: 5 }));
  add(fork([-4.15, 0, -1.55], [-4.3, 1.9, -1.45])); add(rake([-3.7, 0, -2.45], [-3.85, 1.7, -2.65]));
  // hung on the back wall and posts
  add(scythe(-2.0, 1.95, -HZ + 0.12, { len: 1.5 })); add(scythe(0.7, 2.0, -HZ + 0.12, { len: 1.3, name: "hung_scythe" })); add(harness(1.1, 1.8, -HZ + 0.12)); add(harness(2.4, 1.9, -HZ + 0.12, { name: "harness_on_peg" }));
  for (const x of [-2.8, 0, 2.8]) add(cornDolly(x, 2.95, -0.4 + (x === 0 ? 0.5 : -0.5)));
  add(sack(3.8, 0, -0.1, { s: 0.28, a: 0.8, seed: 7, name: "grain_sack" }));
  marks.spots.push({ id: "table", verb: "read", at: [0.2, 0, TZ + 1.4], note: "the table: places for the whole district, the Haldane boys at the foot" });
  marks.exits.push({ id: "yard", at: [-HX + 0.5, 0, 0.6], note: "the big doors out to the yard" });
}
