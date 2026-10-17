// The weigh-house after the vote, for the spectral pass: the weigh_vote geometry lit by the Guild's
// paraffin lamp over the balance and a lantern by the door; the voters stand where they voted.
// The steward is drawn by the game (LW_PLATE=1).
import { map, idOf, ID } from "./weigh_vote.mjs";
import { fbm } from "../sdf.mjs";
export { ID };
export const materials = [{ name: "lw tar", flat: 0.035 }, { name: "lw bone", q: [0, 2, -0.1], peak: 0.72 }, { name: "lw oxblood", q: [0, 10, -6.0], peak: 0.55 }, { name: "lw mustard", q: [0, 13, -5.2], peak: 0.62 }, { name: "lw navy", q: [0, -12, 3.6], peak: 0.22 }, { name: "lw flesh", q: [0, 6, -2.2], peak: 0.55 }, { name: "lw wood", q: [0, 6, -3.2], peak: 0.35 }, { name: "lw teal", q: [-50, 27.5, -2.58], peak: 0.5 }];
const S = (mat, scale = 1, wet = 0, emit = null) => ({ mat, scale, wet, emit });
export function surf(id, P) {
  const n = fbm(P[0] * 2 + P[1], P[2] * 2);
  switch (id) {
    case ID.floor: return S("lw wood", 0.8 + 0.4 * n, 0.25); case ID.wall: return S("brick", 0.75 + 0.3 * n); case ID.louvre: return S("lw tar", 2);
    case ID.post: case ID.beam: return S("metal", 1.2); case ID.pan: return S("lw mustard", 0.9, 0.4); case ID.fish: return S("grey", 1.1, 0.9);
    case ID.coat: return S("lw navy", 1.0 + 0.3 * n); case ID.skin: return S("lw flesh", 1); case ID.blind: return S("lw bone", 1.1);
    case ID.switchbox: return S("metal", 1); case ID.candle: return S("lw bone", 1); case ID.flame: return S("grey", 0, 0, { type: "window", I: 30 });
    case ID.board: return S("lw tar", 3); case ID.crate: return S("lw wood", 1); case ID.hook: return S("metal", 1);
    default: return S("grey", 1);
  }
}
export function lights() {
  return [
    { pos: [0, 4.2, 0.6], type: 1, I: 22, cone: [0, 0, 0], mode: 0, reach: 16 },
    { pos: [4.6, 2.0, 3.6], type: 1, I: 6, cone: [0, 0, 0], mode: 0, reach: 10 },
    { pos: [-5.0, 2.6, -3.0], type: 1, I: 4, cone: [0, 0, 0], mode: 0, reach: 8 },
    { pos: [-30, 4, 2], type: 0, I: 900, cone: [0, 0, 0], mode: 0, reach: 60 },   // sodium through the louvre
  ];
}
export const sky = () => 0.01;
export default { map, idOf, materials, surf, lights, sky, paintId: (id) => id };
