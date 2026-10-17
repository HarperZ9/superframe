// Light rigs for the places, matched by eye to the baked plates. Lamp positions from game/look.mjs
// (LAMPS) for the quay; the Brine's from its scene (the bar lamps and the stove).
import { sodiumTone } from "./shade.mjs";
const QUAY_LAMPS = [[-9.5, 4.35, -0.7], [-0.5, 4.65, -0.7], [7.5, 4.15, -0.7]];
export const RIGS = {
  quay: { tone: sodiumTone, rig: { amb: [0.07, 0.06, 0.12], ground: [0.03, 0.025, 0.04], key: { dir: [0.3, 0.8, -0.5], c: [0.05, 0.05, 0.08], wrap: 0.3 }, fresnel: { c: [0.32, 0.19, 0.08], pow: 3 },
    lamps: QUAY_LAMPS.map((pos) => ({ pos, c: [1.0, 0.62, 0.26], power: 44 })) } },
  brine: { tone: null, rig: { fresnel: { c: [0.22, 0.14, 0.08], pow: 3 }, amb: [0.16, 0.1, 0.12], ground: [0.05, 0.03, 0.025], key: { dir: [-0.2, 0.7, -0.6], c: [0.1, 0.07, 0.04], wrap: 0.4 },
    lamps: [{ pos: [0.6, 2.2, -1.0], c: [1.0, 0.74, 0.42], power: 22 }, { pos: [-3.4, 0.9, 0.2], c: [1.0, 0.5, 0.22], power: 8 }, { pos: [3.0, 2.4, -1.6], c: [1.0, 0.78, 0.5], power: 14 }, { pos: [4.5, 1.6, 2.5], c: [1.0, 0.7, 0.4], power: 6 }] } },
  weigh: { tone: null, rig: { amb: [0.06, 0.04, 0.035], ground: [0.03, 0.02, 0.02], key: { dir: [0.1, 0.8, -0.4], c: [0.05, 0.04, 0.03], wrap: 0.3 },
    lamps: [{ pos: [0, 2.2, -1.6], c: [1.0, 0.7, 0.36], power: 14 }, { pos: [4.2, 2.0, 2.4], c: [1.0, 0.7, 0.4], power: 8 }], fresnel: { c: [0.2, 0.12, 0.06], pow: 3 } } },
};
