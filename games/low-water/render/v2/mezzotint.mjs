// Mezzotint mode (after John Martin's mezzotints for Paradise Lost, 1824 to 1827, public domain; studied for the
// technique): the plate starts as a full black ground (a rocked copper plate holds ink everywhere) and light is
// scraped and burnished out of it. Burnished lights are smooth; the midtones keep part of the rocked grain, shown as
// stipple (scattered dots) and roulette (dotted lines run with the form); the darks are velvety, the grain closed.
// Printed in a warm black on paper. For the loudest rhetoric: the district meeting's record yields, the pulpit and
// the rally, and dreams; a vast tiered crowd in it is cheap (mostly dark, its tops lit).
//   mezzotint(rgba8, W, H, { seed, gamma, ink, paper, roulette }) -> Uint8ClampedArray
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
function hash(x, y, s) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function blur(a, W, H, r) {
  const t = new Float32Array(a.length), o = new Float32Array(a.length), cl = (v, n) => (v < 0 ? 0 : v >= n ? n - 1 : v);
  for (let y = 0; y < H; y++) { let acc = 0; for (let x = -r; x <= r; x++) acc += a[y * W + cl(x, W)]; for (let x = 0; x < W; x++) { t[y * W + x] = acc / (2 * r + 1); acc += a[y * W + cl(x + r + 1, W)] - a[y * W + cl(x - r, W)]; } }
  for (let x = 0; x < W; x++) { let acc = 0; for (let y = -r; y <= r; y++) acc += t[cl(y, H) * W + x]; for (let y = 0; y < H; y++) { o[y * W + x] = acc / (2 * r + 1); acc += t[cl(y + r + 1, H) * W + x] - t[cl(y - r, H) * W + x]; } }
  return o;
}
export function mezzotint(src, W, H, { seed = 9, gamma = 1.9, ink = [0.07, 0.05, 0.045], paper = [0.9, 0.85, 0.74], roulette = [0.8, -0.6], fire = 0.35 } = {}) {
  const n = W * H, L = new Float32Array(n), warm = new Float32Array(n);
  for (let i = 0; i < n; i++) { const r = src[i * 4] / 255, g = src[i * 4 + 1] / 255, b = src[i * 4 + 2] / 255; L[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b; warm[i] = clamp((r - b) * 2); }
  // the value scraped out of black: normalised to the plate's own range, then a deep toe (most of the plate stays dark)
  const s = Array.from(L).sort((a, b) => a - b), lo = s[Math.floor(n * 0.02)], hi = s[Math.floor(n * 0.995)];
  const V = new Float32Array(n); for (let i = 0; i < n; i++) V[i] = Math.pow(clamp((L[i] - lo) / Math.max(1e-3, hi - lo)), gamma);
  const Vs = blur(V, W, H, 2);   // the burnisher smooths what it lifts
  const out = new Uint8ClampedArray(n * 4), rl = Math.hypot(...roulette), ru = [roulette[0] / rl, roulette[1] / rl];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, v = Vs[i];
    // the rocked grain: fine and dense; how much of it survives falls as the scraper lifts the light
    const grain = hash(x, y, seed) * 0.6 + hash(x >> 1, y >> 1, seed + 1) * 0.4;
    let t;
    if (v > 0.72) t = v;   // burnished: smooth light
    else if (v > 0.18) {   // midtones: stipple and roulette
      const along = x * ru[0] + y * ru[1], across = -x * ru[1] + y * ru[0], row = ((across % 4) + 4) % 4 < 1.2, dot = ((along % 3) + 3) % 3 < 1.4;
      const stip = grain < v * 1.15 ? 1 : 0, roul = row && dot ? 0 : 1;
      t = v * (0.55 + 0.45 * stip) * (v < 0.45 ? roul * 0.7 + 0.3 : 1) + 0.05 * (grain - 0.5);
    } else t = v * 0.6 + 0.04 * grain * v * 4;   // velvety darks: the grain closed, a little tooth
    t = clamp(t);
    const tint = fire * warm[i] * t;   // a fire's light keeps a little of its warmth in the printing
    for (let k = 0; k < 3; k++) out[i * 4 + k] = clamp(ink[k] + (paper[k] - ink[k]) * t + tint * [0.12, 0.03, -0.06][k]) * 255;
    out[i * 4 + 3] = 255;
  }
  return out;
}
