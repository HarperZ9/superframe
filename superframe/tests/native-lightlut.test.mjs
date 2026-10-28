// native-lightlut.test.mjs: the BuildLang kernel (native/lightlut/main.bld, linked into driver.c) gives the same
// light response as the JavaScript sampler on the real tables. The kernel reads the table as a slice whose length
// and grid side the host passes at run time (BuildLang C ABI slices); native/lightlut17 is the earlier build with
// the size fixed at 17. Skips when a driver or table is not built:
//   node tools/light-response.mjs <sources.mjs> out/light-response
//   node tools/light-response.mjs <sources.mjs> out/light-response-9 --n 9
//   buildc build --emit staticlib native/lightlut && gcc native/lightlut/driver.c -I native/lightlut/target/debug \
//     native/lightlut/target/debug/libmain.a $(cat native/lightlut/target/debug/main.link) -o native/lightlut/driver.exe
// Accept: the same bits as JS on every kind at grid 17 and grid 9 (both use the portable fdlibm pow, BuildLang
// DETMATH 5.5, and the same operations in the same order), and bit-identical to the fixed build at 17.
// Before the portable pow the gap was 2.7e-15, from the C library's pow.
// Control: with Math.pow in the gamma step the sampler no longer matches the kernel (the engine's pow is not the
// portable one), and a float count one short of the table makes the white lookup (the table's last entry) trap.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadTable, reflect } from '../lib/medium/lightlut.mjs';

const root = new URL('../', import.meta.url), path = p => fileURLToPath(new URL(p, root));
const drv = path('native/lightlut/driver.exe'), fixed = path('native/lightlut17/driver.exe');
const tableAt = dir => ({ bin: path(`${dir}/spectral-response.bin`), man: path(`${dir}/spectral-response.json`) });
const t17 = tableAt('out/light-response'), t9 = tableAt('out/light-response-9');
const built = t => existsSync(t.bin) && existsSync(t.man);

let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
const alb = Array.from({ length: 300 }, () => [rnd(), rnd(), rnd()]).concat([[0, 0, 0], [1, 1, 1], [1.4, -0.2, 0.5]]);
const input = alb.map(a => a.join(' ')).join('\n');
const run = (exe, args) => execFileSync(exe, args, { input }).toString().trim().split('\n');
const nums = lines => lines.map(l => l.split(' ').map(Number));

function matchesJs(t) {
  const M = JSON.parse(readFileSync(t.man, 'utf8')), T = loadTable(M, new Float32Array(readFileSync(t.bin).buffer.slice(0)));
  for (const k of M.kinds) {
    const out = nums(run(drv, [t.bin, String(k.offset_floats), String(M.grid)]));
    alb.forEach((a, i) => reflect(T, k.kind, a).forEach((v, c) => assert.equal(out[i][c], v, `grid ${M.grid} ${k.kind} ${a} ${c}: js ${v} bld ${out[i][c]}`)));
  }
}

test('the slice kernel gives the same bits as the JavaScript sampler on every light kind, grid 17', { skip: !(existsSync(drv) && built(t17)) }, () => matchesJs(t17));
test('the same kernel binary reads a grid-9 table: the size is a run-time value', { skip: !(existsSync(drv) && built(t9)) }, () => matchesJs(t9));
test('the slice kernel is bit-identical to the fixed-size build at grid 17', { skip: !(existsSync(drv) && existsSync(fixed) && built(t17)) }, () => {
  const M = JSON.parse(readFileSync(t17.man, 'utf8'));
  for (const k of M.kinds) assert.deepEqual(run(drv, [t17.bin, String(k.offset_floats), '17']), run(fixed, [t17.bin, String(k.offset_floats)]), k.kind);
});
test('control: a float count one short of the table traps on the lookup that needs the last float', { skip: !(existsSync(drv) && built(t17)) }, () => {
  const M = JSON.parse(readFileSync(t17.man, 'utf8')), short = String(17 * 17 * 17 * 3 - 1), k = M.kinds[0];
  const ok = spawnSync(drv, [t17.bin, String(k.offset_floats), '17', short], { input: '0.2 0.3 0.4\n' });
  assert.equal(ok.status, 0, 'a lookup inside the passed count still reads');
  const bad = spawnSync(drv, [t17.bin, String(k.offset_floats), '17', short], { input: '1 1 1\n' });
  assert.equal(bad.status, 101, `exit ${bad.status}`);
  assert.match(bad.stderr.toString() + bad.stdout.toString(), /index out of bounds: the len is 14738 but the index is 14738/);
});
test('control: the same sampler with Math.pow in its gamma step does not match the kernel', { skip: !(existsSync(drv) && built(t17)) }, () => {
  const M = JSON.parse(readFileSync(t17.man, 'utf8')), T = loadTable(M, new Float32Array(readFileSync(t17.bin).buffer.slice(0))), k = M.kinds[0];
  const out = nums(run(drv, [t17.bin, String(k.offset_floats), '17']));
  const differ = alb.filter((a, i) => reflect(T, k.kind, a, Math.pow).some((v, c) => v !== out[i][c])).length;
  assert.ok(differ > 0, 'Math.pow matched the portable pow on every input; this control cannot fail here');
});
