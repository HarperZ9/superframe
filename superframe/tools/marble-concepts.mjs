// marble-concepts.mjs: marble library studies as concept inks and write the reading.
//   node tools/marble-concepts.mjs OUT_DIR SIZE SEED study-id ... [--equal] [--rings] [--summed]
// --equal: every concept in a study weighs the same (default idf). --rings: concentric layout (default sectors).
// --summed: a study weighs the sum of its concepts (default: every study weighs the same).
// Writes ideas.png (coloured by concept), labels.png (by study), recreate.png (another seed, same weights) and
// reading.json / reading.md: each concept's share, borders inside a study, and the meetings across studies.
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { encodePNG } from '../../feed-23/build/brush/png.js';
import { lay, read, render, readElements, conceptReading, renderConcepts, exposure } from '../lib/marble/bath.mjs';
import { loadLibrary, sourcesFor } from '../lib/marble/library.mjs';

const args = process.argv.slice(2), flag = f => args.includes(f), equal = flag('--equal'), layout = flag('--rings') ? 'rings' : 'sectors';
const [out, sizeArg, seed, ...ids] = args.filter(a => !a.startsWith('--'));
if (!ids.length) { console.error('usage: node tools/marble-concepts.mjs OUT_DIR SIZE SEED study-id ... [--equal]'); process.exit(2); }
mkdirSync(out, { recursive: true });
const size = Number(sizeArg), lib = loadLibrary(), sources = sourcesFor(lib, ids, { weighting: equal ? 'equal' : 'idf', unitWeight: flag('--summed') ? 'concepts' : 'equal' });
const png = async (name, im) => writeFileSync(`${out}/${name}`, await encodePNG(im.w, im.h, im.rgba, b => deflateSync(b, { level: 6 })));
const LABEL = [[196, 62, 48], [52, 110, 190], [226, 178, 40], [40, 140, 96], [140, 70, 160], [30, 30, 30]];

const opts = { size: [size, size], sources, fill: 0.55, comb: 0.08, tines: 9, layout };
const take = s => { const bath = lay({ ...opts, seed: s }), map = read(bath), elem = readElements(bath, map); return { bath, map, elem }; };
const A = take(seed), B = take(`${seed}/recreate`);
await png('ideas.png', renderConcepts(A.bath, A.map, A.elem));
await png('labels.png', render(A.map, sources.map((_, k) => LABEL[k % LABEL.length])));
await png('recreate.png', renderConcepts(B.bath, B.map, B.elem));

const r = conceptReading(A.bath, A.map, A.elem), held = new Map();
sources.forEach(s => s.elements.forEach(e => held.set(e.id, [...(held.get(e.id) ?? []), s.id])));
// a meeting no single study holds as a pair: the two concepts never sit together in any one of these studies
const novel = r.across.filter(x => { const [a, b] = x.pair.split(' + '); return a !== b && !sources.some(s => s.elements.some(e => e.id === a) && s.elements.some(e => e.id === b)); });
// stability: one seed is one arrangement. Count, over K seeds at 512 px, how often each across-study meeting appears;
// a meeting that recurs comes from the weights and the layout, one that appears once comes from that arrangement.
// The same pass averages each idea's exposure (its share of across-study borders over its share of ink; 1 is fair).
const K = 32, seen = new Map(), expo = new Map();
for (let k = 0; k < K; k++) {
  const bath = lay({ ...opts, size: [512, 512], seed: `${seed}/stability/${k}` }), map = read(bath);
  const el = readElements(bath, map);
  for (const x of conceptReading(bath, map, el).across) seen.set(x.pair, (seen.get(x.pair) ?? 0) + 1);
  for (const e of exposure(bath, map, el).rows) { const k = `${e.source} | ${e.element}`, a = expo.get(k) ?? { ink: 0, b: 0 }; a.ink += e.ink; a.b += e.ink * e.ratio; expo.set(k, a); }
}
const fair = [...expo].map(([k, a]) => ({ idea: k, ink: a.ink / K, ratio: +(a.b / a.ink).toFixed(3) })).sort((a, b) => a.ratio - b.ratio);
const inkAll = fair.reduce((s, x) => s + x.ink, 0), buried = +(fair.filter(x => x.ratio < 0.25).reduce((s, x) => s + x.ink, 0) / inkAll).toFixed(3);
const stable = x => +((seen.get(x.pair) ?? 0) / K).toFixed(3);
for (const x of [...r.across, ...novel]) x.seeds = stable(x);
const recurring = [...seen].map(([pair, n]) => ({ pair, seeds: +(n / K).toFixed(3) })).sort((a, b) => b.seeds - a.seeds);
const reading = { seed, size, weighting: equal ? 'equal' : 'idf', layout, studyWeight: flag('--summed') ? 'summed' : 'equal', fairness: { buried, least: fair.slice(0, 5), most: fair.slice(-5) }, stability: { seeds: K, size: 512, recurring: recurring.slice(0, 30) }, studies: sources.map((s, k) => ({ id: s.id, medium: s.medium, label: LABEL[k % LABEL.length], elements: s.elements.map(e => ({ id: e.id, weight: +e.weight.toFixed(4) })) })), shares: r.shares, within: r.within.slice(0, 30), across: r.across.slice(0, 30), novel: novel.slice(0, 20) };
writeFileSync(`${out}/reading.json`, JSON.stringify(reading, null, 1));
const md = [`# Marbling between ideas: ${ids.join(', ')}`, '', `Seed ${seed}, ${size} px, element weights by ${reading.weighting}, ${layout}, studies weighted ${reading.studyWeight}. Expected over ${K} seeds, ${(100 * buried).toFixed(1)} percent of the ink belongs to ideas that barely meet another study (exposure under 0.25); exposure runs from ${fair[0].ratio} to ${fair.at(-1).ratio}. Made by tools/marble-concepts.mjs; every number below is counted from the provenance map.`, '',
  '## New meetings', '', 'Concept pairs that touch across studies here and that no single study holds together. Border length in pixels.', '',
  ...novel.slice(0, 15).map(x => `- ${x.pair}: ${x.edge} px; present in ${Math.round(100 * x.seeds)} percent of ${K} seeds`), '',
  '## Meetings that recur across seeds', '', `Across-study meetings in ${K} arrangements of the same weights (512 px). A meeting in most seeds comes from the weights and ring order; one in few seeds comes from a single arrangement.`, '',
  ...recurring.slice(0, 15).map(x => `- ${x.pair}: ${Math.round(100 * x.seeds)} percent`), '', '## Shares of the bath', '',
  ...Object.entries(r.shares).slice(0, 20).map(([k, v]) => `- ${k}: ${(100 * v).toFixed(2)} percent (held by ${held.get(k).join(', ')})`), ''];
writeFileSync(`${out}/reading.md`, md.join('\n'));
console.log(JSON.stringify({ concepts: Object.keys(r.shares).length, across: r.across.length, novel: novel.length, top: novel.slice(0, 6) }));
