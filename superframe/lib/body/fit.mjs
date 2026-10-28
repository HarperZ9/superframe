// fit.mjs: circle fits and the phase-break detector for a 2D path. The detector sees points only, never angles.
// Fit: Kasa algebraic least squares (solve for x^2 + y^2 + D x + E y + F = 0), refined by Gauss-Newton on the
// geometric distance, so the reported residual is the true orthogonal distance to the circle.

function solve3(A, b) {
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < 3; c++) {
    let p = c; for (let r = c + 1; r < 3; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    if (Math.abs(M[c][c]) < 1e-300) return null;
    for (let r = 0; r < 3; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k < 4; k++) M[r][k] -= f * M[c][k]; }
  }
  return [M[0][3] / M[0][0], M[1][3] / M[1][1], M[2][3] / M[2][2]];
}

function normal3(rows, rhs) {
  const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], b = [0, 0, 0];
  rows.forEach((r, n) => { for (let i = 0; i < 3; i++) { b[i] += r[i] * rhs[n]; for (let j = 0; j < 3; j++) A[i][j] += r[i] * r[j]; } });
  return solve3(A, b);
}

export function fitCircle(pts) {
  const s = normal3(pts.map(([x, y]) => [x, y, 1]), pts.map(([x, y]) => -(x * x + y * y)));
  if (!s) return null;
  let cx = -s[0] / 2, cy = -s[1] / 2, r = Math.sqrt(Math.max(0, cx * cx + cy * cy - s[2]));
  for (let it = 0; it < 20; it++) {   // Gauss-Newton on d_i = |p_i - c| - r
    const rows = [], res = [];
    for (const [x, y] of pts) { const dx = x - cx, dy = y - cy, L = Math.hypot(dx, dy) || 1e-12; rows.push([-dx / L, -dy / L, -1]); res.push(-(L - r)); }
    const d = normal3(rows, res); if (!d) break;
    cx += d[0]; cy += d[1]; r += d[2];
    if (Math.hypot(d[0], d[1], d[2]) < 1e-12) break;
  }
  const dev = pts.map(([x, y]) => Math.hypot(x - cx, y - cy) - r);
  return { cx, cy, r, rms: Math.sqrt(dev.reduce((a, v) => a + v * v, 0) / dev.length), max: Math.max(...dev.map(Math.abs)) };
}

// Grow a prefix of the path; the break is the last prefix whose circle fit keeps every point within `tol`.
// Returns null when the whole path stays on one circle. Opening is the straight distance from the first point.
export function findBreak(pts, { tol = 0.01, minPts = 6 } = {}) {
  let last = minPts - 1;
  for (let n = minPts; n <= pts.length; n++) {
    const f = fitCircle(pts.slice(0, n));
    if (!f || f.max > tol) {
      const p = pts[last];
      return { index: last, opening: Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]), fit: fitCircle(pts.slice(0, last + 1)) };
    }
    last = n - 1;
  }
  return null;
}
