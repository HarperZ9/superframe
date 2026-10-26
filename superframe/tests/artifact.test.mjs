// tests for lib/artifact: the GROUND.md "Recipe and seed" tests and their controls.
//   same recipe and seed, 3 runs: identical bytes in every medium
//   a one-weight edit: every changed pixel lies inside that element's bbox (plus the stated margin), and the
//   sound changes only inside its time window
//   control: a seed change must alter the output; an edit to an unused word must alter nothing
//   isomer: same weights, new structure, different output; metamer: same daylight colour, split under tungsten
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { compute } from '../lib/artifact/render.mjs';
import { normalise, recipeHash, bbox } from '../lib/artifact/ir.mjs';
import { parseIntent } from '../lib/artifact/intent.mjs';
import { edit, reseed, isomer, metamer, route, cross } from '../lib/artifact/ops.mjs';
import { deltaE } from '../../creation/lib/core/spectral.mjs';

const BASE = {
  seed: 'ground', size: [384, 216], sim: [192, 108], text: 'a claim is a sheet over its sources',
  sound: { seconds: 2 },
  elements: [
    { id: 'coral', law: 'rd', ink: '#2b3a6b', region: { cx: 0.2, cy: 0.35, rx: 0.16, ry: 0.28 }, scale: 80 },
    { id: 'marble', law: 'marble', region: { cx: 0.55, cy: 0.5, rx: 0.15, ry: 0.3 }, scale: 80 },
    { id: 'frost', law: 'frost', ink: '#1f6466', region: { cx: 0.84, cy: 0.6, rx: 0.13, ry: 0.3 }, scale: 80 },
  ],
};
const sha = a => createHash('sha256').update(Buffer.from(a.buffer, a.byteOffset, a.byteLength)).digest('hex');
const media = o => ({ paint: o.paint.rgb, type: o.type.rgb, lines: o.lines.cover, material: o.material.height, L: o.sound.channels[0], R: o.sound.channels[1] });
const hashes = o => Object.fromEntries(Object.entries(media(o)).map(([k, v]) => [k, sha(v)]));

test('same recipe and seed give the same bytes in every medium, three runs', () => {
  const H = [0, 1, 2].map(() => hashes(compute(BASE)));
  assert.deepEqual(H[1], H[0]); assert.deepEqual(H[2], H[0]);
});

test('a one-weight edit changes pixels only inside that element\'s bbox, and sound only in its window', () => {
  const a = compute(BASE), b = compute(edit(BASE, 'elements.marble.weights.drops', 6)), r = normalise(BASE), [W, H] = r.size, [w, h] = r.sim;
  const B = bbox(r.elements[1], w, h), sx = W / w, margin = 2 * sx + 4 + 2 * 3;   // bilinear reach, normals and stroke, and the unsharp mask's 2r
  const X0 = B.x0 * sx - margin, X1 = B.x1 * sx + margin, Y0 = B.y0 * sx - margin, Y1 = B.y1 * sx + margin;
  const report = {};
  for (const [k, A] of Object.entries(media(a))) {
    if (k === 'L' || k === 'R') continue;
    const Bv = media(b)[k], C = A.length / (W * H); let inside = 0, outside = 0;
    for (let i = 0; i < A.length; i++) if (A[i] !== Bv[i]) { const p = (i / C) | 0, x = p % W, y = (p / W) | 0; if (x >= X0 && x < X1 && y >= Y0 && y < Y1) inside++; else outside++; }
    report[k] = { inside, outside };
    assert.equal(outside, 0, `${k}: ${outside} pixels changed outside the edited element`);
  }
  assert.ok(report.paint.inside > 0, 'the edit must change something (control)');
  const n = a.sound.channels[0].length, t0 = Math.floor((B.x0 - 1) / w * n), t1 = Math.ceil((B.x1 + 1) / w * n); let out = 0, inn = 0;
  for (const c of [0, 1]) for (let i = 0; i < n; i++) if (a.sound.channels[c][i] !== b.sound.channels[c][i]) (i >= t0 && i < t1 ? inn++ : out++);
  assert.equal(out, 0, `sound changed ${out} samples outside the element's time window`); assert.ok(inn > 0);
});

test('control: a seed change alters every medium', () => {
  const a = hashes(compute(BASE)), b = hashes(compute(reseed(BASE, 'ground-2')));
  for (const k of ['paint', 'type', 'lines', 'material', 'L']) assert.notEqual(a[k], b[k], k);
});

test('control: editing an unused word alters nothing', () => {
  const p1 = parseIntent('heavy indigo coral upper left, faint ochre marble in the centre, lovely fine frost on the right', { seed: 's' });
  const p2 = parseIntent('heavy indigo coral upper left, faint ochre marble in the centre, luminous fine frost on the right', { seed: 's' });
  assert.notDeepEqual(p1.report.unused, p2.report.unused);
  assert.equal(recipeHash(normalise(p1.recipe)), recipeHash(normalise(p2.recipe)));
  const small = p => ({ ...p.recipe, size: [192, 108], sim: [96, 54], sound: { seconds: 1 } });
  assert.deepEqual(hashes(compute(small(p1))), hashes(compute(small(p2))));
});

test('isomer: same weights, new structure, different output', () => {
  const iso = isomer(BASE, 'permute'), w = r => r.elements.map(e => JSON.stringify([e.law, e.weights, e.ink])).sort();
  assert.deepEqual(w(iso), w(BASE));
  assert.notEqual(hashes(compute(iso)).paint, hashes(compute(BASE)).paint);
});

test('metamer: one element matches in daylight and splits under tungsten', () => {
  const r = normalise(BASE), [w] = r.sim, a = compute(BASE, { only: [] }), b = compute(metamer(BASE, 'coral', { scale: 1 }), { only: [] }), B = bbox(r.elements[0], ...r.sim);
  let d65 = 0, A = 0, n = 0;
  for (let y = B.y0; y < B.y1; y++) for (let x = B.x0; x < B.x1; x++) {
    const k = 3 * (y * w + x), px = (S, i) => [S[i], S[i + 1], S[i + 2]];
    if (a.layers[0].layer.fields.amount[y * w + x] < 0.2) continue;
    d65 += deltaE(px(a.paint.sim.d65, k), px(b.paint.sim.d65, k)); A += deltaE(px(a.paint.sim.A, k), px(b.paint.sim.A, k)); n++;
  }
  assert.ok(n > 50); d65 /= n; A /= n;
  assert.ok(A > d65 * 1.5, `tungsten split ${A.toFixed(3)} should exceed daylight difference ${d65.toFixed(3)}`);
});

test('route and cross are recipes too; the study names unread weights and records every medium', () => {
  const routed = route(BASE, 'coral', 'sound', 0), o = compute(routed);
  assert.equal(o.study.elements[0].transparency_record.sound.weight, 0);
  assert.equal(o.study.elements[0].transparency_record.sound.correlation, null);
  const crossed = cross(BASE, { elements: [{ id: 'm2', law: 'marble' }, { id: 'net', law: 'physarum', region: { cx: 0.5, cy: 0.2, rx: 0.1, ry: 0.1 } }] });
  assert.deepEqual(crossed.elements.map(e => e.law), ['rd', 'marble', 'frost', 'physarum']);
  const s = compute(edit(BASE, 'elements.frost.weights.bogus', 3)).study.elements[2].weights;
  assert.ok(s.unread.includes('bogus')); assert.ok(!s.unread.includes('preset'));
  for (const e of o.study.elements) assert.deepEqual(Object.keys(e.transparency_record), ['type', 'paint', 'lines', 'material', 'sound']);
});
