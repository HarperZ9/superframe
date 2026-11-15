// Haldane Yard at harvest, era 1 (year 0): the barn's doors open on the stored crop, bales and stooks in the yard,
// the threshing gear by the door. Passed to worlds/q_country.mjs yard({ dress }) by render/places/q1_barns.mjs
// (package W3-C addendum, 2026-10-22). Original code over the authored library (straw, gear, wood).
import { hayMound, bale, sheaf, wisps } from "./straw.mjs";
import { sack, flail, winnowBasket } from "./gear.mjs";
import { barrel } from "./wood.mjs";

export function dressYardHarvest(W, L, marks, { Z0 }) {
  const add = (p) => W.add(p);
  // the stored crop heaped to the beam at the back of the barn, a slope of it falling toward the door
  add(hayMound("barn_crop", [-1.95, 0.04, Z0 - 4.85, 0.95, 3.1, Z0 - 1.2], [[-0.5, Z0 - 4.3, 3.0, 0.8, 0.3], [-1.4, Z0 - 3.6, 2.2, 0.9, 0.3], [0.5, Z0 - 3.4, 1.8, 0.9, 0.3]], { floor: 0.04 }));
  // bales stacked by the right leaf, one fallen
  [[1.6, 0, Z0 + 0.7, 0.1], [1.6, 0, Z0 + 1.15, -0.05], [1.6, 0.45, Z0 + 0.92, 0.04]].forEach(([x, y, z, a], i) => add(bale(x, y, z, { a, seed: i + 2, name: `yard_bale_${i}` })));
  add(bale(0.9, 0, Z0 + 1.9, { a: 0.9, seed: 7, name: "yard_bale_fallen" }));
  // a stook of sheaves leaning together on the left of the door, and two more by the wall
  [[-3.3, 1.2, 0.18], [-3.0, 1.35, -0.16], [-3.15, 1.0, 0.0], [-3.45, 1.5, -0.1]].forEach(([x, z, lean], i) => add(sheaf(x, 0, z, { lean, name: `yard_stook_${i}` })));
  add(sheaf(-1.7, 0, 3.9, { lean: 0.2, name: "yard_sheaf_wall_0" })); add(sheaf(-1.3, 0, 4.0, { lean: -0.15, name: "yard_sheaf_wall_1" }));
  // the threshing gear and the grain: flail, winnowing basket, sacks filled at the door, a water barrel
  add(flail(-2.1, 0, Z0 + 0.4, { name: "yard_flail" })); add(winnowBasket(-1.6, 0, Z0 + 1.1, { name: "yard_winnow" }));
  [[-2.4, Z0 + 1.3], [-2.75, Z0 + 1.0], [-2.55, Z0 + 1.7]].forEach(([x, z], i) => add(sack(x, 0, z, { s: 0.32, a: i * 1.1, seed: i + 4, name: `yard_sack_${i}` })));
  add(barrel(3.9, 0, Z0 + 1.6, { name: "yard_water_barrel" }));
  add(wisps("yard_chaff", -0.5, Z0 + 1.0, 40, 1.8, 3));
  marks.spots.push({ id: "crop", verb: "look", at: [-0.5, 0, Z0 + 1.6], note: "the barn open on the stored crop, heaped to the beam" });
}
