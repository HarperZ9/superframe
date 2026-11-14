// seattle-optics.test.mjs: the eye-and-glass optics of the back-seat scene (lib/seattle droplens, bokeh, lash,
// floaters).
// Accept: a drop is a plano-convex lens of focal length R / (n - 1) and inverts; total internal reflection starts at
// sin(alpha) = 1 / n; the cap volume formula integrates; water beads slide at a few millimetres; raindrop speeds match
// Gunn and Kinzer; defocus keeps energy; a squint flattens the blur disc; streaks fall as 1 / theta^2 and reach
// further in red; floaters show only against light.
// Controls: the centre ray is undeviated; a black frame stays black under floaters; with no arms nothing streaks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cap, exitRay, slideRadius, rainSpeed, marshallPalmer, waterIndex } from '../lib/seattle/droplens.mjs';
import { blurAngle, aperture, defocus } from '../lib/seattle/bokeh.mjs';
import { armFalloff, streaks, arms } from '../lib/seattle/lash.mjs';
import { createFloaters, stepFloaters, applyFloaters } from '../lib/seattle/floaters.mjs';
import { frame, fill } from '../lib/seattle/raster.mjs';
import { rngFrom } from '../lib/seed.mjs';

const DEG = Math.PI / 180, n = waterIndex(550), th = 50 * DEG;
const sum = F => F.d.reduce((a, b) => a + b, 0);

test('a drop is a thin plano-convex lens that inverts, and the centre ray goes straight', () => {
  const a = 1, { R } = cap(a, th), c = exitRay(0, 0, a, th, n);
  assert.ok(Math.abs(c.T[0]) < 1e-12 && Math.abs(c.T[2] - 1) < 1e-12);
  const u = 0.02, o = exitRay(u, 0, a, th, n), dev = Math.atan2(o.T[0], o.T[2]), paraxial = -(n - 1) * u / R;
  assert.ok(dev < 0, 'a ray above the axis leaves below it: the image is inverted');
  assert.ok(Math.abs(dev / paraxial - 1) < 0.02, `${dev} vs ${paraxial}`);
});

test('total internal reflection begins where sin(alpha) = 1 / n', () => {
  const a = 1, { R } = cap(a, th), r0 = R / n;
  assert.ok(exitRay(r0 * 0.99, 0, a, th, n) !== null);
  assert.equal(exitRay(Math.min(a, r0 * 1.01), 0, a, th, n), null);
});

test('cap volume matches a numerical integral', () => {
  const a = 2, { R, h, V } = cap(a, th);
  let s = 0; const N = 4000;
  for (let i = 0; i < N; i++) { const z = (i + 0.5) / N * h, r2 = R * R - (z + R - h) ** 2; s += Math.PI * r2 * h / N; }
  assert.ok(Math.abs(s / V - 1) < 1e-3);
});

test('water on glass starts to slide at a base radius of a few millimetres', () => {
  const r = slideRadius({ theta: th, thetaR: 40 * DEG, thetaA: 58 * DEG, tilt: 70 * DEG });
  assert.ok(r > 1.5e-3 && r < 3.5e-3, `${r * 1e3} mm`);
});

test('raindrop fall speeds and the Marshall-Palmer spectrum', () => {
  assert.ok(Math.abs(rainSpeed(2) - 6.49) < 0.3);   // Gunn and Kinzer 1949: 6.49 m/s at 2 mm
  assert.ok(Math.abs(rainSpeed(1) - 4.03) < 0.3);
  const mp = marshallPalmer(1), rng = rngFrom('mp'); let m = 0; for (let i = 0; i < 20000; i++) m += mp.draw(rng);
  assert.ok(Math.abs(m / 20000 - 1 / mp.L) < 0.02 / mp.L * 10);
});

test('defocus: blur angle, unit-sum aperture, squint, and energy kept', () => {
  assert.ok(Math.abs(blurAngle(7e-3, 0.2, Infinity) - 0.035) < 1e-9);
  const A = aperture(15, 1), S = aperture(15, 0.3);
  assert.ok(Math.abs(A.k.reduce((p, q) => p + q, 0) - 1) < 1e-6);
  const rows = K => { let r = 0; for (let y = 0; y < K.n; y++) if (K.k.slice(y * K.n, (y + 1) * K.n).some(v => v > 0)) r++; return r; };
  assert.ok(rows(S) < rows(A) * 0.45, 'a squint flattens the disc');
  const F = frame(60, 60); F.d.set([50, 40, 30], 3 * (30 * 60 + 30)); for (let i = 0; i < 60 * 60; i++) F.d[3 * i + 1] += 0.01;
  const G = defocus(F, 15, 0.5);
  assert.ok(Math.abs(sum(G) / sum(F) - 1) < 0.02);
});

test('squint streaks: 1 / theta^2, wider in red, and nothing without arms (control)', () => {
  const r = armFalloff(550e-9, 2e-3, 0.02, 1e-3) / armFalloff(550e-9, 2e-3, 0.04, 1e-3);
  assert.ok(Math.abs(r - 4) < 1e-9);
  assert.ok(armFalloff(610e-9, 2e-3, 0.02, 1e-3) > armFalloff(465e-9, 2e-3, 0.02, 1e-3));
  const F = frame(81, 81); F.d.set([500, 500, 500], 3 * (40 * 81 + 40));
  const G = { w: 81, h: 81, d: F.d.slice() };
  streaks(F, 1e-3, arms({ rng: rngFrom('l'), lashes: 0 }));
  const at = (x, y) => F.d[3 * (y * 81 + x) + 1];
  assert.ok(at(40, 30) > 10 * at(50, 40), 'lid streak is vertical');
  streaks(G, 1e-3, []);
  assert.equal(sum(G), 1500);
});

test('floaters shadow bright light and leave darkness dark (control), and lag the gaze', () => {
  const S = createFloaters(rngFrom('f'), 120, 80);
  const B = fill(frame(120, 80), [1, 1, 1]); applyFloaters(B, S, { contrast: 0.3 });
  assert.ok(B.d.some(v => v < 0.95), 'visible against light');
  const D = frame(120, 80); applyFloaters(D, S, { contrast: 0.3 });
  assert.equal(sum(D), 0);
  const it = S.items[0], target = 100 + it.home[0];
  stepFloaters(S, 0.01, [60, 40]); for (let k = 0; k < 40; k++) stepFloaters(S, 0.02, [100, 40]);
  let over = 0; for (let k = 0; k < 300; k++) { stepFloaters(S, 0.02, [100, 40]); over = Math.max(over, it.pos[0] - target); }
  assert.ok(Math.abs(it.pos[0] - target) < 1.5, 'settles');
});
