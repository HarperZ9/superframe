// The generated world as the traversal holds it: typed arrays, lookups in metres, and the two
// maps the ground shader reads (colour, and normal with canopy and lamp glow).
import { parsePgm } from "../pgm.mjs";

export async function loadWorld(base, onProgress = () => {}) {
  const names = ["height", "water", "biome", "region", "river", "moist"], got = {};
  const json = await (await fetch(`${base}/world.json`)).json();
  let done = 0;
  await Promise.all(names.map(async (n) => {
    const r = await fetch(`${base}/${n}.pgm`);
    if (!r.ok) throw new Error(`world: ${base}/${n}.pgm is missing. Run the generator (games/low-water/world/README.md).`);
    got[n] = parsePgm(new Uint8Array(await r.arrayBuffer()));
    onProgress(++done / names.length, n);
  }));
  const W = json.width, H = json.height, cell = json.cell_m, n = W * H;
  const height = new Float32Array(n), water = new Float32Array(n);
  for (let i = 0; i < n; i++) { height[i] = got.height.data[i] / 16 - 512; water[i] = got.water.data[i] > 0 ? got.water.data[i] / 16 - 512 : -512; }
  return { json, W, H, cell, width: W * cell, depth: H * cell, height, water, biome: Uint8Array.from(got.biome.data), region: Uint8Array.from(got.region.data), river: Uint8Array.from(got.river.data), moist: Uint8Array.from(got.moist.data) };
}

const clampi = (v, a, b) => v < a ? a : v > b ? b : v;
// raster height in metres at a point in metres, the same bilinear rule the shader uses
export function heightAt(w, x, z) {
  const qx = x / w.cell - 0.5, qz = z / w.cell - 0.5, ix = Math.floor(qx), iz = Math.floor(qz), fx = qx - ix, fz = qz - iz;
  const x0 = clampi(ix, 0, w.W - 1), x1 = clampi(ix + 1, 0, w.W - 1), z0 = clampi(iz, 0, w.H - 1), z1 = clampi(iz + 1, 0, w.H - 1), h = w.height;
  return (h[z0 * w.W + x0] * (1 - fx) + h[z0 * w.W + x1] * fx) * (1 - fz) + (h[z1 * w.W + x0] * (1 - fx) + h[z1 * w.W + x1] * fx) * fz;
}
// the lattice noise and relief of common.wgsl, to the same bits up to float rounding
function ihash(x, y) {
  let h = (Math.imul(x | 0, 0x9e3779b1) ^ Math.imul(y | 0, 0x85ebca77)) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12; h = Math.imul(h, 0x297a2d39) >>> 0; h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
function lnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  return (ihash(ix, iy) * (1 - ux) + ihash(ix + 1, iy) * ux) * (1 - uy) + (ihash(ix, iy + 1) * (1 - ux) + ihash(ix + 1, iy + 1) * ux) * uy;
}
function builtAt(w, x, z) {
  if (!w.built) return 0;
  const qx = x / w.cell - 0.5, qz = z / w.cell - 0.5, ix = Math.floor(qx), iz = Math.floor(qz), fx = qx - ix, fz = qz - iz, b = w.built;
  const x0 = clampi(ix, 0, w.W - 1), x1 = clampi(ix + 1, 0, w.W - 1), z0 = clampi(iz, 0, w.H - 1), z1 = clampi(iz + 1, 0, w.H - 1);
  return ((b[z0 * w.W + x0] * (1 - fx) + b[z0 * w.W + x1] * fx) * (1 - fz) + (b[z1 * w.W + x0] * (1 - fx) + b[z1 * w.W + x1] * fx) * fz) / 255;
}
// the ground a walker stands on: the raster plus the small relief the shader adds near the eye
export function groundAt(w, x, z) {
  const y = heightAt(w, x, z), relief = (lnoise(x / 16, z / 16) - 0.5) * 3.2 + (lnoise(x / 4 + 50, z / 4 + 50) - 0.5) * 0.6;
  return y + relief * (1 - builtAt(w, x, z)) * Math.min(1, Math.max(0, y));
}
export const cellAt = (w, x, z) => clampi(Math.floor(z / w.cell), 0, w.H - 1) * w.W + clampi(Math.floor(x / w.cell), 0, w.W - 1);
export const regionAt = (w, x, z) => w.region[cellAt(w, x, z)];
export const waterAt = (w, x, z) => w.water[cellAt(w, x, z)];

function hash2(x, y) {
  let h = (Math.imul(x | 0, 0x9e3779b1) ^ Math.imul(y | 0, 0x85ebca77)) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}
export { hash2 };
function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  return (hash2(ix, iy) * (1 - ux) + hash2(ix + 1, iy) * ux) * (1 - uy) + (hash2(ix, iy + 1) * (1 - ux) + hash2(ix + 1, iy + 1) * ux) * uy;
}

// Ground colour by cover. The land keeps a low-chroma base of blue-grey and umber; green is deep
// in the forest and bright only on upland pasture; the badlands band in rust, pink and ochre.
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function coverColour(b, region, h, m, x, y) {
  const n = vnoise(x / 23, y / 23), n2 = vnoise(x / 5 + 40, y / 5);
  switch (b) {
    case 0: return mix3([0.20, 0.20, 0.17], [0.10, 0.11, 0.11], Math.min(1, -h / 30));
    case 1: return [0.11, 0.12, 0.11];
    case 2: return region === 4 ? [0.24, 0.24, 0.25] : [0.44, 0.41, 0.35];
    case 3: return mix3([0.23, 0.25, 0.17], [0.47, 0.41, 0.23], n2 > 0.55 ? 0.8 : 0.1);
    case 4: return region === 2 ? mix3([0.26, 0.40, 0.17], [0.36, 0.44, 0.20], n) : mix3([0.22, 0.26, 0.19], [0.30, 0.31, 0.22], n);
    case 5: return n2 > 0.86 ? mix3([0.30, 0.22, 0.10], [0.40, 0.29, 0.11], n) : mix3([0.06, 0.11, 0.10], [0.10, 0.16, 0.13], n);
    case 6: return mix3([0.26, 0.25, 0.23], [0.37, 0.34, 0.28], n);
    case 7: return [0.80, 0.84, 0.90];
    case 8: return mix3([0.34, 0.33, 0.35], [0.44, 0.42, 0.42], n);
    case 9: return [0.90, 0.93, 0.97];
    case 10: {
      // strata: the colour turns with height, so canyon walls show bands
      const band = (Math.sin(h / 23 + n * 2) + Math.sin(h / 61 + 1.7)) * 0.25 + 0.5;
      const base = mix3([0.50, 0.26, 0.16], [0.74, 0.55, 0.38], band);
      const odd = Math.sin(h / 37 + 4) > 0.86 ? [0.72, 0.52, 0.56] : Math.sin(h / 47 + 2) > 0.92 ? [0.48, 0.52, 0.62] : base;
      return mix3(base, odd, 0.7);
    }
    case 11: return region === 5 || region === 9 ? mix3([0.46, 0.40, 0.28], [0.56, 0.48, 0.32], n) : mix3([0.33, 0.31, 0.25], [0.41, 0.37, 0.28], n);
    case 12: return mix3([0.25, 0.21, 0.20], [0.33, 0.26, 0.23], n);
    default: return region === 4 ? [0.13, 0.13, 0.15] : [0.29, 0.28, 0.28];
  }
}
// how thickly trees stand on a cover, 0 to 1
export const CANOPY = [0, 0, 0, 0.06, 0.015, 0.95, 0.45, 0, 0, 0, 0, 0.008, 0.01, 0];

// colour (rgb, a = river) and aux (normal x, normal z, canopy, lamp glow), both RGBA8
export function bakeMaps(w) {
  const { W, H } = w, n = W * H, alb = new Uint8Array(n * 4), aux = new Uint8Array(n * 4), glow = new Float32Array(n), road = new Uint8Array(n);
  for (const r of w.json.roads) for (let i = 0; i < r.pts.length; i += 2) {
    const k = r.pts[i + 1] * W + r.pts[i]; road[k] = Math.max(road[k], r.kind === "path" ? 1 : 2);
    // a road point stands for a 4 x 4 block; mark a line toward the next point
    if (i + 3 < r.pts.length) { const x1 = r.pts[i + 2], y1 = r.pts[i + 3]; for (let t = 1; t < 4; t++) { const k2 = Math.round(r.pts[i + 1] + (y1 - r.pts[i + 1]) * t / 4) * W + Math.round(r.pts[i] + (x1 - r.pts[i]) * t / 4); road[k2] = Math.max(road[k2], r.kind === "path" ? 1 : 2); } }
  }
  const lamp = (cx, cy, radius, strength) => {
    const r = Math.ceil(radius);
    for (let y = Math.max(0, cy - r); y <= Math.min(H - 1, cy + r); y++) for (let x = Math.max(0, cx - r); x <= Math.min(W - 1, cx + r); x++) {
      const d = Math.hypot(x - cx, y - cy) / radius; if (d < 1) glow[y * W + x] = Math.max(glow[y * W + x], strength * (1 - d) * (1 - d));
    }
  };
  for (const s of w.json.settlements) lamp(s.x, s.y, s.kind === "seat" ? 12 : s.kind === "town" ? 9 : s.kind === "village" ? 4 : 1.5, s.kind === "house" ? 0.5 : 1);
  const BRIGHT = { furnace: [8, 1], stack: [3, 0.6], tenement: [3, 0.8], decotower: [4, 1], slab: [3, 0.8], tower: [8, 0.8], spire: [5, 0.6], lighthouse: [5, 1], coolingtower: [5, 0.7], piperack: [4, 0.7], glasshall: [4, 1] };
  for (const m of w.json.marks) if (BRIGHT[m.kind]) lamp(m.x, m.y, BRIGHT[m.kind][0], BRIGHT[m.kind][1]);
  const hgt = w.height;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = y * W + x, h = hgt[k], b = w.biome[k];
    let c = coverColour(b, w.region[k], h, w.moist[k] / 255, x, y);
    if (road[k] && h > 0) c = mix3(c, [0.52, 0.48, 0.41], road[k] === 2 ? 0.6 : 0.3);
    if (glow[k] > 0.3 && h > 0) c = mix3(c, [0.34, 0.32, 0.30], Math.min(0.7, glow[k]));
    alb[k * 4] = c[0] * 255; alb[k * 4 + 1] = c[1] * 255; alb[k * 4 + 2] = c[2] * 255; alb[k * 4 + 3] = Math.min(255, w.river[k] * 2.2);
    const xe = Math.min(W - 1, x + 1), xw = Math.max(0, x - 1), ys = Math.min(H - 1, y + 1), yn = Math.max(0, y - 1);
    const dx = (hgt[y * W + xe] - hgt[y * W + xw]) / (2 * w.cell), dz = (hgt[ys * W + x] - hgt[yn * W + x]) / (2 * w.cell), l = Math.hypot(dx, dz, 1);
    aux[k * 4] = (-dx / l * 0.5 + 0.5) * 255; aux[k * 4 + 1] = (-dz / l * 0.5 + 0.5) * 255; aux[k * 4 + 2] = CANOPY[b] * 255; aux[k * 4 + 3] = Math.min(1, glow[k]) * 255;
  }
  w.built = new Uint8Array(n); for (let k = 0; k < n; k++) w.built[k] = aux[k * 4 + 3];
  return { alb, aux };
}

// lowest and highest ground in every 128 m block, then every level above, for the quadtree
export function heightPyramid(w) {
  const B = 2, bw = w.W / B, bh = w.H / B, levels = [];
  let lo = new Float32Array(bw * bh).fill(1e9), hi = new Float32Array(bw * bh).fill(-1e9);
  for (let y = 0; y < w.H; y++) for (let x = 0; x < w.W; x++) { const k = (y / B | 0) * bw + (x / B | 0), h = w.height[y * w.W + x]; if (h < lo[k]) lo[k] = h; if (h > hi[k]) hi[k] = h; }
  levels.push({ w: bw, h: bh, lo, hi });
  for (let l = 1; l <= 8; l++) {
    const p = levels[l - 1], nw = p.w / 2, nh = p.h / 2, nlo = new Float32Array(nw * nh), nhi = new Float32Array(nw * nh);
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
      const a = 2 * y * p.w + 2 * x, b = a + 1, c = a + p.w, d = c + 1;
      nlo[y * nw + x] = Math.min(p.lo[a], p.lo[b], p.lo[c], p.lo[d]); nhi[y * nw + x] = Math.max(p.hi[a], p.hi[b], p.hi[c], p.hi[d]);
    }
    levels.push({ w: nw, h: nh, lo: nlo, hi: nhi });
  }
  return levels;
}
