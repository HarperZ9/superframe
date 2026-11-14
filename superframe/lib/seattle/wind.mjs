// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// wind.mjs: gusty wind and the way trees answer it.
//
// Gusts: near-surface wind is a mean plus turbulence whose energy falls with frequency roughly as f^(-5/3) above the
// spectral peak (the Kolmogorov inertial range; Kaimal et al. 1972 give the full surface-layer form). Here the
// turbulence is a sum of sinusoids with amplitudes from that slope. Gusts are frozen into the flow and carried
// downwind (Taylor's hypothesis), so a gust reaches a tree upwind before one downwind: u(x, t) = u(t - x / U).
// For loops every frequency is a whole number of cycles per loop, so the wind closes exactly; for the long video the
// frequencies are free and the wind never repeats.
//
// Trees: each branch is a damped oscillator. A cantilever's first natural frequency is
//   f = (1.875^2 / 2 pi) sqrt(E I / (m L^4))  ->  for a round tapered stem, f ~ k d / L^2
// so thick short limbs are stiff and fast, long thin ones slow (whole conifers of 20 to 40 m sway near 0.2 to 0.5 Hz;
// measured values from memory, moderate confidence; k below is calibrated to that). Damping ratios of trees are high
// (about 0.05 to 0.2). Drag F = 0.5 rho Cd A U^2 (U / U0)^B: foliage streamlines and reconfigures, so drag grows more
// slowly than U^2 (Vogel exponent B about -0.5 to -1 for conifer crowns; Vogel 1989, from memory).
// A child branch sits on its parent's tip, so its angle is its own deflection plus every ancestor's: the hierarchy.
export function gusts(rng, { U = 6, intensity = 0.35, loopT = 0, n = 14, fLo = 0.03, fHi = 1.2 } = {}) {
  const parts = [];
  for (let k = 0; k < n; k++) {
    let f = fLo * (fHi / fLo) ** (k / (n - 1));
    if (loopT) f = Math.max(1, Math.round(f * loopT)) / loopT;
    parts.push({ f, a: f ** (-5 / 6), ph: rng() * 2 * Math.PI });   // amplitude ~ sqrt(S(f) df), S ~ f^-5/3 on a log grid
  }
  const norm = Math.sqrt(parts.reduce((s, p) => s + p.a * p.a / 2, 0));
  return { U, intensity, parts, norm, at(t, x = 0) { const tt = t - x / U; let s = 0; for (const p of parts) s += p.a * Math.sin(2 * Math.PI * p.f * tt + p.ph); return U * (1 + intensity * s / this.norm); } };
}

// natural frequency (Hz) of a limb of base diameter d (m) and length L (m); k calibrated so a 0.5 m, 30 m stem is 0.3 Hz
export const limbFreq = (d, L, k = 540) => k * d / (L * L);

// drag load factor for wind u: (u / U0)^(2 + B)
export const dragLoad = (u, U0 = 6, B = -0.7) => Math.sign(u) * Math.abs(u / U0) ** (2 + B);

// a damped oscillator for an angle: theta'' + 2 z w theta' + w^2 theta = w^2 * gain * load
export function oscillator(f, zeta = 0.12, gain = 1) { return { w: 2 * Math.PI * f, zeta, gain, th: 0, v: 0 }; }
export function drive(o, load, dt) {
  const n = Math.max(1, Math.ceil(dt * o.w / 0.3)), h = dt / n;
  for (let i = 0; i < n; i++) { const a = o.w * o.w * (o.gain * load - o.th) - 2 * o.zeta * o.w * o.v; o.v += a * h; o.th += o.v * h; }
  return o.th;
}
