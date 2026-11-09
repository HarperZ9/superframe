// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
// Write eye.golden.json from studio-engine's own eye, before the port runs.
//
//   git -C <studio-engine> show 328a0ddf:showcase/eye.js > <dir>/eye.js
//   node packages/studio/goldens/eye_from_studio_engine.mjs <dir>/eye.js 328a0ddf
//
// The goldens come from the source file, never from packages/studio/src, so the port cannot pass by comparing
// against itself. Inputs are the seeded buffers in tests/inputs.mjs; each case keeps the input's sha256 too.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { PIXEL_CASES, RENDER_CASES, casePixels } from '../tests/inputs.mjs';

const [src, commit] = process.argv.slice(2);
const eye = await import(pathToFileURL(src));
const sha = b => createHash('sha256').update(b).digest('hex');
const LF = b => Buffer.from(b.toString('utf8').replaceAll('\r\n', '\n'));

const cases = [...PIXEL_CASES, ...RENDER_CASES].map(c => {
  const { px, w, h, ch } = casePixels(c);
  return { ...c, input_sha256: sha(px), phash: eye.perceptualHash(px, w, h, ch), features: eye.features(px, w, h, ch) };
});
const byName = Object.fromEntries(cases.map(c => [c.name, c]));
const pairs = [['raked-concrete-s4', 'raked-concrete-s5'], ['raked-concrete-s4', 'chladni-s4'], ['rgba-64x48-s1', 'rgba-64x48-s2'], ['rgba-64x48-s1', 'rgba-64x48-s1']];
const drift = pairs.map(([a, b]) => ({ a, b, hamming: eye.hamming(byName[a].phash, byName[b].phash),
  verdict: eye.compareDrift(byName[a].input_sha256, byName[b].input_sha256, byName[a].phash, byName[b].phash) }));
drift.push({ a: 'rgba-64x48-s1', b: null, verdict: eye.compareDrift(byName['rgba-64x48-s1'].input_sha256, 'x', byName['rgba-64x48-s1'].phash, null) });
drift.push({ a: null, b: null, verdict: eye.compareDrift(null, 'x', null, null) });
const identity = { input: 'rgba-64x48-s1', sha256: await eye.identitySha256(casePixels(PIXEL_CASES[0]).px) };

const doc = { schema: 'superframe.studio.golden/1', port: 'eye', source: `HarperZ9/studio-engine@${commit}`,
  sourceFiles: { 'showcase/eye.js': sha(LF(readFileSync(src))) }, cases, drift, identity };
const dest = new URL('./eye.golden.json', import.meta.url);
writeFileSync(dest, JSON.stringify(doc, null, 1) + '\n');
console.log(`wrote eye.golden.json: ${cases.length} cases, ${drift.length} drift verdicts`);
