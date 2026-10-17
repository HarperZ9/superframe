// Signed-distance helpers and a tracer for the Low Water key frames. Original code.
// Engine modules are imported from an export of raw-native origin/main (see rn.mjs); this file
// has no engine dependency.
export const sat = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export const box = (x, y, z, cx, cy, cz, hx, hy, hz) => { const qx = Math.abs(x - cx) - hx, qy = Math.abs(y - cy) - hy, qz = Math.abs(z - cz) - hz; return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0); };
export const rbox = (x, y, z, cx, cy, cz, hx, hy, hz, r) => box(x, y, z, cx, cy, cz, hx - r, hy - r, hz - r) - r;
export const cyl = (x, y, z, cx, cy, cz, r, hh) => { const dx = Math.hypot(x - cx, z - cz) - r, dy = Math.abs(y - cy) - hh; return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0); };
export const sph = (x, y, z, cx, cy, cz, r) => Math.hypot(x - cx, y - cy, z - cz) - r;
export const ell = (x, y, z, cx, cy, cz, rx, ry, rz) => { const k = Math.min(rx, ry, rz); return (Math.hypot((x - cx) / rx, (y - cy) / ry, (z - cz) / rz) - 1) * k; };
// Capsule from a to b, radius r.
export function cap(x, y, z, a, b, r) {
  const px = x - a[0], py = y - a[1], pz = z - a[2], bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2];
  const h = sat((px * bx + py * by + pz * bz) / (bx * bx + by * by + bz * bz));
  return Math.hypot(px - bx * h, py - by * h, pz - bz * h) - r;
}
// Tapered capsule (cone with round ends): radius ra at a, rb at b (approximate, conservative).
export function tcap(x, y, z, a, b, ra, rb) {
  const px = x - a[0], py = y - a[1], pz = z - a[2], bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2];
  const h = sat((px * bx + py * by + pz * bz) / (bx * bx + by * by + bz * bz));
  return (Math.hypot(px - bx * h, py - by * h, pz - bz * h) - (ra + (rb - ra) * h)) * 0.9;
}
// A gable roof along x (ridge rh above the eaves).
export const gable = (x, y, z, cx, cy, cz, hx, hz, rh) => {
  const lx = Math.abs(x - cx) - hx, lz = z - cz, ly = y - cy, slope = (Math.abs(lz) / hz) * rh - (rh - ly);
  return Math.max(lx, slope * (hz / Math.hypot(hz, rh)), -ly);
};
export const smin = (a, b, k) => { const h = sat(0.5 + (0.5 * (b - a)) / k); return b * (1 - h) + a * h - k * h * (1 - h); };
// Lean: shear x by y above a base height (the crooked-house trick). Returns the sheared x.
export const lean = (x, y, base, k) => x - Math.max(0, y - base) * k;

const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
export function vnoise(x, y) {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0), b = hash(x0 + 1, y0), c = hash(x0, y0 + 1), d = hash(x0 + 1, y0 + 1);
  return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
}
export const fbm = (x, y) => 0.55 * vnoise(x, y) + 0.3 * vnoise(x * 2.1 + 5, y * 2.1) + 0.15 * vnoise(x * 4.3, y * 4.3 + 3);

// A grotesque figure standing at (fx, fz) on floor y0, facing angle a (radians about y). Proportions
// are pushed: long neck, heavy head, hands to the knees. Returns the distance; `part` tells the
// caller which part was nearest via the out object ({ d, part }) when given.
export function figure(x, y, z, f, out = null) {
  const { pos: [fx, fy, fz], h = 1.9, a = 0, head = 0.24, stoop = 0.25, girth = 0.32, neck = 0.32, arms = 1, hat = 0 } = f;
  // local frame
  const ca = Math.cos(a), sa = Math.sin(a), lx = (x - fx) * ca - (z - fz) * sa, lz = (x - fx) * sa + (z - fz) * ca, ly = y - fy;
  const bb = Math.hypot(lx, lz) - 1.4; if (bb > 0.3 || ly > h + 1.2 || ly < -0.2) return Math.max(bb, 0.25);
  const hip = [0, h * 0.48, 0], chest = [stoop * 0.5, h * 0.78, 0], nk = [stoop * 0.5 + neck * 0.6, h * 0.78 + neck, 0], hd = [nk[0] + head * 0.4, nk[1] + head * 0.7, 0];
  let d = tcap(lx, ly, lz, [0, 0.02, 0], hip, girth * 1.15, girth * 0.9), part = 0; // coat skirt
  const t = tcap(lx, ly, lz, hip, chest, girth * 0.95, girth * 1.05); if (t < d) { d = t; part = 0; }
  const n = cap(lx, ly, lz, chest, nk, 0.07); if (n < d) { d = n; part = 1; }
  const hh = ell(lx, ly, lz, hd[0], hd[1], hd[2], head * 1.15, head, head * 0.95); if (hh < d) { d = hh; part = 1; }
  const nose = ell(lx, ly, lz, hd[0] + head * 0.95, hd[1] - head * 0.15, 0, head * 0.45, head * 0.2, head * 0.2); if (nose < d) { d = nose; part = 1; }
  if (hat) { const ht = cyl(lx, ly, lz, hd[0], hd[1] + head * 0.9, 0, head * 0.85, head * 0.35 * hat); if (ht < d) { d = ht; part = 2; } const br = cyl(lx, ly, lz, hd[0], hd[1] + head * 0.6, 0, head * 1.6, 0.025); if (br < d) { d = br; part = 2; } }
  for (const s of [-1, 1]) {
    const sh = [chest[0] - 0.05, chest[1] - 0.05, s * girth * 1.1], el = [chest[0] + 0.1 * arms, h * 0.5, s * girth * 1.3], hn = [chest[0] + 0.25 * arms, h * 0.26, s * girth * 1.25];
    const u = cap(lx, ly, lz, sh, el, 0.075), v = cap(lx, ly, lz, el, hn, 0.065), w = ell(lx, ly, lz, hn[0], hn[1] - 0.06, hn[2], 0.09, 0.14, 0.07);
    const m = Math.min(u, v); if (m < d) { d = m; part = 0; } if (w < d) { d = w; part = 1; }
  }
  if (out) { out.d = d; out.part = part; }
  return d;
}

// A tracer over map(x, y, z) -> distance, with idOf() -> the id of the nearest surface of the last
// map call.
export function makeTracer(map, idOf) {
  const normal = (P) => { const e = 0.002, a = map(P[0] + e, P[1] - e, P[2] - e), b = map(P[0] - e, P[1] - e, P[2] + e), c = map(P[0] - e, P[1] + e, P[2] - e), d = map(P[0] + e, P[1] + e, P[2] + e); return norm([a - b - c + d, -a - b + c + d, -a + b - c + d]); };
  function march(o, d, tmax = 200, t0 = 0) {
    let t = t0;
    for (let s = 0; s < 260 && t < tmax; s++) { const q = map(o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t); if (q < 0.0008 + 0.0003 * t) { const P = [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t]; map(P[0], P[1], P[2]); return { hit: true, t, P, id: idOf() }; } t += q * 0.95; }
    return { hit: false, t: tmax };
  }
  // Soft visibility toward a point light at distance maxT along L (k sets the penumbra).
  function shadow(P, N, L, maxT, k = 10) {
    const o = [P[0] + N[0] * 0.02, P[1] + N[1] * 0.02, P[2] + N[2] * 0.02];
    let res = 1, t = 0.04;
    for (let i = 0; i < 64 && t < maxT; i++) { const h = map(o[0] + L[0] * t, o[1] + L[1] * t, o[2] + L[2] * t); if (h < 0.002) return 0; res = Math.min(res, (k * h) / t); t += Math.max(h, 0.03); }
    return sat(res);
  }
  function ao(P, N) { let o = 0; for (let i = 1; i <= 5; i++) { const h = 0.09 * i; o += (h - map(P[0] + N[0] * h, P[1] + N[1] * h, P[2] + N[2] * h)) / (i * i); } return sat(1 - 1.5 * o); }
  return { normal, march, shadow, ao };
}
