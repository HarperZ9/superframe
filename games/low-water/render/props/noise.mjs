// Deterministic 3D value noise and hashes for authored props (Low Water environment pilot, 2026-10-23).
// Original code. Everything here is a pure function of its inputs, so a bake is reproducible.
const H = (x, y, z) => { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 1274126177)) | 0; h = Math.imul(h ^ (h >>> 13), 1597334677); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
export const hash = H;
export function n3(x, y, z) {
  const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z), fx = x - x0, fy = y - y0, fz = z - z0;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const a = H(x0, y0, z0), b = H(x0 + 1, y0, z0), c = H(x0, y0 + 1, z0), d = H(x0 + 1, y0 + 1, z0);
  const e = H(x0, y0, z0 + 1), f = H(x0 + 1, y0, z0 + 1), g = H(x0, y0 + 1, z0 + 1), h = H(x0 + 1, y0 + 1, z0 + 1);
  return ((a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v) * (1 - w) + ((e * (1 - u) + f * u) * (1 - v) + (g * (1 - u) + h * u) * v) * w;
}
export const fb3 = (x, y, z) => 0.58 * n3(x, y, z) + 0.28 * n3(x * 2.13 + 7, y * 2.13, z * 2.13) + 0.14 * n3(x * 4.37, y * 4.37 + 3, z * 4.37);
export const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const smax = (a, b, k) => { const h = Math.min(1, Math.max(0, 0.5 - (0.5 * (b - a)) / k)); return b * (1 - h) + a * h + k * h * (1 - h); };
export const smin = (a, b, k) => -smax(-a, -b, k);
