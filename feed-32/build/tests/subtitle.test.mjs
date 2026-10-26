import test from 'node:test';
import assert from 'node:assert/strict';
import { cues, layout, inkFor, composite, lineMask, MEASURED } from '../subtitle.mjs';
import { grade } from '../film.mjs';
import { raster } from '../../../feed-29/build/lib/field.mjs';
import { toSrgb, hexLin } from '../../../feed-29/build/lib/color.mjs';
import { set } from '../settype.mjs';

// The KEY cut list, measured (seconds).
const KEY_SHOTS = [[0, 4.33], [4.33, 7.07], [7.07, 8.97], [8.97, 9.87], [9.87, 10.93], [10.93, 14.47], [14.47, 17.57]];

test('cues on the KEY cut list follow the measured rules', () => {
  const c = cues(KEY_SHOTS, ['one', 'two', 'three', 'four', 'five']);
  assert.ok(Math.abs(c[0].on - 0.83) < 1e-9 && Math.abs(c[0].off - 2.86) < 1e-9, 'opening line waits, holds 2.03 s');
  assert.equal(c[1].on, 4.33, 'later lines enter on the cut');
  assert.ok(Math.abs(c[2].off - 8.77) < 1e-9, 'a line clears 0.2 s before the cut (KEY 8.77)');
  for (const q of c) { const s = KEY_SHOTS.find(([a, b]) => q.on >= a && q.on < b); assert.ok(q.off <= s[1] - 0.2 + 1e-9, 'never crosses a cut'); }
  assert.equal(c.length, 5, 'five shots are long enough (KEY also shows five lines)');
  assert.ok(!c.some(q => q.on >= 8.97 && q.on < 10.93), 'the 0.9 s and 1.06 s shots carry no line');
});

test('layout numbers at the KEY frame size', () => {
  const L = layout(1276, 718);
  assert.equal(L.baseline, 670); assert.ok(Math.abs(L.capPx - 20.8) < 0.1);
});

test('inkFor lands on #ceb144 after the default grade, within 3 code values', () => {
  const ink = inkFor(), R = raster(4, 4, ink), G = grade(R, { grain: { sd: 0 }, flicker: 0, halation: { strength: 0 } });
  const want = hexLin(MEASURED.ink).map(v => toSrgb(v) * 255), got = [0, 1, 2].map(c => toSrgb(G.px[c]) * 255);
  want.forEach((v, c) => assert.ok(Math.abs(got[c] - v) < 3, `ch ${c}: ${got[c]} vs ${v}`));
});

test('lineMask sets house type with the measured cap height and baseline', () => {
  const w = 640, h = 360, M = lineMask('Hollow lath', w, h, set());
  const L = layout(w, h); let top = h, bot = -1, left = w, right = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (M[y * w + x] > 0.5) { top = Math.min(top, y); bot = Math.max(bot, y); left = Math.min(left, x); right = Math.max(right, x); }
  assert.ok(Math.abs(bot - L.baseline) <= 1, `baseline ${bot} vs ${L.baseline}`);
  assert.ok(Math.abs(bot - top + 1 - L.capPx) <= 1.5, `cap ${bot - top + 1} vs ${L.capPx}`);
  assert.ok(Math.abs((left + right) / 2 - w / 2) < 4, 'centred');
});

test('composite is deterministic and leaves the frame untouched outside the mask', () => {
  const w = 320, h = 180, M = lineMask('river', w, h, set()), a = composite(raster(w, h, [0.1, 0.1, 0.1]), M, inkFor()), b = composite(raster(w, h, [0.1, 0.1, 0.1]), M, inkFor());
  assert.deepEqual(a.px, b.px);
  for (let i = 0; i < w * h; i++) if (M[i] === 0) assert.equal(a.px[3 * i], Math.fround(0.1));
});

// A busy plate: dark grass with bright blades and a pale band, the case where a bare yellow line fails.
import { glyphContrast, solveLegible, compositeLegible } from '../subtitle.mjs';
import { rng } from '../../../feed-29/build/lib/field.mjs';
function busy(w, h) {
  const R = raster(w, h, [0.05, 0.07, 0.02]), r = rng('busy');
  for (let i = 0; i < w * h; i++) { const v = r(); const x = i % w; const lit = v > 0.82 ? 0.5 : (x % 37) < 9 ? 0.32 : 0.04 + 0.1 * v; R.px[3 * i] = lit * 0.9; R.px[3 * i + 1] = lit; R.px[3 * i + 2] = lit * 0.45; }
  return R;
}

test('glyphContrast measures each glyph against its own surround (known values)', () => {
  const w = 120, h = 60, M = new Float32Array(w * h), G = raster(w, h, [0.2, 0.2, 0.2]);
  for (let y = 20; y < 40; y++) for (let x = 20; x < 30; x++) { M[y * w + x] = 1; G.px.fill(1, 3 * (y * w + x), 3 * (y * w + x) + 3); }
  for (let y = 20; y < 40; y++) for (let x = 80; x < 90; x++) { M[y * w + x] = 1; G.px.fill(0.25, 3 * (y * w + x), 3 * (y * w + x) + 3); }
  const c = glyphContrast(G, M, { reach: 4 });
  assert.equal(c.glyphs.length, 2);
  assert.ok(Math.abs(c.glyphs[0].ratio - 1.05 / 0.25) < 1e-6 && Math.abs(c.min - 0.3 / 0.25) < 1e-6, 'the dim glyph sets the minimum, against its own surround');
});

test('on a busy plate every glyph reaches 4.5:1 after the halo, on every frame; the bare line does not', () => {
  const w = 640, h = 360, src = busy(w, h), M = lineMask('the river keeps the last of the light', w, h, set());
  const bare = glyphContrast(grade(composite({ w, h, px: Float32Array.from(src.px) }, M, inkFor()), {}, { frame: 0 }), M);
  assert.ok(bare.min < 4.5, `control: the bare line should fail here (min ${bare.min.toFixed(2)})`);
  const L = solveLegible(src, M, { frame: 0 });
  for (const frame of [0, 7, 19, 45]) {
    const G = grade(compositeLegible({ w, h, px: Float32Array.from(src.px) }, M, L.ink, L.halo), {}, { frame }), c = glyphContrast(G, M);
    const low = c.glyphs.filter(g => g.ratio < 4.5);
    assert.equal(low.length, 0, `frame ${frame}: ${low.length} glyph parts under 4.5:1, worst ${c.min.toFixed(2)}`);
  }
});
