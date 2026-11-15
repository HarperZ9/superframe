// The Quota era 5: channel. Plates agent, 2026-10-23 (render/worlds/q5_rooms.mjs, render/props/e5_*.mjs).
import { channel } from "../worlds/q5_rooms.mjs";
import { place, ROOM5, SCREEN5 } from "./_q5.mjs";
export default place("q5_channel", channel(), {
  indoor: true, camera: { ...ROOM5, target: [0, 1, -0.4], ppm: 246 }, seed: 711, walk: ["carpet"],
  variants: { evening: { hour: 21.4, note: "year 115, April, 21:25: the ring light on, three screens, the room cold-bright in the lens", V: { fill: 0.1 }, plan: { ambient: 0.01, mist: 0.003, extinct: 0.001 }, gain: 2.05, grade: SCREEN5 } },
  notes: "The Quota era 5: the ring light on, three screens, the room cold-bright in the lens.",
});
