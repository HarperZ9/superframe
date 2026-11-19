// The Fourier descriptor kernel in BuildLang (fourier.bld) against its JS twin (lib/fourier/kernel.mjs): the
// real outlines of Hanken Grotesk Bold, resampled, transformed, truncated and aligned, compared bit for bit.
//   BUILDC=/path/to/buildc node --test lettering/native/fourier-native.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseTTF } from '../lib/fourier/ttf.mjs';
import { resample, dft, truncate, align } from '../lib/fourier/kernel.mjs';
import { N, K } from '../lib/fourier/shape.mjs';
import { fft } from '../../packages/perceive/src/fft.mjs';

const dir = fileURLToPath(new URL('./', import.meta.url)), BUILDC = process.env.BUILDC, EXE = process.platform === 'win32' ? '.exe' : '';
const font = parseTTF(readFileSync(new URL('../fonts/hanken-grotesk-bold.ttf', import.meta.url)));
const bits = (x) => { const b = new DataView(new ArrayBuffer(8)); b.setFloat64(0, x); return b.getBigUint64(0).toString(); };
const SCALE = 96, TOL = 0.25, TEXT = 'Rag8%Bo'; // N and K are the technique's own (512 points, 255 terms each side)

// the input: every contour of the sample, then each contour aligned to the next one
function input() {
  const cs = [];
  for (const ch of TEXT) for (const c of font.glyph(ch).contours) cs.push(c.pts);
  const lines = cs.map((p) => ['C', N, K, bits(SCALE), bits(TOL), p.length / 2, ...Array.from(p, bits)].join(' '));
  for (let i = 0; i + 1 < cs.length; i++) lines.push(`A ${i} ${i + 1}`);
  return { cs, text: lines.join('\n') + '\n' };
}

function jsRun(cs) {
  const out = [], rs = [];
  cs.forEach((p, i) => {
    const r = resample(p, N); rs.push(r);
    out.push(`P ${i} ${Array.from(r, bits).join(' ')}`);
    const c = dft(r, K);
    out.push(`F ${i} ${Array.from(c.k, (k, j) => `${k} ${bits(c.re[j])} ${bits(c.im[j])}`).join(' ')}`);
    const t = truncate(c, SCALE, TOL);
    out.push(`T ${i} ${t.kept} ${bits(t.bound)} ${t.keep.join('')}`);
  });
  for (let i = 0; i + 1 < cs.length; i++) { const a = align(rs[i], rs[i + 1]); out.push(`A ${i} ${i + 1} ${a.shift} ${a.rev} ${bits(a.cost)}`); }
  return out;
}

function blRun(srcDir, text) {
  const tmp = mkdtempSync(join(tmpdir(), 'fourier-in-')), f = join(tmp, 'in.txt');
  writeFileSync(f, text);
  execFileSync(BUILDC, ['build', '--release', '.'], { cwd: srcDir, stdio: 'pipe' });
  const out = execFileSync(join(srcDir, 'target', 'release', `main${EXE}`), [f], { encoding: 'utf8', maxBuffer: 1 << 28 }).trim().split(/\r?\n/);
  rmSync(tmp, { recursive: true, force: true });
  return out;
}

test('the BuildLang kernel gives the JS twin\'s bits for every resampled point, descriptor, cut and alignment', () => {
  if (!BUILDC) throw new Error('set BUILDC to a BuildLang compiler, 1.15.0 or later');
  const { cs, text } = input(), js = jsRun(cs), bl = blRun(dir, text);
  assert.equal(bl.length, js.length);
  const first = js.findIndex((l, i) => l !== bl[i]);
  assert.equal(first, -1, first < 0 ? '' : `line ${first} differs\n  js ${js[first].slice(0, 200)}\n  bl ${bl[first].slice(0, 200)}`);
  const values = cs.length * (2 * N + 3 * (2 * K + 1) + 2 * K + 1) + 3 * (cs.length - 1);
  console.log(`  ${cs.length} contours of "${TEXT}" and ${cs.length - 1} alignments: ${values} values equal to the bit`);
});

test('the comparison can fail: the BuildLang kernel with its summation reordered differs', () => {
  if (!BUILDC) throw new Error('set BUILDC to a BuildLang compiler, 1.15.0 or later');
  const tmp = mkdtempSync(join(tmpdir(), 'fourier-control-'));
  for (const f of ['main.bld', 'detmath.bld', 'fourier.bld']) writeFileSync(join(tmp, f), readFileSync(join(dir, f), 'utf8'));
  const src = readFileSync(join(tmp, 'fourier.bld'), 'utf8'), mutated = src.replace('a = a + (x * cs[q] + y * sn[q]);', 'a = (a + x * cs[q]) + y * sn[q];');
  assert.notEqual(mutated, src, 'the control\'s mutation did not apply');
  writeFileSync(join(tmp, 'fourier.bld'), mutated);
  const { cs, text } = input(), js = jsRun(cs), bl = blRun(tmp, text);
  const differ = js.filter((l, i) => l.startsWith('F') && l !== bl[i]).length;
  assert.ok(differ > cs.length / 2, `only ${differ} descriptor lines differ`);
  console.log(`  control: ${differ} of ${cs.length} descriptor lines differ after one reassociation`);
  rmSync(tmp, { recursive: true, force: true });
});

test('the twin agrees with the packages\' FFT (an independent radix-2 butterfly) to 1e-12 em', () => {
  const p = font.glyph('g').contours[0].pts, r = resample(p, N), c = dft(r, K), re = new Float64Array(N), im = new Float64Array(N);
  for (let n = 0; n < N; n++) { re[n] = r[2 * n]; im[n] = r[2 * n + 1]; }
  fft(re, im);
  let worst = 0;
  for (let j = 0; j < c.k.length; j++) { const b = ((c.k[j] % N) + N) % N; worst = Math.max(worst, Math.hypot(c.re[j] - re[b] / N, c.im[j] - im[b] / N)); }
  assert.ok(worst < 1e-12, `worst ${worst}`);
  console.log(`  worst descriptor difference against perceive/fft.mjs: ${worst.toExponential(2)} em over ${c.k.length} terms`);
});
