// thickplate-study.mjs: the pre-registered test in docs/prereg/THICKPLATE-PREREG.md.
//   node tools/thickplate-study.mjs [OUT.json]
import { writeFileSync } from 'node:fs';
import { ringDiameter, intensity } from '../lib/medium/thickplate.mjs';

const LAMBDA = 2 * 25.4e6 / 89000, N = 17 / 11, L = 72, out = { lambda_nm: LAMBDA, n: N, L_inch: L };
const rel = (a, b) => Math.abs(a - b) / b;
const BRIGHT = [1.6875, 2.375, 2 + 11 / 12, 3.375], DARK = [1 + 3 / 16, 2 + 1 / 16, 2 + 2 / 3, 3.15], THIN = [3, 4 + 1 / 6, 5.125];

out.P1 = BRIGHT.map((m, i) => { const p = ringDiameter(i + 1, 0.25, N, LAMBDA, L); return { k: i + 1, measured: m, model: p, rel_err: rel(p, m) }; });
out.P2 = DARK.map((m, i) => { const p = ringDiameter(i + 0.5, 0.25, N, LAMBDA, L); return { k: i + 0.5, measured: m, model: p, rel_err: rel(p, m) }; });
out.P3 = THIN.map((m, i) => { const p = ringDiameter(i + 1, 5 / 62, N, LAMBDA, L); return { k: i + 1, measured: m, model: p, rel_err: rel(p, m) }; });
out.P4 = { centre: intensity(0, 0.25, N, LAMBDA), max_possible: 4, bright: intensity(0, 0.25, N, LAMBDA) > 3.999 };
// P5 (exploratory): diameter ratio for two wavelengths, against Newton's 9 : 8
out.P5 = { d_620_over_d_455: ringDiameter(2, 0.25, N, 620, L) / ringDiameter(2, 0.25, N, 455, L), sqrt_ratio: Math.sqrt(620 / 455), newton: 9 / 8 };
out.newton_own = { computed: [1.688, 2.389, 2.925, 3.375], rel_err_to_measured: [1.688, 2.389, 2.925, 3.375].map((v, i) => rel(v, BRIGHT[i])) };
out.summary = { P1_max: Math.max(...out.P1.map(r => r.rel_err)), P2_max: Math.max(...out.P2.map(r => r.rel_err)), P3_max: Math.max(...out.P3.map(r => r.rel_err)) };

// C1: metal speculum, a single path (a1 = 0): contrast over the first rings
{ const I = []; for (let a = 0; a < 0.05; a += 1e-5) I.push(intensity(a, 0.25, N, LAMBDA, { a1: 0 })); out.C1 = { contrast: (Math.max(...I) - Math.min(...I)) / (Math.max(...I) + Math.min(...I)) }; }
// C2: ignore the glass index: delta = t theta^2 (small angle, n = 1)
{ const d = k => 2 * L * Math.tan(Math.sqrt(k * LAMBDA / (0.25 * 25.4e6))); out.C2 = BRIGHT.map((m, i) => ({ k: i + 1, model: d(i + 1), rel_err: rel(d(i + 1), m) })); out.C2_min_err = Math.min(...out.C2.map(r => r.rel_err)); }

console.log(JSON.stringify(out, null, 1));
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
