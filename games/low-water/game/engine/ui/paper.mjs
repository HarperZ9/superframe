// Paper that has lived (the UI art lead's, 2026-10-21): each panel's ground made from a seed: the era's
// stock (lettering and ink sit on it), its mottle and fibres, foxing, a tea or water ring, thumb grime at
// the corners it is held by, and an edge torn or burnt, the char going black at the break and brown into
// the sheet. Where the edge is eaten the panel's shadow shows. No two seeds give the same page. Pure
// pixels (no DOM), so the contrast check reads the same paper the game shows.
//   paperPixels({ w, h, era, seed, burn, kind }) -> { w, h, data: Uint8ClampedArray RGBA }
//   STOCK[era] -> { base, fleck, fox, stains, grime, burn, tear, toner, copyEdge }
import { U, hash4 } from "../paint/strokes.mjs";

export const STOCK = {
  1: { base: [236, 226, 199], mottle: 0.05, fleck: 0.0004, fox: 14, stains: 2, grime: 0.16, burn: 0.35, tear: 2.5 },          // a merchant's ledger, cream rag paper
  2: { base: [212, 210, 198], mottle: 0.06, fleck: 0.004, fox: 9, stains: 1, grime: 0.2, burn: 0.8, tear: 3.5 },            // the ration form, cheap grey pulp
  3: { base: [231, 227, 214], mottle: 0.04, fleck: 0.0015, fox: 6, stains: 1, grime: 0.14, burn: 0.45, tear: 3 },             // duplicated lists on thin stock
  4: { base: [234, 236, 226], mottle: 0.025, fleck: 0.0006, fox: 3, stains: 1, grime: 0.07, burn: 0.15, tear: 1.6 },         // the bank's form
  5: { base: [239, 239, 235], mottle: 0.02, fleck: 0, fox: 1, stains: 0, grime: 0.06, burn: 0, tear: 1.2, toner: 0.006, copyEdge: 1 }, // a photocopied notice
};
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function vnoise(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const v = (i, j) => U(hash4(ix + i, iy + j, seed, 23), 0);
  return v(0, 0) * (1 - sx) * (1 - sy) + v(1, 0) * sx * (1 - sy) + v(0, 1) * (1 - sx) * sy + v(1, 1) * sx * sy;
}

// the marks laid on a page: foxing spots, stain rings, the grimed corners, the burnt bites per side
function marksFor(S, w, h, seed, burn, kind) {
  const r = (k) => U(seed, k), small = kind === "chip" || w * h < 40000, edgeBias = (k) => (r(k) < 0.5 ? r(k + 1) * 0.18 : 1 - r(k + 1) * 0.18);
  const fox = Array.from({ length: small ? Math.ceil(S.fox / 4) : S.fox }, (_, i) => ({ x: (r(10 + i) < 0.5 ? edgeBias(30 + i * 3) : r(60 + i)) * w, y: (r(90 + i) < 0.5 ? edgeBias(120 + i * 3) : r(150 + i)) * h, r: 1.5 + r(180 + i) * 6 * (r(200 + i) < 0.15 ? 3 : 1), a: 0.08 + r(220 + i) * 0.2 }));
  const stains = small ? [] : Array.from({ length: Math.round(S.stains * (0.5 + r(240))) }, (_, i) => ({ x: r(250 + i) * w, y: (0.55 + r(260 + i) * 0.5) * h, R: Math.min(w, h) * (0.12 + r(270 + i) * 0.16), a: 0.05 + r(280 + i) * 0.05, tea: r(290 + i) < 0.6 }));
  const deep = Math.min(8, 0.035 * Math.min(w, h));   // a bite stays inside the panel's padding
  const sides = [0, 1, 2, 3].map((sd) => {
    const len = sd % 2 ? h : w, n = Math.floor(burn * (1 + r(300 + sd) * 2.5) * (small ? 0.5 : 1) + (r(310 + sd) < burn * 0.6 ? 1 : 0));
    return Array.from({ length: small ? 0 : n }, (_, i) => ({ at: r(320 + sd * 17 + i) * len, wid: 18 + r(340 + sd * 17 + i) * 60, depth: Math.min(deep, (4 + r(360 + sd * 17 + i) * 11) * (0.5 + burn * 0.6)) }));
  });
  return { fox, stains, sides, tearK: small ? 0.35 : 1 };   // a chip's edge is nicked, not torn
}

// how far a side's edge is eaten at a place along it: the tear's ragged line and any burnt bite
// (one entry per whole unit along the side, made once per page)
function eatenProfile(M, S, sd, len, seed) {
  const tear = new Float32Array(len + 2), bite = new Float32Array(len + 2);
  for (let p = 0; p < len + 2; p++) {
    tear[p] = S.tear * M.tearK * (0.4 + vnoise(p / 6, sd * 9, seed) * 0.8 + vnoise(p / 1.7, sd * 9 + 4, seed) * 0.35);
    let b = 0; for (const k of M.sides[sd]) { const d = (p - k.at) / k.wid; if (Math.abs(d) < 2) b = Math.max(b, k.depth * Math.exp(-d * d * 3) * (0.7 + 0.6 * vnoise(p / 13, sd + 40, seed)) + (b ? 0 : 0)); }
    bite[p] = b > 0.3 ? b + vnoise(p / 2.5, sd + 70, seed) * Math.min(2.5, b * 0.4) : b;
  }
  return { tear, bite };
}

// the colour of one pixel of sheet before the edge (the stock, mottle, flecks, foxing, stains, grime)
function sheetAt(S, M, x, y, w, h, seed, c) {
  const mot = 1 + S.mottle * ((vnoise(x / 38, y / 38, seed) - 0.5) * 1.4 + (vnoise(x / 7, y / 7, seed + 1) - 0.5) * 0.6);
  c[0] = S.base[0] * mot; c[1] = S.base[1] * mot; c[2] = S.base[2] * mot;
  const hp = U(hash4(Math.round(x), Math.round(y), seed, 3), 0); if (hp < S.fleck * S.fs) { const k = 0.55 + U(hash4(x, y, seed, 4), 0) * 0.3; c[0] *= k; c[1] *= k; c[2] *= k; }
  if (S.toner && hp > 1 - S.toner * S.fs) { c[0] *= 0.35; c[1] *= 0.35; c[2] *= 0.35; }
  for (const f of M.fox) { if (Math.abs(x - f.x) > f.r || Math.abs(y - f.y) > f.r) continue; const d = Math.hypot(x - f.x, y - f.y) / f.r; if (d < 1) { const a = f.a * (1 - d) * (1 - d); c[0] += (150 - c[0]) * a; c[1] += (98 - c[1]) * a; c[2] += (52 - c[2]) * a; } }
  for (const s of M.stains) { if (Math.abs(x - s.x) > s.R * 1.2 || Math.abs(y - s.y) > s.R * 1.2) continue; const d = Math.hypot(x - s.x, y - s.y) / (s.R * (0.92 + vnoise(Math.atan2(y - s.y, x - s.x) * 3 + 9, 1, seed) * 0.16)); if (d < 1.03) { const rim = Math.exp(-(((d - 1) * 30) ** 2)), a = s.a * (d < 1 ? 0.45 : 0) + rim * s.a * 1.6; const t = s.tea ? [158, 118, 68] : [150, 146, 136]; c[0] += (t[0] - c[0]) * a; c[1] += (t[1] - c[1]) * a; c[2] += (t[2] - c[2]) * a; } }
  if (y > h * 0.8 - 30) for (const cx of [0, w]) { const d = Math.hypot((x - cx) / (w * 0.22 + 30), (y - h) / (h * 0.16 + 30)); if (d < 1) { const ridge = 0.75 + 0.25 * Math.sin(Math.hypot(x - cx, y - h) * 1.1), a = S.grime * (1 - d) ** 1.5 * ridge; c[0] += (92 - c[0]) * a; c[1] += (82 - c[1]) * a; c[2] += (72 - c[2]) * a; } }
  if (S.copyEdge) { const e = Math.min(x, w - x, y, h - y), a = 0.25 * Math.exp(-e / 5); c[0] *= 1 - a; c[1] *= 1 - a; c[2] *= 1 - a; }
}

export function paperPixels({ w, h, era = 2, seed = 1, burn = null, kind = "sheet", scale = 1 }) {
  const S = { ...(STOCK[era] || STOCK[2]), fs: scale * scale }, W = Math.max(8, Math.round(w * scale)), H = Math.max(8, Math.round(h * scale)), q = 1 / scale;
  const B = burn == null ? S.burn : burn, M = marksFor(S, w, h, seed, B, kind), EP = [0, 1, 2, 3].map((sd) => eatenProfile(M, S, sd, Math.ceil(sd % 2 ? h : w), seed)), data = new Uint8ClampedArray(W * H * 4), c = [0, 0, 0];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = i * q, y = j * q, o = (j * W + i) * 4;
    sheetAt(S, M, x, y, w, h, seed, c);
    // the edge: the nearest side's eaten line; char where a bite burnt it, a lighter fibre where it only tore
    let dIn = Infinity, bite = 0;
    for (let sd = 0; sd < 4; sd++) { const dist = sd === 0 ? y : sd === 1 ? w - x : sd === 2 ? h - y : x; if (dist > 44) continue; const E = EP[sd], p = Math.round(sd % 2 ? y : x), d = dist - E.tear[p] - E.bite[p]; if (d < dIn) { dIn = d; bite = E.bite[p]; } }
    let a = 255;
    if (dIn < 0) { const sh = clamp(1 + dIn / 7, 0, 1) * 0.45; c[0] = c[1] = c[2] = 8; a = Math.round(255 * sh * sh); }
    else if (dIn < 30) {
      const burnt = clamp(bite / 3, 0, 1);   // char at the break, scorch brown into the sheet, fading out
      if (burnt > 0) { const reach = 5 + bite * 1.1, sc = clamp(1 - dIn / reach, 0, 1) ** 1.6, ch = clamp(1 - dIn / (2 + bite * 0.3), 0, 1); mix(c, [118, 70, 32], sc * 0.6 * burnt); mix(c, [30, 20, 14], ch * burnt); }
      if (dIn < 1.5) { mix(c, [255, 252, 240], 0.15 * (1 - burnt)); a = Math.round(255 * clamp(dIn / 1.5 + 0.35, 0, 1)); }
    }
    data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = a;
  }
  return { w: W, h: H, data };
}
function mix(c, t, a) { c[0] += (t[0] - c[0]) * a; c[1] += (t[1] - c[1]) * a; c[2] += (t[2] - c[2]) * a; }
