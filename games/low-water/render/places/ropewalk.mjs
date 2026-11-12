// The Ropewalk on Night 2, laid on the ROPEWALK fight arena (arena x, z = world x, z): night (22:00,
// the two paraffin lamps), frost (from 01:00: every print kept, the cobbles glass, a dark stripe over
// the warm pipe), dark (the lamp doused: two lit blinds and the shutter).
import { ropewalk, PIPE_Z } from "../worlds/ropewalk.mjs";
import { surf, sky, ripple, footing, walkIds, paintId } from "./_common.mjs";
const R = ropewalk();
const rsurf = (id, P, N, V) => (V.frost && Math.abs(P[2] - PIPE_Z) < 0.11 && P[1] < 0.05 ? surf(id, P, N, { ...V, frost: 0, wet: 0.6 }) : surf(id, P, N, V.frost ? { ...V, wet: 0.35 } : V));
export default {
  name: "ropewalk", world: R.world, lights: R.lights, surf: rsurf, sky, ripple, paintId,
  camera: { yawDeg: 18, elevDeg: 40, target: [13, 1.9, 2.6], ppm: 80, W: 3200, H: 1560, dist: 60 },
  paint: { seed: 31, radii: [14, 8, 4.6, 2.6], relief: 0.25 },
  variants: {
    night: { hour: 22.5, note: "Night 2, 22:00 to 01:00: still, clear, one paraffin lamp a street", V: { stars: 1.4, moon: { pos: [-60, 90, 120], I: 18000 } }, plan: { ambient: 0.05, mist: 0.003, extinct: 0.0015 }, gain: 1.6 },
    frost: { hour: 2.0, note: "from 01:00: frost keeps every print; a dark stripe over the warm pipe", V: { frost: 1.1, stars: 2, moon: { pos: [-60, 90, 120], I: 24000 } }, plan: { ambient: 0.05, mist: 0.002, extinct: 0.0015 }, gain: 1.6 },
    dark: { hour: 2.5, note: "the lamps doused: two lit blinds, the shutter", V: { frost: 1.1, stars: 2.5, moon: { pos: [-60, 90, 120], I: 26000 }, emit: { lantern: 0 } }, plan: { ambient: 0.05, mist: 0.002, extinct: 0.0015 }, gain: 1.8 },
  },
  walk: walkIds("cobble", "slab", "iron", "steps"), footing: footing(), marks: R.marks,
  arena: { name: "ropewalk", worldOfArena: "x = arena x, z = arena z, y = 0 (arena h 9)", cell: 1, origin: [0, 0], note: "lamps at (6, 1) and (19, 1) as the arena; the script has one lamp halfway (ROPEWALK text 98)" },
  notes: "The Ropewalk lane, matched to the combat arena ROPEWALK.",
};
