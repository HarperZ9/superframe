// flow.test.mjs: sound and data poured into the medium tank (lib/flow.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { modesFor, pourFeatures, flowAt } from '../lib/flow.mjs';
import { analyse } from '../lib/features.mjs';
import { analyseSeries } from '../lib/series.mjs';
import { pattern, series } from '../lib/synthetic.mjs';
import { Medium } from '../../superframe/lib/medium/index.mjs';

const F = analyse(pattern({ bpm: 120, beatsPerBar: 4, bars: 8, seed: 9 }).audio);

test('Kac in the tank: a tone admits several modes, and every candidate shares the tone within the tolerance', () => {
  const W = 192, D = 108 * 0.7, lam = (6 / W) ** 2 + (2 / D) ** 2, set = modesFor(lam, W, D, { tol: 0.08 });
  assert.ok(set.length >= 2, `${set.length} modes share the tone of (6, 2)`);
  for (const s of set) assert.ok(Math.abs(s.lambda - lam) / lam <= 0.08);
  assert.ok(new Set(set.map(s => `${s.m},${s.n}`)).size === set.length);
});

test('one mode per bar, chosen from its tone set, the same every run', () => {
  const a = pourFeatures(new Medium({ nx: 96, ny: 54, seed: 's' }), F), b = pourFeatures(new Medium({ nx: 96, ny: 54, seed: 's' }), F);
  assert.equal(a.modes.length, F.downbeats.length);
  assert.deepEqual(a.modes, b.modes);
  for (const M of a.modes) assert.ok(M.shared >= 1 && M.m >= 1 && M.n >= 0);
  assert.equal(a.presses.length, F.onsets.length, 'one press per onset');
  assert.ok(a.presses.every(p => p.x >= 0.06 && p.x <= 0.94), 'presses land inside the tank');
});

test('sound moves the water: a tank that heard the pattern is moving, a silent one is still', () => {
  const heard = flowAt(F, 3, { nx: 64, ny: 36, base: [] }).medium, quiet = flowAt(F, 3, { nx: 64, ny: 36, base: [], vib: 0, press: 0 }).medium;
  const energy = m => m.hv.reduce((s, v) => s + v * v, 0) + m.v.reduce((s, v) => s + v * v, 0);
  assert.ok(energy(heard) > 50 * energy(quiet) + 1e-6, `${energy(heard)} against ${energy(quiet)}`);
  assert.ok([...heard.u, ...heard.v].every(Number.isFinite));
});

test('data pours as one timed drop per observation and a drip whose rate follows the values, with no NaN', () => {
  const S = analyseSeries(series({ n: 40, period: 8 }), { duration: 8 }), m = new Medium({ nx: 64, ny: 36, seed: 'd' });
  const before = m.emitters.length; pourFeatures(m, S);
  const inks = m.emitters.slice(before).filter(e => e.kind === 'ink'), data = m.emitters.filter(e => e.kind === 'data');
  assert.equal(inks.length, 40 + 1, 'forty drops and the drip'); assert.equal(data.length, 1);
  assert.equal(data[0].props.target, inks[inks.length - 1].id, 'the data drives the drip');
  const { medium } = flowAt(S, 4, { nx: 64, ny: 36 });
  assert.ok([...medium.u, ...medium.pig[0]].every(Number.isFinite), 'no NaN (the medium data additive once read y[-1])');
});

