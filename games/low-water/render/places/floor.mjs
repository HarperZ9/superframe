// The harbour floor at low water (Night 1, 22:20 to 23:50), a camera on the harbour world: the gully,
// the ribs of the Margery Dole and the hand line, the stranded fish and its sign, the drowned lamp,
// the stranded boat, Lugg's rope, Nan Cockle's shingle bar, the walkers' lanterns in the pools, the
// quay wall above with its sodium. Variants: night (clear) and rain (23:35 to 23:50, the prints going);
// dithers: fog (from 23:20, four tones, fog to paper white, the look bible's Flats) and dark.
import { harbour } from "../worlds/harbour.mjs";
import { surf, sky, ripple, footing, walkIds, paintId } from "./_common.mjs";
const H = harbour({ set: "night" });
const LANTERNS = [[-5.5, 5.0], [-2.6, 10.2], [2.4, 4.6], [-10.2, 4.8], [12.4, 9.6], [-20.5, 11.5]];
const dl = LANTERNS.map(([x, z]) => ({ pos: [x, -2.85, z], radius: 6, intensity: 2.0 }));
const fogHaze = (o, d, t) => { const k = Math.max(0, t - 52) / 30; return 1 - Math.exp(-k * k); };
export default {
  name: "floor", world: H.world, lights: H.lights, surf, sky, ripple, paintId,
  camera: { yawDeg: 26, elevDeg: 40, target: [-2.5, -3.0, 6.0], ppm: 80, W: 4000, H: 2400, dist: 70 },
  paint: { seed: 13, radii: [14, 8, 4.6, 2.6], relief: 0.25 },
  variants: {
    night: { hour: 22.9, note: "Night 1, 22:20 to 23:20: clear, low water -0.55 m, the walkers' lanterns", V: { moon: { pos: [-90, 80, -60], I: 16000 }, stars: 1.2 }, plan: { ambient: 0.03, mist: 0.003, extinct: 0.002 }, gain: 1.5 },
    rain: { hour: 23.7, note: "23:35 to 23:50: light rain on the prints, the gully filling", V: { wet: 0.8, skyLevel: 0.018, moon: { pos: [-90, 80, -60], I: 6000 } }, plan: { ambient: 0.022, mist: 0.005, extinct: 0.004 }, gain: 1.5 },
  },
  dithers: {
    fog: { lights: [...dl, { pos: [-13, -2.2, 12.6], radius: 5, intensity: 1.6 }], emit: ["lantern", "candle", "window"], haze: fogHaze, sky: 0.92, plan: { dark: 0.1 } },
  },
  dark: { lights: dl, emit: ["lantern", "candle"], plan: { dark: 0.06 } },
  walk: walkIds("mud", "pool", "weed", "weedrock", "shingle", "steps", "slab", "cobble"), footing: footing(), marks: H.marks,
  notes: "The Floor. The game draws the tide (water at the tide's height), rain streaks and people. Fog dither: the Flats look (look bible frame 4).",
};
