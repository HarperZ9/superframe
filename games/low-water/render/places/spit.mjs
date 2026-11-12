// The Spit at the second low water (Night 2, 23:20 to 00:40), laid on the SPIT fight arena (arena
// x, z = world x, z; y = arena heights): stars (Lamb's lantern only, before 23:20), lanterns (the
// strippers' lanterns from 23:20), frost (-1 C: frost on the decks).
import { spit } from "../worlds/spit.mjs";
import { surf, sky, ripple, footing, walkIds, paintId } from "./_common.mjs";
const R = spit();
export default {
  name: "spit", world: R.world, lights: R.lights, surf, sky, ripple, paintId,
  camera: { yawDeg: 20, elevDeg: 40, target: [10.5, 1.5, 3.5], ppm: 80, W: 2880, H: 1800, dist: 60 },
  paint: { seed: 37, radii: [14, 8, 4.6, 2.6], relief: 0.25 },
  variants: {
    stars: { hour: 23.3, note: "Night 2 before 23:20: more stars than Gullet has lamps; Lamb's lantern only", V: { stars: 3, moon: { pos: [-120, 70, 90], I: 26000 }, emit: { lantern: 0 }, extra: [[2.6, -0.4, 5.6]] }, plan: { ambient: 0.08, mist: 0.002, extinct: 0.0015 }, gain: 1.9 },
    lanterns: { hour: 23.8, note: "23:20 on: the strippers' lanterns, the pole lantern on the Ann Tull", V: { stars: 3, moon: { pos: [-120, 70, 90], I: 26000 }, extra: [[13.6, -0.2, 8.3], [16.2, 0.9, 3.4]] }, plan: { ambient: 0.07, mist: 0.002, extinct: 0.0015 }, gain: 1.9 },
    frost: { hour: 0.3, note: "-1 C toward 00:10: frost on the decks and the casks", V: { frost: 1, wet: 0.4, stars: 3, moon: { pos: [-120, 70, 90], I: 30000 }, extra: [[13.6, -0.2, 8.3], [16.2, 0.9, 3.4]] }, plan: { ambient: 0.07, mist: 0.002, extinct: 0.0015 }, gain: 1.9 },
  },
  walk: walkIds("mud", "shingle", "weed", "plank", "hull", "pool"), footing: footing(), marks: R.marks,
  arena: { name: "spit", worldOfArena: "x = arena x, z = arena z, y = arena h", cell: 1, origin: [0, 0], note: "decks at the top centre (the Patience) and right (the Ann Tull); channel left; lantern (18, 4); snare (14.5, 4.5)" },
  notes: "The Spit. The tide is the game's: the channel fills first, the Spit goes under from the edges by 00:40.",
};
