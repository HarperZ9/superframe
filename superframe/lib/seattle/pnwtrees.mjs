// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// pnwtrees.mjs: three Pacific Northwest trees as branch skeletons, in metres, in the plane of the picture.
//
// Douglas fir (Pseudotsuga menziesii): a straight, single trunk; branches in whorls; in the lower crown they droop
// and then turn their tips up, in the upper crown they sweep up; foliage hangs from the branches in pendant
// branchlets of short flat needles; a narrow conical crown.
// Western redcedar (Thuja plicata): a fluted, buttressed base; the leader nods over at the top; branches leave the
// trunk, dip and curve up at the tip in a J; the scale-leaf foliage hangs from them in flat, drooping sprays, like
// curtains.
// Bigleaf maple (Acer macrophyllum): a short trunk that splits into a few large ascending limbs, a broad rounded
// crown, the largest leaves of any maple (15 to 30 cm, palmately five-lobed), yellow to tan in late October, paler
// beneath; trunk and limbs carry moss and licorice fern, thickest on their upper sides.
//
// A limb: { x, y (base, set from its parent), len, d (base diameter, m), rest (angle from vertical, rad, + leans
// right), parent, at (share of the parent's length where it starts), osc (filled by treedraw), leaves: [...] }.
// Foliage items: { at (share along the limb), dx, dy (m), kind: 'needle' | 'spray' | 'leaf', ph }.
const DEG = Math.PI / 180;

function limb(T, parent, at, len, d, rest, extra = {}) { const l = { parent, at, len, d, rest, leaves: [], ...extra }; T.limbs.push(l); return l; }

export function douglasFir(rng, { H = 30 } = {}) {
  const T = { species: 'douglas-fir', H, limbs: [] };
  let prev = null;
  const segs = 6;
  for (let s = 0; s < segs; s++) prev = limb(T, prev, 1, H / segs, 0.6 * (1 - s / segs) + 0.06, 0, { trunk: true, seg: s });
  for (let h = 3.5; h < H - 0.6; h += 0.9 + rng() * 0.5) {
    const s = Math.min(segs - 1, Math.floor(h / (H / segs))), host = T.limbs.filter(l => l.trunk)[s], at = (h - s * H / segs) / (H / segs);
    const u = h / H, L = Math.min(6.5, (H - h) * 0.3) * (0.6 + 0.7 * rng());
    for (const side of [-1, 1]) {
      if (rng() < 0.3) continue;
      const droop = u < 0.65 ? (100 + 15 * rng()) * DEG : (65 + 25 * u) * DEG;
      const b = limb(T, host, at, L * 0.65, 0.05 + 0.08 * (1 - u), side * droop);
      const tip = limb(T, b, 1, L * 0.4, 0.03, side * (u < 0.65 ? 60 : 50) * DEG - side * droop);
      for (const l of [b, tip]) for (let q = 0.05; q < 1; q += 0.09) l.leaves.push({ at: q, dx: (rng() - 0.5) * 0.6, dy: 0.3 - 0.9 * rng(), kind: 'needle', ph: rng() * 6.3 });
    }
  }
  return T;
}

export function westernRedcedar(rng, { H = 24 } = {}) {
  const T = { species: 'western-redcedar', H, limbs: [] };
  let prev = null;
  const segs = 7;
  for (let s = 0; s < segs; s++) {
    const nod = s >= segs - 2 ? (s === segs - 1 ? 38 : 14) * DEG : 0;   // the drooping leader
    prev = limb(T, prev, 1, H / segs, 0.9 * (1 - s / segs) + 0.05, nod, { trunk: true, seg: s, buttress: s === 0 });
  }
  for (let h = 2.5; h < H - 1.5; h += 0.8 + rng() * 0.6) {
    const s = Math.min(segs - 1, Math.floor(h / (H / segs))), host = T.limbs.filter(l => l.trunk)[s], at = (h - s * H / segs) / (H / segs);
    const u = h / H, L = Math.min(5.5, (H - h) * 0.36 + 0.6) * (0.75 + 0.5 * rng());
    for (const side of [-1, 1]) {
      if (rng() < 0.2) continue;
      // J-shaped: out and down, further down, then up at the tip
      const a = limb(T, host, at, L * 0.45, 0.05 + 0.06 * (1 - u), side * (95 + 10 * rng()) * DEG);
      const b = limb(T, a, 1, L * 0.35, 0.035, side * 22 * DEG);
      const c = limb(T, b, 1, L * 0.25, 0.02, -side * 70 * DEG);
      for (const l of [a, b, c]) for (let q = 0.1; q < 1; q += 0.16) l.leaves.push({ at: q, dx: (rng() - 0.5) * 0.3, dy: -0.5 - 0.9 * rng(), kind: 'spray', ph: rng() * 6.3 });
    }
  }
  return T;
}

export function bigleafMaple(rng, { H = 17 } = {}) {
  const T = { species: 'bigleaf-maple', H, limbs: [] };
  const trunk = limb(T, null, 1, 3.2, 0.8, 0, { trunk: true, moss: true });
  const grow = (parent, len, d, rest, depth) => {
    const l = limb(T, parent, 1, len, d, rest, { moss: depth < 2 });
    if (depth >= 2) for (let q = 0; q < 6; q++) l.leaves.push({ at: 0.4 + 0.6 * rng(), dx: (rng() - 0.5) * 1.4, dy: (rng() - 0.4) * 1.2, kind: 'leaf', ph: rng() * 6.3, under: rng() });
    if (depth >= 3) { for (let q = 0; q < 16; q++) l.leaves.push({ at: 0.2 + 0.8 * rng(), dx: (rng() - 0.5) * 1.8, dy: (rng() - 0.35) * 1.4, kind: 'leaf', ph: rng() * 6.3, under: rng() }); return; }
    const n = depth === 0 ? 3 : 2 + (rng() < 0.5);
    for (let i = 0; i < n; i++) grow(l, len * (0.62 + 0.15 * rng()), d * 0.6, (i - (n - 1) / 2) * (30 + 15 * rng()) * DEG, depth + 1);
  };
  for (const a of [-34, 4, 30]) grow(trunk, 5 + rng() * 1.5, 0.4, (a + (rng() - 0.5) * 10) * DEG, 0);
  return T;
}

export const SPECIES = { 'douglas-fir': douglasFir, 'western-redcedar': westernRedcedar, 'bigleaf-maple': bigleafMaple };
