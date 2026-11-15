// The Old Light, Act 3 (content/act3/oldlight.lwd): the drowned lighthouse in the eye of the gale, cut open
// for the room camera. A round tower about 8 m across on a rock in flat black water; the near half of its wall
// cut down to a stub so the inside shows. The old doorway at +z (the hole Merrow climbed through: hinge-pins
// beside it, green paint round it), three steps down into a flooded passage where the green door lies across
// under a foot of water; the middle room at the centre, draining, with the bronze turning gear (a ring of teeth
// as wide as a cartwheel); the broken stair up the back wall; the low room a step down at the back right,
// soot on its wall. The boat's mooring at the base outside. Original block-out.
import { box, cyl, ell, cap } from "../sdf.mjs";
import { makeWorld } from "../kit/world.mjs";
import { ID } from "../kit/ids.mjs";
import * as K from "../kit/props.mjs";

export function oldLight() {
  const W = makeWorld({ cell: 1.2, margin: 0.4 }), L = [], marks = { spots: [], hides: [], exits: [], lamps: [] };
  const add = (p) => { W.add(p); if (p.light) L.push({ ...p.light, key: `${p.light.group}@${p.light.pos.join(",")}` }); return p; };
  const spot = (id, verb, at, note) => marks.spots.push({ id, verb, at, note });
  const R = 4.2, T = 0.6, H = 5.5, SEA = -0.55;
  W.ground((x, y, z, Tt) => {
    Tt(y - SEA + 0.02 * Math.sin(x * 0.7 + z * 0.4), ID.pool);   // flat black water all round
    Tt(Math.max(cyl(x, y, z, 0, SEA - 0.4, 0, R + 1.4 + 0.5 * Math.sin(Math.atan2(z, x) * 5), 0.6), -(y - SEA - 0.1) - 2), ID.weedrock);   // the rock the tower stands on
    // the wall: full height at the back (-x, -z half), a broken stub at the front, the doorway cut through it at +z
    const ring = Math.max(Math.abs(Math.hypot(x, z) - R) - T / 2, Math.abs(y - H / 2) - H / 2), front = x + z > 0.6;
    const broken = front ? Math.max(ring, y - (0.6 + 0.7 * (0.5 + 0.5 * Math.sin(Math.atan2(z, x) * 9)))) : ring;
    Tt(Math.max(broken, -box(x, y, z, 0.6, 0.9, R, 0.65, 1.1, 1.0)), ID.weedwall);
    Tt(Math.max(box(x, y, z, 0.6, 0.9, R + 0.02, 0.75, 1.2, T / 2 + 0.03), -box(x, y, z, 0.6, 0.9, R, 0.62, 1.07, 1.0), -(z - R + 0.2), y - 0.75), ID.green);   // (only the stub's height of it: the wall above is gone)   // the green paint round the old doorway
    // floors: the middle room drains (y 0), the passage from the door floods (y -0.3, the sea a foot over it),
    // the low room a step down at the back right (y -0.45)
    const inside = Math.hypot(x, z) < R;
    Tt(Math.max(box(x, y, z, 0, -0.15, 0, R, 0.15, R), Math.hypot(x, z) - R), ID.slab);
    Tt(Math.max(box(x, y, z, 0.6, -0.45, 2.6, 0.7, 0.15, 1.4), Math.hypot(x, z) - R - 0.3), ID.weed);   // the passage floor
    Tt(Math.max(box(x, y, z, 0.6, -0.1, 2.6, 0.68, 0.01, 1.4), Math.hypot(x, z) - R), ID.pool);   // the sea in the passage, a foot deep
    Tt(Math.max(box(x, y, z, 2.0, -0.6, -2.0, 1.4, 0.15, 1.2), Math.hypot(x, z) - R + 0.1), ID.slab);   // the low room's floor, a step down
    if (inside) Tt(Math.max(box(x, y, z, 2.0, 1.4, -2.0, 1.5, 1.6, 1.3), -box(x, y, z, 2.0, 1.4, -2.0, 1.3, 1.8, 1.1), x + z - 0.2, -(x - 0.45), -(-z - 0.7)), ID.brickdark);   // the low room's partition
    Tt(Math.max(box(x, y, z, 3.3, 1.2, -2.4, 0.04, 0.9, 0.7), Math.hypot(x, z) - R + 0.25 - 0.05), ID.coal);   // soot on the low room's wall: fresh, not old
  });
  // the hinge-pins beside the old doorway
  add(K.shape([-0.3, 0, R - 0.5, 0, 2.2, R + 0.5], (x, y, z, T2) => { for (const py of [0.4, 1.6]) T2(cap(x, y, z, [-0.12, py, R - 0.1], [-0.12, py + 0.22, R - 0.1], 0.04), ID.rust); }));
  // the green door fallen across the passage under the water
  add(K.shape([-0.3, -0.5, 2.0, 1.5, 0, 3.3], (x, y, z, T2) => T2(box(x, y, z, 0.6, -0.25, 2.6, 0.62, 0.05, 0.48) + 0 * (x - 0.6) * 0.04, ID.green)));
  spot("door", "use", [0.6, 0, 3.4], "the green door across the passage under a foot of water: a knee to the low corner, lift");
  spot("doorway", "climb", [0.6, 0, R + 0.4], "the old doorway, the hinge-pins beside it");
  // the bronze turning gear at the middle of the middle room
  add(K.shape([-1.2, 0, -1.2, 1.2, 0.8, 1.2], (x, y, z, T2) => {
    const r = Math.hypot(x + 0.3, z + 0.2), a = Math.atan2(z + 0.2, x + 0.3), tooth = Math.cos(a * 24) > 0.2 ? 0.08 : 0;
    T2(Math.max(Math.abs(r - 0.85) - 0.12 - tooth, Math.abs(y - 0.45) - 0.12), ID.brass);
    T2(cyl(x, y, z, -0.3, 0.2, -0.2, 0.18, 0.2), ID.rust); for (let k = 0; k < 4; k++) { const b = (k * Math.PI) / 2; T2(cap(x, y, z, [-0.3, 0.45, -0.2], [-0.3 + Math.cos(b) * 0.8, 0.45, -0.2 + Math.sin(b) * 0.8], 0.05), ID.brass); }
  }));
  spot("gear", "read", [0.8, 0, 0.9], "the turning gear: a ring of bronze teeth as wide as a cartwheel, green and whole");
  // the broken stair up the back wall, round the inside, its posts rusted, ending in air
  for (let k = 0; k < 11; k++) { const a = Math.PI * 0.9 + k * 0.17, sx = Math.cos(a) * (R - 0.6), sz = Math.sin(a) * (R - 0.6), sy = 0.3 + k * 0.32; if (k === 7) continue; add(K.shape([sx - 0.6, sy - 0.1, sz - 0.6, sx + 0.6, sy + 0.1, sz + 0.6], (x, y, z, T2) => T2(Math.max(Math.abs(Math.hypot(x, z) - (R - 0.6)) - 0.45, Math.abs(y - sy) - 0.07, Math.abs(Math.atan2(z, x) - a) * (R - 0.6) - 0.3), ID.slab))); }
  add(K.shape([-3.6, 0, -0.8, -2.8, 2.2, 0.2], (x, y, z, T2) => T2(cyl(x, y, z, -3.2, 1.0, -0.3, 0.05, 1.0), ID.rust)));   // a stair-post, all rust
  spot("stair", "climb", [-2.6, 0, -0.9], "the broken stair: a tread missing, the posts all rust");
  spot("low_room", "read", [1.6, 0, -1.5], "the low room, a step down: soot on the wall that is not old");
  spot("low_corner", "hide", [2.8, 0, -2.6], "the low room's corner");
  // the strippers' lanterns on the floor (their run-time light is the variant's), the boat's mooring outside
  for (const [lx, lz] of [[0.9, 0.6], [-1.3, 0.8]]) add(K.shape([lx - 0.15, 0, lz - 0.15, lx + 0.15, 0.4, lz + 0.15], (x, y, z, T2) => { T2(box(x, y, z, lx, 0.12, lz, 0.09, 0.12, 0.09), ID.iron); T2(ell(x, y, z, lx, 0.15, lz, 0.06, 0.08, 0.06), ID.lantern); }));
  L.push({ pos: [0.9, 0.35, 0.6], type: 1, I: 7, reach: 5, group: "lantern", key: "strippers1" }, { pos: [-1.3, 0.35, 0.8], type: 1, I: 7, reach: 5, group: "lantern", key: "strippers2" });
  add(K.shape([2.0, SEA - 0.2, R + 1.0, 4.5, SEA + 0.6, R + 2.6], (x, y, z, T2) => T2(Math.max(ell(x, y, z, 3.2, SEA, R + 1.8, 1.4, 0.35, 0.55), -(y - SEA - 0.05) - 1, y - SEA - 0.25), ID.boat)));   // the boat at the base
  spot("boat", "use", [2.4, 0, R + 0.9], "the boat, tied at the base on flat black water");
  marks.exits.push({ id: "water", at: [1.8, 0, R + 0.7], note: "out to the boat" }, { id: "stair_up", at: [-3.0, 2.2, -1.6], note: "up the broken stair" });
  marks.hides.push({ id: "behind_gear", at: [-1.0, 0, -0.9], r: 0.4, note: "behind the gear" }, { id: "under_water", at: [0.6, 0, 2.9], r: 0.4, note: "under the water by the fallen door" });
  return { world: W.build(), marks, lights: (V = {}) => L.filter((l) => !(V.emit && V.emit[l.group] === 0)).map((l) => ({ ...l, I: l.I * (V.emit?.[l.group] ?? 1) })).concat(V.fill ? [{ pos: [2, 6, 6], type: 1, I: V.fill, reach: 16, group: "fill", key: "fill" }] : []).concat(V.moon ? [{ pos: V.moon.pos, type: 2, I: V.moon.I, reach: 400, key: "moon", soft: 30 }] : []) };
}
