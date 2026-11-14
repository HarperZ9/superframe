// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// precip.mjs: rain and snow as particles in a box of air in front of the camera.
//
// Snow: unrimed aggregate flakes fall at about 0.8 to 1.5 m/s nearly independent of size (Locatelli and Hobbs 1974,
// from memory, moderate confidence). Flakes flutter: they sway and tumble with periods near a second and amplitudes of
// centimetres. They move with the horizontal wind, since their fall speed is small.
// Rain: drops fall at their terminal speed (Atlas et al. 1973 fit, droplens.rainSpeed), sizes from Marshall-Palmer,
// and are carried sideways by the wind, so streaks slant at atan(u / v).
// A particle is only seen by the light that reaches it: illum(p) returns irradiance at the particle, and its image is
// that times its albedo over pi, times its projected area over a pixel's (energy-true splatting). That is why snow
// shows bright in a street lamp's cone and faint in moonlight, with no authored "lit region".
//
//   createPrecip(rng, { kind, n, box })      illum(p) returns irradiance as linear RGB
//   stepPrecip(P, dt, windAt(t, x), t, rate)   rate 0..1 scales the falling share (showers come and go)
//   drawPrecip(F, P, C, illum, { exposureTime })
import { rainSpeed, marshallPalmer } from './droplens.mjs';
import { proj } from './outdoor.mjs';
import { add } from './raster.mjs';

export function createPrecip(rng, { kind = 'snow', n = 1500, box = { x: [-14, 14], y: [0, 12], z: [1.5, 34] }, R = 4 } = {}) {
  const mp = marshallPalmer(R), ps = [];
  for (let i = 0; i < n; i++) {
    const D = kind === 'snow' ? 2 + rng() * 6 : Math.min(4, 0.6 + mp.draw(rng));
    ps.push({ x: lerp(box.x, rng()), y: lerp(box.y, rng()), z: lerp(box.z, rng()), D, v: kind === 'snow' ? 0.8 + 0.6 * rng() : rainSpeed(D),
      ph: rng() * 6.28, sw: 0.6 + rng() * 0.8, amp: 0.02 + rng() * 0.06, on: rng() });
  }
  return { kind, ps, box, rng };
}
const lerp = ([a, b], t) => a + (b - a) * t;

export function stepPrecip(P, dt, windAt, t) {
  const { box } = P;
  for (const p of P.ps) {
    p.y -= p.v * dt; p.x += windAt(t, p.x) * dt * (P.kind === 'snow' ? 0.9 : 1);
    if (p.y < box.y[0]) { p.y += box.y[1] - box.y[0]; p.x = lerp(box.x, P.rng()); }
    if (p.x > box.x[1]) p.x -= box.x[1] - box.x[0]; else if (p.x < box.x[0]) p.x += box.x[1] - box.x[0];
  }
  return P;
}

// where a particle is at time t, flutter included (snow sways in x and z around its drift path)
function at(P, p, t) {
  if (P.kind !== 'snow') return [p.x, p.y, p.z];
  return [p.x + p.amp * Math.sin(p.sw * 6.28 * t + p.ph), p.y, p.z + p.amp * Math.cos(p.sw * 4.1 * t + p.ph)];
}

// rate: share of particles falling (showers), exposureTime: the eye's integration time for rain streaks (s)
// weight: how many real drops or flakes one drawn particle stands for. The box holds far fewer particles than the air
// does (rain of a few mm/h carries hundreds of millimetre drops per cubic metre); the rest of their light is the haze
// (outdoor.haze). The weight is authored per scene.
export function drawPrecip(F, P, C, illum, { t = 0, rate = 1, exposureTime = 1 / 30, windAt = () => 0, albedo = 0.8, occluded = null, weight = 1 } = {}) {
  for (const p of P.ps) {
    if (p.on > rate) continue;
    const w = at(P, p, t), q = proj(C, ...w); if (!q) continue;
    const [X, Y, z] = q; if (X < -2 || Y < -2 || X > F.w + 2 || Y > F.h + 2) continue;
    if (occluded && occluded(X, Y, z)) continue;
    const E = illum(w), rpx = (p.D * 5e-4) * C.f / z, area = Math.PI * rpx * rpx, L = E.map(e => e * albedo / Math.PI * area * weight);
    if (P.kind !== 'snow') { streak(F, C, w, p, L, exposureTime, windAt(t, w[0])); continue; }
    // near flakes are out of focus and spread over a few pixels; the energy stays the same
    if (rpx <= 0.6) add(F, X, Y, L);
    else for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) add(F, X + dx, Y + dy, L, (dx || dy ? 0.08 : 0.36));
  }
  return F;
}

// a rain drop moves (u, -v) during the eye's integration time: a slanted streak whose energy is spread along it
function streak(F, C, w, p, energy, T, u) {
  const a = proj(C, w[0], w[1], w[2]), b = proj(C, w[0] + u * T, w[1] - p.v * T, w[2]);
  if (!a || !b) return;
  const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])));
  for (let k = 0; k <= n; k++) add(F, a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n, energy, 1 / (n + 1));
}
