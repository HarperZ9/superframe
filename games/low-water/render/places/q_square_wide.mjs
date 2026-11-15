// Exchange Square from the bell tower at dawn (The Quota era 2, the wide lens), day 41, 07:50: the low sun just
// over the plain's rim from the south-east, long blue shadows across the snow, the export train at the siding.
// The relief queue is the crowd tier's cards on marks.queue.path, counted by the street stocks. q_square_wide_quiet
// is the same dawn with the siding empty.
import { square } from "../worlds/square.mjs";
import { surf, sky, footing, walkIds, paintId } from "./_common.mjs";
const R = square({ train: true });
export const DAWN = { hour: 7.8, note: "07:50, day 41: the sun just over the rim, long blue shadows on the snow, the relief kitchen's lamp still lit", V: { day: "dawn", frost: 0.55, sun: { pos: [-150, 32, -90], I: 420000, soft: 3, fill: [-200, 160, -160] }, emit: { window: 0.4 } }, plan: { ambient: 0.12, mist: 0.004, extinct: 0.0015 }, gain: 1.35, grade: { saturation: 0.7 } };
// the night square after the thaw (the inspiration batch's wet cobbles: lit windows drawn out on the wet stone)
export const NIGHT = { hour: 21.3, note: "21:20: the thaw, the cobbles wet, the lit windows laid out on them, a thin moon", V: { wet: 0.75, moon: { pos: [-80, 70, -120], I: 6000 }, emit: { window: 1, lantern: 1 } }, plan: { ambient: 0.05, mist: 0.004, extinct: 0.0015 }, gain: 2.6 };
export default {
  name: "q_square_wide", world: R.world, lights: R.lights, surf, sky, paintId,
  camera: { yawDeg: 30, elevDeg: 42, target: [0, 1.5, -2], ppm: 26, W: 1920, H: 1080, dist: 160 },
  paint: { seed: 97, radii: [9, 5, 3, 1.8], relief: 0.22 }, language: { era: 2, decay: 0.3 }, strokeLight: { strength: 1 }, ink: { w: 1.4 },
  variants: { dawn: DAWN, night: NIGHT },
  walk: walkIds("cobble", "steps"), footing: footing(), marks: R.marks,
  notes: "The Quota slice, the wide lens: Exchange Square from the bell tower at dawn, the export train in; the queue is the crowd tier's.",
};
