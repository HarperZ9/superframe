// The hundred and twelve stairs (a tall plate the camera scrolls up): dark (moonlight through the
// slits, nothing else; Lamb's lantern is the game's), lit (the lamp room relit: its light comes down
// the well), frost (04:10 on: Keel's drips frozen on the treads, frost.keel).
import { stairs, H } from "../worlds/stairs.mjs";
import { surf, footing, walkIds, paintId } from "./_common.mjs";
import { ID } from "../kit/ids.mjs";
import { fbm } from "../sdf.mjs";
const S = stairs();
const ssurf = (id, P, N, V) => { if (V.frost && id === ID.steps && N[1] > 0.9 && fbm(P[0] * 7, P[2] * 7 + P[1]) > 0.6) return { mat: "lw rime", scale: 0.8, wet: 0.9, emit: null }; return surf(id, P, N, { ...V, indoor: true }); };
export default {
  name: "stairs", world: S.world, lights: S.lights, surf: ssurf, sky: () => 0.004, paintId,
  camera: { yawDeg: 45, elevDeg: 24, target: [0, H / 2, 0], ppm: 190, W: 1920, H: 3600, dist: 30 },
  paint: { seed: 59, radii: [15, 8.5, 5, 2.8], relief: 0.3 },
  variants: {
    dark: { hour: 1.0, note: "the stairs in the dark: moonlight through the slits", V: { slit: 9 }, plan: { ambient: 0.02, mist: 0.002, extinct: 0.001 }, gain: 2.2 },
    lit: { hour: 4.2, note: "the lamp room relit: its light down the well", V: { slit: 9, above: 160 }, plan: { ambient: 0.02, mist: 0.004, extinct: 0.001 }, gain: 1.8 },
    frost: { hour: 4.5, note: "04:10 on: Keel's drips frozen on the treads", V: { slit: 12, above: 160, frost: 1 }, plan: { ambient: 0.02, mist: 0.003, extinct: 0.001 }, gain: 1.8 },
  },
  walk: walkIds("steps", "mole"), footing: footing(), marks: S.marks,
  notes: "The 112 stairs, spiral round an iron post; the landing at 56. Scrolls vertically.",
};
