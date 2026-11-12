// Shared pieces for place modules: the kit surface function, the sky (stars fixed in plate space
// for an orthographic camera), the ripple of wet ground, footing by surface kind.
import { surfOf, ID } from "../kit/ids.mjs";
import { vnoise } from "../sdf.mjs";
import { rnd } from "../kit/world.mjs";
export const surf = (id, P, N, V) => surfOf(id, P, N, V);
export function sky(d, V = {}, o = null) {
  if (V.day) return V.day === "dawn" ? 0.9 : 1.6;
  let s = V.skyLevel ?? 0.014;
  if (o && V.stars) { const gx = Math.floor(o[0] * 9 + o[2] * 3), gy = Math.floor(o[1] * 9 - o[2] * 2), h = rnd(gx, gy, 77); if (h < 0.004) s += V.stars * (0.4 + 3 * rnd(gx, gy, 5)); }
  return s;
}
export const ripple = (P) => [0.05 * (vnoise(P[0] * 2.3, P[2] * 2.3) - 0.5), 0.05 * (vnoise(P[0] * 2.3 + 9, P[2] * 2.3) - 0.5)];
export const FOOT = { stone: ["quay", "cobble", "slab", "steps", "mole", "wall"], mud: ["mud"], water: ["pool"], weed: ["weed", "weedrock", "weedwall"], shingle: ["shingle"], wood: ["boards", "deck", "plank", "timber"], sand: ["sand"] };
export const footing = () => Object.fromEntries(Object.entries(FOOT).flatMap(([f, ks]) => ks.map((k) => [ID[k], f])));
export const walkIds = (...names) => names.map((n) => ID[n]);
// pid: a paint region per prop so strokes stop at each object's edge
export const paintId = (id, P, prop) => (prop >= 0 ? (id * 37 + prop * 11) % 251 + 1 : id);
