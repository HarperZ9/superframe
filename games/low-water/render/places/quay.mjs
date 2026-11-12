// Lamp Quay at the closer camera: the night set (night 23:00, heavy rain 02:00, frost 04:40, the
// dawn minute 06:10) and the blackout. One world (worlds/harbour.mjs) shared with the floor, the
// mole and the pull-backs.
import { harbour } from "../worlds/harbour.mjs";
import { surf, sky, ripple, footing, walkIds, paintId } from "./_common.mjs";
const H = harbour({ set: "night" });
const MOON = { pos: [-70, 60, -140], I: 5000 };
export default {
  name: "quay", world: H.world, lights: H.lights, surf, sky, ripple, paintId,
  camera: { yawDeg: 26, elevDeg: 30, target: [4, 6.2, -3.0], ppm: 80, W: 4800, H: 2560, dist: 70 },
  paint: { seed: 11, radii: [14, 8, 4.6, 2.6], relief: 0.25 },
  variants: {
    night: { hour: 23.0, note: "Night 1, 23:00: clear, the Low Night walkers' lanterns on the floor", V: { moon: MOON, stars: 1.2 }, plan: { ambient: 0.018, mist: 0.003, extinct: 0.002 }, gain: 1.45 },
    rain: { hour: 2.0, note: "Night 1, 01:30 to 02:40: heavy rain, everything wet, the floor's lanterns gone", V: { wet: 1, emit: { lantern: 0, candle: 0 }, skyLevel: 0.02 }, plan: { ambient: 0.012, mist: 0.005, extinct: 0.004 }, gain: 1.45 },
    frost: { hour: 4.6, note: "04:10 on Night 1 and from 01:00 on Night 2: clear, rime on every cold top, the moon hard", V: { frost: 1, moon: { pos: [-110, 80, -60], I: 16000 }, stars: 2, emit: { lantern: 0, candle: 0 } }, plan: { ambient: 0.02, mist: 0.002, extinct: 0.0015 }, gain: 1.5 },
    dawn: { hour: 6.15, note: "the dawn minute of colour: low sun off the sea, the sodium out, frost going", V: { frost: 0.5, day: "dawn", sun: { pos: [260, 34, -40], I: 260000, fill: [-200, 160, 220] }, emit: { sodium: 0, lantern: 0, candle: 0, window: 0.35 } }, plan: { ambient: 0.35, mist: 0.0015, extinct: 0.001 }, gain: 1.6 },
  },
  dark: { lights: [{ pos: [-6.6, 1.3, -1.6], radius: 8, intensity: 2.4 }, { pos: [9.4, 1.6, -2.4], radius: 6, intensity: 1.6 }, { pos: [27.6, 3.3, -3.1], radius: 7, intensity: 2.2 }, { pos: [-5.5, -2.9, 5], radius: 6, intensity: 2.0 }, { pos: [-2.6, -2.8, 10.2], radius: 6, intensity: 2.0 }, { pos: [2.4, -2.9, 4.6], radius: 6, intensity: 2.0 }, { pos: [-10.2, -2.9, 4.8], radius: 6, intensity: 1.8 }, { pos: [12.4, -2.9, 9.6], radius: 6, intensity: 1.8 }, { pos: [-3, -0.6, 1.2], radius: 4, intensity: 1.4 }], emit: ["lantern", "window", "candle", "fire", "flame"], lit: (id, p, k) => k.name !== "window" || (Math.floor(p[0] * 2.1 + p[1]) & 1) === 0 },
  walk: walkIds("cobble", "slab", "steps", "mud", "pool", "mole", "shingle", "weed", "weedrock"), footing: footing(), marks: H.marks,
  notes: "Lamp Quay, the harbour floor at low water, the mole root, the Saint Cuthwin at the mole steps, Mother at the mole's end. The game draws the tide, fog, rain streaks and people.",
};
