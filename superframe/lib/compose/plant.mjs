// plant.mjs: the seeded scene sets the PREREG names. Every draw comes from a string-seeded stream, so a set replays
// exactly. P1: 12 vanishing-point scenes. P2 and P3: the corridor at 16 mm and its two 200 mm versions. P4: corridor
// scenes with a subject planted near the convergence and four brighter lamps away from it.
import { corridorScene, railScene, lampCentre, CORRIDOR } from './scene.mjs';
import { makeCamera } from './camera.mjs';
import { rng } from './stats.mjs';

const pick = (r, a) => a[Math.floor(r() * a.length)];
const span = (r, a, b) => a + (b - a) * r();

export function vpSet({ w = 1280, h = 720, n = 12 } = {}) {
  const out = [];
  for (let k = 0; k < n; k++) {
    const r = rng(`compose/p1/${k}`), cam = { w, h, yaw: span(r, -10, 10), pitch: span(r, -10, 10) };
    if (k % 3 === 2) out.push({ id: `rail-${k}`, make: () => railScene({ ...cam, focalMm: pick(r, [24, 35, 50]) }) });
    else { const f = [16, 24, 35, 50][k % 4]; out.push({ id: `corridor-${f}mm-${k}`, make: () => corridorScene({ ...cam, focalMm: f, pos: [0, 1.6, 0] }) }); }
  }
  return out;
}

// P2/P3: the 16 mm corridor, the same corridor at 200 mm framed from 23.8 m before its mouth (the mouth fills 70%
// of W: 200 mm x 3 m / 23.8 m = 25.2 mm of the 36 mm sensor), and 200 mm from the 16 mm position (a pure zoom).
export function lensSet({ w = 1280, h = 720 } = {}) {
  const back = 200 * (2 * CORRIDOR.hw) / (0.7 * 36);
  return [
    { id: 'corridor-16mm', make: () => corridorScene({ w, h, focalMm: 16, pos: [0, 1.6, 0] }) },
    { id: 'corridor-200mm-framed', make: () => corridorScene({ w, h, focalMm: 200, pos: [0, 1.6, CORRIDOR.z0 - back] }) },
    { id: 'corridor-200mm-zoom', make: () => corridorScene({ w, h, focalMm: 200, pos: [0, 1.6, 0] }) },
  ];
}

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const inFrame = (p, w, h, m) => p && p[0] > m * w && p[0] < (1 - m) * w && p[1] > m * w && p[1] < h - m * w;

function placeSubject(r, cam, vp) {
  for (let t = 0; t < 2000; t++) {
    const s = { x: span(r, -1.1, 1.1), z: span(r, 5, 34) }, p = cam.project([s.x, 0.875, s.z]), d = dist(p, vp) / cam.w;
    if (p[2] > 0 && d >= 0.03 && d <= 0.12 && inFrame(p, cam.w, cam.h, 0.04)) return { s, p };
  }
  return null;
}

function placeLamps(r, cam, vp, sp, S) {
  const lamps = [], centres = [];
  for (let t = 0; t < 4000 && lamps.length < 4; t++) {
    const s = pick(r, ['ceil', 'left', 'right']), L = { s, u: span(r, 2.5, 14), v: s === 'ceil' ? span(r, -1, 1) : span(r, 1.9, 2.7), du: 0.35, dv: 0.25 };
    const p = cam.project(lampCentre(L, S));
    if (p[2] <= 0 || !inFrame(p, cam.w, cam.h, 0.05) || dist(p, sp) < 0.2 * cam.w || dist(p, vp) < 0.15 * cam.w) continue;
    if (centres.some(c => dist(c, p) < 0.1 * cam.w)) continue;
    lamps.push(L); centres.push(p);
  }
  return lamps.length === 4 ? lamps : null;
}

// P4: one axis scene per seed. Returns null only if placement fails (it is reported, never silently skipped).
export function axisScene(k, { w = 1280, h = 720 } = {}) {
  const r = rng(`compose/p4/${k}`), opts = { w, h, focalMm: pick(r, [16, 20, 24, 28]), pos: [0, 1.6, 0], yaw: span(r, -8, 8), pitch: span(r, -6, 6) };
  const cam = makeCamera(opts), vp = cam.vanish([0, 0, 1]), sub = placeSubject(r, cam, vp);
  if (!sub) return null;
  const lamps = placeLamps(r, cam, vp, sub.p, { ...CORRIDOR });
  if (!lamps) return null;
  return corridorScene(opts, { subject: sub.s, lamps });
}
