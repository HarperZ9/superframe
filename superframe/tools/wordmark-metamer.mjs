// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// wordmark-metamer.mjs: how far away the smalti mosaic (direction 1) must be before it is a metamer of a clean,
// flat CMMNS. The clean reference has the same letter shapes, filled with the mosaic's own mean letter colour on its
// own mean ground colour. The reduced S-CIELAB eye (lib/quantize/eye.mjs) compares the two at a ladder of pixels per
// degree; the answer is the smallest ppd where the mean CIEDE2000 drops under 3. A shuffled control (the same
// tiles' colours with the letter mask moved off the letters) must not become a metamer at the same distance.
//   node tools/wordmark-metamer.mjs    (reads the 4K still, writes data.metamer into its recipe.json)
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadPNG, down } from '../../name-art/lib/img.mjs';
import { deStats, PPD_LADDER } from '../lib/quantize/index.mjs';
import { setWord } from '../lib/wordmark/word.mjs';
import { OUT } from './wordmark.mjs';

const K = 4, dir = join(OUT, '1-smalti'), I = down(loadPNG(join(dir, 'still-3840x2160.png')), K), { w, h } = I;
const N = setWord(3840 / K, 2160 / K, { box: [0.075, 0.26, 0.925, 0.74], weight: 900, tracking: 46, sdf: false });

function reference(mask) {
  const sum = [[0, 0, 0, 0], [0, 0, 0, 0]];
  for (let i = 0; i < w * h; i++) { const z = mask[i] > 0.5 ? 1 : 0; for (let c = 0; c < 3; c++) sum[z][c] += I.px[i * 3 + c]; sum[z][3]++; }
  const m = sum.map(s => s.slice(0, 3).map(v => v / s[3])), R = new Float32Array(w * h * 3);
  for (let i = 0; i < w * h; i++) for (let c = 0; c < 3; c++) R[i * 3 + c] = m[0][c] * (1 - mask[i]) + m[1][c] * mask[i];
  return R;
}
const shifted = new Float32Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const sy = (y + Math.round(h * 0.37)) % h; shifted[y * w + x] = N.mask[sy * w + x]; }
const ladder = PPD_LADDER.map(ppd => ({ ppd, mark: +deStats(reference(N.mask), I.px, w, h, ppd).mean.toFixed(2), control: +deStats(reference(shifted), I.px, w, h, ppd).mean.toFixed(2) }));
const first = key => ladder.find(r => r[key] < 3)?.ppd ?? null;
const result = { frame: `${w}x${h} (the 4K still box-filtered ${K}:1)`, threshold_dE00: 3, ladder, metamer_at_ppd: first('mark'), control_at_ppd: first('control'),
  reading: 'ppd counts pixels of the reduced frame per degree of visual angle; larger ppd means farther away or smaller on screen' };
console.log(JSON.stringify(result, null, 1));
const rp = join(dir, 'recipe.json'), R = JSON.parse(readFileSync(rp, 'utf8')); R.data.metamer = result; writeFileSync(rp, JSON.stringify(R, null, 1));
