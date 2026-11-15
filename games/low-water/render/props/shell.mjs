// The board-built room shell for the two era 1 farm rooms: a plank floor with seams, a far wall at -z and one at -x of
// vertical boards (grooves, per-board depth, optional through-gaps for light), low near sills, cut-outs for doors.
// Original code (2026-10-23).
import { box, ID, sstep, hash } from "./prim.mjs";
import { boardWall } from "./wood.mjs";

// hBack(x), hLeft(z): wall height profiles. gap/gapFrac: through-gaps in the left wall (the loft's light). cuts: boxes
// [cx, cy, cz, ex, ey, ez] taken from the walls; floorCuts from the floor.
export function boardShell(T, x, y, z, { hx, hz, hBack, hLeft, floor = ID.chaff, mix = false, wallId = ID.greyy, floors = [ID.greyx, ID.greyz], bw = 0.2, cuts = [], floorCuts = [], gap = 0, gapFrac = 0, sill = 0.4, seed = 1 }) {
  const cut = (d) => { for (const c of cuts) d = Math.max(d, -box(x, y, z, ...c)); return d; };
  const k = Math.floor((z + hz + 0.25) / 0.19), fu = (z + hz + 0.25) / 0.19 - k, bu = Math.min(fu, 1 - fu) * 0.19;
  let fl = box(x, y, z, 0, -0.12, 0, hx + 0.25, 0.12, hz + 0.25) + 0.004 * (1 - sstep(0, 0.008, bu)); for (const c of floorCuts) fl = Math.max(fl, -box(x, y, z, ...c));
  if (mix) {   // repaired boards: sections of different wood, each board a little proud or sunk and cupped
    const sx = Math.floor((x + 0.4 * Math.sin(z * 0.7)) / 1.4), sz = Math.floor((z + 3) / 1.0), h = hash(sx, sz, 5), off = (hash(k, sx, 3) - 0.5) * 0.012 + 0.004 * (2 * fu - 1) ** 2;
    T(fl - off * 0.7, h < 0.5 ? floor : h < 0.78 ? floors[0] : floors[1]);
  } else T(fl, floor);
  T(cut(Math.max(boardWall(x, y, z + hz + 0.06, { hu: hx + 0.25, y1: 9, th: 0.05, bw: bw * 1.05, seed }), y - hBack(x))), wallId);
  T(cut(Math.max(boardWall(z, y, x + hx + 0.06, { hu: hz + 0.25, y1: 9, th: 0.05, bw, gap, gapFrac, seed: seed + 5 }), y - hLeft(z))), wallId);
  T(cut(boardWall(x, y, z - hz - 0.06, { hu: hx + 0.25, y1: sill, th: 0.05, bw: bw * 1.05, seed: seed + 2 })), wallId);
  T(cut(boardWall(z, y, x - hx - 0.06, { hu: hz + 0.25, y1: sill, th: 0.05, bw, seed: seed + 3 })), wallId);
}
// The count of distinct named props in a built world's prop list.
export const distinct = (W) => new Set(W.props.map((p) => p.name)).size;
