// Three Quota places out of the town (spine build, 2026-10-22). The camera looks toward -x and -z. Original
// block-outs; the land after the author's 2026-10-22 references (the Highland plates: ochre bracken under low
// mist and one white house; method only).
//   road(): the post road walking back from the district line. The causeway across the white plain with its ditches,
//     a line of bare poplars, a milestone, a field gate hanging off one hinge, and far off at -x the Upper Town's
//     roofs and the bell tower over the rim.
//   yard(): Haldane Yard at the barn door. The barn with its double doors and a wicket, the end of the hands' barn
//     that is the Haldane kitchen with its one small window, the trodden yard, the handcart with its shafts down,
//     the water butt with ice on it, a midden under snow, a wall to the lane with its gate.
//   hill(): the Tesks' hill above Krall's End. A slope of bracken gone the colour of rust under frost, rock coming
//     through, the track up it; at the top the stone house limewashed white, its door, and the fold of dry stone
//     with the goats' straw kicked back to the rock.
import { box, cyl, ell, cap, sph, fbm, gable } from "../sdf.mjs";
import { makeWorld } from "../kit/world.mjs";
import { ID } from "../kit/ids.mjs";
import * as K from "../kit/props.mjs";
import { seasonOf, fieldId, trackId, waterId, roofId, brackenId, poplarCrown } from "./_season.mjs";

const marksNew = () => ({ spots: [], hides: [], exits: [], lamps: [] });
const lightsOf = (L, V) => L.filter((l) => !(V.emit && V.emit[l.group] === 0)).concat(V.sun ? [{ pos: V.sun.pos, type: 3, I: V.sun.I, reach: 600, key: "sun", soft: V.sun.soft ?? 20 }] : [], V.fill ? [{ pos: [0, 14, 10], type: 1, I: V.fill, reach: 50, key: "fill", soft: 8 }] : []);
// season (each world): winter (era 2, the default), harvest (era 1) or autumn (era 3); render/worlds/_season.mjs.
// dress (yard, hill): an era's own props, passed in by its place module so era 2's worlds load no prop kinds.
function poplar(px, pz, h = 9, seed = 0, S = "winter") {
  return K.shape([px - 1.0, 0, pz - 1.0, px + 1.0, h + 0.5, pz + 1.0], (x, y, z, T) => { T(cyl(x, y, z, px, h * 0.4, pz, 0.12, h * 0.4), ID.darkwood); for (let b = 0; b < 7; b++) { const a = b * 1.05 + seed; T(cap(x, y, z, [px, h * 0.3 + b * 0.8, pz], [px + 0.55 * Math.cos(a), h * 0.42 + b * 0.85, pz + 0.55 * Math.sin(a)], 0.03), ID.darkwood); } poplarCrown(S, T, x, y, z, px, pz, h * 0.35, h * 0.97, 0.78, seed); });
}

export function road({ season = "winter" } = {}) {
  const S = seasonOf(season);
  const W = makeWorld({ cell: 2, margin: 0.5 }), L = [], marks = marksNew();
  const spot = (id, verb, at, note) => marks.spots.push({ id, verb, at, note });
  W.ground((x, y, z, T) => {
    const field = y - 0.18 * fbm(x * 0.12, z * 0.12), cause = box(x, y, z, 0, -0.2, 0, 60, 0.45, 2.0) - 0.1;
    const ditch = Math.max(Math.abs(Math.abs(z) - 3.4) - 0.7, -(y + 0.35));
    T(Math.max(Math.min(field, cause), -ditch), fieldId(S, x, z));
    T(Math.max(cause, -(y - 0.24)), ID.cobble);
    T(Math.max(box(x, y, z, 0, 0.25, 0, 60, 0.03, 1.4), -(y - 0.25)), ID.mud);   // the ruts, black through the snow
    T(Math.max(Math.abs(Math.abs(z) - 3.4) - 0.65, y + 0.36, -(y + 0.45)), waterId(S));
  });
  for (let k = 0; k < 10; k++) W.add(poplar(-18 + k * 4.4, -2.7 + (k % 2) * 5.6, 8.5 + (k % 3), k, S));
  // the milestone: EDRIN 2 (the words are the game's)
  W.add(K.shape([1.8, 0, 1.7, 2.6, 1.0, 2.4], (x, y, z, T) => { T(Math.max(box(x, y, z, 2.2, 0.4, 2.05, 0.2, 0.4, 0.14), sph(x, y, z, 2.2, 0.3, 2.05, 0.55)), ID.wall); T(box(x, y, z, 2.2, 0.5, 2.2, 0.12, 0.1, 0.003), ID.chalk); }));
  spot("milestone", "read", [2.2, 0, 1.4], "the milestone: the town, and the miles to it");
  // a field gate hanging off one hinge in the hedge line
  W.add(K.shape([-6.0, 0, -5.4, -3.6, 1.5, -4.6], (x, y, z, T) => { for (const px of [-5.8, -3.8]) T(box(x, y, z, px, 0.6, -5.0, 0.08, 0.6, 0.08), ID.timber); for (let r = 0; r < 4; r++) T(cap(x, y, z, [-5.7, 0.2 + r * 0.3, -5.0], [-4.0, 0.05 + r * 0.32, -4.7], 0.03), ID.timber); }));
  // the Upper Town far off at -x: roofs and the bell tower over the rim
  W.add(K.shape([-70, 0, -40, -40, 26, -10], (x, y, z, T) => {
    for (let k = 0; k < 9; k++) T(gable(x, y, z, -62 + k * 2.6, 3 + (k % 3), -25 + (k % 2) * 4, 1.2, 2.2, 1.6), roofId(S, x, z));
    T(box(x, y, z, -55, 4, -26, 13, 4, 6), ID.brickdark);
    T(box(x, y, z, -52, 10, -22, 1.2, 10, 1.2), ID.tower); T(gable(x, y, z, -52, 20, -22, 1.4, 1.4, 3), ID.roof);
  }));
  marks.exits.push({ id: "town", at: [-12, 0, 0], note: "the road on to Edrin" }, { id: "post", at: [12, 0, 0], note: "back to the post" });
  return { world: W.build(), marks, lights: (V = {}) => lightsOf(L, V) };
}

export function yard({ season = "winter", dress = null } = {}) {
  const S = seasonOf(season);
  const W = makeWorld({ cell: 2, margin: 0.5 }), L = [], marks = marksNew(), Z0 = -3.2;
  const spot = (id, verb, at, note) => marks.spots.push({ id, verb, at, note });
  W.ground((x, y, z, T) => {
    T(y - 0.1 * fbm(x * 0.5, z * 0.5), S === "winter" ? ID.mud : S === "harvest" ? (fbm(x * 0.9 + 4, z * 0.9, 2) > 0.42 ? ID.straw : ID.mud) : (fbm(x * 0.8, z * 0.8 - 3, 2) > 0.66 ? ID.rust : ID.mud));
    T(Math.max(box(x, y, z, -0.5, 0.0, Z0 + 1.2, 3.2, 0.05, 1.2), -(y + 0.3)), ID.cobble);   // the setts before the barn door
  });
  // the barn: a long timber barn on a stone plinth, its double doors and the wicket in one leaf
  W.add(K.shape([-6, 0, Z0 - 6, 4, 8.5, Z0 + 0.3], (x, y, z, T) => {
    const body = box(x, y, z, -1, 2.4, Z0 - 2.8, 4.8, 2.4, 2.8);
    const deep = S === "harvest";   // at harvest the doors stand open on the barn's dark inside
    T(Math.max(body, -box(x, y, z, -0.5, 1.6, deep ? Z0 - 2.4 : Z0, 1.5, 1.6, deep ? 2.5 : 0.25)), ID.plank);
    T(box(x, y, z, -1, 0.35, Z0 - 2.8, 4.85, 0.35, 2.85), ID.wall);
    T(gable(x, y, z, -1, 4.8, Z0 - 2.8, 5.0, 3.1, 2.6), roofId(S, x, z));
    if (S !== "harvest") {
      for (const s of [-1, 1]) T(box(x, y, z, -0.5 + s * 0.75, 1.6, Z0 + 0.05, 0.72, 1.6, 0.06), ID.darkwood);   // the two leaves, shut
      T(box(x, y, z, -0.5, 1.6, Z0 + 0.12, 1.5, 0.04, 0.04), ID.iron);   // the bar across
      T(box(x, y, z, 0.15, 0.95, Z0 + 0.13, 0.36, 0.85, 0.02), ID.timber);   // the wicket
    } else {
      for (const s of [-1, 1]) T(box(x, y, z, -0.5 + s * 2.24, 1.6, Z0 + 0.1, 0.72, 1.6, 0.05), ID.darkwood);   // the two leaves swung right back against the wall
      T(box(x, y, z, -0.5, 0.02, Z0 - 2.4, 1.45, 0.02, 2.45), ID.straw);   // the threshing floor under chaff
    }
  }));
  spot("barn_door", "look", [-0.5, 0, Z0 + 1.4], "the barn's doors, barred; the wicket in the right leaf");
  // the kitchen end at the right: limewashed, one small window, a door; the Haldane kitchen
  W.add(K.shape([4, 0, Z0 - 4.5, 8.5, 6.5, Z0 + 0.3], (x, y, z, T) => {
    T(Math.max(box(x, y, z, 6.2, 1.25, Z0 - 2.1, 2.1, 1.25, 2.1), -box(x, y, z, 5.3, 1.5, Z0, 0.38, 0.4, 0.2), -box(x, y, z, 7.2, 1.0, Z0, 0.45, 1.0, 0.2)), ID.limewash);
    T(gable(x, y, z, 6.2, 2.5, Z0 - 2.1, 2.3, 2.3, 1.7), roofId(S, x, z));
    T(box(x, y, z, 5.3, 1.5, Z0 - 0.1, 0.36, 0.38, 0.02), ID.windowdim); T(box(x, y, z, 7.2, 1.0, Z0 - 0.05, 0.43, 1.0, 0.04), ID.darkwood);
    T(box(x, y, z, 7.6, 3.9, Z0 - 3.0, 0.25, 1.0, 0.25), ID.chimney);
  }));
  // the handcart, shafts down; the water butt with ice; the midden under snow; the wall to the lane and its gate
  W.add(K.shape([1.4, 0, -0.2, 4.0, 1.2, 1.8], (x, y, z, T) => {
    for (const wz of [0.0, 1.5]) T(Math.max(Math.abs(Math.hypot(x - 2.7, y - 0.48) - 0.42) - 0.045, Math.abs(z - wz) - 0.04), ID.timber);
    T(box(x, y, z, 2.8, 0.66, 0.75, 0.85, 0.04, 0.62), ID.plank); T(Math.max(box(x, y, z, 2.8, 0.85, 0.75, 0.85, 0.2, 0.64), -box(x, y, z, 2.8, 0.9, 0.75, 0.8, 0.25, 0.59)), ID.plank);
    for (const sz of [0.3, 1.2]) T(cap(x, y, z, [1.95, 0.66, sz], [1.45, 0.04, sz], 0.035), ID.timber);
  }));
  spot("cart", "look", [2.8, 0, 2.0], "the handcart, empty now");
  W.add(K.shape([3.4, 0, Z0 + 0.2, 4.2, 1.1, Z0 + 1.1], (x, y, z, T) => { T(Math.max(cyl(x, y, z, 3.8, 0.45, Z0 + 0.65, 0.35, 0.45), -cyl(x, y, z, 3.8, 0.55, Z0 + 0.65, 0.31, 0.45)), ID.barrel); T(cyl(x, y, z, 3.8, 0.82, Z0 + 0.65, 0.31, 0.01), waterId(S)); }));
  W.add(K.shape([-6.5, 0, -0.5, -3.5, 1.0, 1.8], (x, y, z, T) => T(Math.max(ell(x, y, z, -5.0, 0, 0.6, 1.4, 0.7, 1.0), -y), ID.mud)));
  W.add(K.shape([-9, 0, 4.4, 9, 1.5, 5.2], (x, y, z, T) => { T(Math.max(box(x, y, z, 0, 0.6, 4.8, 9, 0.6, 0.25) - 0.03 * fbm(x * 3, y * 3), -box(x, y, z, 4.5, 0.6, 4.8, 0.8, 1, 0.5)), ID.wall); }));
  if (dress) dress(W, L, marks, { Z0, season: S });
  marks.exits.push({ id: "lane", at: [4.5, 0, 4.0], note: "the gate to the lane" }, { id: "kitchen", at: [7.2, 0, Z0 + 0.8], note: "the kitchen door" });
  return { world: W.build(), marks, lights: (V = {}) => lightsOf(L, V) };
}

export function hill({ season = "winter", dress = null } = {}) {
  const S = seasonOf(season);
  const W = makeWorld({ cell: 2.4, margin: 0.6 }), L = [], marks = marksNew();
  const spot = (id, verb, at, note) => marks.spots.push({ id, verb, at, note });
  // the slope rises toward -x and -z; the track is a shelf across it near the origin
  const hgt = (x, z) => Math.max(0, -(x + z) * 0.28 - 0.4) + 0.5 * fbm(x * 0.09, z * 0.09);
  W.ground((x, y, z, T) => {
    const g = y - hgt(x, z) + 0.12 * fbm(x * 1.3, z * 1.3);
    const track = Math.abs(z * 0.85 - x * 0.35 - 0.2) - 1.0, rock = fbm(x * 0.35 + 7, z * 0.35) - 0.62;
    // harvest bracken stands in clumps (0.1 m of relief at about half a metre; winter and autumn unchanged): with one bracken
    // kind the slope had no edges at all, and the flat-face measure read it as one plane (2026-10-24)
    const clumps = S === "harvest" && track >= 0 && rock <= 0 ? -0.1 * fbm(x * 2.1 + 3, z * 2.1 - 1) : 0;
    T(g + clumps, track < 0 ? trackId(S) : rock > 0 ? ID.wall : brackenId(S, x, z));   // the track, rock coming through, and the bracken gone the colour of rust
    T(Math.max(g - 0.25 * Math.max(0, rock) * 3, -rock), ID.wall);
  });
  // the stone house limewashed white at the top, its door, one window; a thread of smoke is the effects' layer
  const HX = -8.5, HZ = -7.0, HY = hgt(-8.5, -7.0);
  W.add(K.shape([HX - 4, HY - 0.5, HZ - 3.5, HX + 4, HY + 6.5, HZ + 3.5], (x, y, z, T) => {
    T(Math.max(box(x, y, z, HX, HY + 1.2, HZ, 3.0, 1.7, 2.1), -box(x, y, z, HX + 0.6, HY + 0.9, HZ + 2.1, 0.45, 1.0, 0.2), -box(x, y, z, HX - 1.6, HY + 1.6, HZ + 2.1, 0.35, 0.35, 0.2)), ID.limewash);
    T(gable(x, y, z, HX, HY + 2.9, HZ, 3.2, 2.3, 1.8), roofId(S, x, z));
    T(box(x, y, z, HX + 0.6, HY + 0.9, HZ + 2.05, 0.43, 1.0, 0.04), ID.darkwood); T(box(x, y, z, HX - 1.6, HY + 1.6, HZ + 2.0, 0.33, 0.33, 0.02), ID.windowdim);
    T(box(x, y, z, HX - 2.4, HY + 4.0, HZ - 0.5, 0.3, 1.1, 0.3), ID.wall);
  }));
  spot("house", "look", [HX + 0.6, 0, HZ + 3.2], "Tesk's place: a stone house, limewashed, and a fold");
  // the fold: a ring of dry stone, the goats' straw kicked back to the rock in one place
  const FX = -2.5, FZ = -4.2, FY = hgt(FX, FZ);
  W.add(K.shape([FX - 3.4, FY - 0.6, FZ - 3.4, FX + 3.4, FY + 1.6, FZ + 3.4], (x, y, z, T) => {
    const r = Math.hypot(x - FX, z - FZ), gate = Math.abs(Math.atan2(z - FZ, x - FX) - 1.0) < 0.22;
    if (!gate) T(Math.max(Math.abs(r - 2.9) - 0.32, y - FY - 1.15 - 0.15 * fbm(x * 4, z * 4), -(y - FY + 0.6)) - 0.04 * fbm(x * 6, y * 6), ID.wall);
    T(Math.max(r - 2.5, y - FY - 0.08 - 0.08 * fbm(x * 3, z * 3), -(y - FY + 0.6), -(Math.hypot(x - FX - 0.6, z - FZ - 0.4) - 0.7)), ID.straw);
  }));
  spot("fold", "search", [FX + 0.6, 0, FZ + 0.4], "the fold: straw kicked back to the rock; no store under it");
  if (dress) dress(W, L, marks, { hgt, fold: [FX, FZ, 3.4], house: [HX, HZ], season: S });
  marks.exits.push({ id: "down", at: [8, 0, 3], note: "the track down to Krall's End" });
  return { world: W.build(), marks, lights: (V = {}) => lightsOf(L, V) };
}
