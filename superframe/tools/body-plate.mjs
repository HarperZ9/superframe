// body-plate.mjs: render the lib/body demo plate (leg sweep, foot-turn band, jaw sweep, contrapposto).
//   node tools/body-plate.mjs [out.png] [width]
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { renderPlate, pngOf } from '../lib/study/render.mjs';
import { platePlan } from '../lib/body/plate.mjs';

const [OUT = 'out/body/body-plate.png', W = '3840'] = process.argv.slice(2);
const R = renderPlate(platePlan(), { width: +W });
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, Buffer.from(await pngOf(R)));
console.log(`${OUT} ${R.w} x ${R.h}`);
