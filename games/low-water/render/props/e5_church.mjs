// Era 5 churchyard and verge pieces (The Clearance, year 115, April; design/eras/era5.md section 5): the turf of an old
// burial ground with its mounds, a rubble boundary wall with a gate, yews, headstones of several kinds (round-headed,
// a cross, a ledger, a chest tomb), the mast's compound with its palisade and cabinet, survey pegs strung on a line,
// temporary mesh fencing, a lamp on a bracket. Used by the tower (q5_tower) and the ring road verge (q5_ring_verge).
// Plates fix pass, 2026-10-24. Original code.
import { prop, bbc, bbr, rot, box, cyl, cap, sph, slab, n3, fb3, hash, sstep, ID } from "./prim.mjs";
import { kind4 } from "./e4_kinds.mjs";

const S = (mat, scale) => ({ mat, scale, wet: 0, emit: null });
// turf: one surface whose tone wanders (tussocks, a worn line, moss in the hollows) instead of patches of separate kinds,
// so the painter lays one field with no inked borders through it
export const TURF = kind4("turf5", "lw weed", 1, 0.4, (P) => {
  const big = fb3(P[0] * 0.35, 0, P[2] * 0.35), tuft = n3(P[0] * 6, P[1] * 6, P[2] * 6), fine = n3(P[0] * 31, 0, P[2] * 31);
  const dry = sstep(0.55, 0.8, big);
  return dry > 0.5 ? S("lw sand", 0.2 + 0.08 * tuft + 0.04 * fine) : S("lw green paint", 0.2 + 0.1 * big + 0.07 * tuft + 0.04 * fine);
});
// gravel: a path's loose stone, light and fine-grained
export const GRAVEL = kind4("gravel5", "stone", 1, 0.5, (P) => S("stone", 0.46 + 0.14 * n3(P[0] * 40, 0, P[2] * 40) + 0.06 * fb3(P[0] * 2, 0, P[2] * 2)));
// tarmac, dry (the kit's tar is wet enough to mirror a lamp head as a white mark on the road): aggregate speckle, patched
export const TARMAC = kind4("tarmac5", "lw tar", 1, 0.1, (P) => S("lw tar", 1.1 + 0.25 * n3(P[0] * 30, 0, P[2] * 30) + 0.25 * sstep(0.62, 0.7, fb3(P[0] * 0.4, 0, P[2] * 0.4))));
// lichen-grey headstone stone, darker toward the foot
export const HEADSTONE = kind4("headstone5", "stone", 1, 0.45, (P) => S(n3(P[0] * 18, P[1] * 18, P[2] * 18) > 0.72 ? "lw weed" : "stone", 0.34 + 0.16 * sstep(0, 0.9, P[1]) + 0.08 * n3(P[0] * 9, P[1] * 9, P[2] * 9)));

// a graveyard ground: turf over the mounds of old graves (rows given as [x, z, length]), with a gravel path polyline
// outside the wall polygon (yard: a closed list of [x, z]) the ground is a pavement band and then the lane's tarmac
const inPoly = (x, z, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, zi] = P[i], [xj, zj] = P[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; } return c; };
const polyD = (x, z, P) => { let d = 1e9; for (let i = 0; i + 1 < P.length; i++) { const [ax, az] = P[i], [bx, bz] = P[i + 1], vx = bx - ax, vz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz))); d = Math.min(d, Math.hypot(x - ax - vx * t, z - az - vz * t)); } return d; };
export function churchGround({ mounds = [], path = [], pathW = 0.6, slope = null, yard = null, pave = 1.8, lane = 5.5 } = {}) {
  const segD = (x, z) => { let d = 1e9; for (let i = 0; i + 1 < path.length; i++) { const [ax, az] = path[i], [bx, bz] = path[i + 1], vx = bx - ax, vz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz))); d = Math.min(d, Math.hypot(x - ax - vx * t, z - az - vz * t)); } return d; };
  return (x, y, z, T) => {
    if (yard && !inPoly(x, z, yard)) {
      // the pavement, the lane (its centre line solid, a line at each edge), then rough verge with tussocks and ruts
      const d = polyD(x, z, yard);
      if (d > 0.3) {
        if (d < pave) { T(y - 0.12, ID.slab); return; }
        if (d < pave + lane) { const line = Math.abs(d - pave - lane / 2) < 0.06 || Math.abs(d - pave - 0.25) < 0.05 || Math.abs(d - pave - lane + 0.25) < 0.05; T(y + 0.004 * n3(x * 3, 0, z * 3), line ? ID.bone : TARMAC); return; }
        T((y - 0.02 - 0.16 * fb3(x * 0.9, 0, z * 0.9) - 0.06 * n3(x * 2.6, 0, z * 2.6)) * 0.85, TURF); return;
      }
    }
    let h = 0.05 * fb3(x * 0.6, 0, z * 0.6) + 0.025 * n3(x * 3, 0, z * 3) + (slope ? slope(x, z) : 0);
    for (const [mx, mz, ml] of mounds) { const dx = Math.max(0, Math.abs(x - mx) - 0.15), dz = Math.max(0, Math.abs(z - mz) - ml / 2 + 0.2); h += 0.09 * Math.exp(-(dx * dx + dz * dz) / 0.09); }
    const pd = path.length ? segD(x, z) : 9, onPath = pd < pathW / 2;
    if (onPath) h = Math.min(h, 0.01 + (slope ? slope(x, z) : 0));
    T((y - h) * 0.9, onPath ? GRAVEL : TURF);
  };
}
// headstones: kind "round" (a round head), "cross", "ledger" (a flat slab on the grave), "chest" (a box tomb with a lid)
export function grave(x, z, { kind = "round", a = 0, tilt = 0, h = 0.9, name = "headstone", mark = false } = {}) {
  return prop(name, bbr(x, -0.2, z, kind === "ledger" || kind === "chest" ? 1.3 : 0.6, h + 0.3, kind === "ledger" || kind === "chest" ? 1.3 : 0.6), (px, py, pz, T) => {
    const [lx, lz] = rot(px, pz, x, z, a), c = Math.cos(tilt), s = Math.sin(tilt), qx = (lx - x) * c - py * s, qy = (lx - x) * s + py * c, qz = lz - z, wear = 0.008 * fb3(lx * 12, py * 12, lz * 12);
    if (kind === "round") { T(Math.max(slab(qx, qy, qz, [0, h * 0.45, 0], [0.3, h * 0.5, 0.06], 0.015), Math.hypot(qx, Math.max(0, qy - h * 0.72)) - 0.3) + wear, HEADSTONE); if (mark) T(Math.max(Math.abs(Math.abs(qx) - Math.abs(qy - h * 0.55)) - 0.025, Math.hypot(qx, qy - h * 0.55) - 0.16, Math.abs(qz - 0.065) - 0.004), ID.mustard); }
    else if (kind === "cross") { T(Math.min(slab(qx, qy, qz, [0, h * 0.5, 0], [0.06, h * 0.5, 0.06], 0.01), slab(qx, qy, qz, [0, h * 0.72, 0], [0.24, 0.06, 0.06], 0.01), slab(qx, qy, qz, [0, 0.08, 0], [0.2, 0.08, 0.16], 0.01)) + wear, HEADSTONE); }
    else if (kind === "ledger") { T(slab(lx - x, py, lz - z, [0, 0.08, 0], [0.45, 0.09, 1.0], 0.02) + wear, HEADSTONE); if (mark) T(Math.max(Math.abs(Math.abs(lx - x) - Math.abs(lz - z) * 0.45) - 0.03, Math.abs(lz - z) - 0.5, Math.abs(py - 0.17) - 0.004), ID.mustard); }
    else { T(slab(lx - x, py, lz - z, [0, 0.42, 0], [0.5, 0.42, 1.0], 0.02) + wear, HEADSTONE); T(slab(lx - x, py, lz - z, [0, 0.88, 0], [0.6, 0.05, 1.1], 0.02) + wear, HEADSTONE); }
  });
}
// a rubble boundary wall along a polyline, with flat coping stones; gaps where gates stand (list of [x, z, half width])
export function rubbleWall(pts, { h = 1.1, th = 0.28, gaps = [], name = "churchyard_wall" } = {}) {
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
  return prop(name, [Math.min(...xs) - 0.5, -0.1, Math.min(...zs) - 0.5, Math.max(...xs) + 0.5, h + 0.2, Math.max(...zs) + 0.5], (px, py, pz, T) => {
    for (const [gx, gz, gw] of gaps) if (Math.hypot(px - gx, pz - gz) < gw) return;
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L, u = (px - ax) * ux + (pz - az) * uz, v = -(px - ax) * uz + (pz - az) * ux;
      if (u < -0.5 || u > L + 0.5) continue;
      const course = Math.floor(py / 0.22), sx = u / 0.45 + (course & 1) * 0.5, joint = Math.min(Math.abs(sx - Math.round(sx)) * 0.45, Math.abs(py / 0.22 - Math.round(py / 0.22)) * 0.22);
      T(Math.max(Math.abs(u - L / 2) - L / 2, Math.abs(v) - th + 0.012 * Math.max(0, 0.04 - joint) * 25 + 0.015 * n3(u * 4, py * 4, v), Math.abs(py - h / 2) - h / 2), ID.wall);
      T(Math.max(Math.abs(u - L / 2) - L / 2 - 0.02, Math.abs(v) - th - 0.06, Math.abs(py - h - 0.06) - 0.06), ID.slab);
    }
  });
}
// two gate piers with ball caps and an iron gate standing open at angle a (radians, about the left pier)
export function gate(x, z, { w = 1.4, a = 0.9, name = "churchyard_gate" } = {}) {
  return prop(name, bbc(x, 0.9, z, w / 2 + 1.4, 1.0, 1.6), (px, py, pz, T) => {
    for (const s of [-1, 1]) { T(box(px, py, pz, x + s * (w / 2 + 0.2), 0.75, z, 0.2, 0.75, 0.2), ID.slab); T(sph(px, py, pz, x + s * (w / 2 + 0.2), 1.68, z, 0.15), ID.slab); }
    const [lx, lz] = rot(px, pz, x - w / 2, z, -a), gx = lx - (x - w / 2), gz = lz - z;
    if (gx > -0.05 && gx < w + 0.05) { const bar = Math.abs(((gx / 0.12) % 1 + 1) % 1 - 0.5) * 0.12; T(Math.max(Math.min(bar - 0.012, Math.abs(py - 0.2) - 0.02, Math.abs(py - 1.25) - 0.02), Math.abs(gz) - 0.015, Math.abs(py - 0.72) - 0.56, gx - w, -gx), ID.iron); }
  });
}
// a yew: a dark, dense, slightly lumpy cone on a short red trunk
export const yew = (x, z, { h = 4.2, r = 1.7, name = "yew" } = {}) => prop(name, bbr(x, 0, z, r + 0.4, h + 0.4, r + 0.4), (px, py, pz, T) => {
  T(cap(px, py, pz, [x, 0, z], [x, 1.0, z], 0.22), ID.rust);
  const t = Math.max(0, Math.min(1, (py - 0.7) / (h - 0.7))), rr = r * (1 - t * 0.85) * (0.9 + 0.1 * Math.sin(t * 9)), lump = 0.18 * (fb3(px * 1.6, py * 1.6, pz * 1.6) - 0.5) + 0.06 * (n3(px * 6, py * 6, pz * 6) - 0.5);
  T(Math.max(Math.hypot(px - x, pz - z) - rr + lump, 0.7 - py, py - h) * 0.75, ID.weed);
});
// the mast's compound at the tower foot: a green palisade fence round a cabinet, the cable tray up the wall
export function compound(x0, z0, x1, z1, { name = "mast_compound", trayTo = null } = {}) {
  return prop(name, [x0 - 0.2, 0, z0 - 0.2, x1 + 0.2, trayTo ? trayTo[1] : 2.2, z1 + 0.2], (px, py, pz, T) => {
    const onX = Math.min(Math.abs(pz - z0), Math.abs(pz - z1)), onZ = Math.min(Math.abs(px - x0), Math.abs(px - x1));
    const inside = px > x0 - 0.05 && px < x1 + 0.05 && pz > z0 - 0.05 && pz < z1 + 0.05;
    if (inside) {
      const along = onX < onZ ? px : pz, k = Math.round(along / 0.16), pale = Math.min(onX, onZ);
      T(Math.max(Math.hypot((along - k * 0.16) * 2.2, pale) - 0.03, Math.abs(py - 0.95) - 0.95 + 0.06 * Math.abs(Math.sin(k * 1.7))), ID.green);
      T(Math.max(pale - 0.025, Math.min(Math.abs(py - 0.35), Math.abs(py - 1.55)) - 0.03), ID.green);
    }
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    T(slab(px, py, pz, [cx, 0.8, cz], [0.5, 0.8, 0.35], 0.03), ID.steel); T(box(px, py, pz, cx, 1.2, cz + 0.36, 0.12, 0.1, 0.01), ID.mustard);
    if (trayTo) T(Math.max(box(px, py, pz, trayTo[0], trayTo[1] / 2, trayTo[2], 0.08, trayTo[1] / 2, 0.04), -py), ID.steel);
  });
}
// survey pegs with orange tops along a line, with the string run between them at 0.3 m
export function pegLine(x0, z0, x1, z1, { n = 10, name = "survey_pegs" } = {}) {
  const L = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / L, uz = (z1 - z0) / L;
  return prop(name, [Math.min(x0, x1) - 0.15, -0.1, Math.min(z0, z1) - 0.15, Math.max(x0, x1) + 0.15, 0.6, Math.max(z0, z1) + 0.15], (px, py, pz, T) => {
    const t = Math.max(0, Math.min(L, (px - x0) * ux + (pz - z0) * uz)), k = Math.round((t / L) * (n - 1)), cx = x0 + ux * (k / (n - 1)) * L, cz = z0 + uz * (k / (n - 1)) * L;
    T(box(px, py, pz, cx, 0.24, cz, 0.03, 0.3, 0.03), py > 0.42 ? ID.mustard : ID.timber);
    T(Math.max(Math.hypot(-(px - x0) * uz + (pz - z0) * ux, py - 0.3) - 0.006, -t, t - L), ID.mustard);
  });
}
// temporary mesh fence panels on block feet, along a line (the clearance's site boundary)
export function meshFence(x0, z0, x1, z1, { name = "site_fence", h = 2.0 } = {}) {
  const L = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / L, uz = (z1 - z0) / L;
  return prop(name, [Math.min(x0, x1) - 0.4, 0, Math.min(z0, z1) - 0.4, Math.max(x0, x1) + 0.4, h + 0.1, Math.max(z0, z1) + 0.4], (px, py, pz, T) => {
    const u = (px - x0) * ux + (pz - z0) * uz, v = -(px - x0) * uz + (pz - z0) * ux; if (u < -0.3 || u > L + 0.3) return;
    const k = Math.round(u / 3.4), fu = u - k * 3.4, frame = Math.min(Math.abs(Math.abs(fu) - 1.7), Math.abs(py - 0.15), Math.abs(py - h));
    T(Math.max(Math.abs(v) - 0.02, Math.abs(py - h / 2 - 0.08) - h / 2, Math.abs(fu) - 1.7, Math.min(frame - 0.025, Math.min(Math.abs((((fu / 0.1) % 1) + 1) % 1 - 0.5) * 0.1, Math.abs((((py / 0.2) % 1) + 1) % 1 - 0.5) * 0.2) - 0.004)), ID.steel);
    T(Math.max(Math.abs(fu - 1.7 * Math.sign(fu || 1)) - 0.3, Math.abs(v) - 0.12, Math.abs(py - 0.07) - 0.07), ID.concrete);
  });
}
// a lamp on a bracket from a post: a lantern head with a warm (sodium) or white lamp; returns { p, l }
export function bracketLamp(x, z, { h = 3.6, a = 0, kind = 0, I = 30, reach = 18, name = "bracket_lamp" } = {}) {
  const hx = x + Math.sin(a) * 0.6, hz = z + Math.cos(a) * 0.6;
  const p = prop(name, [Math.min(x, hx) - 0.4, 0, Math.min(z, hz) - 0.4, Math.max(x, hx) + 0.4, h + 0.4, Math.max(z, hz) + 0.4], (px, py, pz, T) => {
    T(cyl(px, py, pz, x, h / 2, z, 0.06, h / 2), ID.iron); T(cap(px, py, pz, [x, h - 0.3, z], [hx, h - 0.05, hz], 0.03), ID.iron);
    T(box(px, py, pz, hx, h - 0.28, hz, 0.12, 0.16, 0.12), kind === 0 ? ID.sodium : ID.whitelamp); T(box(px, py, pz, hx, h - 0.08, hz, 0.17, 0.04, 0.17), ID.iron);
  });
  return { p, l: { pos: [hx, h - 0.45, hz], type: kind, I, reach, key: name, group: kind === 0 ? "sodium" : "lantern" } };
}
// small verge things: a jam jar of daffodils, a tea light in a jar, a drinks can on its side, a traffic cone knocked over
export const jarFlowers = (x, z, { y = 0, name = "jar_of_daffodils" } = {}) => prop(name, bbc(x, y + 0.2, z, 0.14, 0.22, 0.14), (px, py, pz, T) => {
  T(Math.max(Math.abs(Math.hypot(px - x, pz - z) - 0.045) - 0.004, Math.abs(py - y - 0.07) - 0.07), ID.glass);
  for (let k = 0; k < 5; k++) { const a = k * 1.256, tx = x + 0.06 * Math.cos(a), tz = z + 0.06 * Math.sin(a), ty = y + 0.3 + 0.03 * (k % 2); T(cap(px, py, pz, [x, y + 0.02, z], [tx, ty, tz], 0.005), ID.weed); T(sph(px, py, pz, tx, ty, tz, 0.025), ID.mustard); }
});
export const jarCandle = (x, z, { y = 0, name = "tea_light_jar", I = 0.6 } = {}) => ({ p: prop(name, bbc(x, y + 0.06, z, 0.06, 0.07, 0.06), (px, py, pz, T) => { T(Math.max(Math.abs(Math.hypot(px - x, pz - z) - 0.04) - 0.004, Math.abs(py - y - 0.05) - 0.05), ID.glass); T(sph(px, py, pz, x, y + 0.03, z, 0.015), ID.candle); }), l: { pos: [x, y + 0.06, z], type: 1, I, reach: 2.2, key: `${name}_${x}`, group: "candle" } });
export const can = (x, z, { a = 0, name = "drinks_can", id = ID.red } = {}) => prop(name, bbr(x, 0, z, 0.1, 0.1, 0.1), (px, py, pz, T) => { const [lx, lz] = rot(px, pz, x, z, a); T(Math.max(Math.hypot(py - 0.033, lz - z) - 0.033, Math.abs(lx - x) - 0.06), id); });
export const cone = (x, z, { a = 0, name = "traffic_cone" } = {}) => prop(name, bbr(x, 0, z, 0.45, 0.4, 0.45), (px, py, pz, T) => {
  const [lx, lz] = rot(px, pz, x, z, a), u = lx - x, r = Math.hypot(py - 0.18, lz - z), t = Math.max(0, Math.min(1, (u + 0.3) / 0.6));
  T(Math.max(r - 0.16 + 0.12 * t, Math.abs(u) - 0.3), Math.abs(t - 0.55) < 0.12 ? ID.bone : ID.red); T(Math.max(Math.abs(u + 0.33) - 0.03, Math.max(Math.abs(py - 0.18), Math.abs(lz - z)) - 0.2), ID.tar);
});
export const hashOf = hash;
