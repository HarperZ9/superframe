// The after deck of the Saint Cuthwin, the coastal steamer that brings the assessor in (design/PLACES-NEW.md
// section 1): about 9 m by 4 m of planking heeled a few degrees, a rail all round, the wheelhouse forward
// with its door ajar and the binnacle lamp inside, the funnel behind it, the hatch to the hold, a bench
// under the rail, forty souls implied by sacks and crates forward. The sea all round; ahead, past the bow,
// three sodium dots on Lamp Quay and Mother's dark head at the end of the mole. Original block-out.
// Deck frame: +z is forward (toward the town), x across, y up; the deck at y 0.
import { box, cyl, cap, ell } from "../sdf.mjs";
import { makeWorld } from "../kit/world.mjs";
import { ID } from "../kit/ids.mjs";
import * as K from "../kit/props.mjs";

export const HEEL = 0.05;   // radians to starboard (the deck's own tilt, built in)
export function ferry() {
  const W = makeWorld({ cell: 1.2, margin: 0.4 }), L = [], marks = { spots: [], hides: [], exits: [], lamps: [], smoke: [{ at: [0, 5.5, 5.75], k: 1.1, note: "the funnel" }] };
  const add = (p) => { W.add(p); if (p.light) L.push({ ...p.light, key: `${p.light.group}@${p.light.pos.join(",")}` }); return p; };
  const spot = (id, verb, at, note) => marks.spots.push({ id, verb, at, note });
  const heel = (x, y) => y - x * HEEL;   // a point's height on the heeled deck
  W.ground((x, y, z, T) => {
    // the sea, low and black, all round
    T(y + 1.6 + 0.04 * Math.sin(x * 0.9 + z * 0.4), ID.pool);
    // the hull: the after body, its sides falling to the water, tumblehome at the deck edge
    // the plan: a long ellipse rounded at the stern, running on past the frame forward; narrower at the keel
    const yy = heel(x, y), plan = (r) => Math.max(Math.hypot(x / (2.3 * r), Math.max(0, -(z + 1) ) / (4.2 * r)) - 1, Math.abs(x) - 2.3 * r) * 1.2;
    const side = Math.max(plan(1 - Math.max(0, -yy - 0.2) * 0.12), yy - 0.5, -yy - 2.6, z - 9);
    T(Math.max(side, -Math.max(plan(0.93), -yy + 0.02, yy - 0.6)), ID.hull);
    T(Math.max(plan(0.93), Math.abs(yy + 0.03) - 0.05, z - 9), ID.deck);   // the planking
    // the bulwark rail cap along the side and round the stern (the rail posts are a prop)
    T(Math.max(plan(1), -plan(0.93), Math.abs(yy - 0.5) - 0.05, z - 9), ID.timber);
  });
  // the wheelhouse forward: planked walls, a window each side, the door ajar with the binnacle's glow
  add(K.shape([-1.6, -0.2, 3.4, 1.6, 2.9, 5.6], (x, y, z, T) => {
    const yy = heel(x, y), walls = Math.max(box(x, yy, z, 0, 1.25, 4.5, 1.4, 1.25, 1.0), -box(x, yy, z, 0, 1.25, 4.5, 1.3, 1.2, 0.9));
    const doorCut = box(x, yy, z, 0.55, 1.0, 3.5, 0.4, 0.95, 0.2), winL = box(x, yy, z, -1.4, 1.7, 4.6, 0.2, 0.35, 0.45), winF = box(x, yy, z, 0, 1.75, 3.5, 0.45, 0.3, 0.2);
    T(Math.max(walls, -doorCut, -winL, -winF), ID.boat);
    T(box(x, yy, z, 0, 2.58, 4.5, 1.55, 0.08, 1.15), ID.roof);   // its roof
    T(box(x, yy, z, -0.8, 1.0, 4.95, 0.35, 0.5, 0.25), ID.darkwood);   // the binnacle
    T(cyl(x, yy, z, -0.8, 1.65, 4.95, 0.12, 0.12), ID.brass);
    T(box(x, yy, z, 0.85, 1.0, 3.25, 0.03, 0.95, 0.38), ID.boat);   // the door, swung out
    T(box(x, yy, z, -1.42, 1.7, 4.6, 0.02, 0.33, 0.43), ID.windowdim); T(box(x, yy, z, 0, 1.75, 3.42, 0.43, 0.28, 0.02), ID.windowdim);
  }));
  L.push({ pos: [-0.8, 1.75, 4.6], type: 1, I: 7, reach: 6, group: "lantern", key: "binnacle" }, { pos: [0.6, 1.4, 3.3], type: 1, I: 4, reach: 5, group: "lantern", key: "doorspill" });
  spot("wheelhouse_door", "read", [0.6, 0, 3.0], "the ship's clock through the swinging door, against Lamb's watch (Q:297)");
  // the funnel behind the wheelhouse, and its smoke-stained stays
  add(K.shape([-0.7, 2.4, 5.3, 0.7, 6.2, 6.2], (x, y, z, T) => { T(cyl(x, heel(x, y), z, 0, 3.9, 5.75, 0.42, 1.5), ID.tar); T(cyl(x, heel(x, y), z, 0, 5.35, 5.75, 0.46, 0.08), ID.oxblood); }));
  // the masthead light on a short mast over the wheelhouse
  add(K.shape([-0.3, 2.5, 4.0, 0.3, 6.6, 4.6], (x, y, z, T) => { T(cyl(x, heel(x, y), z, 0.9, 4.2, 4.3, 0.05, 1.7), ID.timber); T(ell(x, heel(x, y), z, 0.9, 5.95, 4.3, 0.09, 0.13, 0.09), ID.lantern); }));
  L.push({ pos: [0.9, 5.95, 4.3], type: 1, I: 14, reach: 12, group: "lantern", key: "masthead" });
  // the rail all round the after deck (posts and a top rail)
  add(K.railing([[-2.05, 3.2], [-2.05, -2.4], [-1.3, -4.3], [0, -4.85], [1.3, -4.3], [2.05, -2.4], [2.05, 3.2]], 0.0, 1.0, 1.1, ID.iron));
  // the hatch to the hold: a raised coaming and its cover, half off
  add(K.shape([-1.6, -0.1, -1.2, -0.2, 0.6, 0.6], (x, y, z, T) => { const yy = heel(x, y); T(Math.max(box(x, yy, z, -0.9, 0.18, -0.3, 0.6, 0.18, 0.7), -box(x, yy, z, -0.9, 0.3, -0.3, 0.5, 0.3, 0.6)), ID.timber); T(box(x, yy, z, -0.75, 0.4, -0.55, 0.62, 0.03, 0.5), ID.plank); }));
  spot("hatch", "use", [-0.9, 0, 0.6], "down to the hold and the crate of Hesk eggs (Q:220)");
  // the bench under the starboard rail where the assessor sits with the claims case
  add(K.table(1.75, 0, -1.4, 0.32, 1.1, 0.45, 0, ID.timber));
  spot("rail", "look", [1.4, 0, -1.4], "the assessor sits by the rail and looks for the lamp (Q:96)");
  spot("case", "read", [1.4, 0, -0.7], "the claims case on both knees: open it and read the claim");
  spot("kit", "read", [1.4, 0, -2.1], "the instruments laid out on the bench: Candlemas, the Glass, the Almanac, the Damp, the Vane");
  // the souls forward: sacks, crates, a coil, two barrels lashed under the port rail
  for (const [k, x, z] of [[0, -1.7, 2.2], [1, -1.5, 1.4], [2, -1.75, 0.8]]) add(K.sack(x, 0, z, 0.28, k));
  add(K.crateStack(-1.3, 0, -2.0, 3, 41, 0.2)); add(K.coil(0.4, 0, -3.6, 0.38)); add(K.barrel(1.6, 0, 2.4, 0.3, 0.85)); add(K.barrel(1.65, 0, 1.7, 0.3, 0.85));
  // the stern: a lifebelt on the rail, the ensign staff
  add(K.ring(0, 0.7, -4.62, 0)); add(K.shape([-0.1, 0, -4.8, 0.1, 2.6, -4.4], (x, y, z, T) => T(cyl(x, heel(x, y), z, 0, 1.3, -4.62, 0.04, 1.3), ID.timber)));
  // ahead, beyond the bow: Lamp Quay's three sodium heads and Mother's dark head on the mole
  for (const x of [-9, 0, 9]) L.push({ pos: [x, 4.4, 60], type: 0, I: 48, reach: 24, group: "sodium", key: `quay${x}` });
  add(K.shape([-14, -2, 54, 14, 7, 66], (x, y, z, T) => { T(box(x, y, z, 0, 0.2, 60.5, 13, 1.2, 0.8), ID.quay); for (const xx of [-9, 0, 9]) { T(cyl(x, y, z, xx, 2.8, 60, 0.08, 2.4), ID.iron); T(ell(x, y, z, xx, 5.0, 60, 0.18, 0.12, 0.18), ID.sodium); } }));
  add(K.shape([18, -2, 66, 26, 9, 74], (x, y, z, T) => { T(box(x, y, z, 22, 0.5, 70, 3, 1.5, 3), ID.mole); T(cyl(x, y, z, 22, 3.2, 70, 1.1, 1.4), ID.tower); T(ell(x, y, z, 22, 5.4, 70, 1.4, 1.1, 1.4), ID.dome); }));
  marks.exits.push({ id: "gangway", at: [2.2, 0, 1.0], note: "the gangway to the quay berth (when alongside)" });
  marks.hides.push({ id: "behind_wheelhouse", at: [-1.8, 0, 5.2], r: 0.5, note: "the lee of the wheelhouse by the funnel" });
  // a low fill from the night sky over the deck, so the planking and the people read at all
  return { world: W.build(), marks, lights: (V = {}) => L.filter((l) => !(V.emit && V.emit[l.group] === 0)).map((l) => ({ ...l, I: l.I * (V.emit?.[l.group] ?? 1) })).concat(V.fill ? [{ pos: [0, 7, -1], type: 1, I: V.fill, reach: 16, group: "fill", key: "fill" }] : []).concat(V.moon ? [{ pos: V.moon.pos, type: 2, I: V.moon.I, reach: 400, key: "moon", soft: 30 }] : []) };   // the moon low ahead: its path breaks on the swell
}
