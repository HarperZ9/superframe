// The land round a hero town, for views that stand back from the street: bare winter trees and
// snowed-in spruce, a frozen pond in the nearest hollow, and the vantage points that look at the
// town in its landscape (the valley from the hill, the street from above, the town from the ice).
// Everything is placed from the seed and the world's ground, so the same seed gives the same land.
import { baseGround } from "../../data.mjs";
import { add, mul, norm, cross, sub } from "./hmesh.mjs";
import { fbm } from "./hparts.mjs";

const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const laneDist = (P, x, z) => {
  let d = 1e9;
  for (const L of P.lanes) {
    const vx = L.b[0] - L.a[0], vz = L.b[1] - L.a[1], k = Math.max(0, Math.min(1, ((x - L.a[0]) * vx + (z - L.a[1]) * vz) / (L.len * L.len)));
    d = Math.min(d, Math.hypot(x - L.a[0] - vx * k, z - L.a[1] - vz * k) - L.half);
  }
  return d;
};

// the lowest hollow in a ring round the town, flat enough to hold a pond; g(x, z) is the levelled
// ground under the snow (hstreet.mjs groundOf without houses)
export function findPond(world, P, g = (x, z) => baseGround(world, x, z)) {
  let best = null;
  for (let a = 0; a < 48; a++) for (const rr of [P.reach - 50, P.reach - 20, P.reach + 10, P.reach + 40]) {
    const t = a / 48 * Math.PI * 2, x = P.cx + Math.cos(t) * rr, z = P.cz + Math.sin(t) * rr;
    if (P.houses.some((h) => Math.hypot(h.x - x, h.z - z) < 48)) continue;
    if (laneDist(P, x, z) < 38) continue;
    let lo = 1e9, hi = -1e9;
    for (let k = 0; k < 12; k++) { const u = k / 12 * Math.PI * 2, gk = g(x + Math.cos(u) * 26, z + Math.sin(u) * 26); lo = Math.min(lo, gk); hi = Math.max(hi, gk); }
    const g0 = g(x, z), score = g0 + (hi - lo) * 0.6;
    // the ice lies at the middle of its banks: the high side cut down, the low side banked up
    if (!best || score < best.score) best = { x, z, r: 30, y: (g0 * 2 + lo + hi) / 4, score };
  }
  return best;
}

// a bare broadleaf in winter: a tall trunk that forks into a fine crown, every branch that lies
// near level carrying a ridge of snow along its top. h metres tall, from (x, y, z) in mesh space.
export function bareTree(M, R, x, y, z, h, maxDepth = 3) {
  const lean = [(R() - 0.5) * 0.12, 1, (R() - 0.5) * 0.12];
  const grow = (base, d, len, r, depth) => {
    const pts = [], rs = [], n = depth === 0 ? 9 : depth === 1 ? 6 : 4;
    let p = base, dd = norm(d);
    for (let i = 0; i <= n; i++) {
      pts.push(p); rs.push(Math.max(0.006, r * (1 - 0.75 * i / n)));
      // branches bend up toward the light and wander
      dd = norm(add(dd, [(R() - 0.5) * 0.25, depth ? 0.06 : 0.02, (R() - 0.5) * 0.25]));
      p = add(p, mul(dd, len / n));
    }
    M.tube("bark", pts, rs, depth === 0 ? 8 : depth === 1 ? 6 : 4, depth === maxDepth);
    // snow on the near-level stretches of the thicker limbs
    if (depth <= 2) for (let i = 0; i + 1 < pts.length; i++) {
      const s = sub(pts[i + 1], pts[i]), lvl = 1 - Math.abs(s[1]) / (Math.hypot(...s) || 1);
      if (lvl < 0.45 || R() < 0.3) continue;
      const lift = (k) => add(pts[k], [0, rs[k] * 0.8, 0]);
      M.tube("snow", [lift(i), lift(i + 1)], [rs[i] * 0.55 * lvl, rs[i + 1] * 0.5 * lvl], 5);
    }
    if (depth >= maxDepth) return;
    const kids = depth === 0 ? 5 + Math.floor(R() * 4) : depth === 1 ? 3 + Math.floor(R() * 3) : 2 + Math.floor(R() * 2);
    for (let k = 0; k < kids; k++) {
      const at = depth === 0 ? 0.42 + 0.55 * (k / kids) : 0.3 + 0.65 * R(), i = Math.min(n - 1, Math.floor(at * n));
      const a = R() * Math.PI * 2, up = depth === 0 ? 0.55 + 0.6 * R() : 0.3 + 0.8 * R();
      const nd = norm(add(mul(dd, 0.35), [Math.cos(a), up, Math.sin(a)]));
      grow(pts[i], nd, len * (depth === 0 ? 0.42 : 0.5) * (0.7 + 0.5 * R()), rs[i] * 0.55, depth + 1);
    }
  };
  grow([x, y - 0.3, z], lean, h, h * 0.018 + 0.05 * R(), 0);
}

// a spruce under snow: a straight trunk and tiers of drooping skirts, dark needles under white loads
export function spruce(M, R, x, y, z, h) {
  M.tube("bark", [[x, y - 0.3, z], [x, y + h, z]], [h * 0.02 + 0.04, 0.02], 6);
  const tiers = 9 + Math.floor(h / 1.6), sides = 18;
  for (let t = 0; t < tiers; t++) {
    const f = t / tiers, top = y + h * (0.12 + 0.88 * (f + 1 / tiers)) + (R() - 0.5) * 0.3, r = h * 0.27 * Math.pow(1 - f, 1.05) * (0.85 + 0.3 * R()) + 0.15, droop = 0.45 + 0.6 * (1 - f);
    const spin = R() * 6.28, rim = [];
    for (let k = 0; k <= sides; k++) {
      // branch tips out, the gaps between them in, each tier ragged and lopsided
      const a = spin + k / sides * Math.PI * 2, tip = k % 2 ? 0.62 + 0.2 * R() : 1.0 + 0.15 * R();
      const rr = r * tip * (0.75 + 0.45 * fbm(x + Math.cos(a) * 3, z + t + Math.sin(a) * 3));
      rim.push([x + Math.cos(a) * rr, top - droop * (k % 2 ? 0.55 : 0.9 + 0.4 * R()), z + Math.sin(a) * rr]);
    }
    rim[sides] = rim[0];
    const apex = [x, top, z];
    for (let k = 0; k < sides; k++) {
      // the skirt is needles; over it a load of snow lifted a little, short of the rim
      const a = rim[k], b = rim[k + 1];
      const n = norm(cross(sub(b, apex), sub(a, apex))), up = n[1] < 0 ? mul(n, -1) : n;
      const ia = M.v("needles", a, up, a[0], a[2]), ib = M.v("needles", b, up, b[0], b[2]), ic = M.v("needles", apex, up, x, z);
      M.tri("needles", ia, ib, ic);
      if (R() < 0.15) continue;
      const inset = (p) => add(add(mul(p, 0.82), mul(apex, 0.18)), mul(up, 0.07));
      const sa = M.v("snow", inset(a), up, a[0], a[2]), sb = M.v("snow", inset(b), up, b[0], b[2]), sc = M.v("snow", add(apex, mul(up, 0.1)), up, x, z);
      M.tri("snow", sa, sb, sc);
    }
  }
}

// the frozen pond: a level sheet of ice with a wandering shore
export function pond(M, O, p) {
  M.grid("ice", (s, t) => {
    const a = t * Math.PI * 2, rr = p.r * s * (0.92 + 0.12 * fbm(Math.cos(a) * 2 + 4, Math.sin(a) * 2));
    return [p.x + Math.cos(a) * rr - O[0], p.y - O[1], p.z + Math.sin(a) * rr - O[2]];
  }, 24, 96, (s, t, q) => [q[0] * 0.25, q[2] * 0.25]);
}

// trees on the land round the town: woods past its edge and in patches, a few among the houses,
// none on lanes, houses or the pond
export function scatterTrees(M, R, P, H, O, groundY, radius) {
  const { cx, cz } = P;
  let bare = 0, spr = 0;
  const clear = (x, z) => {
    if (H.some((h) => Math.abs(h.x - x) < h.W / 2 + 4 && Math.abs(h.z - z) < h.D / 2 + 4)) return false;
    if (laneDist(P, x, z) < 3.5) return false;
    if (P.pond && Math.hypot(x - P.pond.x, z - P.pond.z) < P.pond.r + 5) return false;
    return true;
  };
  const step = 9;
  for (let gx = -radius; gx <= radius; gx += step) for (let gz = -radius; gz <= radius; gz += step) {
    const x = cx + gx + (R() - 0.5) * step, z = cz + gz + (R() - 0.5) * step, d = Math.hypot(x - cx, z - cz);
    if (d > radius) continue;
    const wood = smooth(P.reach - 70, P.reach + 30, d) * (0.25 + 0.9 * fbm(x * 0.012 + 3, z * 0.012 + 9));
    if (R() > Math.max(0.05, wood * 0.75)) continue;
    if (!clear(x, z)) continue;
    const y = groundY(x, z) - O[1];
    // bare broadleaf near the town (full crowns close in, coarser further out); spruce in the far woods
    if (d < P.reach + 40 && (fbm(x * 0.02, z * 0.02) > 0.5 || d < P.reach - 60)) { bareTree(M, R, x - O[0], y, z - O[2], 9 + 8 * R(), d < P.reach - 40 ? 3 : 2); bare++; }
    else { spruce(M, R, x - O[0], y, z - O[2], 7 + 9 * R()); spr++; }
  }
  return { bare, spruce: spr, clear };
}

// the knoll the town is seen from: high ground just outside the houses, on the far side of the town
// from the pond, raised into a rounded hill so the view falls over the roofs to the ice and the valley
export function findKnoll(P, g) {
  let best = null;
  // as near the houses as leaves room for the hill's foot, so the view looks down into the streets
  for (let a = 0; a < 96; a++) for (const rr of [P.reach * 0.45, P.reach * 0.55, P.reach * 0.65, P.reach * 0.75]) {
    const t = a / 96 * Math.PI * 2, x = P.cx + Math.cos(t) * rr, z = P.cz + Math.sin(t) * rr;
    const near = Math.min(...P.houses.map((h) => Math.hypot(h.x - x, h.z - z)));
    if (near < 55) continue;
    const score = g(x, z) + (P.pond ? 0.05 * Math.hypot(x - P.pond.x, z - P.pond.z) : 0) - 0.04 * rr;
    if (!best || score > best.score) best = { x, z, r: Math.min(150, near * 1.4), h: 46, score };
  }
  return best;
}
// the knoll's lift at a point (added to the ground by hstreet.mjs groundOf)
export const knollLift = (k, x, z) => { const d = Math.hypot(x - k.x, z - k.z) / k.r; return d >= 1 ? 0 : k.h * Math.pow(1 - d * d, 2) * (0.92 + 0.16 * fbm(x * 0.03, z * 0.03)); };

// the vantage points: the knoll (the hunters' view down over the town), the street from twenty
// metres up, the town across the ice, a high oblique and the lane from a child's eye
export function vantages(P, O, view, groundY, world) {
  const hill = { x: P.knoll.x, z: P.knoll.z, g: groundY(P.knoll.x, P.knoll.z) };
  const look = (ex, ey, ez, tx, ty, tz, fov) => {
    const dx = tx - ex, dy = ty - ey, dz = tz - ez, l = Math.hypot(dx, dy, dz);
    return { eye: [ex - O[0], ey - O[1], ez - O[2]], yaw: Math.atan2(dx, -dz), pitch: Math.asin(dy / l), fov };
  };
  const cy = groundY(P.cx, P.cz), views = {};
  // aim past the town at the land falling away beyond it, so the far valley sits under the horizon
  const ux = (P.cx - hill.x) / Math.hypot(P.cx - hill.x, P.cz - hill.z), uz = (P.cz - hill.z) / Math.hypot(P.cx - hill.x, P.cz - hill.z);
  const tx = P.cx + ux * 700, tz = P.cz + uz * 700, ty = baseGround(world, tx, tz);
  views.valley = look(hill.x - ux * 25, hill.g + 14, hill.z - uz * 25, tx, ty, tz, 56);
  views.hillside = look(hill.x, hill.g + 1.7, hill.z, tx, ty + 30, tz, 62);
  const fx = Math.sin(view.yaw), fz = -Math.cos(view.yaw), gv = groundY(view.x, view.z);
  const ox = view.x + fx * 6, oz = view.z + fz * 6;
  views.overhead = look(ox, groundY(ox, oz) + 19, oz, view.x + fx * 34, groundY(view.x + fx * 34, view.z + fz * 34), view.z + fz * 34, 54);
  views.oblique = look(P.cx + (hill.x - P.cx) * 0.55, cy + 70, P.cz + (hill.z - P.cz) * 0.55, P.cx, cy, P.cz, 40);
  if (P.pond) {
    const d = Math.hypot(P.pond.x - P.cx, P.pond.z - P.cz), ux = (P.pond.x - P.cx) / d, uz = (P.pond.z - P.cz) / d;
    const px = P.pond.x + ux * (P.pond.r - 4), pz = P.pond.z + uz * (P.pond.r - 4);
    views.ice = look(px, P.pond.y + 1.5, pz, P.cx, cy + 9, P.cz, 60);
  }
  views.lane = look(view.x, gv + 0.95, view.z, view.x + fx * 40, gv + 2.4, view.z + fz * 40, 74);
  return { views, hill };
}
