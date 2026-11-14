// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// treedraw.mjs: put the wind into a tree skeleton (pnwtrees.mjs) and draw it as pixels.
// Every limb carries a damped oscillator (wind.mjs) tuned to its own natural frequency, f ~ k d / L^2 with L the
// limb's lever length; the drive is the drag on it, which grows with the limb's height above ground (a log wind
// profile, u(z) ~ ln(z / z0), z0 about 0.5 m for suburban ground; standard boundary-layer form). The deflection is
// added to the limb's rest angle, and each limb starts at its parent's moving tip, so a gust bends the trunk a
// little, the limbs more, and the tips most, each at its own pace.
// Foliage: conifer needles and cedar sprays move with their limb plus a small flutter; maple leaves flutter fast and
// flip to show their paler undersides as a gust peaks.
import { oscillator, drive, dragLoad, limbFreq } from './wind.mjs';
import { set, disc, line } from './raster.mjs';

export function rig(T, rng) {
  for (const l of T.limbs) {
    const lever = l.trunk ? T.H * 0.7 : l.len * 1.4, f = Math.min(3, Math.max(0.15, limbFreq(Math.max(0.02, l.d), lever)));
    // compliance: thin long limbs bend more per unit load; conifer stems are stiffer than their branches
    const gain = l.trunk ? 0.012 : 0.05 * Math.min(6, l.len / (l.d * 40 + 0.05));
    l.osc = oscillator(f * (0.9 + 0.2 * rng()), l.trunk ? 0.08 : 0.15, gain);
  }
  return T;
}

// absolute geometry at this instant: base, tip and angle of every limb (angles from vertical, + to the right)
export function pose(T, x0, y0) {
  for (const l of T.limbs) {
    const p = l.parent, ang = (p ? p.ang : 0) + l.rest + (l.osc?.th ?? 0) * (l.rest >= 0 || l.trunk ? 1 : 0.6);
    const bx = p ? p.x + (p.tx - p.x) * l.at : x0, by = p ? p.y + (p.ty - p.y) * l.at : y0;
    Object.assign(l, { ang, x: bx, y: by, tx: bx + Math.sin(ang) * l.len, ty: by + Math.cos(ang) * l.len });
  }
  return T;
}

const logProfile = z => Math.log(Math.max(1, z) / 0.5) / Math.log(10 / 0.5);

export function stepTree(T, dt, windAt, t, xWorld) {
  for (const l of T.limbs) {
    const z = Math.max(1, l.y ?? 1), u = windAt(t, xWorld) * logProfile(z);
    drive(l.osc, dragLoad(u), dt);
  }
  return T;
}

// draw: proj(x, y) maps tree metres to screen; light(x, y, up) returns linear RGB for a surface at that point facing
// up (up = 1) or sideways (up = 0); colours: { bark, moss, needle, spray, leaf, under }
export function drawTree(F, T, proj, light, col, { t = 0, gust = 0, k = 4 } = {}) {
  for (const l of T.limbs) {
    const [ax, ay] = proj(l.x, l.y), [bx, by] = proj(l.tx, l.ty), w = Math.max(1, l.d * k * (l.buttress ? 1.6 : 1));
    const c = mul(col.bark, light(l.x, l.y, 0.3));
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay)));
    for (let i = 0; i <= n; i++) {
      const u = i / n, x = ax + (bx - ax) * u, y = ay + (by - ay) * u, r = (w * (1 - 0.35 * u)) / 2;
      // where a trunk meets the ground it stands in it: draw the cross-section flat, not a round end below the soil
      const wy = l.y + (l.ty - l.y) * u;
      if (r <= 0.75) set(F, x, y, c); else if (l.trunk && wy < l.d * 0.6) for (let dx = -r; dx <= r; dx++) set(F, x + dx, y, c); else disc(F, x, y, r, c);
      // moss on the upper side of maple limbs
      if (l.moss && !l.trunk && i % 2 === 0) set(F, x, y - Math.max(1, r), mul(col.moss, light(l.x, l.y, 1)));
      if (l.moss && l.trunk && i % 3 === 0) set(F, x - r * 0.5, y, mul(col.moss, light(l.x, l.y, 0.4)));
    }
  }
  for (const l of T.limbs) for (const f of l.leaves) foliage(F, l, f, proj, light, col, t, gust, k);
}

function foliage(F, l, f, proj, light, col, t, gust, k) {
  const x = l.x + (l.tx - l.x) * f.at + f.dx, y = l.y + (l.ty - l.y) * f.at + f.dy, fl = (0.03 + 0.06 * gust) * Math.sin(t * 9 + f.ph);
  const [X, Y] = proj(x + fl, y);
  if (f.kind === 'needle') {
    // a pendant branchlet: a short dark cluster, lit on top
    const c = mul(col.needle, light(x, y, 0.4)), top = mul(col.needle, light(x, y, 1)), r = Math.max(1, 0.32 * k);
    for (let dy = -r; dy <= r; dy++) for (let dx = -r * 1.6; dx <= r * 1.6; dx++) if ((dx / 1.6) ** 2 + dy * dy <= r * r) set(F, X + dx, Y + dy, dy < -r * 0.4 ? top : c);
  } else if (f.kind === 'spray') {
    // a hanging flat spray of scale leaves: a short curtain that swings as a pendulum
    const len = Math.max(2, Math.round(-f.dy * k * 0.9)), sw = Math.sin(t * 1.7 + f.ph) * (0.4 + 1.5 * gust), wd = Math.max(2, Math.round(0.5 * k));
    for (let i = 0; i < len; i++) { const c = mul(col.spray, light(x, y - i / k, i ? 0.35 : 0.9)); for (let j = 0; j < wd - (i > len * 0.7); j++) set(F, X - wd / 2 + j + sw * i / len, Y + i, c); }
  } else {
    // a maple leaf, about 0.25 m: fast flutter, and the underside shows when the gust lifts it
    const flip = Math.sin(t * 13 + f.ph * 3) > 1.6 - 1.4 * gust, c = mul(flip ? col.under : col.leaf, light(x, y, flip ? 0.4 : 0.8));
    set(F, X, Y, c); if (k > 3) set(F, X + 1, Y, c); if (k > 5) set(F, X, Y + 1, c);
  }
}
const mul = (a, b) => [a[0] * b[0], a[1] * b[1], a[2] * b[2]];
export { line };
