// The hundred and twelve stairs inside Mother: a tight spiral round an iron post, each step worn
// hollow, slit windows in the thick wall, the landing at step 56 with a slit window and a kitchen
// chair, the hatch at the top into the lamp room. The near half of the tower is cut away; the spiral
// is shown over its whole height (a vertical plate that scrolls). Original block-out.
import { box, cyl, cap, sph } from "../sdf.mjs";
import { makeWorld } from "../kit/world.mjs";
import { ID } from "../kit/ids.mjs";
import * as K from "../kit/props.mjs";

export const R_IN = 0.18, R_OUT = 1.45, RISE = 0.155, TURN = (2 * Math.PI) / 16, N = 112, H = N * RISE;
export function stairs() {
  const W = makeWorld({ cell: 1, margin: 0.4 }), marks = { spots: [], hides: [], exits: [], lamps: [] };
  const cut = (x, z) => x + z - 0.25;
  W.ground((x, y, z, T) => {
    const q = Math.hypot(x, z), a = Math.atan2(z, x);
    T(Math.max(Math.abs(q - R_OUT - 0.35) - 0.35, cut(x, z), -y - 0.2, y - H - 1.2), ID.tower); // the wall, cut away toward the camera
    T(Math.max(q - R_OUT - 0.1, y + 0.05, -y - 0.4), ID.mole);
    T(cyl(x, y, z, 0, H / 2, 0, R_IN, H / 2 + 0.5), ID.iron); // the post
    // the steps: wedges round the post, each RISE higher and TURN further round
    let best = Infinity; const k0 = Math.floor(y / RISE);
    for (let k = Math.max(0, k0 - 2); k <= Math.min(N - 1, k0 + 1); k++) {
      const ak = k * TURN, da = Math.atan2(Math.sin(a - ak), Math.cos(a - ak)), wedge = Math.max(Math.abs(da) * q - TURN * q * 0.55, q - R_OUT, R_IN - q);
      const top = (k + 1) * RISE, slab = Math.max(y - top + 0.012 * Math.cos(da * 4), top - 0.14 - y);
      best = Math.min(best, Math.max(wedge, slab));
    }
    T(best * 0.8, ID.steps);
    // the landing at 56: a full disc
    T(Math.max(q - R_OUT, Math.abs(y - 56 * RISE - 0.05) - 0.06), ID.steps);
  });
  // slit windows in the wall every half turn on the far side, the landing's slit, the chair
  for (let k = 8; k < N; k += 16) { const a = k * TURN + Math.PI, y = k * RISE + 1.0; W.add(K.shape([Math.cos(a) * 2.3 - 0.4, y - 0.7, Math.sin(a) * 2.3 - 0.4, Math.cos(a) * 2.3 + 0.4, y + 0.7, Math.sin(a) * 2.3 + 0.4], (x, yy, z, T) => T(Math.max(Math.abs(Math.atan2(z, x) - Math.atan2(Math.sin(a), Math.cos(a))) * 1.9 - 0.06, Math.abs(Math.hypot(x, z) - 1.47) - 0.02, Math.abs(yy - y) - 0.5), ID.windowdim))); }
  const LY = 56 * RISE;
  W.add(K.shape([-1.4, LY, -1.3, -0.4, LY + 1.1, -0.3], (x, y, z, T) => { T(box(x, y, z, -0.9, LY + 0.48, -0.8, 0.22, 0.03, 0.22), ID.timber); T(box(x, y, z, -1.08, LY + 0.82, -0.8, 0.03, 0.32, 0.22), ID.timber); for (const sx of [-1, 1]) for (const sz of [-1, 1]) T(box(x, y, z, -0.9 + sx * 0.18, LY + 0.24, -0.8 + sz * 0.18, 0.025, 0.24, 0.025), ID.timber); }));
  marks.spots.push({ id: "landing_56", verb: "wait", at: [-0.6, LY, -0.6], note: "the landing at step 56: a slit window and a kitchen chair (M:298)" });
  W.add(K.shape([-1.6, H, -1.6, 1.6, H + 0.4, 1.6], (x, y, z, T) => T(Math.max(Math.hypot(x, z) - R_OUT - 0.1, Math.abs(y - H - 0.15) - 0.15, -(Math.hypot(x - 0.8, z) - 0.5)), ID.iron)));
  marks.exits.push({ id: "lamproom", at: [0.8, H, 0], note: "the hatch into the lamp room" }, { id: "keeper_door", at: [1.2, 0, 0.6], note: "the KEEPER door at the foot" });
  return { world: W.build(), marks, lights: (V = {}) => {
    const o = []; for (let k = 8; k < N; k += 16) { const a = k * TURN + Math.PI; o.push({ pos: [Math.cos(a) * 1.3, k * RISE + 1.2, Math.sin(a) * 1.3], type: 2, I: V.slit ?? 3, cone: [-Math.cos(a), -0.3, -Math.sin(a)], mode: 2, reach: 6, key: `slit${k}` }); }
    if (V.above) o.push({ pos: [0.8, H + 1.5, 0], type: 2, I: V.above, reach: 14, key: "above" });
    if (V.lantern) o.push({ pos: [0.6, LY + 1.4, -0.2], type: 1, I: V.lantern, reach: 6, key: "lantern" });
    return o;
  } };
}
