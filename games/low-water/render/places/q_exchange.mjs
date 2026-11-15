// The grain exchange's floor, The Quota era 2: the weigh-house interior re-dressed (worlds/weigh_in.mjs set
// "exchange"). Early trading on day 41, 08:30: the lamps lit against the grey, Halvard's sacks along the wall.
import { weighRoom } from "../worlds/weigh_in.mjs";
import Wg from "./weigh.mjs";
const R = weighRoom({ set: "exchange" });
export default { ...Wg, name: "q_exchange", world: R.world, lights: R.lights, marks: R.marks, paint: { ...Wg.paint, seed: 101 }, language: { era: 2, decay: 0.2 }, strokeLight: { strength: 1 },
  variants: { morning: { hour: 8.5, note: "08:30, day 41: early trading, lamps lit against the grey, the square's light at the louvre", V: { fill: 2.5, sodiumIn: 0, emit: { lantern: 0.6 } }, plan: { ambient: 0.012, mist: 0.004, extinct: 0.001 }, gain: 1.6 } },
  dark: null, notes: "The Quota slice: the grain exchange floor (the weigh-house re-dressed)." };
