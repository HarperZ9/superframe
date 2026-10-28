// camera.mjs: a pinhole camera in 35 mm-equivalent terms. World axes: x right, y up, z forward. Image axes: u right,
// v down, in pixels, centre of pixel (i, j) at (i + 0.5, j + 0.5). The focal length in pixels is focalMm / 36 * W,
// so "16 mm" means the horizontal field of a 16 mm lens on a 36 mm wide sensor whatever the render size.
const D2R = Math.PI / 180;

// camera-to-world rotation Ry(a) Rx(b) Rz(c); makeCamera passes (yaw, -pitch, roll) so yaw turns right and pitch tilts up.
function rotation(yaw, pitch, roll) {
  const [a, b, c] = [yaw * D2R, pitch * D2R, roll * D2R];
  const Ry = [[Math.cos(a), 0, Math.sin(a)], [0, 1, 0], [-Math.sin(a), 0, Math.cos(a)]];
  const Rx = [[1, 0, 0], [0, Math.cos(b), -Math.sin(b)], [0, Math.sin(b), Math.cos(b)]];
  const Rz = [[Math.cos(c), -Math.sin(c), 0], [Math.sin(c), Math.cos(c), 0], [0, 0, 1]];
  const mul = (A, B) => A.map(r => [0, 1, 2].map(j => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
  return mul(mul(Ry, Rx), Rz);
}
const apply = (M, v) => M.map(r => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
const applyT = (M, v) => [0, 1, 2].map(j => M[0][j] * v[0] + M[1][j] * v[1] + M[2][j] * v[2]);

export function makeCamera({ w, h, focalMm, pos = [0, 0, 0], yaw = 0, pitch = 0, roll = 0 }) {
  const f = focalMm / 36 * w, cx = w / 2, cy = h / 2, M = rotation(yaw, -pitch, roll);
  const toCam = X => applyT(M, [X[0] - pos[0], X[1] - pos[1], X[2] - pos[2]]);
  return {
    w, h, f, cx, cy, focalMm, pos, yaw, pitch, roll,
    hfovDeg: 2 * Math.atan(18 / focalMm) / D2R,
    toCam,
    // world point -> [u, v, depth]; depth is the camera-frame z (negative behind the camera)
    project(X) { const c = toCam(X); return [cx + f * c[0] / c[2], cy - f * c[1] / c[2], c[2]]; },
    // world direction -> its vanishing point [u, v], or null when the direction is parallel to the image plane
    vanish(d) { const c = applyT(M, d); return Math.abs(c[2]) < 1e-12 ? null : [cx + f * c[0] / c[2], cy - f * c[1] / c[2]]; },
    // image point -> unit world ray direction
    ray(u, v) { const c = [(u - cx) / f, -(v - cy) / f, 1], n = Math.hypot(...c); return apply(M, c.map(x => x / n)); },
  };
}

// Visible part of the 3D line X0 + t d, t in [t0, t1]: sampled, clipped to depth > 0.05 and to the frame.
// Returns { near: [u, v, depth], far: [u, v, depth] } in image terms, or null when under minPx long on screen.
export function visibleSpan(cam, X0, d, t0, t1, { samples = 4000, minPx = 20 } = {}) {
  let first = null, last = null;
  for (let k = 0; k <= samples; k++) {
    const t = t0 + (t1 - t0) * k / samples, p = cam.project([X0[0] + t * d[0], X0[1] + t * d[1], X0[2] + t * d[2]]);
    if (p[2] > 0.05 && p[0] >= 0 && p[0] <= cam.w && p[1] >= 0 && p[1] <= cam.h) { first ??= p; last = p; }
  }
  if (!first || Math.hypot(last[0] - first[0], last[1] - first[1]) < minPx) return null;
  return first[2] <= last[2] ? { near: first, far: last } : { near: last, far: first };
}
