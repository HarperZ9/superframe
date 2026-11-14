// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// carscene.mjs: the memory. A child lies curled on the back seat at night, face about 25 cm from the rear side window,
// eyes focused on the raindrops, squinting. Everything in this frame is a consequence of that position:
// - the view: a 30 degree patch of glass centred 50 degrees up. Lying on the seat the eye is about 0.35 m below the window sill and
//   0.25 to 0.3 m in from the glass, so the lowest elevation it can see out of the window is about 45 degrees: sky,
//   lamp heads, wires, tree crowns and tall buildings pass across it, and the road never does;
// - focus on the glass: the street beyond is defocused into discs (bokeh.mjs) about two degrees across;
// - each drop is in focus and shows the street inverted and shrunk (droplens.mjs), sampled from a wide map of the world;
// - the squint: lid edges and lashes throw streaks from every bright disc (lash.mjs);
// - the squigglies: floaters drift over the bright areas (floaters.mjs);
// - the car interior around the glass is lit only by the lamps it passes, inverse square, so it pulses.
import { frame, clone, boxBlur } from './raster.mjs';
import { renderWorld, interiorLight } from './carworld.mjs';
import { carLights } from './lights.mjs';
import { createGlass, seed as seedGlass, step as stepGlass } from './drops.mjs';
import { exitRay, waterIndex } from './droplens.mjs';
import { blurAngle, defocus } from './bokeh.mjs';
import { arms, streaks } from './lash.mjs';
import { createFloaters, stepFloaters, applyFloaters } from './floaters.mjs';
import { sample } from './raster.mjs';
import { rngFrom } from '../seed.mjs';
import { aperture as windowMask } from './carframe.mjs';

const DEG = Math.PI / 180;
export const CAR = { fov: 30 * DEG, el0: 50 * DEG, glassEl: 20 * DEG, glassDist: 0.25, pupil: 6.5e-3, objDist: 15 };
const N_RGB = [610, 550, 465].map(waterIndex);

// route: what the road is at each point (street or freeway), whether it is lit, how dense the city light is (0 dark,
// 1 downtown), the overpasses, and the car's speed in time. The loop is a freeway stretch whose world repeats exactly
// every T seconds; the drive is the memory's arc out of the city and into the dark.
export function route({ loop = true, T = 12, duration = 48 }) {
  if (loop) {
    const U = 22, P = U * T;
    return { period: P, speed: () => U, road: () => 'freeway', lit: () => true, overpasses: [0.7 * P, 1.7 * P, -0.3 * P],
      density: s => 0.5 + 0.4 * Math.cos(2 * Math.PI * s / P) };
  }
  // downtown street, a red light, the on-ramp, the lit freeway, then the unlit stretch
  const speed = t => (t < 9 ? 8 : t < 12 ? 8 * (12 - t) / 3 : t < 17 ? 0 : t < 24 ? 22 * (t - 17) / 7 : 22);
  return { period: 0, speed, road: s => (s < 125 ? 'street' : 'freeway'), lit: s => s < 560, overpasses: [400],
    density: s => Math.max(0.03, Math.min(1, 1 - Math.max(0, s - 160) / 380)), duration };
}

export function createCar({ W = 320, H = 180, variant = 'sodium', seed = 'seattle-car', loop = true, T = 12 } = {}) {
  const rng = rngFrom(seed), ppr = W / CAR.fov, pxmm = ppr * 1e-3 / CAR.glassDist;
  const glass = createGlass(W / pxmm, H / pxmm, rngFrom(seed + ':glass'));
  seedGlass(glass, 900, 2.5);
  const S = {
    W, H, T, rng, ppr, pxmm, glass, L: carLights(variant), R: route({ loop, T }), t: 0, pos: 0,
    bokehPx: blurAngle(CAR.pupil, CAR.glassDist, CAR.objDist) * ppr, mask: windowMask(W, H),
    floaters: createFloaters(rngFrom(seed + ':float'), W, H), gaze: [W / 2, H / 2], nextSaccade: 0.8, open: 0.5, exposure: 2.4,
    arms: arms({ rng: rngFrom(seed + ':lash') }),
  };
  for (let k = 0; k < 240; k++) stepCar(S, 1 / 12, true);   // 20 s of rain before the first frame
  S.t = 0; S.pos = 0;
  return S;
}

export function stepCar(S, dt, warm = false) {
  const U = S.R.speed(S.t), w = 2 * Math.PI / S.T;
  S.t += dt; S.pos += U * dt;
  stepGlass(S.glass, dt, { U, R: sheltered(S) ? 0 : 3.5 + 2.5 * Math.sin(w * S.t) ** 2, cross: 0.6 });
  // squint: lids half closed, breathing in and out of focus (periods divide the loop)
  S.open = 0.4 + 0.16 * Math.sin(w * S.t) + 0.07 * Math.sin(3 * w * S.t + 1);
  if (S.t >= S.nextSaccade) { S.gaze = [S.W * (0.3 + 0.4 * S.rng()), S.H * (0.3 + 0.4 * S.rng())]; S.nextSaccade = S.t + 1 + 2 * S.rng(); }
  stepFloaters(S.floaters, dt, S.gaze);
  if (!warm) S.light = interiorLight(stateOf(S));
  return S;
}
const stateOf = S => ({ pos: S.pos, t: S.t, period: S.R.period, density: S.R.density, road: S.R.road, lit: S.R.lit, overpasses: S.R.overpasses });
// rain shadow: under an overpass no rain reaches the glass
const sheltered = S => S.R.overpasses.some(o => { const d = S.R.period ? ((S.pos - o) % S.R.period + S.R.period) % S.R.period : S.pos - o; return d > -2 && d < 20; });

export function renderCar(S) {
  const { W, H, ppr, L } = S, m = Math.ceil(S.bokehPx / 2) + 2, st = stateOf(S);
  const wide = renderWorld({ w: W + 2 * m, h: H + 2 * m, ppr, el0: CAR.el0 }, st, L);
  const blurred = defocus(wide, S.bokehPx, S.open, { split: 0.3 });
  // the drops' map: 150 px/rad covers +-61 degrees; a small box prefilter keeps a lamp's energy when a drop shrinks it
  // below a pixel, so it shows as a glint of the right brightness instead of flickering in and out
  const map = Object.assign(boxBlur(renderWorld({ w: 320, h: 320, ppr: 150, el0: CAR.el0 }, st, L), 2, 2), { ppr: 150 });
  const F = frame(W, H), E = 0.6 + 140 * (S.light ?? interiorLight(st));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, j = 3 * ((y + m) * (W + 2 * m) + x + m), k = S.mask[i];
    const c = k === 1 ? [blurred.d[j], blurred.d[j + 1], blurred.d[j + 2]] : k === 2 ? [0.0006, 0.0006, 0.0006] : interior(L, E, x, y, W, H, k);
    F.d.set(c, 3 * i);
  }
  drawDrops(F, S, map);
  const A = S.arms.map(a => (a.s > 1e-3 ? { ...a, s: Math.max(0.6e-3, S.open * CAR.pupil), share: 1 - S.open } : a));
  streaks(F, 1 / ppr, A, { threshold: 1.2, floor: 0.003, gain: 1.6 });
  applyFloaters(F, S.floaters, { contrast: 0.12 + 0.18 * (1 - S.open) });
  adapt(S, F);
  return F;
}

// the eye adapts to the mean light in the window over a few seconds (time constant 3 s; target and limits authored)
function adapt(S, F) {
  let s = 0, n = 0;
  for (let i = 0; i < S.mask.length; i += 7) if (S.mask[i] === 1) { s += Math.min(1, 0.2126 * F.d[3 * i] + 0.7152 * F.d[3 * i + 1] + 0.0722 * F.d[3 * i + 2]); n++; }
  const target = Math.max(1.2, Math.min(9, 0.014 / Math.max(1e-4, s / n)));
  S.exposure += (target - S.exposure) * Math.min(1, (1 / 12) / 3);
}

function interior(L, E, x, y, W, H, k) {
  // headliner above, vinyl pillar at the left; a soft falloff away from the glass edge
  const f = E * (0.006 + 0.004 * (1 - y / H));
  // the latch plate is polished steel: a specular glint of the lamp overhead, proportional to the light on the car
  const c = k === 5 ? L.headliner(f * (1.5 + 0.6 * ((x + y) % 3 === 0))) : k === 4 ? L.vinyl(f * 0.45) : k === 3 ? L.vinyl(f * 0.8) : L.headliner(f);
  return c.map(v => v + 0.0004);
}

// eye-ray direction in glass coordinates for a screen pixel (u right, v up, w out of the glass)
function glassDir(S, x, y) {
  const az = (x - S.W / 2) / S.ppr, el = CAR.el0 + (S.H / 2 - y) / S.ppr, g = CAR.glassEl;
  const X = Math.sin(az) * Math.cos(el), Y = Math.sin(el), Z = Math.cos(az) * Math.cos(el);
  return [X, Y * Math.cos(g) - Z * Math.sin(g), Y * Math.sin(g) + Z * Math.cos(g)];
}
function toMap(T, M) {
  const g = CAR.glassEl, Y = T[1] * Math.cos(g) + T[2] * Math.sin(g), Z = -T[1] * Math.sin(g) + T[2] * Math.cos(g);
  const az = Math.atan2(T[0], Z), el = Math.asin(Math.max(-1, Math.min(1, Y)));
  return [M.w / 2 + az * M.ppr, M.h / 2 - (el - CAR.el0) * M.ppr];
}

function drawDrops(F, S, M) {
  const { pxmm } = S, th = S.glass.p.theta, shade = [0.0005, 0.0005, 0.0006];
  for (const d of S.glass.drops) {
    const cx = d.x * pxmm, cy = d.y * pxmm, r = d.a * pxmm;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if (x < 0 || y < 0 || x >= S.W || y >= S.H || S.mask[y * S.W + x] !== 1) continue;
      const acc = [0, 0, 0]; let cov = 0;
      for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++) {
        const px = x + 0.25 + 0.5 * sx, py = y + 0.25 + 0.5 * sy, u = (px - cx) / pxmm, v = -(py - cy) / pxmm;
        if (u * u + v * v > d.a * d.a) continue;
        cov++; const dir = glassDir(S, px, py);
        for (let c = 0; c < 3; c++) {
          const out = exitRay(u, v, d.a, th, N_RGB[c], dir);
          if (!out) { acc[c] += shade[c]; continue; }
          const [mx, my] = toMap(out.T, M); acc[c] += sample(M, mx, my)[c] * out.trans + shade[c] * (1 - out.trans);
        }
      }
      if (!cov) continue;
      const i = 3 * (y * S.W + x), a = cov / 4;
      for (let c = 0; c < 3; c++) F.d[i + c] = F.d[i + c] * (1 - a) + (acc[c] / cov) * a;
    }
  }
}
export { clone };
