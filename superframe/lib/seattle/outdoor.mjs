// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// outdoor.mjs: what the porch and tree scenes share: a pinhole camera, a point lamp with a cobra-head cutoff, the
// night eye's colour loss, a twilight sky, the moon and its cloud corona, and a drifting cloud cover.
//
// Light units are illuminance-like (about lux) for E and radiance = E rho / pi for a matte surface. Values are of the
// right order (full moon about 0.25 lx; a 150 W HPS cobra head peaks near 5000 to 8000 cd; from memory) but the scenes
// are not photometric renders.
import { lightRGB, moonSPD, planckSPD } from './spd.mjs';
import { LAMBDA, toXYZ, toLinearRGB } from '../medium/spectral.mjs';

// ---- camera: x right, y up, z forward; f in pixels; pitch tilts the view up (radians)
export function camera(W, H, { f = 300, height = 1.5, pitch = 0 } = {}) { return { W, H, f, height, pitch, cp: Math.cos(pitch), sp: Math.sin(pitch) }; }
export function proj(C, x, y, z) {
  const yy = y - C.height, zc = z * C.cp + yy * C.sp, yc = yy * C.cp - z * C.sp;
  return zc <= 0.05 ? null : [C.W / 2 + C.f * x / zc, C.H / 2 - C.f * yc / zc, zc];
}
// the eye ray through a pixel, in world space (unnormalised)
export function ray(C, X, Y) {
  const dx = (X - C.W / 2) / C.f, dy = (C.H / 2 - Y) / C.f;
  return [dx, dy * C.cp + C.sp, C.cp - dy * C.sp];
}
// where that ray meets the ground (y = 0), or null above the horizon
export function ground(C, X, Y) { const d = ray(C, X, Y); if (d[1] >= -1e-4) return null; const t = -C.height / d[1]; return [d[0] * t, 0, d[2] * t, t]; }

// ---- a street lamp: intensity I0 (cd) below the head, cut off above about 75 degrees from straight down
export function lampE(lamp, p, n = [0, 1, 0]) {
  const dx = p[0] - lamp.x, dy = p[1] - lamp.y, dz = p[2] - lamp.z, d2 = dx * dx + dy * dy + dz * dz, d = Math.sqrt(d2);
  const cosNadir = -dy / d, I = lamp.I * Math.max(0, Math.min(1, (cosNadir - 0.2) / 0.3));
  const cosS = Math.max(0, -(dx * n[0] + dy * n[1] + dz * n[2]) / d);
  return I * cosS / d2;
}

// ---- the night eye. Below about 3 cd/m2 rods join the cones (mesopic), below about 0.01 they dominate (scotopic):
// colour drains and the hue shifts toward blue (the Purkinje shift). A blend toward a pale blue-grey of the scotopic
// luminance, weighted by log luminance between those limits. The rod weights in linear sRGB and the tint are an
// approximate fit, not CIE V'(lambda) itself; the effect is real, the exact numbers are authored.
const ROD = [0.04, 0.5, 0.46], TINT = [0.62, 0.78, 1.0];
export function nightEye(F, { scale = 1, lo = 0.003, hi = 1 } = {}) {
  for (let i = 0; i < F.w * F.h; i++) {
    const j = 3 * i, r = F.d[j], g = F.d[j + 1], b = F.d[j + 2], L = (0.2126 * r + 0.7152 * g + 0.0722 * b) * scale;
    const m = Math.max(0, Math.min(1, Math.log(hi / Math.max(L, 1e-9)) / Math.log(hi / lo))) * 0.85;
    if (m <= 0) continue;
    const S = ROD[0] * r + ROD[1] * g + ROD[2] * b;
    for (let c = 0; c < 3; c++) F.d[j + c] = F.d[j + c] * (1 - m) + S * TINT[c] * m;
  }
  return F;
}

// ---- twilight sky. Sunlight scattered by air (Rayleigh, ~ lambda^-4) after a long, reddening path; at civil twilight
// the zenith is held blue mainly by ozone's Chappuis band absorbing the orange and red (Hulburt 1953). Chappuis
// cross-section shape (peak near 600 nm) and the path factors are from memory, moderate confidence.
const chappuis = l => Math.exp(-0.5 * ((l - 600) / 55) ** 2) * 0.8 + Math.exp(-0.5 * ((l - 560) / 40) ** 2) * 0.3;
export function twilightRGB(elev, sunDepth = 4) {
  const S = LAMBDA.map(l => {
    const sun = planckSPD(5772)[Math.round(l) - 380], ray = (550 / l) ** 4, path = 6 + 30 * Math.exp(-elev * 4);
    return sun * ray * Math.exp(-0.012 * path * ray * (1 + sunDepth / 6)) * Math.exp(-(0.6 + 0.5 * sunDepth / 4) * chappuis(l));
  });
  const XYZ = toXYZ(new Array(16).fill(1), S.map(v => v * 100)), n = S.reduce((a, b) => a + b, 0) / 16;
  return toLinearRGB(XYZ.map(v => v * n * 4), 'D65').map(v => Math.max(0, v));
}

// ---- moonlight: colour of moonlight (about 4100 K) and the corona that thin cloud of small water droplets diffracts
// around the moon: rings at angular radius ~ k lambda / d (first bright ring near 1.6 lambda / d for droplets of
// diameter d; Airy pattern of a disc obstacle by Babinet). Red rings sit outside blue ones.
export const moonRGB = (k = 1) => lightRGB(moonSPD(), { adapt: 0.5 }).map(v => v * k);
export function corona(theta, d = 20e-6) {
  return [610e-9, 550e-9, 465e-9].map(l => { const x = Math.PI * d * theta / l; const j = x < 1e-6 ? 0.5 : besselJ1(x) / x; return 4 * j * j; });
}
function besselJ1(x) { let s = 0; for (let k = 0; k < 12; k++) s += ((-1) ** k) * (x / 2) ** (2 * k + 1) / (fact(k) * fact(k + 1)); return Math.abs(x) > 12 ? Math.sqrt(2 / (Math.PI * x)) * Math.cos(x - 3 * Math.PI / 4) : s; }
const fact = n => (n <= 1 ? 1 : n * fact(n - 1));

// ---- clouds: transmission of the cloud deck toward a direction at time t. Value noise in four octaves, domain-warped,
// drifting with the wind aloft; for loops the drift is one whole noise period per loop, so the sky closes exactly.
const hash2 = (i, j) => { let h = Math.imul(i, 374761393) + Math.imul(j, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function vnoise(x, y, period) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const w = i => (period ? ((i % period) + period) % period : i);
  const a = hash2(w(xi), yi), b = hash2(w(xi + 1), yi), c = hash2(w(xi), yi + 1), d = hash2(w(xi + 1), yi + 1);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}
export function cloudCover(u, v, t, { cover = 0.55, loopT = 0, scale = 6 } = {}) {
  const P = 16, drift = loopT ? (t / loopT) * P : t * 0.08;
  let x = u * scale + drift, y = v * scale * 1.6, n = 0, amp = 0.5, per = P;
  const wx = vnoise(x * 0.5 + 3.1, y * 0.5, P / 2) - 0.5;
  x += wx * 1.5;
  for (let o = 0; o < 4; o++) { n += amp * vnoise(x, y, per); x *= 2; y *= 2; per *= 2; amp *= 0.5; }
  return Math.max(0.05, Math.min(1, 0.5 + 2.2 * (n / 0.94 - (1 - cover))));
}
export const incandescentRGB = (K = 2800, k = 1) => lightRGB(planckSPD(K), { adapt: 0.4 }).map(v => v * k);

// ---- light scattered toward the eye by the rain or snow in the air: single scattering along each eye ray,
//   L = integral of sigma E(p) p(theta) / (4 pi) ds,
// with sigma the scattering coefficient (rain of a few mm/h: about 1e-3 per metre from 2 pi r^2 N for millimetre
// drops at Marshall-Palmer counts; snow is denser to light) and a forward-peaked phase p (a Henyey-Greenstein form
// with g = 0.75 stands in for drops and flakes, whose real phase functions are strongly forward). Twelve samples a
// ray. This is the cone of light under a lamp in rain, and the glow around the lamp head.
const hg = (cos, g = 0.75) => (1 - g * g) / Math.pow(1 + g * g - 2 * g * cos, 1.5);
export function haze(F, C, lamp, rgb, { sigma = 1e-3, near = 2, far = 45, n = 12, occluded = null } = {}) {
  for (let Y = 0; Y < C.H; Y++) for (let X = 0; X < C.W; X++) {
    const d = ray(C, X + 0.5, Y + 0.5), dn = Math.hypot(...d), u = d.map(v => v / dn);
    let L = 0;
    for (let k = 0; k < n; k++) {
      const s = near * (far / near) ** ((k + 0.5) / n), ds = s * Math.log(far / near) / n, p = [u[0] * s, C.height + u[1] * s, u[2] * s];
      if (p[1] < 0) break;
      const lx = p[0] - lamp.x, ly = p[1] - lamp.y, lz = p[2] - lamp.z, ll = Math.hypot(lx, ly, lz);
      const cosT = -(lx * u[0] + ly * u[1] + lz * u[2]) / ll;
      L += sigma * lampE(lamp, p, [-lx / ll, -ly / ll, -lz / ll]) * hg(-cosT) / (4 * Math.PI) * ds;
    }
    if (L > 0 && !(occluded && occluded(X, Y))) { const j = 3 * (Y * C.W + X); F.d[j] += rgb[0] * L; F.d[j + 1] += rgb[1] * L; F.d[j + 2] += rgb[2] * L; }
  }
  return F;
}
