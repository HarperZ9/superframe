// Two Quota interiors for the spine's era 2 build (game director, 2026-10-22). Near walls cut away (shell).
// Original block-outs.
//   annikitchen(): Anni's kitchen at year 38, the witness scene and the cold open. A later era's room, between
//     Allocation and the Closure (design/sensory/01-LOOKS.md L3 to L4): a bare bulb on a flex over the table, a
//     wall repainted in a flat newer patch over the old limewash at a hard edge, linoleum, an enamel cooker, a
//     wireless on the shelf, the ration book on its nail. Outside the window the first sodium lamp on the street:
//     the Closure arriving early. The tin on the oilcloth, the teapot, three cups (the guest's among them), and on
//     the shelf the Haldane bowls she kept, five of them, the empty ones turned over.
//   sheaf(): the Sheaf on Mill Street at dinner time. A long low bar on the left wall with its pumps dry, a back
//     table with a bench where six men nurse one half-pint (the jug, the saucer with the egg cut in four), the
//     bench by the door where Tomas waits to be noticed, a grate with a poor fire, two windows on the street.
import { box, cyl, ell, cap, sph } from "../sdf.mjs";
import { makeWorld } from "../kit/world.mjs";
import { ID } from "../kit/ids.mjs";
import * as K from "../kit/props.mjs";
import { shell } from "./_room.mjs";

const marksNew = () => ({ spots: [], hides: [], exits: [], lamps: [] });

export function annikitchen() {
  const W = makeWorld({ cell: 1.2, margin: 0.35 }), L = [], marks = marksNew();
  const spot = (id, verb, at, note) => marks.spots.push({ id, verb, at, note });
  const HX = 2.6, HZ = 2.2, H = 2.6;
  W.ground((x, y, z, T) => {
    shell(T, x, y, z, { hx: HX, hz: HZ, h: H, floor: ID.boards, wall: ID.limewash, wallNear: ID.brick, sill: 0.4, cuts: [[0.9, 1.5, -HZ - 0.12, 0.42, 0.5, 0.3], [-HX - 0.12, 1.0, 1.3, 0.3, 1.0, 0.45]] });
    T(Math.max(box(x, y, z, 0.6, 0.006, 0.1, 1.6, 0.006, 1.3), -(y - 0.012)), ID.oxblood);   // the linoleum, a newer floor laid over the boards
    // the repaint: a flat patch of newer distemper over the old limewash, stopped at a hard edge where the paint ran out
    T(Math.max(box(x, y, z, -0.9, 1.25, -HZ + 0.005, 1.15, 1.25, 0.012), -box(x, y, z, 0.9, 1.5, -HZ, 0.5, 0.58, 0.3)), ID.mustard);
    T(Math.max(box(x, y, z, -HX + 0.005, 1.1, -0.6, 0.012, 1.1, 1.3), -box(x, y, z, -HX - 0.12, 1.0, 1.3, 0.3, 1.0, 0.45)), ID.mustard);
  });
  // the window on the street: dark glass, the sodium lamp outside it (the next era, early)
  W.add(K.shape([0.3, 0.9, -HZ - 0.35, 1.5, 2.1, -HZ + 0.15], (x, y, z, T) => {
    T(box(x, y, z, 0.9, 1.5, -HZ - 0.1, 0.4, 0.48, 0.02), ID.glass);
    T(Math.max(box(x, y, z, 0.9, 1.5, -HZ - 0.08, 0.44, 0.52, 0.03), -box(x, y, z, 0.9, 1.5, -HZ - 0.08, 0.39, 0.47, 0.1)), ID.cobalt);   // a frame painted blue, a later paint
    T(box(x, y, z, 0.9, 1.5, -HZ - 0.07, 0.4, 0.012, 0.02), ID.cobalt);
    T(box(x, y, z, 0.9, 0.99, -HZ + 0.02, 0.5, 0.03, 0.1), ID.timber);
  }));
  // the enamel cooker against the left wall, a kettle on it; the gas ring's small blue flame is not lit
  W.add(K.shape([-HX - 0.05, 0, -1.7, -HX + 0.8, 1.3, -0.4], (x, y, z, T) => {
    T(box(x, y, z, -HX + 0.36, 0.45, -1.05, 0.33, 0.45, 0.4), ID.bone); T(box(x, y, z, -HX + 0.36, 0.92, -1.05, 0.34, 0.02, 0.42), ID.iron);
    T(box(x, y, z, -HX + 0.7, 0.4, -1.05, 0.01, 0.22, 0.3), ID.iron);   // the oven door's rail
    T(Math.max(ell(x, y, z, -HX + 0.36, 1.03, -1.2, 0.12, 0.1, 0.12), -(y - 0.94)), ID.iron); T(cap(x, y, z, [-HX + 0.48, 1.06, -1.2], [-HX + 0.58, 1.12, -1.2], 0.015), ID.iron);
  }));
  spot("cooker", "read", [-HX + 0.9, 0, -1.05], "the cooker: the kettle on, the ring not lit");
  // the table with its oilcloth, three chairs (hers, the girl's, and the one for the man at the door)
  const TX = 0.9, TZ = -0.4;
  W.add(K.table(TX, 0, TZ, 0.6, 0.45, 0.76, 0));
  // chairs with backs: [x, z, which side the back is on (dx, dz)]
  for (const [cx, cz, bx, bz] of [[TX - 0.85, TZ, -1, 0], [TX, TZ - 0.75, 0, -1], [TX + 0.1, TZ + 0.78, 0, 1]]) {
    W.add(K.stool(cx, 0, cz, 0.18, 0.46));
    W.add(K.shape([cx - 0.24, 0.4, cz - 0.24, cx + 0.24, 1.0, cz + 0.24], (x, y, z, T) => T(box(x, y, z, cx + bx * 0.17, 0.72, cz + bz * 0.17, bx ? 0.02 : 0.16, 0.26, bz ? 0.02 : 0.16), ID.timber)));
  }
  W.add(K.shape([TX - 0.65, 0.74, TZ - 0.5, TX + 0.65, 1.05, TZ + 0.5], (x, y, z, T) => {
    T(box(x, y, z, TX, 0.765, TZ, 0.58, 0.006, 0.43), ID.teal);   // the oilcloth, a later pattern
    T(box(x, y, z, TX - 0.2, 0.83, TZ - 0.05, 0.13, 0.06, 0.09), ID.rust);   // the tin, its lid on
    T(box(x, y, z, TX + 0.15, 0.775, TZ + 0.12, 0.09, 0.004, 0.06), ID.paper); T(box(x, y, z, TX + 0.05, 0.778, TZ + 0.2, 0.07, 0.004, 0.05), ID.paper);   // papers out of it
    T(sph(x, y, z, TX + 0.35, 0.86, TZ - 0.2, 0.09), ID.bone); T(cap(x, y, z, [TX + 0.43, 0.88, TZ - 0.2], [TX + 0.5, 0.92, TZ - 0.2], 0.012), ID.bone);   // the teapot
    for (const [ux, uz] of [[-0.45, 0.05], [0.0, -0.3], [0.1, 0.32]]) T(Math.max(cyl(x, y, z, TX + ux, 0.81, TZ + uz, 0.04, 0.045), -cyl(x, y, z, TX + ux, 0.84, TZ + uz, 0.033, 0.045)), ID.bonecloth);
  }));
  spot("tin", "read", [TX, 0, TZ + 1.0], "the tin on the oilcloth: tallies, and a copy from the register gone soft at the folds");
  // the bare bulb on its flex over the table (the room's one light)
  W.add(K.shape([TX - 0.12, 1.6, TZ - 0.12, TX + 0.12, H, TZ + 0.12], (x, y, z, T) => { T(cap(x, y, z, [TX, H, TZ], [TX, 1.85, TZ], 0.006), ID.tar); T(cyl(x, y, z, TX, 1.82, TZ, 0.03, 0.04), ID.brass); T(sph(x, y, z, TX, 1.74, TZ, 0.05), ID.lantern); }));
  L.push({ pos: [TX, 1.68, TZ], type: 1, I: 10, reach: 7, key: "bulb", group: "lantern" });
  // the shelf on the back wall: the wireless, and the Haldane bowls she kept (five; the empties turned over)
  W.add(K.shape([-2.0, 1.3, -HZ - 0.05, 0.2, 1.9, -HZ + 0.35], (x, y, z, T) => {
    T(box(x, y, z, -0.9, 1.4, -HZ + 0.15, 1.0, 0.02, 0.15), ID.timber);
    T(box(x, y, z, -1.6, 1.58, -HZ + 0.15, 0.2, 0.16, 0.11), ID.darkwood); T(cyl(x, y, z, -1.6, 1.58, -HZ + 0.265, 0.07, 0.005), ID.canvas); T(cyl(x, y, z, -1.48, 1.5, -HZ + 0.27, 0.02, 0.01), ID.brass);
    const bowls = [[-1.15, true], [-0.9, false], [-0.65, true], [-0.4, true], [-0.15, false]];
    for (const [bx, up] of bowls) { const b = ell(x, y, z, bx, up ? 1.48 : 1.46, -HZ + 0.15, 0.1, 0.06, 0.1); T(up ? Math.max(b, -ell(x, y, z, bx, 1.51, -HZ + 0.15, 0.085, 0.05, 0.085), y - 1.5) : Math.max(b, -(y - 1.42)), ID.darkwood); }
  }));
  spot("bowls", "read", [-0.9, 0, -1.4], "the bowls on the shelf: five, from the house in Haldane Yard; some of them turned over");
  // the ration book on its nail by the door, a coat on the peg
  W.add(K.shape([-HX - 0.05, 1.2, 0.2, -HX + 0.3, 1.95, 0.8], (x, y, z, T) => { T(box(x, y, z, -HX + 0.03, 1.5, 0.4, 0.012, 0.11, 0.08), ID.slate); T(cap(x, y, z, [-HX, 1.85, 0.65], [-HX + 0.1, 1.85, 0.65], 0.012), ID.timber); T(Math.max(ell(x, y, z, -HX + 0.12, 1.42, 0.65, 0.09, 0.44, 0.18), -(y - 1.85)), ID.navy); }));
  spot("ration_book", "read", [-HX + 0.6, 0, 0.4], "the ration book on its nail: grey covers, the coupons cut");
  marks.exits.push({ id: "street", at: [-HX + 0.4, 0, 1.3], note: "the door to the street" });
  return { world: W.build(), marks, lights: (V = {}) => L.filter((l) => !(V.emit && V.emit[l.group] === 0)).concat(
    V.sodium ? [{ pos: [1.4, 3.2, -HZ - 3.5], type: 0, I: V.sodium, cone: [-0.1, -0.3, 1], mode: 2, reach: 9, key: "street", soft: 1 }] : [],
    V.fill ? [{ pos: [0.4, 2.2, 0.6], type: 1, I: V.fill, reach: 8, key: "fill", soft: 2 }] : []) };
}

export function sheaf({ dress = null } = {}) {   // dress: an era's own props (era 4's jukebox, 2026-10-22); era 2 passes none
  const W = makeWorld({ cell: 1.2, margin: 0.35 }), L = [], marks = marksNew();
  const spot = (id, verb, at, note) => marks.spots.push({ id, verb, at, note });
  const HX = 3.4, HZ = 2.6, H = 2.7;
  W.ground((x, y, z, T) => {
    shell(T, x, y, z, { hx: HX, hz: HZ, h: H, floor: ID.boards, wall: ID.plaster, wallNear: ID.brickdark, sill: 0.45, beams: { n: 3, id: ID.darkwood }, cuts: [[-0.6, 1.55, -HZ - 0.12, 0.45, 0.5, 0.3], [1.6, 1.55, -HZ - 0.12, 0.45, 0.5, 0.3], [-HX - 0.12, 1.05, 1.8, 0.3, 1.05, 0.5]] });
    T(box(x, y, z, 0, 0.6, -HZ + 0.03, HX + 0.2, 0.6, 0.04), ID.darkwood); T(box(x, y, z, -HX + 0.03, 0.6, 0, 0.04, 0.6, HZ + 0.2), ID.darkwood);   // the wainscot, black with years of smoke
  });
  // two windows on Mill Street, small panes, the grey noon in them
  for (const wx of [-0.6, 1.6]) W.add(K.shape([wx - 0.55, 1.0, -HZ - 0.35, wx + 0.55, 2.1, -HZ + 0.15], (x, y, z, T) => {
    T(box(x, y, z, wx, 1.55, -HZ - 0.1, 0.42, 0.47, 0.02), ID.window);
    T(Math.max(box(x, y, z, wx, 1.55, -HZ - 0.08, 0.46, 0.51, 0.03), -box(x, y, z, wx, 1.55, -HZ - 0.08, 0.41, 0.46, 0.1)), ID.timber);
    for (const g of [-0.14, 0.14]) T(box(x, y, z, wx + g, 1.55, -HZ - 0.07, 0.01, 0.46, 0.02), ID.timber); T(box(x, y, z, wx, 1.55, -HZ - 0.07, 0.42, 0.01, 0.02), ID.timber);
  }));
  // the bar along the left wall: the counter, three dry pumps, the shelf of bottles mostly empty
  W.add(K.shape([-HX - 0.05, 0, -2.3, -1.4, 2.4, 1.2], (x, y, z, T) => {
    T(box(x, y, z, -2.0, 0.55, -0.6, 0.3, 0.55, 1.55), ID.darkwood); T(box(x, y, z, -1.98, 1.13, -0.6, 0.38, 0.03, 1.6), ID.timber);
    for (const pz of [-1.4, -0.9, -0.4]) { T(cyl(x, y, z, -1.95, 1.3, pz, 0.03, 0.15), ID.brass); T(cap(x, y, z, [-1.95, 1.45, pz], [-1.95, 1.75, pz + 0.05], 0.02), ID.darkwood); }
    T(box(x, y, z, -HX + 0.15, 1.7, -0.6, 0.13, 0.02, 1.4), ID.timber);
    for (let k = 0; k < 7; k++) if (k % 3 !== 1) T(cyl(x, y, z, -HX + 0.15, 1.83, -1.8 + k * 0.38, 0.035, 0.11), ID.bottle);
  }));
  spot("bar", "read", [-1.3, 0, -0.6], "the bar: three pumps, all dry; nothing worth the name on the shelf");
  // the back table and its bench, the men's stools; the jug, the half-pint, the saucer with the egg cut in four
  const TX = 1.3, TZ = -1.35;
  W.add(K.table(TX, 0, TZ, 1.0, 0.42, 0.74, 0, ID.darkwood)); W.add(K.table(TX, 0, TZ - 0.75, 1.05, 0.16, 0.44, 0, ID.darkwood));
  for (const [sx, sz] of [[0.2, -1.0], [0.25, -1.6], [2.4, -1.1], [2.35, -1.7], [0.9, -0.6], [1.7, -0.6]]) W.add(K.stool(sx, 0, sz, 0.16, 0.45));
  W.add(K.shape([TX - 1.0, 0.72, TZ - 0.4, TX + 1.0, 1.0, TZ + 0.4], (x, y, z, T) => {
    T(Math.max(ell(x, y, z, TX - 0.1, 0.85, TZ, 0.08, 0.12, 0.08), -ell(x, y, z, TX - 0.1, 0.9, TZ, 0.06, 0.12, 0.06)), ID.jar);
    T(Math.max(cyl(x, y, z, TX + 0.25, 0.8, TZ + 0.1, 0.035, 0.06), -cyl(x, y, z, TX + 0.25, 0.84, TZ + 0.1, 0.03, 0.06)), ID.glass);
    T(cyl(x, y, z, TX + 0.55, 0.745, TZ - 0.05, 0.08, 0.006), ID.bone); for (let q = 0; q < 4; q++) T(ell(x, y, z, TX + 0.55 + 0.025 * Math.cos(q * 1.57), 0.765, TZ - 0.05 + 0.025 * Math.sin(q * 1.57), 0.022, 0.014, 0.016), q % 2 ? ID.mustard : ID.bonecloth);
  }));
  spot("table", "sit", [TX, 0, TZ + 0.9], "the back table: one jug of something brown and thin, and an egg on a saucer in quarters");
  // the grate in the back wall between the windows, a poor fire
  W.add(K.shape([0.2, 0, -HZ - 0.05, 1.0, 1.4, -HZ + 0.4], (x, y, z, T) => { T(Math.max(box(x, y, z, 0.6, 0.55, -HZ + 0.12, 0.38, 0.55, 0.14), -box(x, y, z, 0.6, 0.3, -HZ + 0.25, 0.24, 0.3, 0.2)), ID.brickdark); T(box(x, y, z, 0.6, 1.12, -HZ + 0.2, 0.42, 0.03, 0.2), ID.timber); T(ell(x, y, z, 0.6, 0.08, -HZ + 0.15, 0.18, 0.05, 0.1), ID.stovefire); }));
  L.push({ pos: [0.6, 0.25, -HZ + 0.5], type: 1, I: 1.6, cone: [0, 0.1, 1], mode: 2, reach: 4, key: "grate", group: "fire" });
  // the bench by the door, where a boy sent for his father sits and waits to be noticed
  W.add(K.table(-0.6, 0, 1.95, 0.9, 0.18, 0.44, 0, ID.timber));
  spot("door_bench", "sit", [-0.6, 0, 1.5], "the bench by the door");
  // a paraffin lamp over the bar, turned low at noon
  W.add(K.paraffin(-HX + 0.05, 2.0, -0.2, Math.PI / 2, false, 4)); L.push({ pos: [-HX + 0.5, 1.95, -0.2], type: 1, I: 4, reach: 7, key: "lamp", group: "lantern" });
  marks.exits.push({ id: "street", at: [-HX + 0.4, 0, 1.8], note: "the door to Mill Street" });
  if (dress) dress({ W, L, marks, HX, HZ, H });
  return { world: W.build(), marks, lights: (V = {}) => L.filter((l) => !(V.emit && V.emit[l.group] === 0)).concat(
    V.window ? [-0.6, 1.6].map((wx, i) => ({ pos: [wx, 2.0, -HZ + 0.35], type: V.windowType ?? 1, I: V.window, cone: [0.1, -0.3, 1], mode: 2, reach: 9, key: `window${i}`, soft: 1.2 })) : [],
    V.fill ? [{ pos: [0.5, 2.2, 0.6], type: 1, I: V.fill, reach: 9, key: "fill", soft: 2 }] : []) };
}
