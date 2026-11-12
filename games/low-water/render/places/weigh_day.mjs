// The weigh-house by day (the interlude's tube call): "a barn of a room", the voting pans on the
// wall, the balance chains running up through the roof, Pip on a crate by the brass tube mouth
// (Pip is the game's). Daylight through the louvre and the door.
import { weighRoom } from "../worlds/weigh_in.mjs";
import Wg from "./weigh.mjs";
const D = weighRoom({ set: "day" });
const lights = (V) => D.lights(V).filter((l) => l.key !== "louvre").concat([{ pos: [-8, 4.0, 0.6], type: 3, I: 900, cone: [1, -0.25, 0], mode: 2, reach: 30, key: "daylouvre", soft: 12 }, { pos: [3.4, 1.5, -6.5], type: 3, I: 300, cone: [0, -0.2, 1], mode: 2, reach: 16, key: "daydoor" }]);
export default { ...Wg, name: "weigh_day", world: D.world, lights, dark: null, variants: { day: { hour: 14.6, note: "14:30: daylight in bars through the louvre", V: { day: true, fill: 6 }, plan: { ambient: 0.04, mist: 0.006, extinct: 0.001 }, gain: 1.3 } }, marks: D.marks, notes: "Daylight weigh-house for the interlude (day_tube)." };
