// compose-eval.mjs: runs the registered checks P1 to P5 and the noise floor once, and writes the numbers.
//   node tools/compose-eval.mjs [out/compose/prereg-results.json]
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { p1, p2p3, p4, p5, noiseFloor } from '../lib/compose/prereg.mjs';

const OUT = process.argv[2] ?? 'out/compose/prereg-results.json';
const t0 = Date.now(), res = { date: '2026-10-28', registered: 'lib/compose/README.md PREREG' };
for (const [k, f] of [['P1', p1], ['P2P3', p2p3], ['P4', p4], ['P5', p5], ['floor', noiseFloor]]) {
  const t = Date.now(); res[k] = f(); res[k].seconds = (Date.now() - t) / 1000;
  console.log(k, JSON.stringify(res[k], (key, v) => (key === 'rows' ? undefined : v)));
}
res.seconds = (Date.now() - t0) / 1000;
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(res, null, 1));
console.log('wrote', OUT, res.seconds, 's');
