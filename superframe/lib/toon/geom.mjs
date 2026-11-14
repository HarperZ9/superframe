// geom.mjs: the vector kit the cartoon renderer draws with. Contours are arrays of [x, y] (closed unless a function
// says otherwise). Everything here is pure: no pixels, no randomness.
const TAU = Math.PI * 2;

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const smooth = t => { const u = clamp(t); return u * u * (3 - 2 * u); };

export function ellipse(cx, cy, rx, ry, n = 64, rot = 0) {
  const c = Math.cos(rot), s = Math.sin(rot), out = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU, x = rx * Math.sin(a), y = -ry * Math.cos(a); out.push([cx + c * x - s * y, cy + s * x + c * y]); }
  return out;
}

// Catmull-Rom through control points; `seg` samples per span. Closed by default.
export function curve(P, { closed = true, seg = 10 } = {}) {
  const n = P.length, out = [], at = i => P[closed ? ((i % n) + n) % n : Math.max(0, Math.min(n - 1, i))];
  const spans = closed ? n : n - 1;
  for (let i = 0; i < spans; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    for (let k = 0; k < seg; k++) {
      const t = k / seg, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(c => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)));
    }
  }
  if (!closed) out.push(P[n - 1].slice());
  return out;
}

// A symmetric closed shape from its right half (points from top centre, down the right side, to bottom centre).
export function mirrored(half, opts) {
  const right = half, left = half.slice(1, -1).reverse().map(([x, y]) => [-x, y]);
  return curve([...right, ...left], opts);
}

export const area = C => { let s = 0; for (let i = 0; i < C.length; i++) { const [x0, y0] = C[i], [x1, y1] = C[(i + 1) % C.length]; s += x0 * y1 - x1 * y0; } return s / 2; };
export const orient = (C, sign = 1) => (Math.sign(area(C)) === sign || area(C) === 0 ? C : C.slice().reverse());

export function bbox(contours) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const C of contours) for (const [x, y] of C) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  return [x0, y0, x1, y1];
}

// Affine maps as [a, b, c, d, e, f]: x' = a x + c y + e, y' = b x + d y + f.
export const I = [1, 0, 0, 1, 0, 0];
export const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
export const translate = (x, y) => [1, 0, 0, 1, x, y];
export const scale = (sx, sy = sx) => [sx, 0, 0, sy, 0, 0];
export const rotate = a => [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0];
export const chain = (...ms) => ms.reduce((acc, m) => mul(acc, m), I);
export const apply = (m, P) => P.map(([x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]);
export const applyAll = (m, Cs) => Cs.map(C => apply(m, C));

// Resample a closed contour to n points by arc length, starting at its topmost point and running clockwise on
// screen (y down), so two shapes can be blended point for point.
export function resample(C, n = 96) {
  const P = orient(C, 1);
  let top = 0; for (let i = 1; i < P.length; i++) if (P[i][1] < P[top][1] - 1e-9 || (Math.abs(P[i][1] - P[top][1]) < 1e-9 && Math.abs(P[i][0]) < Math.abs(P[top][0]))) top = i;
  const Q = P.slice(top).concat(P.slice(0, top)); Q.push(Q[0]);
  const L = [0]; for (let i = 1; i < Q.length; i++) L.push(L[i - 1] + Math.hypot(Q[i][0] - Q[i - 1][0], Q[i][1] - Q[i - 1][1]));
  const total = L[L.length - 1], out = []; let j = 0;
  for (let k = 0; k < n; k++) {
    const s = (k / n) * total; while (j < L.length - 2 && L[j + 1] < s) j++;
    const t = (s - L[j]) / Math.max(1e-12, L[j + 1] - L[j]);
    out.push([lerp(Q[j][0], Q[j + 1][0], t), lerp(Q[j][1], Q[j + 1][1], t)]);
  }
  return out;
}
export const blend = (A, B, wa, wb) => A.map((p, i) => [p[0] * wa + B[i][0] * wb, p[1] * wa + B[i][1] * wb]);
export const flipX = C => C.map(([x, y]) => [-x, y]).reverse();

// Closed outline of a tube along a path with a radius per point: offsets along averaged normals, round end caps.
// Smooth paths only: a bend tighter than the radius folds the outline (nonzero fill still covers the fold).
export function tube(P, R, { cap = 8 } = {}) {
  const n = P.length, L = [], Rt = [];
  const nrm = i => {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    return [-dy / l, dx / l];
  };
  for (let i = 0; i < n; i++) { const [nx, ny] = nrm(i), r = R[i]; L.push([P[i][0] + nx * r, P[i][1] + ny * r]); Rt.push([P[i][0] - nx * r, P[i][1] - ny * r]); }
  // an arc from angle `from` sweeping -pi: from the left offset, round the tip, to the right offset
  const capArc = (c, r, from) => { const out = []; for (let k = 1; k < cap; k++) { const a = from - (k / cap) * Math.PI; out.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]); } return out; };
  const [ex, ey] = nrm(n - 1), [sx, sy] = nrm(0);
  const endCap = capArc(P[n - 1], R[n - 1], Math.atan2(ey, ex)), startCap = capArc(P[0], R[0], Math.atan2(sy, sx) - Math.PI);
  return [...L, ...endCap, ...Rt.reverse(), ...startCap];
}

// Rounded rectangle centred on (cx, cy).
export function roundRect(cx, cy, w, h, r, n = 6) {
  const out = [], hw = w / 2 - r, hh = h / 2 - r;
  for (const [ox, oy, a0] of [[hw, -hh, -Math.PI / 2], [hw, hh, 0], [-hw, hh, Math.PI / 2], [-hw, -hh, Math.PI]])
    for (let k = 0; k <= n; k++) { const a = a0 + (k / n) * (Math.PI / 2); out.push([cx + ox + r * Math.cos(a), cy + oy + r * Math.sin(a)]); }
  return out;
}

// A regular star or polygon (inner radius ri for stars; ri = r gives a polygon).
export function star(cx, cy, r, ri, k, rot = 0) {
  const out = []; for (let i = 0; i < 2 * k; i++) { const a = rot + (i / (2 * k)) * TAU - Math.PI / 2, rr = i % 2 ? ri : r; out.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]); }
  return out;
}
