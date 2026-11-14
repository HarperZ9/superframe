// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// plot-strata.mjs: the Plot Sheet demonstration. A ridged terrain from the engine's own nodes (site.terrain into
// site.ridgelines: rows of the field lifted by their height, nearer ridges hiding the ones behind) is written as a
// two-pen plot sheet. Ridges that sit high on the sheet are the far ones and go to the lighter, finer pen; the near
// ones go to the darker pen, the way distance pales a real range. Nothing here is read from a picture.
//
//   node superframe/tools/plot-strata.mjs [out-dir] [--seed strata-1] [--rows 120]
//
// Writes strata.svg (millimetres, one group a pen), strata.hpgl, strata.gcode, strata.json and strata.plot.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { registry } from '../lib/registry.mjs';
import { evaluate } from '../lib/graph.mjs';
import { plotSheet } from '../lib/artifact/plotsheet.mjs';

const argv = process.argv.slice(2), flag = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const dir = resolve(argv[0] && !argv[0].startsWith('--') ? argv[0] : 'out/plot-sheet/strata'), seed = flag('seed', 'strata-1'), rows = Number(flag('rows', 120));

const SPEC = [
  'paper 420 297', 'margin 18', 'marks on', 'legend on', 'join 0.15', 'simplify 0.03',
  'pen 0.5 #33261d 60 - near umber',
  'pen 0.3 #6f8fa6 60 - far blue grey',
].join('\n');

const recipe = {
  schema: 'superframe.recipe/1', seed, size: [1680, 1050],
  nodes: [
    { id: 'land', node: 'site.terrain', params: { baseFreq: 2.6, octaves: 6, ridged: true } },
    { id: 'ridges', node: 'site.ridgelines', params: { rows, lift: 0.3 }, in: { field: 'land' } },
  ],
  out: { vector: 'ridges.vector' },
};
const V = (await evaluate(recipe, registry)).outputs.vector;
// the far pen takes the ridges whose mean height is in the upper 46 percent of the frame
const far = p => p.pts.reduce((a, q) => a + q[1], 0) / p.pts.length < 0.46 * V.h;
// the node pins ridges that rise past the top of its frame to the top edge; those flat runs are cut out
const runs = p => { const out = []; let run = []; for (const q of p.pts) { if (q[1] > 0.002 * V.h) run.push(q); else { if (run.length > 1) out.push(run); run = []; } } if (run.length > 1) out.push(run); return out.map(pts => ({ pts, closed: false })); };
const sheet = { w: V.w, h: V.h, paths: V.paths.flatMap(runs).map(p => ({ ...p, pen: far(p) ? 2 : 1 })) };
mkdirSync(dir, { recursive: true });
const out = plotSheet(sheet, SPEC, dir, { title: `Strata sheet, ${rows} rows of a ridged terrain`, seed, name: 'strata', fit: 'ink' });
console.log(out.summary);
console.log(out.files.map(f => `${dir}/${f}`).join('\n'));
