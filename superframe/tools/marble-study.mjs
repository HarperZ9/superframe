// marble-study.mjs: marble several sources on one bath and write the three readings.
//   node tools/marble-study.mjs OUT_DIR SIZE SEED a.png:3 b.png:2 ...   (path:weight; 8-bit PNGs)
// Writes bath.png (observe), labels.png and study.json (shares, contacts, a core sample), unmarbled-<k>.png
// (each source gathered back from its streaks), and recreate.png (the same inks under another seed).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { basename } from 'node:path';
import { decodePNG } from '../adapters/core.mjs';
import { encodePNG } from '../../feed-23/build/brush/png.js';
import { lay, read, shares, contacts, core, render, unmarble } from '../lib/marble/bath.mjs';

const [out, sizeArg, seed, ...specs] = process.argv.slice(2);
if (!specs.length) { console.error('usage: node tools/marble-study.mjs OUT_DIR SIZE SEED a.png:3 b.png:2 ...'); process.exit(2); }
mkdirSync(out, { recursive: true });
const size = Number(sizeArg);
const sources = specs.map(s => { const i = s.lastIndexOf(':'); return { id: basename(s.slice(0, i)), path: s.slice(0, i), weight: Number(s.slice(i + 1)) }; });
const images = sources.map(s => decodePNG(readFileSync(s.path)));
const png = async (name, im) => writeFileSync(`${out}/${name}`, await encodePNG(im.w, im.h, im.rgba, b => deflateSync(b, { level: 6 })));
const LABEL = [[196, 62, 48], [52, 110, 190], [226, 178, 40], [40, 140, 96], [140, 70, 160], [30, 30, 30]];

const opts = { size: [size, size], sources, fill: 0.62, comb: 0.09, tines: 9 };
const bath = lay({ ...opts, seed }), map = read(bath), n = sources.length;
const picture = render(map, images);
await png('bath.png', picture);
await png('labels.png', render(map, sources.map((_, k) => LABEL[k % LABEL.length])));
const back = [];
for (let k = 0; k < n; k++) { const u = unmarble(map, picture, k, 512); await png(`unmarbled-${k}.png`, u); back.push(u.coverage); }
await png('recreate.png', render(read(lay({ ...opts, seed: `${seed}/recreate` })), images));

const sh = shares(map, n), M = contacts(map, n), names = ['ground', ...sources.map(s => s.id)];
const pairs = [];
for (let i = 0; i <= n; i++) for (let j = i + 1; j <= n; j++) if (M[i][j]) pairs.push({ a: names[i], b: names[j], edge: M[i][j] });
pairs.sort((x, y) => y.edge - x.edge);
const runs = core(map, [0, size / 2], [size, size / 2], size).map(r => ({ src: names[r.src + 1], len: r.len }));
const study = {
  seed, size, sources: sources.map((s, k) => ({ id: s.id, weight: s.weight, share: +sh.sources[k].toFixed(5), recovered: +back[k].toFixed(4), label: LABEL[k % LABEL.length] })),
  ground: +sh.ground.toFixed(5), contacts: pairs, core: { line: 'horizontal, middle', runs: runs.length, sequence: runs }
};
writeFileSync(`${out}/study.json`, JSON.stringify(study, null, 1));
console.log(JSON.stringify({ shares: study.sources.map(s => [s.id, s.weight, s.share, s.recovered]), ground: study.ground, top: pairs.slice(0, 4), coreRuns: runs.length }));
