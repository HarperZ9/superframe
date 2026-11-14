// seattle-motion.test.mjs: what moves in the Seattle scenes (drops on glass, wind, trees) and how frames are written
// (pixel dither, GIF).
// Accept: merging keeps volume; a bead below the slide radius sits and one above runs; faster driving lays the runs
// down toward horizontal; more rain brings more arrivals; loop gusts close exactly; a limb oscillator answers most
// near its own frequency; a child limb starts on its parent's moving tip; dithered output stays inside the palette,
// averages to its input in linear light and is identical frame to frame; a GIF round-trips through its LZW.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGlass, addDrop, step, merge, totalVolume, rainOn } from '../lib/seattle/drops.mjs';
import { slideRadius, cap } from '../lib/seattle/droplens.mjs';
import { gusts, oscillator, drive, limbFreq } from '../lib/seattle/wind.mjs';
import { westernRedcedar } from '../lib/seattle/pnwtrees.mjs';
import { rig, pose } from '../lib/seattle/treedraw.mjs';
import { pairTable, dither } from '../lib/seattle/pixq.mjs';
import { list, inCodebook } from '../lib/quantize/codebook.mjs';
import { encodeGIF, lzw } from '../lib/seattle/gif.mjs';
import { rngFrom } from '../lib/seed.mjs';

const DEG = Math.PI / 180;

test('merging two touching beads keeps their volume', () => {
  const G = createGlass(50, 50, rngFrom('m'));
  addDrop(G, 10, 10, 2); addDrop(G, 11, 10, 3); const V = totalVolume(G);
  merge(G);
  assert.equal(G.drops.length, 1); assert.ok(Math.abs(totalVolume(G) - V) < 1e-12);
});

test('beads sit below the slide radius and run above it; speed lays the runs down', () => {
  const G = createGlass(200, 200, rngFrom('s')), ac = slideRadius(G.p) * 1e3, shape = cap(1, G.p.theta).V;
  const small = addDrop(G, 50, 50, shape * (0.6 * ac) ** 3), big = addDrop(G, 150, 50, shape * (1.5 * ac) ** 3);
  step(G, 0.05, { U: 0, R: 0 });
  assert.equal(small.moving, false); assert.equal(big.moving, true);
  const angle = U => { const H = createGlass(400, 400, rngFrom('a')), d = addDrop(H, 200, 50, shape * (1.5 * ac) ** 3); step(H, 0.05, { U, R: 0 }); return Math.atan2(-d.vx, d.vy); };
  assert.ok(angle(25) > angle(5) + 0.1, `${angle(25)} vs ${angle(5)}`);
});

test('more rain brings more drops to the glass', () => {
  const n = R => { const G = createGlass(100, 60, rngFrom('r')); let k = 0; for (let i = 0; i < 200; i++) k += rainOn(G, 0.1, { R }); return k; };
  assert.ok(n(8) > 1.5 * n(1));
});

test('loop gusts close exactly; free gusts vary', () => {
  const g = gusts(rngFrom('g'), { U: 6, loopT: 12 });
  for (const t of [0.3, 4.1, 9.7]) assert.ok(Math.abs(g.at(t) - g.at(t + 12)) < 1e-9);
  assert.ok(Math.abs(g.at(1) - g.at(5)) > 1e-3);
});

test('a limb answers its own frequency more than three times it, and stems sway near 0.3 Hz', () => {
  assert.ok(Math.abs(limbFreq(0.5, 30) - 0.3) < 1e-9);
  const amp = fd => { const o = oscillator(1, 0.1, 1); let m = 0; for (let i = 0; i < 2000; i++) { const t = i / 200; drive(o, Math.sin(2 * Math.PI * fd * t), 1 / 200); if (t > 6) m = Math.max(m, Math.abs(o.th)); } return m; };
  assert.ok(amp(1) > 3 * amp(3));
});

test('a child limb starts on its parent tip', () => {
  const T = rig(westernRedcedar(rngFrom('c')), rngFrom('r'));
  T.limbs.forEach(l => (l.osc.th = 0.1)); pose(T, 0, 0);
  for (const l of T.limbs) if (l.parent && l.at === 1) assert.ok(Math.hypot(l.x - l.parent.tx, l.y - l.parent.ty) < 1e-9);
});

test('ordered dither: inside the palette, true to the mean, the same every frame', () => {
  const cb = list(['#000000', '#404040', '#a0a0a0', '#ffffff', '#c06020']), T = pairTable(cb, { bitsPer: 5 }), w = 32, h = 32, lin = new Float32Array(w * h * 3).fill(0.3);
  const a = dither(lin, w, h, cb, T), b = dither(lin, w, h, cb, T);
  assert.ok(inCodebook({ w, h, rgba: a.rgba }, cb));
  assert.deepEqual(a.index, b.index);
  let m = 0; for (let i = 0; i < w * h; i++) m += cb.lin[a.index[i]][1]; m /= w * h;
  assert.ok(Math.abs(m - 0.3) < 0.03, `${m}`);
});

test('GIF: header, frames and an LZW that decodes back', () => {
  const px = Uint8Array.from({ length: 4000 }, (_, i) => (i * 7 + (i >> 5)) % 5);
  assert.deepEqual(unlzw(lzw(px, 3), 3, px.length), px);
  const g = encodeGIF({ w: 40, h: 25, palette: [[0, 0, 0], [255, 0, 0], [0, 255, 0], [0, 0, 255], [9, 9, 9]], frames: [px.slice(0, 1000), px.slice(1000, 2000)], scale: 2 });
  assert.equal(Buffer.from(g.slice(0, 6)).toString(), 'GIF89a');
  assert.equal(g[6] | (g[7] << 8), 80);
  assert.equal(g.filter((v, i) => v === 0x2c && g[i - 1] === 0).length >= 2, true);
  assert.equal(g.at(-1), 0x3b);
});

// a minimal GIF LZW decoder, written here so the encoder is checked by an independent reader
function unlzw(bytes, minCode, n) {
  const clear = 1 << minCode, end = clear + 1, out = [];
  let width = minCode + 1, dict = [], prev = null, bit = 0;
  const reset = () => { dict = Array.from({ length: clear }, (_, i) => [i]); dict.push(null, null); width = minCode + 1; prev = null; };
  reset();
  while (out.length < n) {
    let code = 0; for (let k = 0; k < width; k++, bit++) code |= ((bytes[bit >> 3] >> (bit & 7)) & 1) << k;
    if (code === clear) { reset(); continue; }
    if (code === end) break;
    let entry = dict[code];
    if (!entry) entry = [...dict[prev], dict[prev][0]];
    out.push(...entry);
    if (prev !== null && dict.length < 4096) dict.push([...dict[prev], entry[0]]);
    if (dict.length === (1 << width) && width < 12) width++;
    prev = code;
  }
  return Uint8Array.from(out.slice(0, n));
}
