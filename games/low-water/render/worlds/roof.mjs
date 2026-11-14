// The weigh-house roof (design/PLACES-NEW.md section 5): wet lead about 6 m by 4 m behind a low parapet,
// the drainpipe Lamb climbs at the +x corner, and the town balance: an oak beam on a post as thick as a mast,
// iron pans the width of cartwheels hung from its ends and tilted toward the harbour (-z), the hook at the
// top of the beam where the town's weights hung. The quay seven metres below, its sodium coming up past
// the parapet. Roof frame: the lead at y 0, -z toward the harbour. Original block-out.
import { box, cyl, cap, ell } from "../sdf.mjs";
import { makeWorld } from "../kit/world.mjs";
import { ID } from "../kit/ids.mjs";
import * as K from "../kit/props.mjs";

export const TILT = 0.16;   // the beam's fall toward the harbour, radians
export function roof() {
  const W = makeWorld({ cell: 1.2, margin: 0.4 }), L = [], marks = { spots: [], hides: [], exits: [], lamps: [] };
  const add = (p) => { W.add(p); if (p.light) L.push({ ...p.light, key: `${p.light.group}@${p.light.pos.join(",")}` }); return p; };
  const spot = (id, verb, at, note) => marks.spots.push({ id, verb, at, note });
  const HX = 3.0, HZ = 2.0, DROP = 7.0;
  W.ground((x, y, z, T) => {
    // the quay below: cobbles toward the harbour, then the edge and the black water
    T(Math.max(y + DROP, z - (-HZ - 0.3), -(z + HZ + 7.5)), ID.cobble);
    T(Math.max(y + DROP + 1.4, -(z + HZ + 7.5) - 0.0 + 0 * x) + 0 * 0 + (z < -HZ - 7.5 ? 0 : 1e3), ID.pool);
    // the weigh-house: its walls falling to the quay, the lead roof on top with a slight fall to the gutter (-z)
    T(Math.max(box(x, y, z, 0, -DROP / 2, 0, HX + 0.3, DROP / 2, HZ + 0.3), -box(x, y, z, 0, 0.2, 0, HX, 0.3, HZ)), ID.brickdark);
    T(box(x, y, z, 0, -0.06 + (z + HZ) * 0.012, 0, HX, 0.06, HZ), ID.roof);
    // the parapet: low, coped, all round
    T(Math.max(box(x, y, z, 0, 0.25, 0, HX + 0.3, 0.25, HZ + 0.3), -box(x, y, z, 0, 0.3, 0, HX, 0.4, HZ)), ID.wall);
    T(Math.max(box(x, y, z, 0, 0.53, 0, HX + 0.36, 0.04, HZ + 0.36), -box(x, y, z, 0, 0.53, 0, HX - 0.06, 0.1, HZ - 0.06)), ID.slab);
  });
  // the drainpipe at the +x, +z corner, down the wall to the yard, with its hopper at the parapet
  add(K.shape([HX + 0.25, -DROP, HZ - 0.5, HX + 0.6, 0.8, HZ - 0.1], (x, y, z, T) => { T(cyl(x, y, z, HX + 0.42, -DROP / 2 + 0.2, HZ - 0.3, 0.06, DROP / 2 + 0.2), ID.iron); T(box(x, y, z, HX + 0.42, 0.45, HZ - 0.3, 0.14, 0.12, 0.14), ID.iron); }));
  spot("drainpipe", "climb", [HX - 0.4, 0, HZ - 0.4], "the drainpipe at the corner, the way up and down");
  marks.exits.push({ id: "drainpipe", at: [HX - 0.3, 0, HZ - 0.3], note: "down the drainpipe to the weigh-house yard" });
  // the town balance: the post, the beam falling toward the harbour, the pans on chains, the hook on top
  const P = [-0.6, 0, -0.2], BH = 3.1, HALF = 1.9;
  const end = (s) => [P[0], P[1] + BH - s * HALF * Math.sin(TILT), P[2] + s * HALF * Math.cos(TILT)];   // s -1: the harbour end, lower
  add(K.shape([P[0] - 0.4, 0, P[2] - 0.4, P[0] + 0.4, BH + 0.4, P[2] + 0.4], (x, y, z, T) => { T(cyl(x, y, z, P[0], BH / 2, P[2], 0.24, BH / 2), ID.timber); T(cyl(x, y, z, P[0], 0.12, P[2], 0.4, 0.12), ID.iron); }));
  add(K.shape([P[0] - 0.3, BH - 0.6, P[2] - HALF - 0.3, P[0] + 0.3, BH + 0.7, P[2] + HALF + 0.3], (x, y, z, T) => {
    T(cap(x, y, z, end(-1), end(1), 0.13), ID.timber);
    T(cap(x, y, z, [P[0], BH + 0.12, P[2]], [P[0], BH + 0.42, P[2]], 0.035), ID.iron);   // the hook's shank
    T(Math.max(Math.abs(Math.hypot(x - P[0], y - (BH + 0.42)) - 0.1) - 0.025, Math.abs(z - P[2]) - 0.03, -(y - (BH + 0.42)) - 0.0 + 0 * 0 + (y > BH + 0.42 ? 1e3 : -1e3 * 0)), ID.iron);   // its open loop
  }));
  for (const s of [-1, 1]) {
    const e = end(s), py = e[1] - 1.55 - (s < 0 ? 0.12 : 0), c = [e[0], py, e[2]], tl = s * 0.18;   // the pans tipped toward the harbour
    for (const k of [0, 1, 2]) { const a = (k / 3) * Math.PI * 2; add(K.rope([e[0], e[1] - 0.1, e[2]], [c[0] + Math.cos(a) * 0.55, py + 0.06 + Math.sin(a) * 0.55 * tl, c[2] + Math.sin(a) * 0.55], 0, 0.012, ID.iron)); }
    add(K.shape([c[0] - 0.7, py - 0.3, c[2] - 0.7, c[0] + 0.7, py + 0.3, c[2] + 0.7], (x, y, z, T) => {
      const yy = y - py - (z - c[2]) * tl, o = ell(x, yy + py, z, c[0], py, c[2], 0.62, 0.11, 0.62), i = ell(x, yy + py, z, c[0], py + 0.05, c[2], 0.56, 0.1, 0.56);
      T(Math.max(o, -i, yy - 0.04), ID.iron);
    }));
  }
  spot("beam_hook", "use", [P[0] + 0.5, 0, P[2] + 0.2], "the hook at the top of the beam: hang the lantern");
  spot("pans", "read", [P[0] + 0.7, 0, P[2] - 1.2], "the iron pans, tipped toward the harbour");
  spot("parapet", "look", [-1.6, 0, -HZ + 0.5], "out along the mole to Mother");
  marks.hides.push({ id: "post_shadow", at: [P[0] + 0.4, 0, P[2] + 0.5], r: 0.4, note: "in the post's shadow" });
  marks.lamps.push({ id: "hook_lantern", at: [P[0], BH + 0.3, P[2]], note: "the lantern hung on the hook (run-time light)" });
  // the quay's sodium below, toward the harbour, coming up past the parapet
  for (const [sx, sz] of [[-3.5, -HZ - 3.2], [2.8, -HZ - 3.6], [-9, -HZ - 3.0]]) add(K.sodiumPost(sx, -DROP, sz, 4.6, Math.PI));
  return { world: W.build(), marks, lights: (V = {}) => L.filter((l) => !(V.emit && V.emit[l.group] === 0)).map((l) => ({ ...l, I: l.I * (V.emit?.[l.group] ?? 1) })).concat(V.fill ? [{ pos: [0.6, 4.0, 1.2], type: 1, I: V.fill, reach: 12, group: "fill", key: "fill" }] : []) };
}
