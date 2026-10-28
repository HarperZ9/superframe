// rings-render.mjs: Newton's rings in white light, seen from above, for his own lens (a sphere of 182 inches diameter
// on a flat glass, Opticks II.1 obs 6). Each radius gives an air gap d = r^2 / (2 R); the reflected spectrum is the
// exact Airy reflectance (lib/medium/rings.mjs) under CIE D65, turned to sRGB through the CIE 1931 2 degree functions.
//   node tools/rings-render.mjs CIE_DIR OUT.png [width height]
import { readFileSync, writeFileSync } from 'node:fs';
import { gapReflectance } from '../lib/medium/rings.mjs';
import { index } from '../lib/medium/refraction.mjs';
import { pngBytes } from '../lib/export.mjs';
import { make } from '../lib/types.mjs';

const [CIE, OUT, W = '3840', H = '2160'] = process.argv.slice(2), w = +W, h = +H;
const csv = f => readFileSync(`${CIE}/${f}`, 'utf8').trim().split(/\r?\n/).map(l => l.split(',').map(Number));
const d65 = new Map(csv('CIE_std_illum_D65.csv').map(r => [r[0], r[1]]));
const xyz = csv('CIE_xyz_1931_2deg.csv').filter(r => r[0] >= 380 && r[0] <= 780 && r[0] % 2 === 0 && d65.has(r[0]));
const nG = index('n-bk7', 571), Rinch = 91, inch = 25.4e6;      // sphere radius in inches; nm per inch
let Yw = 0; for (const [, , y] of xyz) Yw += y * d65.get(xyz.find(r => r[2] === y)[0]);
Yw = xyz.reduce((a, r) => a + r[2] * d65.get(r[0]), 0);
// a lookup of reflected linear sRGB against gap thickness (0 to 3000 nm in 0.5 nm steps)
const step = 0.5, N = 6001, lut = new Float32Array(N * 3);
const M = [[3.2406, -1.5372, -0.4986], [-0.9689, 1.8758, 0.0415], [0.0557, -0.2040, 1.0570]];
for (let k = 0; k < N; k++) {
  const d = k * step; let X = 0, Y = 0, Z = 0;
  for (const [nm, x, y, z] of xyz) { const e = d65.get(nm) * gapReflectance(d, nm, { nGlass: nG }).u; X += e * x; Y += e * y; Z += e * z; }
  const s = 1 / (Yw * 0.19);   // exposure: the brightest ring (about 17% reflectance) maps just under white
  for (let c = 0; c < 3; c++) lut[3 * k + c] = Math.max(0, (M[c][0] * X + M[c][1] * Y + M[c][2] * Z) * s);
}
const out = make.raster(w, h), view = 0.13;   // inches across the half-height of the frame (his fifth dark ring is 0.1 inch in radius)
for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
  const x = (i + 0.5 - w / 2) / (h / 2) * view, y = (j + 0.5 - h / 2) / (h / 2) * view, r2 = x * x + y * y;
  const d = r2 / (2 * Rinch) * inch, k = Math.min(N - 1, Math.round(d / step)), p = 4 * (j * w + i);
  for (let c = 0; c < 3; c++) out.data[p + c] = d >= 3000 ? lut[3 * (N - 1) + c] : lut[3 * k + c];
  out.data[p + 3] = 1;
}
writeFileSync(OUT, await pngBytes(out, { seed: 'rings' }));
console.log('wrote', OUT, w, h);
