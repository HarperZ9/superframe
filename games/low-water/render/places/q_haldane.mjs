// The Haldane table, The Quota era 2 (the narrow lens): day 41 of the famine winter at dawn, five bowls. The
// grey winter dawn comes through the one small window, the embers are kept in, nobody has lit a lamp (there
// is nothing to burn). The coda (a week later, four bowls) is haldane_coda.
import { haldane } from "../worlds/haldane.mjs";
import { surf, footing, walkIds, paintId } from "./_common.mjs";
import { HARVEST_DAY, HARVEST_GRADE } from "./_q1.mjs";   // era 1's variant (W3-C)
const R = haldane({ set: "morning" });
export const DAWN = { hour: 7.6, note: "07:35, day 41: grey winter dawn through the window, frost on its lower panes, the embers kept in", V: { day: "dawn", window: 40, sun: { pos: [-120, 40, -260], I: 140000 }, fill: 0.5 }, plan: { ambient: 0.012, mist: 0.003, extinct: 0.001 }, gain: 2.8 };
export default {
  name: "q_haldane", world: R.world, lights: R.lights, surf: (id, P, N, V) => surf(id, P, N, { ...V, indoor: true }), sky: (d, V) => (V.day ? 0.04 : 0.01), paintId,
  camera: { yawDeg: 34, elevDeg: 36, target: [0, 0.9, -0.3], ppm: 235, W: 1920, H: 1300, dist: 20 },
  paint: { seed: 61, radii: [15, 8.5, 5, 2.8], relief: 0.3 }, language: { era: 2, decay: 0.3 }, strokeLight: { strength: 1 },
  variants: { harvest: { hour: 6.9, note: "harvest, year 0, 06:55: the sun up already and warm in the window, the window open, the fire low", V: { day: true, window: 46, sun: { pos: [-120, 30, -260], I: 170000 }, fill: 0.6 }, plan: { ambient: 0.014, mist: 0.004, extinct: 0.001 }, gain: 2.5, grade: HARVEST_GRADE }, dawn: DAWN },
  walk: walkIds("boards"), footing: footing(), marks: R.marks,
  notes: "The Quota slice, the narrow lens: the Haldane table at dawn, five bowls.",
};
