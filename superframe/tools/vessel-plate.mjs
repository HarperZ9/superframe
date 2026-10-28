// vessel-plate.mjs: the vessel tree under the measured branching law and under Murray's cube law (the control).
//   node tools/vessel-plate.mjs OUT_DIR SIZE DEPTH SEED
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { encodePNG } from '../../feed-23/build/brush/png.js';
import { grow, ARCADE } from '../lib/bio/vessels.mjs';
import { make } from '../lib/types.mjs';
import { paintVector, toSRGB8 } from '../lib/pix.mjs';
import { rngFrom } from '../lib/seed.mjs';

const [out, sizeArg, depthArg, seed] = process.argv.slice(2);
if (!seed) { console.error('usage: node tools/vessel-plate.mjs OUT_DIR SIZE DEPTH SEED'); process.exit(2); }
mkdirSync(out, { recursive: true });
const S = Number(sizeArg), depth = Number(depthArg), ink = '#5a1620', ground = '#efe6da', report = {};
for (const [name, x] of [['vessels-measured', ARCADE.exponent], ['vessels-cube', 3]]) {
  const g = grow({ w: S, h: S, rng: rngFrom(`${seed}/tree`), depth, exponent: x, minD: 0.6 });
  const V = make.vector(S, S, g.segs.map(s => ({ pts: s.pts, widths: s.pts.map((_, i) => s.d * (1 - 0.12 * i / (s.pts.length - 1))), stroke: ink })));
  const R = paintVector(V, { ground, ink });
  writeFileSync(`${out}/${name}.png`, await encodePNG(S, S, toSRGB8(R, rngFrom(`${seed}/dither`), { ground }), b => deflateSync(b, { level: 6 })));
  const r = g.forks.map(f => f.d1 / f.d0).sort((a, b) => a - b);
  report[name] = { exponent: x, segments: g.segs.length, root_d: +g.d0.toFixed(2), larger_child_over_parent: +r[r.length >> 1].toFixed(3) };
}
report.measured = { larger_child_over_parent: ARCADE.largeChild, source: ARCADE.source };
writeFileSync(`${out}/law.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report));
