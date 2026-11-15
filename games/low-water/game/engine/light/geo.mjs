// Geometry for the light field, over a plate's geo buffers (geo-pos.f32: a world point per sample at the
// plate's geoScale, NaN or 0,0,0 where nothing was painted; geo-id.u8: the material id). Normals from the
// points, a horizon occlusion from the points around, and a shadow march through the samples (2.5D: what
// the camera cannot see cannot cast). Original code.
//   geoDims(pj)                        -> [w, h] sample grid
//   normalsOf(pj, pos)                 -> Float32Array(3 n), NaN where a sample has no single surface
//   occlusionOf(pj, pos, N)            -> Uint8Array(n), 0 open .. 255 enclosed
//   marcher(pj, pos)                   -> blocked(i, Lx, Ly, Lz, steps) : is sample i's path to L blocked?
import { projectPlate } from "../world/camera.mjs";
import { camBasis } from "../world/plateworld.mjs";

export const geoDims = (pj) => { const s = pj.geoScale || 1; return [Math.round(pj.width * s), Math.round(pj.height * s)]; };
// a sample holds a surface: finite, not the bake's empty 0,0,0, not its sky (y 1000)
export const ok = (pos, i) => { const y = pos[i * 3 + 1]; return Number.isFinite(y) && y < 500 && !(pos[i * 3] === 0 && y === 0 && pos[i * 3 + 2] === 0); };

// rows: [y0, y1) to work in bands (steps.mjs spreads a large plate over idle time); out: the array to fill
export function normalsOf(pj, pos, { rows = null, out = null } = {}) {
  const [w, h] = geoDims(pj), N = out || new Float32Array(w * h * 3).fill(NaN), B = basis(pj), f = B.f;
  for (let y = Math.max(1, rows ? rows[0] : 1); y < Math.min(h - 1, rows ? rows[1] : h); y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x; if (!ok(pos, i)) continue;
    const a = ok(pos, i + 1) ? i + 1 : i, b = ok(pos, i - 1) ? i - 1 : i, c = ok(pos, i + w) ? i + w : i, d = ok(pos, i - w) ? i - w : i;
    if (a === b || c === d) continue;
    const ux = pos[a * 3] - pos[b * 3], uy = pos[a * 3 + 1] - pos[b * 3 + 1], uz = pos[a * 3 + 2] - pos[b * 3 + 2], vx = pos[c * 3] - pos[d * 3], vy = pos[c * 3 + 1] - pos[d * 3 + 1], vz = pos[c * 3 + 2] - pos[d * 3 + 2];
    if (ux * ux + uy * uy + uz * uz > 0.25 || vx * vx + vy * vy + vz * vz > 0.25) continue;   // a step or an edge between two surfaces
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * f[0] + ny * f[1] + nz * f[2] > 0) { nx = -nx; ny = -ny; nz = -nz; }   // toward the camera
    const l = Math.hypot(nx, ny, nz); if (l < 1e-9) continue; N[i * 3] = nx / l; N[i * 3 + 1] = ny / l; N[i * 3 + 2] = nz / l;
  }
  return N;
}
// how much of the hemisphere over a sample its neighbours (0.6 m round, 8 ways) rise above its plane
export function occlusionOf(pj, pos, N, { radius = 0.6, rows = null, out = null } = {}) {
  const [w, h] = geoDims(pj), n = w * h, O = out || new Uint8Array(n), r = Math.max(2, Math.round(radius * (pj.pxPerMetre || 40) * (pj.geoScale || 1)));
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]].map(([a, b]) => [Math.round((a * r) / Math.hypot(a, b)), Math.round((b * r) / Math.hypot(a, b))]);
  for (let y = rows ? rows[0] : 0; y < (rows ? Math.min(h, rows[1]) : h); y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (!Number.isFinite(N[i * 3])) continue;
    const px = pos[i * 3], py = pos[i * 3 + 1], pz = pos[i * 3 + 2], nx = N[i * 3], ny = N[i * 3 + 1], nz = N[i * 3 + 2]; let occ = 0;
    for (const [dx, dy] of dirs) {
      const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue; const j = Y * w + X; if (!ok(pos, j)) continue;
      const qx = pos[j * 3] - px, qy = pos[j * 3 + 1] - py, qz = pos[j * 3 + 2] - pz, d = Math.hypot(qx, qy, qz); if (d < 1e-3 || d > radius * 2.5) continue;
      const s = (qx * nx + qy * ny + qz * nz) / d; if (s > 0.15) occ += Math.min(1, (s - 0.15) * 1.6) * (1 - d / (radius * 2.5));
    }
    O[i] = Math.min(255, Math.round((occ / 8) * 2 * 255));
  }
  return O;
}
// the plate projection is affine for an orthographic camera: world to sample coordinates by a basis
export function basis(pj) {
  const s = pj.geoScale || 1, P = (p) => projectPlate(pj.camera, pj.width, pj.height, p), o = P([0, 0, 0]), ex = P([1, 0, 0]), ey = P([0, 1, 0]), ez = P([0, 0, 1]);
  const yaw = ((pj.camera.yawDeg || 0) * Math.PI) / 180, el = ((pj.camera.elevDeg || 30) * Math.PI) / 180;
  return { s, o: [o[0] * s, o[1] * s], x: [(ex[0] - o[0]) * s, (ex[1] - o[1]) * s], y: [(ey[0] - o[0]) * s, (ey[1] - o[1]) * s], z: [(ez[0] - o[0]) * s, (ez[1] - o[1]) * s], f: [-Math.sin(yaw) * Math.cos(el), -Math.sin(el), -Math.cos(yaw) * Math.cos(el)] };
}
// screen-space shadows through the samples: a point on the way to the light is hidden when the surface the
// camera sees at its place on the plate lies nearer the camera than it (by more than a few centimetres) and not
// so much nearer that it must be a different, unconnected thing in front (a thickness of 1.2 m)
export function marcher(pj, pos) {
  const [w, h] = geoDims(pj), B = basis(pj), C = camBasis(pj.camera), f = C.f, cp = C.pos;
  const depth = (x, y, z) => (x - cp[0]) * f[0] + (y - cp[1]) * f[1] + (z - cp[2]) * f[2];
  return function blocked(i, Lx, Ly, Lz, steps = 16) {
    const px = pos[i * 3], py = pos[i * 3 + 1] + 0.05, pz = pos[i * 3 + 2], dist = Math.hypot(Lx - px, Ly - py, Lz - pz), n = Math.max(4, Math.min(steps, Math.ceil(dist / 0.2)));
    for (let k = 1; k < n; k++) {
      const t = k / n; if (t * dist < 0.12) continue;
      const x = px + (Lx - px) * t, y = py + (Ly - py) * t, z = pz + (Lz - pz) * t;
      const sx = B.o[0] + B.x[0] * x + B.y[0] * y + B.z[0] * z, sy = B.o[1] + B.x[1] * x + B.y[1] * y + B.z[1] * z, X = sx | 0, Y = sy | 0;
      if (X < 0 || Y < 0 || X >= w || Y >= h) return false;
      const q = Y * w + X; if (!ok(pos, q)) continue;
      const gap = depth(x, y, z) - depth(pos[q * 3], pos[q * 3 + 1], pos[q * 3 + 2]); if (gap > 0.06 && gap < 1.2) return true;
    }
    return false;
  };
}
