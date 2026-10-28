// refraction-study.mjs: the pre-registered test in docs/prereg/REFRACTION-PREREG.md.
//   node tools/refraction-study.mjs [OUT.json]
import { writeFileSync } from 'node:fs';
import { index, airIndex, fresnel, snell, descartes, bowHistogram, lensFocus } from '../lib/medium/refraction.mjs';

const deg = r => r * 180 / Math.PI, out = {};
const LINES = { d: 587.5618, D: 589.2938, F: 486.1327, C: 656.2725 };

// P1: materials against the catalogue
const V = m => (index(m, LINES.d) - 1) / (index(m, LINES.F) - index(m, LINES.C));
out.P1 = {
  bk7: { n_d: index('n-bk7', LINES.d), V: V('n-bk7'), n_d_err: Math.abs(index('n-bk7', LINES.d) - 1.51680), V_err: Math.abs(V('n-bk7') - 64.17) },
  silica: { n_d: index('silica', LINES.d), n_d_err: Math.abs(index('silica', LINES.d) - 1.45846) },
  water: { n_D_rel_air: index('water', LINES.D), n_D_err: Math.abs(index('water', LINES.D) - 1.33299), V: V('water') },
  air_589: airIndex(589),
};

// P2: interface identities
{
  let worst = 0, brewster = 0, tir = true;
  for (const [n1, n2] of [[1, 1.5], [1, 1.333], [1.5, 1], [1.333, 1]]) {
    for (let a = 0; a < 90; a += 0.25) {
      const f = fresnel(n1, n2, Math.cos(a * Math.PI / 180));
      worst = Math.max(worst, Math.abs(f.rs + f.ts - 1), Math.abs(f.rp + f.tp - 1));
      const crit = n1 > n2 ? deg(Math.asin(n2 / n1)) : 90;
      if (a > crit + 1e-9 && !(f.rs === 1 && f.rp === 1 && snell(n1, n2, Math.cos(a * Math.PI / 180)) === null)) tir = false;
    }
    brewster = Math.max(brewster, fresnel(n1, n2, Math.cos(Math.atan(n2 / n1))).rp);
  }
  out.P2 = { max_R_plus_T_err: worst, max_Rp_at_brewster: brewster, total_internal_reflection_ok: tir };
}

// P3: rainbow from a ray trace, water relative to air
const WL = [400, 450, 500, 550, 600, 650, 700], RAYS = 2e6;
const peakIn = (H, lo, hi) => { let best = -1, at = 0; for (let a = Math.floor(lo / H.bin); a < Math.ceil(hi / H.bin); a++) if (H.h[a] > best) { best = H.h[a]; at = a; } return (at + 0.5) * H.bin; };
const mean = (H, lo, hi) => { let s = 0, c = 0; for (let a = Math.floor(lo / H.bin); a < Math.ceil(hi / H.bin); a++) { s += H.h[a]; c++; } return s / c; };
function bows(nOf, fresnelOn = true) {
  return WL.map(nm => {
    const n = nOf(nm), p = bowHistogram(n, { rays: RAYS, ks: [1], bin: 0.02, maxDeg: 90, fresnel: fresnelOn }), s = bowHistogram(n, { rays: RAYS, ks: [2], bin: 0.02, maxDeg: 90, fresnel: fresnelOn });
    const all = bowHistogram(n, { rays: RAYS / 4, ks: [-1, 0, 1, 2, 3], bin: 0.25, maxDeg: 90, fresnel: fresnelOn });
    return { nm, n, primary: { trace: peakIn(p, 30, 46), descartes: deg(descartes(n, 1)) }, secondary: { trace: peakIn(s, 46, 60), descartes: deg(descartes(n, 2)) }, band_over_inside: mean(all, 43.5, 49) / mean(all, 36, 40) };
  });
}
const W = bows(nm => index('water', nm));
out.P3 = {
  per_wavelength: W.map(w => ({ nm: w.nm, n: w.n, primary_trace: w.primary.trace, primary_descartes: w.primary.descartes, secondary_trace: w.secondary.trace, secondary_descartes: w.secondary.descartes, band_over_inside: w.band_over_inside })),
  max_primary_err_deg: Math.max(...W.map(w => Math.abs(w.primary.trace - w.primary.descartes))),
  max_secondary_err_deg: Math.max(...W.map(w => Math.abs(w.secondary.trace - w.secondary.descartes))),
  primary_range_deg: [Math.min(...W.map(w => w.primary.descartes)), Math.max(...W.map(w => w.primary.descartes))],
  secondary_range_deg: [Math.min(...W.map(w => w.secondary.descartes)), Math.max(...W.map(w => w.secondary.descartes))],
  red_outside_primary: W[6].primary.descartes > W[0].primary.descartes,
  red_inside_secondary: W[6].secondary.descartes < W[0].secondary.descartes,
  primary_colour_width_deg: W[6].primary.descartes - W[0].primary.descartes,
  band_over_inside_max: Math.max(...W.map(w => w.band_over_inside)),
};

// P4: lens chromatic focus (f = 100 mm at d, t = 4 mm), traced exactly at h = 0.05 mm
function radiusFor(m, f = 100, t = 4) { let lo = 20, hi = 400; for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (lensFocus(index(m, LINES.d), { R: mid, t }) < f) lo = mid; else hi = mid; } return (lo + hi) / 2; }
out.P4 = {};
for (const m of ['n-bk7', 'silica']) {
  const R = radiusFor(m), fC = lensFocus(index(m, LINES.C), { R, t: 4 }), fF = lensFocus(index(m, LINES.F), { R, t: 4 }), fd = lensFocus(index(m, LINES.d), { R, t: 4 });
  out.P4[m] = { R, f_d: fd, shift: fC - fF, predicted: fd / V(m), rel_err: Math.abs((fC - fF) - fd / V(m)) / (fd / V(m)) };
}
out.P4.shift_ratio_bk7_over_silica = out.P4['n-bk7'].shift / out.P4.silica.shift;
out.P4.V_ratio_silica_over_bk7 = V('silica') / V('n-bk7');

// controls
{
  const nd = index('water', LINES.d), C1 = bows(() => nd);
  const R = radiusFor('n-bk7'), nC1 = index('n-bk7', LINES.d);
  out.C1 = { primary_colour_width_deg: C1[6].primary.descartes - C1[0].primary.descartes, lens_shift: lensFocus(nC1, { R, t: 4 }) - lensFocus(nC1, { R, t: 4 }) };
  const C2 = bows(nm => index('water', nm), false);
  out.C2 = { band_over_inside_unweighted_max: Math.max(...C2.map(w => w.band_over_inside)), weighted_max: out.P3.band_over_inside_max, factor: Math.max(...C2.map(w => w.band_over_inside)) / out.P3.band_over_inside_max };
  const bubble = 1 / index('water', 550), H = bowHistogram(bubble, { rays: RAYS, ks: [1], bin: 0.02, maxDeg: 90 });
  out.C3 = { n: bubble, peak_in_40_42_5: peakIn(H, 40, 42.5), light_in_40_42_5_over_mean: mean(H, 40, 42.5) / mean(H, 0, 90) };
}

console.log(JSON.stringify(out, null, 1));
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
