// Three Upper Town street places of The Quota era 2 (spine build, 2026-10-22). Fronts face +z (the camera looks
// toward -x and -z), the street runs along x. Original block-outs.
//   pump():    the end of Mill Street at dinner time: the parish pump on its stone with its trough, chalk on its iron
//              in two hands (BOIL ALL WATER, and under it bigger, ASK THE WELL WHY: the words are the game's, the
//              chalk here is marks), a terrace with a door chalked with a white cross and a ribbon on the knocker,
//              a loaf left on that step, buckets by the pump.
//   furrowe(): Exchange Street at the Furrowes' front step: two steps up to a door with a brass knocker, the street
//              sign on the corner and the district's notice pasted under it at face height, the relief queue's
//              rope posts down the kerb, a paraffin lamp on its bracket.
//   tilney():  the gate of the Furrow Church's home on Tilney Road: a brick front with tall windows, railings with
//              the mothers' side of the pavement, gate piers with a brass plate, a side door with a cart and a sheet
//              over what it carries.
import { box, cyl, ell, cap, sph, fbm } from "../sdf.mjs";
import { makeWorld } from "../kit/world.mjs";
import { ID } from "../kit/ids.mjs";
import * as K from "../kit/props.mjs";

const marksNew = () => ({ spots: [], hides: [], exits: [], lamps: [] });
// the street: cobbles with a kerb and a pavement of slab along the fronts at z0
function street(T, x, y, z, z0) {
  T(Math.max(y + 0.0 - 0.04 * fbm(x * 0.6, z * 0.6), -(y + 0.4)), ID.cobble);
  T(Math.max(box(x, y, z, 0, 0.06, z0 + 0.9, 40, 0.09, 0.9), -(y + 0.4)), ID.slab);
}
const lightsOf = (L, V) => L.filter((l) => !(V.emit && V.emit[l.group] === 0)).concat(V.sun ? [{ pos: V.sun.pos, type: 3, I: V.sun.I, reach: 400, key: "sun", soft: V.sun.soft ?? 20 }] : [], V.fill ? [{ pos: [0, 10, 8], type: 1, I: V.fill, reach: 30, key: "fill", soft: 6 }] : []);
// chalk letters as short strokes in a block, on a plane facing +z at (x, y, z), w by h, seed for the hand
function chalk(T, x, y, z, cx, cy, cz, w, h, rows, seed, id = ID.chalk) {
  for (let r = 0; r < rows; r++) for (let k = 0; k < Math.floor(w / 0.07); k++) { const u = Math.sin(k * 12.9 + r * 7.1 + seed) * 0.5 + 0.5; if (u < 0.25) continue; T(box(x, y, z, cx - w / 2 + k * 0.07, cy - r * (h / rows), cz, 0.012 + 0.012 * u, h / rows * 0.32, 0.004), id); }
}

export function pump() {
  const W = makeWorld({ cell: 2, margin: 0.5 }), L = [], marks = marksNew(), Z0 = -3.4;
  const spot = (id, verb, at, note) => marks.spots.push({ id, verb, at, note });
  W.ground((x, y, z, T) => street(T, x, y, z, Z0));
  const fronts = [[-7.5, ID.limewash, 1], [-3.5, ID.brick, 2], [0.5, ID.limewash, 3], [4.5, ID.bone, 4], [8.5, ID.brick, 5]];
  for (const [hx, id, seed] of fronts) W.add(K.house(hx, Z0 - 2.2, 1.95, 2.2, 6.2, { id, seed, lit: 0.15, k: 0.004 * (seed - 3) }));
  // the chalked door (the second house): a white cross on its leaf, a ribbon on the knocker, a loaf on the step
  W.add(K.shape([-4.3, 0, Z0 - 0.1, -2.7, 2.3, Z0 + 0.6], (x, y, z, T) => {
    T(box(x, y, z, -3.5, 1.25, Z0 + 0.09, 0.03, 0.42, 0.006), ID.chalk); T(box(x, y, z, -3.5, 1.35, Z0 + 0.09, 0.3, 0.03, 0.006), ID.chalk);
    T(cap(x, y, z, [-3.5, 1.1, Z0 + 0.1], [-3.45, 0.8, Z0 + 0.12], 0.012), ID.red); T(cap(x, y, z, [-3.5, 1.1, Z0 + 0.1], [-3.58, 0.82, Z0 + 0.12], 0.012), ID.red);
    T(ell(x, y, z, -3.3, 0.24, Z0 + 0.35, 0.13, 0.07, 0.09), ID.straw);   // the loaf on the step
  }));
  spot("chalked_door", "look", [-3.5, 0, Z0 + 1.6], "a door chalked with a white cross, a ribbon on the knocker, a loaf on the step nobody has knocked to give");
  // the pump on its stone, its handle, the trough; chalk in two hands on the iron
  const PX = 3.0, PZ = -0.8;
  W.add(K.shape([PX - 1.2, 0, PZ - 0.8, PX + 1.2, 2.2, PZ + 1.0], (x, y, z, T) => {
    T(box(x, y, z, PX, 0.12, PZ, 0.55, 0.12, 0.55), ID.slab);
    T(box(x, y, z, PX, 0.95, PZ, 0.16, 0.85, 0.16), ID.iron); T(sph(x, y, z, PX, 1.86, PZ, 0.13), ID.iron);
    T(cap(x, y, z, [PX, 1.1, PZ + 0.16], [PX, 0.95, PZ + 0.45], 0.04), ID.iron);   // the spout
    T(cap(x, y, z, [PX + 0.16, 1.55, PZ], [PX + 0.75, 1.25, PZ], 0.03), ID.iron);   // the handle
    T(Math.max(box(x, y, z, PX, 0.28, PZ + 0.62, 0.5, 0.2, 0.2), -box(x, y, z, PX, 0.4, PZ + 0.62, 0.44, 0.2, 0.15)), ID.slab);   // the trough
    T(box(x, y, z, PX, 0.4, PZ + 0.62, 0.44, 0.01, 0.15), ID.ice);
    chalk(T, x, y, z, PX, 1.5, PZ + 0.165, 0.28, 0.16, 2, 3);   // BOIL ALL WATER, the council's hand
    chalk(T, x, y, z, PX, 1.2, PZ + 0.165, 0.3, 0.3, 2, 9);     // the other hand, bigger
  }));
  for (const [bx, bz] of [[PX - 1.0, PZ + 0.5], [PX - 1.5, PZ + 0.9], [PX - 0.7, PZ + 1.2]]) W.add(K.shape([bx - 0.2, 0, bz - 0.2, bx + 0.2, 0.4, bz + 0.2], (x, y, z, T) => T(Math.max(cyl(x, y, z, bx, 0.15, bz, 0.13, 0.15), -cyl(x, y, z, bx, 0.2, bz, 0.115, 0.15)), ID.iron)));
  spot("pump", "read", [PX - 0.6, 0, PZ + 1.2], "the pump: chalk on the iron in two hands");
  W.add(K.paraffin(6.5, 0, -2.6, 0, true, 0)); // the street lamp, unlit by day
  marks.exits.push({ id: "mill_street", at: [-8, 0, 0.5], note: "up Mill Street" }, { id: "square", at: [8, 0, 0.5], note: "on to Exchange Square" });
  return { world: W.build(), marks, lights: (V = {}) => lightsOf(L, V) };
}

export function furrowe() {
  const W = makeWorld({ cell: 2, margin: 0.5 }), L = [], marks = marksNew(), Z0 = -3.0;
  const spot = (id, verb, at, note) => marks.spots.push({ id, verb, at, note });
  W.ground((x, y, z, T) => street(T, x, y, z, Z0));
  // the Furrowes' house in the middle, taller and better kept; its neighbours
  W.add(K.house(-5.2, Z0 - 2.3, 2.1, 2.3, 7.0, { id: ID.brick, seed: 11, lit: 0.2 }));
  W.add(K.house(0, Z0 - 2.5, 2.3, 2.5, 8.2, { id: ID.bone, seed: 12, lit: 0.3, door: false, floors: 3 }));
  W.add(K.house(5.4, Z0 - 2.3, 2.2, 2.3, 7.0, { id: ID.oxblood, seed: 13, lit: 0.2 }));
  // two steps up to the door, the door with its fanlight and brass knocker
  W.add(K.stairs(0, 0, Z0 + 0.9, Math.PI, 2, 1.6, 0.17, 0.3));
  W.add(K.door(0, 0.34, Z0 + 0.02, 0, 1.0, 2.2, ID.navy, false));
  W.add(K.shape([-0.6, 2.5, Z0 - 0.1, 0.6, 3.0, Z0 + 0.2], (x, y, z, T) => { T(Math.max(ell(x, y, z, 0, 2.6, Z0 + 0.04, 0.5, 0.32, 0.03), -(2.6 - y)), ID.windowdim); T(ell(x, y, z, 0, 1.6, Z0 + 0.11, 0.06, 0.06, 0.03), ID.brass); }));
  spot("door", "knock", [0, 0, Z0 + 1.6], "the Furrowes' door: the brass knocker Mary keeps bright");
  // the street sign on the corner of the left house, the notice pasted under it at the height of a face
  W.add(K.shape([-3.6, 1.2, Z0 - 0.1, -2.2, 3.1, Z0 + 0.2], (x, y, z, T) => {
    T(box(x, y, z, -2.9, 2.85, Z0 + 0.06, 0.6, 0.12, 0.02), ID.navy); T(box(x, y, z, -2.9, 2.85, Z0 + 0.075, 0.5, 0.05, 0.004), ID.bone);
    T(box(x, y, z, -2.9, 1.65, Z0 + 0.05, 0.36, 0.42, 0.006), ID.paper); T(box(x, y, z, -2.9, 1.9, Z0 + 0.058, 0.3, 0.07, 0.003), ID.red); T(box(x, y, z, -2.95, 1.55, Z0 + 0.058, 0.2, 0.17, 0.003), ID.slate);
  }));
  spot("notice", "read", [-2.9, 0, Z0 + 1.4], "the district's notice under the street sign, at the height of the queue's faces");
  // the relief queue's rope posts along the kerb
  for (let k = 0; k < 5; k++) { const qx = -7 + k * 2.6; W.add(K.shape([qx - 0.2, 0, 1.0, qx + 0.2, 1.1, 1.4], (x, y, z, T) => { T(cyl(x, y, z, qx, 0.5, 1.2, 0.04, 0.5), ID.iron); T(cyl(x, y, z, qx, 0.05, 1.2, 0.14, 0.05), ID.iron); })); if (k < 4) W.add(K.rope([qx, 0.95, 1.2], [qx + 2.6, 0.95, 1.2], 0.25, 0.02)); }
  W.add(K.paraffin(3.2, 2.6, Z0 + 0.02, 0, false, 0)); L.push({ pos: [3.2, 2.55, Z0 + 0.47], type: 1, I: 0, reach: 12, key: "lamp", group: "lantern" });
  marks.exits.push({ id: "square", at: [-8, 0, 0.5], note: "down to Exchange Square" });
  return { world: W.build(), marks, lights: (V = {}) => lightsOf(L.map((l) => (l.key === "lamp" ? { ...l, I: V.lamp || 0 } : l)).filter((l) => l.I > 0), V) };
}

export function tilney() {
  const W = makeWorld({ cell: 2, margin: 0.5 }), L = [], marks = marksNew(), Z0 = -4.4, RZ = -1.6;
  const spot = (id, verb, at, note) => marks.spots.push({ id, verb, at, note });
  W.ground((x, y, z, T) => {
    street(T, x, y, z, RZ);
    T(Math.max(box(x, y, z, 0, 0.08, (Z0 + RZ) / 2, 40, 0.1, (RZ - Z0) / 2), -(y + 0.4)), ID.mud);   // the forecourt behind the railings
  });
  // the home: a long brick front, three storeys of tall windows, a stone band, the door up steps in the middle
  W.add(K.shape([-9, 0, Z0 - 1.0, 9, 11, Z0 + 0.3], (x, y, z, T) => {
    T(box(x, y, z, 0, 5, Z0 - 0.5, 8.8, 5, 0.5), ID.brickdark); T(box(x, y, z, 0, 3.3, Z0 + 0.02, 8.8, 0.1, 0.05), ID.bone);
    T(box(x, y, z, 0, 10.2, Z0 - 0.5, 8.9, 0.3, 0.6), ID.bone);
  }));
  for (let r = 0; r < 3; r++) for (let c = 0; c < 7; c++) { if (r === 0 && c === 3) continue; W.add(K.windowAt(-6.6 + c * 2.2, 1.9 + r * 3.0, Z0 + 0.02, 0, 0.8, 1.7, (r * 7 + c) % 5 === 1 ? "dim" : "dark")); }
  W.add(K.door(0, 0.6, Z0 + 0.02, 0, 1.3, 2.6, ID.darkwood, false));
  W.add(K.stairs(0, 0, Z0 + 1.2, Math.PI, 4, 2.2, 0.15, 0.3));
  spot("stairs", "count", [0, 0, Z0 + 1.8], "the stairs up to the home's door");
  // the railings with the gate and its piers, the brass plate on the right pier
  W.add(K.railing([[-9, RZ], [-0.9, RZ]], 0.15, 1.6, 0.9)); W.add(K.railing([[0.9, RZ], [9, RZ]], 0.15, 1.6, 0.9));
  W.add(K.shape([-1.3, 0, RZ - 0.4, 1.3, 2.3, RZ + 0.4], (x, y, z, T) => {
    for (const px of [-1.0, 1.0]) { T(box(x, y, z, px, 1.0, RZ, 0.22, 1.0, 0.22), ID.wall); T(ell(x, y, z, px, 2.12, RZ, 0.2, 0.14, 0.2), ID.wall); }
    T(box(x, y, z, 1.0, 1.35, RZ + 0.225, 0.13, 0.09, 0.006), ID.brass);
    for (let k = 0; k < 8; k++) T(cap(x, y, z, [-0.75 + k * 0.21, 0.1, RZ + 0.35 - k * 0.03], [-0.75 + k * 0.21, 1.6, RZ + 0.35 - k * 0.03], 0.016), ID.iron);   // the gate, half open
  }));
  spot("plate", "read", [1.0, 0, RZ + 1.0], "the brass plate on the gate pier, polished");
  // the side door at the right with the sexton's cart, a sheet over what it carries
  W.add(K.door(6.6, 0, Z0 + 0.02, 0, 1.0, 2.1, ID.darkwood, false));
  W.add(K.shape([5.2, 0, Z0 + 0.3, 8.2, 1.3, Z0 + 2.3], (x, y, z, T) => {
    for (const wz of [Z0 + 0.6, Z0 + 2.0]) T(Math.max(Math.abs(Math.hypot(x - 6.6, y - 0.45) - 0.4) - 0.04, Math.abs(z - wz) - 0.035), ID.timber);
    T(box(x, y, z, 6.7, 0.62, Z0 + 1.3, 0.9, 0.04, 0.62), ID.plank);
    T(Math.max(ell(x, y, z, 6.7, 0.66, Z0 + 1.3, 0.85, 0.24, 0.55), -(y - 0.62)), ID.canvas);
    T(cap(x, y, z, [5.8, 0.6, Z0 + 1.0], [5.2, 0.05, Z0 + 0.9], 0.03), ID.timber); T(cap(x, y, z, [5.8, 0.6, Z0 + 1.6], [5.2, 0.05, Z0 + 1.7], 0.03), ID.timber);
  }));
  spot("cart", "look", [6.7, 0, RZ + 0.6], "the cart at the side door with a sheet over it");
  marks.exits.push({ id: "town", at: [-8, 0, 0.5], note: "back along Tilney Road to the town" });
  return { world: W.build(), marks, lights: (V = {}) => lightsOf(L, V) };
}
