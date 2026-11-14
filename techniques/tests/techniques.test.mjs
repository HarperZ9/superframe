// node --test tests/  : logic checks for the technique modules (no browser needed).
import test from 'node:test';
import assert from 'node:assert/strict';
import { rng, fbm, boxBlur } from '../lib/util.js';
import { ropeEase, ropePhase } from '../lib/rope.js';
import { orientationField, streamlines, penStrokes } from '../lib/burin.js';
import { tearPath, fringePath, piece } from '../lib/tear.js';
import { envelope, profile, setbackCount } from '../lib/zoning.js';
import { fixedPoint, frameRect, layout } from '../lib/powers.js';
import { separate, meanDisagreement } from '../lib/register.js';
import { relief, normalAt, shade } from '../lib/raking.js';
import { densityInf, density, timeToVisible, attention } from '../lib/develop.js';

test('rng is deterministic and fbm stays in [0,1]', () => {
  const a = rng(5), b = rng(5); for (let i = 0; i < 50; i++) assert.equal(a(), b());
  for (let i = 0; i < 500; i++) { const v = fbm(i * 0.37, i * 0.11, 3); assert.ok(v >= 0 && v <= 1); }
});

test('box blur preserves a constant field', () => {
  const f = new Float32Array(30 * 20).fill(0.4), g = boxBlur(f, 30, 20, 3);
  for (const v of g) assert.ok(Math.abs(v - 0.4) < 1e-6);
});

test('rope ease: ends at 0 and 1, slips back during each re-grip, never slips on the last pull', () => {
  const o = { pulls: 4, slip: 0.2, reach: 0.3 };
  assert.equal(ropeEase(0, o), 0); assert.equal(ropeEase(1, o), 1);
  let slips = 0, prev = 0;
  for (let i = 1; i <= 4000; i++) { const t = i / 4000, v = ropeEase(t, o); if (v < prev - 1e-5) { slips++; assert.equal(ropePhase(t, o).gripping, true); assert.notEqual(ropePhase(t, o).pull, 3); } prev = v; assert.ok(v >= 0 && v <= 1 + 0.2 / 4 + 1e-9); }
  assert.ok(slips > 0);
  for (let p = 1; p < 4; p++) assert.ok(Math.abs(ropeEase(p / 4, o) - p / 4) < 1e-9, 'each pull lands on its rung');
});

test('rope ease: lowering is the same curve mirrored', () => {
  for (let i = 0; i <= 20; i++) { const t = i / 20; assert.ok(Math.abs(ropeEase(t, { direction: 'lower' }) - (1 - ropeEase(t))) < 1e-12); }
});

// A synthetic photograph: concentric rings. The engraving should run around them, tangent to the circles.
const rings = (w, h) => { const l = new Float32Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) l[y * w + x] = 0.5 + 0.5 * Math.cos(Math.hypot(x - w / 2, y - h / 2) / 4); return l; };

test('burin: the field runs along the isophotes of a ring pattern', () => {
  const w = 96, h = 96, f = orientationField(rings(w, h), w, h, { radius: 3 });
  let ok = 0, n = 0;
  for (const [x, y] of [[70, 48], [48, 20], [26, 60], [60, 70], [30, 30]]) {
    const i = y * w + x, rx = x - w / 2, ry = y - h / 2, r = Math.hypot(rx, ry), dot = Math.abs((f.tx[i] * rx + f.ty[i] * ry) / r);
    n++; if (dot < 0.35) ok++;
  }
  assert.ok(ok >= 4, `tangent should be near-perpendicular to the radius at ${ok}/${n} probes`);
});

test('burin: streamlines keep their separation', () => {
  const w = 80, h = 80, f = orientationField(rings(w, h), w, h, { radius: 3 }), dsep = 4, lines = streamlines(f, { dsep, test: 0.5 });
  assert.ok(lines.length > 10);
  const pts = []; lines.forEach((L, id) => { for (let i = 0; i < L.length; i += 6) pts.push([L[i], L[i + 1], id]); });
  let viol = 0;
  for (let a = 0; a < pts.length; a += 3) for (let b = 0; b < pts.length; b++) if (pts[a][2] !== pts[b][2] && Math.hypot(pts[a][0] - pts[b][0], pts[a][1] - pts[b][1]) < dsep * 0.5 * 0.9) viol++;
  assert.ok(viol / pts.length < 0.01, `separation violations ${viol}`);
});

test('burin: the pen lifts in highlights, pools at pen-down and runs dry on a long line', () => {
  const n = 2000, pts = new Float32Array(n * 2), wd = new Float32Array(n).fill(2);
  for (let i = 0; i < n; i++) { pts[2 * i] = i; pts[2 * i + 1] = 0; }
  wd.fill(0, 400, 420);
  const s = penStrokes(pts, wd, { reservoir: 300 });
  assert.ok(s.length >= 3, 'lift at the highlight plus dry skips');
  const first = s[0]; assert.ok(first[2] > first[3 * 40 + 2], 'wider at pen-down than at speed');
});

test('tear: endpoints fixed, displacement bounded, fringe on the requested side', () => {
  const t = tearPath([0, 0], [300, 0], 4, { amp: 12 });
  assert.deepEqual(t.pts[0].map(v => Math.round(v * 1e6) / 1e6), [0, 0]);
  assert.ok(Math.abs(t.pts.at(-1)[0] - 300) < 1e-6 && Math.abs(t.pts.at(-1)[1]) < 1e-6);
  for (const p of t.pts) assert.ok(Math.abs(p[1]) <= 12 + 1e-9);
  const up = fringePath(t, -1, 2, { width: 5 }); let side = 0;
  up.forEach((p, i) => { side += Math.sign(p[1] - t.pts[i][1]); });
  assert.ok(side < 0, 'side -1 pushes the fringe to negative y (outward for a top edge)');
  assert.deepEqual(piece([0, 0, 100, 50], { top: 'pulled' }, 1).inner.length > 4, true);
});

test('zoning: wall to the street multiple, retreats in steps, keeps the quarter-lot tower', () => {
  const o = { lot: 10, street: 20, multiple: 1.5, ratio: 2, step: 4 };
  assert.equal(envelope(0, o), 10); assert.equal(envelope(30, o), 10);
  let prev = 10; for (let z = 30; z < 300; z += 0.5) { const a = envelope(z, o); assert.ok(a <= prev + 1e-9); prev = a; }
  assert.equal(envelope(1e4, o), 5, 'tower half-width is sqrt(0.25) of the lot');
  assert.equal(setbackCount(o), Math.ceil((5 * 2) / 4));
  const p = profile(o, 120); assert.equal(p[0][1], 10); assert.equal(p.at(-1)[1], 5);
});

test('powers: the fixed point stays fixed, and the child fills the frame at f = 1', () => {
  const c = { x: 0.3, y: 0.7, s: 0.2 }, p = fixedPoint(c);
  for (const f of [0, 0.3, 0.8, 1]) { const r = frameRect(c, f); const u = [r.x + p[0] * r.w, r.y + p[1] * r.h]; assert.ok(Math.abs(u[0] - p[0]) < 1e-9 && Math.abs(u[1] - p[1]) < 1e-9); }
  const levels = [{ child: c }, { child: { x: 0.5, y: 0.5, s: 0.3 } }, { child: { x: 0.5, y: 0.5, s: 0.5 } }];
  const L = layout(levels, 1); const r = L.rects[1];
  assert.ok(Math.abs(r.x) < 1e-9 && Math.abs(r.w - 1) < 1e-9);
  const L2 = layout(levels, 0.999); assert.ok(Math.abs(L2.rects[1].w - 1) < 0.01);
});

test('register: a flat field has no disagreement; a picture has some', () => {
  const w = 64, h = 64, flat = new Float32Array(w * h).fill(1), s = separate(flat, w, h);
  assert.ok(s.dis.every(v => Number.isFinite(v)));
  const pic = rings(w, h), s2 = separate(pic, w, h); const m = meanDisagreement(s2);
  assert.ok(m > 0 && m < 1);
});

test('raking: the indent is invisible under flat light and visible under raking light', () => {
  const w = 64, h = 64, ink = new Float32Array(w * h), ind = new Float32Array(w * h);
  for (let y = 28; y < 36; y++) for (let x = 10; x < 54; x++) ind[y * w + x] = 1;
  const hf = relief(ink, ind, w, h, { fibre: 0 });
  const edge = normalAt(hf, w, h, 32, 27), flat = normalAt(hf, w, h, 32, 10);
  // Weber contrast, the ratio the eye reads: |edge - ground| / ground.
  const weber = (az, el) => Math.abs(shade(edge, az, el) - shade(flat, az, el)) / shade(flat, az, el);
  const contrastFlat = weber(1.57, 1.5), contrastRaking = weber(-1.57, 0.15);
  assert.ok(contrastRaking > contrastFlat * 4, `raking ${contrastRaking} vs flat ${contrastFlat}`);
});

test('develop: the curve rises with exposure, shadows come up first, attention accumulates', () => {
  let prev = -1; for (let i = 0; i <= 20; i++) { const d = densityInf(i / 20); assert.ok(d > prev); prev = d; }
  assert.ok(density(0.8, 10) > density(0.8, 1));
  assert.ok(timeToVisible(0.9) < timeToVisible(0.5), 'denser grains reach visibility first');
  assert.equal(timeToVisible(0), Infinity);
  const a = attention(20, 10); a.deposit(0.5, 0.5, 1); assert.ok(a.t[5 * 20 + 10] > a.t[0]);
});

import { cascade, revealOut, reach, boil } from '../lib/timing.js';
import { thinFilm, filmRGB, screen } from '../lib/light.js';

test('timing: the fitted curves hit the measured reach times', () => {
  const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
  near(reach(cascade, 0.1), 0.53, 0.06); near(reach(cascade, 0.5), 1.13, 0.06); near(reach(cascade, 0.9), 1.40, 0.04);
  near(Math.max(...Array.from({ length: 400 }, (_, i) => cascade(i / 100))), 1.018, 0.002);
  near(cascade(3), 1, 1e-6);
  near(reach(revealOut, 0.1), 0.25, 0.02); near(reach(revealOut, 0.5), 0.38, 0.02); near(reach(revealOut, 0.9), 0.62, 0.03);
  assert.equal(boil(0.04), 0); assert.equal(boil(0.09), 1, 'a new seed every 1/12 s: on twos at 24 fps');
});

test('light: thin film goes dark at zero thickness, hue cycles with thickness, Screen never darkens', () => {
  assert.ok(thinFilm(0, 550) < 1e-9, 'a vanishing film reflects nothing (the black spot of a soap film)');
  const a = filmRGB(150), b = filmRGB(300); assert.notDeepEqual(a.map(v => v.toFixed(2)), b.map(v => v.toFixed(2)));
  for (let i = 0; i <= 10; i++) for (let j = 0; j <= 10; j++) { const s = screen(i / 10, j / 10); assert.ok(s >= Math.max(i, j) / 10 - 1e-12 && s <= 1); }
});
