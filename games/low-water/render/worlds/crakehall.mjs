// The Alderman's hall on Chancel Hill (Act 2, place crake_hall; content/act2/hill.lwd): a bare white hall,
// one chair, the hall table with an envelope under a glove, the stair up, the study door ajar with the
// stove and the yellow lamp beyond, the front door, a white bulb overhead and the lane's white arc at the
// fanlight. About 5 m by 4 m. Original block-out.
import { box, cyl, ell } from "../sdf.mjs";
import { makeWorld } from "../kit/world.mjs";
import { ID } from "../kit/ids.mjs";
import * as K from "../kit/props.mjs";
import { shell } from "./_room.mjs";

export function crakeHall() {
  const W = makeWorld({ cell: 1.0, margin: 0.4 }), L = [], marks = { spots: [], hides: [], exits: [], lamps: [] };
  const add = (p) => { W.add(p); if (p.light) L.push({ ...p.light, key: `${p.light.group}@${p.light.pos.join(",")}` }); return p; };
  const spot = (id, verb, at, note) => marks.spots.push({ id, verb, at, note });
  const HX = 2.5, HZ = 2.0, H = 3.2, STUDY = [0.9, 1.05, -HZ - 0.1, 0.48, 1.05, 0.3], FAN = [-1.2, 2.55, -HZ - 0.1, 0.5, 0.22, 0.3];
  W.ground((x, y, z, T) => {
    shell(T, x, y, z, { hx: HX, hz: HZ, h: H, floor: ID.boards, wall: ID.limewash, wallNear: ID.limewash, sill: 0.35, cuts: [STUDY, FAN, [-1.2, 1.05, -HZ - 0.1, 0.5, 1.05, 0.3]] });
    // the study beyond its door: warm, a strip of floor and wall seen through the gap
    T(box(x, y, z, 0.9, 1.4, -HZ - 1.4, 1.2, 1.4, 0.05), ID.oxblood); T(box(x, y, z, 0.9, -0.05, -HZ - 0.8, 1.2, 0.05, 0.7), ID.rug);
    // the front door (shut) under the fanlight, the lane's white light at the glass
    T(box(x, y, z, -1.2, 1.05, -HZ - 0.06, 0.48, 1.04, 0.04), ID.darkwood || ID.timber);
    T(box(x, y, z, -1.2, 2.55, -HZ - 0.4, 0.5, 0.2, 0.04), ID.whitelamp);
    // the stair up the left wall
    for (let k = 0; k < 11; k++) T(box(x, y, z, -HX + 0.5, 0.1 + k * 0.28, 1.4 - k * 0.27, 0.45, 0.1 + k * 0.14, 0.14), ID.timber);
    T(box(x, y, z, -HX + 0.98, 1.9, 0.0, 0.03, 0.03, 1.5) , ID.darkwood || ID.timber);   // the handrail
  });
  // the study door ajar into the study, its warm spill
  add(K.shape([0.4, 0, -HZ - 0.1, 1.4, 2.2, -HZ + 0.6], (x, y, z, T) => { const a = 0.9, hx = 0.42 + Math.cos(a) * 0.45, hz = -HZ + Math.sin(a) * 0.45; T(box(x, y, z, hx, 1.05, hz, 0.03, 1.02, 0.46), ID.darkwood || ID.timber); }));
  L.push({ pos: [0.9, 1.2, -HZ - 0.9], type: 1, I: 6, reach: 5, group: "lantern", key: "studyspill" });
  // the hall table with the envelope under a glove; the one chair
  add(K.table(1.6, 0, -1.2, 0.5, 0.25, 0.8, 0, ID.darkwood || ID.timber));
  add(K.shape([1.3, 0.8, -1.4, 1.9, 0.9, -1.0], (x, y, z, T) => { T(box(x, y, z, 1.55, 0.81, -1.2, 0.12, 0.005, 0.08), ID.paper); T(ell(x, y, z, 1.6, 0.83, -1.18, 0.1, 0.025, 0.05), ID.navy); }));
  spot("envelope", "read", [1.6, 0, -0.7], "the envelope under a glove on the hall table");
  add(K.shape([-0.4, 0, 0.2, 0.2, 1.0, 0.8], (x, y, z, T) => { T(box(x, y, z, -0.1, 0.45, 0.5, 0.22, 0.025, 0.22), ID.darkwood || ID.timber); T(box(x, y, z, -0.1, 0.75, 0.29, 0.22, 0.3, 0.02), ID.darkwood || ID.timber); for (const [a, b] of [[-0.3, 0.3], [0.1, 0.3], [-0.3, 0.7], [0.1, 0.7]]) T(box(x, y, z, a, 0.22, b, 0.02, 0.22, 0.02), ID.darkwood || ID.timber); }));
  spot("chair", "wait", [0.2, 0, 0.9], "the one chair: wait to be seen");
  spot("study_door", "listen", [0.9, 0, -1.3], "the study door: two voices, one apologising");
  spot("stair", "look", [-1.6, 0, 1.4], "the stair up to the Alderman's rooms");
  // the white bulb overhead
  add(K.shape([-0.2, H - 0.6, -0.2, 0.2, H, 0.2], (x, y, z, T) => { T(cyl(x, y, z, 0, H - 0.25, 0, 0.008, 0.25), ID.iron); T(ell(x, y, z, 0, H - 0.55, 0, 0.07, 0.09, 0.07), ID.whitelamp); }));
  L.push({ pos: [0, H - 0.6, 0], type: 3, I: 14, reach: 7, group: "white", key: "hallbulb" });
  L.push({ pos: [-1.2, 2.6, -HZ - 1.2], type: 3, I: 8, reach: 6, group: "white", key: "fanlight" });
  marks.exits.push({ id: "front_door", at: [-1.2, 0, -1.6], note: "the front door to the hill path" }, { id: "study", at: [0.9, 0, -1.7], note: "into the study" }, { id: "stairs", at: [-1.9, 0, 1.6], note: "up the stair" });
  marks.hides.push({ id: "under_stair", at: [-1.9, 0, -0.6], r: 0.4, note: "in the dark under the stair" });
  return { world: W.build(), marks, lights: (V = {}) => L.filter((l) => !(V.emit && V.emit[l.group] === 0)).map((l) => ({ ...l, I: l.I * (V.emit?.[l.group] ?? 1) })).concat(V.fill ? [{ pos: [1.0, 2.4, 1.4], type: 1, I: V.fill, reach: 7, group: "fill", key: "fill" }] : []) };
}
