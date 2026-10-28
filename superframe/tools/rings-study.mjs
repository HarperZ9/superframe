// rings-study.mjs: the pre-registered Newton's rings test (the claim and its control are in tests/rings.test.mjs).
//   node tools/rings-study.mjs <CIE_DIR> [OUT.json]   CIE_DIR holds the CIE 1931 2-degree CMFs and D65 as CSV
//   (CIE_xyz_1931_2deg.csv and CIE_std_illum_D65.csv, from the CIE data tables); SUPERFRAME_CIE also sets it.
import { readFileSync, writeFileSync } from 'node:fs';
import { gapReflectance, cosAir, whiteLuminance } from '../lib/medium/rings.mjs';
import { index } from '../lib/medium/refraction.mjs';

const CIE = process.argv[2] ?? process.env.SUPERFRAME_CIE;
if (!CIE) { console.error('usage: node tools/rings-study.mjs <CIE_DIR> [OUT.json]'); process.exit(2); }
const csv = f => readFileSync(`${CIE}/${f}`, 'utf8').trim().split(/\r?\n/).map(l => l.split(',').map(Number));
const xyz = csv('CIE_xyz_1931_2deg.csv'), d65 = new Map(csv('CIE_std_illum_D65.csv').map(r => [r[0], r[1]]));
const rows = xyz.filter(r => r[0] >= 380 && r[0] <= 780 && d65.has(r[0]));
const cmf = { nm: rows.map(r => r[0]), v: rows.map(r => r[2]) }, illum = { nm: cmf.nm, v: cmf.nm.map(n => d65.get(n)) };
const nG = index('n-bk7', 571), out = { glass_index_571: nG };

// A, B: white-light luminance against gap thickness, 0.1 nm steps to 2000 nm
function extrema(sameSign) {
  const step = 0.1, Y = []; for (let d = 0; d <= 2000; d += step) Y.push(whiteLuminance(d, cmf, illum, { nGlass: nG, sameSign }));
  const mins = [], maxs = [];
  for (let i = 1; i < Y.length - 1; i++) { if (Y[i] < Y[i - 1] && Y[i] <= Y[i + 1]) mins.push(i * step); if (Y[i] > Y[i - 1] && Y[i] >= Y[i + 1]) maxs.push(i * step); }
  return { mins, maxs, Y0: Y[0] };
}
const E = extrema(false), NEWTON = 25.4e6 / 89000;
out.A = { first_dark_nm: E.mins[0], newton_nm: NEWTON, rel_err: Math.abs(E.mins[0] - NEWTON) / NEWTON, centre_luminance: E.Y0 };
const b = E.maxs.slice(0, 4);
out.B = { maxima_nm: b, ratios: b.map(v => v / b[0]), max_rel_err: Math.max(...b.map((v, k) => Math.abs(v / b[0] - (2 * k + 1)) / (2 * k + 1))), minima_nm: E.mins.slice(0, 4) };

// C: monochromatic first dark ring against obliquity (angle in the air)
// first dark ring = first minimum after the first maximum (the centre at d = 0 is itself dark). Fixed after the first
// run: the earlier search stopped at d = 1 nm because reflectance rises out of the dark centre.
const firstDark = cg => { let prev = gapReflectance(0.05, 571, { nGlass: nG, cosGlass: cg }).u, rising = true; for (let d = 0.1; d < 20000; d += 0.05) { const r = gapReflectance(d, 571, { nGlass: nG, cosGlass: cg }).u; if (rising && r < prev) rising = false; else if (!rising && r > prev) return d - 0.05; prev = r; } return null; };
out.C = [0, 10, 20, 30, 40, 50, 60, 65, 70, 75, 80, 85].map(a => {
  const sa = Math.sin(a * Math.PI / 180), cg = Math.sqrt(1 - (sa / nG) ** 2), d = firstDark(cg), d0 = firstDark(1);
  return { air_deg: a, ratio: d / d0, secant: 1 / Math.cos(a * Math.PI / 180), rel_err: Math.abs(d / d0 * Math.cos(a * Math.PI / 180) - 1) };
});
out.C_max_rel_err = Math.max(...out.C.map(r => r.rel_err));

// D, E: Newton's table (Opticks II.1 obs 7): [incidence deg, min], refraction deg, diameter, thickness
const T = [[0, 0, 0, 10, 10], [6, 26, 10, 10 + 1 / 13, 10 + 2 / 13], [12, 45, 20, 10 + 1 / 3, 10 + 2 / 3], [18, 49, 30, 10.75, 11.5], [24, 30, 40, 11.4, 13], [29, 37, 50, 12.5, 15.5],
  [33, 58, 60, 14, 20], [35, 47, 65, 15.25, 23.25], [37, 19, 70, 16.8, 28.25], [38, 33, 75, 19.25, 37], [39, 27, 80, 22 + 6 / 7, 52.25], [40, 0, 85, 29, 84 + 1 / 12], [40, 11, 90, 35, 122.5]];
const rad = x => x * Math.PI / 180;
// his rule: sine of the angle is the first of 106 arithmetical means between the sines, counted from the bigger
const rule = (si, sr) => { const big = Math.max(si, sr), small = Math.min(si, sr), s = big - (big - small) / 107; return 10 / Math.sqrt(1 - s * s); };
out.table = T.map(([dg, mn, ar, diam, th]) => {
  const si = Math.sin(rad(dg + mn / 60)), sr = Math.sin(rad(ar)), sec = ar < 90 ? 10 / Math.cos(rad(ar)) : Infinity, ru = rule(si, sr);
  return { air_deg: ar, newton: th, secant: sec, rule: ru, err_secant: Math.abs(th - sec) / sec, err_rule: Math.abs(th - ru) / ru, diam_sq_over_10: diam * diam / 10 };
});
out.D = { rows_0_60_max_err: Math.max(...out.table.filter(r => r.air_deg <= 60).map(r => r.err_secant)) };
out.E = { all_rows_max_err: Math.max(...out.table.map(r => r.err_rule)), rows_over_1_5pct: out.table.filter(r => r.err_rule > 0.015).length };

// controls
const C1 = extrema(true);
out.C1 = { first_min_nm: C1.mins[0], rel_err_vs_newton: Math.abs(C1.mins[0] - NEWTON) / NEWTON, centre_luminance: C1.Y0 };
{ let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647); const fails = [];
  for (let k = 0; k < 200; k++) { const th = T.map(r => r[4]); for (let i = th.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [th[i], th[j]] = [th[j], th[i]]; }
    fails.push(T.filter((r, i) => Math.abs(th[i] - out.table[i].rule) / out.table[i].rule > 0.015).length); }
  out.C2 = { shuffles: 200, min_rows_failing: Math.min(...fails), median_rows_failing: fails.sort((a, b) => a - b)[100] }; }

console.log(JSON.stringify(out, null, 1));
if (process.argv[3]) writeFileSync(process.argv[3], JSON.stringify(out, null, 1));
