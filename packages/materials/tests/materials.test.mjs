// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: AGPL-3.0-only
// The JavaScript twin against the Python reference (tests/parity-vectors.json, written by tests/parity.py),
// the data files against their recorded hashes, and the superframe node. Each check has a control that fails.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as M from '../js/materials.mjs';
import { NODES, SHADEABLE } from '../js/node.mjs';
import { TYPES } from '../../../superframe/lib/types.mjs';
import { resolveParams } from '../../../superframe/lib/node.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const V = JSON.parse(readFileSync(HERE + 'parity-vectors.json', 'utf8'));
const REL = 1e-9;
const close = (a, b) => Math.abs(a - b) <= REL * Math.max(1e-3, Math.abs(a), Math.abs(b));
const allClose = (a, b) => a.length === b.length && a.every((v, i) => close(v, b[i]));

test('parity: the grid and illuminants A and sodium match the Python reference', () => {
  assert.deepEqual(M.GRID, V.grid);
  assert.ok(allClose(M.illuminant('A'), V.illuminant_A));
  assert.ok(allClose(M.illuminant('sodium'), V.illuminant_sodium));
  assert.ok(allClose(M.whiteXyz(M.illuminant('D65')), V.white_d65));
});

test('parity: Fresnel, Drude, Drude-Lorentz and CIELAB match to 1e-9 relative', () => {
  for (const c of V.fresnel) assert.ok(close(M.fresnel(c.n, c.k, c.cos), c.R), JSON.stringify(c));
  for (const c of V.drude) { assert.ok(allClose(M.drudeNk(c.nm, c.sigma, c.ne), c.nk), JSON.stringify(c)); assert.ok(close(M.hagenRubensK(c.nm, c.sigma), c.hr)); }
  const dl = JSON.parse(readFileSync(HERE + '../data/drude_lorentz.json', 'utf8')).metals;
  for (const c of V.lorentz_drude) assert.ok(allClose(M.lorentzDrudeNk(c.nm, dl[c.metal].params), c.nk), JSON.stringify(c));
  const white = M.whiteXyz(M.illuminant('D65'));
  for (const c of V.lab) assert.ok(allClose(M.xyzToLab(c.xyz, white), c.lab), JSON.stringify(c));
});

test(`parity: every shadeable material under D65 at 0, 30 and 60 degrees (${V.shaded_d65.length} cases)`, () => {
  const d65 = M.illuminant('D65'), bad = [];
  for (const c of V.shaded_d65) {
    const xyz = M.toXyz(M.shade(M.get(c.id), d65, c.theta), d65);
    if (!allClose(xyz, c.xyz)) bad.push(`${c.id}@${c.theta}`);
  }
  assert.deepEqual(bad, []);
  assert.ok(V.shaded_d65.length >= 300);
});

test('control: gold with its spectra shifted 10 nm fails the same parity tolerance', () => {
  const gold = M.get('gold'), d65 = M.illuminant('D65');
  const shift = a => a.map((_, i) => a[Math.min(a.length - 1, i + 2)]);
  const moved = { ...gold, optics: { ...gold.optics, n: { value: shift(gold.optics.n.value) }, k: { value: shift(gold.optics.k.value) } } };
  const ref = V.shaded_d65.find(c => c.id === 'gold' && c.theta === 0).xyz;
  assert.equal(allClose(M.toXyz(M.shade(moved, d65, 0), d65), ref), false);
});

test('data: every file under data/ matches SHA256SUMS; a changed byte would not', () => {
  const lines = readFileSync(HERE + '../SHA256SUMS', 'utf8').trim().split('\n');
  assert.ok(lines.length >= 9);
  for (const line of lines) {
    const [sum, name] = line.split(/\s+\*?/);
    const bytes = readFileSync(HERE + '../data/' + name);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), sum, name);
    const flipped = Buffer.from(bytes); flipped[0] ^= 1;
    assert.notEqual(createHash('sha256').update(flipped).digest('hex'), sum);
  }
});

test('node: materials.swatch renders gold yellow and silver neutral, with typed outputs', async () => {
  const [node] = NODES;
  assert.equal(node.id, 'materials.swatch');
  assert.ok(SHADEABLE.length >= 100);
  const run = async material => node.render({ params: resolveParams(node, { material }), w: 32, h: 4 });
  const g = await run('gold'), s = await run('silver');
  assert.equal(TYPES.raster.check(g.raster), null);
  assert.equal(TYPES.series.check(g.spectrum), null);
  const px = r => [r.data[0], r.data[1], r.data[2]];
  const [gr, gg, gb] = px(g.raster), [sr, , sb] = px(s.raster);
  assert.ok(gr > gg && gg > gb && gb < 0.6 * gr, `gold ${[gr, gg, gb]}`);
  assert.ok(Math.abs(sr - sb) < 0.1 * sr, `silver ${[sr, sb]}`);
  // control: the spectrum output follows the material, so two different metals must not match
  assert.notDeepEqual(Array.from(g.spectrum.y), Array.from(s.spectrum.y));
  assert.throws(() => resolveParams(node, { material: 'unobtainium' }));
});
