// The weigh-house office (design/PLACES-NEW.md section 6; id weighoffice, since office is the harbour
// office): one night variant, dark (place light 0.08), the yard's sodium through the window. The lantern
// on or under the desk is run-time light. Blackout: the window goes; nothing in the room burns.
import { weighOffice } from "../worlds/weighoffice.mjs";
import { surf, footing, walkIds, paintId } from "./_common.mjs";
const R = weighOffice();
export default {
  name: "weighoffice", world: R.world, lights: R.lights, surf: (id, P, N, V) => surf(id, P, N, { ...V, indoor: true }), sky: () => 0.003, paintId,
  camera: { yawDeg: 34, elevDeg: 32, target: [-0.3, 0.8, -0.4], ppm: 260, W: 2000, H: 1500, dist: 25 },
  paint: { seed: 43, radii: [15, 8.5, 5, 2.8], relief: 0.28 },
  variants: {
    night: { hour: 23.5, note: "the yard's sodium through the window; otherwise dark", V: { fill: 2.0 }, plan: { ambient: 0.006, mist: 0.004, extinct: 0.001 }, gain: 2.0 },
  },
  dark: { lights: [{ pos: [-0.4, 1.4, -1.2], radius: 2.5, intensity: 0.8 }], emit: [], plan: { dark: 0.02 } },
  walk: walkIds("boards"), footing: footing(), marks: R.marks,
  notes: "Window at -z over the desk, the tube room's door at -x. Gorm and Hobb are drawn by the game.",
};
