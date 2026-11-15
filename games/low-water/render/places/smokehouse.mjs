// Shadwell's smokehouse (design/PLACES-NEW.md section 3): night (Shadwell awake, the pit glowing) and
// late (03:30: Shadwell asleep, the fire low). The warmest room in Act 1. Blackout: the pit's glow.
import { smokeRoom } from "../worlds/smokehouse.mjs";
import { surf, footing, walkIds, paintId } from "./_common.mjs";
const R = smokeRoom();
export default {
  name: "smokehouse", world: R.world, lights: R.lights, surf: (id, P, N, V) => surf(id, P, N, { ...V, indoor: true }), sky: () => 0.003, paintId,
  camera: { yawDeg: 34, elevDeg: 30, target: [0, 1.6, 0], ppm: 180, W: 2000, H: 1700, dist: 25 },
  paint: { seed: 31, radii: [15, 8.5, 5, 2.8], relief: 0.3 },
  variants: {
    night: { hour: 1.5, note: "Shadwell awake: the pit of oak chips glowing red under the racks", V: { fill: 2.5 }, plan: { ambient: 0.008, mist: 0.012, extinct: 0.003 }, gain: 1.8 },
    late: { hour: 3.5, note: "03:30: Shadwell asleep on the sack, the fire low", V: { emit: { fire: 0.45 }, fill: 1.4 }, plan: { ambient: 0.006, mist: 0.012, extinct: 0.003 }, gain: 2.0 },
  },
  dark: { lights: [{ pos: [-0.2, 0.3, 0], radius: 3, intensity: 1.2 }], emit: ["fire"], plan: { dark: 0.02 } },
  walk: walkIds("slab"), footing: footing(), marks: R.marks,
  notes: "Fire-door to the lane at +x, the back door to the hall at -z. Shadwell and Marrow are drawn by the game.",
};
