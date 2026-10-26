// Feed set 28 builds: the bistable rotation and the time bands. Each claim in the module headers gets a test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { frame as ill, solid, turn, rings, DRIFT } from '../illusion.mjs';
import { frame as tb, sun, waveSet } from '../timebands.mjs';
import { raster, encode } from '../../../feed-29/build/lib/field.mjs';
import { golden } from '../../../feed-29/build/lib/io.mjs';

const GOLD = new URL('./golden/set28.json', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const same = (a, b) => Buffer.compare(Buffer.from(a.px.buffer), Buffer.from(b.px.buffer)) === 0;

test('bistable: turning by +th equals turning the depth-mirrored solid by -th, mirrored again (the ambiguity)', () => {
  for (const e of solid(8)) for (const { p } of e) for (const th of [0.3, 1.7, 4]) {
    const A = turn(p, th), B = turn([p[0], p[1], -p[2]], -th);
    assert.ok(Math.abs(A[0] - B[0]) < 1e-12 && Math.abs(A[1] - B[1]) < 1e-12 && Math.abs(A[2] + B[2]) < 1e-12);
  }
});

test('bistable: with no cue, the mirrored solid turning the other way gives the same frame; with the cue it does not', () => {
  const pts = solid(16), mirror = pts.map(e => e.map(q => ({ ...q, p: [q.p[0], q.p[1], -q.p[2]] }))), base = raster(160, 160);
  assert.ok(same(ill(1.1, { size: 160, cue: 0, base, pts }), ill(8 - 1.1, { size: 160, cue: 0, base, pts: mirror })), 'no cue: the two readings are one picture');
  assert.ok(!same(ill(1.1, { size: 160, cue: 1, base, pts }), ill(8 - 1.1, { size: 160, cue: 1, base, pts: mirror })), 'cue on: the two readings differ');
});

test('bistable: the loop closes (t = 0 and t = period give the same frame) and the rings never move', () => {
  const base = rings(raster(200, 200)), a = ill(0, { size: 200, base }), z = ill(8, { size: 200, base }), m = ill(3, { size: 200, base });
  assert.ok(same(a, z));
  const k = 3 * (100 * 200 + 3); // a ring pixel near the left edge
  assert.equal(a.px[k], m.px[k]);
});

test('peripheral drift: each ring repeats black, dark grey, white, light grey; neighbouring rings run opposite ways', () => {
  assert.deepEqual(DRIFT, [0, 0.28, 1, 0.72]);
  const R = rings(raster(800, 800), { rings: 2, segments: 64, r0: 0.4, r1: 0.5, tint: [1, 1, 1] });
  const read = (rr, a) => { const x = Math.round(400 + Math.cos(a) * rr * 800), y = Math.round(400 + Math.sin(a) * rr * 800); return R.px[3 * (y * 800 + x)]; };
  const order = (rr, ring) => { const v = []; for (let s = 0; s < 8; s++) v.push(read(rr, (s + 0.5 - 0.5 * ring) / 64 * 2 * Math.PI)); return v.map(x => Math.round(x / 0.82 * 100) / 100); };
  const inner = order(0.425, 0), outer = order(0.475, 1);
  const idx = v => v.map(x => DRIFT.reduce((b, d, i) => (Math.abs(d - x) < Math.abs(DRIFT[b] - x) ? i : b), 0));
  const di = idx(inner), dout = idx(outer), step = v => (v[1] - v[0] + 4) % 4;
  for (let i = 1; i < 8; i++) { assert.equal((di[i] - di[i - 1] + 4) % 4, step(di)); assert.equal((dout[i] - dout[i - 1] + 4) % 4, step(dout)); }
  assert.equal((step(di) + step(dout)) % 4, 0, `inner step ${step(di)} outer ${step(dout)}`);
});

test('solar model: midsummer noon at 47.6 N stands near 65.8 deg; the sun sets in the north-west', () => {
  const noon = sun(12, 47.6, 172).el * 180 / Math.PI; assert.ok(Math.abs(noon - 65.8) < 0.6, `noon ${noon}`);
  const ev = sun(19.7, 47.6, 172); assert.ok(ev.el > 0 && ev.el < 0.12 && ev.az * 180 / Math.PI > 290 && ev.az * 180 / Math.PI < 310, `evening ${ev.el} ${ev.az}`);
});

test('waves obey deep-water dispersion and repeat exactly every loop', () => {
  for (const q of waveSet({ loop: 6 })) { assert.ok(Math.abs(q.k - q.om * q.om / 9.81) < 1e-12); const n = q.om * 6 / (2 * Math.PI); assert.ok(Math.abs(n - Math.round(n)) < 1e-9); }
  const W = waveSet({ loop: 6 }), a = tb(0.5, { w: 96, h: 72, W }), b = tb(6.5, { w: 96, h: 72, W });
  let d = 0; for (let i = 0; i < a.px.length; i++) d = Math.max(d, Math.abs(a.px[i] - b.px[i])); assert.ok(d < 1e-4, `loop seam ${d}`);
});

test('time bands: the evening band is warmest and holds the brightest glint; noon is coolest', () => {
  const R = tb(1.3, { w: 240, h: 240 }), stats = R.bands.map(b => { let r = 0, bl = 0, mx = 0; for (let y = b.y0; y < b.y1; y++) for (let x = 0; x < 240; x++) { const k = 3 * (y * 240 + x); r += R.px[k]; bl += R.px[k + 2]; mx = Math.max(mx, R.px[k + 1]); } return { warm: r / bl, mx }; });
  const warm = stats.map(s => s.warm), peak = stats.map(s => s.mx);
  assert.equal(warm.indexOf(Math.max(...warm)), 3, `warmth ${warm}`); assert.equal(warm.indexOf(Math.min(...warm)), 1, `warmth ${warm}`);
  assert.ok(peak[3] > peak[1], `glint ${peak}`);
});

test('goldens (S5)', () => {
  const base = rings(raster(160, 160)), I = ill(2.2, { size: 160, base }), T = tb(1.3, { w: 160, h: 120 });
  for (const [n, R] of [['illusion', I], ['timebands', T]]) { const g = golden(GOLD, n, encode(R, { seed: n }), R.w, R.h); assert.ok(g.mean >= 0.995 && g.chroma <= 0.02, `${n} ${g.mean}`); }
});

test('time bands: band heights follow the clock, with a floor of 0.14 of the frame', async () => {
  const { bandEdges } = await import('../timebands.mjs'), Y = bandEdges([6.0, 12.5, 18.3, 19.7], 47.6, 172, 1000), H = Y.slice(1).map((v, i) => v - Y[i]);
  assert.equal(Y[0], 0); assert.equal(Y[4], 1000);
  assert.ok(H[0] > H[1] && H[1] > H[2], `heights ${H}`); assert.ok(Math.min(...H) >= 0.14 * 1000 / 1.2, `floor ${H}`);
});
