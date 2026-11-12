// The Gut, palette-locked (look bible: the palette is fixed; nothing outside it can appear): night
// (every other wire lamp dark), rigged (l.gut_wires: every lamp lit), blackout (only the gutter
// glows), frozen (Night 2 from 02:00: the gutter frozen black and glassy under the lamps).
import { gut, WIRES } from "../worlds/gut.mjs";
import { footing, walkIds } from "./_common.mjs";
const G = gut();
const moonDir = (() => { const v = [0.45, 0.7, -0.5], l = Math.hypot(...v); return v.map((c) => c / l); })();
const glow = (L) => ({ pos: L.pos, radius: 5.5, core: 0.9, intensity: 1.7, wrap: 0.4 });
const doorGlows = [[-12.4, 0.6, -1.5], [-3.6, 0.6, -1.5], [6.2, 0.6, 1.5]].map((p) => ({ pos: p, radius: 3.2, core: 0.6, intensity: 1.1, wrap: 0.5 }));
export default {
  name: "gut", kind: "palette", world: G.world,
  camera: { yawDeg: 6, elevDeg: 52, target: [-0.2, 2.2, -0.6], ppm: 80, W: 2880, H: 1100, dist: 40 },
  variants: {
    night: { hour: 23.5, note: "22:00 to 02:50: every other wire lamp dark", moonDir, glows: [...G.lamps.filter((l) => l.lit).map(glow), ...doorGlows], over: { gain: 1.6, ambient: 0.1, moon: 0.4 }, time: 1.7 },
    rigged: { hour: 1.0, note: "after l.gut_wires: every lamp lit (red, amber, green, blue)", moonDir, glows: [...G.lamps.map(glow), ...doorGlows], over: { gain: 1.6, ambient: 0.1, moon: 0.35 }, time: 2.3 },
    frozen: { hour: 2.0, note: "Night 2 from 02:00: the gutter frozen black and glassy under every lamp", moonDir, glows: [...G.lamps.map(glow), ...doorGlows], over: { gain: 1.6, ambient: 0.12, moon: 0.5 }, time: 1.1, V: { frozen: true } },
    dark: { hour: 2.9, note: "the blackout, 02:50 to 03:20: only the gutter glows", moonDir, glows: [], over: { gain: 1.4, ambient: 0.06, moon: 0.3 }, time: 0.9, V: { lampsOff: true, doorsDark: true } },
  },
  walk: walkIds("cobble", "slab", "gutter", "ice", "weed"), footing: footing(), marks: G.marks,
  notes: "The Gut lane. Palette-locked; the void ramp cycles at run time if the game re-runs the palette pass (cycleRate in the engine's palettelight).",
};
