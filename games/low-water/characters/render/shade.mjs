// Shading for character G-buffers.
//   albedo(G, palette)          true colour per pixel with object-anchored brushwork (stable in motion)
//   light(G, rig)               irradiance per pixel from a light rig (key, fill, rim, lamps, ambient)
//   ink(G, opt)                 ink weight per pixel: silhouettes heavy, part edges medium, folds light
//   live(G, palette, rig)       the real-time look (prototype A): banded light over albedo, ink
//   paintRef(G, palette)        the neutral-lit reference the engine painter paints (prototype C)
import { BY_ID, MATS as MATS_BY_NAME } from "../rig/materials.mjs";

const sat = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
// Value noise on a lattice from a fixed permutation table (no trig per sample: this runs per pixel).
const PERM = new Uint8Array(512), RND = new Float32Array(256);
{ let x = 2463534242; const r = () => ((x ^= x << 13), (x ^= x >>> 17), (x ^= x << 5), (x >>> 0) / 4294967296); const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) PERM[i] = p[i & 255]; for (let i = 0; i < 256; i++) RND[i] = r(); }
const sm = (t) => t * t * (3 - 2 * t);
export function vnoise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), fx = sm(x - xi), fy = sm(y - yi), fz = sm(z - zi);
  const X = xi & 255, Y = yi & 255, Z = zi & 255;
  const X1 = (X + 1) & 255, Y1 = (Y + 1) & 255, Z1 = (Z + 1) & 255;
  // the lattice values, looked up once each (no closure: this runs three times a pixel)
  const pX = PERM[X], pX1 = PERM[X1], pXY = PERM[pX + Y], pX1Y = PERM[pX1 + Y], pXY1 = PERM[pX + Y1], pX1Y1 = PERM[pX1 + Y1];
  const h000 = RND[PERM[pXY + Z]], h100 = RND[PERM[pX1Y + Z]], h010 = RND[PERM[pXY1 + Z]], h110 = RND[PERM[pX1Y1 + Z]];
  const h001 = RND[PERM[pXY + Z1]], h101 = RND[PERM[pX1Y + Z1]], h011 = RND[PERM[pXY1 + Z1]], h111 = RND[PERM[pX1Y1 + Z1]];
  const a0 = h000 + (h100 - h000) * fx, a1 = h010 + (h110 - h010) * fx;
  const b0 = h001 + (h101 - h001) * fx, b1 = h011 + (h111 - h011) * fx;
  const a = a0 + (a1 - a0) * fy, b = b0 + (b1 - b0) * fy; return a + (b - a) * fz;
}
export const INK = [0.1, 0.055, 0.075];   // dark violet-brown, never black (look bible 7)

export function matOf(id, palette = {}) {
  const m = BY_ID[id]; if (!m) return null; const o = palette[m.name]; if (o) return { ...m, ...o };
  // the face's warm and cool zones follow a character's own skin (Keel's grey, Shadwell's soot)
  if (m.name === "flesh") return palette.flesh ? { ...m, ...palette.flesh } : palette.skin ? { ...m, c: palette.skin.c || m.c, v: palette.skin.v ?? m.v } : m;   // the sculpted head's skin takes the person's skin colour
  if ((m.name === "cheek" || m.name === "jawcool") && palette.skin) { const base = MATS_BY_NAME.skin.c, sk = palette.skin.c || base; return { ...m, c: m.c.map((v, k) => Math.min(1, sk[k] * (v / base[k]))), v: palette.skin.v ?? m.v }; }
  return m;
}

// brush: how strongly the object-anchored strokes vary the value (1 the materials' own amounts;
// the play-size look uses about 1.6 so strokes read at 100 px a figure).
// buf: an object kept by the caller (one per actor); its arrays are reused frame to frame when the size holds
const BACK_TURN = new Set(["coat", "surplice", "oilskin", "apron", "smock"]);
export function scratch(buf, key, Ctor, n, fillV = 0) {
  if (!buf) { const a = new Ctor(n); if (fillV) a.fill(fillV); return a; }
  let a = buf[key]; if (!a || a.length !== n) a = buf[key] = new Ctor(n); else a.fill(0);
  if (fillV) a.fill(fillV); return a;
}
export function albedo(G, palette = {}, { brush = 1.6, buf = null, rows = null } = {}) {
  const n = G.w * G.h, out = scratch(buf, "alb", Float32Array, n * 3), alpha = scratch(buf, "alpha", Float32Array, n), jit = scratch(buf, "jit", Float32Array, n);
  const mats = [], turned = []; let back2 = null;   // matOf per material once a call (the same values matOf gives per pixel)
  for (let i = rows ? rows[0] * G.w : 0, iEnd = rows ? rows[1] * G.w : n; i < iEnd; i++) {
    const id = G.id[i]; if (!id) continue;
    let m = mats[id]; if (m === undefined) { m = mats[id] = matOf(id, palette); turned[id] = !!m && BACK_TURN.has(m.name); }
    if (!m) throw new Error(`shade albedo(): material id ${id} has no entry in rig/materials.mjs`);
    if (G.back[i] && turned[id]) m = back2 || (back2 = matOf(2, palette));
    alpha[i] = m.alpha ?? 1;
    const s = m.stroke, L0 = G.loc[i * 3], L1 = G.loc[i * 3 + 1], L2 = G.loc[i * 3 + 2];
    let k = 1;
    if (s) {
      const sc = s.scale, st = s.stretch;
      const a = vnoise3(L0 / sc, L1 / (sc * st), L2 / sc), b = vnoise3(L0 / (sc * 0.45) + 7, L1 / (sc * 0.45 * st), L2 / (sc * 0.45));
      k = 1 + brush * s.amount * ((a * 0.65 + b * 0.35) - 0.5) * 2;
      // the edge of each light band follows the strokes too (painted planes, not a smooth gradient)
      jit[i] = vnoise3(L0 / (sc * 2.2) + 31, L1 / (sc * 2.2 * Math.min(st, 2.5)), L2 / (sc * 2.2)) - 0.5;
    }
    if (m.stain) { const st = vnoise3(L0 * 7, L1 * 5, L2 * 7); if (st > 0.62) k *= 1 - m.stain * sat((st - 0.62) * 6); }
    for (let c = 0; c < 3; c++) out[i * 3 + c] = sat(m.c[c] * k * (G.col ? G.col[i * 3 + c] : 1));   // painted surface detail from forged meshes
  }
  return { rgb: out, alpha, jit };
}

// A light rig: { amb: [r,g,b] (top), ground: [r,g,b], key: { dir (toward the light), c, wrap }, fill, rim, lamps: [{ pos, c, power }] }
export function light(G, rig, palette = {}, { buf = null, rows = null } = {}) {
  const n = G.w * G.h, E = scratch(buf, "E", Float32Array, n * 3), dirs = [rig.key, rig.fill, rig.rim].filter(Boolean), lamps = rig.lamps || [];
  // every material id the table knows (ids passed 63 when the people's marks came in: patch 64 to vellscarf 67)
  const mats = []; for (let id = 1; id < BY_ID.length; id++) mats[id] = matOf(id, palette);
  const amb = rig.amb, gnd = rig.ground, H = rig.key?.dir;
  for (let i = rows ? rows[0] * G.w : 0, iEnd = rows ? rows[1] * G.w : n; i < iEnd; i++) {
    const id = G.id[i]; if (!id) continue;
    const nx = G.N[i * 3], ny = G.N[i * 3 + 1], nz = G.N[i * 3 + 2], up = 0.5 + 0.5 * ny, m = mats[id];
    if (!m) throw new Error(`shade light(): material id ${id} has no entry in rig/materials.mjs`);
    if (m.emit) { E[i * 3] = E[i * 3 + 1] = E[i * 3 + 2] = 1.6; continue; }
    let r = amb[0] * up + gnd[0] * (1 - up), g = amb[1] * up + gnd[1] * (1 - up), b = amb[2] * up + gnd[2] * (1 - up);
    const shd = G.shadow ? 0.25 + 0.75 * G.shadow[i] : 1;
    for (let k = 0; k < dirs.length; k++) {
      const Lt = dirs[k], w = Lt.wrap ?? 0.3, d = sat((nx * Lt.dir[0] + ny * Lt.dir[1] + nz * Lt.dir[2] + w) / (1 + w)), f = (Lt.pow ? d * Math.pow(d, Lt.pow) : d) * (Lt === rig.key ? shd : 1);
      r += Lt.c[0] * f; g += Lt.c[1] * f; b += Lt.c[2] * f;
    }
    if (lamps.length) {
      const px = G.wp[i * 3], py = G.wp[i * 3 + 1], pz = G.wp[i * 3 + 2];
      for (let k = 0; k < lamps.length; k++) {
        const lp = lamps[k], dx = lp.pos[0] - px, dy = lp.pos[1] - py, dz = lp.pos[2] - pz, dd = dx * dx + dy * dy + dz * dz, l = Math.sqrt(dd);
        const f = sat(((nx * dx + ny * dy + nz * dz) / l + 0.15) / 1.15) * lp.power / (dd + 0.3) * shd;
        r += lp.c[0] * f; g += lp.c[1] * f; b += lp.c[2] * f;
      }
    }
    // rim: fresnel, and with fresnel.dir weighted toward a back light's side ((0.5 + 0.5 n.dir)^directionality)
    if (rig.fresnel && G.view) { const v = G.view, F2 = rig.fresnel; let f = Math.pow(1 - sat(-(nx * v[0] + ny * v[1] + nz * v[2])), F2.pow || 3); if (F2.dir) f *= Math.pow(0.5 + 0.5 * (nx * F2.dir[0] + ny * F2.dir[1] + nz * F2.dir[2]), F2.directionality ?? 2); r += F2.c[0] * f; g += F2.c[1] * f; b += F2.c[2] * f; }
    if (m.sheen && H) { const sp = Math.pow(sat(nx * H[0] + ny * H[1] + nz * H[2]), 24) * m.sheen * 0.8; r += sp; g += sp; b += sp; }
    // a wet surface (the sculpted head's cornea): the key's highlight at the half vector, divided by the
    // material's own value so a dark iris still shows a near-white point (only materials with wet: none of Low Water's)
    if (m.wet && H) { const v = G.view || [0, 0, -1], kl = Math.hypot(H[0], Math.min(H[1], 0.25), H[2]) || 1, hx = H[0] / kl - v[0], hy = Math.min(H[1], 0.25) / kl - v[1], hz = H[2] / kl - v[2], hl = Math.hypot(hx, hy, hz) || 1;   // the key held low for the catchlight, so a key from above still lands on the cornea, not under the lid
      const sp = Math.pow(sat((nx * hx + ny * hy + nz * hz) / hl), m.wetPow || 80) * m.wet / Math.max(0.04, 0.3 * m.c[0] + 0.59 * m.c[1] + 0.11 * m.c[2]); r += sp; g += sp; b += sp; }
    E[i * 3] = r; E[i * 3 + 1] = g; E[i * 3 + 2] = b;
  }
  return E;
}

// Ink weight: 1 on the silhouette, 0.75 on part edges and depth steps, 0.4 on folds.
const SMEAR_ID = MATS_BY_NAME.smear.id, SOFT = [], FACE = [], FLESH = []; for (const n of ["skin", "cheek", "lip", "jawcool", "flesh"]) FACE[MATS_BY_NAME[n].id] = 1; for (const n of ["skin", "cheek", "scales", "lip", "jawcool", "flesh", "sclera", "iris", "pupil", "catch"]) SOFT[MATS_BY_NAME[n].id] = 1; FLESH[MATS_BY_NAME.flesh.id] = 1;
// The same weights as a full scan of every pixel's neighbourhood, found faster: an empty pixel is 1 when
// a drawn, non-smear pixel lies within r (city-block) of it, so the drawn pixels mark their empty
// neighbours; only drawn pixels run the full neighbourhood test.
export function ink(G, { scale = 1, buf = null, rows = null } = {}) {
  const { w, h } = G, out = scratch(buf, "ink", Float32Array, w * h), r = Math.max(1, Math.round(scale)), id = G.id, depth = G.depth, N = G.N;
  // with rows: the drawn pixels up to r rows outside mark their empty neighbours inside; inside, the full test
  const ya = rows ? rows[0] : 0, yb = rows ? rows[1] : h;
  for (let y = Math.max(0, ya - r); y < Math.min(h, yb + r); y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, idi = id[i]; if (!idi || idi === SMEAR_ID) continue;
    // the empty neighbours this pixel inks
    for (let dy = -r; dy <= r; dy++) { const Y = y + dy; if (Y < 0 || Y >= h) continue; const span = r - Math.abs(dy);
      for (let dx = -span; dx <= span; dx++) { const X = x + dx; if (X < 0 || X >= w || (!dx && !dy)) continue; const j = Y * w + X; if (!id[j]) out[j] = 1; } }
    if (y < ya || y >= yb) continue;
    let k = 0; const si = SOFT[idi], di = depth[i];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (!dx && !dy) continue; const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
      const j = Y * w + X, idj = id[j];
      if (idj === SMEAR_ID) continue;
      if (!idj) { k = Math.max(k, 1); continue; }
      if (idj !== idi && depth[j] < di && !(si && SOFT[idj])) k = Math.max(k, 0.8);   // no line between the face's colour zones
      if (di - depth[j] > (si && SOFT[idj] ? 0.1 : 0.06)) k = Math.max(k, 0.85);
      if (Math.abs(dx) + Math.abs(dy) === 1) { const d = N[i * 3] * N[j * 3] + N[i * 3 + 1] * N[j * 3 + 1] + N[i * 3 + 2] * N[j * 3 + 2], soft = si; if (d < (soft ? 0.25 : 0.6)) k = Math.max(k, soft ? 0.22 : 0.4); }
    }
    out[i] = k;
  }
  return out;
}

// The neutral reference for painting: albedo under a soft key from the upper left and a cool fill.
export const NEUTRAL = { amb: [0.32, 0.32, 0.36], ground: [0.16, 0.14, 0.15], key: { dir: [-0.45, 0.75, 0.5], c: [0.85, 0.82, 0.78], wrap: 0.4 }, fill: { dir: [0.6, 0.1, 0.4], c: [0.12, 0.13, 0.18], wrap: 0.5 } };

// bands: light quantised into painted value steps; violet: how far the shadow side leans violet
// (look bible: shadows deep and violet, never grey).
export const VIOLET = [0.62, 0.5, 0.86];
const WARM_TILT = [0.35, -0.05, -0.25], SSS_TILT = [0.9, 0.05, -0.35];
// The sculpted head's flesh (material flesh): one warm key with deep but transparent shadow (the van der Neer
// and one-hard-light references, design/art/references/2026-10-22/): the shadow floor lifted so a face never
// falls to the darkest band and sockets read as shade, not holes; the top eased so a cheek is not a hot disc.
const fleshRamp = (q) => 0.24 + 0.72 * Math.min(1, q) - 0.08 * Math.max(0, q - 0.8);
export function compose(G, A, E, I, { bands = 0, inkC = INK, violet = 0.55, jitter = 0.9, buf = null, rows = null } = {}) {
  const n = G.w * G.h, rgba = scratch(buf, "rgba", Float32Array, n * 4), id = G.id, Ar = A.rgb, Aj = A.jit;
  for (let i = rows ? rows[0] * G.w : 0, iEnd = rows ? rows[1] * G.w : n; i < iEnd; i++) {
    let a = A.alpha[i]; const k = I ? I[i] : 0;
    if (!id[i]) { if (k > 0) { rgba[i * 4] = inkC[0]; rgba[i * 4 + 1] = inkC[1]; rgba[i * 4 + 2] = inkC[2]; rgba[i * 4 + 3] = k * 0.9; } continue; }
    // bands quantise the light's brightness only, so the hue of the light is kept (no colour fringes)
    let kq = 1, warm = 0;
    const e0 = E[i * 3], e1 = E[i * 3 + 1], e2 = E[i * 3 + 2], fl = FLESH[id[i]];
    if (bands) {
      // skin is painted in fewer, broader planes with wandering edges, and the edge between light and
      // shadow runs warm (blood under skin at the terminator, as a painter mixes it)
      const face = FACE[id[i]], nb = face ? Math.max(2, bands - 1) : bands, jt = fl ? jitter * 0.7 : face ? jitter * 1.7 : jitter, ed = fl ? 2.2 : 6;
      const l = Math.max(1e-4, 0.3 * e0 + 0.59 * e1 + 0.11 * e2), t = Math.max(0, Math.pow(l, 0.7) * nb + jt * (Aj ? Aj[i] : 0)), f = t - Math.floor(t);
      let q = (Math.floor(t) + (f > 0.5 ? Math.min(1, (f - 0.5) * ed + 0.5) : Math.max(0, (f - 0.5) * ed + 0.5))) / nb;
      if (fl) q = fleshRamp(q);
      kq = Math.pow(Math.max(q, 0.02), 1 / 0.7) / l;
      if (face) warm = Math.max(0, 1 - Math.abs(f - 0.5) * 5) * (fl ? 0.22 : 0.5);
    } else if (fl) { const l = Math.max(1e-4, 0.3 * e0 + 0.59 * e1 + 0.11 * e2); kq = Math.pow(fleshRamp(Math.pow(l, 0.7)), 1 / 0.7) / l; }
    const lum = 0.3 * e0 + 0.59 * e1 + 0.11 * e2, sh = violet * (fl ? 0.4 : 1) * (1 - Math.min(1, Math.max(0, (lum * kq - 0.12) / 0.4)));
    const sss = fl ? Math.max(0, 1 - lum * kq / 0.5) * 0.1 : 0;   // flesh in shadow keeps blood warmth: transparent, not grey
    for (let c = 0; c < 3; c++) {
      const e = E[i * 3 + c] * kq * (1 + warm * WARM_TILT[c]) * (1 + sss * SSS_TILT[c]);
      let v = Ar[i * 3 + c] * e * (1 - sh + sh * VIOLET[c]) + sh * 0.025 * VIOLET[c];
      if (v > 0.8) v = 0.8 + 0.2 * (1 - Math.exp(-(v - 0.8) / 0.2));   // a soft shoulder: a pale surplice by a lamp keeps its folds
      rgba[i * 4 + c] = v * (1 - k * 0.85) + inkC[c] * k * 0.85;
    }
    rgba[i * 4 + 3] = Math.max(a, k * 0.9);
  }
  return rgba;
}

// The direction toward the light that casts the figure's self-shadow: the strongest lamp at the
// figure's position, or the key light.
export function shadowDir(rig, pos = [0, 1, 0]) {
  let best = null, bw = 0;
  for (const lp of rig.lamps || []) { const d = [lp.pos[0] - pos[0], lp.pos[1] - pos[1] - 1, lp.pos[2] - pos[2]], dd = d[0] ** 2 + d[1] ** 2 + d[2] ** 2, w = lp.power / dd; if (w > bw) { bw = w; best = d; } }
  const kw = rig.key ? Math.max(...rig.key.c) * 3 : 0;
  const d = best && bw > kw ? best : rig.key?.dir || [0, 1, 0], l = Math.hypot(...d); return [d[0] / l, d[1] / l, d[2] / l];
}

// The sodium ramp (as game/figures.mjs): value to deep orange mids and cream highlights, never pink.
// The figure's value design pushed apart under sodium: pale masses toward cream, darks toward ink.
export function sodiumTone(rgb) {
  const t0 = Math.min(1, Math.max(0, 0.3 * rgb[0] + 0.59 * rgb[1] + 0.11 * rgb[2])), t = t0 * 0.35 + t0 * t0 * (3 - 2 * t0) * 0.65;
  return [0.05 + 1.15 * Math.pow(t, 0.85), 0.025 + 0.8 * Math.pow(t, 1.12), 0.035 + 0.45 * Math.pow(t, 2.0)].map((x) => Math.min(1, x));
}
