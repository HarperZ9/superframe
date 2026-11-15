// Letters written with a tool (the UI art lead's, 2026-10-21): each skeleton stroke (lettering/skeleton.mjs)
// is travelled by a tool whose mark comes from the game's own painter. The bristle texture across a mark
// and its dry break toward the tail are paint/strokes.mjs bristle(), with the painter's hash; on top of
// that a stroke starts loaded (a pooled dab) and ends dry (bristles break off, the edge goes ragged), its
// pressure wanders, and every variant moves the points, the baseline, the slant and the weight a little,
// so a letter written twice never matches. Pure: no DOM, so the atlas bakes in Node.
//   rasterGlyph(glyph, tool, { ch, variant, emPx }) -> { w, h, data: Uint8Array coverage, pad, base }
//   TOOLS: brush (a round sign-painter's brush), flat (a chisel brush, dry), pen (a pointed pen, slanted:
//   hairlines up, swelling shades down), stamp (a rubber stamp: even weight, mottled ink, a hard rim)
import { U, hash4, bristle } from "../../paint/strokes.mjs";
import { nibStroke, nibDraw, blotInto } from "./nib.mjs";

export const TOOLS = {
  brush: { id: 1, r: 6.6, jit: 1.7, rot: 2.6, shear: 0.05, taper: [0.32, 0.62], dry: [0.5, 0.85], dryAmt: [0.35, 1], load: 1.1, rag: 0.08, down: 0.3, bristle: 1.25 },
  flat: { id: 2, r: 9.2, nib: 38, flatMin: 0.14, jit: 1.4, rot: 2.2, shear: 0.04, taper: [0.7, 0.9], dry: [0.45, 0.75], dryAmt: [0.45, 0.85], load: 1.04, rag: 0.1, down: 0, bristle: 1.1 },
  pen: { id: 3, hair: 0.75, shade: 5.8, jit: 0.7, rot: 1.2, shear: 0.3, taper: [0.9, 1], dry: [0.97, 1], dryAmt: [0, 0], load: 1.1, rag: 0.02, bristle: 0 },
  // round two (2026-10-22): broad nibs for the historical hands (lettering/nib.mjs), and a pencil
  textura: { id: 5, kind: "nib", nib: 13, edge: 0.55, angle: 40, angleJit: 2, twist: 4, pool: 1.08, catch: 0.3, fade: 0.06, rag: 0.5, jit: 0.8, rot: 0.8, shear: 0, wobble: 0.35, blot: 0.03 },
  bastarda: { id: 6, kind: "nib", nib: 11, edge: 0.55, angle: 35, angleJit: 4, twist: 10, pool: 1.1, catch: 0.3, fade: 0.1, rag: 0.6, jit: 1.5, rot: 1.8, shear: 0.12, wobble: 0.6, blot: 0.04 },
  insular: { id: 7, kind: "nib", nib: 12, edge: 0.6, angle: 22, angleJit: 3, twist: 6, pool: 1.12, catch: 0.3, fade: 0.08, rag: 0.6, jit: 1.2, rot: 1.4, shear: 0.02, wobble: 0.5, blot: 0.03 },
  pencil: { id: 8, r: 2.4, grain: 0.55, jit: 1.2, rot: 1.5, shear: 0.1, taper: [0.75, 0.95], dry: [1, 1], dryAmt: [0, 0], load: 1, rag: 0.2, bristle: 0, wobble: 0.3 },
  stamp: { id: 4, r: 5.4, jit: 0.9, rot: 1.6, shear: 0, taper: [1, 1], dry: [1, 1], dryAmt: [0, 0], load: 1, rag: 0.04, bristle: 0 },
};
export const ASCENT = 90, DESCENT = 34, PAD = 12;   // units above and below the baseline, and either side

// value noise in 2D, smooth, 0..1
function vnoise(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const v = (i, j) => U(hash4(ix + i, iy + j, seed, 11), 0);
  return v(0, 0) * (1 - sx) * (1 - sy) + v(1, 0) * sx * (1 - sy) + v(0, 1) * (1 - sx) * sy + v(1, 1) * sx * sy;
}

// Catmull-Rom through the points, about one point per pixel
function smooth(pts, s) {
  if (pts.length < 3) { const [a, b] = pts, n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * s)); return Array.from({ length: n + 1 }, (_, i) => [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n]); }
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * s));
    for (let k = i ? 1 : 0; k <= n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  return out;
}

// the variant's hand: the points moved, slanted, turned and scaled about the glyph's middle, in units
function placeStrokes(glyph, T, seed) {
  const rot = ((U(seed, 1) - 0.5) * 2 * T.rot * Math.PI) / 180, sc = 0.97 + U(seed, 2) * 0.06, dy = (U(seed, 3) - 0.5) * 4, cx = glyph.w / 2, cy = 30;
  const c = Math.cos(rot), s = Math.sin(rot);
  return glyph.s.map((st, si) => Object.assign(st.map(([x, y], pi) => {
    const jx = (U(seed, 100 + si * 31 + pi) - 0.5) * 2 * T.jit, jy = (U(seed, 400 + si * 31 + pi) - 0.5) * 2 * T.jit;
    let X = (x + jx - cx) * sc, Y = (y + jy - cy) * sc; [X, Y] = [X * c - Y * s, X * s + Y * c];
    return [X + cx + (Y + cy) * T.shear, Y + cy + dy];
  }), { hair: !!st.hair }));   // a hairline stroke (a capital's doubled stem, a flourish) keeps its mark
}

// the mark's half-width at a point: pressure along the stroke, and the tool's own response to direction
function radiusAt(T, t, tx, ty, P) {
  if (T.hair != null) { const down = Math.max(0, -ty); return T.hair + T.shade * Math.pow(down, 1.6) * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, t))), 0.45) + (t < 0.04 ? T.hair : 0); }
  let r = T.r * P.weight * (T.down ? 1 - T.down / 2 + T.down * Math.max(0, -ty) : 1);   // a brush leans on its downstrokes
  if (T.nib != null) { const a = (T.nib * Math.PI) / 180; r *= T.flatMin + (1 - T.flatMin) * Math.abs(Math.sin(Math.atan2(ty, tx) - a)); }
  const load = t < 0.07 ? 1 + (T.load - 1) * (1 - t / 0.07) : 1;
  const tail = t > 0.78 ? 1 - (1 - P.taper) * ((t - 0.78) / 0.22) : 1;
  return r * load * tail * (1 + 0.07 * (vnoise(t * 6, 0, P.key) - 0.5) * 2);
}

const lerp = ([a, b], t) => a + (b - a) * t, clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// splat a stroke's samples: each pixel keeps the sample it is nearest to, by distance over radius
function nearest(pts, T, P, s, W, H, B) {
  const n = pts.length, cum = new Float32Array(n);
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  const L = Math.max(cum[n - 1], 1e-3), box = [W, H, 0, 0];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = a[1] - b[1], dl = Math.hypot(dx, dy) || 1;
    const r = Math.max(0.6, radiusAt(T, cum[i] / L, dx / dl, dy / dl, P) * s), [cx, cy] = pts[i];
    const x0 = Math.max(0, Math.floor(cx - r - 2)), x1 = Math.min(W - 1, Math.ceil(cx + r + 2)), y0 = Math.max(0, Math.floor(cy - r - 2)), y1 = Math.min(H - 1, Math.ceil(cy + r + 2));
    box[0] = Math.min(box[0], x0); box[1] = Math.min(box[1], y0); box[2] = Math.max(box[2], x1); box[3] = Math.max(box[3], y1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const ox = x + 0.5 - cx, oy = y + 0.5 - cy, d = Math.hypot(ox, oy), p = y * W + x;
      if (d / r < B.nd[p]) { B.nd[p] = d / r; B.s[p] = cum[i]; B.d[p] = d; B.r[p] = r; B.side[p] = dx * oy + dy * ox >= 0 ? 1 : -1; }   // which side of the travel: the cross of tangent and offset
    }
  }
  return { L, box };
}

// the paint a tool leaves at one pixel of its mark, 0..1 (t along the stroke, v across it, -1..1)
function density(T, P, t, v, bs, br, x, y) {
  let dens = P.alpha;
  if (T.bristle) {
    const nb = Math.max(2, Math.round((2 * br) / T.bristle)), Bk = bristle(P.key, 2 * t - 1, v, nb);
    dens *= clamp(1 + (Bk.k - 1) * 1.6, 0.8, 1) * Bk.cover;
    if (t > P.dryStart) {
      const q = ((t - P.dryStart) / (1 - P.dryStart)) * P.dryAmt * (1 + Math.abs(v) * 0.7), b = Math.floor((v + 1) * 0.5 * nb * 1.5);
      const g = U(hash4(P.key, b, Math.floor(bs / 2.4), 5), 0); if (g < q) dens *= 0.06; else if (g < q * 1.4) dens *= 0.55;
    }
    dens += (1 - dens) * Math.max(0, 1 - t / 0.1) * 0.6;   // the loaded start, fading into the stroke
  }
  if (T.id === 4) { const m = vnoise(x / 6.5, y / 6.5, P.key) * 0.6 + vnoise(x / 2.2, y / 2.2, P.key + 1) * 0.4; dens *= m < 0.28 ? 0.3 : m < 0.38 ? 0.72 : 0.95; if (Math.abs(v) > 0.8) dens = Math.max(dens, 0.95); }
  if (T.hair != null && t > 0.05 && t < 0.96) dens *= 0.93;
  if (T.grain) dens *= 1 - T.grain * U(hash4(x, y, P.key, 13), 0) * (0.6 + 0.4 * vnoise(x / 2, y / 2, P.key));   // graphite on the paper's tooth
  return dens;
}

// one stroke laid into the glyph's coverage
function strokeInto(img, W, H, pts, T, P, s, B) {
  B.nd.fill(Infinity);
  const { L, box } = nearest(pts, T, P, s, W, H, B);
  for (let y = box[1]; y <= box[3]; y++) for (let x = box[0]; x <= box[2]; x++) {
    const p = y * W + x; if (!(B.nd[p] < 1 + 1.5 / B.r[p])) continue;
    const bs = B.s[p], br = B.r[p], t = bs / L, v = B.side[p] * Math.min(1, B.d[p] / br);
    const rag = 1 + T.rag * (vnoise(bs / (3 * s), B.side[p] > 0 ? 3 : 7, P.key) - 0.5) * 2;
    const a = clamp(br * rag - B.d[p] + 0.5, 0, 1); if (!a) continue;
    img[p] = 1 - (1 - img[p]) * (1 - a * density(T, P, t, v, bs, br, x, y));
  }
}

// the hand's tremor: each point pushed off the stroke's line by a slow noise, a few tenths of a unit
function wobble(pts, amp, key) {
  if (!amp || pts.length < 3) return pts;
  let acc = 0; return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    if (i) acc += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]); const o = (vnoise(acc / 7, 3, key) - 0.5) * 2 * amp;
    return [p[0] - (dy / l) * o, p[1] + (dx / l) * o];
  });
}

// a key for a glyph's name: a letter's code point, or a ligature's or a word's hash
const strCode = (ch) => { if ([...ch].length === 1) return ch.codePointAt(0); let h = 2166136261; for (const c of ch) h = Math.imul(h ^ c.codePointAt(0), 16777619); return h >>> 0; };

export function rasterGlyph(glyph, tool, { ch = "?", variant = 0, emPx = 96 } = {}) {
  const T = typeof tool === "object" ? tool : TOOLS[tool]; if (!T) throw new Error(`lettering: no tool ${tool}`);   // a tool, or a hand's own (lettering/hands.mjs)
  const s = emPx / 100, seed = hash4(strCode(ch), variant, T.id, 77);
  const W = Math.ceil((glyph.w + 2 * PAD) * s), H = Math.ceil((ASCENT + DESCENT) * s), img = new Float32Array(W * H);
  const B = { nd: new Float32Array(W * H), s: new Float32Array(W * H), d: new Float32Array(W * H), r: new Float32Array(W * H), side: new Int8Array(W * H) };
  const strokes = placeStrokes(glyph, T, seed);
  const ends = [];
  strokes.forEach((st, si) => {
    if (st.length < 2) return;   // a stroke reduced to a point leaves no mark
    const key = hash4(seed, si, 3, 9), last = si === strokes.length - 1;
    const px = wobble(smooth(st, s).map(([x, y]) => [(x + PAD) * s, (ASCENT - y) * s]), (T.wobble || 0) * s, key); ends.push(px[px.length - 1]);
    if (T.kind === "nib") { const D = nibDraw(T, key); if (st.hair) D.weight *= 0.14; nibStroke(img, W, H, px, T, D, s); return; }
    const wv = T.weightVar ?? 0.16, P = { key, weight: (1 - wv / 2 + U(key, 1) * wv) * (st.hair ? 0.3 : 1), taper: lerp(T.taper, U(key, 2)), dryStart: lerp(T.dry, U(key, 3)), dryAmt: lerp(T.dryAmt, U(key, 4)) * (last ? 1.2 : 1), alpha: 0.94 + U(key, 5) * 0.06 };
    strokeInto(img, W, H, px, T, P, s, B);
  });
  if (T.blot && ends.length && U(seed, 900) < T.blot) { const e = ends[Math.floor(U(seed, 901) * ends.length)]; blotInto(img, W, H, e[0] + (U(seed, 902) - 0.5) * 6 * s, e[1] + U(seed, 903) * 4 * s, (T.nib || 8) * s * (0.3 + U(seed, 904) * 0.2), seed); }
  const data = new Uint8Array(W * H); for (let i = 0; i < data.length; i++) data[i] = Math.round(clamp(img[i], 0, 1) * 255);
  return { w: W, h: H, data, pad: PAD, base: ASCENT * s, adv: glyph.w };
}
