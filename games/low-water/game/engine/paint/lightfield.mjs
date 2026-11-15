// Light fields over a plate's geo buffers (world point per plate sample, half the plate's size):
// surface normals, the wet mask, the lamps' glossy reflections in wet ground, and a moving light's
// pool. Everything is computed in the plate's own samples, so it is anchored to the world and the
// camera's pan only moves it as it moves the painting. Original code.
//   groundNormals(pj, pos) -> Float32Array (3 per sample, NaN where nothing was painted)
//   wetMask(pj, pos, ids, N, { rain }) -> { k: Float32Array 0..1, rough: Float32Array, canvas }
//   glossLobe(pj, pos, N, wet, lights, opt) -> { canvas, x0, y0 } | null      (plate sample coordinates)
//   poolField(pj, pos, N, wet, L, opt) -> { pool, glint, x0, y0 } | null
import { projectPlate } from "../world/camera.mjs";
import { camBasis } from "../world/plateworld.mjs";

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
// world-anchored value noise (a lattice hash), for band edges and ripples
const hh = (i, j) => { let x = Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul(j | 0, 0x165667b1); x = Math.imul(x ^ (x >>> 15), 0x85ebca6b); x ^= x >>> 13; return (x >>> 0) / 4294967296; };
export function noise2(x, y) { const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); return (hh(i, j) * (1 - u) + hh(i + 1, j) * u) * (1 - v) + (hh(i, j + 1) * (1 - u) + hh(i + 1, j + 1) * u) * v; }
const dims = (pj) => { const s = pj.geoScale || 1; return [Math.round(pj.width * s), Math.round(pj.height * s)]; };
const KIND_WET = { water: [1, 0.03], mud: [0.85, 0.06], sand: [0.5, 0.1], weed: [0.45, 0.12], shingle: [0.35, 0.14], stone: [0, 0.06], wood: [0, 0.09] };
const RAIN_WET = { stone: 0.65, wood: 0.4 };

export function groundNormals(pj, pos) {
  const [w, h] = dims(pj), N = new Float32Array(w * h * 3).fill(NaN);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x, a = (i + 1) * 3, b = (i - 1) * 3, c = (i + w) * 3, d = (i - w) * 3;
    if (!Number.isFinite(pos[i * 3 + 1]) || !Number.isFinite(pos[a + 1]) || !Number.isFinite(pos[b + 1]) || !Number.isFinite(pos[c + 1]) || !Number.isFinite(pos[d + 1])) continue;
    if (Math.abs(pos[a + 1] - pos[b + 1]) > 0.15 || Math.abs(pos[c + 1] - pos[d + 1]) > 0.15) continue;   // an edge or a step: no single surface
    const ux = pos[a] - pos[b], uy = pos[a + 1] - pos[b + 1], uz = pos[a + 2] - pos[b + 2], vx = pos[c] - pos[d], vy = pos[c + 1] - pos[d + 1], vz = pos[c + 2] - pos[d + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const l = Math.hypot(nx, ny, nz); if (l < 1e-9) continue; N[i * 3] = nx / l; N[i * 3 + 1] = ny / l; N[i * 3 + 2] = nz / l;
  }
  return N;
}

// how wet each sample is (by its footing kind, and by rain), and how rough its gloss
export function wetMask(pj, pos, ids, N, { rain = false } = {}) {
  const [w, h] = dims(pj), k = new Float32Array(w * h), rough = new Float32Array(w * h), foot = pj.footing || {}; let lowY = Infinity, highY = -Infinity;
  const c = new OffscreenCanvas(w, h), img = new ImageData(w, h), o = img.data;
  for (let i = 0; i < w * h; i++) {
    const ny = N[i * 3 + 1]; if (!(ny > 0.85)) continue;   // only ground that faces up holds water
    const kind = foot[ids[i]] || "stone", base = KIND_WET[kind] || [0, 0.1];
    let wet = base[0]; if (rain) wet = Math.max(wet, RAIN_WET[kind] || 0.5);
    if (wet <= 0) continue;
    // puddles: wetness pools where the world noise is low, so wet stone is patchy, not a mirror
    const px = pos[i * 3], pz = pos[i * 3 + 2], puddle = ss(0.35, 0.65, noise2(px * 0.9 + 17, pz * 0.9 - 4));
    k[i] = wet * (kind === "water" ? 1 : 0.35 + 0.65 * puddle); rough[i] = base[1] * (1.4 - 0.6 * puddle);
    o[i * 4 + 3] = Math.round(255 * clamp(k[i] * 1.4));
    if (pos[i * 3 + 1] < lowY) lowY = pos[i * 3 + 1]; if (pos[i * 3 + 1] > highY) highY = pos[i * 3 + 1];
  }
  c.getContext("2d").putImageData(img, 0, 0);
  return { k, rough, canvas: c, lowY, highY };
}

// The glossy reflection of point lights in wet ground: at each wet sample, the camera's ray reflected
// about the sample's (rippled) normal; a lobe about it, as wide as the surface's roughness, picks up
// each light near that direction, by the light's intensity, a Schlick Fresnel term and the distance.
// The upright wet-street streak is what this lobe draws under a low camera; nothing stretches it.
// Values are laid in three painted bands. Written opaque where lit, transparent elsewhere: an
// additive layer (drawn with "lighter", shown with plus-lighter).
export function lobeInto(o, ow, ox, oy, w, x0, y0, x1, y1, pos, N, wet, L, col, gain, B) {
  const f = B.f, Lp = L.at, I = L.I || 1;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = y * w + x, k = wet.k[i]; if (!(k > 0)) continue;
    const px = pos[i * 3], py = pos[i * 3 + 1], pz = pos[i * 3 + 2];
    // ripples: the normal tilted by world-anchored noise
    let nx = N[i * 3] + (noise2(px * 2.1, pz * 1.3) - 0.5) * 0.05, ny = N[i * 3 + 1], nz = N[i * 3 + 2] + (noise2(px * 1.7 + 9, pz * 2.6) - 0.5) * 0.05;
    const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
    const vn = f[0] * nx + f[1] * ny + f[2] * nz, rx = f[0] - 2 * vn * nx, ry = f[1] - 2 * vn * ny, rz = f[2] - 2 * vn * nz;
    let lx = Lp[0] - px, ly = Lp[1] - py, lz = Lp[2] - pz; const d = Math.hypot(lx, ly, lz); if (d < 0.5 || ly < 0.25) continue;   // a light lying on the surface (a candle on a step) gives no mirror image there lx /= d; ly /= d; lz /= d;
    const c = clamp(rx * lx + ry * ly + rz * lz, -1, 1), th = Math.acos(c), sg = wet.rough[i] || 0.08;
    const lobe = Math.exp(-(th * th) / (2 * sg * sg)); if (lobe < 0.01) continue;
    const cosI = clamp(-vn), F = 0.04 + 0.96 * Math.pow(1 - cosI, 5);
    let e = Math.min(1, gain * Math.sqrt(I) * lobe * F * k / (1 + 0.05 * d * d));
    // three painted bands, their edges moved by the same world noise
    const q = e + (noise2(px * 2.3, pz * 2.3) - 0.5) * 0.04, band = q > 0.5 ? 0.85 : q > 0.25 ? 0.5 : q > 0.12 ? 0.22 : 0;
    e = band; if (e <= 0) continue;
    const j = ((y - oy) * ow + (x - ox)) * 4; o[j] = Math.min(255, o[j] + col[0] * e * 255); o[j + 1] = Math.min(255, o[j + 1] + col[1] * e * 255); o[j + 2] = Math.min(255, o[j + 2] + col[2] * e * 255); o[j + 3] = 255;
  }
}
// a lamp's head is far brighter than anything it lights; the place files' intensities run from 1.6
// (a paraffin window) to 48 (a sodium head), taken here as the square root, so with the Fresnel term at
// this camera's grazing angle (about 0.07) a sodium head's reflection peaks near half the display's white
const GAIN = 1.1;
const KIND_RGB = { sodium: [1.0, 0.6, 0.22], paraffin: [1.0, 0.74, 0.44], white: [0.86, 0.92, 1.0], arc: [0.86, 0.95, 1.0], beam: [0.92, 1.0, 0.92], sky: [0.6, 0.7, 0.9] };
export function glossLobe(pj, pos, N, wet, lights, { gain = GAIN } = {}) {
  const [w, h] = dims(pj), B = camBasis(pj.camera), img = new ImageData(w, h), o = img.data; let any = false;
  let bx0 = w, by0 = h, bx1 = 0, by1 = 0;
  for (const L of lights) {
    if (!Number.isFinite(wet.lowY)) break;
    // the light mirrored in the lowest and the highest wet ground bounds where its reflection can fall
    const a = projectPlate(pj.camera, w, h, L.at), m = projectPlate(pj.camera, w, h, [L.at[0], 2 * wet.lowY - L.at[1], L.at[2]]), m2 = projectPlate(pj.camera, w, h, [L.at[0], 2 * wet.highY - L.at[1], L.at[2]]);
    const xs = [a[0], m[0], m2[0]], ys = [a[1], m[1], m2[1]];
    const x0 = Math.max(1, Math.floor(Math.min(...xs) - 160)), x1 = Math.min(w - 1, Math.ceil(Math.max(...xs) + 160)), y0 = Math.max(1, Math.floor(Math.min(...ys) - 40)), y1 = Math.min(h - 1, Math.ceil(Math.max(...ys) + 160));
    if (x0 >= x1 || y0 >= y1) continue;
    lobeInto(o, w, 0, 0, w, x0, y0, x1, y1, pos, N, wet, L, KIND_RGB[L.kind] || KIND_RGB.paraffin, gain, B);
    any = true; bx0 = Math.min(bx0, x0); by0 = Math.min(by0, y0); bx1 = Math.max(bx1, x1); by1 = Math.max(by1, y1);
  }
  if (!any) return null;
  const cw = bx1 - bx0, ch = by1 - by0, c = new OffscreenCanvas(cw, ch);
  c.getContext("2d").putImageData(img, -bx0, -by0, bx0, by0, cw, ch);
  return { canvas: c, x0: bx0, y0: by0 };
}

// A carried light's pool on the plate: (1 - d/r)^2, the last quarter faded, turned by the surface's
// normal, three painted bands with world-anchored edges; and its glint in wet ground.
export function poolField(pj, pos, N, wet, Lp, { I = 1.6, reach = 4.5, height = 0.75, colour = [1, 0.72, 0.42], light = null } = {}) {
  const [w, h] = dims(pj), ppm = (pj.pxPerMetre || 80) * (pj.geoScale || 1), c = projectPlate(pj.camera, w, h, Lp), R = Math.ceil(reach * ppm * 1.15);
  const x0 = Math.max(1, Math.floor(c[0] - R)), x1 = Math.min(w - 1, Math.ceil(c[0] + R)), y0 = Math.max(1, Math.floor(c[1] - R)), y1 = Math.min(h - 1, Math.ceil(c[1] + R * 1.4));
  if (x0 >= x1 || y0 >= y1) return null;
  const cw = x1 - x0, ch = y1 - y0, P = new ImageData(cw, ch), p = P.data, col = colour;   // a flame is a flame whatever rules the place
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = y * w + x, nx = N[i * 3], ny = N[i * 3 + 1], nz = N[i * 3 + 2]; if (!Number.isFinite(nx)) continue;
    const px = pos[i * 3], py = pos[i * 3 + 1], pz = pos[i * 3 + 2], dx = Lp[0] - px, dy = Lp[1] - py, dz = Lp[2] - pz, d = Math.hypot(dx, dy, dz);
    if (d >= reach) continue;
    // what lies well below the carrier's feet is behind the edge it stands on (the quay's lip): mostly unlit
    const under = py < Lp[1] - height - 0.3 ? 0.12 : 1;
    const t = d / reach, fall = (1 - t) * (1 - t) * (1 - ss(0.75, 1, t)), ndl = clamp((nx * dx + ny * dy + nz * dz) / (d || 1));
    const e = I * fall * (0.2 + 0.8 * ndl) * under, q = e + (noise2(px * 3.1, pz * 3.1 + py) - 0.5) * 0.08;
    const band = q > 0.9 ? 0.3 : q > 0.45 ? 0.2 : q > 0.15 ? 0.11 : q > 0.04 ? 0.045 : 0; if (!band) continue;
    const j = ((y - y0) * cw + (x - x0)) * 4;
    p[j] = col[0] * 255; p[j + 1] = col[1] * 255; p[j + 2] = col[2] * 255; p[j + 3] = band * 255;
  }
  const pool = new OffscreenCanvas(cw, ch); pool.getContext("2d").putImageData(P, 0, 0);
  let glint = null;
  if (wet) {
    const gd = new ImageData(cw, ch);
    lobeInto(gd.data, cw, x0, y0, w, x0, y0, x1, y1, pos, N, wet, { at: Lp, I }, col, GAIN, camBasis(pj.camera));
    let any = false; for (let j = 3; j < gd.data.length; j += 4) if (gd.data[j]) { any = true; break; }
    if (any) { glint = new OffscreenCanvas(cw, ch); glint.getContext("2d").putImageData(gd, 0, 0); }
  }
  return { pool, glint, x0, y0 };
}
