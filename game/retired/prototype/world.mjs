// Lamp Quay as a place to walk: the baked world buffers (position and surface per pixel of the
// painted plate), the plate's camera, a walk grid on the ground, paths, regions and hotspots.
// Browser and Node.
export const ID = { quay: 1, wall: 2, mud: 3, pool: 4, steps: 5, mole: 20, drowned: 31, weed: 34, fish: 33, boat: 25 };
const WALK = new Set([ID.quay, ID.mud, ID.pool, ID.steps, ID.mole]);
export const GRID = { x0: -30, z0: -14, cell: 0.25, nx: 224, nz: 124 };
export const GULLY = { x0: -11.4, x1: -9.4, z0: 3.5, z1: 14 };          // the channel between the floor and the Old Light
export const DROWNED = [-12.5, -3.26, 9.5];

export function makeWorld({ W, H, pos, ids, camera, project, grid = GRID, walk = WALK, gully = true }) {
  const GRID = grid, WALKS = new Set(walk), n = GRID.nx * GRID.nz, height = new Float32Array(n).fill(NaN);
  for (let i = 0; i < W * H; i++) {
    const id = ids[i]; if (!WALKS.has(id)) continue;
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    const gx = Math.floor((x - GRID.x0) / GRID.cell), gz = Math.floor((z - GRID.z0) / GRID.cell);
    if (gx < 0 || gz < 0 || gx >= GRID.nx || gz >= GRID.nz) continue;
    const k = gz * GRID.nx + gx; if (!(height[k] >= y)) height[k] = y;
  }
  // close single-cell holes left by baked people and props seen from above
  const h2 = new Float32Array(height);
  for (let gz = 1; gz < GRID.nz - 1; gz++) for (let gx = 1; gx < GRID.nx - 1; gx++) {
    const k = gz * GRID.nx + gx; if (!isNaN(height[k])) continue;
    const nb = [height[k - 1], height[k + 1], height[k - GRID.nx], height[k + GRID.nx]].filter((v) => !isNaN(v));
    if (nb.length >= 3 && Math.max(...nb) - Math.min(...nb) < 0.3) h2[k] = nb.reduce((a, b) => a + b, 0) / nb.length;
  }
  // the gully runs lower than the floor around it, so it floods first
  for (let gz = 0; gz < GRID.nz; gz++) for (let gx = 0; gx < GRID.nx; gx++) {
    const x = GRID.x0 + (gx + 0.5) * GRID.cell, z = GRID.z0 + (gz + 0.5) * GRID.cell, k = gz * GRID.nx + gx;
    if (gully && x > GULLY.x0 && x < GULLY.x1 && z > GULLY.z0 && z < GULLY.z1 && !isNaN(h2[k]) && h2[k] < -2) h2[k] = -3.4;
  }
  const depth = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) { const y = pos[i * 3 + 1]; depth[i] = y > 900 ? 1e4 : (pos[i * 3] - camera.pos[0]) * camera.fwd[0] + (y - camera.pos[1]) * camera.fwd[1] + (pos[i * 3 + 2] - camera.pos[2]) * camera.fwd[2]; }
  const world = { W, H, pos, ids, camera, project, height: h2, depth, grid: GRID, hasGully: gully };
  world.cellOf = (x, z) => [Math.floor((x - GRID.x0) / GRID.cell), Math.floor((z - GRID.z0) / GRID.cell)];
  world.groundAt = (x, z) => { const [gx, gz] = world.cellOf(x, z); if (gx < 0 || gz < 0 || gx >= GRID.nx || gz >= GRID.nz) return NaN; return h2[gz * GRID.nx + gx]; };
  world.inGully = (x, z) => gully && x > GULLY.x0 && x < GULLY.x1 && z > GULLY.z0 && z < GULLY.z1;
  // What is under a pixel of the plate.
  world.at = (px, py) => { const x = Math.round(px), y = Math.round(py); if (x < 0 || y < 0 || x >= W || y >= H) return null; const i = y * W + x; return { id: ids[i], P: [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]], depth: depth[i] }; };
  return world;
}

// Can Lamb stand in this cell now? rules: { waterY, floorClosed, gullyDeep }
export function passable(world, gx, gz, rules) {
  const GRID = world.grid;
  if (gx < 0 || gz < 0 || gx >= GRID.nx || gz >= GRID.nz) return 0;
  const h = world.height[gz * GRID.nx + gx]; if (isNaN(h)) return 0;
  const x = GRID.x0 + (gx + 0.5) * GRID.cell, z = GRID.z0 + (gz + 0.5) * GRID.cell;
  if (world.inGully(x, z) && h < -3) return rules.gullyDeep ? 5 : 1.6;          // wading: slower, and slower still when deep
  if (h < -2.9 && rules.floorClosed) return 0;                                     // the sea has the floor back
  if (h < rules.waterY - 0.25) return 0;
  return h < rules.waterY ? 1.8 : 1;
}
// A* on the grid (8-neighbour), steps between neighbours limited to a stair's rise.
export function findPath(world, from, to, rules) {
  const GRID = world.grid;
  const [sx, sz] = world.cellOf(from[0], from[2]), N = GRID.nx;
  let [tx, tz] = world.cellOf(to[0], to[2]);
  // a target off the walkable ground (a door, a person, a hole in the painting): the nearest cell that is
  if (!passable(world, tx, tz, rules)) {
    let best = null; const R = Math.ceil(2.5 / GRID.cell);
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) { const d = dx * dx + dz * dz; if ((!best || d < best[0]) && passable(world, tx + dx, tz + dz, rules) && Math.abs(world.height[(tz + dz) * N + tx + dx] - (isNaN(to[1]) ? 0 : to[1])) < 0.8) best = [d, tx + dx, tz + dz]; }
    if (!best) return null; tx = best[1]; tz = best[2];
  }
  const g = new Map(), came = new Map(), open = [[0, sx, sz]], key = (x, z) => z * N + x, H = (x, z) => Math.hypot(x - tx, z - tz);
  g.set(key(sx, sz), 0);
  for (let it = 0; open.length && it < 60000; it++) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
    const [, x, z] = open.splice(bi, 1)[0], k0 = key(x, z);
    if (x === tx && z === tz) { const path = []; let k = k0; while (k !== undefined) { const cx = k % N, cz = Math.floor(k / N); path.push([GRID.x0 + (cx + 0.5) * GRID.cell, GRID.z0 + (cz + 0.5) * GRID.cell]); k = came.get(k); } return path.reverse(); }
    const h0 = world.height[k0];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = x + dx, nz = z + dz, c = passable(world, nx, nz, rules); if (!c) continue;
      const k = key(nx, nz); if (Math.abs(world.height[k] - h0) > 0.55) continue;
      const ng = g.get(k0) + Math.hypot(dx, dz) * c;
      if (ng < (g.get(k) ?? Infinity)) { g.set(k, ng); came.set(k, k0); open.push([ng + H(nx, nz), nx, nz]); }
    }
  }
  return null;
}
export function regionOf(world, x, z) {
  const h = world.groundAt(x, z);
  if (Math.hypot(x - DROWNED[0], z - DROWNED[2]) < 3.2) return "drowned";
  if (x > 13.5) return "mole";
  if (h < -2.9) return "floor";
  if (h < -0.1) return "steps";
  return "quay";
}

// Hotspots: where the script's scenes start in the world. node(notes) picks the entry.
export const HOTSPOTS = [
  { id: "keel", label: "The harbourmaster", at: [-1.9, 0, -0.2], r: 1.7, node: (n) => (n.has("met.keel") ? "keel.again" : "keel.start"), who: "keel" },
  { id: "fennick", label: "The deacon, blessing the mud", at: [-2.7, -2.3, 2.9], r: 1.5, node: (n) => (n.has("met.fennick") ? "fennick.menu" : "fennick.start"), who: "fennick" },
  { id: "prints", label: "Boot prints, going out", at: [-5.6, -3.2, 4.6], r: 1.4, node: () => "floor.prints", once: "prints.read" },
  { id: "drowned", label: "The drowned lamp", at: [-11.3, -3.25, 9.6], r: 2.0, node: () => "floor.gully" },
  { id: "brine", label: "The Brine", at: [-6.2, 0, -0.2], r: 1.3, node: () => "brine.enter" },
  { id: "yard", label: "Round the back of the Brine", at: [-10.4, 0, 0.0], r: 1.2, node: () => "yard.enter" },
  { id: "weigh", label: "The weigh-house", at: [3.4, 0, -1.6], r: 1.6, node: () => "weigh.outside" },
  { id: "harbour", label: "The harbour office", at: [-1.0, 0, -6.6], r: 1.3, node: () => "harbour.enter" },
  { id: "mother", label: "Mother's door", at: [18.4, 0.2, -2.0], r: 1.5, node: (n) => (n.has("walked.mole.tonight") ? "lamp.door" : "mole.walk") },
];
export const ROOMS = {
  brine: { grid: { x0: -7.5, z0: -4, cell: 0.2, nx: 75, nz: 40 }, spawn: [4.6, 0, 1.3], quayDoor: [-6.2, 0, -0.1] },
  weigh: { grid: { x0: -6.5, z0: -5.5, cell: 0.2, nx: 65, nz: 55 }, spawn: [4.2, 0, 3.4], quayDoor: [3.4, 0, -1.4] },
  lamp: { grid: { x0: -5.5, z0: -5.5, cell: 0.2, nx: 55, nz: 55 }, spawn: [2.6, 0, 2.8], quayDoor: [18.0, 0.2, -2.0] },
};
export const ROOM_HOTSPOTS = {
  brine: [
    { id: "bar", label: "The bar, and Sabine", at: [0.6, 0, -0.6], r: 1.4, node: () => "brine.menu" },
    { id: "stove", label: "The woman by the stove", at: [-3.3, 0, 0.1], r: 1.3, node: (n) => (n.has("met.wenna") ? "wenna.menu" : "wenna.start") },
    { id: "merrow", label: "Merrow, steaming", at: [4.0, 0, 0.3], r: 1.1, node: () => "merrow.brine", when: (c) => c >= 23 * 60 + 45 },
    { id: "door", label: "Out to the quay", at: [5.0, 0, 1.5], r: 1.0, leave: true },
  ],
  weigh: [
    { id: "marrow", label: "The steward", at: [2.4, 0, -3.2], r: 1.5, node: (n) => (n.has("met.marrow") ? "marrow.menu" : "marrow.start") },
    { id: "office", label: "The office door", at: [-1.4, 0, -4.4], r: 1.2, node: () => "office.door" },
    { id: "door", label: "Out to the quay", at: [4.6, 0, 3.8], r: 1.0, leave: true },
  ],
  lamp: [
    { id: "lens", label: "Mother", at: [1.3, 0, 1.3], r: 1.5, node: () => "lamp.menu" },
    { id: "stairs", label: "The stairs down", at: [2.8, 0, 3.2], r: 0.9, node: () => "lamp.down" },
  ],
};
// LWD places to the game's rooms
export const ROOM_OF = { brine: "brine", weigh_in: "weigh", office: "weigh", lamproom: "lamp" };
// The script's travel menus end a conversation and hand Lamb back to the world.
export const EXITS = new Set(["hub", "steps.bottom", "steps.down", "steps.flooded", "drowned.leave", "floor.gully.closed"]);
