// study.test.mjs: the study generator's colour criterion against known answers and controls.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { deflateSync } from 'node:zlib';
import { encodePNG } from '../../feed-23/build/brush/png.js';
import { colour } from '../lib/study/colour.mjs';
import { runStudy } from '../lib/study/run.mjs';
import { subjectFromRGBA } from '../lib/study/load.mjs';
import { shuffled, uniform } from '../lib/study/controls.mjs';
import { renderPlate } from '../lib/study/render.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const opts = { controls: false };

// 200 x 100: yellow columns 0-99 (50%), blue 100-159 (30%), red 160-199 (20%).
function bands() {
  const w = 200, h = 100, rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) rgba.set(x < 100 ? [255, 255, 0, 255] : x < 160 ? [0, 0, 255, 255] : [255, 0, 0, 255], 4 * (y * w + x));
  return subjectFromRGBA(w, h, rgba, 'bands');
}
// A smooth, structured picture: three soft regions with gradients, for the shuffle control.
function blobs() {
  const w = 160, h = 120, rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const a = Math.hypot(x - 40, y - 40) < 30, b = x > 90;
    rgba.set(a ? [200, 60 + (x % 7), 40, 255] : b ? [30, 90, 160 + (y % 9), 255] : [220, 210, 170 + (x % 5), 255], 4 * (y * w + x));
  }
  return subjectFromRGBA(w, h, rgba, 'blobs');
}

test('known colours and areas: shares within 0.5% and exact hex', () => {
  const M = colour.measure(bands(), opts), sw = M.palette.swatches;
  assert.equal(sw.length, 3);
  const by = Object.fromEntries(sw.map(s => [s.hex, s.share]));
  assert.ok(Math.abs(by['#ffff00'] - 0.5) < 0.005, `yellow ${by['#ffff00']}`);
  assert.ok(Math.abs(by['#0000ff'] - 0.3) < 0.005, `blue ${by['#0000ff']}`);
  assert.ok(Math.abs(by['#ff0000'] - 0.2) < 0.005, `red ${by['#ff0000']}`);
});

test("balance distance matches a hand computation on both light scales", () => {
  const M = colour.measure(bands(), opts);
  // Goethe: yellow 9, blue 4, red 6 -> balanced shares (1/9, 1/4, 1/6) / (19/36) = 4/19, 9/19, 6/19;
  // d = 1/2 (|1/2 - 4/19| + |3/10 - 9/19| + |1/5 - 6/19|) = 11/38.
  assert.ok(Math.abs(M.extension.goethe.distance - 11 / 38) < 1e-6, `goethe ${M.extension.goethe.distance}`);
  // CIE L*: yellow 97.1393, blue 32.3026, red 53.2329 (sRGB primaries and yellow under D65)
  const inv = [1 / 97.1393, 1 / 32.3026, 1 / 53.2329], s = inv.reduce((a, b) => a + b), b = inv.map(v => v / s);
  const d = 0.5 * (Math.abs(0.5 - b[0]) + Math.abs(0.3 - b[1]) + Math.abs(0.2 - b[2]));
  assert.ok(Math.abs(M.extension.lstar.distance - d) < 1e-4, `lstar ${M.extension.lstar.distance} vs ${d}`);
  assert.equal(M.extension.lstar.scale, 'lstar'); assert.equal(M.extension.goethe.scale, 'goethe');
});

test('control: a uniform grey gives one swatch and distance 0', () => {
  const g = uniform([128, 128, 128]), M = colour.measure(subjectFromRGBA(g.w, g.h, g.rgba, 'grey'), opts);
  assert.equal(M.palette.swatches.length, 1);
  assert.equal(M.extension.lstar.distance, 0); assert.equal(M.extension.goethe.distance, 0);
  assert.ok(Math.abs(M.palette.swatches[0].share - 1) < 1e-12);
});

test('control: shuffled pixels keep the palette and shares; composition coherence falls', () => {
  const S = blobs(), A = colour.measure(S, opts), B = colour.measure(shuffled(S), opts);
  assert.deepEqual(B.palette.swatches.map(s => [s.hex, s.share]), A.palette.swatches.map(s => [s.hex, s.share]));
  assert.ok(A.composition.coherence > 0.9, `original ${A.composition.coherence}`);
  assert.ok(B.composition.coherence < A.composition.coherence - 0.3, `shuffled ${B.composition.coherence}`);
});

test('determinism: the same input gives byte-identical study.json', async () => {
  const a = await runStudy({ pixels: blobs(), render: false }), b = await runStudy({ pixels: blobs(), render: false });
  assert.ok(Buffer.compare(a.bytes, b.bytes) === 0);
  assert.match(a.study.receipt_sha256, /^[0-9a-f]{64}$/);
  assert.ok(a.study.criteria.colour.controls.shuffle.holds && a.study.criteria.colour.controls.grey.holds);
});

test('frame: six fields, studier intent declared, maker intent only ever inferred', async () => {
  const r = await runStudy({ pixels: bands(), render: false, frame: { need: 'a test', intent: { studier: 'check', maker: 'warmth' } } });
  assert.deepEqual(Object.keys(r.study.frame).sort(), ['criteria', 'intent', 'need', 'object', 'objective', 'perspective']);
  assert.equal(r.study.frame.need, 'a test');
  assert.equal(r.study.frame.intent.studier_status, 'declared');
  assert.equal(r.study.frame.intent.maker_status, 'inferred');
  const d = await runStudy({ pixels: bands(), render: false });
  assert.equal(d.study.frame.intent.maker, null);
});

test('plates render at 3840 px or more and refuse less', () => {
  const S = bands(), M = colour.measure(S, opts), [p] = colour.plates(M, S, { first: 2, of: 9 });
  p.images.subject = { w: S.w, h: S.h, rgba: S.rgba };
  const R = renderPlate(p, { width: 3840 });
  assert.equal(R.w, 3840); assert.ok(R.h > 1000);
  assert.throws(() => renderPlate(p, { width: 1920 }), /3840/);
});

test('Python reads it: canonical bytes, receipt and schema shape check out with python -I; a tampered copy fails', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'study-py-')), r = await runStudy({ pixels: blobs(), render: false, out: dir });
  const py = process.env.PYTHON ?? 'python', run = f => spawnSync(py, ['-I', join(ROOT, 'tools', 'study_verify.py'), f], { encoding: 'utf8' });
  const ok = run(r.path);
  assert.equal(ok.status, 0, ok.stdout + ok.stderr); assert.match(ok.stdout, /^OK/);
  const bad = readFileSync(r.path, 'utf8').replace('"coherence":', '"coherence":0.5,"x":'), f2 = join(dir, 'tampered.json');
  writeFileSync(f2, bad);
  const no = run(f2);
  assert.equal(no.status, 1); assert.match(no.stdout, /FAIL/);
});

test('CLI: prints only the study.json path on stdout', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'study-cli-')), S = bands(), png = join(dir, 'bands.png');
  writeFileSync(png, await encodePNG(S.w, S.h, S.rgba, b => deflateSync(b)));
  const out = execFileSync(process.execPath, [join(ROOT, 'tools', 'study.mjs'), png, '--no-plates', '--out', join(dir, 'o')], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  assert.equal(out.trim(), join(dir, 'o', 'study.json'));
  const j = JSON.parse(readFileSync(out.trim(), 'utf8'));
  assert.equal(j.subject.sha256.length, 64); assert.equal(j.criteria.colour.palette.swatches.length, 3);
});
