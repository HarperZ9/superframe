// ======================================================================= Vector math
function mul(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      o[c * 4 + r] =
        a[r] * b[c * 4] +
        a[4 + r] * b[c * 4 + 1] +
        a[8 + r] * b[c * 4 + 2] +
        a[12 + r] * b[c * 4 + 3];
  return o;
}
const nrm = (v) => {
    const l = Math.hypot(...v) || 1;
    return v.map((x) => x / l);
  },
  cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ],
  dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function lookAt(e, t, u) {
  const z = nrm([e[0] - t[0], e[1] - t[1], e[2] - t[2]]),
    x = nrm(cross(u, z)),
    y = cross(z, x);
  return Float32Array.from([
    x[0],
    y[0],
    z[0],
    0,
    x[1],
    y[1],
    z[1],
    0,
    x[2],
    y[2],
    z[2],
    0,
    -dot(x, e),
    -dot(y, e),
    -dot(z, e),
    1,
  ]);
}
function persp(f, a, n, r, jx, jy) {
  const t = 1 / Math.tan(f / 2);
  return Float32Array.from([
    t / a,
    0,
    0,
    0,
    0,
    t,
    0,
    0,
    jx || 0,
    jy || 0,
    (r + n) / (n - r),
    -1,
    0,
    0,
    (2 * r * n) / (n - r),
    0,
  ]);
}
function ortho(s, n, r) {
  return Float32Array.from([
    1 / s,
    0,
    0,
    0,
    0,
    1 / s,
    0,
    0,
    0,
    0,
    -2 / (r - n),
    0,
    0,
    0,
    -(r + n) / (r - n),
    1,
  ]);
}
