// The granary door at night, The Quota era 2 (story fight 1: villagers come for the grain; the Requisition
// Captain holds the door). The district granary at the foot of Mill Street: a long brick plinth with a tarred
// timber store above, its great double door at the top of a loading ramp, an iron bar across it and a padlock,
// a lantern on a bracket over it, the militia's brazier, a guard's sentry box, sacks stacked under a tarpaulin
// by the ramp (the export's, stencilled), the yard in front trodden snow and mud, a wall with a gate where the
// villagers come in, the mill race's rail. It stands in its own yard off the back of Exchange Square (the wiring
// names it "the district granary, Exchange Square"). The yard is kept open for the fight. Original block-out.
import { box, cyl, ell, cap, fbm } from "../sdf.mjs";
import { makeWorld } from "../kit/world.mjs";
import { ID } from "../kit/ids.mjs";
import * as K from "../kit/props.mjs";

export function granary() {
  const W = makeWorld({ cell: 2, margin: 0.5 }), L = [], marks = { spots: [], hides: [], exits: [], lamps: [] };
  const spot = (id, verb, at, note) => marks.spots.push({ id, verb, at, note });
  W.ground((x, y, z, T) => {
    T(y - 0.04 * fbm(x * 0.6, z * 0.6), ID.mud);   // the trodden yard
    // the granary along the back (z from -9 to -4): brick plinth to 1.6 m, tarred timber above to 7 m, a pitched roof
    const body = box(x, y, z, 0, 3.5, -6.5, 9, 3.5, 2.5), door = box(x, y, z, 0, 3.2, -4.0, 1.4, 1.6, 0.4);
    T(Math.max(body, y - 1.6), ID.brick);
    T(Math.max(body, -(y - 1.6), -door), ID.tar);
    T(Math.max(box(x, y, z, 0, 7.6, -6.5, 9.3, 1.2, 2.8) + 0.45 * Math.abs(z + 6.5) - 1.1, -(y - 6.9)), ID.roof);
    // the loading ramp up to the door (the fight's high ground)
    T(Math.max(box(x, y, z, 0, 0.8, -2.6, 2.2, 0.8, 1.4), y - 1.6 + (z + 4.0) * 0.55), ID.slab);
    // the yard wall on the left with its gate gap, the mill race's rail on the right
    T(Math.max(box(x, y, z, -9.5, 1.1, 2, 0.3, 1.1, 6.5), -box(x, y, z, -9.5, 1.1, 3.2, 0.6, 1.5, 1.4)), ID.brickdark);
    T(cap(x, y, z, [9.0, 0.9, -3.5], [9.0, 0.9, 8], 0.04), ID.iron);
  });
  // the great double door, barred and padlocked; the lantern over it
  W.add(K.shape([-1.6, 1.5, -4.4, 1.6, 5.4, -3.4], (x, y, z, T) => {
    for (const s of [-1, 1]) T(box(x, y, z, s * 0.68, 3.2, -4.1, 0.66, 1.55, 0.06), ID.darkwood);
    T(box(x, y, z, 0, 3.0, -3.98, 1.5, 0.08, 0.06), ID.iron); T(box(x, y, z, 0.12, 2.85, -3.9, 0.07, 0.1, 0.04), ID.brass);
    T(cap(x, y, z, [0, 5.0, -4.05], [0, 5.0, -3.6], 0.025), ID.iron); T(ell(x, y, z, 0, 4.8, -3.55, 0.12, 0.17, 0.12), ID.lantern);
  }));
  L.push({ pos: [0, 4.75, -3.35], type: 1, I: 22, reach: 14, key: "doorlamp", group: "lantern" });
  spot("door", "hold", [0, 1.6, -3.2], "the granary door: barred, the padlock, the lantern over it (the Captain's ground)");
  // the militia's brazier and the sentry box
  W.add(K.shape([2.6, 0, -1.6, 3.6, 1.1, -0.6], (x, y, z, T) => { T(Math.max(cyl(x, y, z, 3.1, 0.75, -1.1, 0.3, 0.2), -cyl(x, y, z, 3.1, 0.85, -1.1, 0.26, 0.2)), ID.iron); for (const a of [0, 2.1, 4.2]) T(cap(x, y, z, [3.1 + 0.27 * Math.cos(a), 0.6, -1.1 + 0.27 * Math.sin(a)], [3.1 + 0.42 * Math.cos(a), 0, -1.1 + 0.42 * Math.sin(a)], 0.022), ID.iron); T(ell(x, y, z, 3.1, 0.9, -1.1, 0.24, 0.07, 0.24), ID.stovefire); }));
  L.push({ pos: [3.1, 1.15, -1.1], type: 1, I: 12, reach: 9, key: "brazier", group: "fire" });
  W.add(K.shape([-4.4, 0, -3.8, -3.2, 2.7, -2.6], (x, y, z, T) => { T(Math.max(box(x, y, z, -3.8, 1.25, -3.2, 0.55, 1.25, 0.55), -box(x, y, z, -3.8, 1.2, -2.7, 0.42, 1.0, 0.3)), ID.green); T(box(x, y, z, -3.8, 2.6, -3.2, 0.62, 0.08, 0.62), ID.roof); }));
  marks.hides.push({ id: "sentry_box", at: [-3.8, 0, -2.6], r: 0.4, note: "in the sentry box's shadow" });
  // the export's sacks stacked under a tarpaulin by the ramp
  W.add(K.shape([3.4, 0, -4.2, 7.6, 2.2, -2.2], (x, y, z, T) => {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3 - j; k++) T(ell(x, y, z, 4.0 + i * 0.95 + k * 0.1, 0.25 + j * 0.42, -3.6 + k * 0.6, 0.45, 0.22, 0.3), ID.sack);
    T(Math.max(ell(x, y, z, 5.4, 0.9, -3.0, 2.2, 1.25, 1.1), -ell(x, y, z, 5.4, 0.85, -3.0, 2.12, 1.18, 1.03), -(y - 0.5)), ID.canvas);
  }));
  spot("sacks", "read", [5.4, 0, -1.6], "the export's sacks under a tarpaulin, stencilled for the Halvard Grain Company");
  marks.hides.push({ id: "behind_sacks", at: [7.8, 0, -3.0], r: 0.6, note: "behind the sack stack" });
  // a cart left in the yard (cover), barrels, a lamp post at the gate
  W.add(K.barrel(-6.0, 0, -1.5, 0.32, 0.9)); W.add(K.barrel(-5.4, 0, -1.9, 0.32, 0.9)); W.add(K.cask(-6.4, 0, -0.6, 0.6, true));
  W.add(K.shape([-9.0, 0, 4.4, -8.6, 3.2, 4.8], (x, y, z, T) => { T(cyl(x, y, z, -8.8, 1.5, 4.6, 0.06, 1.5), ID.iron); T(ell(x, y, z, -8.8, 3.05, 4.6, 0.1, 0.15, 0.1), ID.lantern); }));
  L.push({ pos: [-8.8, 3.0, 4.6], type: 1, I: 7, reach: 9, key: "gatelamp", group: "lantern" });
  marks.exits.push({ id: "gate", at: [-9.3, 0, 3.2], note: "the yard gate (where the villagers come in)" }, { id: "mill", at: [8.5, 0, 6], note: "along the mill race" });
  spot("yard", "fight", [0, 0, 2], "the yard before the door: the fight's ground");
  return { world: W.build(), marks, lights: (V = {}) => L.filter((l) => !(V.emit && V.emit[l.group] === 0)).concat(V.moon ? [{ pos: V.moon.pos, type: 2, I: V.moon.I, reach: 400, key: "moon", soft: 30 }] : [], V.fill ? [{ pos: [0, 10, 8], type: 1, I: V.fill, reach: 40, key: "fill", soft: 8 }] : []) };
}
