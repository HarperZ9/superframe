// The exchange hall at harvest, era 1 (year 0): the weigh-house floor in its trading year, the louvres throwing the
// afternoon in long gold bars across the floor. The same hall era 2 strips (q_exchange).
import { exchange } from "../worlds/q1_rooms.mjs";
import { withDetail, ID } from "../props/kinds.mjs";
import { walkIds, paintId } from "./_common.mjs";
import Wg from "./weigh.mjs";
import { HARVEST_GRADE } from "./_q1.mjs";
const R = exchange();
export default { ...Wg, name: "q1_exchange", surf: withDetail(Wg.surf), sky: () => 0.05, paintId, camera: { yawDeg: 34, elevDeg: 34, target: [0, 1.3, 0.2], ppm: 150, W: 1920, H: 1300, dist: 22 }, walk: [...(Wg.walk || []), ...walkIds("chaff", "greyx", "greyz", "oakx")], world: R.world, lights: R.lights, marks: R.marks, paint: { ...Wg.paint, seed: 311 }, language: { era: 1, decay: 0.05 }, strokeLight: { strength: 1 },
  variants: { harvest: { hour: 15.2, note: "harvest, 15:10: the afternoon in gold bars through the louvre, chaff in the air, the lamps not wanted", V: { day: true, indoor: true, fill: 0.6, sun: { pos: [-199, 1.9, -23], I: 250000, soft: 40 }, emit: { lantern: 0 } }, plan: { ambient: 0.02, mist: 0.008, extinct: 0.001 }, gain: 1.7, grade: { ...HARVEST_GRADE, shadowTint: [0.62, 0.55, 0.46], lift: [0.003, 0.003, 0.0035], saturation: 0.7 } },
    work: { hour: 12, note: "a flat work light for judging build stages", V: { fill: 8, indoor: true }, plan: { ambient: 0.1, mist: 0.004, extinct: 0.001 }, gain: 1.6, grade: HARVEST_GRADE } },
  dark: null, notes: "The Quota era 1: the exchange hall at harvest (the weigh-house in its trading year)." };
