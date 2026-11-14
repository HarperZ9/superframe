// tests/props.test.mjs: the property-type schema and the adapter graph. Every adapter is run on a real value of its
// input type and its output is checked against its declared type, so a wall that leaks shows here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROPS, PROP_NAMES, make, checkProp, as } from '../lib/props.mjs';
import { ADAPTERS, route, convert, reachable } from '../lib/adapters.mjs';
import { defineMaterial } from '../lib/material.mjs';

const W = 64, H = 32;
function samples() {
  const cov = new Float32Array(W * H); for (let y = 8; y < 24; y++) for (let x = 10; x < 54; x++) cov[y * W + x] = 1;
  const sine = new Float32Array(22050); for (let i = 0; i < sine.length; i++) sine[i] = Math.sin(i * 0.2) * (i % 4000 < 300 ? 1 : 0.1);
  return {
    'coverage': make.coverage(W, H, cov), 'field.sdf': convert(make.coverage(W, H, cov), 'field.sdf'), 'field.scalar': make.scalar(W, H, cov.map((v) => v * 0.5)),
    'surface.albedo': make.albedo(W, H, new Float32Array(W * H * 4).fill(0.5)), 'surface.height': make.height(W, H, cov.map((v) => v * 12)),
    'surface.normal': make.normal(W, H, new Float32Array(W * H * 3)), 'light.emission': make.emission(W, H, new Float32Array(W * H * 4).fill(0.3)),
    'light.dispersion': make.dispersion(W, H), 'light.refraction': make.refraction(W, H),
    'structure.strokes': make.strokes(W, H, [{ pts: [[10, 16], [54, 16]], width: 4 }]), 'structure.cells': make.cells(W, H, 8, 8, 4, new Float32Array(32).fill(0.5)),
    'structure.particles': make.particles(W, H, Float32Array.from([10, 20, 30]), Float32Array.from([10, 12, 14]), { size: Float32Array.from([2, 2, 2]) }),
    'structure.graph': make.graph(W, H, [[1, 1], [9, 9]], [[0, 1]]), 'sound.pcm': make.pcm(22050, [sine]),
    'sound.spectrum': make.spectrum(8, 16, new Float32Array(128).map((_, i) => (i % 5) / 5)), 'sound.onsets': make.onsets(2, [0.1, 0.9], [1, 0.5]),
    'data.series': make.series([3, 1, 4, 1, 5, 9, 2, 6]), 'data.values': make.values({ a: 1, b: 2 }),
    'motion.velocity': make.velocity(W, H), 'motion.phase': make.phase(W, H), 'motion.clock': make.clock(0.5, 4, 24),
  };
}

test('every property type accepts its constructor and refuses a wrong shape', () => {
  const S = samples();
  for (const p of PROP_NAMES) {
    if (p === 'provenance') continue;
    assert.ok(S[p], `a sample exists for ${p}`);
    assert.equal(checkProp(p, S[p]), null, `${p} accepts its own value`);
    assert.notEqual(checkProp(p, { w: 3, h: 3 }), null, `${p} refuses an empty object`);
  }
  assert.throws(() => as('coverage', { w: 2, h: 2, data: new Float32Array(3) }), /w\*h\*1/);
  assert.notEqual(checkProp('coverage', S['field.sdf']), null, 'a tagged value of another type is refused by name');
});

test('every adapter runs on a real input and returns its declared type', () => {
  const S = samples();
  for (const a of ADAPTERS) {
    const out = a.call(S[a.from], { w: W, h: H, seed: 't' });
    assert.equal(out.prop, a.to, `${a.from} -> ${a.to} tags its output`);
    assert.equal(checkProp(a.to, out), null, `${a.from} -> ${a.to} output checks`);
  }
});

test('an adapter given the wrong input type stops at the edge', () => {
  const S = samples(), a = ADAPTERS.find((x) => x.from === 'coverage' && x.to === 'field.sdf');
  assert.throws(() => a.call(S['data.series']), /input/);
});

test('the walls are gone: sound reaches strokes, data reaches coverage, a letter reaches sound', () => {
  for (const [f, t] of [['coverage', 'sound.pcm'], ['sound.pcm', 'field.scalar'], ['data.series', 'structure.strokes'], ['sound.pcm', 'data.series'], ['field.sdf', 'motion.velocity'], ['surface.albedo', 'light.emission']]) {
    assert.ok(route(f, t), `a route exists from ${f} to ${t}`);
  }
  assert.ok(reachable('coverage').length >= 14, 'coverage reaches most of the panel');
});

test('provenance is data only: no adapter touches it and no material may draw it', () => {
  assert.ok(PROPS.provenance.dataOnly);
  assert.ok(ADAPTERS.every((a) => a.from !== 'provenance' && a.to !== 'provenance'));
  assert.equal(route('provenance', 'coverage'), null);
  assert.throws(() => defineMaterial({ id: 'leak', consumes: ['provenance'], provides: ['surface.albedo'], font: () => ({ kind: 'live' }), render: () => ({}) }), /provenance/);
});

test('convert refuses an untagged value', () => {
  assert.throws(() => convert({ w: 1, h: 1, data: new Float32Array(1) }, 'field.sdf'), /no prop tag/);
});

test('the signed distance is negative inside and positive outside', () => {
  const S = samples(), d = S['field.sdf'].data;
  assert.ok(d[16 * W + 30] < -3, 'centre of the bar is inside');
  assert.ok(d[2 * W + 2] > 3, 'the corner is outside');
});
