// SPDX-License-Identifier: FSL-1.1-MIT
export function rx(a) {
  const c = Math.cos(a),
    s = Math.sin(a);
  return [1, 0, 0, 0, c, s, 0, -s, c];
}
export function ry(a) {
  const c = Math.cos(a),
    s = Math.sin(a);
  return [c, 0, -s, 0, 1, 0, s, 0, c];
}
export function mul(a, b) {
  const r = [];
  for (let c = 0; c < 3; c++)
    for (let i = 0; i < 3; i++)
      r[c * 3 + i] = a[i] * b[c * 3] + a[3 + i] * b[c * 3 + 1] + a[6 + i] * b[c * 3 + 2];
  return r;
}
export const stackToWorld = (St, p) => {
  const R = mul(ry((St.spin * Math.PI) / 180), rx((St.tilt * Math.PI) / 180));
  return [
    (R[0] * p[0] + R[3] * p[1] + R[6] * p[2]) * St.size,
    (R[1] * p[0] + R[4] * p[1] + R[7] * p[2]) * St.size,
    (R[2] * p[0] + R[5] * p[1] + R[8] * p[2]) * St.size + St.oz,
  ];
};
export const mv = (M, v) => M.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
