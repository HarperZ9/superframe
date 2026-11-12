// Signed-distance sculpting for character sheets (characters/forge). Pure JS, no outside tools.
// A shape is a JSON record; field(shape) returns d(x, y, z) in metres (negative inside).
//   { t: "ell", c: [x,y,z], r: [rx,ry,rz], rot?: [pitch, yaw, roll] }       ellipsoid
//   { t: "cap", a: [..], b: [..], r: r | [r0, r1] }                         capsule / round cone
//   { t: "box", c, r: [hx,hy,hz], round?, rot? }                           rounded box
//   { t: "tor", c, R, r, rot? }                                            torus (rings, rims, collars)
// Combined in a region with ops per shape: op "add" (smooth union, k), "sub" (smooth carve, k),
// "and" (intersect, k). Displacements after the field: folds, wrinkles, noise, pocks (see disp()).
const len = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
export const smin = (a, b, k) => { if (k <= 0) return Math.min(a, b); const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
export const smax = (a, b, k) => -smin(-a, -b, k);
const D2R = Math.PI / 180;
function rotFn(rot) {
  if (!rot) return null;
  const [px, py, pz] = rot.map((v) => v * D2R), cx = Math.cos(px), sx = Math.sin(px), cy = Math.cos(py), sy = Math.sin(py), cz = Math.cos(pz), sz = Math.sin(pz);
  // inverse of yaw * pitch * roll, applied to a point relative to the shape's centre
  return (x, y, z) => { let X = cy * x - sy * z, Z = sy * x + cy * z, Y = y; const Y2 = cx * Y + sx * Z, Z2 = -sx * Y + cx * Z; Y = Y2; Z = Z2; return [cz * X + sz * Y, -sz * X + cz * Y, Z]; };
}
export function field(s) {
  const R = rotFn(s.rot);
  if (s.t === "ell") { const [cx, cy, cz] = s.c, [rx, ry, rz] = s.r; return (x, y, z) => { let p = [x - cx, y - cy, z - cz]; if (R) p = R(...p); const k0 = len(p[0] / rx, p[1] / ry, p[2] / rz), k1 = len(p[0] / (rx * rx), p[1] / (ry * ry), p[2] / (rz * rz)); return k1 > 0 ? (k0 * (k0 - 1)) / k1 : -Math.min(rx, ry, rz); }; }
  if (s.t === "cap") { const [r0, r1] = Array.isArray(s.r) ? s.r : [s.r, s.r], [ax, ay, az] = s.a, bx = s.b[0] - ax, by = s.b[1] - ay, bz = s.b[2] - az, bb = bx * bx + by * by + bz * bz; return (x, y, z) => { const px = x - ax, py = y - ay, pz = z - az, h = Math.min(1, Math.max(0, (px * bx + py * by + pz * bz) / bb)); return len(px - bx * h, py - by * h, pz - bz * h) - (r0 + (r1 - r0) * h); }; }
  if (s.t === "box") { const [cx, cy, cz] = s.c, [hx, hy, hz] = s.r, rd = s.round || 0; return (x, y, z) => { let p = [x - cx, y - cy, z - cz]; if (R) p = R(...p); const qx = Math.abs(p[0]) - hx + rd, qy = Math.abs(p[1]) - hy + rd, qz = Math.abs(p[2]) - hz + rd; return len(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - rd; }; }
  if (s.t === "tor") { const [cx, cy, cz] = s.c; return (x, y, z) => { let p = [x - cx, y - cy, z - cz]; if (R) p = R(...p); const q = Math.hypot(p[0], p[2]) - s.R; return Math.hypot(q, p[1]) - s.r; }; }
  // an eyelid: a thin shell over the eyeball cut by a tilted lid line (the director's anatomy.py lids)
  if (s.t === "lid") { const [cx, cy, cz] = s.c; return (x, y, z) => { const qx = x - cx, qy = y - cy, qz = z - cz, l = len(qx, qy, qz), shell = Math.abs(l - s.R) - s.th;
    if (s.up) return Math.max(shell, s.h - (qy - s.tilt * qx * s.sx)); return Math.max(shell, qy - s.h); }; }
  // a spherical cap facing n: an iris or a pupil on the eyeball's front
  if (s.t === "scap") { const [cx, cy, cz] = s.c, n = s.n, l0 = len(...n), nx = n[0] / l0, ny = n[1] / l0, nz = n[2] / l0; return (x, y, z) => { const qx = x - cx, qy = y - cy, qz = z - cz; return Math.max(len(qx, qy, qz) - s.R, s.h - (qx * nx + qy * ny + qz * nz)); }; }
  // the mouth's slit, its corners bent by smile
  if (s.t === "slit") { const [cx, cy, cz] = s.c; return (x, y, z) => { const qx = x - cx, qy = y - cy - s.smile * (qx / s.w) ** 2 * 0.012, qz = z - cz; const ax = Math.abs(qx) - s.w * 0.98, ay = Math.abs(qy) - 0.0012, az = Math.abs(qz) - 0.022; return len(Math.max(ax, 0), Math.max(ay, 0), Math.max(az, 0)) + Math.min(Math.max(ax, ay, az), 0); }; }
  throw new Error(`forge: unknown shape ${s.t}`);
}

// Value noise (lattice, deterministic) for displacement and paint.
const PERM = new Uint8Array(512), RND = new Float32Array(256);
{ let x = 1013904223; const r = () => ((x ^= x << 13), (x ^= x >>> 17), (x ^= x << 5), (x >>> 0) / 4294967296); const p = Array.from({ length: 256 }, (_, i) => i); for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) PERM[i] = p[i & 255]; for (let i = 0; i < 256; i++) RND[i] = r(); }
const sm = (t) => t * t * (3 - 2 * t);
export function noise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), fx = sm(x - xi), fy = sm(y - yi), fz = sm(z - zi), h = (a, b, c) => RND[PERM[PERM[PERM[a & 255] + (b & 255)] + (c & 255)]];
  const a0 = h(xi, yi, zi) + (h(xi + 1, yi, zi) - h(xi, yi, zi)) * fx, a1 = h(xi, yi + 1, zi) + (h(xi + 1, yi + 1, zi) - h(xi, yi + 1, zi)) * fx;
  const b0 = h(xi, yi, zi + 1) + (h(xi + 1, yi, zi + 1) - h(xi, yi, zi + 1)) * fx, b1 = h(xi, yi + 1, zi + 1) + (h(xi + 1, yi + 1, zi + 1) - h(xi, yi + 1, zi + 1)) * fx;
  const a = a0 + (a1 - a0) * fy, b = b0 + (b1 - b0) * fy; return a + (b - a) * fz;
}
export const fbm = (x, y, z, oct = 3) => { let v = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { v += a * (noise(x * f, y * f, z * f) - 0.5); a *= 0.5; f *= 2.03; } return v; };

// Displacements: { t: "folds", axis: [x,y,z] (fold direction, e.g. down a coat), across: [x,y,z],
//   freq (folds per metre), amp (m), wobble, from?: y, to?: y }   draping folds that run along `axis`
// { t: "wrinkles", c: [x,y,z], r (m), freq, amp }   creases gathered at a point (elbow, knee, waist)
// { t: "noise", scale (m), amp (m) }   lumpy wool, skin pores at a fine scale
// { t: "pocks", scale, amp }   dents (wear, old wounds)
export function disp(list = []) {
  const fs = list.map((d) => {
    if (d.t === "folds") { const ax = d.axis || [0, -1, 0], ac = d.across || [1, 0, 0]; return (x, y, z) => {
      if ((d.from != null && y > d.from) || (d.to != null && y < d.to)) return 0;
      const u = x * ac[0] + y * ac[1] + z * ac[2], v = x * ax[0] + y * ax[1] + z * ax[2], fade = d.from != null && d.to != null ? Math.sin(Math.PI * Math.min(1, Math.max(0, (d.from - y) / (d.from - d.to)))) : 1;
      return d.amp * fade * Math.sin(u * d.freq * 2 * Math.PI + (d.wobble || 0.6) * Math.sin(v * 7) + 2 * fbm(u * 5, v * 3, 0)); }; }
    if (d.t === "wrinkles") return (x, y, z) => { const r = len(x - d.c[0], y - d.c[1], z - d.c[2]); return r > d.r ? 0 : d.amp * (1 - r / d.r) * Math.sin((y - d.c[1]) * d.freq * 2 * Math.PI + 3 * noise(x * 20, z * 20, 0)); };
    if (d.t === "noise") return (x, y, z) => d.amp * fbm(x / d.scale, y / d.scale, z / d.scale);
    if (d.t === "pocks") return (x, y, z) => { const n = noise(x / d.scale + 31, y / d.scale, z / d.scale); return n > 0.72 ? d.amp * (n - 0.72) / 0.28 : 0; };
    throw new Error(`forge: unknown displacement ${d.t}`);
  });
  return (x, y, z) => { let v = 0; for (const f of fs) v += f(x, y, z); return v; };
}
