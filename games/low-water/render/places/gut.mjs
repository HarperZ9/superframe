// The Gut by night, in Oil and Ink (author 2026-10-18: "Oil and Ink"). It was palette-locked (the look bible's
// first take, kept as places/gut_palette.mjs); in play its flat palette blocks and dither screen read as an
// unpainted fallback (Act 3's gale fight, 2026-10-21), so it is traced, shaded and painted like every other
// plate. Variants: night (every other wire lamp dark), rigged (l.gut_wires: every lamp lit), frozen (Night 2
// from 02:00: the gutter frozen black and glassy), blackout (02:50 to 03:20: only the gutter glows).
import { gut } from "../worlds/gut.mjs";
import { surf as surf0, sky, ripple, footing, walkIds, paintId } from "./_common.mjs";
import { ID } from "../kit/ids.mjs";
const G = gut();
const DOORS = [[-12.4, 0.6, -1.5], [-3.6, 0.6, -1.5], [6.2, 0.6, 1.5]];
// the frozen gutter: the glowing trough reads as ice, its glow out
// the gutter: an emitter takes its light's spectrum, not its paint, so a violet emitter came out cream. It is a
// pale violet paint instead, lit from just above by a row of small lamps, and violet by reflecting them
const surf = (id, P, N, V) => (id === ID.gutter && !V.frozen ? { mat: "lw violet", scale: 1.7, wet: 0.6, emit: null } : surf0(V.frozen && id === ID.gutter ? ID.ice : id, P, N, V));
const lights = (V = {}) => {
  const out = [];
  for (const l of G.lamps) if (!V.lampsOff && (V.rigged || l.lit)) out.push({ pos: l.pos, type: 1, I: 9, reach: 7, group: "lamp", key: `lamp@${l.pos.join(",")}` });
  if (!V.doorsDark) for (const p of DOORS) out.push({ pos: p, type: 1, I: 2.6, reach: 3.6, group: "window", key: `door@${p.join(",")}` });
  if (!V.frozen) for (let x = -13; x <= 13; x += 2.6) out.push({ pos: [x, G.laneY(x) + 0.25, 0.25 * Math.sin(x * 0.35)], type: 2, I: V.lampsOff ? 7 : 4.5, reach: 2.2, group: "gutter", key: `gutter@${x.toFixed(1)}` });
  if (V.moon) out.push({ pos: V.moon.pos, type: 2, I: V.moon.I, reach: 400, key: "moon", soft: 30 });
  if (V.fill) out.push({ pos: [0, 6, 4], type: 1, I: V.fill, reach: 14, group: "fill", key: "fill" });
  return out;
};
const moon = { pos: [70, 110, -80], I: 9000 };
export default {
  name: "gut", world: G.world, lights, surf, sky, ripple, paintId,
  camera: { yawDeg: 6, elevDeg: 52, target: [-0.2, 2.2, -0.6], ppm: 80, W: 2880, H: 1100, dist: 40 },
  paint: { seed: 43, radii: [14, 8, 4.6, 2.6], relief: 0.24 },
  variants: {
    night: { hour: 23.5, note: "22:00 to 02:50: every other wire lamp dark", V: { wet: 0.5, moon, fill: 6, emit: { gutter: 1 } }, plan: { ambient: 0.02, mist: 0.006, extinct: 0.002 }, gain: 1.8 },
    rigged: { hour: 1.0, note: "after l.gut_wires: every lamp lit", V: { wet: 0.5, rigged: true, moon, fill: 6, emit: { gutter: 1 } }, plan: { ambient: 0.02, mist: 0.006, extinct: 0.002 }, gain: 1.7 },
    frozen: { hour: 2.0, note: "Night 2 from 02:00: the gutter frozen black and glassy under every lamp", V: { frost: 0.6, frozen: true, rigged: true, moon: { ...moon, I: 6000 }, fill: 6, emit: { gutter: 0 } }, plan: { ambient: 0.02, mist: 0.003, extinct: 0.0015 }, gain: 1.7 },
    blackout: { hour: 2.9, note: "the blackout, 02:50 to 03:20: only the gutter glows", V: { wet: 0.5, lampsOff: true, doorsDark: true, moon: { ...moon, I: 5000 }, fill: 3, emit: { lantern: 0, window: 0 } }, plan: { ambient: 0.012, mist: 0.006, extinct: 0.002 }, gain: 2.1 },
  },
  dark: { lights: DOORS.map((p) => ({ pos: p, radius: 3, intensity: 0.8 })), emit: ["gutter"], plan: { dark: 0.02 } },
  walk: walkIds("cobble", "slab", "gutter", "ice", "weed"), footing: footing(), marks: G.marks,
  notes: "The Gut lane, painted. The palette-locked first take is places/gut_palette.mjs.",
};
