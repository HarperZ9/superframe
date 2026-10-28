// goldscene.mjs: one sphere in an environment, rendered spectrally (16 bands) and shown as linear RGB.
//   'gold':   no diffuse term. Radiance = F_gold(lambda, angle) x (environment or key along the mirror direction).
//   'yellow': the control. Lambert with a yellow albedo spectrum under the same key and the same environment's
//             irradiance (integrated over 1024 fixed directions on a 48 x 24 grid of normals).
//   'dielectric': a clear-coated black (n = 1.5): reflection with no tint, a second control for the hue test.
// The ceiling C = (E_key + largest environment irradiance) / pi goes to the value-budget tone curve.
import { toXYZ, toLinearRGB, BANDS } from '../medium/spectral.mjs';
import { reflectanceOf } from '../medium/metamers.mjs';
import { add, mul, dot, norm, reflect, hitSphere, cameraRay } from './scene.mjs';
import { goldAt, dielectricF } from './gold.mjs';
import { ENVS, KEY, inKey, envSpectrum, FIB } from './envs.mjs';
import { srgbToLab, enc } from '../study/cmath.mjs';

export const YELLOW = '#e3b324';
const CAM = { eye: [0, 0, 3.6], at: [0, 0, 0], fov: 40 };
const DIRS = FIB(1024), GW = 48, GH = 24, GRIDS = new Map();
const lin = h => [1, 3, 5].map(i => { const c = parseInt(h.slice(i, i + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
const ALBEDO = reflectanceOf(lin(YELLOW));
const gridNormal = (i, j) => { const th = Math.PI * (j + 0.5) / GH, ph = 2 * Math.PI * (i + 0.5) / GW; return [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)]; };

// environment irradiance per normal, in units of D65's shape (a spectrum to be read under D65)
export function irradianceGrid(env) {
  if (GRIDS.has(env)) return GRIDS.get(env);
  const S = DIRS.map(d => envSpectrum(env, d)), grid = [];
  let Ymax = 0;
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
    const n = gridNormal(i, j), E = new Array(BANDS).fill(0);
    DIRS.forEach((d, k) => { const c = dot(n, d); if (c > 0) for (let b = 0; b < BANDS; b++) E[b] += S[k].s * S[k].R[b] * c * 4 * Math.PI / DIRS.length; });
    grid.push(E); Ymax = Math.max(Ymax, toXYZ(E)[1]);
  }
  const out = { grid, Ymax }; GRIDS.set(env, out); return out;
}
function irradianceAt(G, n) {
  const th = Math.acos(Math.max(-1, Math.min(1, n[1]))), ph = (Math.atan2(n[2], n[0]) + 2 * Math.PI) % (2 * Math.PI);
  const j = Math.min(GH - 1, Math.floor(th / Math.PI * GH)), i = Math.min(GW - 1, Math.floor(ph / (2 * Math.PI) * GW));
  return G.grid[j * GW + i];
}
export const ceilingOf = env => (KEY.E + irradianceGrid(env).Ymax) / Math.PI;

// one camera sample on the sphere: spectral radiance (16 bands, D65 units) and the environment's colour seen by
// the mirror ray (for the hue-follow measure)
function shadeSample(env, mat, p, d) {
  const n = norm(p), v = mul(d, -1), c = dot(n, v), r = reflect(d, n);
  if (mat === 'yellow') {
    const G = irradianceGrid(env), E = irradianceAt(G, n), k = KEY.E * Math.max(0, dot(n, KEY.dir));
    return { P: ALBEDO.map((a, b) => a / Math.PI * (k + E[b])), seen: ENVS[env](r) };
  }
  const F = mat === 'gold' ? goldAt(c) : dielectricF(c), e = envSpectrum(env, r);
  const P = inKey(r) ? F.map(f => f * KEY.Le) : F.map((f, b) => f * e.s * e.R[b]);
  return { P, seen: e.rgb };
}

export function renderSphere(env, mat, { w = 256, h = 256, ss = 2 } = {}) {
  const N = w * h, rgb = new Float64Array(3 * N), mask = new Uint8Array(N), seenLab = [0, 0, 0], tot = { n: 0 };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const acc = [0, 0, 0]; let hits = 0;
    for (let j = 0; j < ss; j++) for (let i = 0; i < ss; i++) {
      const ray = cameraRay(CAM, w, h, x + (i + 0.5) / ss, y + (j + 0.5) / ss), t = hitSphere(ray.o, ray.d, [0, 0, 0], 1);
      let L;
      if (t === Infinity) L = ENVS[env](ray.d);
      else {
        const s = shadeSample(env, mat, add(ray.o, mul(ray.d, t)), ray.d); L = toLinearRGB(toXYZ(s.P)); hits++;
        const m = Math.max(...s.seen, 1e-6), lab = srgbToLab(s.seen.map(v => enc(Math.min(1, v / m))));
        seenLab[1] += lab[1]; seenLab[2] += lab[2]; tot.n++;
      }
      for (let c = 0; c < 3; c++) acc[c] += Math.max(0, L[c]);
    }
    const k = 3 * (y * w + x); for (let c = 0; c < 3; c++) rgb[k + c] = acc[c] / (ss * ss);
    mask[y * w + x] = hits * 2 >= ss * ss ? 1 : 0;
  }
  const dif = mat === 'yellow' ? rgb : new Float64Array(3 * N);
  return { w, h, rgb, dif, mask, env, mat, C: ceilingOf(env), seenAB: [seenLab[1] / tot.n, seenLab[2] / tot.n] };
}

