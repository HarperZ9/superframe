// Mother's lamp room at the closer room camera: lit (the arc and the green rings), dark (before the
// restrike: the town's sodium from below, the cold sky), and frost (lit, 04:25 to 05:05: Keel's drips
// frozen on the floor for e.hammer).
import { lampRoom } from "../worlds/lamp_in.mjs";
import { surf, footing, walkIds, paintId, ripple } from "./_common.mjs";
import { ID } from "../kit/ids.mjs";
import { fbm } from "../sdf.mjs";
const R = lampRoom();
const lsurf = (id, P, N, V) => { const s = surf(id, P, N, { ...V, indoor: true }); if (V.frost && id === ID.iron && N[1] > 0.9 && P[1] < 0.05 && fbm(P[0] * 6.5, P[2] * 6.5) > 0.62 + 0.1 * Math.abs(Math.sin(P[0] * 1.3 + P[2])) && Math.hypot(P[0], P[2]) > 1.2) return { mat: "lw rime", scale: 0.8, wet: 0.9, emit: null }; if (s.emit && s.emit.type === "led" && !V.arc) return { mat: "metal", scale: 1.2, wet: 0, emit: null }; return s; };
export default {
  name: "lamp", world: R.world, lights: R.lights, surf: lsurf, sky: (d) => 0.02 + 0.05 * Math.max(0, d[1]), paintId, ripple,
  camera: { yawDeg: 40, elevDeg: 38, target: [0, 1.4, 0], ppm: 190, W: 2400, H: 1920, dist: 30 },
  paint: { seed: 5, radii: [15, 8.5, 5, 2.8], relief: 0.3 },
  variants: {
    lit: { hour: 4.2, note: "relit: the arc, a third of the rings bottle green", V: { arc: true }, plan: { ambient: 0.02, mist: 0.0025, extinct: 0.002 }, gain: 1.3, lens: { ghostGain: 0 } },
    dark: { hour: 4.2, note: "before the restrike: the town in sodium far below, the cold sky", V: { arc: false, lamp: 3 }, plan: { ambient: 0.02, mist: 0.0025, extinct: 0.002 }, gain: 1.6 },
    frost: { hour: 4.6, note: "lit, 04:25 to 05:05: Keel's drips frozen on the floor (e.hammer)", V: { arc: true, frost: 1 }, plan: { ambient: 0.02, mist: 0.0025, extinct: 0.002 }, gain: 1.3 },
  },
  walk: walkIds("iron"), footing: footing(), marks: R.marks,
  notes: "The lamp room. Mother's beam outside is the game's (look.mjs).",
};
