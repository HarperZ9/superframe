// The paint language on plates (design/art/PAINT-LANGUAGE.md): after the engine's paint-over, each surface takes the
// stroke its material, its light and the story's state call for, instead of one brush everywhere.
//   knife   stone, brick, slab, iron (the institution's hard surfaces): flat planes with straight edges, a lit ridge
//   rigger  paper and chalk (what is written and counted): sharpened, fine dark lines kept
//   dry     frost and want (frost, era 2, decay): a stiff dragged brush, the canvas showing through in streaks
//   glaze   the shadow family: a transparent dark that deepens hue and keeps texture
//   wet     the pool of a warm light: soft, loaded, the colour run together
//   scumble air (depth in the wide lens, mist): thin light broken paint over the far planes
// and the era in the palette (1 full and saturated, 2 dry and drained toward earth, 3 patched, 4 flat, 5 thin under
// sodium), with decay breaking the surfaces down as the street's stock falls. Original code; deterministic.
//   language(rgba8, W, H, { id (Uint8 per pixel, kit ids), depth (Float32 per pixel or null), names (id -> kit name) },
//            { era, decay, frost, mist, seed }) -> Uint8ClampedArray
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const KNIFE = new Set(["quay", "cobble", "slab", "wall", "steps", "mole", "brick", "brickdark", "plaster", "iron", "rust", "stove", "tower", "limewash", "bone"]);
const RIGGER = new Set(["paper", "chalk", "sign"]);
const OUTDOOR_TOP = new Set(["quay", "cobble", "slab", "mud", "roof", "steps", "sand", "shingle", "mole", "timber", "plank"]);
export const ERAS = {
  1: { sat: 1.18, warm: 0.04, contrast: 1.08, tint: [1.0, 0.98, 0.93], dry: 0 },
  2: { sat: 0.7, warm: 0.0, contrast: 1.05, tint: [0.98, 0.94, 0.86], dry: 0.2 },
  3: { sat: 0.88, warm: 0.0, contrast: 1.0, tint: [0.97, 0.97, 0.95], dry: 0.15 },
  4: { sat: 0.82, warm: -0.02, contrast: 0.95, tint: [0.96, 0.98, 1.0], dry: 0.05, flat: 0.35 },
  // era 5 (2026-10-24): contrast 0.82 about the 0.42 pivot set a floor near 0.076 that no pixel could go under, and the
  // 0.7 blue tint browned every colour, so all seventeen era 5 plates read murky and the look's ground (#090603) was out
  // of reach. Contrast now 1.08, a lighter warm tint, less posterising, and less of the far-plane scumble (air), which
  // greyed the top half of every era 5 street toward one value.
  5: { sat: 0.62, warm: 0.02, contrast: 1.08, tint: [1.02, 0.96, 0.86], dry: 0.1, flat: 0.35, air: 0.2 },
};
function hash(x, y, s) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y, s) { const xi = Math.floor(x), yi = Math.floor(y), u = x - xi, v = y - yi, a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s), su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v); return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv; }
const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

export function language(src, W, H, { id, depth = null, names }, { era = 2, decay = 0, frost = 0, mist = 0, seed = 7, canvas = [0.78, 0.72, 0.6], knifeCell = 16, only = null } = {}) {
  const on = (t) => !only || only.includes(t);   // only: a list of techniques to run (knife, rigger, glaze, wet, dry, scumble, era), for the specimen sheets
  const n = W * H, E = ERAS[era] || ERAS[2], img = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) img[i * 3 + c] = src[i * 4 + c] / 255;
  const kind = (i) => names[id[i]] || "";
  // knife: per region, long flat cells of about knifeCell px; each cell flattened toward its mean (no ruled seam: the
// planes show by their value steps); decay chips some cells back toward the canvas
  const K = knifeCell, gw = Math.ceil(W / K) + 1, gh = Math.ceil(H / K) + 1, seeds = new Float32Array(gw * gh * 2);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) { const j = gy * gw + gx; seeds[j * 2] = (gx + hash(gx, gy, seed) * 0.9) * K; seeds[j * 2 + 1] = (gy + hash(gx, gy, seed + 1) * 0.9) * K; }
  const cellOf = new Int32Array(n).fill(-1), edgeD = new Float32Array(n);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (!on("knife") || !KNIFE.has(kind(i))) continue;
    // planes laid long and flat (distance in y counts 2.2 times), as a knife drags
    const gx = Math.floor(x / K), gy = Math.floor(y / K); let b1 = Infinity, b2 = Infinity, bj = -1;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = gx + dx, Y = gy + dy; if (X < 0 || Y < 0 || X >= gw || Y >= gh) continue; const j = Y * gw + X, d = Math.hypot(x - seeds[j * 2], (y - seeds[j * 2 + 1]) * 2.2); if (d < b1) { b2 = b1; b1 = d; bj = j; } else if (d < b2) b2 = d; }
    cellOf[i] = bj * 64 + (id[i] & 63); edgeD[i] = b2 - b1;
  }
  const sums = new Map();
  for (let i = 0; i < n; i++) { const k = cellOf[i]; if (k < 0) continue; let s = sums.get(k); if (!s) sums.set(k, (s = [0, 0, 0, 0])); s[0] += img[i * 3]; s[1] += img[i * 3 + 1]; s[2] += img[i * 3 + 2]; s[3]++; }
  const chip = clamp(decay * 0.8);
  for (let i = 0; i < n; i++) {
    const k = cellOf[i]; if (k < 0) continue; const s = sums.get(k), m = 0.62 * (1 - chip * 0.6);
    for (let c = 0; c < 3; c++) img[i * 3 + c] += (s[c] / s[3] - img[i * 3 + c]) * m;
    if (chip > 0 && hash(k, 3, seed) < chip * 0.5) for (let c = 0; c < 3; c++) img[i * 3 + c] = img[i * 3 + c] * 0.7 + canvas[c] * 0.3 * 0.6;   // a chipped plane
  }
  // rigger: written things sharpened (an unsharp mask on paper and chalk, so a chalked figure stays a line)
  const blur3 = (i, c) => { const x = i % W, y = (i / W) | 0; let s = 0, k = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; s += img[(Y * W + X) * 3 + c]; k++; } return s / k; };
  const sharp = new Float32Array(n * 3); let anyR = false;
  for (let i = 0; i < n; i++) if (on("rigger") && RIGGER.has(kind(i))) { anyR = true; for (let c = 0; c < 3; c++) sharp[i * 3 + c] = clamp(img[i * 3 + c] + 1.4 * (img[i * 3 + c] - blur3(i, c))); }
  if (anyR) for (let i = 0; i < n; i++) if (RIGGER.has(kind(i))) for (let c = 0; c < 3; c++) img[i * 3 + c] = sharp[i * 3 + c];
  // the light families: glaze the shadow family, run the warm-lit pool wet
  let Ls = []; for (let i = 0; i < n; i += 7) if (id[i]) Ls.push(lum(img[i * 3], img[i * 3 + 1], img[i * 3 + 2])); Ls.sort((a, b) => a - b);
  const p30 = Ls.length ? Ls[Math.floor(Ls.length * 0.3)] : 0.1;
  const wetSrc = img.slice();
  for (let i = 0; i < n; i++) {
    if (!id[i]) continue;
    const r = img[i * 3], g = img[i * 3 + 1], b = img[i * 3 + 2], L = lum(r, g, b);
    if (on("glaze") && L < p30) { const t = clamp((p30 - L) / Math.max(1e-3, p30)) * 0.5, hue = [0.55, 0.42, 0.5]; for (let c = 0; c < 3; c++) img[i * 3 + c] = img[i * 3 + c] * (1 - t * 0.35) * (1 - t + t * hue[c] * 1.6); }   // glaze: deeper, a cool violet-umber
    const warm = r - b; if (on("wet") && warm > 0.18 && L > 0.25) { const x = i % W, y = (i / W) | 0, t = clamp((warm - 0.18) * 2.5) * 0.6; let s = [0, 0, 0], k = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const X = x + dx * 2, Y = y + dy * 2; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const j = (Y * W + X) * 3; s[0] += wetSrc[j]; s[1] += wetSrc[j + 1]; s[2] += wetSrc[j + 2]; k++; } for (let c = 0; c < 3; c++) img[i * 3 + c] = img[i * 3 + c] * (1 - t) + (s[c] / k) * t * 1.04; }   // loaded wet
  }
  // dry broken: streaks along a fixed drag where frost, want and decay call for it (tops outdoors take frost)
  const dryK = on("dry") ? clamp(E.dry + decay * 0.3) : 0, drag = [0.93, -0.36];
  let broken = 0, counted = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, k = kind(i); if (!id[i] || k === "sky" || k === "window" || k === "lantern" || k === "candle" || k === "flame" || k === "stovefire") continue;
    counted++;
    const amt = dryK + (on("dry") && OUTDOOR_TOP.has(k) ? frost * 0.35 : 0); if (amt <= 0) continue;
    const u = x * drag[0] + y * drag[1], v = -x * drag[1] + y * drag[0], streak = vnoise(u / 40, v / 2.2, seed + 11) * 0.75 + vnoise(u / 12, v / 1.1, seed + 12) * 0.25, patch = vnoise(x / 60, y / 60, seed + 13);
    const t = clamp((streak - (1 - amt * 0.7)) * 3) * clamp((patch - 0.35) * 2.5);   // in patches, where the brush ran dry
    if (t > 0) { broken++; for (let c = 0; c < 3; c++) img[i * 3 + c] = img[i * 3 + c] * (1 - t * 0.7) + canvas[c] * t * 0.7 * clamp(0.35 + lum(img[i * 3], img[i * 3 + 1], img[i * 3 + 2]) * 1.4); }
  }
  // scumble: thin broken light over the far planes (depth 0 near .. 1 far), and mist everywhere
  if (depth && on("scumble")) { let dmin = Infinity, dmax = -Infinity; for (let i = 0; i < n; i++) if (id[i] && isFinite(depth[i])) { dmin = Math.min(dmin, depth[i]); dmax = Math.max(dmax, depth[i]); }
    const air = [0.72, 0.74, 0.78];
    for (let i = 0; i < n; i++) { if (!id[i]) continue; const d = clamp((depth[i] - dmin) / Math.max(1e-3, dmax - dmin)), x = i % W, y = (i / W) | 0, br = 0.6 + 0.4 * vnoise(x / 7, y / 7, seed + 21), t = clamp(Math.pow(d, 1.6) * ((E.air ?? 0.45) + mist) * br, 0, 0.7); for (let c = 0; c < 3; c++) img[i * 3 + c] = img[i * 3 + c] * (1 - t) + air[c] * lum(img[i * 3], img[i * 3 + 1], img[i * 3 + 2]) * 1.5 * t; } }
  // the era's palette: saturation, tint and contrast; 4 and 5 flattened a little (posterised values)
  const out = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    let r = img[i * 3], g = img[i * 3 + 1], b = img[i * 3 + 2]; const L = lum(r, g, b);
    if (!on("era")) { out[i * 4] = clamp(r) * 255; out[i * 4 + 1] = clamp(g) * 255; out[i * 4 + 2] = clamp(b) * 255; out[i * 4 + 3] = src[i * 4 + 3]; continue; }
    r = L + (r - L) * E.sat; g = L + (g - L) * E.sat; b = L + (b - L) * E.sat;
    const ds = decay * 0.35; r = r + (L - r) * ds; g = g + (L - g) * ds; b = b + (L - b) * ds;
    r *= E.tint[0]; g *= E.tint[1]; b *= E.tint[2];
    const ctr = (v) => 0.42 + (v - 0.42) * E.contrast; r = ctr(r); g = ctr(g); b = ctr(b);
    if (E.flat) { const q = (v) => v + (Math.round(v * 6) / 6 - v) * E.flat; r = q(r); g = q(g); b = q(b); }
    out[i * 4] = clamp(r) * 255; out[i * 4 + 1] = clamp(g) * 255; out[i * 4 + 2] = clamp(b) * 255; out[i * 4 + 3] = src[i * 4 + 3];
  }
  out.stats = { brokenShare: counted ? broken / counted : 0, knifePx: cellOf.reduce((a, v) => a + (v >= 0 ? 1 : 0), 0) };
  return out;
}

// Measures (PAINT-LANGUAGE.md): palette entropy (bits, 4 bits a channel), value range (p95 - p5), edge coherence (the
// share of strong-gradient pixels whose orientation agrees with the 3 x 3 structure tensor's, coherence over 0.6)
export function measures(rgba, W, H) {
  const n = W * H, hist = new Map(), L = new Float32Array(n);
  for (let i = 0; i < n; i++) { const r = rgba[i * 4] >> 4, g = rgba[i * 4 + 1] >> 4, b = rgba[i * 4 + 2] >> 4, k = (r << 8) | (g << 4) | b; hist.set(k, (hist.get(k) || 0) + 1); L[i] = lum(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]) / 255; }
  let H0 = 0; for (const v of hist.values()) { const p = v / n; H0 -= p * Math.log2(p); }
  const s = Array.from(L).sort((a, b) => a - b), range = s[Math.floor(n * 0.95)] - s[Math.floor(n * 0.05)];
  let strong = 0, coh = 0;
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    const i = y * W + x, gx = L[i + 1] - L[i - 1], gy = L[i + W] - L[i - W]; if (Math.hypot(gx, gy) < 0.08) continue; strong++;
    let a = 0, b = 0, d = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const j = i + dy * W + dx, ex = L[j + 1] - L[j - 1], ey = L[j + W] - L[j - W]; a += ex * ex; b += ex * ey; d += ey * ey; }
    const c = Math.sqrt((a - d) ** 2 + 4 * b * b) / Math.max(1e-9, a + d); if (c > 0.6) coh++;
  }
  return { entropy: +H0.toFixed(3), valueRange: +range.toFixed(3), edgeCoherence: strong ? +(coh / strong).toFixed(3) : null };
}
