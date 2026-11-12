// The room above the Brine at two in the afternoon (the interlude opens here): daylight through the
// planking in white stripes, the stove cold, the coat drying with a tide mark at the hem.
import { room } from "../worlds/room.mjs";
import R from "./room.mjs";
const D = room({ set: "day" });
export default { ...R, name: "room_day", world: D.world, lights: D.lights, variants: { day: { hour: 14.1, note: "14:00: stripes of white light through the planking", V: { day: true, sun: { pos: [-90, 80, -210], I: 900000 }, porthole: { type: 3, I: 30 }, fill: 1.5 }, plan: { ambient: 0.05, mist: 0.004, extinct: 0.001 }, gain: 1.2 } }, marks: D.marks, notes: "Daylight room for the interlude." };
