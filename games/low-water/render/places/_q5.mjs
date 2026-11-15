// Shared settings for The Quota's era 5 plates (year 115, three weeks in April, the clearance; design/eras/era5.md
// section 11, look L5: ground #090603, ink #ffb24a, the hot mark #609cff; sodium with its line, phone glow, police
// blue; thin flat paint, edges carried by value). Plates agent, 2026-10-23. SODIUM5 keeps the shadow family warm
// black under the amber; SCREEN5 lets the cold of tubes and screens through; APRIL5 is a spring overcast, grey-green.
import { surf, footing, walkIds, paintId } from "./_common.mjs";
import { ID } from "../props/e4_kinds.mjs";
import { withDetail } from "../props/kinds.mjs";
import "../props/e5_church.mjs";   // registers turf5, gravel5 and headstone5 before FOOT5 reads the ids
export const SODIUM5 = { shadowTint: [0.92, 0.78, 0.62], lift: [0.0035, 0.0024, 0.0012], saturation: 0.7 };
export const SCREEN5 = { shadowTint: [0.84, 0.88, 0.94], lift: [0.003, 0.0032, 0.0038], saturation: 0.58 };
export const APRIL5 = { shadowTint: [0.88, 0.9, 0.86], lift: [0.004, 0.0042, 0.004], saturation: 0.6 };
export const ROOM5 = { yawDeg: 34, elevDeg: 36, W: 1920, H: 1300, dist: 22 };
export const STREET5 = { yawDeg: 38, elevDeg: 40, W: 1920, H: 1080, dist: 70 };
const FOOT5 = { wood: ["lino", "carpet", "vinyl", "boards", "oakx"], stone: ["concrete", "cobble", "slab", "steps", "terrazzo", "gravel5", "tarmac5"], earth: ["green", "mud", "turf5"] };
const foot5 = () => ({ ...footing(), ...Object.fromEntries(Object.entries(FOOT5).flatMap(([f, ks]) => ks.filter((k) => ID[k] != null).map((k) => [ID[k], f]))) });
// place(name, R, o): a plate's module from a built world (o: indoor, camera, seed, variants, walk, notes)
export function place(name, R, { indoor = true, camera, seed, variants, walk = ["lino"], notes, sky = indoor ? 0.01 : 0.02, figureLights, relief = 0.28, decay = 0.35 }) {
  return {
    name, world: R.world, lights: R.lights, paintId, surf: withDetail((id, P, N, V) => surf(id, P, N, indoor ? { ...V, indoor: true } : V)), sky: () => sky,
    camera, paint: { seed, radii: indoor ? [14, 8, 4.6, 2.6] : [12, 7, 4.2, 2.4], relief }, language: { era: 5, decay }, strokeLight: { strength: 0.9 },
    variants, figureLights: figureLights || [{ pos: [1.0, 2.3, 2.6], kind: indoor ? "white" : "sodium", I: 5, reach: 9 }],
    walk: walkIds(...walk), footing: foot5(), marks: R.marks, notes,
  };
}
