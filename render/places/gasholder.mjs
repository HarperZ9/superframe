// The Gasholder on Night 2, laid on the GASHOLDER fight arena (arena x, z = world x, z, the shingle at
// y = 0): candles (23:00, forty kneelers' candles in jam jars), opening (00:45: every candle out but
// the four standing lights, the stars through the lattice), bulb (the Old Bulb lit with the gas bag:
// a white mantle), frost (from 02:00).
import { gasholder } from "../worlds/gasholder.mjs";
import { surf, sky, ripple, footing, walkIds, paintId } from "./_common.mjs";
const G = gasholder();
export default {
  name: "gasholder", world: G.world, lights: G.lights, surf, sky, ripple, paintId,
  camera: { yawDeg: 22, elevDeg: 42, target: [10, 2.6, 5.5], ppm: 80, W: 2880, H: 1980, dist: 60 },
  paint: { seed: 47, radii: [14, 8, 4.6, 2.6], relief: 0.25 },
  variants: {
    candles: { hour: 23.5, note: "23:00 to 00:45: candles in jam jars, cut to burn until 00:45", V: { stars: 2.4, moon: { pos: [-40, 50, -160], I: 14000 } }, plan: { ambient: 0.016, mist: 0.003, extinct: 0.0015 }, gain: 1.6 },
    opening: { hour: 0.8, note: "the Opening, 00:45: all candles out but the four standing lights", V: { stars: 3, moon: { pos: [-40, 50, -160], I: 18000 }, emit: { candle: 0 }, standing: true }, plan: { ambient: 0.018, mist: 0.002, extinct: 0.0015 }, gain: 1.7 },
    bulb: { hour: 0.9, note: "the Old Bulb lit with the gas bag: a white mantle in violet glass", V: { stars: 2, moon: { pos: [-80, 70, -120], I: 5000 }, bulb: 30 }, plan: { ambient: 0.016, mist: 0.004, extinct: 0.0015 }, gain: 1.4 },
    frost: { hour: 2.2, note: "from 02:00: frost on the shingle and the lattice; the procession gone", V: { frost: 1, stars: 3, moon: { pos: [-80, 70, -120], I: 8000 }, emit: { candle: 0.4 } }, plan: { ambient: 0.018, mist: 0.002, extinct: 0.0015 }, gain: 1.6 },
  },
  walk: walkIds("shingle", "slab", "cobble", "straw"), footing: footing(), marks: G.marks,
  arena: { name: "gasholder", worldOfArena: "x = arena x, z = arena z, y = 0 (arena h 8)", cell: 1, origin: [0, 0], note: "dais x 7..13, z 4..7; the Old Bulb at (10, 5); standing lights (3, 2) (17, 2) (3, 8.5) (17, 8.5); exits west and east" },
  notes: "The Gasholder frame, matched to the combat arena GASHOLDER. The crown's colour bars when the Bulb is lit are a run-time effect (the pass has no coloured lights).",
};
