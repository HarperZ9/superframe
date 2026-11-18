// Line work for the plate: level lines of a field by marching squares, corner-cutting to smooth a
// polyline, and distance out to sea for the water-lining.

// Segments [x0, y0, x1, y1] where field crosses `level`, in field cells.
export function contours(field, w, h, level) {
  const out = [], at = (x, y) => field[y * w + x] - level;
  const cross = (xa, ya, va, xb, yb, vb) => { const t = va / (va - vb); return [xa + (xb - xa) * t, ya + (yb - ya) * t]; };
  for (let y = 0; y < h - 1; y++) for (let x = 0; x < w - 1; x++) {
    const a = at(x, y), b = at(x + 1, y), c = at(x + 1, y + 1), d = at(x, y + 1);
    const code = (a > 0 ? 1 : 0) | (b > 0 ? 2 : 0) | (c > 0 ? 4 : 0) | (d > 0 ? 8 : 0);
    if (code === 0 || code === 15) continue;
    const T = () => cross(x, y, a, x + 1, y, b), R = () => cross(x + 1, y, b, x + 1, y + 1, c), B = () => cross(x, y + 1, d, x + 1, y + 1, c), L = () => cross(x, y, a, x, y + 1, d);
    const seg = (p, q) => out.push([p[0], p[1], q[0], q[1]]);
    switch (code) {
      case 1: case 14: seg(L(), T()); break;
      case 2: case 13: seg(T(), R()); break;
      case 3: case 12: seg(L(), R()); break;
      case 4: case 11: seg(R(), B()); break;
      case 6: case 9: seg(T(), B()); break;
      case 7: case 8: seg(L(), B()); break;
      case 5: seg(L(), T()); seg(R(), B()); break;
      case 10: seg(T(), R()); seg(L(), B()); break;
    }
  }
  return out;
}

// one round of Chaikin corner cutting, ends kept
export function chaikin(pts) {
  if (pts.length < 3) return pts;
  const out = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    out.push([x0 * 0.75 + x1 * 0.25, y0 * 0.75 + y1 * 0.25], [x0 * 0.25 + x1 * 0.75, y0 * 0.25 + y1 * 0.75]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

// Distance from each sea cell to the nearest land, in cells (two-pass chamfer); land cells get 0.
// land holds a positive number on land and a negative one at sea.
export function seaDistance(land, w, h) {
  const d = new Float32Array(w * h), BIG = 1e6, A = 1, B = Math.SQRT2;
  for (let i = 0; i < w * h; i++) d[i] = land[i] > 0 ? 0 : BIG;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = y * w + x; let v = d[k];
    if (x > 0) v = Math.min(v, d[k - 1] + A);
    if (y > 0) { v = Math.min(v, d[k - w] + A); if (x > 0) v = Math.min(v, d[k - w - 1] + B); if (x < w - 1) v = Math.min(v, d[k - w + 1] + B); }
    d[k] = v;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const k = y * w + x; let v = d[k];
    if (x < w - 1) v = Math.min(v, d[k + 1] + A);
    if (y < h - 1) { v = Math.min(v, d[k + w] + A); if (x < w - 1) v = Math.min(v, d[k + w + 1] + B); if (x > 0) v = Math.min(v, d[k + w - 1] + B); }
    d[k] = v;
  }
  return d;
}
