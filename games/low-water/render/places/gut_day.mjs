// The Gut by day (the interlude's smokehouse call, day_smoke): a lane of tar-black doors with eels
// hung over it, Shadwell's rails of smoked fish gold in the sun, the gutter only wet stone. Painted,
// not palette-locked: the palette is the Gut's night.
import { gut } from "../worlds/gut.mjs";
import G from "./gut.mjs";
import { surf, sky, ripple, footing, paintId } from "./_common.mjs";
const D = gut({ day: true });
const lights = (V) => [{ pos: [120, 160, 90], type: 3, I: 380000, reach: 600, key: "sun", soft: 40 }, { pos: [-150, 140, -120], type: 3, I: 60000, reach: 600, key: "skyfill", soft: 4 }];
const dsurf = (id, P, N, V) => { const s = surf(id, P, N, V); if (s.emit && s.emit.type === "led") return { mat: "stone", scale: 0.4, wet: 0.8, emit: null }; if (s.emit) return { mat: "glass", scale: 1, wet: 0.3, emit: null }; return s; };
export default { name: "gut_day", world: D.world, lights, surf: dsurf, sky, ripple, paintId, camera: G.camera, paint: { seed: 43, radii: [14, 8, 4.6, 2.6], relief: 0.24 }, variants: { day: { hour: 14.8, note: "15:00: sun down the lane, smoke from the doors", V: { day: true }, plan: { ambient: 0.5, mist: 0.004, extinct: 0.001 }, gain: 1.25, grade: { saturation: 0.75 } } }, walk: G.walk, footing: footing(), marks: D.marks, notes: "Daylight Gut for the interlude." };
