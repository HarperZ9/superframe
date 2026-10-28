// envs.mjs: four environments for the gold study, as linear-RGB radiance by direction (y up), each turned into a
// smooth spectrum by the prism of lib/medium/metamers.mjs (chromaticity upsampled, scaled by its maximum) and lit by
// D65's spectral shape. The colours are authored (a convention, labelled): a clear sky over dry ground, a sunset, a
// forest canopy, a dark studio with one softbox. The key is a small D65 disc, the same in every environment.
import { reflectanceOf } from '../medium/metamers.mjs';
import { norm, dot } from './scene.mjs';

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
function skyGround(zen, hor, gnd, gHor) {
  return d => (d[1] >= 0 ? mix(hor, zen, smooth(0, 0.7, d[1])) : mix(gHor, gnd, smooth(0, -0.35, d[1])));
}
const canopy = d => {
  if (d[1] < 0) return mix([0.09, 0.07, 0.035], [0.05, 0.04, 0.02], smooth(0, -0.4, d[1]));
  const gap = 0.5 + 0.5 * Math.sin(9 * d[0] + 3 * Math.sin(5 * d[2])) * Math.sin(7 * d[2] + 2 * d[1]);
  return mix([0.05, 0.16, 0.035], [0.22, 0.4, 0.12], smooth(0.55, 0.95, gap) * smooth(0.1, 0.8, d[1]));
};
const studio = d => {
  const box = Math.abs(Math.atan2(d[0], d[2]) - 1.05) < 0.32 && d[1] > 0.25 && d[1] < 0.75;
  return box ? [2.2, 2.2, 2.2] : d[1] < 0 ? [0.045, 0.045, 0.045] : [0.03, 0.03, 0.03];
};

export const ENVS = {
  sky: skyGround([0.08, 0.2, 0.62], [0.5, 0.62, 0.82], [0.1, 0.08, 0.05], [0.2, 0.17, 0.12]),
  sunset: skyGround([0.18, 0.07, 0.24], [1.0, 0.42, 0.1], [0.05, 0.025, 0.04], [0.16, 0.07, 0.05]),
  foliage: canopy,
  studio,
};
export const KEY = { dir: norm([-0.55, 0.62, 0.56]), radius: 2.5 * Math.PI / 180, E: 3 };
KEY.Le = KEY.E / (Math.PI * Math.sin(KEY.radius) ** 2);
export const inKey = r => dot(r, KEY.dir) > Math.cos(KEY.radius);

// the environment's spectrum along a direction, as s x R(lambda), to be read under D65 (s = brightest channel)
export function envSpectrum(env, d) {
  const c = ENVS[env](d), s = Math.max(c[0], c[1], c[2], 1e-6), R = reflectanceOf(c.map(v => v / s));
  return { s, R, rgb: c };
}

// fixed directions on the sphere (Fibonacci lattice) for the irradiance integral
export const FIB = n => Array.from({ length: n }, (_, i) => { const y = 1 - 2 * (i + 0.5) / n, r = Math.sqrt(1 - y * y), a = i * 2.399963229728653; return [r * Math.cos(a), y, r * Math.sin(a)]; });
