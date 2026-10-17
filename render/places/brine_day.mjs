// The Brine's bar at two in the afternoon (the interlude's way out): empty, chairs on the tables with
// their legs up, daylight through the portholes and the door. Sabine asleep on a flour sack is the game's.
import { brineRoom } from "../worlds/brine_in.mjs";
import B from "./brine.mjs";
const D = brineRoom({ set: "day" });
export default { ...B, name: "brine_day", world: D.world, lights: D.lights, dark: null, variants: { day: { hour: 14.3, note: "14:00: daylight through the portholes and the door", V: { day: true, dayPorts: 9, fill: 3 }, plan: { ambient: 0.03, mist: 0.004, extinct: 0.001 }, gain: 1.4 } }, marks: D.marks, notes: "Daylight bar for the interlude." };
