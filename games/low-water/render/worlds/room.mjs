// The room above the Brine: the hull's bow, turned over, its planking the ceiling and walls, with
// gaps between the planks the afternoon comes through in white stripes; a round window looking along
// the quay to the mole; a small stove; a bed; a bench that is a door on two barrels; the plank wall
// for pinning things; a shaving mirror; the ship's ladder up through a hatch. Lamb's coat dries by the
// stove. The near side is cut away. Original block-out (Low Water look work).
import { box, cyl, sph, ell, cap } from "../sdf.mjs";
import { makeWorld, rnd } from "../kit/world.mjs";
import { ID } from "../kit/ids.mjs";
import * as K from "../kit/props.mjs";

export function room({ set = "night" } = {}) {
  const W = makeWorld({ cell: 1.2, margin: 0.35 }), L = [], marks = { spots: [], hides: [], exits: [], lamps: [] };
  const spot = (id, verb, at, note) => marks.spots.push({ id, verb, at, note });
  const RX = 3.6, RY = 2.6, RZ = 2.2, cut = (x, z) => Math.min(z + 0.7, x + 2.6, 2.8 - x); // keep the back wall (z < -0.7) and the stern end (x < -2.6) only
  W.ground((x, y, z, T) => {
    T(Math.max(y, Math.hypot(x / RX, z / RZ) - 1.02, -y - 0.3), ID.boards);
    const e = (Math.hypot(x / RX, y / RY, z / RZ) - 1) * Math.min(RX, RY, RZ), shell = Math.max(-e, e - 0.12);
    // planks run along x; a gap every 0.32 m of height lets the light through in stripes
    const v = (Math.atan2(y, Math.abs(z) + 0.001) / (Math.PI / 2)) * 9.5, gap = Math.abs(v - Math.round(v)) * 0.32 - 0.035;
    T(Math.max(shell, -gap, cut(x, z), -y + 0.05) * 0.9, ID.darkwood);
    const rx = ((x % 0.9) + 1.35) % 0.9 - 0.45; T(Math.max(Math.abs(rx) - 0.06, e, -e - 0.14, cut(x, z), -y) * 0.9, ID.timber);
  });
  // the round window in the bow, looking along the quay to the mole
  W.add(K.shape([3.0, 0.8, -0.7, 3.8, 1.9, 0.7], (x, y, z, T) => { T(Math.max(Math.hypot(y - 1.35, z) - 0.36, Math.abs(x - 3.36) - 0.05), set === "day" ? ID.window : ID.windowdim); T(Math.max(Math.abs(Math.hypot(y - 1.35, z) - 0.4) - 0.05, Math.abs(x - 3.3) - 0.08), ID.brass); }));
  spot("round_window", "read", [2.8, 0, 0], "the round window, along the quay to the mole (B:1377)");
  // the small stove and Lamb's coat drying by it, its hem tide-marked
  W.add(K.shape([-0.6, 0, -1.9, 0.6, 2.6, -0.9], (x, y, z, T) => { T(cyl(x, y, z, 0, 0.35, -1.4, 0.28, 0.35), ID.stove); T(box(x, y, z, 0.27, 0.3, -1.3, 0.02, 0.1, 0.12), set === "day" ? ID.coal : ID.stovefire); T(cap(x, y, z, [0, 0.7, -1.4], [0.1, 2.5, -1.75], 0.06), ID.stove); }));
  W.add(K.shape([0.6, 0, -1.9, 1.6, 1.9, -1.0], (x, y, z, T) => { T(cap(x, y, z, [0.7, 1.75, -1.5], [1.5, 1.75, -1.5], 0.02), ID.timber); T(box(x, y, z, 1.1, 1.1, -1.48, 0.32 + 0.12 * (1.75 - y), 0.6, 0.04 + 0.02 * Math.sin(x * 12)), ID.navy); T(box(x, y, z, 1.1, 0.56, -1.47, 0.42, 0.04, 0.05), ID.mud); }));
  spot("coat", "carry", [1.1, 0, -1.0], "Lamb's coat drying by the stove, a tide mark at the hem (D:71)");
  // the bed; the bench (a door on two barrels); the plank wall for pinning; the mirror
  W.add(K.shape([-3.2, 0, -0.9, -1.1, 0.7, 0.9], (x, y, z, T) => { T(box(x, y, z, -2.2, 0.32, 0, 0.95, 0.06, 0.6), ID.timber); for (const sx of [-1, 1]) for (const sz of [-1, 1]) T(box(x, y, z, -2.2 + sx * 0.88, 0.15, sz * 0.52, 0.04, 0.15, 0.04), ID.timber); T(ell(x, y, z, -2.25, 0.46, 0, 0.88, 0.1, 0.52), ID.canvas); T(ell(x, y, z, -2.85, 0.56, 0, 0.22, 0.08, 0.35), ID.bonecloth); }));
  W.add(K.shape([0.2, 0, 0.3, 2.4, 0.8, 1.3], (x, y, z, T) => { for (const bx of [0.55, 2.05]) T(cyl(x, y, z, bx, 0.3, 0.8, 0.24, 0.3), ID.barrel); T(box(x, y, z, 1.3, 0.64, 0.8, 0.95, 0.03, 0.42), ID.teal); T(sph(x, y, z, 1.95, 0.68, 0.45, 0.03), ID.brass); }));
  spot("bench", "read", [1.3, 0, 1.3], "the bench: a door on two barrels (B:1467)");
  W.add(K.shape([-2.2, 0.6, -2.0, 0.2, 2.2, -1.7], (x, y, z, T) => { T(box(x, y, z, -1.0, 1.35, -1.86, 1.15, 0.65, 0.04), ID.plank); const pins = [[-1.7, 1.6, ID.paper], [-1.2, 1.25, ID.paper], [-0.6, 1.7, ID.bottle], [-0.2, 1.3, ID.paper], [-1.45, 0.95, ID.chalk]]; for (const [px, py, id] of pins) T(box(x, y, z, px, py, -1.81, 0.14, 0.17, 0.005), id); T(cap(x, y, z, [-1.6, 1.55, -1.8], [-1.0, 1.25, -1.8], 0.006), ID.coal); }));
  spot("plank_wall", "read", [-1.0, 0, -1.3], "the plank wall: what Lamb pinned (D:81)");
  W.add(K.shape([-3.2, 1.0, -1.4, -2.9, 1.6, -0.8], (x, y, z, T) => { T(box(x, y, z, -3.05, 1.3, -1.1, 0.02, 0.18, 0.13), ID.glass); T(box(x, y, z, -3.07, 1.3, -1.1, 0.01, 0.21, 0.16), ID.brass); }));
  // the hatch and the ship's ladder down to the bar
  W.add(K.shape([-0.9, -0.3, 0.6, 0.1, 0.1, 1.6], (x, y, z, T) => T(Math.max(box(x, y, z, -0.4, -0.02, 1.1, 0.48, 0.04, 0.48), -box(x, y, z, -0.4, -0.02, 1.1, 0.42, 0.1, 0.42)), ID.timber)));
  W.add(K.ladder([-0.4, -0.05, 1.25], [-0.4, 0.9, 0.95], 0));
  marks.exits.push({ id: "bar", at: [-0.4, 0, 1.1], note: "the hatch and the ship's ladder down to the bar" });
  if (set !== "day") { W.add(K.candle(1.9, 0.67, 0.95, 0.15, false, 2.2)); L.push({ pos: [1.9, 0.86, 0.95], type: 1, I: 2.2, reach: 6, key: "candle" }); }
  L.push({ pos: [0.3, 0.3, -1.0], type: 1, I: set === "day" ? 0 : 4, cone: [0.6, 0, 1], mode: 2, reach: 5, key: "stove" });
  return { world: W.build(), marks, lights: (V = {}) => L.filter((l) => l.I > 0).concat(V.sun ? [{ pos: V.sun.pos, type: 3, I: V.sun.I, reach: 400, key: "sun", soft: 14 }] : [], V.porthole ? [{ pos: [4.2, 1.35, 0], type: V.porthole.type, I: V.porthole.I, cone: [-1, 0, 0], mode: 2, reach: 8, key: "porthole" }] : [], V.fill ? [{ pos: [0, 1.6, 0], type: 1, I: V.fill, reach: 8, key: "fill", soft: 2 }] : []) };
}
