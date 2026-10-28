// compose-posthoc.mjs: POST-HOC exploration, run after the registered P4 result was seen. It varies the line-map
// width sigma on the same 40 planted scenes to ask whether the contrast term can pull the anchor off the vanishing
// point onto the subject. Results are labelled post-hoc in README.md and carry lower weight than the PREREG run.
//   node tools/compose-posthoc.mjs [out/compose/posthoc-sigma.json]
import { writeFileSync } from 'node:fs';
import { detectLines } from '../lib/compose/lines.mjs';
import { compositionAxis, contrastMap, grid } from '../lib/compose/axis.mjs';
import { axisScene } from '../lib/compose/plant.mjs';
import { median } from '../lib/compose/stats.mjs';

const OUT = process.argv[2] ?? 'out/compose/posthoc-sigma.json', SIGMAS = [3, 6, 10, 15], rows = [];
for (let k = 0; k < 40; k++) {
  const sc = axisScene(k); if (!sc) continue;
  const segs = detectLines(sc.rgba, sc.w, sc.h), G = grid(sc.w, sc.h), C = contrastMap(sc.rgba, sc.w, sc.h, G);
  const d = p => Math.hypot(p[0] - sc.truth.subject[0], p[1] - sc.truth.subject[1]) / sc.w;
  rows.push({ k, subjectToVP: d(sc.truth.vp), ...Object.fromEntries(SIGMAS.map(s => [`s${s}`, d(compositionAxis(sc.rgba, sc.w, sc.h, segs, { contrast: C, sigmaDeg: s }).anchor)])) });
}
const summary = Object.fromEntries(SIGMAS.map(s => [`sigma ${s}`, {
  medianToSubject: median(rows.map(r => r[`s${s}`])), hit10: rows.filter(r => r[`s${s}`] <= 0.1).length / rows.length,
  onSubject2pct: rows.filter(r => r[`s${s}`] <= 0.02).length / rows.length }]));
summary.medianSubjectToVP = median(rows.map(r => r.subjectToVP));
console.log(JSON.stringify(summary, null, 1));
writeFileSync(OUT, JSON.stringify({ label: 'post-hoc, after the registered P4 run', summary, rows }, null, 1));
