// The yard outside Orme's barn on the night of the harvest supper (era 1, e1.s06): Ilo eats here with a plate on his knees and
// hears the toast through the window. An exterior built from the authored library, not era 2's granary. Stages (LW_STAGE 1 to 4):
//   1 ground and barn: stubble mud, a slab apron, the barn's board wall with the big doors ajar and one lit window, the eave.
//   2 big furniture: the wagon, the hay rick, the bale stack, the water trough and pump, the fence, two trees.
//   3 clutter: the bench where Ilo sits with his plate, the lantern post, barrels, buckets, the woodpile, a ladder, sacks.
//   4 close detail: straw on the apron, wisps, a dropped cup, a rope coil, cobweb in the eave, boot-scuffed mud.
// dressYard(W, L, marks, { stage = 4 }); lights are pushed to L (the lantern pole, the window, the door spill). Original (2026-10-23).
// Parameters: dressYard(W, L, marks, { stage = 4 }); the barn wall is the plane z = -4, the yard lies at +z, units are metres.
import { ID } from "./kinds.mjs";
import { box, fb3, n3, hash } from "./prim.mjs";
import { timber, brace, bench, barrel, bucket, ladder, doorLeaf, boardWall } from "./wood.mjs";
import { bale, hayMound, drift, wisps } from "./straw.mjs";
import { sack, hookLantern, ropeCoil, cobweb } from "./gear.mjs";
import { plate, cup, jug } from "./food.mjs";
import { handCart } from "./mill.mjs";

const BZ = -4.0;   // the barn wall's plane (z), the yard in front of it (+z)
export function dressYard(W, L, marks, { stage = 4 } = {}) {
  const add = (p) => W.add(p), lamp = (x, y, z, I, reach = 9, key = `lamp${L.length}`) => L.push({ pos: [x, y, z], type: 1, I, reach, key, group: "lantern" });
  // stage 1: the stubble field, the slab apron, the barn wall with doors and a window, the eave
  W.ground((x, y, z, T) => {
    // the field: plough rows (0.12 m high, 0.9 m apart, steep enough to show as ridges), swells, patches of mud, stubble and bare dust
    const away = Math.min(1, Math.max(0, (Math.max(Math.abs(x + 2) - 5.8, Math.abs(z + 1.4) - 2.6)) / 1.2)), row = 0.12 * away * Math.sin(z * 7 + 1.5 * Math.sin(x * 0.6)), swell = 0.12 * (fb3(x * 0.35, 0, z * 0.35) - 0.5);
    const pn = fb3(x * 0.3 + 5, 0, z * 0.3 - 3);
    T((y - swell - row - 0.012 * (n3(x * 5, 0, z * 5) - 0.5)) * 0.6, pn < 0.4 ? ID.mud : pn < 0.55 ? ID.hay : ID.sand);
    T(box(x, y, z, -2, -0.1, -1.4, 5.8, 0.12, 2.6) * 0.95 - 0.003 * (n3(x * 9, y * 9, z * 9) - 0.5), ID.slab);
    const wall = Math.max(boardWall(x + 2, y, z - BZ, { hu: 7.5, y1: 5.2, th: 0.07, bw: 0.24, seed: 61 }), 0);
    const doors = box(x, y, z, -1.0, 1.4, BZ, 0.55, 1.4, 0.3), win = box(x, y, z, 2.6, 3.4, BZ, 0.5, 0.45, 0.3);
    const bay = Math.floor((x + 9.6) / 2.4); T(Math.max(wall, -doors, -win), [ID.greyy, ID.greyz, ID.oaky][((bay % 3) + 3) % 3]);
    T(box(x, y, z, -1.0, 1.4, BZ - 0.25, 0.5, 1.35, 0.02), ID.windowdim); T(box(x, y, z, 2.6, 3.4, BZ - 0.05, 0.42, 0.4, 0.015), ID.window);
    const sl = ((y - 5.0 - (BZ + 0.6 - z) * 0.55) * 0.876); T(Math.max(Math.abs(sl) - 0.06, z - BZ - 0.7, BZ - 1.9 - z, Math.abs(x + 2) - 8.2), [ID.tile, ID.roof, ID.brick][(((Math.floor((x + 10) / 1.7) + Math.floor((BZ - z) / 1.4)) % 3) + 3) % 3]);
  });
  for (const px of [-8.2, -5.5, -2.9, 0.1, 2.9, 5.4]) add(timber("barn_post", [px, 2.5, BZ + 0.1], [0.14, 2.5, 0.14], ID.beamoak));
  add(timber("barn_sill", [-2, 0.12, BZ + 0.08], [7.6, 0.12, 0.1], ID.beamoak)); add(timber("door_header", [-1.6, 3.1, BZ + 0.1], [1.5, 0.12, 0.12], ID.beamoak)); add(timber("eave_beam", [-2, 4.95, BZ + 0.5], [7.6, 0.1, 0.1], ID.beamoak));
  add(doorLeaf([-0.4, 0, BZ + 0.35], 1.0, 2.8, 0.9, { name: "barn_door_leaf", seed: 8 }));
  lamp(2.6, 3.4, BZ + 1.2, 9, 12, "window"); lamp(-1.0, 1.4, BZ + 1.0, 8, 9, "doorspill");
  marks.exits.push({ id: "barn", at: [-1.0, 0, BZ + 1.2], note: "the big doors, ajar on the supper and the light" });
  if (stage < 2) return;
  add(handCart(2.6, -0.4, { a: 0.3, name: "hay_wagon" })); add(hayMound("hay_rick", [-8.2, 0, -3.6, -4.4, 3.4, -0.3], [[-6.3, -2.0, 3.0, 0.75], [-5.2, -1.2, 1.4, 0.9]], { tuft: 0.08, soft: 0.2, terrace: 0.3 }));
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3 - (i % 2); j++) add(bale(3.8 + i * 0.1, j * 0.45, -3.4 + (i % 2) * 0.3, { a: i * 0.04, seed: 70 + i * 3 + j }));
  add({ name: "water_trough", bb: [-0.4, 0, -0.2, 1.8, 0.8, 0.7], f: (x, y, z, T) => T(Math.max(box(x, y, z, 0.7, 0.35, 0.25, 1.1, 0.35, 0.4), -box(x, y, z, 0.7, 0.45, 0.25, 1.0, 0.3, 0.32)), ID.oakx) });
  add(timber("pump_stock", [-0.9, 0.7, 0.2], [0.09, 0.7, 0.09], ID.iron, 0.005)); add(timber("pump_spout", [-0.7, 1.3, 0.2], [0.22, 0.03, 0.03], ID.iron, 0.005));
  for (let i = 0; i < 8; i++) { add(timber("fence_post", [-8 + i * 1.5, 0.6, 3.0], [0.07, 0.6, 0.07], ID.greyy, 0.01)); if (i < 7) { add(timber("fence_rail", [-7.25 + i * 1.5, 0.5, 3.0], [0.75, 0.04, 0.025], ID.greyx, 0.01)); add(timber("fence_rail", [-7.25 + i * 1.5, 0.95, 3.0], [0.75, 0.04, 0.025], ID.greyx, 0.01)); } }
  for (const [x, z, h] of [[6.5, -2.5, 6], [-9.0, 1.5, 5]]) add({ name: "yard_tree", bb: [x - 2, 0, z - 2, x + 2, h + 2, z + 2], f: (px, py, pz, T) => { T(Math.max(Math.hypot(px - x, pz - z) - 0.28 + (py > 1 ? 0.07 : 0), -py, py - h * 0.6) * 0.9, ID.darkwood); for (let k = 0; k < 5; k++) { const a = k * 1.26; T((Math.hypot(px - x - Math.cos(a) * 0.9, py - h + 0.3 * (k % 2), pz - z - Math.sin(a) * 0.9) - 1.2 - 0.12 * (n3(px * 4, py * 4, pz * 4) - 0.5)) * 0.8, ID.weed); } } });
  if (stage < 3) return;
  add(bench(1.0, BZ + 0.9, 0.9, { id: ID.greyx, name: "wall_bench" })); add(plate(0.9, 0.5, BZ + 0.9, { r: 0.1 })); add(cup(1.3, 0.46, BZ + 0.9, {}));
  add(timber("lantern_post", [-3.4, 1.3, 0.6], [0.06, 1.3, 0.06], ID.oaky)); add(hookLantern(-3.4, 2.5, 0.6, { drop: 0.0, name: "post_lantern" })); lamp(-3.4, 2.5, 0.6, 14, 12, "post"); add(timber("lantern_arm", [-3.4, 2.62, 0.6], [0.2, 0.02, 0.02], ID.oakx));
  add(barrel(-4.2, 0, -3.3, { r: 0.3, h: 0.85, name: "rain_barrel" })); add(barrel(-3.3, 0, -3.35, { r: 0.28, h: 0.8, name: "grain_barrel" })); add(bucket(-0.2, 0, 0.8)); add(bucket(4.4, 0, -1.2, { name: "wood_bucket" }));
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3 - (i > 1 ? 1 : 0); j++) add({ name: "log", bb: [5.0 + i * 0.28 - 0.2, 0.0, -2.6, 5.0 + i * 0.28 + 0.2, 1.0, -1.2], f: (px, py, pz, T) => T(Math.hypot(py - (0.14 + j * 0.26), pz + 1.9) - 0.12 + Math.abs(px - 5.0 - i * 0.28) * 0 + Math.max(0, Math.abs(px - 5.0 - i * 0.28) - 0.7) * 1, ID.timber) });
  add(ladder([4.4, 0, BZ + 0.25], [4.4, 3.6, BZ + 0.2], "barn_ladder", 0.5, 11)); add(sack(-2.2, 0, -3.3, { s: 0.3, a: 0.4, seed: 14, id: ID.sackcloth })); add(jug(1.6, 0.46, BZ + 0.9, { s: 0.8 }));
  if (stage < 4) return;
  add(wisps("yard_straw", -1.5, -1.5, 90, 4.5, 11)); add(drift("trampled_straw", 0.5, -1.8, 0.8, 0.5, 0.05)); add(ropeCoil(-2.6, 0.03, -2.4)); add(cup(0.4, 0.03, -0.6, { name: "dropped_cup" })); add(cobweb([-8.0, 4.9, BZ + 0.4], [1, 0, 0], [0, 0, 1], { size: 0.6, seed: 71 }));
  add(sack(2.0, 0, -3.5, { s: 0.28, a: 1.0, seed: 22, id: ID.sackcloth, open: true, name: "grain_sack_open" }));
}
void brace;
