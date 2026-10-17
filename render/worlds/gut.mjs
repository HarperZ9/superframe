// The Gut: "a lane the width of an argument", smokehouses leaning in on both sides, brine vats along
// both walls, eels hung over it in strings, the stone gutter down its middle glowing in slow violet
// bands, paraffin lamps on wires each behind its own colour of glass (every other one dark), Spratt's
// stall (a plank on two barrels under a smokehouse overhang), Shadwell's red fire-door and his soot
// board, the Guild hall's amber door, the Low Company's net loft up its outside ladder, the back wall
// with brackets over Shadwell's gurry bin, the midden yard and its gate, the lookouts' fish boxes at
// the lane's mouth onto the quay, and the culvert's brick mouth at the low end. Lane along x; the
// quay is at +x. Original block-out (Low Water look work).
import { box, cyl, sph, cap, gable, lean, vnoise, fbm, sat } from "../sdf.mjs";
import { makeWorld, rnd } from "../kit/world.mjs";
import { ID } from "../kit/ids.mjs";
import * as K from "../kit/props.mjs";

export const WIRES = [-11, -7, -3, 1, 5, 9, 13];
export function gut({ frozen = false, day = false } = {}) {
  const W = makeWorld({ cell: 2, margin: 0.5 }), L = [], marks = { spots: [], hides: [], exits: [], lamps: [] };
  const add = (p) => W.add(p), spot = (id, verb, at, note) => marks.spots.push({ id, verb, at, note }), hide = (id, at, r, note) => marks.hides.push({ id, at, r, note });
  const laneY = (x) => 0.03 * (x - 14); // the lane falls toward the culvert end
  W.ground((x, y, z, T) => {
    const ly = laneY(x), g = Math.max(Math.abs(z - 0.25 * Math.sin(x * 0.35)) - 0.42, -(y - ly + 0.16));
    T(Math.max(y - ly, -g), ID.cobble); T(y - ly + 0.1, frozen ? ID.ice : ID.gutter);
    T(Math.max(Math.abs(z - 0.25 * Math.sin(x * 0.35)) - 0.55, Math.abs(y - ly - 0.03) - 0.05, -(Math.abs(z - 0.25 * Math.sin(x * 0.35)) - 0.42)), ID.slab); // the trough's lip
  });
  // the town beyond, roofs only, so the lane sits in a packed district
  W.ground((x, y, z, T) => {
    if (Math.abs(z) < 5.5 || z > 0) return; // roofs beyond the far side only; the near side stays open ground
    const cx = Math.floor((x + 40) / 3.4), cz = Math.floor((Math.abs(z) - 5.5) / 3.6), cxc = -40 + 3.4 * (cx + 0.5), czc = Math.sign(z) * (5.5 + 3.6 * (cz + 0.5)), hh = (z < 0 ? 2.6 : 0.6) + 1.2 * rnd(cx, cz);
    if (cz < 4) { T(box(x, y, z, cxc, hh / 2, czc, 1.6, hh / 2, 1.7) * 0.8, ID.brickdark); if (z < 0) { T(gable(x, y, z, cxc, hh, czc, 1.7, 1.8, 1.1) * 0.8, ID.roof); if (rnd(cx, cz, 4) < 0.3) T(box(x, y, z, cxc + 0.5, hh * 0.55, czc + 1.72, 0.25, 0.3, 0.03), ID.window); } }
    const bx = Math.min(x - (-40 + 3.4 * cx), -40 + 3.4 * (cx + 1) - x), bz = Math.min((Math.abs(z) - 5.5) - 3.6 * cz, 3.6 * (cz + 1) - (Math.abs(z) - 5.5));
    T(Math.max(0.04, Math.min(bx, bz) + 0.04), 0);
  });
  // smokehouses and houses both sides, leaning into the lane; doors and fire-doors
  const doors = [];
  for (const side of [-1, 1]) for (let k = 0; k < 7; k++) {
    const cx = -13 + k * 4.4 + (side > 0 ? 1.2 : 0), w = 2.0 + 0.2 * rnd(k, side), h = side > 0 ? 1.0 : 3.8 + 1.6 * rnd(k, side, 2), cz = side * (1.75 + 1.8), kk = -side * (0.05 + 0.03 * rnd(k, side, 3)), seed = k * 7 + (side > 0 ? 3 : 0);
    if (side > 0 && (k === 3 || k === 4)) continue; // the midden yard opens here
    const doorKind = side < 0 && k === 2 ? ID.red : side < 0 && k === 4 ? ID.oxblood : side > 0 && k === 5 ? ID.green : ID.tar;
    doors.push([cx, cz - side * 1.8, side, doorKind]);
    add(K.shape([cx - w - 1.2, 0, cz - 2.6, cx + w + 1.2, h + 4.5, cz + 2.6], (x, y, z, T) => {
      const lx = lean(x, y, 0.5, 0) , lz = z + Math.max(0, y - 0.5) * kk * side * -1;
      if (side < 0) T(box(lx, y, lz, cx, h / 2, cz, w, h / 2, 1.8), k === 4 ? ID.brick : ID.brickdark); else { T(box(lx, y, lz, cx, h / 2, cz - 1.6, w, h / 2, 0.2), ID.brickdark); T(box(lx, y, lz, cx, 0.02, cz, w, 0.02, 1.8), ID.boards); }
      if (side < 0) { T(gable(lx, y, lz, cx, h, cz, w + 0.2, 2.0, 1.1), ID.roof); T(cap(lx, y, lz, [cx + 0.6, h + 0.9, cz + side * 0.6], [cx + 0.2, h + 3.4, cz + side * 0.9], 0.3), ID.chimney); }
      const fz = cz - side * 1.8;
      T(box(lx, y, lz, cx - 0.4, Math.min(1.0, h / 2), fz - side * 0.02, 0.55, Math.min(1.0, h / 2), 0.05), doorKind === ID.tar ? ID.tar : doorKind);
      if (side < 0 && rnd(seed, 5) < 0.45) T(box(lx, y, lz, cx + 1.0, 1.7, fz - side * 0.02, 0.3, 0.35, 0.04), rnd(seed, 6) < 0.5 ? ID.window : ID.windowdim);
      // a smokehouse overhang with its rail
      if (side < 0 && rnd(seed, 7) < 0.5) T(box(lx, y, lz, cx, 2.5, fz - side * 0.5, w * 0.8, 0.05, 0.5), ID.timber);
    }));
  }
  // brine vats along both walls; Spratt's stall; fish boxes for the lookouts at the mouth
  for (const [vx, vz] of [[-9.5, 1.45], [-4.2, -1.4], [2.8, 1.45], [7.6, -1.45], [11.0, 1.45]]) add(K.shape([vx - 0.8, laneY(vx) - 0.1, vz - 0.8, vx + 0.8, laneY(vx) + 1.1, vz + 0.8], (x, y, z, T) => { const b = laneY(vx); T(Math.max(cyl(x, y, z, vx, b + 0.45, vz, 0.55, 0.45), -cyl(x, y, z, vx, b + 0.7, vz, 0.48, 0.45)), ID.barrel); T(cyl(x, y, z, vx, b + 0.45, vz, 0.48, 0.32), frozen ? ID.ice : ID.gutter); }));
  add(K.shape([-1.2, laneY(-0.5), -1.75, 0.6, laneY(-0.5) + 1.4, -0.7], (x, y, z, T) => { const b = laneY(-0.3); T(box(x, y, z, -0.3, b + 0.82, -1.25, 0.85, 0.04, 0.32), ID.plank); for (const s of [-1, 1]) T(cyl(x, y, z, -0.3 + s * 0.6, b + 0.4, -1.25, 0.25, 0.4), ID.barrel); for (let k = 0; k < 4; k++) T(box(x, y, z, -0.85 + k * 0.35, b + 0.9, -1.2, 0.12, 0.04, 0.05), ID.fish); }));
  spot("spratt_stall", "talk", [-0.3, 0, -0.6], "Spratt's stall, a plank on two barrels under an overhang (G:263)");
  for (let k = 0; k < 5; k++) add(K.fishbox(12.6 + (k % 2) * 0.9, laneY(13) + (k >= 3 ? 0.27 : 0), -1.3 + (k % 3) * 0.12, 0.2 * k, k % 2 === 0));
  hide("mouth_boxes", [12.8, 0, -0.6], 0.5, "behind the lookouts' fish boxes at the lane's mouth (G:122)");
  for (let k = 0; k < 8; k++) { const cx = -12 + k * 3.3 + rnd(k, 9), side = k % 2 ? 1 : -1; add(rnd(k, 8) < 0.5 ? K.crateStack(cx, laneY(cx), side * 1.35, 2 + (k % 3), 50 + k, 0.1 * k) : K.netHeap(cx, laneY(cx), side * 1.3, 0.55, k)); }
  // eel strings over the lane between the houses
  for (const ex of [-12, -8.6, -5.2, -1.8, 3.6, 7, 10.4]) add(K.shape([ex - 0.4, laneY(ex) + 1.6, -1.8, ex + 0.4, laneY(ex) + 3.8, 1.8], (x, y, z, T) => { const b = laneY(ex); T(cap(x, y, z, [ex, b + 3.6, -1.75], [ex + 0.15, b + 3.5, 1.75], 0.02), ID.rope); for (let j = 0; j < 9; j++) { const ez = -1.5 + j * 0.37, len = 0.9 + 0.6 * rnd(j, ex); T(cap(x, y, z, [ex + 0.02 * j, b + 3.55, ez], [ex + 0.05 * j + 0.08 * Math.sin(j), b + 3.55 - len, ez], 0.06 - 0.015 * (j % 2)), ID.fish); } }));
  // by day: Shadwell's rails of smoked fish out by his door, gold with a blush under the gold
  if (day) add(K.shape([-6.0, 0, -1.7, -3.4, 2.2, -0.9], (x, y, z, T) => { const b = laneY(-4.7); for (const ry of [1.2, 1.7]) { T(cap(x, y, z, [-5.8, b + ry, -1.3], [-3.6, b + ry, -1.3], 0.02), ID.iron); for (let k = 0; k < 8; k++) T(cap(x, y, z, [-5.6 + k * 0.28, b + ry - 0.02, -1.3], [-5.6 + k * 0.28, b + ry - 0.42, -1.3 + 0.03 * Math.sin(k)], 0.05), ID.brass); } for (const sx of [-5.9, -3.5]) T(cap(x, y, z, [sx, b, -1.3], [sx, b + 1.8, -1.3], 0.03), ID.timber); }));
  // the wire lamps, every other one dark until rigged; each behind its own colour of glass
  WIRES.forEach((wx, k) => { const b = laneY(wx); add(K.shape([wx - 0.3, b + 3.2, -1.9, wx + 0.3, b + 4.6, 1.9], (x, y, z, T) => { T(cap(x, y, z, [wx, b + 4.5, -1.75], [wx, b + 4.4, 1.75], 0.015), ID.iron); T(cap(x, y, z, [wx, b + 4.4, 0], [wx, b + 4.0, 0], 0.012), ID.iron); T(sph(x, y, z, wx, b + 3.85, 0, 0.17), k % 2 ? ID.glass : ID.lantern); })); L.push({ pos: [wx, b + 3.8, 0], lit: k % 2 === 0, colour: ["red", "amber", "green", "blue"][k % 4] }); });
  spot("gut_wires", "rig", [1, 0, 0], "l.gut_wires: rig the dark lamps with copper through the pulleys (G:1265)");
  // Shadwell's soot board and gurry bin; the back wall's brackets; the net loft ladder and hatch
  add(K.shape([-5.8, 0, -2.0, -3.6, 3.4, -1.6], (x, y, z, T) => { const b = laneY(-4.6); T(box(x, y, z, -4.0, b + 1.4, -1.78, 0.35, 0.5, 0.03), ID.limewash); T(box(x, y, z, -5.2, b + 0.4, -1.4, 0.45, 0.4, 0.3), ID.iron); }));
  spot("soot_board", "read", [-4.0, 0, -1.2], "Shadwell's whitewashed soot board by the door (G:800)"); spot("gurry_bin", "climb", [-5.2, 0, -1.0], "the gurry bin under the back wall's brackets (G:151)");
  add(K.ladder([6.3, laneY(6.3), -1.6], [6.3, laneY(6.3) + 4.2, -1.85], Math.PI / 2)); add(K.shape([5.6, 3.6, -1.9, 7.0, 4.8, -1.7], (x, y, z, T) => T(box(x, y, z, 6.3, laneY(6.3) + 4.4, -1.82, 0.5, 0.5, 0.04), ID.timber)));
  spot("loft_ladder", "climb", [6.3, 0, -1.2], "the Low Company's net loft, up the outside ladder (G:233)");
  // the midden yard through its gate (the dogs' fight ground): fish boxes, the gurry heap
  add(K.shape([1.6, 0, 1.7, 6.2, 1.6, 6.5], (x, y, z, T) => { const b = laneY(4); T(Math.max(box(x, y, z, 3.9, b + 0.45, 4.4, 2.2, 0.45, 2.0), -box(x, y, z, 3.9, b + 0.7, 4.4, 2.05, 0.9, 1.85), -box(x, y, z, 3.9, b + 0.6, 2.4, 0.7, 0.8, 0.3)), ID.brick); T(Math.max(y - b - 0.6 * Math.exp(-((x - 4.6) ** 2 + (z - 5.3) ** 2) / 0.6), -y + b - 0.1, Math.hypot(x - 4.6, z - 5.3) - 1.4), ID.weed); }));
  for (let k = 0; k < 4; k++) add(K.fishbox(2.6 + k * 0.7, laneY(4), 3.6 + (k % 2) * 1.4, k * 0.5, false));
  marks.exits.push({ id: "quay", at: [14, 0, 0], note: "the mouth of the Gut onto the quay" }, { id: "midden", at: [3.9, 0, 2.4], note: "the midden yard gate" }, { id: "culvert", at: [-14, 0, 0], note: "the culvert, a brick mouth under the quay (G:1588)" });
  add(K.shape([-15.5, -1, -1.5, -13.5, 1.6, 1.5], (x, y, z, T) => { const b = laneY(-14.5); T(Math.max(box(x, y, z, -14.8, b + 0.6, 0, 0.5, 1.2, 1.4), -box(x, y, z, -14.6, b + 0.2, 0, 0.6, 0.75, 0.6)), ID.brick); T(box(x, y, z, -14.95, b + 0.2, 0, 0.05, 0.75, 0.6), ID.coal); for (let j = -2; j <= 2; j++) T(box(x, y, z, -14.3, b + 0.2, j * 0.25, 0.03, 0.75, 0.02), ID.iron); }));
  spot("culvert_grating", "pry", [-14, 0, 0], "the culvert grating, at low water (G:1591)");
  hide("smoke", [-4.6, 0, -0.6], 0.8, "Shadwell's smoke, carried downwind (G:1563)"); hide("overhang", [-0.3, 0, -1.3], 0.5, "under Spratt's overhang");
  return { world: W.build(), lamps: L, marks, laneY };
}
