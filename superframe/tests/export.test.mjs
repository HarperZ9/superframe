// export.test.mjs: files written by the framework read back with the same size and content.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pngBytes, wavBytes, svgOf, midiBytes } from '../lib/export.mjs';
import { decodePNG, decodeWAV } from '../adapters/core.mjs';
import { make } from '../lib/types.mjs';

test('PNG round trip keeps size and colour within one code value', async () => {
  const R = make.raster(20, 10); for (let i = 0; i < 200; i++) R.data.set([0.2, 0.4, 0.6, 1], 4 * i);
  const p = decodePNG(await pngBytes(R, { seed: 't' }));
  assert.equal(p.w, 20); assert.equal(p.h, 10);
  assert.ok(Math.abs(p.rgba[0] - 124) <= 1 && Math.abs(p.rgba[2] - 203) <= 1, `${p.rgba[0]} ${p.rgba[2]}`);
});
test('WAV round trip keeps rate, channels and samples to 16-bit precision', () => {
  const a = make.audio(22050, [Float32Array.from({ length: 100 }, (_, i) => Math.sin(i / 5) * 0.5), new Float32Array(100)]);
  const b = decodeWAV(wavBytes(a));
  assert.equal(b.rate, 22050); assert.equal(b.channels.length, 2);
  assert.ok(Math.abs(b.channels[0][7] - a.channels[0][7]) < 1e-4);
});
test('SVG and MIDI exports are well formed', () => {
  assert.match(svgOf(make.vector(10, 10, [{ pts: [[1, 1], [9, 9]], width: 1 }])), /^<svg[^>]*viewBox="0 0 10 10"/);
  const m = midiBytes(make.events([{ t: 0, voice: 'pluck', args: { note: 60, dur: 0.5, vel: 0.5 } }]));
  assert.equal(String.fromCharCode(...m.slice(0, 4)), 'MThd');
});
