// thickplate-render.mjs: Newton's chart (Opticks II.4 obs 1 to 3): sunlight through a hole, a quarter-inch silvered
// glass speculum, and the rings it throws on a chart six feet away. Two-path interference (lib/medium/thickplate.mjs)
// under CIE D65, through the CIE 1931 2 degree functions. Newton's measured bright-ring diameters are marked as thin
// circles in the right half for comparison; the left half is the model alone.
//   node tools/thickplate-render.mjs CIE_DIR OUT.png [width height]
import { readFileSync, writeFileSync } from 'node:fs';
import { intensity } from '../lib/medium/thickplate.mjs';
import { pngBytes } from '../lib/export.mjs';
import { make } from '../lib/types.mjs';

const [CIE, OUT, W = '3840', H = '2160'] = process.argv.slice(2), w = +W, h = +H;
const csv = f => readFileSync(`${CIE}/${f}`, 'utf8').trim().split(/\r?\n/).map(l => l.split(',').map(Number));
const d65 = new Map(csv('CIE_std_illum_D65.csv').map(r => [r[0], r[1]]));
const xyz = csv('CIE_xyz_1931_2deg.csv').filter(r => r[0] >= 380 && r[0] <= 780 && r[0] % 2 === 0 && d65.has(r[0]));
const N = 17 / 11, L = 72, T = 0.25, Yw = xyz.reduce((a, r) => a + r[2] * d65.get(r[0]), 0);
const M = [[3.2406, -1.5372, -0.4986], [-0.9689, 1.8758, 0.0415], [0.0557, -0.2040, 1.0570]];
// lookup against radius on the chart (inches), 0 to 5 in 0.002 steps
const step = 0.002, NR = 2501, lut = new Float32Array(NR * 3);
for (let k = 0; k < NR; k++) {
  const th = Math.atan(k * step / L); let X = 0, Y = 0, Z = 0;
  for (const [nm, x, y, z] of xyz) { const e = d65.get(nm) * intensity(th, T, N, nm) / 4; X += e * x; Y += e * y; Z += e * z; }
  const s = 0.95 / Yw;
  for (let c = 0; c < 3; c++) lut[3 * k + c] = Math.max(0, (M[c][0] * X + M[c][1] * Y + M[c][2] * Z) * s);
}
const MEASURED = [1.6875, 2.375, 2 + 11 / 12, 3.375], view = 2.1;   // inches across the half-height
const out = make.raster(w, h);
for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
  const x = (i + 0.5 - w / 2) / (h / 2) * view, y = (j + 0.5 - h / 2) / (h / 2) * view, r = Math.hypot(x, y), p = 4 * (j * w + i);
  const k = Math.min(NR - 1, Math.round(r / step));
  for (let c = 0; c < 3; c++) out.data[p + c] = lut[3 * k + c] * 0.9;
  if (x > 0) for (const D of MEASURED) if (Math.abs(r - D / 2) < view * 1.6 / h) for (let c = 0; c < 3; c++) out.data[p + c] = 0.02;
  out.data[p + 3] = 1;
}
writeFileSync(OUT, await pngBytes(out, { seed: 'thickplate' }));
console.log('wrote', OUT, w, h);
