// Adapter: a Low Water place (render/places/*.mjs) as a scene for the engine's dither-quantised
// lighting (render/pipe_flat.mjs rowsDither). The place is named in this module's query string.
import { rn } from "../rn.mjs";
import { toneOf, BY_ID } from "../kit/ids.mjs";
const P = (await import(new URL(import.meta.url).searchParams.get("place"))).default;
const ENG = await import(rn("web/shaders/ditherlight/lights.mjs"));
const which = new URL(import.meta.url).searchParams.get("which"), D = which ? P.dithers[which] : P.dark, keep = new Set(D.emit || ["lantern", "window", "candle", "fire", "flame"]);
export const map = P.world.map, idOf = P.world.idOf;
export const albedo = (id, p) => (D.tone ? D.tone(id, p) : toneOf(id, p));
export const emissive = (id, p) => { const k = BY_ID[id]; if (!k || !k.emit) return false; if (!keep.has(k.emit[2])) return false; return D.lit ? D.lit(id, p, k) : true; };
export const sky = () => D.sky ?? 0.85;
export const lights = () => D.lights.map((L) => ENG.makeRadial({ core: 1.0, wrap: 0.3, ...L }));
export default { map, idOf, albedo, emissive, sky, lights };
