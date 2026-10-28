// value-sweep.mjs: exploratory (not graded) boundary sweep of the value budget. One knob at a time from the
// white-on-white baseline: the diffuse white level d_w, the white coat's roughness, the key's radius (angular size),
// the surround radiance and the key's elevation; and a 'measured ceiling' variant that exposes the brightest diffuse
// pixel to d_w instead of the physical bound. Writes out/value/sweep.json. Usage: node tools/value-sweep.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { whiteOnWhite } from '../lib/value/presets.mjs';
import { render } from '../lib/value/trace.mjs';
import { toDisplay, lumOf } from '../lib/value/tone.mjs';
import { specLabels, whiteCheck } from '../lib/value/measure.mjs';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'out', 'value'), W = 400, H = 250, base = { photons: 60000, shadowSamples: 4 };
const one = (o, dw = 0.8, Cmode = 'physical') => {
  const s = whiteOnWhite({ ...base, ...o }), img = render(s, { w: W, h: H, ss: 1 }), L = specLabels(img);
  let dmax = 0; for (let i = 0; i < W * H; i++) dmax = Math.max(dmax, lumOf(img.dif[3 * i], img.dif[3 * i + 1], img.dif[3 * i + 2]));
  const C = Cmode === 'measured' ? dmax : s.C, r = whiteCheck(toDisplay(img, { C, dw }), L);
  return { share: r.share, frac: r.frac, bright: r.bright, difOverC: dmax / s.C, img, L, s, dmax };
};
const rows = [], log = (knob, value, r) => { rows.push({ knob, value, share: r.share, frac: r.frac, bright: r.bright }); console.log(`${knob.padEnd(10)} ${String(value).padEnd(8)} share ${r.share === null ? 'n/a ' : r.share.toFixed(3)}  frac ${(100 * r.frac).toFixed(4)}%  n ${r.bright}`); };

const B = one({});
for (const dw of [0.6, 0.7, 0.8, 0.85, 0.9, 0.93, 0.94, 0.95]) {
  for (const Cmode of ['physical', 'measured']) {
    const C = Cmode === 'measured' ? B.dmax : B.s.C, r = whiteCheck(toDisplay(B.img, { C, dw }), B.L);
    log(`dw/${Cmode.slice(0, 4)}`, dw, r);
  }
}
for (const alpha of [0.01, 0.02, 0.04, 0.06, 0.1, 0.2, 0.4]) log('alpha', alpha, one({ alpha }));
for (const lightR of [0.15, 0.3, 0.6, 1.2, 2.4, 4.8]) log('lightR', lightR, one({ lightR }));
for (const env of [0.02, 0.1, 0.22, 0.5, 1.0, 2.0]) log('env', env, one({ env }));
for (const elev of [15, 30, 52, 70, 85]) log('elev', elev, one({ elev }));
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'sweep.json'), JSON.stringify({ date: new Date().toISOString(), render: [W, H, 'ss 1'], baselineDifOverC: B.difOverC, rows }, null, 1));
