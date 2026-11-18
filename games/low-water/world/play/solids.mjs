// What a body or a camera cannot pass through: the ground, and solids standing on it. A solid is a
// simple shape in metres, close to the mesh it stands for:
//   { kind: "box",  x, z, turn, hu, hv, y0, y1 }          a turned box (a house's walls)
//   { kind: "roof", x, z, turn, hu, hv, eave, ridge }       a gable roof: a prism along local u
//   { kind: "cyl",  x, z, r, y0, y1 }                       an upright cylinder (a trunk, a pole, a stack)
// `turn` follows the near maps (walk/near.mjs rect): u = dx cos - dz sin, v = dx sin + dz cos.
// Solids come from sources, asked lazily for one 32 m cell at a time and kept; a source is
// (x0, z0, x1, z1, emit) => void and may emit a solid more than once (it is kept once per cell).
// The camera asks for a signed distance (sdf) and a sphere cast; the body asks to be pushed out.
const CELL = 32;

export function makeSolids({ ground, maxCells = 4096 } = {}) {
  const sources = [], cells = new Map(), planted = [];
  const key = (cx, cz) => cx * 100003 + cz;
  function cellAt(cx, cz) {
    const k = key(cx, cz); let c = cells.get(k);
    if (c) return c;
    c = [];
    const x0 = cx * CELL, z0 = cz * CELL, seen = new Set();
    const emit = (s) => { if (!seen.has(s) && overlaps(s, x0 - 1, z0 - 1, x0 + CELL + 1, z0 + CELL + 1)) { seen.add(s); c.push(s); } };
    for (const f of sources) f(x0, z0, x0 + CELL, z0 + CELL, emit);
    for (const s of planted) emit(s);
    if (cells.size >= maxCells) cells.delete(cells.keys().next().value);
    cells.set(k, c);
    return c;
  }
  // every solid within r metres of (x, z) on the map
  function near(x, z, r, out = []) {
    out.length = 0; const seen = new Set();
    for (let cz = Math.floor((z - r) / CELL); cz <= Math.floor((z + r) / CELL); cz++) for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++)
      for (const s of cellAt(cx, cz)) if (!seen.has(s)) { seen.add(s); out.push(s); }
    return out;
  }
  const scratch = [];
  // drawn triangles kept clear of (play/geocheck.mjs makeTriangleGrid): what a house's walls and roof
  // leave out, its signs, clutter, cables and people, is in the mesh. A grid marked cameraOnly (the
  // trees' lower branches) stops the camera and not the walker.
  const meshes = [];
  // signed distance from a point to the nearest solid (not the ground); negative inside a shape,
  // never negative for a mesh (its distance is unsigned)
  function sdfSolids(p, reach = 6) {
    let d = 1e9;
    for (const s of near(p[0], p[2], reach, scratch)) d = Math.min(d, sdf(s, p));
    for (const g of meshes) d = Math.min(d, g.distance(p, Math.min(1.5, Math.max(0.3, d))));
    return d;
  }
  // the ground as a distance: height above it, eased for slopes (a lower bound up to 45 degrees)
  const sdfGround = (p) => (p[1] - ground(p[0], p[2])) * 0.7;
  const sdfAll = (p, reach) => Math.min(sdfSolids(p, reach), sdfGround(p));

  // A sphere of radius r moved from a to b: the share of the way it gets before it touches
  // anything (1: the whole way). A start already touching gives 0.
  function castSphere(a, b, r, { ground: withGround = true } = {}) {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]);
    if (L < 1e-6) return 1;
    const u = [d[0] / L, d[1] / L, d[2] / L], list = near((a[0] + b[0]) / 2, (a[2] + b[2]) / 2, L / 2 + r + 2, []);
    const at = (t) => { const p = [a[0] + u[0] * t, a[1] + u[1] * t, a[2] + u[2] * t]; let m = withGround ? sdfGround(p) : 1e9; for (const s of list) m = Math.min(m, sdf(s, p)); for (const g of meshes) m = Math.min(m, g.distance(p, Math.min(1.5, Math.max(r + 0.05, m)))); return m - r; };
    let t = 0;
    for (let i = 0; i < 96 && t < L; i++) {
      const m = at(t);
      if (m < 0.004) return t / L;
      t += Math.max(m, 0.03);
    }
    return 1;
  }
  // Push a standing body (a circle of radius r on the map, from y0 to y1) out of every solid it
  // overlaps. Returns [x, z, touched].
  function pushOut(x, z, r, y0, y1) {
    let touched = false;
    for (let it = 0; it < 4; it++) {
      let moved = false;
      for (const s of near(x, z, r + 2, scratch)) {
        if (s.kind === "roof") continue;
        if (s.y1 < y0 || s.y0 > y1) continue;
        const [d, gx, gz] = dist2(s, x, z);
        if (d < r) { x += gx * (r - d + 1e-3); z += gz * (r - d + 1e-3); moved = touched = true; }
      }
      if (!moved) break;
    }
    for (const g of meshes) { if (g.cameraOnly) continue; const q = g.pushOut(x, z, r, y0, y1); if (q[2]) { x = q[0]; z = q[1]; touched = true; } }
    return [x, z, touched];
  }
  // is a point inside a solid, or within `pad` of one, or under the ground
  const inside = (p, pad = 0) => sdfSolids(p) < pad || p[1] < ground(p[0], p[2]) + pad * 0.5;
  // a solid put in by hand: the checks plant a wall to prove the camera check can fail
  function plant(s) { planted.push(s); cells.clear(); return s; }
  function unplant(s) { const i = planted.indexOf(s); if (i >= 0) planted.splice(i, 1); cells.clear(); }
  return { sources, meshes, near, sdf: sdfAll, sdfSolids, castSphere, pushOut, inside, plant, unplant, ground, forget: () => cells.clear() };
}

// local axes of a turned shape
function local(s, x, z) { const c = Math.cos(s.turn), sn = Math.sin(s.turn), dx = x - s.x, dz = z - s.z; return [dx * c - dz * sn, dx * sn + dz * c, c, sn]; }
function overlaps(s, x0, z0, x1, z1) {
  const r = s.kind === "cyl" ? s.r : Math.hypot(s.hu, s.hv);
  return s.x + r >= x0 && s.x - r <= x1 && s.z + r >= z0 && s.z - r <= z1;
}
// 3D signed distance to one solid (exact inside, a lower bound outside)
export function sdf(s, p) {
  if (s.kind === "cyl") {
    const dr = Math.hypot(p[0] - s.x, p[2] - s.z) - s.r, dy = Math.max(s.y0 - p[1], p[1] - s.y1);
    return dr > 0 && dy > 0 ? Math.hypot(dr, dy) : Math.max(dr, dy);
  }
  const [u, v] = local(s, p[0], p[2]);
  if (s.kind === "roof") {
    // inside when below both slopes, above the eave, and between the gables
    const run = s.hv, rise = s.ridge - s.eave, l = Math.hypot(run, rise), slope = (Math.abs(v) * rise + (p[1] - s.ridge) * run) / l;
    return Math.max(Math.abs(u) - s.hu, s.eave - p[1], slope);
  }
  const qx = Math.abs(u) - s.hu, qz = Math.abs(v) - s.hv, yc = (s.y0 + s.y1) / 2, qy = Math.abs(p[1] - yc) - (s.y1 - s.y0) / 2;
  const ox = Math.max(qx, 0), oy = Math.max(qy, 0), oz = Math.max(qz, 0);
  return Math.hypot(ox, oy, oz) + Math.min(Math.max(qx, qy, qz), 0);
}
// 2D signed distance on the map and the outward direction: [d, gx, gz]
export function dist2(s, x, z) {
  if (s.kind === "cyl") { const dx = x - s.x, dz = z - s.z, l = Math.hypot(dx, dz) || 1e-6; return [l - s.r, dx / l, dz / l]; }
  const [u, v, c, sn] = local(s, x, z), qx = Math.abs(u) - s.hu, qz = Math.abs(v) - s.hv;
  let gu, gv, d;
  if (qx > 0 || qz > 0) { const ox = Math.max(qx, 0), oz = Math.max(qz, 0), l = Math.hypot(ox, oz) || 1e-6; d = l; gu = Math.sign(u) * ox / l; gv = Math.sign(v) * oz / l; }
  else if (qx > qz) { d = qx; gu = Math.sign(u) || 1; gv = 0; } else { d = qz; gu = 0; gv = Math.sign(v) || 1; }
  // back from local axes to the map: dx = u c + v s, dz = -u s + v c
  return [d, gu * c + gv * sn, -gu * sn + gv * c];
}
// The solids of a house of the snow town (walk/build/town.mjs plan): walls on a footing, a roof
// with its load of snow, and its chimney stays inside the roof's prism.
export function houseSolids(h) {
  const y = h.y + 0.1, ridge = y + h.hw + (h.D / 2) * Math.tan(h.pitch), ov = 0.55, rise = (h.D / 2 + ov) * Math.tan(h.pitch);
  return [
    { kind: "box", x: h.x, z: h.z, turn: h.turn, hu: h.W / 2 + 0.06, hv: h.D / 2 + 0.06, y0: y - 0.8, y1: y + h.hw },
    { kind: "roof", x: h.x, z: h.z, turn: h.turn, hu: h.W / 2 + 0.47, hv: h.D / 2 + ov + 0.3, eave: ridge - rise - 0.25, ridge: ridge + 0.9 },
  ];
}
