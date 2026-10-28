// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// vessels.mjs: a branching vessel tree grown by the laws measured from coronary angiograms. Source: ARCADE (X-ray
// coronary angiography, SYNTAX segment polygons, CC0, MMBU slice 3), measured by
// library/lib/tools/vessellaws.py into measures/vessellaws-arcade.json (1064 bifurcations).
//
// What was measured, and how far to trust it:
//   parent widest   the parent is wider than both children in 94 percent of real bifurcations, 33 percent of random
//                   triplets (chance). Robust.
//   children        the larger child is 0.71 of the parent (median), the smaller 0.77 of the larger.
//   exponent        d0^x = d1^x + d2^x gives a median x of 1.47, far below Murray's cube law (3). Estimator-dependent:
//                   the simpler 2A/P width gave 1.78. Low confidence in the value; below 3 under both estimators.
//   angle           median 80 degrees between the children (p25 60, p75 101), in the image plane. Murray's angle rule
//                   with cube-law parents predicts 75 typical but does not predict single bifurcations (r -0.05).
//   length          a segment is about 14.5 diameters long (median, wide spread).
// The tree: each segment splits into two children with asymmetry a (small over large) sampled around the measured
// spread; the larger child is d0 / (1 + a^x)^(1/x), so x and a together set the child-to-parent ratio. The children
// share the total angle by Murray's split (the thinner child turns further). x 3 is the cube-law control.
export const ARCADE = {
  exponent: 1.47, asym: [0.67, 0.774, 0.89], angle: [60.4, 80.5, 101.2], lengthOverD: 14.5, largeChild: 0.707,
  source: 'ARCADE coronary angiography, CC0; measures/vessellaws-arcade.json',
};

// Murray's angles for a split (cube-law parent): the share of the total angle each child turns
export function murraySplit(d1, d2) {
  const d0 = Math.cbrt(d1 ** 3 + d2 ** 3), one = (a, b) => Math.acos(Math.max(-1, Math.min(1, (d0 ** 4 + a ** 4 - b ** 4) / (2 * d0 ** 2 * a ** 2))));
  const t1 = one(d1, d2), t2 = one(d2, d1); return t1 + t2 > 0 ? t1 / (t1 + t2) : 0.5;
}
const between = (rng, [lo, mid, hi]) => { const u = rng(); return u < 0.5 ? lo + (mid - lo) * 2 * u : mid + (hi - mid) * (2 * u - 1); };

// grow: returns segments [{ pts, d, depth }] and bifurcations [{ d0, d1, d2, angle }]
export function grow({ w, h, rng, depth = 7, exponent = ARCADE.exponent, asym = ARCADE.asym, angle = ARCADE.angle, lengthOverD = ARCADE.lengthOverD, minD = 1.2, bend = 0.12 }) {
  const segs = [], forks = [];
  // the root's diameter is chosen so the tree's mean path fits the frame height
  const ratio = 1 / Math.pow(1 + Math.pow(asym[1], exponent), 1 / exponent);
  let reach = 0; for (let k = 0; k < depth; k++) reach += Math.pow(ratio, k);
  const d0 = (0.92 * h) / (lengthOverD * reach);
  const step = (x, y, dir, d, k) => {
    if (k >= depth || d < minD) return;
    const L = lengthOverD * d * (0.75 + 0.5 * rng()), n = 6, pts = [[x, y]];
    let a = dir, px = x, py = y;
    for (let i = 0; i < n; i++) { a += (rng() - 0.5) * bend; px += Math.cos(a) * L / n; py += Math.sin(a) * L / n; pts.push([px, py]); }
    segs.push({ pts, d, depth: k });
    const r = between(rng, asym), big = d / Math.pow(1 + Math.pow(r, exponent), 1 / exponent), small = r * big;
    const total = between(rng, angle) * Math.PI / 180, share = murraySplit(big, small), side = rng() < 0.5 ? 1 : -1;
    forks.push({ d0: d, d1: big, d2: small, angle: total * 180 / Math.PI });
    step(px, py, a + side * total * share, big, k + 1);
    step(px, py, a - side * total * (1 - share), small, k + 1);
  };
  step(w / 2, h * 0.97, -Math.PI / 2, d0, 0);
  return { segs, forks, d0 };
}
