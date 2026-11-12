// Inside the Brine: a boat turned over on the quay and made into a public house. The keel is the
// ridge of the ceiling and the ribs come down to the floor; the near side is cut away for the
// camera. A bar with jars and bottles, a stove, the bread oven in the far wall, tables, a stack of
// green empties to the ceiling, paraffin lamps. People are drawn by the game.
import { box, rbox, cyl, sph, ell, cap, vnoise, fbm } from "../sdf.mjs";

export const ID = { floor: 1, hull: 2, rib: 3, bar: 4, top: 5, shelf: 6, jar: 7, bottle: 8, stove: 9, stoveDoor: 10, oven: 11, ovenDoor: 12, table: 13, stool: 14, lamp: 15, porthole: 16, door: 17, stack: 18, slate: 19, pipe: 20, keel: 21, rug: 22, clock: 23 };
let cur = 0; export const idOf = () => cur;
const RX = 7.2, RY = 4.2, RZ = 3.6;   // the hull's half-axes (x along the boat)

export function map(x, y, z) {
  let d = Infinity, id = 0;
  const T = (t, i) => { if (t < d) { d = t; id = i; } };
  const foot = (Math.hypot(x / RX, z / RZ) - 0.98) * Math.min(RX, RZ);
  T(Math.max(y, foot), ID.floor);
  T(Math.max(box(x, y, z, -0.5, 0.01, 0.6, 2.6, 0.012, 1.4), -0.0), ID.rug);
  // the hull, seen from inside: the inner surface of an ellipsoid shell, cut away on the camera side
  const e = (Math.hypot(x / RX, y / RY, z / RZ) - 1) * Math.min(RX, RY, RZ), shell = Math.max(-e, e - 0.25);
  const cut = (x + z * 1.8) - 2.2;   // remove the half nearest the camera
  T(Math.max(shell, cut, -y, y - 3.0), ID.hull);
  // ribs every 1.2 m and the keel along the ridge
  { const rx = ((x % 1.2) + 1.8) % 1.2 - 0.6; T(Math.max(Math.abs(rx) - 0.09, Math.max(-e - 0.0, e - 0.0) - 0.05 - 0.12, cut, -y, y - 3.0) * 0.9, ID.rib); }
  // portholes in the far side
  for (const px of [-4.6, -1.8, 1.2, 4.0]) T(Math.max(Math.hypot(x - px, y - 2.3) - 0.36, Math.abs(z + 3.3) - 0.4), ID.porthole);
  // the bar along the far side, its top, shelves of jars and bottles behind
  T(rbox(x, y, z, 0.6, 0.55, -1.6, 2.8, 0.55, 0.45, 0.04), ID.bar); T(box(x, y, z, 0.6, 1.13, -1.55, 2.95, 0.04, 0.55), ID.top);
  for (const sy of [1.6, 2.15]) T(box(x, y, z, 0.6, sy, -2.75, 2.6, 0.03, 0.22), ID.shelf);
  for (let k = 0; k < 14; k++) { const jx = -1.8 + k * 0.36, sy = k % 2 ? 1.6 : 2.15;
    if (k % 3 === 0) T(cyl(x, y, z, jx, sy + 0.2, -2.72, 0.12, 0.17), ID.jar); else T(Math.min(cyl(x, y, z, jx, sy + 0.17, -2.72, 0.06, 0.14), cyl(x, y, z, jx, sy + 0.38, -2.72, 0.022, 0.08)), ID.bottle); }
  T(box(x, y, z, -1.6, 1.55, -2.92, 0.5, 0.36, 0.03), ID.slate);
  T(cyl(x, z, y, 2.6, -2.93, 2.55, 0.28, 0.04), ID.clock);
  // the stove and its pipe, the bread oven in the far wall
  T(cyl(x, y, z, -4.4, 0.55, -0.9, 0.45, 0.55), ID.stove); T(box(x, y, z, -4.0, 0.45, -0.7, 0.04, 0.18, 0.2), ID.stoveDoor);
  T(cap(x, y, z, [-4.4, 1.1, -0.9], [-4.4, 3.6, -1.4], 0.1), ID.pipe);
  T(box(x, y, z, 3.6, 1.0, -2.6, 0.75, 0.65, 0.4), ID.oven); T(box(x, y, z, 3.6, 0.95, -2.18, 0.42, 0.3, 0.03), ID.ovenDoor);
  // tables and stools
  for (const [tx, tz] of [[-2.2, 1.0], [1.6, 1.4]]) { T(cyl(x, y, z, tx, 0.78, tz, 0.6, 0.04), ID.table); T(cyl(x, y, z, tx, 0.38, tz, 0.07, 0.38), ID.table);
    for (const a of [0.5, 2.6, 4.4]) T(cyl(x, y, z, tx + Math.cos(a) * 0.95, 0.25, tz + Math.sin(a) * 0.95, 0.2, 0.25), ID.stool); }
  // the stack of empties in the corner, all green
  { const lb = Math.hypot(x + 5.6, z + 1.8) - 1.3; if (lb < 0.3 && y < 3.4) { const bx = Math.round((x + 5.6) / 0.16) * 0.16 - 5.6, bz = Math.round((z + 1.8) / 0.16) * 0.16 - 1.8, by = Math.round((y - 0.11) / 0.24) * 0.24 + 0.11;
      if (Math.hypot(bx + 5.6, bz + 1.8) < 0.9 - by * 0.15 && by < 3.2) T(Math.max(cyl(x, y, z, bx, by, bz, 0.065, 0.11), Math.hypot(bx + 5.6, bz + 1.8) - 2), ID.stack); else T(Math.max(lb, 0.03), 0);
      if (d > 0.08) d = Math.min(d, 0.08); } else if (lb < d) d = lb; }
  // hanging lamps and the door on the quay side
  for (const [lx, lz] of [[-1.6, -0.6], [2.0, 0.2]]) { T(cap(x, y, z, [lx, 3.0, lz], [lx, 2.75, lz], 0.015), ID.pipe); T(sph(x, y, z, lx, 2.6, lz, 0.17), ID.lamp); }
  T(box(x, y, z, 5.6, 1.05, 1.4, 0.06, 1.05, 0.6), ID.door);
  cur = id; return d;
}
export const materials = [{ name: "lw tar", flat: 0.035 }, { name: "lw bone", q: [0, 2, -0.1], peak: 0.72 }, { name: "lw oxblood", q: [0, 10, -6.0], peak: 0.55 }, { name: "lw mustard", q: [0, 13, -5.2], peak: 0.62 },
  { name: "lw wood", q: [0, 6, -3.2], peak: 0.35 }, { name: "lw bottle", q: [-60, 45, -6.94], peak: 0.55 }, { name: "lw teal", q: [-50, 27.5, -2.58], peak: 0.5 }, { name: "lw brass", q: [0, 10, -4.4], peak: 0.7 }];
const S = (mat, scale = 1, wet = 0, emit = null) => ({ mat, scale, wet, emit });
export function surf(id, P) {
  const n = fbm(P[0] * 2.2 + P[1], P[2] * 2.2);
  switch (id) {
    case ID.floor: return S("lw wood", 0.7 + 0.5 * n, 0.15); case ID.rug: return S("lw oxblood", 0.8 + 0.3 * n);
    case ID.hull: return S("lw wood", 0.45 + 0.3 * n); case ID.rib: case ID.keel: return S("lw wood", 0.7 + 0.3 * n);
    case ID.bar: return S("lw oxblood", 0.7 + 0.2 * n); case ID.top: return S("lw brass", 0.7, 0.6); case ID.shelf: return S("lw wood", 0.9);
    case ID.jar: return S("lw mustard", 1.1, 0.8); case ID.bottle: case ID.stack: return S("lw bottle", 1.2, 0.8);
    case ID.stove: case ID.pipe: return S("lw tar", 3); case ID.stoveDoor: return S("grey", 0, 0, { type: "window", I: 14 });
    case ID.oven: return S("brick", 0.8); case ID.ovenDoor: return S("grey", 0, 0, { type: "window", I: 9 });
    case ID.table: case ID.stool: return S("lw wood", 1.0); case ID.lamp: return S("grey", 0, 0, { type: "window", I: 40 });
    case ID.porthole: return S("grey", 0, 0, { type: "sodium", I: 3 }); case ID.door: return S("lw teal", 0.8); case ID.slate: return S("lw tar", 2.5); case ID.clock: return S("lw bone", 1);
    default: return S("grey", 1);
  }
}
export function lights() {
  return [
    { pos: [-1.6, 2.45, -0.6], type: 1, I: 32, cone: [0, 0, 0], mode: 0, reach: 14 },
    { pos: [2.0, 2.45, 0.2], type: 1, I: 32, cone: [0, 0, 0], mode: 0, reach: 14 },
    { pos: [-3.85, 0.5, -0.6], type: 1, I: 12, cone: [1, 0, 0.3], mode: 2, reach: 8 },
    { pos: [3.6, 0.95, -2.0], type: 1, I: 3, cone: [0, 0, 1], mode: 2, reach: 6 },
  ];
}
export const sky = () => 0.01;
export default { map, idOf, materials, surf, lights, sky };
