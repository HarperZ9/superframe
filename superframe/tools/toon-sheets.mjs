// toon-sheets.mjs: write the 4K model sheet of every cast member.
//   node tools/toon-sheets.mjs [outDir] [id ...]
import { CAST } from '../lib/toon/cast/index.mjs';
import { modelSheet } from '../lib/toon/sheet.mjs';
import { writePng } from '../lib/toon/out.mjs';

const out = process.argv[2] ?? 'out/toon/sheets', only = process.argv.slice(3);
for (const [i, c] of CAST.entries()) {
  if (only.length && !only.includes(c.id)) continue;
  const t = Date.now(), K = modelSheet(c, { index: i + 1, of: CAST.length });
  const path = await writePng(`${out}/${String(i + 1).padStart(2, '0')}-${c.id}-model-sheet.png`, K, `sheet/${c.id}`);
  console.log(`${path} ${K.w}x${K.h} ${Date.now() - t} ms`);
}
