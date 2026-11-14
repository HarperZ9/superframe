// tests/shape.test.mjs: skeleton modifiers change the construction, not only the paint.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { curl, shaped } from '../lib/shape.mjs';
import { face } from '../lib/faces.mjs';
import { instance, faceOf } from '../lib/program.mjs';
import { make } from '../lib/props.mjs';

const fam = JSON.parse(readFileSync(new URL('../families/current-1.json', import.meta.url), 'utf8'));
const ref = { source: 'accession', style: 'display', weight: 640 };
const area = (pts) => { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };

test('the flow field is divergence-free, so counters keep their area', () => {
  const m = { amp: 60, scale: 560, seed: 30 }, h = 0.5;
  for (const [x, y] of [[100, 200], [900, -150], [333, 700]]) {
    const div = (curl(x + h, y, m)[0] - curl(x - h, y, m)[0] + curl(x, y + h, m)[1] - curl(x, y - h, m)[1]) / (2 * h);
    assert.ok(Math.abs(div) < 1e-6, `div ${div}`);
  }
  const plain = face(ref).glyph('o'), bent = shaped({ ...ref, modifiers: [{ kind: 'flow', amp: 60, scale: 560, seed: 30 }] }).glyph('o');
  assert.notDeepEqual(bent.contours[1].pts, plain.contours[1].pts);
  const a0 = Math.abs(area(plain.contours[1].pts)), a1 = Math.abs(area(bent.contours[1].pts));
  assert.ok(Math.abs(a1 - a0) / a0 < 0.03, `counter area ${a0} -> ${a1}`);
});

test('a data series sets each letter\'s width construction (a remint, not a stretch)', () => {
  const lo = shaped({ ...ref, modifiers: [{ kind: 'width-series', range: [0.85, 1.2] }] }, { 'data.series': make.series([0, 0]) });
  const hi = shaped({ ...ref, modifiers: [{ kind: 'width-series', range: [0.85, 1.2] }] }, { 'data.series': make.series([0, 1]) });
  assert.ok(hi.glyph('z').advance > lo.glyph('z').advance * 1.1, 'z sits at the high end of the series');
  assert.equal(hi.glyph('a').advance, lo.glyph('a').advance, 'a sits at the low end in both');
  assert.throws(() => shaped({ ...ref, modifiers: [{ kind: 'width-series' }] }, {}), /needs input data.series/);
});

test('swashes grow only at ascenders, caps and descenders by default', () => {
  const sw = shaped({ ...ref, modifiers: [{ kind: 'swash', amount: 1, perGlyph: 2 }] });
  assert.ok((sw.glyph('l').swashes ?? 0) >= 1 && (sw.glyph('p').swashes ?? 0) >= 1, 'ascender and descender grow tails');
  for (const ch of 'aceimnrsuvwxz') assert.equal(sw.glyph(ch).swashes ?? 0, 0, `${ch} keeps its shape`);
  const all = shaped({ ...ref, modifiers: [{ kind: 'swash', amount: 1, perGlyph: 2, at: 'all', ends: 'any' }] });
  assert.ok('cenruz'.split('').some((ch) => (all.glyph(ch).swashes ?? 0) > 0), 'the control: at "all" x-height letters grow tails');
});

test('an axis can drive a modifier parameter, and the family draws through faceOf', () => {
  const i = instance(fam, { FLOW: 70 });
  assert.ok(Array.isArray(i.skeleton.modifiers) && i.skeleton.modifiers[1].amp === 70);
  assert.match(faceOf(i).id, /\+width-series\+flow\+swash$/);
  assert.throws(() => shaped({ ...ref, modifiers: [{ kind: 'melt' }] }), /unknown modifier/);
});
