// stack-scenes.mjs: the demo subjects for lib/stack. A night gable for the living still (warm windows against a cool
// sky, after the on-twos clips in intake batch E), rain that falls through the shutter, and a panning street for the
// shutter plate. All are built from the analytic rectangles of lib/stack/scene.mjs, in linear light.
import { frame } from '../lib/stack/frame.mjs';
import { paintRect, stripes } from '../lib/stack/scene.mjs';
import { expose } from '../lib/stack/shutter.mjs';
import { rngFrom } from '../lib/seed.mjs';

const rect = (x, y, w, h) => ({ x0: x, y0: y, x1: x + w, y1: y + h });

// The held frame. Coordinates are fractions of the frame, so one scene serves 1280 px and 3840 px.
export function gable(W, H) {
  const F = frame(W, H), u = W / 1280;
  for (let y = 0; y < H; y++) { const t = y / H; paintRect(F, rect(0, y, W, 1), [0.010 + 0.02 * t, 0.030 + 0.045 * t, 0.040 + 0.03 * t]); }
  paintRect(F, rect(0, H * 0.86, W, H * 0.14), [0.006, 0.008, 0.010]);
  const bx = W * 0.36, bw = W * 0.30, top = H * 0.40;
  for (let k = 0; k < 40; k++) { const f = k / 40, w = bw * f; paintRect(F, rect(bx + bw / 2 - w / 2, top - H * 0.20 * (1 - f), w, H * 0.20 / 40 + 1), [0.020, 0.018, 0.022]); }
  paintRect(F, rect(bx, top, bw, H * 0.46), [0.024, 0.022, 0.026]);
  for (let y = top; y < H * 0.86; y += 9 * u) paintRect(F, rect(bx, y, bw, 1.2 * u), [0.012, 0.011, 0.014]);
  for (const wx of [0.40, 0.56]) { paintRect(F, rect(W * wx, H * 0.50, W * 0.06, H * 0.13), [0.95, 0.52, 0.16]); paintRect(F, rect(W * wx + W * 0.0285, H * 0.50, W * 0.003, H * 0.13), [0.05, 0.03, 0.02]); }
  paintRect(F, rect(W * 0.49, H * 0.18, W * 0.045, H * 0.07), [0.6, 0.32, 0.1]);
  branches(F, W, H);
  return F;
}
// Bare branches as thin dark rectangles stepping up and out: an authored silhouette, seeded.
function branches(F, W, H) {
  const r = rngFrom('gable/branches'), u = W / 1280;
  for (const [x0, dir] of [[W * 0.12, 1], [W * 0.88, -1]]) {
    paintRect(F, rect(x0 - 6 * u, H * 0.25, 12 * u, H * 0.61), [0.004, 0.005, 0.006]);
    for (let b = 0; b < 14; b++) { let x = x0, y = H * (0.28 + 0.035 * b);
      for (let s = 0; s < 22; s++) { const dx = (6 + 10 * r()) * u, dy = (2 + 6 * r()) * u, t = Math.max(1, 3.5 * u * (1 - s / 26));
        for (let q = 0; q < 8; q++) paintRect(F, rect(x + dir * dx * q / 8 - t / 2, y - dy * q / 8 - t / 2, t, t), [0.004, 0.005, 0.006]);
        x += dir * dx; y -= dy; } }
  }
}

// Rain as falling drops integrated over a shutter of T seconds, drawn on the noise slot's clock (time = slot x hold /
// fps). Streak length is fall speed x T: the shutter-integral check, found in the drive-thru clip.
export function rain(W, H, { drops = 160, speed = 1.6, T = 1 / 48, hold = 2, fps = 30, seed = 'rain' } = {}) {
  const r = rngFrom(seed), base = Array.from({ length: drops }, () => [r() * W, r() * H, 0.6 + 0.4 * r()]), v = speed * H;
  return (F, slot) => {
    const t = slot * hold / fps, items = base.map(([x, y, b]) => ({ x, y: ((y + v * b * t) % (H * 1.1)) - H * 0.05, w: Math.max(1, W / 1280), h: 1, vx: 0, vy: v * b, rgb: [0.8 * b, 0.9 * b, 1.0 * b], emit: true }));
    const E = expose({ w: W, h: H, ground: [0, 0, 0], cam: { vx: 0 }, items }, 0, T, { step: 0.5 });
    for (let i = 0; i < F.px.length; i++) F.px[i] += E.px[i];
  };
}

// A panning shot: a runner the camera tracks, world-fixed fence posts, a lamp row, and a strobe on the runner.
export function panScene(W, H, T) {
  const u = W / 960, cam = { vx: 420 * u };
  const items = [
    ...stripes({ y: H * 0.20, h: H * 0.52, period: 70 * u, width: 9 * u, rgb: [0.12, 0.10, 0.09], from: -200 * u, to: W + 600 * u }),
    ...stripes({ y: H * 0.12, h: 6 * u, period: 160 * u, width: 14 * u, rgb: [0.9, 0.7, 0.35], from: -200 * u, to: W + 600 * u }).map(it => ({ ...it, emit: true })),
    { x: W * 0.40, y: H * 0.40, w: 70 * u, h: 120 * u, vx: cam.vx, rgb: [0.55, 0.16, 0.09] },
    { x: W * 0.40 + 22 * u, y: H * 0.30, w: 26 * u, h: 28 * u, vx: cam.vx, rgb: [0.62, 0.45, 0.33] },
    { x: W * 0.62, y: H * 0.48, w: 40 * u, h: 40 * u, vx: cam.vx + 1500 * u, rgb: [0.2, 0.45, 0.8] },
    { x: W * 0.62 + 12 * u, y: H * 0.48 + 12 * u, w: 16 * u, h: 16 * u, vx: cam.vx + 1500 * u, rgb: [1, 0.95, 0.85], flash: { t: T * 0.5, dur: T * 0.005, energy: 0.05 * T * 40 } },
  ];
  return { w: W, h: H, ground: [0.015, 0.016, 0.022], cam, items };
}
