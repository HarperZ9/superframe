// Gullet harbour as one world: Lamp Quay, the harbour floor, the mole and Mother, the mouth of the
// Gut, and the town climbing Chancel Hill behind. Every outdoor Act 1 plate (the quay, the floor,
// the mole) and the wide pull-backs are cameras on this one world, so they agree with each other
// and with the game's world coordinates (x along the quay, y up, the quay top y = 0, the quay edge
// at z = 0, the harbour floor z > 0 at about y = -3.2). Original block-out (Low Water look work).
//   harbour({ set: "night" | "day" }) -> { world, lights(V), marks }
import { box, rbox, cyl, sph, ell, cap, gable, smin, fbm, vnoise, sat } from "../sdf.mjs";
import { makeWorld, rnd } from "../kit/world.mjs";
import { ID } from "../kit/ids.mjs";
import * as K from "../kit/props.mjs";
import { town } from "./town.mjs";

export const FLOOR = -3.2, ROW_Z = -9.6, MOLE = { x0: 22, x1: 38, z0: -3.6, z1: 0.4, y: 0.35 }, MOTHER = [36, 0, -1.6];
export const mudY = (x, z) => FLOOR + 0.2 * (fbm(x * 0.17, z * 0.17) - 0.5) - 0.05 * Math.max(0, z - 2) / 8;
// the gully: a channel from under the steps out across the floor
const GULLY = [[-2.2, 2.5], [1, 6], [5, 9], [9.5, 11.5], [15, 13.5], [21, 17], [28, 22]];
function gullyDist(x, z) { let d = Infinity; for (let i = 0; i < GULLY.length - 1; i++) { const [ax, az] = GULLY[i], [bx, bz] = GULLY[i + 1], vx = bx - ax, vz = bz - az, t = sat(((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)); d = Math.min(d, Math.hypot(x - ax - vx * t, z - az - vz * t)); } return d; }
export const floorY = (x, z) => { const g = gullyDist(x, z), w = 1.1 + 0.4 * vnoise(x * 0.3, z * 0.3); return mudY(x, z) - (g < w + 1 ? 0.55 * sat(1 - (g / (w + 1)) ** 2) : 0); };
const poolAt = (x, z) => fbm(x * 0.21 + 11, z * 0.21 + 4) < 0.38 || gullyDist(x, z) < 0.9;

export function harbour({ set = "night" } = {}) {
  const W = makeWorld({ cell: 2.5, margin: 0.6 }), night = set === "night", L = [], marks = { spots: [], hides: [], exits: [], lamps: [], paths: [] };
  const add = (p) => { W.add(p); if (p.light) L.push({ ...p.light, key: `${p.light.group}@${p.light.pos.map((v) => v.toFixed(2)).join(",")}` }); return p; };
  const spot = (id, verb, at, note) => marks.spots.push({ id, verb, at, note }), hide = (id, at, r, note) => marks.hides.push({ id, at, r, note });

  // ---- ground: quay slab with its kerb and weed-faced wall; the harbour floor; the sea past the mole
  W.ground((x, y, z, T) => {
    if (y > FLOOR - 2) {
      const q = box(x, y, z, -4, -1.8, -25, 28, 1.8, 25);
      if (q < 0.6) { const face = z > -0.12 && y < -0.04; T(q, face ? (y < -2.2 ? ID.weedwall : ID.wall) : z > -0.6 ? ID.slab : ID.cobble); } else T(q, ID.cobble);
    }
    if (z > -0.5 || x > 23) { // harbour floor and the sea
      const fy = x > 23 && z < -3.4 ? -2.9 : floorY(x, z), m = (y - fy) * 0.78;
      T(m, x > 23 && z < -3.4 ? ID.pool : poolAt(x, z) ? ID.pool : ID.mud);
    }
  });
  // ---- the town: the crooked row, the Gut's mouth, the hill (worlds/town.mjs)
  town(W, add, { night, marks });

  // ---- the quay steps: "further than steps should", built out from the wall, a dark arch beneath
  add(K.shape([-4.1, FLOOR - 0.2, -0.3, -1.3, 0.1, 6.4], (x, y, z, T) => {
    const n = 14, r = -FLOOR / n, t = 0.42, k = Math.max(0, Math.min(n - 1, Math.floor(z / t)));
    let d = Infinity;
    for (let j = Math.max(0, k - 1); j <= Math.min(n - 1, k + 1); j++) { const top = -(j + 1) * r; d = Math.min(d, box(x, y, z, -2.7, (FLOOR + top) / 2, (j + 0.5) * t, 1.3, (top - FLOOR) / 2, t / 2)); }
    // the arch under the east half of the flight: the hiding place
    const arch = Math.max(Math.hypot(Math.max(0, Math.abs(z - 3.4) - 0.9), Math.max(0, y - FLOOR - 0.6)) - 1.0, -(x + 2.5));
    T(Math.max(d, -arch), ID.steps);
  }));
  hide("under_steps", [-1.9, FLOOR, 3.2], 1.0, "the arch under the quay steps (Q:2467)");
  marks.paths.push({ id: "steps", pts: [[-2.7, 0, -0.2], [-2.7, FLOOR, 6.2]], note: "the quay steps down to the floor" });
  // the steps post: an iron post, an empty lantern cage, a wick door at its foot (l.steps_post)
  add(K.shape([-1.9, 0, -0.75, -1.3, 3.4, -0.15], (x, y, z, T) => { T(cyl(x, y, z, -1.6, 1.4, -0.45, 0.07, 1.4), ID.iron); T(box(x, y, z, -1.6, 0.35, -0.38, 0.06, 0.12, 0.02), ID.brass); const c = Math.max(box(x, y, z, -1.6, 3.0, -0.45, 0.16, 0.24, 0.16), -box(x, y, z, -1.6, 3.0, -0.45, 0.13, 0.21, 0.3), -box(x, y, z, -1.6, 3.0, -0.45, 0.3, 0.21, 0.13)); T(c, ID.iron); T(cyl(x, y, z, -1.6, 3.27, -0.45, 0.2, 0.03), ID.iron); }));
  spot("steps_post", "light", [-1.6, 0, -0.45], "iron post, empty cage, wick door at its foot (Q:891)");
  if (night) for (let k = 0; k < 7; k++) { const m = Math.floor(k / 2.4); add(K.candle(-3.6 + (k % 3) * 0.9 + 0.1 * rnd(k), -(m + 1) * (-FLOOR / 14), (m + 0.5) * 0.42, 0.18, true, 3)); }

  // ---- the Brine: a boat turned keel up on the quay; the yard behind its west end
  const BX = -7, BZ = -4.4;
  add(K.shape([BX - 5.4, 0, BZ - 2.8, BX + 5.4, 5, BZ + 2.8], (x, y, z, T) => {
    const hull = Math.max(ell(x, y, z, BX, 0, BZ, 5.0, 3.4, 2.45), -y), door = box(x, y, z, BX + 0.4, 0.95, BZ + 2.2, 0.55, 0.95, 0.8);
    T(Math.max(hull, -door), ID.hull); T(box(x, y, z, BX + 0.62, 0.95, BZ + 2.0, 0.28, 0.92, 0.04), ID.window); T(box(x, y, z, BX + 0.06, 0.95, BZ + 2.25, 0.04, 0.92, 0.3), ID.oxblood); // the door ajar, paraffin behind it
    for (const k of [-1, 0, 1]) T(Math.max(Math.abs(ell(x, y, z, BX, 0, BZ, 5.0, 3.4, 2.45) - 0.0) - 0.04, Math.abs(x - BX - k * 1.6) - 0.07, -y + 0.05), ID.timber); // ribs proud of the planking
    for (const px of [-3.2, -1.8, 1.9, 3.3]) T(cyl(x, z, y, BX + px, BZ + 2.0, 1.55, 0.25, 0.32), ID.porthole);
    T(cap(x, y, z, [BX + 2.2, 2.6, BZ - 0.6], [BX + 2.4, 4.6, BZ - 0.8], 0.17), ID.chimney);
    T(cap(x, y, z, [BX + 3.6, 3.0, BZ + 1.7], [BX + 4.6, 3.0, BZ + 2.2], 0.05), ID.iron); T(ell(x, y, z, BX + 4.3, 2.3, BZ + 2.25, 0.8, 0.3, 0.15), ID.sign); // the pickled-fish sign
    T(box(x, y, z, BX + 0.4, 0.07, BZ + 2.75, 0.8, 0.07, 0.35), ID.steps);
  }));
  add({ bb: [BX - 1, 0.5, BZ + 2, BX + 1.8, 2.2, BZ + 3.5], light: { pos: [BX + 0.4, 1.4, BZ + 2.6], type: 1, I: 26, cone: [0, 0, 1], mode: 2, reach: 12, group: "window" }, f: () => {} });
  for (const px of [-3.2, -1.8, 1.9, 3.3]) L.push({ pos: [BX + px, 1.55, BZ + 2.8], type: 1, I: 2.2, cone: [0, 0, 1], mode: 2, reach: 6, group: "window", key: `porthole${px}` });
  spot("brine_door", "enter", [BX + 0.4, 0, BZ + 2.6], "the Brine's front door");
  // the yard: a low wall, the back door, barrels, the mangle, the bottle stack, the rain butt
  const YX = BX - 6.6;
  add(K.shape([YX - 2.4, 0, BZ - 3.5, YX + 1.9, 1.4, BZ + 2.6], (x, y, z, T) => { const wall = Math.max(box(x, y, z, YX - 0.3, 0.6, BZ - 0.5, 2.1, 0.6, 3.0), -box(x, y, z, YX - 0.3, 0.6, BZ - 0.5, 1.85, 0.8, 2.75), -box(x, y, z, YX - 0.3, 0.5, BZ + 2.5, 0.6, 0.7, 0.4)); T(wall, ID.brick); }));
  add(K.shape([YX - 2.2, 0, BZ - 3.2, YX + 1.6, 3.4, BZ + 2.2], (x, y, z, T) => {
    // the stack of green bottles taller than a man
    const sx = YX - 1.3, sz = BZ - 2.3, lb = Math.hypot(x - sx, z - sz) - 0.9;
    if (lb < 0.25 && y < 2.3) { const bx = Math.round((x - sx) / 0.15) * 0.15 + sx, bz = Math.round((z - sz) / 0.15) * 0.15 + sz, by = Math.round((y - 0.1) / 0.22) * 0.22 + 0.1; T(Math.hypot(bx - sx, bz - sz) < 0.75 - by * 0.15 && by < 2.2 ? cyl(x, y, z, bx, by, bz, 0.06, 0.1) : Math.max(lb, 0.04), ID.bottle); } else T(Math.max(lb, 0.04), ID.bottle);
    T(cyl(x, y, z, YX + 0.9, 0.12, BZ - 2.5, 0.42, 0.12) * 0 + box(x, y, z, YX + 0.9, 0.55, BZ - 2.5, 0.35, 0.55, 0.25), ID.iron); T(cyl(x, z, y, YX + 0.9, BZ - 2.5, 1.2, 0.09, 0.4), ID.timber); // the mangle
  }));
  add(K.barrel(YX + 1.2, 0, BZ + 1.2, 0.4, 1.0)); add(K.barrel(YX - 1.8, 0, BZ + 0.2)); add(K.barrel(YX - 1.2, 0, BZ + 0.9, 0.3, 0.8, true, 0.6));
  add(K.shape([YX - 1.0, 0, BZ - 3.1, YX - 0.2, 0.25, BZ - 2.4], (x, y, z, T) => T(box(x, y, z, YX - 0.6, 0.06, BZ - 2.75, 0.3, 0.06, 0.25), ID.brick))); // the brick under the back door
  spot("brine_backdoor", "bar", [BX - 5.0, 0, BZ - 0.6], "the Brine's back door and the mangle (Q:2181)");
  spot("rain_butt_yard", "douse", [YX + 1.2, 0, BZ + 1.2], "the yard's rain butt (B:2034)");
  hide("yard_stack", [YX - 1.3, 0, BZ - 1.4], 0.7, "behind the bottle stack");

  // ---- the weigh-house and the town balance
  const WX = 3.4, WZ = -5.2, WF = WZ + 2.3;
  add(K.shape([WX - 3.2, 0, WZ - 2.8, WX + 3.2, 5.6, WZ + 2.7], (x, y, z, T) => {
    T(box(x, y, z, WX, 1.85, WZ, 2.7, 1.85, 2.3), ID.brick); T(gable(x, y, z, WX, 3.7, WZ, 2.95, 2.6, 1.3), ID.roof);
    T(box(x, y, z, WX, 3.72, WF + 0.35, 2.95, 0.06, 0.45), ID.timber); // the eave
    T(Math.max(box(x, y, z, WX + 1.5, 1.55, WF, 0.55, 0.55, 0.06), -box(x, y, z, WX + 1.5, 1.55, WF + 0.1, 0.47, 0.47, 0.1)), ID.timber); T(box(x, y, z, WX + 1.5, 1.55, WF - 0.02, 0.47, 0.47, 0.03), ID.windowdim); // the office window, no catch
    T(box(x, y, z, WX - 1.95, 2.95, WF - 0.02, 0.26, 0.22, 0.04), ID.glass); // the small window over the switch box
    T(box(x, y, z, WX - 0.1, 1.1, WF + 0.02, 0.6, 1.1, 0.05), ID.teal); T(box(x, y, z, WX + 0.35, 1.05, WF + 0.09, 0.05, 0.08, 0.03), ID.brass); // the Board's door, new padlock
    T(box(x, y, z, WX - 1.15, 1.5, WF + 0.05, 0.38, 0.5, 0.03), ID.slate); // the chalk board
  }));
  add(K.switchBox(WX - 1.95, 1.75, WF, 0, true)); spot("quay_switch", "cutpower", [WX - 1.95, 0, WF + 0.4], "QUAY: the switch box under the eave (W:366)");
  spot("weigh_office_window", "pry", [WX + 1.5, 0, WF + 0.4], "the office window, no catch (W:987)"); spot("weigh_door", "enter", [WX - 0.1, 0, WF + 0.4], "the Board's door, brass padlock (W:252)");
  hide("eave_shadow", [WX - 1.95, 0, WF + 0.5], 0.6, "the eave's shadow at the switch box (W:990)");
  add(K.barrel(WX + 2.95, 0, WF + 0.1, 0.38, 1.05)); add(K.shape([WX + 2.8, 0, WF - 0.2, WX + 3.1, 3.8, WF + 0.25], (x, y, z, T) => T(cyl(x, y, z, WX + 2.95, 2.35, WF + 0.06, 0.06, 1.4), ID.iron))); // rain butt and drainpipe
  spot("weigh_drainpipe", "climb", [WX + 2.95, 0, WF + 0.3], "the drainpipe to the roof (W:135)");
  add(K.table(WX - 2.2, 0, WF + 1.1, 0.8, 0.35, 0.8, 0.1)); add(K.table(WX + 1.0, 0, WF + 1.3, 0.8, 0.35, 0.8, -0.15)); // trestles
  // the town balance: a post as thick as a mast, an oak beam, iron pans the width of cartwheels, a winch
  add(K.shape([WX - 4.5, 3.6, WZ - 1.2, WX + 4.5, 8.4, WZ + 1.2], (x, y, z, T) => {
    T(cyl(x, y, z, WX, 5.7, WZ, 0.22, 1.9), ID.timber); T(cap(x, y, z, [WX - 3.4, 7.55, WZ], [WX + 3.4, 7.75, WZ], 0.17), ID.timber); T(sph(x, y, z, WX, 7.65, WZ, 0.3), ID.iron);
    for (const [px, py] of [[WX - 3.3, 5.9], [WX + 3.3, 6.25]]) { for (const s of [-1, 1]) T(cap(x, y, z, [px, py + 1.6, WZ], [px + s * 0.8, py + 0.05, WZ], 0.02), ID.iron); T(Math.max(ell(x, y, z, px, py, WZ, 0.95, 0.32, 0.95), -(py + 0.04 - y)), ID.rust); }
    T(cyl(x, z, y, WX, WZ + 0.35, 4.2, 0.25, 0.3), ID.iron); // the chain winch
  }));
  spot("balance_lamp", "light", [WX, 7.9, WZ], "l.balance: the balance lamp (W:558)");

  // ---- the harbour office; the cells beneath, their grating at ankle height on the quay
  const HX = 11.6, HZ = -4.6, HF = HZ + 1.9;
  add(K.shape([HX - 2.6, 0, HZ - 2.3, HX + 2.6, 5.6, HZ + 2.3], (x, y, z, T) => {
    T(box(x, y, z, HX, 1.75, HZ, 2.3, 1.75, 1.9), ID.teal); T(gable(x, y, z, HX, 3.5, HZ, 2.5, 2.1, 1.0), ID.roof);
    T(box(x, y, z, HX, 0.32, HF + 0.02, 2.32, 0.32, 0.06), ID.wall);
    const bars = Math.max(box(x, y, z, HX - 1.1, 0.3, HF + 0.08, 0.5, 0.17, 0.05), -box(x, y, z, HX - 1.1, 0.3, HF + 0.08, 0.44, 0.12, 0.1)); T(bars, ID.iron); T(box(x, y, z, HX - 1.1, 0.3, HF + 0.04, 0.44, 0.12, 0.02), ID.coal);
    for (let k = -3; k <= 3; k++) T(box(x, y, z, HX - 1.1 + k * 0.12, 0.3, HF + 0.08, 0.012, 0.12, 0.012), ID.iron);
    T(box(x, y, z, HX + 2.32, 1.6, HZ, 0.04, 0.5, 0.6), ID.window); // the window to the mole
    T(box(x, y, z, HX + 0.9, 1.05, HF + 0.02, 0.5, 1.05, 0.05), ID.oxblood); T(box(x, y, z, HX - 0.6, 1.7, HF + 0.02, 0.4, 0.45, 0.04), ID.windowdim);
    T(cap(x, y, z, [HX - 1.4, 3.6, HZ - 0.6], [HX - 1.4, 5.1, HZ - 0.6], 0.14), ID.chimney);
  }));
  L.push({ pos: [HX + 2.8, 1.6, HZ], type: 1, I: 4, cone: [1, 0, 0], mode: 2, reach: 9, group: "window", key: "office_east" }, { pos: [HX - 0.6, 1.7, HF + 0.4], type: 1, I: 2.4, cone: [0, 0, 1], mode: 2, reach: 7, group: "window", key: "office_front" });
  spot("cells_grating", "pry", [HX - 1.1, 0, HF + 0.4], "the cellar grating, two bolts and a padlock (Q:2462)"); spot("office_door", "enter", [HX + 0.9, 0, HF + 0.4], "the harbour office door");
  hide("office_doorway", [HX + 0.9, 0, HF + 0.2], 0.5, "the harbour office doorway (Q:1922)");

  // ---- sodium posts along the edge, heads over the street; bollards, rings, the kerb's dressing
  for (const px of [-24, -17, -10, 3.5, 10.5, 17.5]) add(K.sodiumPost(px, 0, -0.75, 4.7, Math.PI));
  for (const px of [-27.5, -20.5, -13.5, -5.2, 0.6, 7, 14, 20.5]) add(K.bollard(px, 0, -0.4));
  for (const px of [-22, -12, 5, 16]) add(K.ring(px, -1.2, 0.02, 0));
  marks.lamps.push(...[-24, -17, -10, 3.5, 10.5, 17.5].map((x) => ({ id: `sodium_${x}`, kind: "sodium", at: [x, 4.45, -1.3] })));

  // ---- set dressing on the quay: stacks and nooks that make paths and hiding places
  add(K.crateStack(-15.8, 0, -7.6, 5, 3, 0.2)); add(K.crateStack(7.5, 0, -7.9, 4, 5, -0.3)); add(K.crateStack(18.8, 0, -6.5, 5, 9, 0.5));
  hide("crates_east", [18.6, 0, -5.4], 0.6, "a nook behind the crates by the mole root"); hide("crates_weigh", [7.3, 0, -6.8], 0.6, "between the weigh-house and the office");
  add(K.netHeap(-25.5, 0, -2.4, 1.1, 4)); add(K.netHeap(15.3, 0, -1.6, 0.9, 7)); add(K.coil(-20.0, 0, -1.1)); add(K.coil(13.4, 0, -1.2, 0.35)); add(K.coil(0.2, 0, -1.4, 0.3));
  for (let k = 0; k < 6; k++) add(K.fishbox(-22.3 + (k % 3) * 0.9, (k >= 3 ? 0.26 : 0), -6.6 + (k % 2) * 0.1, 0.1 * k, k < 3));
  add(K.barrel(-18.8, 0, -8.9, 0.36, 0.95)); add(K.barrel(-1.5, 0, -8.9, 0.36, 0.95)); spot("herring_barrel", "climb", [-1.5, 0, -8.6], "drainpipe over a herring barrel under a window (Q:418)");
  add(K.shape([-1.65, 0, -9.75, -1.35, 9, -9.4], (x, y, z, T) => T(cyl(x, y, z, -1.5, 4.5, -9.6, 0.06, 4.5), ID.iron)));
  // the colour test: the same three things under the sodium and in the Brine's doorway
  for (const [sx, sz] of [[-10.6, -1.6], [BX + 1.6, BZ + 3.1]]) add(K.shape([sx - 0.5, 0, sz - 0.5, sx + 0.5, 1.0, sz + 0.5], (x, y, z, T) => {
    T(box(x, y, z, sx, 0.32, sz, 0.36, 0.32, 0.3), ID.crate); T(Math.max(Math.abs(x - sx + 0.2) + Math.abs(z - sz + 0.05) * 1.4 - 0.13, Math.abs(y - 0.78) - 0.14), ID.bottle);
    T(Math.min(ell(x, y, z, sx - 0.05, 0.66, sz + 0.18, 0.2, 0.03, 0.13), box(x, y, z, sx - 0.05, 0.45, sz + 0.31, 0.16, 0.2, 0.012)), ID.red); T(Math.min(cyl(x, y, z, sx + 0.2, 0.74, sz - 0.12, 0.13, 0.08), cyl(x, y, z, sx + 0.2, 0.67, sz - 0.05, 0.17, 0.012)), ID.blue);
  }));
  // a handcart and the lantern crate by the office (Q:2158)
  add(K.shape([5.8, 0, -2.6, 8.2, 1.1, -1.2], (x, y, z, T) => { T(box(x, y, z, 7.1, 0.6, -1.9, 0.8, 0.05, 0.5), ID.timber); for (const s of [-1, 1]) T(Math.max(Math.hypot(x - 6.9, y - 0.4) - 0.4, Math.abs(z + 1.9 - s * 0.55) - 0.04), ID.timber); T(cap(x, y, z, [7.9, 0.6, -2.2], [8.3, 0.85, -2.25], 0.03), ID.timber); }));
  add(K.crate(9.0, 0, -1.6, 0.34, 0.3)); spot("lantern_crate", "salvage", [9.0, 0, -1.6], "five shuttered lanterns in a crate (Q:2158)");

  // ---- the mole: the stone arm to Mother; the mole steps and the ferry lie on its seaward side
  const M = MOLE;
  W.ground((x, y, z, T) => { if (x < M.x0 - 2) return; const m = Math.max(box(x, y, z, (M.x0 + M.x1) / 2, (M.y + FLOOR - 0.5) / 2, (M.z0 + M.z1) / 2, (M.x1 - M.x0) / 2, (M.y - FLOOR + 0.5) / 2, (M.z1 - M.z0) / 2), -box(x, y, z, 26.5, -1.7, M.z0 - 0.2, 1.4, 2.4, 0.9)); T(m * 0.95, y < -1.8 ? ID.weedwall : ID.mole); });
  add(K.stairs(25.3, FLOOR + 0.3, M.z0 - 0.5, Math.PI / 2, 12, 1.3, 0.28, 0.24, ID.steps)); // the mole steps down to the water
  add(K.railing([[M.x0 + 0.5, M.z1 - 0.15], [M.x1 - 3, M.z1 - 0.15]], M.y, 1.0, 2.2)); // the lee rail; the windward side has none
  add(K.bollard((M.x0 + M.x1) / 2, M.y, M.z0 + 0.5)); add(K.paraffin(27.6, M.y, M.z0 + 0.25, Math.PI, true, 9, "lantern"));
  // dressing along the mole: lobster pots, a lifebuoy on its post, a chain, the boathook brackets at Mother's door
  for (let k = 0; k < 4; k++) add(K.shape([29.2 + k * 0.7, M.y, M.z1 - 1.2, 29.9 + k * 0.7, M.y + 0.6, M.z1 - 0.4], ((kk) => (x, y, z, T) => { const cx = 29.55 + kk * 0.7, cz = M.z1 - 0.8; T(Math.max(cyl(x, y, z, cx, M.y + 0.22, cz, 0.3, 0.22), -cyl(x, y, z, cx, M.y + 0.3, cz, 0.26, 0.22)), ID.net); T(Math.max(Math.abs(Math.hypot(x - cx, y - M.y - 0.22) - 0.3) - 0.02, Math.abs(z - cz) - 0.3), ID.timber); })(k)));
  add(K.shape([24.2, M.y, M.z1 - 0.5, 24.8, M.y + 1.8, M.z1 - 0.1], (x, y, z, T) => { T(cyl(x, y, z, 24.5, M.y + 0.8, M.z1 - 0.3, 0.05, 0.8), ID.timber); T(Math.hypot(Math.hypot(x - 24.5, y - M.y - 1.2) - 0.3, z - M.z1 + 0.22) - 0.08, ID.red); }));
  add(K.rope([23, M.y + 0.05, M.z0 + 0.3], [26.2, M.y + 0.05, M.z0 + 0.3], 0.0, 0.04, ID.iron));
  add(K.shape([MOTHER[0] - 2.1, M.y + 0.6, MOTHER[2] + 0.9, MOTHER[0] - 1.6, M.y + 2.2, MOTHER[2] + 1.6], (x, y, z, T) => { for (const by of [1.0, 1.8]) T(cap(x, y, z, [MOTHER[0] - 1.6, M.y + by, MOTHER[2] + 1.2], [MOTHER[0] - 1.85, M.y + by, MOTHER[2] + 1.2], 0.03), ID.iron); T(cap(x, y, z, [MOTHER[0] - 1.9, M.y + 0.7, MOTHER[2] + 1.25], [MOTHER[0] - 1.9, M.y + 2.2, MOTHER[2] + 1.25], 0.03), ID.timber); }));
  marks.hides.push({ id: "mole_lee", at: [30, M.y - 0.4, M.z1 + 0.4], r: 1.0, note: "the lee side, under the rail, on the weed ledge (M:201)" });
  spot("mole_steps", "enter", [26.5, M.y, M.z0 + 0.6], "the mole steps under their caged lamp, the ferry's gangway (Q:1775)");
  // the Saint Cuthwin at the mole steps, gangway down
  add(K.shape([25, -4, -10.5, 41, 6, -4.0], (x, y, z, T) => {
    const hull = Math.max(ell(x, y, z, 33, -1.6, -7.3, 7.6, 2.6, 2.6), y - 1.0); T(hull * 0.9, ID.navy);
    T(Math.max(ell(x, y, z, 33, -1.6, -7.3, 7.65, 2.65, 2.65), Math.abs(y - 0.6) - 0.15), ID.boatred);
    T(box(x, y, z, 31.5, 1.9, -7.3, 1.6, 0.9, 1.3), ID.bone); T(box(x, y, z, 31.5, 2.0, -6.0, 0.4, 0.3, 0.03), ID.windowdim); T(cyl(x, y, z, 34.2, 3.2, -7.3, 0.35, 1.8), ID.tar);
    T(cap(x, y, z, [28.2, 1.0, -5.0], [26.6, M.y + 0.05, M.z0 + 0.1], 0.08), ID.timber);
  }));
  L.push({ pos: [31.5, 2.0, -5.6], type: 1, I: 3, cone: [0, 0, 1], mode: 2, reach: 8, group: "window", key: "ferry_wheelhouse" });
  // Mother: the great lamp at the mole's end, swollen head, goitred neck, the KEEPER door
  const [MX, , MZ] = MOTHER;
  add(K.shape([MX - 3.4, M.y, MZ - 3.4, MX + 3.4, 15.2, MZ + 3.4], (x, y, z, T) => {
    const yy = y - M.y, r = 1.5 - 0.06 * Math.max(0, yy) + 0.55 * Math.exp(-((yy - 6.3) ** 2) / 1.2) + 0.25 * Math.exp(-((yy - 2) ** 2) / 3);
    T(Math.max(Math.hypot(x - MX, z - MZ) - r, yy - 9.4, -yy - 0.4) * 0.8, yy > 6.9 && yy < 7.6 ? ID.oxblood : ID.tower); T(Math.max(Math.hypot(x - MX, z - MZ) - 1.9, Math.abs(yy - 10.05) - 0.08), ID.brass);
    T(cyl(x, y, z, MX, M.y + 9.55, MZ, 1.75, 0.12), ID.iron); T(K.railing ? Math.max(Math.abs(Math.hypot(x - MX, z - MZ) - 1.7) - 0.03, Math.abs(y - M.y - 10.3) - 0.03) : 1, ID.iron);
    T(ell(x, y, z, MX + 0.15, M.y + 11.2, MZ, 1.85, 1.75, 1.8) + 0.04 * vnoise(y * 9, (x + z) * 9), ID.lens);
    T(Math.max(ell(x, y, z, MX, M.y + 12.4, MZ, 1.15, 1.2, 1.15), M.y + 12.4 - y), ID.dome); T(cap(x, y, z, [MX, M.y + 13.5, MZ], [MX + 0.1, M.y + 14.4, MZ - 0.1], 0.05), ID.iron);
    T(box(x, y, z, MX - 1.47, M.y + 0.95, MZ + 0.5, 0.06, 0.95, 0.45), ID.rust); T(box(x, y, z, MX - 1.53, M.y + 1.75, MZ + 0.5, 0.02, 0.08, 0.2), ID.brass); // the KEEPER door
    T(sph(x, y, z, MX - 1.55, M.y + 2.25, MZ + 0.5, 0.06), ID.lantern); // the red pilot
  }));
  marks.lamps.push({ id: "mother_lens", kind: "beam", at: [MX + 0.15, M.y + 11.2, MZ] }, { id: "mother_pilot", kind: "pilot", at: [MX - 1.55, M.y + 2.25, MZ + 0.5] });
  spot("keeper_door", "pry", [MX - 1.9, M.y, MZ + 0.5], "the scab-coloured KEEPER door (M:238)");

  // ---- by day: washing across the street in reds; Merrow's boat on the mud by the mole steps, his net
  if (!night) {
    for (const [hx, px] of [[-21.3, -17], [-13.0, -10], [6.0, 3.5], [14.2, 10.5], [-27.6, -24]]) add(K.washing([hx, 6.6, ROW_Z + 0.1], [px, 4.3, -0.85], 7, Math.round(hx)));
    add(K.beachedBoat(24.2, floorY(24.2, 3.0), 3.0, 0.6, 2.4, 0.05, ID.boatred, false)); add(K.netHeap(22.6, floorY(22.6, 4.6), 4.6, 0.7, 11));
    spot("merrows_boat", "talk", [23.4, FLOOR, 3.8], "Merrow's boat on the mud like a hat on a table, mending a wet grey net (D:183)");
  }
  // ---- the harbour floor at low water
  floorProps(W, add, { night, marks, spot, hide });
  return { world: W.build(), lights: (V) => lightsFor(L, V), marks, lightList: L };
}

function floorProps(W, add, { night, marks, spot, hide }) {
  const at = (x, z) => [x, floorY(x, z), z];
  // the ribs of the Margery Dole, black and furred with weed; the hand line rib to rib
  add(K.shape([-19.5, FLOOR - 0.5, 4.5, -12.5, FLOOR + 2.4, 9.5], (x, y, z, T) => { for (let k = 0; k < 7; k++) { const rx = -18.8 + k * 0.95, a = 0.25 * Math.sin(k); T(cap(x, y, z, [rx, FLOOR - 0.2, 5 + a], [rx + 0.25, FLOOR + 1.6 + 0.4 * Math.sin(k * 1.7), 6.6 + a], 0.1), ID.weedrock); T(cap(x, y, z, [rx, FLOOR - 0.2, 9 - a], [rx + 0.25, FLOOR + 1.3 + 0.3 * Math.cos(k), 7.6 - a], 0.1), ID.weedrock); } T(cap(x, y, z, [-19, FLOOR - 0.05, 7.1], [-12.9, FLOOR + 0.05, 7.1], 0.18), ID.weedrock); }));
  add(K.rope([-18.6, FLOOR + 1.2, 6.5], [-13.2, FLOOR + 1.1, 6.6], 0.35, 0.02));
  spot("hand_line", "rig", [-16, FLOOR, 6.5], "floor.handline: rib to rib, a bannister for the sea (F:309)"); spot("tin_box", "salvage", [-15.2, FLOOR, 7.8], "the tin box between the ribs (F:284)");
  // the stranded fish, the size of a cart, a painted sign with a candle at its head
  const fx = -7.6, fz = 8.2, fy = floorY(fx, fz);
  add(K.shape([fx - 5, fy - 0.4, fz - 3.5, fx + 5, fy + 2.6, fz + 3.5], (x, y, z, T) => {
    const ca = Math.cos(0.5), sa = Math.sin(0.5), lx = (x - fx) * ca - (z - fz) * sa, lz = (x - fx) * sa + (z - fz) * ca, ly = y - fy - 0.55;
    let b = ell(lx, ly, lz, 0, 0.25, 0, 3.8, 1.15, 1.6); b = Math.min(b, Math.max(Math.abs(lz) - 0.07, Math.abs(lx - 4.3) + Math.abs(ly - 0.25) * 0.8 - 1.3) * 0.8); b = Math.min(b, Math.max(Math.abs(lz) - 0.05, Math.abs(lx + 0.3) * 1.2 + Math.abs(ly - 1.45) - 0.8) * 0.8);
    T(b, ID.fish); T(sph(lx, ly, lz, -2.8, 0.4, 1.12, 0.3), ID.porthole);
  }));
  add(K.shape([fx - 4.6, fy, fz - 2.6, fx - 3.6, fy + 1.4, fz - 1.6], (x, y, z, T) => { T(cyl(x, y, z, fx - 4.1, fy + 0.5, fz - 2.1, 0.04, 0.5), ID.timber); T(box(x, y, z, fx - 4.1, fy + 1.0, fz - 2.1, 0.4, 0.25, 0.03), ID.sign); }));
  if (night) add(K.candle(fx - 4.1, fy, fz - 1.8, 0.2, true, 4));
  hide("fish_lee", [fx + 0.5, fy, fz - 2.4], 0.9, "the lee of the fish");
  // the drowned lamp, leaning out of the mud like a tooth, the hole toward the quay, a nail for a lantern
  const dx = -13, dz = 11, dy = floorY(dx, dz);
  add(K.shape([dx - 3, dy - 1, dz - 3, dx + 3, dy + 5, dz + 3], (x, y, z, T) => {
    const ca = Math.cos(-0.22), sa = Math.sin(-0.22), lx = x - dx, ly = y - dy, rx = lx * ca - ly * sa, ry = lx * sa + ly * ca;
    const tower = Math.max(Math.hypot(rx, z - dz) - (1.35 - 0.05 * ry), ry - 3.8 - 0.5 * vnoise(rx * 3, z * 3), -ry - 1) * 0.85, hole = box(rx, ry, z, 0, 0.7, dz + 1.25, 0.45, 0.65, 0.6);
    T(Math.max(tower, -hole), ID.wall); T(box(rx, ry, z, 0, 0.12, dz + 0.6, 0.4, 0.06, 0.5), ID.pool);
    for (let k = 0; k < 9; k++) { const a = k * 0.7, rr = 1.6 + 0.6 * rnd(k, 3); T(sph(x, y, z, dx + Math.cos(a) * rr, dy + 0.05, dz + Math.sin(a) * rr, 0.22 + 0.15 * rnd(k)), ID.weedrock); } // the rubble skirt
    T(cap(rx, ry, z, [0.6, 2.0, dz + 1.33], [0.6, 2.0, dz + 1.5], 0.02), ID.iron);
  }));
  spot("drowned_nail", "light", [dx + 0.6, dy, dz + 1.8], "l.drowned: the nail for a lantern (F:629)"); spot("drowned_hole", "climb", [dx, dy, dz + 1.6], "the hole, a stone throat (F:886)");
  // the stranded boat, heeled; Lugg's rope across the gully; the stake at the lip
  add(K.beachedBoat(8, floorY(8, 6.5), 6.5, 0.2, 3.4, 0.35)); hide("boat_lee", [8.2, floorY(8, 5), 5.0], 0.8, "the lee of the stranded boat");
  add(K.rope([3.2, floorY(3.2, 6.6) + 0.9, 6.6], [6.0, floorY(6, 9.6) + 0.9, 9.6], 0.3, 0.02)); for (const [px, pz] of [[3.2, 6.6], [6.0, 9.6]]) add(K.shape([px - 0.2, floorY(px, pz) - 0.3, pz - 0.2, px + 0.2, floorY(px, pz) + 1.2, pz + 0.2], (x, y, z, T) => T(cyl(x, y, z, px, floorY(px, pz) + 0.45, pz, 0.06, 0.75), ID.timber)));
  spot("lugg_rope", "wade", [4.6, FLOOR, 8.1], "Lugg's rope across the gully (F:428)");
  marks.paths.push({ id: "gully", pts: GULLY.map(([x, z]) => [x, floorY(x, z), z]), note: "the gully, ankle-deep at low water, knee by 23:50" });
  // Nan Cockle's shingle bar and scattered stones; lanterns standing upside down in the pools
  add(K.shape([10, FLOOR - 0.6, 12.5, 18, FLOOR + 0.4, 16.5], (x, y, z, T) => T(ell(x, y, z, 14, floorY(14, 14.5) - 0.15, 14.5, 3.8, 0.4, 1.6) + 0.04 * vnoise(x * 8, z * 8), ID.shingle)));
  // more of the floor: rows of old mooring stakes, rocks with weed, lobster pots, a sunk cart, a second wreck's keel
  for (let k = 0; k < 9; k++) { const sx = -4 + k * 1.6, sz = 13.5 + 0.4 * Math.sin(k), sy = floorY(sx, sz); add(K.shape([sx - 0.2, sy - 0.2, sz - 0.2, sx + 0.2, sy + 1.6, sz + 0.2], (x, y, z, T) => T(cyl(x, y, z, sx, sy + 0.5 + 0.25 * rnd(k), sz, 0.11, 0.6 + 0.25 * rnd(k)), ID.weedrock))); }
  for (let k = 0; k < 18; k++) { const rx = -22 + 40 * rnd(k, 71), rz = 3 + 17 * rnd(k, 72), ry = floorY(rx, rz), rr = 0.3 + 0.5 * rnd(k, 73); if (Math.abs(rx + 7.6) < 5 && Math.abs(rz - 8.2) < 3.5) continue; add(K.shape([rx - rr - 0.1, ry - rr, rz - rr - 0.1, rx + rr + 0.1, ry + rr, rz + rr + 0.1], (x, y, z, T) => T(ell(x, y, z, rx, ry, rz, rr, rr * 0.55, rr * 0.8) + 0.05 * vnoise(x * 7, z * 7), rnd(k, 74) < 0.5 ? ID.weedrock : ID.wall))); }
  for (const [px, pz] of [[-9.8, 12.6], [-9.0, 13.2], [6.6, 15.8]]) { const py = floorY(px, pz); add(K.shape([px - 0.4, py - 0.1, pz - 0.4, px + 0.4, py + 0.5, pz + 0.4], (x, y, z, T) => { T(Math.max(cyl(x, y, z, px, py + 0.22, pz, 0.3, 0.22), -cyl(x, y, z, px, py + 0.3, pz, 0.26, 0.22)), ID.net); T(Math.max(Math.abs(Math.hypot(x - px, y - py - 0.22) - 0.3) - 0.02, Math.abs(z - pz) - 0.3), ID.timber); })); }
  add(K.shape([16, FLOOR - 0.6, 6, 24, FLOOR + 1.0, 9], (x, y, z, T) => { T(cap(x, y, z, [16.5, floorY(16.5, 7.5) + 0.1, 7.5], [23.5, floorY(23.5, 7.5) + 0.3, 7.8], 0.25), ID.weedrock); for (let k = 0; k < 6; k++) { const rx = 17 + k * 1.1; T(cap(x, y, z, [rx, FLOOR - 0.1, 7.6], [rx + 0.2, FLOOR + 0.9 - 0.1 * k, 6.6], 0.08), ID.weedrock); } }));
  if (night) for (const [lx, lz] of [[-5.5, 5.0], [-2.6, 10.2], [2.4, 4.6], [-10.2, 4.8], [12.4, 9.6], [-20.5, 11.5]]) {
    const ly = floorY(lx, lz); add({ bb: [lx - 0.3, ly - 0.2, lz - 0.3, lx + 0.3, ly + 0.6, lz + 0.3], light: { pos: [lx, ly + 0.35, lz], type: 1, I: 5.5, reach: 10, group: "lantern" }, f: (x, y, z, T) => { T(Math.max(box(x, y, z, lx, ly + 0.2, lz, 0.13, 0.19, 0.13), -box(x, y, z, lx, ly + 0.2, lz, 0.1, 0.16, 0.2), -box(x, y, z, lx, ly + 0.2, lz, 0.2, 0.16, 0.1)), ID.iron); T(ell(x, y, z, lx, ly + 0.22, lz, 0.08, 0.12, 0.08), ID.lantern); } });
  }
}

// The variant's lights: groups switched or dimmed by V.emit; the moon and sky as the ambient half.
function lightsFor(L, V = {}) {
  const out = [];
  for (const l of L) { const f = V.emit && l.group in V.emit ? V.emit[l.group] : 1; if (f > 0) out.push({ ...l, I: l.I * f }); }
  if (V.moon) out.push({ pos: V.moon.pos || [90, 70, 120], type: 2, I: V.moon.I || 9000, reach: 400, key: "moon", soft: 30 });
  if (V.sun) out.push({ pos: V.sun.pos, type: 3, I: V.sun.I, reach: 600, key: "sun", soft: 40 }, ...(V.sun.fill ? [{ pos: V.sun.fill, type: 3, I: V.sun.I * 0.18, reach: 600, key: "skyfill", soft: 4 }] : []));
  return out;
}
