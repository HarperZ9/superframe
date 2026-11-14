// stats.mjs: the small statistics the compose checkers share. The a-contrario test is the one LSD uses (von Gioi,
// Jakubowicz, Morel and Randall, from memory, moderate confidence): a rectangle of n pixels with k aligned to it,
// against the chance of k or more aligned when each pixel's orientation is independent and uniform.
const LANCZOS = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];

export function lgamma(x) {
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
  x -= 1; let a = LANCZOS[0]; const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += LANCZOS[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

// log10 of P[X >= k] for X ~ Binomial(n, p), summed from k upward until the terms stop mattering.
export function log10BinomTail(n, k, p) {
  if (k <= 0) return 0;
  if (k > n) return -Infinity;
  const lp = Math.log(p), lq = Math.log1p(-p), ln = lgamma(n + 1);
  const term = i => ln - lgamma(i + 1) - lgamma(n - i + 1) + i * lp + (n - i) * lq;
  const t0 = term(k); let s = 1;
  for (let i = k + 1; i <= n; i++) { const r = Math.exp(term(i) - t0); s += r; if (r < 1e-12 * s) break; }
  return (t0 + Math.log(s)) / Math.LN10;
}

// Number of tests for a W x H image, as LSD counts them: rectangles by position, angle and width.
export const log10Tests = (W, H) => 2.5 * (Math.log10(W) + Math.log10(H)) + Math.log10(11);

export function median(a) {
  const s = [...a].sort((x, y) => x - y), n = s.length;
  return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null;
}

// Deterministic stream for controls (mulberry32 on a string hash), so shuffled controls replay exactly.
export function rng(seed) {
  let h = 1779033703 ^ String(seed).length;
  for (const ch of String(seed)) { h = Math.imul(h ^ ch.charCodeAt(0), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Two-sided binomial interval half-width at about 2 sigma (a Wald form). Superseded 2026-10-30 by
// exactInterval below (prior update PU30-04, F91 C5): F91 showed the per-test Wald rule fails its error
// rate near bounds and at small n. Kept only so recorded prereg outputs (twoSigmaAt20) replay unchanged.
export const twoSigma = (p, n) => 2 * Math.sqrt(Math.max(p * (1 - p), 1e-9) / n);

// P[X <= k] for X ~ Binomial(n, p), from the exact upper tail.
const lowerTail = (n, k, p) => (k >= n ? 1 : 1 - Math.pow(10, log10BinomTail(n, k + 1, p)));

function bisect(f, lo, hi) {
  for (let i = 0; i < 100; i++) { const m = (lo + hi) / 2; if (f(m)) hi = m; else lo = m; }
  return (lo + hi) / 2;
}

// Exact (Clopper-Pearson) two-sided interval for k hits in n trials. Never narrower than the nominal level.
export function exactInterval(k, n, alpha = 0.05) {
  if (!(n > 0)) return [0, 1];
  const lo = k <= 0 ? 0 : bisect(p => Math.pow(10, log10BinomTail(n, k, p)) >= alpha / 2, 0, 1);
  const hi = k >= n ? 1 : bisect(p => lowerTail(n, k, p) <= alpha / 2, 0, 1);
  return [lo, hi];
}

// Bound-violation rule from F91 C5: exact one-sided binomial p at each bound, Holm across the family.
// tests: [[k, n, bound], ...]. Returns { flags, p } in input order.
export function boundViolations(tests, alpha = 0.05) {
  const p = tests.map(([k, n, b]) => (b >= 1 ? 1 : Math.min(1, Math.pow(10, log10BinomTail(n, k, b)))));
  const order = p.map((_, i) => i).sort((a, b) => p[a] - p[b]), flags = p.map(() => false), m = p.length;
  for (let r = 0; r < m; r++) { if (p[order[r]] * (m - r) > alpha) break; flags[order[r]] = true; }
  return { flags, p };
}
