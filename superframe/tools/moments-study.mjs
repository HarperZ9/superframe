// moments-study.mjs: the pre-registered test in docs/prereg/MOMENTS-PREREG.md.
//   node tools/moments-study.mjs [OUT.json] [--lamp vmf|cone]
// --lamp cone (added after the first run, not pre-registered): each lamp is a hard-edged disc of uniform radiance,
// half-angle acos(1 - 1/kappa), the same spread as the vMF lobe; outside MaxEnt-2's exponential family.
// 400 scenes of 1 to 4 vMF lamps plus an optional sky; irradiance for 256 normals from the truth, from SH-2, from
// MaxEnt-2 (the same 9 numbers) and from the isotropic baseline; plus the two controls.
import { writeFileSync } from 'node:fs';
import { sphere, project, shIrradiance, irradiance, maxentFit, maxentRadiance } from '../lib/medium/moments.mjs';

const dirs = sphere(4096), normals = sphere(256);
let s = 20261027; const rnd = () => ((s = (s * 48271) % 2147483647) / 2147483647);
const unit = () => { const z = 2 * rnd() - 1, a = 2 * Math.PI * rnd(), r = Math.sqrt(1 - z * z); return [r * Math.cos(a), r * Math.sin(a), z]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function scene() {
  const lamps = Array.from({ length: 1 + Math.floor(rnd() * 4) }, () => ({ mu: unit(), kappa: 4 * Math.pow(50, rnd()), power: Math.pow(10, 1.5 * rnd()) }));
  const sky = rnd() < 0.5 ? 0 : 0.3 * rnd();
  return { lamps, sky };
}
// radiance samples: each lamp a vMF lobe normalised to its power, the sky a uniform share of the lamps' total
const CONE = process.argv.includes('--lamp') && process.argv[process.argv.indexOf('--lamp') + 1] === 'cone';
function radiance({ lamps, sky }) {
  const total = lamps.reduce((a, l) => a + l.power, 0);
  if (CONE) return dirs.map(w => lamps.reduce((a, l) => { const c = 1 - 1 / l.kappa, omega = 2 * Math.PI * (1 - c); return a + (dot(l.mu, w) >= c ? l.power / omega : 0); }, 0) + (sky * total) / (4 * Math.PI));
  return dirs.map(w => {
    let L = lamps.reduce((a, l) => a + l.power * l.kappa / (4 * Math.PI * Math.sinh(Math.min(l.kappa, 700))) * Math.exp(l.kappa * dot(l.mu, w) - (l.kappa > 700 ? l.kappa - 700 : 0)), 0);
    return L + (sky * total) / (4 * Math.PI);
  });
}
const rel = (est, truth) => { const rms = Math.sqrt(truth.reduce((a, v) => a + v * v, 0) / truth.length); return Math.sqrt(est.reduce((a, v, i) => a + (v - truth[i]) ** 2, 0) / est.length) / rms; };

function evaluate(L, coeffsFrom = null) {
  const truth = normals.map(n => irradiance(L, dirs, n));
  const c = coeffsFrom ?? project(L, dirs);
  const sh = normals.map(n => shIrradiance(c, n));
  const fit = maxentFit(c, dirs);
  const me = fit.ok ? (() => { const Lm = maxentRadiance(fit, dirs); return normals.map(n => irradiance(Lm, dirs, n)); })() : null;
  const total = c[0] / 0.282095;                 // integral of L (the 0th moment)
  const iso = normals.map(() => total / 4);      // the same energy spread evenly: E = (integral L) / 4
  return { sh: rel(sh, truth), me: me ? rel(me, truth) : rel(iso, truth), iso: rel(iso, truth), fitOk: fit.ok,
    shNeg: sh.filter(v => v < 0).length / sh.length, meNeg: me ? me.filter(v => v < 0).length / me.length : 0 };
}

const median = a => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
const scenes = Array.from({ length: 400 }, scene), Ls = scenes.map(radiance);
const rows = Ls.map((L, i) => ({ ...evaluate(L), lamps: scenes[i].lamps.length, kappa: scenes[i].lamps[0].kappa }));

// controls: C1 a uniform sky alone; C2 each scene read from another scene's 9 numbers (scaled to its own energy)
const uniform = evaluate(dirs.map(() => 1));
const shuffled = Ls.map((L, i) => {
  const own = project(L, dirs), other = project(Ls[(i + 137) % Ls.length], dirs), k = own[0] / other[0];
  return evaluate(L, other.map(v => v * k));
});

const share = (a, f) => a.filter(f).length / a.length;
const single = rows.filter(r => r.lamps === 1 && r.kappa >= 30);
const result = {
  scenes: rows.length, fit_failures: rows.filter(r => !r.fitOk).length,
  P1: { maxent_scenes_with_negatives: share(rows, r => r.meNeg > 0), sh_scenes_with_negatives: share(rows, r => r.shNeg > 0) },
  P2: { maxent_beats_isotropic: share(rows, r => r.me < r.iso) },
  P3: { compact_single_lamp_scenes: single.length, maxent_beats_sh: share(single, r => r.me < r.sh) },
  P4: { median_rel_rmse: { sh: median(rows.map(r => r.sh)), maxent: median(rows.map(r => r.me)), isotropic: median(rows.map(r => r.iso)) }, maxent_beats_sh_all: share(rows, r => r.me < r.sh) },
  C1_uniform: { sh: uniform.sh, maxent: uniform.me, isotropic: uniform.iso },
  C2_shuffled: { sh_loses_to_isotropic: share(shuffled, r => r.sh > r.iso), maxent_loses_to_isotropic: share(shuffled, r => r.me > r.iso) },
  by_lamps: [1, 2, 3, 4].map(n => { const g = rows.filter(r => r.lamps === n); return { lamps: n, scenes: g.length, median_sh: median(g.map(r => r.sh)), median_maxent: median(g.map(r => r.me)), maxent_beats_sh: share(g, r => r.me < r.sh) }; }),
};
console.log(JSON.stringify(result, null, 1));
if (process.argv[2] && !process.argv[2].startsWith('--')) writeFileSync(process.argv[2], JSON.stringify({ result, rows }, null, 1));
