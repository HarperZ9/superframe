// plotsheet.test.mjs: the make command's door to Plot Sheet (lib/artifact/plotsheet.mjs, packages/plot-sheet).
// Plot Sheet's own tests are BuildLang (packages/plot-sheet/bld/selftest.bld); these cover only the hand-off:
//   the input text: contours to pen 1, hatching to pen 2, a closed path as a loop, the frame as the source extent
//   default: an artifact written without --plot has the same files as before, and no plot file
//   with a sheet: five files, listed in the manifest with hashes, two pen layers in millimetres, ordering no worse
//   than the arriving order, and the same bytes on a second run
//   control: a specification with no pen is refused, with Plot Sheet's own message
// The tests that run the program skip when it is not built and buildc is not on PATH; PLOT_SHEET_REQUIRE=1 turns
// that skip into a failure (CI sets it in the BuildLang job).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compute, write } from '../lib/artifact/render.mjs';
import { plotInput, plotSheet, plotSheetProgram } from '../lib/artifact/plotsheet.mjs';

const RECIPE = {
  seed: 'plot-hook', size: [384, 216], sim: [192, 108], text: 'a sheet', sound: { seconds: 1 },
  elements: [{ id: 'coral', law: 'rd', ink: '#2b3a6b', region: { cx: 0.35, cy: 0.5, rx: 0.3, ry: 0.4 }, scale: 80 }],
};
let program = null, why = '';
try { program = plotSheetProgram(); } catch (e) { why = e.message; }
if (!program && process.env.PLOT_SHEET_REQUIRE === '1') throw new Error(`PLOT_SHEET_REQUIRE is set and Plot Sheet cannot run: ${why}`);
const skip = program ? false : 'Plot Sheet is not built and buildc is not on PATH';
const out = compute(RECIPE), dir = () => mkdtempSync(join(tmpdir(), 'plot-hook-'));

test('the input text maps contours to pen 1, hatching to pen 2, and closed paths to loops', () => {
  const V = { w: 100, h: 50, paths: [{ pts: [[0, 0], [10, 0]], closed: false }, { pts: [[1, 1], [2, 2]], closed: false, hatch: true }, { pts: [[0, 0], [5, 0], [5, 5]], closed: true }, { pts: [[3, 3]], closed: false }] };
  const two = plotInput(V, 'a4', { title: 'two\nlines', seed: 's' }).split('\n');
  assert.deepEqual(two.slice(0, 4), ['plotsheet 1', 'title two lines', 'seed s', 'source 100 50']);
  assert.deepEqual(two.filter(l => /^(path|loop) /.test(l)), ['path 1 #000000 0 0 0 10 0', 'path 2 #000000 0 1 1 2 2', 'loop 1 #000000 0 0 0 5 0 5 5']);
  const one = plotInput(V, 'paper 100 100\npen 0.3 #000000 50 - only');
  assert.ok(one.includes('path 1 #000000 0 1 1 2 2'), 'with one pen the hatching goes to it');
  assert.ok(!plotInput(V, 'a4', { fit: 'ink' }).includes('source '), 'fit ink leaves the extent to the bounding box');
});

test('default: an artifact written without a plot sheet has no plot file', () => {
  const d = dir(), m = write(out, d, { title: 'plain' });
  assert.equal(Object.keys(m.files).length, 14);
  assert.ok(!readdirSync(d).some(f => f.startsWith('plot.')), 'no plot file');
  assert.ok(!('plot' in m), 'no plot line in the manifest');
});

test('with a sheet: five files in the manifest, two pen layers in millimetres, ordering no worse', { skip }, () => {
  const d = dir(), m = write(out, d, { title: 'sheet', plot: 'a4' });
  for (const f of ['plot.plot', 'plot.svg', 'plot.hpgl', 'plot.gcode', 'plot.json']) { assert.ok(existsSync(join(d, f)), f); assert.match(m.files[f].sha256, /^[0-9a-f]{64}$/); }
  const S = JSON.parse(readFileSync(join(d, 'plot.json'), 'utf8')), svg = readFileSync(join(d, 'plot.svg'), 'utf8');
  assert.deepEqual(S.paper_mm, [297, 210]);
  assert.equal(S.pens.filter(p => p.paths > 0).length, 2, 'contours and hatching are two layers');
  assert.ok(S.totals.paths > 50 && S.totals.drawn_m > 1, `paths ${S.totals.paths}, drawn ${S.totals.drawn_m} m`);
  assert.ok(S.totals.pen_up_travel_m_after <= S.totals.pen_up_travel_m_before, 'ordering never adds travel');
  assert.match(svg, /width="297mm" height="210mm" viewBox="0 0 297 210"/);
  assert.deepEqual([...new Set(svg.match(/stroke-width="[^"]+"/g))].sort(), ['stroke-width="0.3"', 'stroke-width="0.5"']);
  assert.equal((svg.match(/<path /g) ?? []).length, S.totals.paths);
  assert.match(m.plot, /^plot sheet: \d+ paths, 2 pens/);
});

test('the same recipe gives the same plot bytes on a second run', { skip }, () => {
  const a = write(out, dir(), { plot: 'a4' }), b = write(compute(RECIPE), dir(), { plot: 'a4' });
  for (const f of ['plot.plot', 'plot.svg', 'plot.hpgl', 'plot.gcode', 'plot.json']) assert.equal(a.files[f].sha256, b.files[f].sha256, f);
});

test('control: a specification with no pen is refused', { skip }, () => {
  assert.throws(() => plotSheet(out.lines.V, 'paper 297 210\nmargin 10', dir()), /no pen listed/);
});
