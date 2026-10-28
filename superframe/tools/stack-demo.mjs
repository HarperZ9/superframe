// stack-demo.mjs: the four demo plates for lib/stack at 3840 px wide, into out/stack/.
//   node tools/stack-measure.mjs && node tools/stack-clip.mjs && node tools/stack-demo.mjs [--only 1,2,3,4]
import { readFileSync } from 'node:fs';
import { plateShutter, plateEcho } from './stack-plates-a.mjs';
import { plateOnion, plateStill } from './stack-plates-b.mjs';

const m = JSON.parse(readFileSync('out/stack/measures.json', 'utf8'));
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',').map(Number) : [1, 2, 3, 4];
const plates = { 1: plateShutter, 2: plateEcho, 3: plateOnion, 4: plateStill };
for (const k of only) await plates[k](m);
