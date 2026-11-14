// Golden-image tests for the outputs that can be computed without a canvas: each field is reduced to a thumbnail and
// compared with the stored golden by SSIM. UPDATE=1 node --test tests/golden.test.mjs rewrites the goldens.
// The canvas and WebGL outputs have their own golden pass in the browser (tools/golden.html, tests/golden/browser.json).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { ssim, thumb, encode, decode } from '../lib/ssim.mjs';
import { buildGlyph } from '../lib/glyph.mjs';
import { O, T } from './shapes.mjs';
import { pressField } from '../lib/techniques/raked.mjs';
import { toneField } from '../lib/techniques/engraved.mjs';
import { coverage } from '../lib/techniques/glyphcell.mjs';
import { bitmap, synth, spectrogram } from '../lib/techniques/sound.mjs';
import { stencilMask } from '../lib/techniques/sprayed.mjs';
import { plateModes } from '../lib/techniques/chladni.mjs';
import { modeAmplitude } from '../../feed-22/build/chladni.js';

const DIR = new URL('./golden/', import.meta.url), FILE = new URL('node.json', DIR);
const gO = buildGlyph(O()), gT = buildGlyph(T());
const cases = {
  'raked-height': () => { const F = pressField(gO, { seed: 3, uneven: 0.35 }); return [thumb(F.height, gO.w, gO.h, 60, 60), 60, 60]; },
  'raked-ao': () => { const F = pressField(gO, { seed: 3 }); return [thumb(F.ao, gO.w, gO.h, 60, 60), 60, 60]; },
  'engraved-tone': () => [thumb(toneField(gO), gO.w, gO.h, 60, 60), 60, 60],
  'glyphcell-coverage': () => { const c = coverage(gO, 6); return [c.cov, c.cols, c.rows]; },
  'sound-spectrogram': () => { const sp = spectrogram(synth(bitmap(gT, 24), { colSec: 0.012 })); return [thumb(sp.v, sp.W, sp.H, 64, 48), 64, 48]; },
  'sprayed-stencil': () => [thumb(stencilMask(gO, 4), gO.w, gO.h, 60, 60), 60, 60],
  'chladni-mode17': () => { const f = modeAmplitude(plateModes(), 16, 64); return [f.amp, 64, 64]; },
};

const stored = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : {};
if (process.env.UPDATE) {
  mkdirSync(DIR, { recursive: true });
  const out = {}; for (const [k, f] of Object.entries(cases)) { const [v, w, h] = f(); out[k] = { w, h, data: encode(v) }; }
  writeFileSync(FILE, JSON.stringify(out, null, 1)); console.log('goldens written', Object.keys(out).length);
}
const now = process.env.UPDATE ? JSON.parse(readFileSync(FILE, 'utf8')) : stored;

for (const [k, f] of Object.entries(cases)) {
  test(`golden: ${k} matches by SSIM >= 0.99`, () => {
    assert.ok(now[k], `no golden for ${k}; run with UPDATE=1`);
    const [v, w, h] = f(), g = now[k];
    assert.equal(w, g.w); assert.equal(h, g.h);
    const s = ssim(decode(encode(v)), decode(g.data), w, h);
    assert.ok(s >= 0.99, `${k} SSIM ${s.toFixed(4)}`);
  });
}

test('ssim: identical is 1, a shifted pattern is lower, noise is far lower', () => {
  const w = 32, h = 32, a = new Float32Array(w * h), b = new Float32Array(w * h), c = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { a[y * w + x] = (x >> 2) % 2; b[y * w + x] = ((x + 2) >> 2) % 2; c[y * w + x] = ((x * 7919 + y * 104729) % 97) / 97; }
  assert.equal(ssim(a, a, w, h), 1); assert.ok(ssim(a, b, w, h) < 0.5); assert.ok(ssim(a, c, w, h) < 0.2);
});
