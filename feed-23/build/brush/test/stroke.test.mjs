import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync, deflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { Surface, paintStroke, preset, dabParams, tiltToPolar, linear, render, nocturne, starcloud, encodePNG, crc32 } from '../index.js';

const hline = (x0, x1, y, n = 20, extra = {}) => Array.from({ length: n + 1 }, (_, i) => ({ x: x0 + ((x1 - x0) * i) / n, y, ...extra }));
const sha = (s) => createHash('sha256').update(Buffer.from(s.px.buffer)).digest('hex');
const R0 = () => 0.5;

test('pressure grows the dab and its flow; a pen held flat stretches the tip along its azimuth', () => {
  const b = preset('wisp', { jitter: null, velocity: null });
  const lo = dabParams(b, { p: 0.2 }, 1000, R0), hi = dabParams(b, { p: 1 }, 1000, R0);
  assert.ok(hi.radius > lo.radius * 2 && hi.flowAlpha > lo.flowAlpha);
  const t = tiltToPolar(60, 0); assert.ok(Math.abs(t.azimuth) < 1e-9 && t.tilt > 1);
  const pen = preset('haze', { tilt: { aspect: 2 } }), flat = dabParams(pen, { p: 1, tiltX: 0, tiltY: 70 }, 1000, R0);
  assert.ok(flat.aspect > 2.5 && Math.abs(flat.angle - Math.PI / 2) < 1e-6, `aspect ${flat.aspect}, angle ${flat.angle}`);
});

test('dab spacing follows the brush: count is about length / (spacing x diameter)', () => {
  const s = new Surface(800, 60).fill([0, 0, 0]), b = preset('haze', { size: 0.05, spacing: 0.25, jitter: null, pressure: null });
  const n = paintStroke(s, b, hline(50, 750, 30), { unit: 800 });
  const expect = 700 / (0.25 * 0.05 * 800);
  assert.ok(Math.abs(n - expect) / expect < 0.12, `${n} dabs vs ${expect}`);
});

test('same seed, same painting; a different seed changes the jitter', () => {
  const run = (seed) => { const s = new Surface(200, 100).fill([0, 0, 0]); paintStroke(s, preset('billow'), hline(20, 180, 50), { unit: 200, seed, color: '#9090c0' }); return sha(s); };
  assert.equal(run(4), run(4)); assert.notEqual(run(4), run(5));
});

test('wet paint mixes with what it crosses; dry paint does not', () => {
  const base = () => new Surface(200, 40).fill(linear('#ff0000'));
  const dry = base(), wet = base();
  paintStroke(dry, preset('haze', { size: 0.2, flow: 1, wet: null, pressure: null }), hline(20, 180, 20), { unit: 200, color: '#0000ff' });
  paintStroke(wet, preset('haze', { size: 0.2, flow: 1, wet: { mix: 0.6, pickup: 0.5 }, pressure: null }), hline(20, 180, 20), { unit: 200, color: '#0000ff' });
  const qd = dry.read(100, 20), qw = wet.read(100, 20);
  assert.ok(qw[0] > qd[0] + 0.05, `wet carries red: ${qw[0]} vs ${qd[0]}`);
  assert.ok(qw[2] > 0.2, 'and still lays blue');
});

test('smudge drags colour along the stroke: red mass moves right of where it was painted', () => {
  const s = new Surface(300, 40).fill([0, 0, 0]);
  for (let y = 0; y < 40; y++) for (let x = 40; x < 70; x++) s.px[(y * 300 + x) * 4] = 1;
  const centroid = () => { let m = 0, mx = 0; for (let y = 0; y < 40; y++) for (let x = 0; x < 300; x++) { const v = s.px[(y * 300 + x) * 4]; m += v; mx += v * x; } return mx / m; };
  const before = centroid();
  paintStroke(s, preset('blend', { size: 0.12, smudge: { strength: 0.9, length: 0.95 } }), hline(45, 260, 20, 40), { unit: 300 });
  assert.ok(centroid() > before + 20, `centroid ${before} -> ${centroid()}`);
});

test('resolution independent: a scene painted at 800 and reduced to 400 matches the 400 render', async () => {
  const sc = starcloud(5), a = await render(sc, 400), b = await render(sc, 800);
  let err = 0, n = 0;
  for (let y = 0; y < a.h; y += 2) for (let x = 0; x < a.w; x += 2) {
    let m = 0; for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const q = b.read(2 * x + dx, 2 * y + dy); m += (q[0] + q[1] + q[2]) / 12; }
    const q = a.read(x, y); err += Math.abs((q[0] + q[1] + q[2]) / 3 - m); n++;
  }
  assert.ok(err / n < 0.02, `mean linear error ${err / n}`);
});

test('CRC-32 matches the standard check value', () => { assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926); });

test('PNG export is lossless at 16 bits: inflate the IDAT and the samples come back exactly', async () => {
  const s = new Surface(37, 23).fill(linear('#202030'), linear('#8090ff'));
  paintStroke(s, preset('flare'), [{ x: 18, y: 11 }], { unit: 37, color: '#ffffff' });
  const px = s.toRGBA16(), png = await encodePNG(s.w, s.h, px, (b) => deflateSync(b));
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const dv = new DataView(png.buffer); let o = 8, idat = [];
  while (o < png.length) {
    const len = dv.getUint32(o), type = String.fromCharCode(...png.subarray(o + 4, o + 8));
    assert.equal(dv.getUint32(o + 8 + len), crc32(png.subarray(o + 4, o + 8 + len)), `crc of ${type}`);
    if (type === 'IHDR') { assert.equal(dv.getUint32(o + 8), 37); assert.equal(png[o + 16], 16); }
    if (type === 'IDAT') idat.push(png.subarray(o + 8, o + 8 + len));
    o += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat)), stride = 37 * 8, out = new Uint16Array(37 * 23 * 4), prev = new Uint8Array(stride);
  for (let y = 0; y < 23; y++) {
    const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), cur = new Uint8Array(stride);
    for (let i = 0; i < stride; i++) cur[i] = f === 2 ? (row[i] + prev[i]) & 255 : row[i];
    for (let i = 0; i < 37 * 4; i++) out[y * 37 * 4 + i] = (cur[i * 2] << 8) | cur[i * 2 + 1];
    prev.set(cur);
  }
  assert.deepEqual(out, px);
});

// The paintings' own intent: the star cloud sits in the references' tonal range; the nocturne (our own composition,
// not a study of image 18) is a night key with one small red hot mark.
const stats = (s) => {
  let lsum = 0, n = 0, red = 0; const hist = new Array(8).fill(0); const px = s.toRGBA8({ dither: false });
  for (let i = 0; i < px.length; i += 4) { const v = Math.max(px[i], px[i + 1], px[i + 2]); lsum += v; hist[v >> 5]++; n++; if (px[i] > 120 && px[i] > 2 * px[i + 1]) red++; }
  return { meanV: lsum / n, darkShare: (hist[0] + hist[1]) / n, redShare: red / n };
};
test('star cloud in the reference tonal range; nocturne a night key with one small red mark', async () => {
  const a = stats(await render(nocturne(), 300)), b = stats(await render(starcloud(), 300));
  assert.ok(b.meanV > 50 && b.meanV < 100, `starcloud mean V ${b.meanV}`);
  assert.ok(b.darkShare > 0.3, `starcloud keeps a dark field: ${b.darkShare}`);
  assert.ok(a.meanV > 35 && a.meanV < 90, `nocturne mean V ${a.meanV}`);
  assert.ok(a.redShare > 0 && a.redShare < 0.01, `one small hot mark: red share ${a.redShare}`);
});
