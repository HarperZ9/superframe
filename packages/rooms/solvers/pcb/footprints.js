// SPDX-License-Identifier: FSL-1.1-MIT
// ======================================================================= Footprints. Pads in mm about the part origin; y up.
export function hdr(n, p, dr, pad) {
  const a = [];
  for (let i = 0; i < n; i++)
    a.push({
      pin: String(i + 1),
      x: 0,
      y: ((n - 1) / 2) * p - i * p,
      w: pad,
      h: pad,
      th: 1,
      drill: dr,
      round: i > 0,
    });
  return { pads: a, body: [p * 0.95, n * p, p === 2.54 ? 2.5 : 2.0], kind: "hdr", pitch: p };
}
export function chip(dx, pw, ph, bw, bh, bz, kind) {
  return {
    pads: [
      { pin: "1", x: -dx, y: 0, w: pw, h: ph },
      { pin: "2", x: dx, y: 0, w: pw, h: ph },
    ],
    body: [bw, bh, bz],
    kind,
  };
}
export const FP = {
  R0603: chip(0.8, 0.8, 0.9, 1.6, 0.8, 0.45, "res"),
  C0603: chip(0.8, 0.8, 0.9, 1.6, 0.8, 0.8, "cap"),
  R0805: chip(1, 1, 1.3, 2, 1.25, 0.5, "res"),
  C0805: chip(1, 1, 1.3, 2, 1.25, 1, "cap"),
  PD0805: chip(1, 1, 1.3, 2, 1.25, 0.7, "pd"),
  PD: chip(2.6, 1.5, 2, 5.4, 4.3, 1.2, "pdl"),
  SOIC8: {
    pads: [
      [1, -2.7, 1.905],
      [2, -2.7, 0.635],
      [3, -2.7, -0.635],
      [4, -2.7, -1.905],
      [5, 2.7, -1.905],
      [6, 2.7, -0.635],
      [7, 2.7, 0.635],
      [8, 2.7, 1.905],
    ].map((a) => ({ pin: String(a[0]), x: a[1], y: a[2], w: 1.55, h: 0.6 })),
    body: [3.9, 4.9, 1.6],
    kind: "ic",
    span: 2.7,
  },
  "SOT23-5": {
    pads: [
      [1, -0.95, -1.3],
      [2, 0, -1.3],
      [3, 0.95, -1.3],
      [4, 0.95, 1.3],
      [5, -0.95, 1.3],
    ].map((a) => ({ pin: String(a[0]), x: a[1], y: a[2], w: 0.6, h: 1.1 })),
    body: [1.6, 2.9, 1.1],
    kind: "sot",
  },
};
export function footprint(n) {
  if (FP[n]) return FP[n];
  let m = /^HDR(\d+)$/.exec(n);
  if (m) return hdr(+m[1], 2.54, 1, 1.7);
  m = /^HDS(\d+)$/.exec(n);
  if (m) return hdr(+m[1], 1.27, 0.6, 1);
  return null;
}
export function rot(x, y, r) {
  r = ((r % 360) + 360) % 360;
  return r === 90 ? [-y, x] : r === 180 ? [-x, -y] : r === 270 ? [y, -x] : [x, y];
}
