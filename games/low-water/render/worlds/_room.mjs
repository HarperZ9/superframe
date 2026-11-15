// A cutaway room for the room camera (yaw about 34, looking toward -x and -z): the floor, the two far
// walls (at -x and -z) to their full height, the near walls only as a low sill so the room shows, and an
// optional ceiling beam line. Shared by the new interiors of design/PLACES-NEW.md. Original code.
//   shell(T, { hx, hz, h, floor, wall, sill = 0.35, beams = null, cuts = [] })
//   cuts: boxes [cx, cy, cz, ex, ey, ez] cut from the walls (doors, windows); floorCuts from the floor (a hatch)
import { box } from "../sdf.mjs";

export function shell(T, x, y, z, { hx, hz, h, floor, wall, wallNear = wall, sill = 0.35, beams = null, cuts = [], floorCuts = [] }) {
  const cut = (d) => { for (const c of cuts) d = Math.max(d, -box(x, y, z, ...c)); return d; };
  let fl = box(x, y, z, 0, -0.12, 0, hx + 0.25, 0.12, hz + 0.25); for (const c of floorCuts) fl = Math.max(fl, -box(x, y, z, ...c));
  T(fl, floor);
  T(cut(box(x, y, z, 0, h / 2, -hz - 0.12, hx + 0.25, h / 2, 0.12)), wall);   // the back wall (-z)
  T(cut(box(x, y, z, -hx - 0.12, h / 2, 0, 0.12, h / 2, hz + 0.25)), wall);   // the left wall (-x)
  T(cut(box(x, y, z, 0, sill / 2, hz + 0.12, hx + 0.25, sill / 2, 0.12)), wallNear);   // the near sills
  T(cut(box(x, y, z, hx + 0.12, sill / 2, 0, 0.12, sill / 2, hz + 0.25)), wallNear);
  if (beams) for (let k = -beams.n / 2; k <= beams.n / 2; k++) T(box(x, y, z, k * (2 * hx) / beams.n, h - 0.1, -hz / 2, 0.09, 0.1, hz / 2 + 0.1), beams.id);   // beams over the far half only
}
