// Inside the Brine: a boat turned keel up on the quay and made into a public house. The keel is the
// ceiling's ridge and the ribs come down to the floor; the near side is cut away for the camera.
// The bar along the far side (slate, pump, cracked brass clock, jars and bottles), the stove with the
// settle and Wenna's chair and the brass rail of drying socks, the oven three steps up behind the
// bar, the ship's-ladder stair to the room, benches and tables, the green bottle stack, the door to
// the quay. Original block-out (Low Water look work). Same room coordinates as the Phase 3 plate.
import { box, rbox, cyl, sph, ell, cap, fbm } from "../sdf.mjs";
import { makeWorld, rnd } from "../kit/world.mjs";
import { ID } from "../kit/ids.mjs";
import * as K from "../kit/props.mjs";

const RX = 7.2, RY = 4.2, RZ = 3.6;
export function brineRoom({ set = "night" } = {}) {
  const W = makeWorld({ cell: 1.5, margin: 0.4 }), L = [], marks = { spots: [], hides: [], exits: [], lamps: [] }, day = set === "day";
  const add = (p) => { W.add(p); if (p.light) L.push({ ...p.light, key: `${p.light.group}@${p.light.pos.join(",")}` }); return p; };
  const spot = (id, verb, at, note) => marks.spots.push({ id, verb, at, note });
  const cut = (x, z) => x + z * 1.8 - 2.6; // the camera side is removed
  W.ground((x, y, z, T) => {
    const foot = (Math.hypot(x / RX, z / RZ) - 0.98) * Math.min(RX, RZ);
    T(Math.max(y, foot, -y - 0.3), ID.boards);
    const e = (Math.hypot(x / RX, y / RY, z / RZ) - 1) * Math.min(RX, RY, RZ), shell = Math.max(-e, e - 0.22);
    T(Math.max(shell, cut(x, z), -y, y - 3.6), ID.darkwood);
    const rx = ((x % 1.1) + 1.65) % 1.1 - 0.55; T(Math.max(Math.abs(rx) - 0.08, e + 0.0, -e - 0.16, cut(x, z), -y, y - 3.6) * 0.9, ID.timber); // ribs
    T(Math.max(Math.hypot(y - RY + 0.25, z) - 0.16, Math.abs(x) - RX * 0.9, cut(x, z)), ID.timber); // the keel along the ridge
  });
  // portholes in the far side, the quay's sodium coming through them
  for (const px of [-4.6, -1.8, 1.2, 4.0]) add(K.shape([px - 0.5, 1.4, -3.5, px + 0.5, 2.4, -2.7], (x, y, z, T) => { const zs = -RZ * Math.sqrt(1 - (1.9 / RY) ** 2) * Math.sqrt(1 - (px / RX) ** 2) + 0.03; T(Math.max(Math.hypot(x - px, y - 1.9) - 0.3, Math.abs(z - zs) - 0.06), day ? ID.window : ID.porthole); T(Math.max(Math.abs(Math.hypot(x - px, y - 1.9) - 0.34) - 0.05, Math.abs(z - zs - 0.05) - 0.07), ID.brass); }));
  // the bar, its brass-topped counter, the pump, shelves of jars and bottles, the slate, the clock
  add(K.shape([-2.6, 0, -2.4, 3.8, 1.3, -1.0], (x, y, z, T) => { T(rbox(x, y, z, 0.6, 0.55, -1.6, 2.8, 0.55, 0.45, 0.04), ID.oxblood); T(box(x, y, z, 0.6, 1.13, -1.55, 2.95, 0.04, 0.55), ID.brass); T(cyl(x, y, z, 2.2, 1.33, -1.4, 0.05, 0.2), ID.brass); T(cap(x, y, z, [2.2, 1.5, -1.4], [2.45, 1.62, -1.4], 0.03), ID.darkwood); for (let k = 0; k < 5; k++) T(cyl(x, y, z, -1.6 + k * 0.6, 1.25, -1.35 + 0.08 * rnd(k), 0.05, 0.08), ID.glass); }));
  add(K.shape([-2.4, 1.4, -3.2, 3.6, 2.8, -2.4], (x, y, z, T) => {
    for (const sy of [1.55, 2.1, 2.6]) T(box(x, y, z, 0.6, sy, -2.75, 2.7, 0.03, 0.22), ID.timber);
    for (let k = 0; k < 42; k++) { const jx = -1.9 + (k % 14) * 0.36 + 0.05 * rnd(k), sy = [1.55, 2.1, 2.6][Math.floor(k / 14)], u = rnd(k, 3);
      if (u < 0.3) T(cyl(x, y, z, jx, sy + 0.17, -2.72, 0.11, 0.15), ID.jar); else T(Math.min(cyl(x, y, z, jx, sy + 0.15, -2.72, 0.055, 0.13), cyl(x, y, z, jx, sy + 0.35, -2.72, 0.02, 0.07)), u < 0.75 ? ID.bottle : ID.brass); }
  }));
  add(K.shape([-2.3, 1.1, -3.4, -0.9, 2.1, -2.8], (x, y, z, T) => { T(box(x, y, z, -1.6, 1.5, -3.05, 0.55, 0.38, 0.03), ID.slate); T(box(x, y, z, -1.6, 1.5, -3.02, 0.6, 0.43, 0.02), ID.timber); for (let k = 0; k < 5; k++) T(box(x, y, z, -1.95 + k * 0.17, 1.55 + 0.1 * Math.sin(k), -3.0, 0.06, 0.012, 0.01), ID.chalk); }));
  add(K.shape([2.2, 2.6, -3.4, 3.0, 3.4, -2.9], (x, y, z, T) => { T(cyl(x, z, y, 2.6, -3.15, 3.0, 0.3, 0.05), ID.brass); T(cyl(x, z, y, 2.6, -3.1, 3.0, 0.25, 0.02), ID.bone); T(cap(x, y, z, [2.45, 3.15, -3.08], [2.75, 2.85, -3.08], 0.008), ID.coal); }));
  spot("slate", "read", [-1.6, 0, -2.2], "the slate behind the bar; its back is a second slate (B:1154)"); spot("clock", "read", [2.6, 0, -2.2], "the brass ship's clock, a crack across its glass (B:1089)");
  // the stove, its pipe, the settle and Wenna's chair, the brass rail with socks drying
  add(K.shape([-5.4, 0, -2.0, -3.2, 3.8, 0.2], (x, y, z, T) => { T(cyl(x, y, z, -4.4, 0.55, -0.9, 0.45, 0.55), ID.stove); T(cyl(x, y, z, -4.4, 1.13, -0.9, 0.5, 0.04), ID.iron); T(box(x, y, z, -3.97, 0.45, -0.75, 0.04, 0.18, 0.2), ID.stovefire); T(cap(x, y, z, [-4.4, 1.15, -0.9], [-4.6, 3.7, -1.5], 0.1), ID.stove); T(cap(x, y, z, [-5.2, 1.3, -0.1], [-3.6, 1.3, 0.1], 0.025), ID.brass); for (let k = 0; k < 4; k++) T(box(x, y, z, -5.0 + k * 0.4, 1.12, 0.03 * k, 0.07, 0.17, 0.02), k & 1 ? ID.bonecloth : ID.red); }));
  L.push({ pos: [-3.85, 0.5, -0.7], type: 1, I: 12, cone: [1, 0, 0.3], mode: 2, reach: 8, group: "fire", key: "stove" });
  add(K.shape([-5.9, 0, 0.0, -4.1, 1.3, 1.6], (x, y, z, T) => { T(box(x, y, z, -5.0, 0.45, 0.85, 0.8, 0.05, 0.28), ID.timber); T(box(x, y, z, -5.0, 0.9, 1.12, 0.8, 0.45, 0.04), ID.timber); for (const s of [-1, 1]) T(box(x, y, z, -5.0 + s * 0.78, 0.5, 0.85, 0.03, 0.5, 0.28), ID.timber); })); // the settle
  add(K.shape([-3.6, 0, -0.1, -2.6, 1.4, 0.8], (x, y, z, T) => { T(box(x, y, z, -3.1, 0.45, 0.35, 0.25, 0.04, 0.25), ID.oxblood); T(box(x, y, z, -3.1, 0.95, 0.12, 0.25, 0.45, 0.03), ID.oxblood); for (const sx of [-1, 1]) for (const sz of [-1, 1]) T(box(x, y, z, -3.1 + sx * 0.21, 0.22, 0.35 + sz * 0.21, 0.025, 0.22, 0.025), ID.darkwood); })); // Wenna's chair
  spot("settle", "carry", [-5.0, 0, 1.3], "the copper sack under the settle (B:902)"); spot("stove", "wait", [-3.6, 0, -0.5], "the stove: Merrow steams at it, wet to the thigh (B:813)");
  // the oven three steps up behind the bar; the ship's-ladder stair to the room
  add(K.shape([2.6, 0, -3.4, 4.8, 2.0, -1.6], (x, y, z, T) => { T(box(x, y, z, 3.7, 1.0, -2.7, 0.8, 0.65, 0.45), ID.brick); T(box(x, y, z, 3.7, 0.95, -2.23, 0.42, 0.3, 0.03), day ? ID.coal : ID.stovefire); for (let k = 0; k < 3; k++) T(box(x, y, z, 3.7, 0.08 + k * 0.16, -1.95 + k * 0.18, 0.5, 0.08 + k * 0.08, 0.1), ID.steps); }));
  if (!day) L.push({ pos: [3.7, 0.95, -2.0], type: 1, I: 4, cone: [0, 0, 1], mode: 2, reach: 6, group: "fire", key: "oven" });
  spot("oven", "pry", [3.7, 0, -1.6], "the oven, three steps behind the bar; the third step creaks (B:2185)");
  add(K.ladder([5.6, 0, -1.6], [5.0, 3.4, -2.3], 0.9)); add(K.shape([5.2, 0, -2.6, 6.3, 2.2, -1.2], (x, y, z, T) => T(box(x, y, z, 5.85, 1.05, -1.9, 0.04, 1.05, 0.45), ID.teal))); // the stair door, ajar
  spot("stair_door", "bar", [5.6, 0, -1.4], "the stair door to the room; bar it with a chair (B:2106)");
  // tables, benches, stools; a flour sack under a table where Tobit sleeps
  for (const [tx, tz, a] of [[-2.0, 1.2, 0.2], [1.4, 1.5, -0.3], [3.4, 0.6, 0.6]]) { add(K.shape([tx - 0.8, 0, tz - 0.8, tx + 0.8, 0.9, tz + 0.8], (x, y, z, T) => { T(cyl(x, y, z, tx, 0.78, tz, 0.6, 0.04), ID.timber); T(cyl(x, y, z, tx, 0.38, tz, 0.07, 0.38), ID.timber); T(cyl(x, y, z, tx, 0.02, tz, 0.3, 0.02), ID.iron); if (!day) for (let k = 0; k < 2; k++) T(cyl(x, y, z, tx - 0.2 + 0.4 * k, 0.88, tz + 0.1 * k, 0.05, 0.08), ID.glass); })); for (const b of [0.5, 2.6, 4.4]) add(K.stool(tx + Math.cos(b + a) * 0.95, 0, tz + Math.sin(b + a) * 0.95, 0.2, 0.5)); }
  add(K.table(-0.4, 0, -0.35, 1.5, 0.22, 0.46, 0)); // the bench in front of the bar
  add(K.sack(-1.6, 0, 1.55, 0.28, 0.4));
  // the stack of empties in the corner, all green
  add(K.shape([-6.9, 0, -3.1, -4.3, 3.4, -0.5], (x, y, z, T) => { const lb = Math.hypot(x + 5.6, z + 1.8) - 1.3; if (lb < 0.3 && y < 3.4) { const bx = Math.round((x + 5.6) / 0.16) * 0.16 - 5.6, bz = Math.round((z + 1.8) / 0.16) * 0.16 - 1.8, by = Math.round((y - 0.11) / 0.24) * 0.24 + 0.11; T(Math.hypot(bx + 5.6, bz + 1.8) < 0.9 - by * 0.15 && by < 3.2 ? Math.max(cyl(x, y, z, bx, by, bz, 0.065, 0.11), -0) : Math.max(lb, 0.04), ID.bottle); } else T(Math.max(lb, 0.04), ID.bottle); }));
  // hanging paraffin lamps; the door to the quay with its peg
  for (const [lx, lz] of [[-1.6, -0.6], [2.0, 0.2], [-4.6, 0.6]]) add({ bb: [lx - 0.3, 2.1, lz - 0.3, lx + 0.3, 3.6, lz + 0.3], light: day ? null : { pos: [lx, 2.45, lz], type: 1, I: 26, reach: 14, group: "lantern" }, f: (x, y, z, T) => { T(cap(x, y, z, [lx, 3.5, lz], [lx, 2.78, lz], 0.012), ID.iron); T(cyl(x, y, z, lx, 2.75, lz, 0.2, 0.025), ID.brass); T(ell(x, y, z, lx, 2.55, lz, 0.12, 0.17, 0.12), day ? ID.glass : ID.lantern); } });
  add(K.shape([5.5, 0, 0.6, 6.6, 2.4, 2.2], (x, y, z, T) => { T(box(x, y, z, 5.6, 1.05, 1.4, 0.06, 1.05, 0.6), ID.teal); T(cap(x, y, z, [5.5, 1.7, 0.7], [5.3, 1.75, 0.7], 0.03), ID.darkwood); }));
  marks.exits.push({ id: "quay", at: [5.3, 0, 1.4], note: "the door to the quay" });
  marks.hides.push({ id: "behind_stove", at: [-4.9, 0, -1.6], r: 0.5, note: "behind the stove (B:1728)" }, { id: "behind_bar", at: [0.6, 0, -2.2], r: 0.8, note: "behind the bar when Sabine is out (B:165)" });
  if (day) for (const [tx, tz] of [[-2.0, 1.2], [1.4, 1.5]]) add(K.shape([tx - 0.6, 0.8, tz - 0.6, tx + 0.6, 1.5, tz + 0.6], (x, y, z, T) => { for (let k = 0; k < 2; k++) { const sx = tx - 0.25 + 0.5 * k; T(box(x, y, z, sx, 1.08, tz, 0.18, 0.02, 0.18), ID.timber); for (const q of [-1, 1]) T(cyl(x, y, z, sx + q * 0.14, 1.3, tz + q * 0.14, 0.02, 0.22), ID.timber); } })); // chairs on the tables
  return { world: W.build(), lights: (V = {}) => { const o = L.filter((l) => !(V.emit && V.emit[l.group] === 0)).map((l) => ({ ...l, I: l.I * (V.emit?.[l.group] ?? 1) })); if (V.fill) o.push({ pos: [0.5, 3.4, 0.2], type: 1, I: V.fill, reach: 20, key: "fill", soft: 2 }); if (V.sodiumIn) for (const px of [-4.6, -1.8, 1.2, 4.0]) o.push({ pos: [px, 1.9, -4.6], type: 0, I: V.sodiumIn, reach: 9, key: `sod${px}` }); if (V.sun) o.push({ pos: V.sun.pos, type: 3, I: V.sun.I, reach: 400, key: "sun", soft: 30 }); if (V.dayPorts) { for (const px of [-4.6, -1.8, 1.2, 4.0]) o.push({ pos: [px, 1.9, -2.75], type: 3, I: V.dayPorts, cone: [0, -0.35, 0.94], mode: 2, reach: 9, key: `dp${px}` }); o.push({ pos: [5.2, 1.3, 1.4], type: 3, I: V.dayPorts * 3, cone: [-1, -0.2, 0], mode: 2, reach: 10, key: "daydoor" }); } return o; }, marks };
}
