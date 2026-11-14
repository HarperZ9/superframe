// The glyph skeleton: distance fields, outlines, centre lines, arc fields. Synthetic letters, no canvas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { edt, sdf, contours, components, maxInside } from '../lib/fields.mjs';
import { strokes, arcField, thin } from '../lib/skeleton.mjs';
import { buildGlyph } from '../lib/glyph.mjs';
import { L, O, T, I, shapeMask } from './shapes.mjs';

test('edt is exact against brute force', () => {
  const w = 31, h = 19, f = new Uint8Array(w * h); let s = 7;
  for (let i = 0; i < f.length; i++) { s = (s * 1103515245 + 12345) >>> 0; f[i] = s % 37 === 0 ? 1 : 0; }
  const { d2, near } = edt(f, w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let best = Infinity; for (let j = 0; j < w * h; j++) if (f[j]) best = Math.min(best, (j % w - x) ** 2 + (((j / w) | 0) - y) ** 2);
    assert.equal(d2[y * w + x], best, `d2 at ${x},${y}`);
    const n = near[y * w + x]; assert.equal((n % w - x) ** 2 + (((n / w) | 0) - y) ** 2, best);
  }
});

test('sdf is positive inside, negative outside, and peaks at half the ring width', () => {
  const { w, h, mask } = O(), d = sdf(mask, w, h);
  assert.ok(d[60 * w + 22] > 0, 'inside the ring'); assert.ok(d[60 * w + 60] < 0, 'in the counter'); assert.ok(d[5 * w + 5] < 0, 'outside');
  assert.ok(Math.abs(maxInside(d) - 8) < 1, `max inscribed radius ${maxInside(d)}`);
});

test('contours find the outer loop and the counter, with areas within 2 percent', () => {
  const { w, h, mask } = O(), loops = contours(mask, w, h);
  const outer = loops.filter(l => !l.hole), holes = loops.filter(l => l.hole);
  assert.equal(outer.length, 1); assert.equal(holes.length, 1);
  assert.ok(Math.abs(outer[0].area / (Math.PI * 46 * 46) - 1) < 0.02, `outer ${outer[0].area}`);
  assert.ok(Math.abs(-holes[0].area / (Math.PI * 30 * 30) - 1) < 0.02, `hole ${holes[0].area}`);
});

test('centre lines: L is one stroke, O one closed loop, T three strokes, i a stem and a dot', () => {
  const run = s => { const { w, h, mask } = s(), d = sdf(mask, w, h); return strokes(mask, d, w, h, { half: maxInside(d) }); };
  const l = run(L), o = run(O), t = run(T), i = run(I);
  assert.equal(l.length, 1); assert.equal(o.length, 1); assert.ok(o[0].closed);
  assert.ok(Math.abs(o[0].len / (2 * Math.PI * 38) - 1) < 0.05, `ring length ${o[0].len}`);
  assert.equal(t.length, 3, 'two arms and a stem'); for (const s of t) assert.ok(s.len > 30, `T stroke ${s.len}`);
  assert.equal(i.length, 2); assert.ok(i.some(s => s.len < 3), 'the dot survives thinning');
});

test('a short real arm is kept while thinning spurs go (the t crossbar)', () => {
  // a stem 16 wide (x 37 to 53) with a crossbar out 9 px each side; both arms must reach past the stem edges
  const w = 90, h = 120, mask = shapeMask(w, h, (x, y) => (x >= 37 && x <= 53 && y >= 10 && y <= 110) || (x >= 28 && x <= 62 && y >= 34 && y <= 46));
  const d = sdf(mask, w, h), st = strokes(mask, d, w, h, { half: maxInside(d) });
  const xs = st.flatMap(s => s.pts.filter((_, k) => k % 2 === 0));
  assert.ok(Math.min(...xs) < 35 && Math.max(...xs) > 55,  `crossbar reach ${Math.min(...xs)}..${Math.max(...xs)}`);
});

test('the arc field runs 0 to 1 in reading order and is zero distance on the line', () => {
  const g = buildGlyph(T()), A = g.arc;
  let lo = Infinity, hi = -Infinity; for (const v of A.arc) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  assert.ok(lo >= 0 && hi <= 1 && hi > 0.9, `arc range ${lo}..${hi}`);
  const s = g.strokes[0], x = Math.round(s.pts[10]), y = Math.round(s.pts[11]);
  assert.ok(A.dist[y * g.w + x] <= 1, 'on the centre line');
  // strokes are ordered by their leftmost x
  for (let k = 1; k < g.strokes.length; k++) assert.ok(g.strokes[k].minX >= g.strokes[k - 1].minX);
});

test('buildGlyph is deterministic and measures the stroke', () => {
  const a = buildGlyph(O()), b = buildGlyph(O());
  assert.deepEqual(a.strokes.map(s => s.pts.length), b.strokes.map(s => s.pts.length));
  assert.ok(Math.abs(a.half - 8) < 1.2, `half ${a.half}`);
  assert.equal(components(O().mask, 120, 120).parts.length, 1);
  assert.ok(thin(O().mask, 120, 120).reduce((s, v) => s + v, 0) > 150);
});
