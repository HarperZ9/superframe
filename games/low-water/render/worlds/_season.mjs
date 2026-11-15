// Seasons for The Quota's outdoor worlds (render/worlds/roadpost.mjs, q_country.mjs; package W3-C, 2026-10-22).
//   winter   era 2 (the default): the world exactly as it was; the place's frost whitens the tops.
//   harvest  era 1, year 0, late summer: stubble gold with green in the hollows and turned earth at the edges,
//            poplars in full leaf, moss on the slates. Green is the painted green (no wet sheen): the kelp and sand
//            ids carry a wet reflectance that paints as grey blotches under a dry sun (first bake, 2026-10-22).
//   autumn   era 3, year 20, September to December (design/eras/era3.md): wet dark earth, leaf litter blown into
//            drifts, poplars yellowing toward bare, leaves caught on the roofs.
// Winter returns the original ids and adds nothing, so era 2's plates bake byte-identical.
import { fbm, ell } from "../sdf.mjs";
import { ID, KIND, BY_ID } from "../kit/ids.mjs";

export const SEASONS = ["winter", "harvest", "autumn"];
export function seasonOf(s = "winter") {
  if (!SEASONS.includes(s)) throw new Error(`worlds/_season: unknown season "${s}" (one of ${SEASONS.join(", ")})`);
  return s;
}
// the open ground of a field or plain
export function fieldId(s, x, z) {
  if (s === "harvest") { const n = fbm(x * 0.21 + 3, z * 0.21 - 5, 3); return n > 0.62 ? ID.green : n < 0.3 ? ID.rust : ID.straw; }
  if (s === "autumn") { const n = fbm(x * 0.3 + 11, z * 0.3, 3); return n > 0.64 ? ID.rust : ID.mud; }
  return ID.mud;
}
// a trodden track: the same mud in every season (dry, it paints as a pale dust road)
export const trackId = () => ID.mud;
// standing water: ice in winter, open water otherwise
export const waterId = (s, winterId = ID.ice) => (s === "winter" ? winterId : ID.pool);
// a slate roof: moss at harvest, caught leaves in autumn
export function roofId(s, x, z) {
  if (s === "harvest") return fbm(x * 2.6 + 2, z * 2.6, 2) > 0.8 ? ID.green : ID.roof;
  if (s === "autumn") return fbm(x * 1.6 - 4, z * 1.6, 2) > 0.68 ? ID.rust : ID.roof;
  return ID.roof;
}
// the hill's bracken: rust under frost, green going to rust at harvest, dead rust in autumn
// (2026-10-24: harvest was green and rust patches 1 to 3 m across, each inked at its edge, which painted as camouflage.
// It is now one kind whose fronds turn a few at a time: each frond streak olive or russet, the share of russet rising
// with a broad field, so the hillside goes from green to rust without a drawn border. Registered on first use, so the
// winter and autumn worlds keep their ids.)
const h3 = (i, j) => { let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ 0x2545f491; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function brackenHarvest() {
  if (ID.bracken_harvest != null) return ID.bracken_harvest;
  const k = { id: BY_ID.length, name: "bracken_harvest", mat: "lw green paint", scale: 0.5, wet: 0, tone: 0.3, cls: 3, flags: "o", emit: null, detail: (P) => {
    // fronds: narrow streaks (6 cm by 45 cm, laid across the slope at a slant), each olive or russet
    const u = P[0] * 0.8 + P[2] * 0.6, v = -P[0] * 0.6 + P[2] * 0.8, ci = Math.floor(u / 0.06), cj = Math.floor(v / 0.45 + 0.5 * (ci & 1)), q = h3(ci, cj), t = h3(cj, ci);
    const share = Math.min(1, Math.max(0, (fbm(P[0] * 0.35 - 9, P[2] * 0.35 + 2, 3) - 0.25) * 1.6));
    return q < share ? { mat: "lw rust", scale: 0.55 + 0.22 * t, wet: 0, emit: null } : { mat: "lw weed", scale: 0.6 + 0.25 * t, wet: 0, emit: null };
  } };
  KIND.bracken_harvest = k; ID.bracken_harvest = k.id; BY_ID[k.id] = k; return k.id;
}
export function brackenId(s, x, z) {
  if (s === "harvest") return brackenHarvest();
  return ID.rust;
}
// a Lombardy poplar's crown on the bare branches: none in winter, a dense column at harvest, a thin yellow one in autumn
export function poplarCrown(s, T, x, y, z, px, pz, y0, y1, r, seed = 0) {
  if (s === "winter") return;
  const cy = (y0 + y1) / 2, hy = (y1 - y0) / 2;
  const d = ell(x, y, z, px, cy, pz, r, hy, r) + 0.12 * fbm(x * 2.2 + seed, (y + z) * 2.2, 2);
  if (s === "harvest") T(d, ID.green);
  else T(Math.max(d, 0.5 - fbm(x * 3.1 + seed, (y - z) * 3.1, 2)), ID.mustard);
}
