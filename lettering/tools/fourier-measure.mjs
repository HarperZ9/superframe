// Reconstruction error per glyph per term count, as a table: Hausdorff distance in em between each glyph's outline
// (Hanken Grotesk Bold, flattened to 0.25 font units) and its Fourier series at 5, 9, 17, 33, 65, 129, 257 and all
// 511 terms, the worst contour of the glyph; then the shuffled-phase control at all terms; then the terms kept by
// the 0.25 px cut at 24, 96 and 400 px per em.
//   node lettering/tools/fourier-measure.mjs [out.tsv]
import { readFileSync, writeFileSync } from 'node:fs';
import { parseTTF } from '../lib/fourier/ttf.mjs';
import { trace, truncate } from '../lib/fourier/kernel.mjs';
import { glyphSeries, K } from '../lib/fourier/shape.mjs';
import { hausdorff, shuffledPhase } from '../lib/fourier/measure.mjs';

const font = parseTTF(readFileSync(new URL('../fonts/hanken-grotesk-bold.ttf', import.meta.url)));
const CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789&%@?', HS = [5, 9, 17, 33, 65, 129, 257, 2 * K + 1], PX = [24, 96, 400];
const flip = (p) => Float64Array.from(p, (v, i) => (i % 2 ? -v : v));
const rows = [['glyph', 'contours', ...HS.map((h) => `H${h}_em`), 'shuffled_em', ...PX.map((p) => `kept_at_${p}px`), 'terms'].join('\t')];
for (const ch of CHARS) {
  const out = font.glyph(ch, 0.25).contours.map((c) => flip(c.pts)), gs = glyphSeries(font, ch).contours;
  const e = HS.map((H) => Math.max(...gs.map((s, i) => hausdorff(trace(s.c, H, 600), out[i]))));
  const ctrl = Math.max(...gs.map((s, i) => hausdorff(trace(shuffledPhase(s.c, 11 + i), 2 * K + 1, 600), out[i])));
  const kept = PX.map((px) => gs.reduce((n, s) => n + truncate(s.c, px, 0.25).kept, 0));
  rows.push([ch, gs.length, ...e.map((v) => v.toFixed(5)), ctrl.toFixed(4), ...kept, gs.length * (2 * K + 1)].join('\t'));
}
const text = rows.join('\n') + '\n';
if (process.argv[2]) writeFileSync(process.argv[2], text);
process.stdout.write(text);
