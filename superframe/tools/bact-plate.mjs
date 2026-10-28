// bact-plate.mjs: bacteria under the measured shape law, per species, and E. coli under the isotropic control.
//   node tools/bact-plate.mjs OUT_DIR SIZE COUNT SCALE SEED
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { encodePNG } from '../../feed-23/build/brush/png.js';
import { place, outline, slope, SOURCE } from '../lib/bio/bacteria.mjs';
import { make } from '../lib/types.mjs';
import { paintVector, toSRGB8 } from '../lib/pix.mjs';
import { rngFrom } from '../lib/seed.mjs';

const [out, sizeArg, countArg, scaleArg, seed] = process.argv.slice(2);
if (!seed) { console.error('usage: node tools/bact-plate.mjs OUT_DIR SIZE COUNT SCALE SEED'); process.exit(2); }
mkdirSync(out, { recursive: true });
const S = Number(sizeArg), report = { source: SOURCE };
const runs = [['e-coli', 'measured', '#2f5d50'], ['e-coli', 'isotropic', '#2f5d50'], ['b-subtilis', 'measured', '#3d4f7a'], ['s-aureus', 'measured', '#8a3b2e']];
for (const [sp, law, ink] of runs) {
  const scale = Number(scaleArg) * (sp === 's-aureus' ? 1.6 : 1);
  const cells = place({ w: S, h: S, species: sp, count: Number(countArg), law, scale, align: 0.4, rng: rngFrom(`${seed}/${sp}`) });
  const V = make.vector(S, S, cells.map(c => ({ pts: outline(c, 14), closed: true, fill: ink })));
  const ground = '#e9ece4', R = paintVector(V, { ground, ink });
  const name = `${sp}-${law}`;
  writeFileSync(`${out}/${name}.png`, await encodePNG(S, S, toSRGB8(R, rngFrom(`${seed}/d`), { ground }), b => deflateSync(b, { level: 6 })));
  report[name] = { cells: cells.length, slope: +slope(cells).toFixed(3) };
}
writeFileSync(`${out}/law.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report));
