// Exact signed distance to an ellipsoid (Eberly, "Distance from a Point to an Ellipse, an Ellipsoid,
// or a Hyperellipsoid", bisection on the closest point's parameter). The bound used elsewhere,
// k0 (k0 - 1) / k1, is right on the surface but shrinks away from it, unevenly along a long axis;
// soft blends and anything that reads distance off the surface (cavity, thickness, soft shadow)
// then sees contour rings (ART-DIRECTION 7.1, the quay frames). This is the true distance.
const MAXIT = 34;   // 34 halvings leave the root to about 1e-10 of its bracket
function root3(r0, r1, z0, z1, z2, g) {
  const n0 = r0 * z0, n1 = r1 * z1; let s0 = z2 - 1, s1 = g < 0 ? 0 : Math.hypot(n0, n1, z2) - 1, s = 0;
  for (let i = 0; i < MAXIT; i++) {
    s = (s0 + s1) / 2; if (s === s0 || s === s1) break;
    const a = n0 / (s + r0), b = n1 / (s + r1), c = z2 / (s + 1), G = a * a + b * b + c * c - 1;
    if (G > 0) s0 = s; else if (G < 0) s1 = s; else break;
  }
  return s;
}
function root2(r0, z0, z1, g) {
  const n0 = r0 * z0; let s0 = z1 - 1, s1 = g < 0 ? 0 : Math.hypot(n0, z1) - 1, s = 0;
  for (let i = 0; i < MAXIT; i++) {
    s = (s0 + s1) / 2; if (s === s0 || s === s1) break;
    const a = n0 / (s + r0), b = z1 / (s + 1), G = a * a + b * b - 1;
    if (G > 0) s0 = s; else if (G < 0) s1 = s; else break;
  }
  return s;
}
// unsigned distance from (y0, y1) >= 0 to the ellipse with semi-axes e0 >= e1
function ellipse2(e0, e1, y0, y1) {
  if (y1 > 0) {
    if (y0 > 0) {
      const z0 = y0 / e0, z1 = y1 / e1, g = z0 * z0 + z1 * z1 - 1;
      if (g === 0) return 0;
      const r0 = (e0 / e1) ** 2, s = root2(r0, z0, z1, g);
      return Math.hypot(r0 * y0 / (s + r0) - y0, y1 / (s + 1) - y1);
    }
    return Math.abs(y1 - e1);
  }
  const num = e0 * y0, den = e0 * e0 - e1 * e1;
  if (num < den) { const x0r = num / den, x0 = e0 * x0r, x1 = e1 * Math.sqrt(Math.max(0, 1 - x0r * x0r)); return Math.hypot(x0 - y0, x1); }
  return Math.abs(y0 - e0);
}
// unsigned distance from y (all >= 0) to the ellipsoid with semi-axes e0 >= e1 >= e2
function ellipsoid3(e, y) {
  const [e0, e1, e2] = e, [y0, y1, y2] = y;
  if (y2 > 0) {
    if (y1 > 0) {
      if (y0 > 0) {
        const z0 = y0 / e0, z1 = y1 / e1, z2 = y2 / e2, g = z0 * z0 + z1 * z1 + z2 * z2 - 1;
        if (g === 0) return 0;
        const r0 = (e0 / e2) ** 2, r1 = (e1 / e2) ** 2, s = root3(r0, r1, z0, z1, z2, g);
        return Math.hypot(r0 * y0 / (s + r0) - y0, r1 * y1 / (s + r1) - y1, y2 / (s + 1) - y2);
      }
      return ellipse2(e1, e2, y1, y2);
    }
    if (y0 > 0) return ellipse2(e0, e2, y0, y2);
    return Math.abs(y2 - e2);
  }
  const d0 = e0 * e0 - e2 * e2, d1 = e1 * e1 - e2 * e2, n0 = e0 * y0, n1 = e1 * y1;
  let done = false, out = 0;
  if (n0 < d0 && n1 < d1) {
    const xd0 = n0 / d0, xd1 = n1 / d1, t = 1 - xd0 * xd0 - xd1 * xd1;
    if (t > 0) { const x0 = e0 * xd0, x1 = e1 * xd1, x2 = e2 * Math.sqrt(t); out = Math.hypot(x0 - y0, x1 - y1, x2); done = true; }
  }
  return done ? out : ellipse2(e0, e1, y0, y1);
}
// signed: p relative to the centre, in the ellipsoid's own axes; r its three semi-axes (any order)
export function ellExact(px, py, pz, rx, ry, rz) {
  const P = [Math.abs(px), Math.abs(py), Math.abs(pz)], R = [rx, ry, rz], ord = [0, 1, 2].sort((a, b) => R[b] - R[a]);
  const d = ellipsoid3(ord.map((i) => R[i]), ord.map((i) => P[i])), inside = (px / rx) ** 2 + (py / ry) ** 2 + (pz / rz) ** 2 < 1;
  return inside ? -d : d;
}
// the cheap bound, for comparison and for far points
export function ellBound(px, py, pz, rx, ry, rz) {
  const k0 = Math.hypot(px / rx, py / ry, pz / rz), k1 = Math.hypot(px / (rx * rx), py / (ry * ry), pz / (rz * rz));
  return k1 > 0 ? (k0 * (k0 - 1)) / k1 : -Math.min(rx, ry, rz);
}
