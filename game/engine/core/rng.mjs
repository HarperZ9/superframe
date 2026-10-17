// Seeded, stateless randomness. A roll is a pure function of the save's seed and a key, so
// reloading a save and trying the same thing again gives the same result.
export function hashStr(s, seed = 0x9e3779b9) {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; h ^= h >>> 16;
  return h >>> 0;
}
export const rand01 = (seed, key) => hashStr(String(key), seed) / 4294967296;
// n dice of s sides, as a list, from (seed, key).
export const dice = (seed, key, n = 2, s = 6) => Array.from({ length: n }, (_, i) => 1 + Math.floor(rand01(seed, `${key}#${i}`) * s));
