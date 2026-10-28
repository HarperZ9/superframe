// stack.test.mjs: the shutter integral (PREREG P1, P2, P7 in lib/stack/README.md) and sprite stacking.
// Streak length must equal relative image velocity x shutter within 5%; a flash under 1% of the shutter stays sharp,
// and the post-blur shortcut must smear it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { expose, postBlur, midFrame, rowProfile } from '../lib/stack/shutter.mjs';
import { bar, lineScene, streakOf, flashScene, flashGrowth } from '../lib/stack/plant.mjs';
import { sharpAt } from '../lib/stack/scene.mjs';
import { maxAbsDiff } from '../lib/stack/frame.mjs';
import { volume, vidx, spriteStack } from '../lib/stack/stack.mjs';

const streak = streakOf;

const P1_CASES = [[480, 1 / 60], [960, 1 / 60], [960, 1 / 30], [1920, 1 / 30], [3600, 1 / 30]];

test('P1: streak length equals image velocity x shutter within 5% (both estimators)', () => {
  for (const [v, T] of P1_CASES) {
    const L = v * T, { fwhm: fw, moments: mo } = streak(lineScene([bar(v)]), T);
    assert.ok(Math.abs(fw - L) / L < 0.05, `fwhm ${fw} vs ${L}`);
    assert.ok(Math.abs(mo - L) / L < 0.05, `moments ${mo} vs ${L}`);
  }
});

test('P1: a panned camera streaks by the relative velocity', () => {
  const T = 1 / 30, { fwhm: fw, moments: mo } = streak(lineScene([bar(900)], { vx: 600 }), T);
  assert.ok(Math.abs(fw - 10) / 10 < 0.05 && Math.abs(mo - 10) / 10 < 0.05, `${fw} ${mo}`);
});

test('P1 control: a tracking camera freezes the object and streaks the world', () => {
  const T = 1 / 30, cam = { vx: 600 };
  assert.ok(streak(lineScene([bar(600)], cam), T).moments < 1, 'tracked object streaked');
  const world = streak(lineScene([{ ...bar(0), x: 300.2 }], cam), T);
  assert.ok(Math.abs(world.moments - 20) / 20 < 0.05, `background ${world.moments}`);
});

const flashLen = flashGrowth;

test('P2: a flash of 0.5% of the shutter stays sharp inside a 64 px streak', () => {
  const T = 1 / 30, sc = flashScene(0.005, T), Lf = flashLen(null, sc, { ss: 16, render: S => expose(S, 0, T) });
  assert.ok(Math.abs(Lf - 0.32) < 0.05, `growth ${Lf}, expected 0.32`);
  assert.ok(Lf <= 0.02 * 64, `flash mark grew ${Lf} px`);
});

test('P2 control: a directional post-blur smears the same flash to the full streak', () => {
  const T = 1 / 30, sc = flashScene(0.005, T), Lf = flashLen(postBlur(midFrame(sc, 0, T), 64), sc);
  assert.ok(Lf >= 0.9 * 64, `post-blur flash only ${Lf} px`);
});

test('flash energy is conserved whatever its duration', () => {
  const T = 1 / 30, m = d => rowProfile(expose(flashScene(d, T), 0, T), 2, 6).reduce((a, b) => a + b, 0);
  const a = m(0.001), b = m(0.01), c = m(0.2);
  assert.ok(Math.abs(a - b) / a < 1e-3 && Math.abs(a - c) / a < 1e-3, `${a} ${b} ${c}`);
});

test('P7: a static scene under any shutter equals its sharp frame', () => {
  const sc = { w: 64, h: 32, ground: [0.1, 0.1, 0.2], cam: { vx: 0 }, items: [{ x: 10.5, y: 4.25, w: 20, h: 9, vx: 0, rgb: [0.8, 0.4, 0.1] }] };
  for (const T of [1 / 500, 1 / 30, 1]) assert.ok(maxAbsDiff(expose(sc, 0, T), sharpAt(sc, 0)) < 1e-6);
});

test('sprite stacking: each slice rises one pixel, so the stack is as tall as it has slices', () => {
  const V = volume(6, 6, 10);
  for (let z = 0; z < 10; z++) for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) { const k = vidx(V, x, y, z); V.occ[k] = 1; V.rgb.set([1, 1, 1], 3 * k); }
  const F = spriteStack(V, { w: 40, h: 40, rgb: [0, 0, 0] }, { cx: 20, cy: 30, rise: 1, shade: 1 });
  let top = 40, bottom = 0;
  for (let y = 0; y < 40; y++) if (F.px[3 * (y * 40 + 20)] > 0.5) { top = Math.min(top, y); bottom = Math.max(bottom, y); }
  assert.equal(bottom - top + 1, 6 + 9);
});
