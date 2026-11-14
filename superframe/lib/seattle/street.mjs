// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// street.mjs: surfaces of a wet night street, shared by the outdoor scenes.
//
// Wet road: a water film on asphalt is a weak mirror whose reflectance follows Fresnel for water (refraction.mjs):
// about 2% looking straight down, rising steeply toward grazing view, so the far road shines and the near road is
// dark. The film is not flat: the asphalt's texture tilts it, and a rough mirror stretches every reflection along the
// line toward the viewer (the long vertical streaks under street lamps). That stretch is modelled as a vertical
// spread of the mirrored image that grows with distance, an approximation of a microfacet lobe seen at grazing angle.
// The film covers the asphalt only in part (an authored 60%); puddles are full, smoother, and keep their reflections
// sharp; raindrops print expanding rings on them.
// The mirror image of a point (x, y, z) is (x, -y, z); in screen space its position depends on depth, and the mirror
// here assumes the reflected things stand near depth zRef (the trees and lamp across the street).
import { fresnel } from '../medium/refraction.mjs';
import { ground, ray, lampE } from './outdoor.mjs';
import { get, set } from './raster.mjs';

const N_WATER = 1.333;

export function wetRoad(F, C, src, { zRef = 17, puddles = [], ripples = [], diffuse, lamp, t = 0, roadZ = [2, 15] } = {}) {
  const horizon = C.H / 2 - C.f * Math.tan(C.pitch);
  for (let Y = Math.ceil(horizon); Y < C.H; Y++) for (let X = 0; X < C.W; X++) {
    const g = ground(C, X + 0.5, Y + 0.5); if (!g || g[2] < roadZ[0] || g[2] > roadZ[1]) continue;
    const d = ray(C, X + 0.5, Y + 0.5), n = Math.hypot(...d), cosI = -d[1] / n;
    const R = fresnel(1, N_WATER, cosI), refl = (R.rs + R.rp) / 2;
    const inPuddle = puddles.some(p => ((g[0] - p.x) / p.rx) ** 2 + ((g[2] - p.z) / p.rz) ** 2 < 1);
    // the screen row of the scene point whose mirror image lands here, for things standing at depth zRef:
    // image row Y = cy + f (y + h) / z, object row = cy - f (y - h) / z, so object = 2 cy - Y + 2 f h / z
    const mirrorY = 2 * horizon - Y + 2 * C.f * C.height / zRef;
    const spread = inPuddle ? 0 : Math.round(2 + g[3] * 0.5), wob = inPuddle ? rippleShift(g, ripples, t) : 0;
    let acc = [0, 0, 0];
    for (let k = -spread; k <= spread; k++) { const c = get(src, X + wob, mirrorY + k); acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2]; }
    acc = acc.map(v => v / (2 * spread + 1));
    const E = lamp ? lampE(lamp, g) : 0, base = diffuse(g, E);
    set(F, X, Y, base.map((b, c) => b * (1 - refl) + acc[c] * refl * (inPuddle ? 1 : 0.6)));
  }
  return F;
}

// a raindrop on a puddle: a ring expanding at the capillary-gravity wave speed (~0.25 m/s for centimetre waves),
// fading as it spreads; its slope bends the mirrored image sideways
function rippleShift(g, ripples, t) {
  let s = 0;
  for (const r of ripples) { const age = t - r.t0; if (age < 0 || age > 1.2) continue; const d = Math.hypot(g[0] - r.x, g[2] - r.z), rad = 0.25 * age; if (Math.abs(d - rad) < 0.04) s += (1 - age / 1.2) * 1.5; }
  return Math.round(s);
}

// overhead wires: a catenary from (x0, y0) to (x1, y1) at depth z with sag s, drawn 1 px
export function wire(F, proj, x0, y0, x1, y1, z, sag, rgb) {
  for (let i = 0; i <= 120; i++) { const u = i / 120, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u - sag * 4 * u * (1 - u), p = proj(x, y, z); if (p) set(F, p[0], p[1], rgb); }
}
export const wireY = (x0, y0, x1, y1, sag, x) => { const u = (x - x0) / (x1 - x0); return y0 + (y1 - y0) * u - sag * 4 * u * (1 - u); };
