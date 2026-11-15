// How each kind of light moves over time: a gain about 1, deterministic in (profile, seed, t), so two
// frames at the same time agree and a still capture can freeze it (t fixed). Fires breathe, candles
// gutter, rushlights race, carbide hisses, a failing tube stutters, the police blue flashes in pairs.
// Amplitudes are kept small where the light rules a scene, so a pool moves without the picture crawling
// (light temporal stability, design/art/LIGHT.md section 6). Original code.
//   flicker(profile, seed, t) -> gain (mean about 1; the strobe is 0 or about 2.4)
//   PROFILES                  -> the profile names and their amplitudes

const hash = (i, s) => { let x = Math.imul((i | 0) ^ Math.imul(s | 0, 0x9e3779b1), 0x27d4eb2d); x ^= x >>> 15; x = Math.imul(x, 0x85ebca6b); x ^= x >>> 13; return (x >>> 0) / 4294967296; };
// smooth value noise in time, -1..1
export function tnoise(x, s = 0) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return (hash(i, s) * (1 - u) + hash(i + 1, s) * u) * 2 - 1; }
// a rare event: 1 inside an event of length len (seconds) that starts on average every `every` seconds
// eased in and out over a fifth of its length each way, so a gutter or a sputter never jumps between frames
function event(t, s, every, len) {
  const slot = Math.floor(t / every), start = hash(slot, s + 77) * (every - len), u = (t - slot * every - start) / len; if (u <= 0 || u >= 1) return 0;
  const e = 0.2, a = Math.min(1, u / e, (1 - u) / e); return a * a * (3 - 2 * a);
}

export const PROFILES = {
  steady: () => 1,
  lamp: (s, t) => 1 + 0.035 * tnoise(t * 1.7, s),
  gas: (s, t) => 1 + 0.02 * tnoise(t * 5, s),
  candle: (s, t) => 1 + 0.07 * tnoise(t * 3.1, s) + 0.03 * tnoise(t * 11, s + 1) - 0.18 * event(t, s, 9, 0.35),
  tallow: (s, t) => 1 + 0.1 * tnoise(t * 3.6, s) + 0.04 * tnoise(t * 13, s + 1) - 0.25 * event(t, s, 6, 0.5),
  rush: (s, t) => 1 + 0.13 * tnoise(t * 7, s) + 0.05 * tnoise(t * 19, s + 1),
  fire: (s, t) => 1 + 0.12 * tnoise(t * 2.4, s) + 0.06 * tnoise(t * 8.5, s + 1),
  embers: (s, t) => 1 + 0.09 * tnoise(t * 0.35, s),
  carbide: (s, t) => 1 + 0.025 * tnoise(t * 14, s) - 0.3 * event(t, s, 23, 0.2),
  mains: (s, t) => 1 - 0.12 * event(t, s, 31, 1.4) + 0.01 * tnoise(t * 6, s),
  tube: (s, t) => (hash(s, 5) < 0.3 ? 1 - 0.85 * event(t, s, 4.5, 0.25) : 1 + 0.008 * tnoise(t * 50, s)),
  sodium: (s, t) => 1 + 0.01 * tnoise(t * 0.5, s),
  screen: (s, t) => 0.85 + 0.15 * (hash(Math.floor(t / 2.2), s) > 0.5 ? 1 : 0.6),
  strobe: (s, t) => { const p = (t + hash(s, 9)) % 0.9; return p < 0.08 || (p > 0.16 && p < 0.24) ? 2.4 : 0; },
};
export function flicker(profile, seed, t) { const f = PROFILES[profile] || PROFILES.steady; return Math.max(0, f(seed | 0, t)); }
// the largest gain change a profile makes between frames dt apart (a measure for the stability test)
export function maxStep(profile, seed, dt = 1 / 60, T = 30) {
  let m = 0, p = flicker(profile, seed, 0);
  for (let t = dt; t < T; t += dt) { const q = flicker(profile, seed, t); m = Math.max(m, Math.abs(q - p)); p = q; }
  return m;
}
