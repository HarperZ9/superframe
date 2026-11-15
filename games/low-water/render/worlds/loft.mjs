// The Low Company's net loft (design/PLACES-NEW.md section 4): a low room under the roof, about 6 m by
// 3.5 m, rafters at head height, nets hung in grey swags from every rafter, the hatch in the floor with the
// ladder down to the lane, the sack with the green copper under the lowest swag, two pairs of waders in the
// corner, a coil of rope where Merrow sits, one shuttered lantern. Very dark. Original block-out.
import { box, cyl, ell } from "../sdf.mjs";
import { makeWorld } from "../kit/world.mjs";
import { ID } from "../kit/ids.mjs";
import * as K from "../kit/props.mjs";
import { shell } from "./_room.mjs";

export function loftRoom() {
  const W = makeWorld({ cell: 1.0, margin: 0.4 }), L = [], marks = { spots: [], hides: [], exits: [], lamps: [] };
  const add = (p) => { W.add(p); if (p.light) L.push({ ...p.light, key: `${p.light.group}@${p.light.pos.join(",")}` }); return p; };
  const spot = (id, verb, at, note) => marks.spots.push({ id, verb, at, note });
  const HX = 3.0, HZ = 1.75, H = 2.3;
  W.ground((x, y, z, T) => {
    shell(T, x, y, z, { hx: HX, hz: HZ, h: H, floor: ID.boards, wall: ID.timber, wallNear: ID.timber, sill: 0.3, floorCuts: [[1.7, -0.1, 0.6, 0.4, 0.3, 0.4]] });   // the hatch cut in the floor
    // the lane below is not modelled: the hatch light carries it
    // the rafters: a pitched roof over the far half, its rafters low
    for (let k = -3; k <= 3; k++) T(box(x, y, z, k * 0.95, H - 0.05, -0.6, 0.06, 0.08, HZ - 0.4), ID.darkwood);
    T(box(x, y, z, 0, H + 0.25, -HZ + 0.1, HX + 0.2, 0.08, 0.6), ID.roof);
  });
  add(K.ladder([1.7, -1.1, 0.3], [1.7, 0.4, 0.3], Math.PI / 2, ID.timber));
  // nets in grey swags from the rafters: sagging sheets, open weave by a world-tied pattern
  for (let k = -2; k <= 2; k++) {
    const nx = k * 0.95 + 0.47, low = k === -1 ? 1.05 : 1.45;
    add(K.shape([nx - 0.5, low - 0.1, -1.7, nx + 0.5, H, 0.3], (x, y, z, T) => {
      const sag = H - 0.1 - (H - 0.1 - low) * (1 - ((z + 0.7) / 1.0) ** 2), d = Math.abs(y - sag) - 0.02, weave = Math.min(Math.abs(((x * 9) % 1) - 0.5), Math.abs(((z * 9) % 1) - 0.5));
      T(Math.max(d, Math.abs(x - nx) - 0.45, Math.abs(z + 0.7) - 1.0, 0.12 - weave), ID.net);
    }));
  }
  // the sack with the loop of green copper at its neck, under the lowest swag
  add(K.sack(-0.5, 0, -0.6, 0.3, 0.4));
  add(K.shape([-0.7, 0.4, -0.8, -0.3, 0.7, -0.4], (x, y, z, T) => T(Math.abs(Math.hypot(x + 0.5, z + 0.6) - 0.12) + Math.abs(y - 0.55) - 0.02, ID.green)));
  spot("sack", "read", [-0.5, 0, 0.0], "under the lowest swag, a sack with a loop of green copper at its neck");
  spot("boards", "listen", [0.6, 0, 0.6], "ear to the boards");
  // the waders standing in the corner
  for (const wx of [-2.6, -2.3]) add(K.shape([wx - 0.15, 0, -1.6, wx + 0.15, 1.3, -1.2], (x, y, z, T) => { T(cyl(x, y, z, wx, 0.6, -1.4, 0.09, 0.6), ID.oilskin); T(box(x, y, z, wx, 0.05, -1.32, 0.08, 0.05, 0.14), ID.oilskin); }));
  spot("waders", "use", [-2.2, 0, -0.9], "two pairs of waders standing in the corner");
  // the coil of rope where Merrow sits; Lugg's place under the lowest beam
  add(K.coil(1.0, 0, -1.1, 0.42)); spot("merrow", "talk", [1.0, 0, -0.5], "Merrow on the coil of rope");
  spot("lugg", "talk", [-1.0, 0, -0.9], "Lugg folded in three under the lowest beam");
  // one shuttered lantern hung from a rafter, giving a slit of light
  add(K.shape([-1.6, 1.4, -0.3, -1.3, 1.9, 0.0], (x, y, z, T) => { T(box(x, y, z, -1.45, 1.6, -0.15, 0.1, 0.14, 0.1), ID.iron); T(box(x, y, z, -1.36, 1.6, -0.15, 0.02, 0.1, 0.03), ID.lantern); }));
  L.push({ pos: [-1.3, 1.6, -0.15], type: 1, I: 3, reach: 4, group: "lantern", key: "shutter" });
  L.push({ pos: [1.7, -0.6, 0.6], type: 1, I: 4, reach: 4, group: "window", key: "hatchlight" });   // light from the lane up the hatch
  marks.exits.push({ id: "hatch", at: [1.7, 0, 0.6], note: "down the ladder to the lane" });
  marks.hides.push({ id: "behind_nets", at: [-1.9, 0, -1.2], r: 0.5, note: "behind the hung nets" });
  return { world: W.build(), marks, lights: (V = {}) => L.filter((l) => !(V.emit && V.emit[l.group] === 0)).map((l) => ({ ...l, I: l.I * (V.emit?.[l.group] ?? 1) })).concat(V.fill ? [{ pos: [0, 1.8, 0.8], type: 1, I: V.fill, reach: 7, group: "fill", key: "fill" }] : []) };
}
