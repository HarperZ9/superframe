// finish.test.mjs: the composition rules hold on the finished picture, and events sound through the v3 instruments.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registry } from '../lib/registry.mjs';
import { evaluate } from '../lib/graph.mjs';
import { toSRGB8 } from '../lib/pix.mjs';
import { rngFrom } from '../lib/seed.mjs';
import { renderEvents, VOICE_ROUTE } from '../lib/voices.mjs';
import { make } from '../lib/types.mjs';

const R = { seed: 'f', size: [128, 128], palette: { ground: '#ebe5d8', ink: '#15130f', accent: '#c4632b' },
  nodes: [{ id: 'm', node: 'chladni.membrane' }, { id: 'f', node: 'compose.finish', params: { place: 'centre', scale: 0.6 }, in: { subject: 'm' } }], out: { image: 'f' } };

test('one subject on a calm ground, with grain as the finish pass', async () => {
  const ev = await evaluate(R, registry), px = toSRGB8(ev.outputs.image, rngFrom('t')), at = (x, y) => px[4 * (y * 128 + x)];
  // the margin is calm ground: near the ground colour (235) and quiet, but not a flat fill (grain is on it)
  const margin = []; for (let y = 2; y < 14; y++) for (let x = 2; x < 126; x++) margin.push(at(x, y));
  const mean = margin.reduce((a, b) => a + b, 0) / margin.length, sd = Math.sqrt(margin.reduce((a, b) => a + (b - mean) ** 2, 0) / margin.length);
  assert.ok(Math.abs(mean - 235) < 18, `ground mean ${mean.toFixed(1)}`);
  assert.ok(sd > 0.3 && sd < 8, `ground grain sd ${sd.toFixed(2)} code values`);
  // the subject in the centre carries real contrast
  const mid = []; for (let y = 44; y < 84; y++) for (let x = 44; x < 84; x++) mid.push(at(x, y));
  assert.ok(Math.max(...mid) - Math.min(...mid) > 80, 'the subject has tonal range');
});

test('events sound through the v3 instruments, audibly and under the ceiling', () => {
  const ev = make.events([{ t: 0, voice: 'pluck', args: { note: 60, dur: 0.4, vel: 0.6 } }, { t: 0.5, voice: 'kick', args: { vel: 0.8 } }, { t: 1, voice: 'pad', args: { note: 52, dur: 1 } }], 2);
  const a = renderEvents(ev, { rng: rngFrom('v') }), x = a.channels[0];
  let peak = 0, e = 0; for (const v of x) { peak = Math.max(peak, Math.abs(v)); e += v * v; }
  assert.ok(peak > 0.01 && peak <= 0.891, `peak ${peak}`);
  assert.ok(Math.sqrt(e / x.length) > 1e-3);
  assert.equal(VOICE_ROUTE.pluck, 'keys');
});
