// The Quota era 4: the far-bank estate, stairwell C. Plates agent, 2026-10-22 (render/worlds/q4_rooms.mjs, render/props/e4_*.mjs).
import { estateStair } from "../worlds/q4_rooms.mjs";
import { place, ROOM4, TUBE_GRADE } from "./_q4.mjs";
export default place("q4_estate_stair", estateStair(), {
  indoor: true, camera: { ...ROOM4, target: [-0.3, 1.6, -0.4], ppm: 150 }, seed: 659, walk: ["concrete"],
  variants: { night: { hour: 23.7, note: "year 70, 23:40: the landing tube blinking, the bulb below gone, sodium in the slot window", V: { fill: 0.7 }, plan: { ambient: 0.004, mist: 0.004, extinct: 0.0015 }, gain: 3.0, grade: TUBE_GRADE } },
  notes: "The Quota era 4: the far-bank estate, stairwell C.",
});
