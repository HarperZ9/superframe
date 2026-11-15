// Shared settings for The Quota's era 4 plates (year 70, the closure; design/eras/era4.md section 11, look L4: ground
// #0f0c09, ink #decca8, the hot mark #5ac4d6; the first sodium, fluorescent tubes, a nicotine film). Plates agent,
// 2026-10-22. SODIUM_GRADE keeps the shadow family brown-black under the orange; TUBE_GRADE lets the tubes' green-white
// cast through cold; DAY4 is the late-autumn overcast, low and grey.
import { surf, footing, walkIds, paintId } from "./_common.mjs";
import { ID } from "../props/e4_kinds.mjs";
import { withDetail } from "../props/kinds.mjs";
export const SODIUM_GRADE = { shadowTint: [0.94, 0.8, 0.66], lift: [0.004, 0.0028, 0.0018], saturation: 0.72 };
export const TUBE_GRADE = { shadowTint: [0.86, 0.9, 0.86], lift: [0.003, 0.0035, 0.003], saturation: 0.6 };
export const DAY4 = { shadowTint: [0.9, 0.88, 0.84], lift: [0.004, 0.004, 0.0038], saturation: 0.62 };
export const ROOM4 = { yawDeg: 34, elevDeg: 36, W: 1920, H: 1300, dist: 22 };
export const STREET4 = { yawDeg: 38, elevDeg: 40, W: 1920, H: 1080, dist: 70 };
const FOOT4 = { wood: ["lino", "carpet", "oakx", "terrazzo", "boards"], stone: ["concrete", "cobble", "slab", "steps"] };
const foot4 = () => ({ ...footing(), ...Object.fromEntries(Object.entries(FOOT4).flatMap(([f, ks]) => ks.filter((k) => ID[k] != null).map((k) => [ID[k], f]))) });
// place(name, R, o): a plate's module from a built world (o: indoor, camera, seed, variants, walk, notes)
export function place(name, R, { indoor = true, camera, seed, variants, walk = ["lino"], notes, sky = indoor ? 0.01 : 0.02, figureLights, relief = 0.3, decay = 0.3 }) {
  return {
    name, world: R.world, lights: R.lights, paintId, surf: withDetail((id, P, N, V) => surf(id, P, N, indoor ? { ...V, indoor: true } : V)), sky: () => sky,
    camera, paint: { seed, radii: indoor ? [15, 8.5, 5, 2.8] : [13, 7.5, 4.4, 2.5], relief }, language: { era: 4, decay }, strokeLight: { strength: 1 },
    variants, figureLights: figureLights || [{ pos: [1.0, 2.3, 2.6], kind: indoor ? "white" : "sodium", I: 5, reach: 9 }],
    walk: walkIds(...walk), footing: foot4(), marks: R.marks, notes,
  };
}
