// Glyph's own lighting, per cell, from the scene's lights (never from the painting):
//   ambient   by the hour (a cold sky at night, warm by day), weighted by how far the cell faces up
//   lamps     I (1 - d/r)^2 max(0, n.l), with the place file's intensities taken as their square root
//   moon/sun  a directional light by the hour
//   shadows   a march from the cell's world point toward the light: wherever the march passes under a
//             surface (the cell it projects into shows a surface higher than the march point, within a
//             cell's width of it), the light is blocked. 2.5D: what the camera cannot see cannot cast.
// Static lights are baked per place, variant and zoom; the carried lantern is added per frame within
// its reach. Light is linear RGB, about 1 for a well lit surface. Original code.
//   bakeLight(C, { lights, hour, kinds }) -> Float32Array (3 per cell), and the cells that emit
//   addLantern(C, E, L, out) -> out (E plus the lantern, for the cells in its reach)
import { projectPlate } from "../../world/camera.mjs";

const KIND_RGB = { sodium: [1.0, 0.56, 0.18], paraffin: [1.0, 0.72, 0.42], white: [0.86, 0.92, 1.0], arc: [0.86, 0.95, 1.0], beam: [0.9, 1.0, 0.9], sky: [0.5, 0.6, 0.9] };
export function skyOf(hour) {
  const h = ((hour % 24) + 24) % 24, day = h > 6.5 && h < 19 ? Math.sin(((h - 6.5) / 12.5) * Math.PI) : 0, dusk = Math.max(0, 1 - Math.abs(h - 6.3) / 1.2) + Math.max(0, 1 - Math.abs(h - 19.2) / 1.2);
  const amb = [0.035 + 0.38 * day + 0.08 * dusk, 0.04 + 0.4 * day + 0.05 * dusk, 0.075 + 0.42 * day + 0.04 * dusk];
  const dir = day > 0 ? [-0.35, 0.8, 0.45] : [0.3, 0.85, 0.42], col = day > 0 ? [1.1 * day + 0.3 * dusk, 1.0 * day + 0.15 * dusk, 0.85 * day] : [0.1, 0.12, 0.2];
  const l = Math.hypot(...dir); return { amb, dir: dir.map((v) => v / l), col };
}

// is the segment from cell c's point toward world point L blocked? (the march through the cells)
// the march's projection inlined (orthographic: a world point to plate pixels is affine), its basis cached per place
const basisCache = new WeakMap();
function basisOf(pj) {
  let b = basisCache.get(pj); if (b) return b;
  const o = projectPlate(pj.camera, pj.width, pj.height, [0, 0, 0]), ex = projectPlate(pj.camera, pj.width, pj.height, [1, 0, 0]), ey = projectPlate(pj.camera, pj.width, pj.height, [0, 1, 0]), ez = projectPlate(pj.camera, pj.width, pj.height, [0, 0, 1]);
  b = { o, x: [ex[0] - o[0], ex[1] - o[1]], y: [ey[0] - o[0], ey[1] - o[1]], z: [ez[0] - o[0], ez[1] - o[1]] }; basisCache.set(pj, b); return b;
}
function blocked(C, c, Lx, Ly, Lz, steps = 14) {
  const px = C.P[c * 3], py = C.P[c * 3 + 1] + 0.05, pz = C.P[c * 3 + 2], B = basisOf(C.pj), cell = Math.max(0.6, (C.pw * 1.4) / (C.ppm || 80));
  for (let k = 1; k < steps; k++) {
    const t = k / steps, x = px + (Lx - px) * t, y = py + (Ly - py) * t, z = pz + (Lz - pz) * t;
    const sx = B.o[0] + B.x[0] * x + B.y[0] * y + B.z[0] * z, sy = B.o[1] + B.x[1] * x + B.y[1] * y + B.z[1] * z, I = Math.floor(sx / C.pw), J = Math.floor(sy / C.ph);
    if (I < 0 || J < 0 || I >= C.nI || J >= C.nJ) return false;
    const q = J * C.nI + I, qy = C.P[q * 3 + 1]; if (!(qy > y + 0.08)) continue;
    const dx = C.P[q * 3] - x, dz = C.P[q * 3 + 2] - z; if (dx * dx + dz * dz < cell * cell) return true;
  }
  return false;
}

export function bakeLight(C, { lights = [], hour = 23, kinds = [], tint = [1, 1, 1] }) {
  const n = C.nI * C.nJ, E = new Float32Array(n * 3), s0 = skyOf(hour), sky = { ...s0, amb: s0.amb.map((v, i) => v * tint[i]), col: s0.col.map((v, i) => v * tint[i]) };   // the era's sky (glyph/eras.mjs)
  const lamps = lights.map((L) => ({ x: L.at[0], y: L.at[1], z: L.at[2], r: L.reach || 6, e: Math.sqrt(L.I || 1) * 0.3, c: KIND_RGB[L.kind] || KIND_RGB.paraffin }));
  // lamps bucketed on a 4 m grid so each cell tries only those in reach
  const grid = new Map(), key = (x, z) => `${Math.floor(x / 4)},${Math.floor(z / 4)}`;
  for (const L of lamps) for (let dx = -Math.ceil(L.r / 4); dx <= Math.ceil(L.r / 4); dx++) for (let dz = -Math.ceil(L.r / 4); dz <= Math.ceil(L.r / 4); dz++) { const k = `${Math.floor(L.x / 4) + dx},${Math.floor(L.z / 4) + dz}`; (grid.get(k) || grid.set(k, []).get(k)).push(L); }
  for (let c = 0; c < n; c++) {
    const py = C.P[c * 3 + 1]; if (!Number.isFinite(py)) continue;
    const px = C.P[c * 3], pz = C.P[c * 3 + 2], nx = C.N[c * 3], ny = C.N[c * 3 + 1], nz = C.N[c * 3 + 2], up = 0.4 + 0.6 * Math.max(0, ny);
    let r = sky.amb[0] * up, g = sky.amb[1] * up, b = sky.amb[2] * up;
    const ndl = nx * sky.dir[0] + ny * sky.dir[1] + nz * sky.dir[2];
    if (ndl > 0 && !blocked(C, c, px + sky.dir[0] * 30, py + sky.dir[1] * 30, pz + sky.dir[2] * 30, 10)) { r += sky.col[0] * ndl; g += sky.col[1] * ndl; b += sky.col[2] * ndl; }
    for (const L of grid.get(key(px, pz)) || []) {
      const dx = L.x - px, dy = L.y - py, dz = L.z - pz, d = Math.hypot(dx, dy, dz); if (d >= L.r || d < 1e-3) continue;
      const nl = (nx * dx + ny * dy + nz * dz) / d; if (nl <= 0) continue;
      const fall = (1 - d / L.r) ** 2, e = L.e * fall * (0.25 + 0.75 * nl); if (e < 0.01) continue;
      if (blocked(C, c, L.x, L.y, L.z)) continue;
      r += L.c[0] * e; g += L.c[1] * e; b += L.c[2] * e;
    }
    E[c * 3] = r; E[c * 3 + 1] = g; E[c * 3 + 2] = b;
  }
  return E;
}

// the carried lantern: E plus its light for the cells within reach (shadowed the same way)
export function addLantern(C, E, L, out, { I = 1.6, reach = 4.5, c = KIND_RGB.paraffin } = {}) {
  // out starts as a copy of E once; after that only the cells the lantern touched last time are restored
  if (!out.__init) { out.set(E); out.__init = true; out.__touched = []; }
  for (const k of out.__touched) { out[k * 3] = E[k * 3]; out[k * 3 + 1] = E[k * 3 + 1]; out[k * 3 + 2] = E[k * 3 + 2]; }
  const touched = (out.__touched = []);
  const s = projectPlate(C.pj.camera, C.pj.width, C.pj.height, L), R = (reach * (C.ppm || 80)) / C.pw + 2;
  const I0 = Math.floor(s[0] / C.pw - R), I1 = Math.ceil(s[0] / C.pw + R), J0 = Math.floor(s[1] / C.ph - R * 1.3), J1 = Math.ceil(s[1] / C.ph + R * 1.6), e0 = Math.sqrt(I) * 0.45;
  for (let J = Math.max(0, J0); J < Math.min(C.nJ, J1); J++) for (let Ic = Math.max(0, I0); Ic < Math.min(C.nI, I1); Ic++) {
    const k = J * C.nI + Ic, py = C.P[k * 3 + 1]; if (!Number.isFinite(py)) continue;
    const dx = L[0] - C.P[k * 3], dy = L[1] - py, dz = L[2] - C.P[k * 3 + 2], d = Math.hypot(dx, dy, dz); if (d >= reach) continue;
    const nl = (C.N[k * 3] * dx + C.N[k * 3 + 1] * dy + C.N[k * 3 + 2] * dz) / (d || 1); if (nl <= 0) continue;
    const e = e0 * (1 - d / reach) ** 2 * (0.25 + 0.75 * nl); if (e < 0.01 || blocked(C, k, L[0], L[1], L[2], 8)) continue;
    out[k * 3] += c[0] * e; out[k * 3 + 1] += c[1] * e; out[k * 3 + 2] += c[2] * e; touched.push(k);
  }
  return out;
}
