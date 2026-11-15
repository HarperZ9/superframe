// Shadwell's smokehouse (design/PLACES-NEW.md section 3): tall and narrow, about 5 m by 4 m; racks of
// herring on rods up into the dark (a texture of hanging fish, not each fish), the fire pit of oak chips
// that glows and does not flame, the fire-door to the lane, the chimney, the whitewashed soot board by
// the door, the fish of the year on its hook with a fish box under it, the corner sack. Original block-out.
import { box, cyl, ell } from "../sdf.mjs";
import { makeWorld } from "../kit/world.mjs";
import { ID } from "../kit/ids.mjs";
import * as K from "../kit/props.mjs";
import { shell } from "./_room.mjs";

export function smokeRoom() {
  const W = makeWorld({ cell: 1.0, margin: 0.4 }), L = [], marks = { spots: [], hides: [], exits: [], lamps: [] };
  const add = (p) => { W.add(p); if (p.light) L.push({ ...p.light, key: `${p.light.group}@${p.light.pos.join(",")}` }); return p; };
  const spot = (id, verb, at, note) => marks.spots.push({ id, verb, at, note });
  const HX = 2.5, HZ = 2.0, H = 5.0;
  W.ground((x, y, z, T) => shell(T, x, y, z, { hx: HX, hz: HZ, h: H, floor: ID.slab, wall: ID.brickdark, wallNear: ID.brickdark, sill: 0.5,
    cuts: [[HX + 0.1, 1.0, 0.9, 0.3, 1.0, 0.5], [-0.6, 1.0, -HZ - 0.1, 0.45, 1.0, 0.3]] }));   // the fire-door to the lane (+x), the back door to the hall (-z)
  // the racks: rods across the room at four heights, herring hanging from each in rows
  add(K.shape([-HX, 1.6, -HZ, HX, H, HZ], (x, y, z, T) => {
    for (const ry of [2.6, 3.3, 4.0, 4.6]) {
      for (const rz of [-1.6, -1.1, -0.6]) {   // over the back half only, so the room shows under them
        T(cyl(x, y, z, 0, ry, rz, 0.02, HX) /* along x */ + 0 * 0, ID.timber);
        // the fish: a row of thin bodies hung under the rod, every 0.12 m
        const fx = Math.round(x / 0.12) * 0.12; if (Math.abs(fx) < HX - 0.1) T(ell(x, y, z, fx, ry - 0.17, rz, 0.025, 0.15, 0.04), ID.fish);
      }
    }
  }));
  // the fire pit of oak chips under the racks: a low ring of brick, the embers
  add(K.shape([-0.9, 0, -0.6, 0.5, 0.4, 0.6], (x, y, z, T) => { T(Math.max(cyl(x, y, z, -0.2, 0.15, 0, 0.6, 0.15), -cyl(x, y, z, -0.2, 0.2, 0, 0.48, 0.2)), ID.brick); T(cyl(x, y, z, -0.2, 0.08, 0, 0.48, 0.06), ID.coal); for (const [ex, ez] of [[-0.3, 0.1], [0, -0.15], [-0.15, -0.25], [0.1, 0.2]]) T(ell(x, y, z, -0.2 + ex, 0.15, ez, 0.07, 0.04, 0.07), ID.stovefire); }));
  L.push({ pos: [-0.2, 0.7, 0], type: 1, I: 12, reach: 7, group: "fire", key: "pit" });
  spot("fire_door", "wait", [1.9, 0, 0.9], "stand in the heat by the fire-door and dry out");
  // the chimney rising from the back corner
  add(K.shape([-2.4, 0, -1.9, -1.6, H, -1.1], (x, y, z, T) => T(box(x, y, z, -2.0, H / 2, -1.5, 0.35, H / 2, 0.35), ID.brick)));
  // the soot board by the door: whitewashed, the hours read off it
  add(K.shape([0.9, 1.0, -2.1, 2.3, 2.2, -1.8], (x, y, z, T) => T(box(x, y, z, 1.6, 1.6, -1.98, 0.6, 0.45, 0.03), ID.limewash)));   // on the back wall by the fire-door
  spot("soot_board", "read", [1.6, 0, -1.4], "the whitewashed board by the door where Shadwell reads the hour");
  // the fish of the year on its hook in the middle, the box under it where Marrow sits
  add(K.rope([0.9, H - 0.2, -0.3], [0.9, 1.75, -0.3], 0.0, 0.012, ID.iron));
  add(K.shape([0.6, 0.9, -0.6, 1.2, 1.8, 0], (x, y, z, T) => T(ell(x, y, z, 0.9, 1.35, -0.3, 0.12, 0.42, 0.2), ID.fish)));
  spot("fish_of_year", "smell", [0.9, 0, 0.2], "the fish of the year on its hook");
  add(K.fishbox(0.9, 0, -0.9, 0, true)); spot("box", "wait", [0.9, 0, -0.5], "the fish box under the fish, where Marrow sits");
  add(K.sack(-1.9, 0, 1.4, 0.34, 0.3)); add(K.sack(-1.6, 0, 1.6, 0.28, 1.1));
  spot("sack", "use", [-1.4, 0, 1.2], "the corner sack where Shadwell sleeps; curing salt");
  marks.exits.push({ id: "lane", at: [2.2, 0, 0.9], note: "the fire-door to the lane" }, { id: "hall", at: [-0.6, 0, -1.7], note: "the back door into the Guild hall" });
  marks.hides.push({ id: "under_racks", at: [-1.6, 0, -0.6], r: 0.5, note: "in the smoke under the racks" });
  return { world: W.build(), marks, lights: (V = {}) => L.filter((l) => !(V.emit && V.emit[l.group] === 0)).map((l) => ({ ...l, I: l.I * (V.emit?.[l.group] ?? 1) })).concat(V.fill ? [{ pos: [0, 2.0, 1.0], type: 1, I: V.fill, reach: 8, group: "fill", key: "fill" }] : []) };
}
