// Mother's lamp room: a glass drum at the top of the tower round the great lens (a beehive of prism
// rings taller than a man round the arc, a third of the rings cast from green bottle glass), the
// desk and its log, the brass restrike panel with the red button under glass and the card, the
// stores cupboard, the rattling gallery door, the stair coming up through the floor, and far below
// through the bars, the town in sodium. The near half of the drum is cut away. Phase 3 coordinates.
import { box, cyl, sph, cap, vnoise } from "../sdf.mjs";
import { makeWorld } from "../kit/world.mjs";
import { ID } from "../kit/ids.mjs";
import * as K from "../kit/props.mjs";

const C = [0, 2.6, 0], R0 = 1.35, green = (k) => [1, 4, 5, 8, 11, 12].includes(k);
export function lampRoom() {
  const W = makeWorld({ cell: 1.5, margin: 0.4 }), marks = { spots: [], hides: [], exits: [], lamps: [] };
  const spot = (id, verb, at, note) => marks.spots.push({ id, verb, at, note }), cutaway = (x, z) => x + z - 2.2;
  W.ground((x, y, z, T) => {
    const r = Math.hypot(x, z), a = Math.atan2(z, x);
    T(Math.max(y, r - 5.3, -y - 0.4, -box(x, y, z, 2.6, -0.1, 2.0, 0.48, 0.3, 0.48)), ID.iron);
    T(Math.max(box(x, y, z, 2.6, -0.02, 2.0, 0.55, 0.03, 0.55), -box(x, y, z, 2.6, 0, 2.0, 0.48, 0.1, 0.48)), ID.timber); T(box(x, y, z, 2.6, -0.04, 2.0, 0.48, 0.02, 0.48), ID.coal);
    if (r > 4.5 && r < 5.6) { const seg = (2 * Math.PI) / 16, aa = ((a % seg) + seg) % seg - seg / 2; T(Math.max(Math.abs(aa * r) - 0.06, Math.abs(r - 5.0) - 0.08, y - 3.6, -y - 0.3, cutaway(x, z)), ID.tar); T(Math.max(Math.abs(r - 5.0) - 0.1, Math.abs(y - 1.0) - 0.06), ID.iron); T(Math.max(Math.abs(r - 5.0) - 0.12, Math.abs(y - 0.25) - 0.25, cutaway(x, z) - 1.5), ID.iron); }
    T(y + 60, ID.pool); // the sea far below
  });
  // the lens
  W.add(K.shape([-1.8, 0.8, -1.8, 1.8, 4.7, 1.8], (x, y, z, T) => {
    const r = Math.hypot(x, z), a = Math.atan2(z, x), slit = Math.abs(Math.sin(a * 4)) * r - 0.035;
    for (let k = 0; k < 14; k++) { const yk = 1.05 + k * 0.255, t = (yk - C[1]) / 1.6, rk = R0 * Math.sqrt(Math.max(0.12, 1 - t * t * 0.55)) + 0.08; T(Math.max((Math.hypot(r - rk, (y - yk) * 1.5) / 1.5 - 0.105) * 0.9, -slit), green(k) ? ID.bottle : ID.prism); }
    T(Math.max(Math.abs(slit + 0.035) - 0.012, Math.abs(y - 2.7) - 1.85, Math.abs(r - R0) - 0.25), ID.brass);
    T(sph(x, y, z, C[0], C[1], C[2], 0.18), ID.arc); T(cyl(x, y, z, 0, 0.45, 0, 0.55, 0.45), ID.brass);
  }));
  // the desk and the log; the restrike panel; the stores cupboard; the gallery door; the stair hatch
  W.add(K.shape([-3.4, 0, 1.7, -1.8, 1.1, 2.9], (x, y, z, T) => { T(box(x, y, z, -2.6, 0.85, 2.3, 0.7, 0.05, 0.45), ID.darkwood); for (const s of [-1, 1]) T(box(x, y, z, -2.6 + 0.6 * s, 0.42, 2.3, 0.05, 0.42, 0.4), ID.darkwood); T(box(x, y, z, -2.55, 0.93, 2.3, 0.42, 0.03, 0.3), ID.paper); T(cap(x, y, z, [-2.2, 0.95, 2.1], [-2.0, 0.96, 2.35], 0.01), ID.coal); }));
  W.add(K.stool(-2.4, 0, 3.0, 0.18, 0.5)); spot("log", "read", [-2.6, 0, 1.6], "the log on its desk (M:567)");
  W.add(K.shape([-3.9, 1.0, -2.8, -3.4, 2.4, -1.6], (x, y, z, T) => { T(box(x, y, z, -3.6, 1.7, -2.2, 0.06, 0.45, 0.35), ID.brass); T(sph(x, y, z, -3.52, 1.75, -2.2, 0.07), ID.red); T(box(x, y, z, -3.5, 1.75, -2.2, 0.02, 0.12, 0.12), ID.glass); T(box(x, y, z, -3.53, 1.4, -2.05, 0.01, 0.1, 0.12), ID.paper); }));
  spot("restrike", "light", [-3.0, 0, -2.2], "the red restrike button under glass and its card (M:526)");
  W.add(K.shape([-1.4, 0, -4.8, 0.6, 2.2, -3.8], (x, y, z, T) => { T(box(x, y, z, -0.4, 1.0, -4.3, 0.8, 1.0, 0.35), ID.darkwood); T(box(x, y, z, -0.4, 1.0, -3.93, 0.03, 0.9, 0.02), ID.coal); T(sph(x, y, z, -0.25, 1.1, -3.92, 0.03), ID.brass); }));
  spot("cupboard", "salvage", [-0.4, 0, -3.5], "the stores cupboard: standby lamp, prism 151 in its felt tray (M:707)");
  W.add(K.shape([3.2, 0, -4.2, 4.6, 2.3, -2.8], (x, y, z, T) => T(box(x, y, z, 3.9, 1.1, -3.5, 0.55, 1.1, 0.05) , ID.rust)));
  marks.exits.push({ id: "gallery", at: [3.7, 0, -3.2], note: "the rattling gallery door (M:439)" }, { id: "stairs", at: [2.6, 0, 2.0], note: "the stair hatch in the floor" });
  W.add(K.railing([[2.05, 1.45], [3.15, 1.45], [3.15, 2.55]], 0, 0.9, 0.55));
  marks.hides.push({ id: "behind_lens", at: [-1.6, 0, -1.6], r: 0.6, note: "the far side of the lens" });
  marks.lamps.push({ id: "arc", kind: "arc", at: C });
  return { world: W.build(), marks, lights: (V = {}) => {
    const out = [];
    if (V.arc) out.push({ pos: C, type: 2, I: 30, reach: 12, key: "arc" }, { pos: [1.9, 2.6, 2.6], type: 2, I: 9, reach: 6, key: "g1" }, { pos: [2.9, 2.4, -0.4], type: 2, I: 7, reach: 6, key: "g2" }, { pos: [-0.6, 2.7, 3.1], type: 2, I: 7, reach: 6, key: "g3" });
    else out.push({ pos: [30, -25, 30], type: 0, I: 2500, reach: 90, key: "townglow" });
    out.push({ pos: [-30, 18, -40], type: 3, I: V.arc ? 600 : 900, reach: 90, key: "sky", soft: 20 });
    if (V.lamp) out.push({ pos: [-2.4, 1.3, 2.0], type: 1, I: V.lamp, reach: 8, key: "standby" });
    return out;
  } };
}
