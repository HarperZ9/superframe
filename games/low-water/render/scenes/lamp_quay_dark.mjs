// Lamp Quay in a blackout, for the engine's dither-quantised lighting: the same geometry as
// lamp_quay.mjs (plate variant when LW_PLATE=1), with tones instead of spectral materials and the
// lights that survive a cut: the walkers' lanterns and the Brine's paraffin.
import Q, { ID } from "./lamp_quay.mjs";
import { fbm } from "../sdf.mjs";

const TONE = { [ID.quay]: 0.42, [ID.wall]: 0.3, [ID.weed]: 0.15, [ID.mud]: 0.28, [ID.pool]: 0.08, [ID.steps]: 0.36, [ID.houseA]: 0.5, [ID.houseB]: 0.6, [ID.houseC]: 0.45, [ID.houseD]: 0.72,
  [ID.roof]: 0.15, [ID.chimney]: 0.3, [ID.winDark]: 0.1, [ID.hull]: 0.12, [ID.brineDoor]: 0.3, [ID.weigh]: 0.38, [ID.beam]: 0.3, [ID.post]: 0.1, [ID.sodium]: 0.2,
  [ID.mole]: 0.36, [ID.tower]: 0.62, [ID.band]: 0.3, [ID.lens]: 0.25, [ID.dome]: 0.3, [ID.boat]: 0.3, [ID.mast]: 0.1, [ID.keelCoat]: 0.15, [ID.skin]: 0.6, [ID.hat]: 0.1,
  [ID.walker]: 0.55, [ID.drowned]: 0.45, [ID.fish]: 0.62, [ID.sign]: 0.55, [ID.crate]: 0.45, [ID.prismG]: 0.4, [ID.rag]: 0.3, [ID.cap]: 0.2 };
const EMIT = { [ID.porthole]: 0.95, [ID.lantern]: 1, [ID.merrowLamp]: 0.9, [ID.win]: 0.85 };
export const albedo = (id, P) => (TONE[id] ?? 0.4) * (0.8 + 0.4 * fbm(P[0] * 1.3, P[2] * 1.3 + P[1]));
// in a blackout only the paraffin windows (about one lit window in three) still burn
export const emissive = (id, P) => id in EMIT && (id !== ID.win || (Math.floor(P[0] * 2.1) & 1) === 0);
export const sky = () => 0.85;
const ENG = await import(new URL("../rn.mjs", import.meta.url).href).then((m) => import(m.rn("web/shaders/ditherlight/lights.mjs")));
export function lights() {
  return [
    ENG.makeRadial({ pos: [-5.05, -2.25, 6.75], radius: 6, core: 1.0, intensity: 2.2, wrap: 0.3 }),
    ENG.makeRadial({ pos: [-3.2, -2.15, 9.0], radius: 6, core: 1.0, intensity: 2.2, wrap: 0.3 }),
    ENG.makeRadial({ pos: [2.1, -2.3, 7.6], radius: 6, core: 1.0, intensity: 2.0, wrap: 0.3 }),
    ENG.makeRadial({ pos: [-6.2, 1.2, -0.3], radius: 7, core: 1.4, intensity: 2.6, wrap: 0.4 }),
  ];
}
export default { map: Q.map, idOf: Q.idOf, albedo, emissive, sky, lights };
