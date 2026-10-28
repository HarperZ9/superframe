// bio-plate.mjs: render a measured biological law as a plate, with the law on and off.
//   node tools/bio-plate.mjs OUT_DIR SIZE COUNT SEED
// Writes nuclei-law.png (phi at the tissue value), nuclei-random.png (phi 0, the control), and law.json with the
// spacing ratio R measured on each, next to the tissue and random values from the dataset.
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { encodePNG } from '../../feed-23/build/brush/png.js';
import { place, cells, clarkR, PHI_TISSUE, TISSUE } from '../lib/bio/nuclei.mjs';
import { rngFrom } from '../lib/seed.mjs';

const [out, sizeArg, countArg, seed] = process.argv.slice(2);
if (!seed) { console.error('usage: node tools/bio-plate.mjs OUT_DIR SIZE COUNT SEED'); process.exit(2); }
mkdirSync(out, { recursive: true });
const S = Number(sizeArg), n = Number(countArg), hex = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
const [STAIN, CYTO, MEMB] = ['#3b2a6e', '#e7c3cf', '#8a4f6a'].map(hex);

async function plate(name, phi) {
  const rng = rngFrom(`${seed}/${name}`), p = place({ w: S, h: S, n, phi, rng }), { id, dist } = cells(p.x, p.y, S, S);
  const sp = S / Math.sqrt(p.x.length), r = TISSUE.radius * sp, rgba = new Uint8ClampedArray(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const k = y * S + x, edge = (x + 1 < S && id[k + 1] !== id[k]) || (y + 1 < S && id[k + S] !== id[k]);
    // stain falls off at the nucleus rim; cytoplasm darkens toward the membrane
    const t = Math.min(1, dist[k] / (0.5 * sp)), c = dist[k] < r ? STAIN : edge ? MEMB : CYTO.map((v, i) => v * (1 - 0.18 * t * t) + MEMB[i] * 0.18 * t * t);
    rgba.set([c[0], c[1], c[2], 255], 4 * k);
  }
  writeFileSync(`${out}/${name}.png`, await encodePNG(S, S, rgba, b => deflateSync(b, { level: 6 })));
  return { phi, nuclei: p.x.length, clarkR: +clarkR(p.x, p.y, S, S).toFixed(4) };
}
const law = { source: TISSUE.source, tissue: { clarkR: TISSUE.clarkR, mu2: TISSUE.mu2 }, random: { clarkR: TISSUE.poissonR }, law: await plate('nuclei-law', PHI_TISSUE), control: await plate('nuclei-random', 0) };
writeFileSync(`${out}/law.json`, JSON.stringify(law, null, 1));
console.log(JSON.stringify(law));
