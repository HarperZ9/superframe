// plant.mjs: the planted-answer fixtures the tests, the measurement tool and the demo share. Each fixture has its
// answer in closed form: a bar at v px/s under a T s shutter streaks v x T px; a flash of fraction f of the shutter on
// a marker that crosses 64 px per shutter grows by 64 f px; an echo planted at lag k with a known tint.
import { expose, rowProfile, fwhm, streakFromMoments } from './shutter.mjs';
import { sharpAt } from './scene.mjs';
import { spriteSeq, delays, echoFrame, recoverTint, lagCorrelation } from './echo.mjs';
import { to8, from8 } from './frame.mjs';

export const bar = (vx, x = 60.3, w = 4) => ({ x, y: 2, w, h: 4, vx, rgb: [1, 1, 1], emit: true });
export const lineScene = (items, cam = { vx: 0 }, w = 420) => ({ w, h: 8, ground: [0, 0, 0], cam, items });

// Both estimators, each against the sharp frame at mid-shutter (the same sub-pixel phase as the streak's centre), in
// output pixels; ss > 1 retakes the measurement on a finer grid (see flashGrowth).
export function streakOf(sc, T, { ss = 1 } = {}) {
  const S0 = ss > 1 ? scaleScene(sc, ss) : sc, it = S0.items[0], y0 = Math.floor(it.y), y1 = Math.ceil(it.y + it.h);
  const B = rowProfile(expose(S0, 0, T), y0, y1), S = rowProfile(sharpAt(S0, T / 2), y0, y1);
  return { fwhm: fwhm(B) / ss, moments: streakFromMoments(B, S) / ss };
}

export const flashScene = (frac, T, L = 64) => lineScene([{ x: 120.4, y: 2, w: 2, h: 4, vx: L / T, rgb: [1, 0.9, 0.6], flash: { t: T / 2, dur: frac * T, energy: 0.02 } }]);
// A scene scaled by s in space (velocities too), so a measurement can be taken on a finer pixel grid.
export function scaleScene(sc, s) {
  return { ...sc, w: sc.w * s, h: sc.h * s, cam: { vx: (sc.cam?.vx ?? 0) * s, vy: (sc.cam?.vy ?? 0) * s },
    items: sc.items.map(it => ({ ...it, x: it.x * s, y: it.y * s, w: it.w * s, h: it.h * s, vx: (it.vx ?? 0) * s, vy: (it.vy ?? 0) * s })) };
}
// Growth of the flash mark over the marker's own width, against the marker drawn sharp at the window's middle, in
// output pixels. With ss > 1 the measurement is retaken on an ss-times finer grid, which lowers the floor set by
// pixel phase (a box's sampled variance depends on where it sits inside a pixel).
export function flashGrowth(F, sc, { ss = 1, render = null } = {}) {
  if (ss > 1) { const S = scaleScene(sc, ss); return flashGrowth(render(S), S) / ss; }
  const f = sc.items[0].flash, ref = sharpAt({ ...sc, items: [{ ...sc.items[0], flash: { ...f, t: f.t + f.dur / 2 } }] }, 0, { flashes: true });
  const y0 = Math.floor(sc.items[0].y), y1 = Math.ceil(sc.items[0].y + sc.items[0].h);
  return streakFromMoments(rowProfile(F, y0, y1), rowProfile(ref, y0, y1));
}

export const ROWS = ['..1111..', '.122221.', '12233221', '12344321', '12344321', '12233221', '.122221.', '..1111..'].map(r => [...r].map(c => (c === '.' ? 0 : +c)));
export const PAL = [null, [0.9, 0.9, 0.9], [0.6, 0.5, 0.4], [0.3, 0.35, 0.5], [1, 0.95, 0.7]];
export const PLANTED = [[3, [0.9, 0.3, 0.2]], [5, [0.2, 0.7, 0.95]], [8, [0.55, 0.85, 0.35]]];
export const ECHO = { W: 160, H: 96, ground: { w: 160, h: 96, rgb: [0.04, 0.04, 0.06] }, frames: Array.from({ length: 40 }, (_, i) => 20 + i), opacity: 0.8 };
export const echoSeq = spriteSeq({ w: ECHO.W, h: ECHO.H, rows: ROWS, palette: PAL, path: n => [80 + 60 * Math.sin(n * 0.21), 48 + 30 * Math.sin(n * 0.33 + 1)] });

// Render a planted echo to 8-bit frames, then read it back: the lag correlation, its peak and the tint error in /255.
export function echoRun(k, tint, jitter = 0, { seq = echoSeq, ns = ECHO.frames, ground = ECHO.ground, opacity = ECHO.opacity } = {}) {
  const d = jitter ? delays(k, ns[ns.length - 1] + 1, { jitter }) : null;
  const outs = ns.map(n => from8(to8(echoFrame(seq, n, { ground, copies: [{ k, tint, opacity, delay: d }] }))));
  const xc = lagCorrelation(outs, seq, ns, { ground }), rec = recoverTint(outs, seq, ns, { k, opacity, ground });
  const err = rec.tint ? Math.max(...rec.tint.map((v, c) => Math.abs(v - tint[c]))) * 255 : Infinity;
  return { xc, peak: xc.indexOf(Math.max(...xc)), err, rec };
}
