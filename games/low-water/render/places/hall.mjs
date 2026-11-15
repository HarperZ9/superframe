// The Guild hall (design/PLACES-NEW.md section 2) at the room camera: early (empty, before 00:40: the
// two lamps and the candle), vote (the same light; the crowd is drawn by the game), dark (the vote in
// darkness: the lamps out, one struck light in the middle of the hall). Blackout: the candle.
import { hallRoom } from "../worlds/hall.mjs";
import { surf, footing, walkIds, paintId } from "./_common.mjs";
const R = hallRoom();
export default {
  name: "hall", world: R.world, lights: R.lights, surf: (id, P, N, V) => surf(id, P, N, { ...V, indoor: true }), sky: () => 0.004, paintId,
  camera: { yawDeg: 34, elevDeg: 30, target: [0, 0.4, 0.3], ppm: 160, W: 2560, H: 1500, dist: 30 },
  paint: { seed: 29, radii: [15, 8.5, 5, 2.8], relief: 0.28 },
  variants: {
    early: { hour: 0.2, note: "before 00:40: the two lamps over the table, the candle at the head, the hall empty", V: { fill: 3.5 }, plan: { ambient: 0.008, mist: 0.004, extinct: 0.001 }, gain: 1.6 },
    vote: { hour: 1.0, note: "00:40 to 01:30 and the second vote: the same light, the hall full (people drawn by the game)", V: { fill: 3.5 }, plan: { ambient: 0.008, mist: 0.006, extinct: 0.001 }, gain: 1.6 },
    struck: { hour: 1.1, note: "the vote in darkness: the lamps put out, one struck light in the middle of the hall", V: { emit: { lantern: 0, candle: 0 }, struck: 1 }, plan: { ambient: 0.003, mist: 0.004, extinct: 0.001 }, gain: 2.0 },
  },
  dark: { lights: [{ pos: [-4.1, 1.0, 0.0], radius: 3, intensity: 1.4 }], emit: ["candle"], plan: { dark: 0.02 } },
  walk: walkIds("boards"), footing: footing(), marks: R.marks,
  notes: "Long axis along x, the head of the table at -x, the lane door at +x. Marrow, Spratt and the Guild are drawn by the game.",
};
