// Origin: the alive workspace tests/gif.test.js, written 2026-10-23 and left out of the site import; carried on 2026-11-14 with imports repointed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeGIF, decodeGif, encodeAPNG, decodeAPNG, medianCut, indexFrame, delaysCs, lzwEncode, exportLoop } from '../src/gif.js';
import { gifLzwDecode } from '../src/vendor/daylight-gif/media-gif-lzw.js';
import { image, blur, luma, resize } from '../src/lib/img.js';
import { golden, fixture, save, scene } from './helpers.js';

const flat = (w, h, n) => [...Array(n)].map((_, k) => { const im = image(w, h); for (let i = 0; i < w * h; i++) { const c = ((i + k * 7) % 5) * 50; im.data.set([c, 255 - c, (c * 3) % 256, 255], i * 4); } return im; });
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

test('LZW round trip through the vendored decoder, including table resets past 4096 codes', () => {
  const idx = new Uint8Array(30000); for (let i = 0; i < idx.length; i++) idx[i] = (i * 2654435761 >>> 24) & 127;
  const back = gifLzwDecode(lzwEncode(idx, 7), 7, idx.length); assert.ok(same(Array.from(back), Array.from(idx)));
});

test('GIF round trip is exact for frames within 255 colours, with loop and timing kept', () => {
  const fr = flat(40, 30, 6), bytes = encodeGIF(40, 30, fr.map((f) => ({ data: f.data, delayMs: 1000 / 24 })), { dither: 'none' }), g = decodeGif(bytes);
  assert.equal(g.frames.length, 6); assert.equal(g.loop, 0);
  g.frames.forEach((f, k) => assert.ok(same(Array.from(f.rgba), Array.from(fr[k].data)), `frame ${k}`));
  assert.equal(g.frames.reduce((a, f) => a + f.delayMs, 0), 250, '6 frames at 24 fps keep 250 ms');
});

test('delays track the exact running sum, never under 20 ms', () => {
  const d = delaysCs(Array(48).fill(1000 / 24)); assert.equal(d.reduce((a, b) => a + b, 0), 200); assert.ok(d.every((x) => x >= 4 && x <= 5));
  assert.ok(delaysCs([5, 5]).every((x) => x >= 2));
});

test('a held frame costs a few bytes: unchanged pixels become transparent inside a cropped box', () => {
  const a = scene(120, 90), b = image(120, 90); b.data.set(a.data); for (let y = 40; y < 44; y++) for (let x = 50; x < 54; x++) b.data.set([255, 0, 0, 255], (y * 120 + x) * 4);
  const one = encodeGIF(120, 90, [{ data: a.data, delayMs: 100 }], { dither: 'none' }), two = encodeGIF(120, 90, [{ data: a.data, delayMs: 100 }, { data: b.data, delayMs: 100 }], { dither: 'none' });
  assert.ok(two.length - one.length < 80, `second frame cost ${two.length - one.length} bytes`);
  const g = decodeGif(two); assert.equal(g.frames[1].w, 4); assert.equal(g.frames[1].h, 4);
});

test('median cut keeps at most n colours and dithering lowers the blurred error on a gradient', () => {
  const w = 128, h = 32, im = image(w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) im.data.set([x * 2, x * 2, 128 + x / 2, 255], (y * w + x) * 4);
  const pal = medianCut([im.data], 6); assert.ok(pal.length <= 6);
  const err = (dither) => { const idx = indexFrame(im.data, w, h, pal, { dither, strength: 1 }), o = image(w, h); idx.forEach((k, i) => o.data.set([...pal[k], 255], i * 4)); const A = blur(luma(im), 3), B = blur(luma(o), 3); let s = 0; for (let i = 0; i < A.data.length; i++) s += Math.abs(A.data[i] - B.data[i]); return s / A.data.length; };
  const none = err('none'), fs = err('fs'), bayer = err('bayer');
  assert.ok(fs < none * 0.6 && bayer < none * 0.8, `blurred error none ${none.toFixed(4)}, fs ${fs.toFixed(4)}, bayer ${bayer.toFixed(4)}`);
});

test('APNG round trip is exact, with delays, loop count and cropped frames', async () => {
  const fr = [scene(64, 48), scene(64, 48, { shift: 2 }), scene(64, 48, { shift: 2 })];
  const bytes = await encodeAPNG(64, 48, fr.map((f, i) => ({ data: f.data, delayMs: [40, 80, 120][i] })), { loop: 3 }), a = await decodeAPNG(bytes);
  assert.equal(a.frames.length, 3); assert.equal(a.loop, 3); assert.deepEqual(a.frames.map((f) => f.delayMs), [40, 80, 120]);
  a.frames.forEach((f, k) => assert.ok(same(Array.from(f.rgba), Array.from(fr[k].data)), `frame ${k}`));
  save('apng-roundtrip.png', bytes);
});

test('golden: a cleared plate exported as a 32-colour dithered GIF, decoded back', async () => {
  const im = resize(fixture('goya-nobody'), 140, 203), bytes = await exportLoop([im, im], 12, { colors: 32, dither: 'fs' });
  save('goya-32.gif', bytes);
  const g = decodeGif(bytes), out = { w: g.width, h: g.height, data: g.frames[0].rgba };
  const r = golden('gif-goya-32-fs', out); assert.ok(r.ok, JSON.stringify(r));
  assert.ok(bytes.length < im.w * im.h, `${bytes.length} bytes`);
});
