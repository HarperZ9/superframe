// tools/metamer_spectral.mjs: BLEED section 12's metamer test, on spectra (2026-10-26). Pairs are constructed to be
// true metamers: the same XYZ under D65, different 16-band spectra (a metameric black added to a smooth spectrum).
// Each pair is then recombined three ways: a change of light (illuminant A, viewer adapted), Kubelka-Munk mixing with a
// third pigment, and a transparent glaze over a third glaze; and once more inside the medium (two spectral tanks, the
// same third ink poured over each). The RGB engine is the control: it sees only the matching RGB, so every result of
// the pair is identical to it by construction. Separation (dE over 1) means the engine reads the spectra (the ticks).
//   node tools/metamer_spectral.mjs
import { writeFileSync } from 'node:fs';
import { spectrumOf, spectrumRGB, toXYZ, metamericBlack, mixKM, glaze } from '../lib/medium/spectral.mjs';
import { Medium } from '../lib/medium/medium.mjs';
import { render, LOOK } from '../lib/medium/render.mjs';

const lab = (XYZ, w = [0.95047, 1, 1.08883]) => { const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116); const [x, y, z] = XYZ.map((v, i) => f(v / w[i])); return [116 * y - 16, 500 * (x - y), 200 * (y - z)]; };
const xyzOfRGB = c => [0.4124 * c[0] + 0.3576 * c[1] + 0.1805 * c[2], 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], 0.0193 * c[0] + 0.1192 * c[1] + 0.9505 * c[2]];
const dE = (a, b) => Math.hypot(...lab(xyzOfRGB(a)).map((v, i) => v - lab(xyzOfRGB(b))[i]));
const paper = new Array(16).fill(0.92);

const bases = [['Albers yellow sheet (measured #e8e756)', '#e8e756'], ['Olivetti green+cyan overlap (measured #029642)', '#029642'], ['a muted sage', '#7a8a5a'], ['Frankenthaler purple', '#4c294d']];
const third = { pigment: spectrumOf('#a93b29'), glaze: spectrumOf('#04b2dd') };
const rows = [];
for (const [name, hex] of bases) {
  const R1 = spectrumOf(hex), black = metamericBlack(R1, 'D65', { seed: 3, scale: 0.85 }), R2 = R1.map((v, i) => v + black[i]);
  const xyz = [toXYZ(R1), toXYZ(R2)];
  rows.push({
    pair: name,
    spectral_distance: +Math.hypot(...black).toFixed(3),
    dE_D65: +dE(spectrumRGB(R1), spectrumRGB(R2)).toFixed(3),
    dE_illuminant_A: +dE(spectrumRGB(R1, 'A'), spectrumRGB(R2, 'A')).toFixed(2),
    dE_KM_mix_with_red: +dE(spectrumRGB(mixKM([{ R: R1, c: 1 }, { R: third.pigment, c: 1 }])), spectrumRGB(mixKM([{ R: R2, c: 1 }, { R: third.pigment, c: 1 }]))).toFixed(2),
    dE_under_cyan_glaze: +dE(spectrumRGB(glaze(paper, R1.map(Math.sqrt), third.glaze.map(Math.sqrt))), spectrumRGB(glaze(paper, R2.map(Math.sqrt), third.glaze.map(Math.sqrt)))).toFixed(2),
    rgb_engine_control: 0,
    XYZ_match: xyz[0].every((v, i) => Math.abs(v - xyz[1][i]) < 1e-6),
  });
}

// inside the medium: what the eye gets from an ink is its transmittance at the concentration it reaches, so the pair
// is built there: T1 = exp(-3 c a1) at the measured cell, T2 = T1 + a metameric black of T1, a2 = -ln(T2) / (3 c).
// Four tanks: ink 1 or ink 2 alone, and each with the same third ink poured at the same place.
const A1 = spectrumOf('#7a8a5a').map(v => -Math.log(Math.max(0.02, v)) / 3.9);
function tank(A, third) {
  const m = new Medium({ nx: 64, ny: 36, seed: 'meta', spectral: true });
  m.add('ink', { x: 0.5, y: 0.55, r: 0.1 }, 2, { spectrum: A.map(a => Math.exp(-3.9 * a)), color: '#7a8a5a', at: 0 });
  if (third) m.add('ink', { x: 0.5, y: 0.55, r: 0.1 }, 1.2, { color: '#a93b29', at: 0 });
  m.run(0.1); return m;
}
const probe = tank(A1, false), cell = Math.round(0.55 * 36) * 64 + 32, c = probe.pigS[8][cell] / A1[8];
const T1 = A1.map(a => Math.exp(-3 * c * a)), T2 = T1.map((v, i) => v + metamericBlack(T1, 'D65', { seed: 3, scale: 0.85 })[i]), A2 = T2.map(t => -Math.log(Math.max(1e-4, t)) / (3 * c));
// a neutral scene (grey wall, white light, clear water): there the only colour is the inks', so a pair built as filter
// metamers must match when alone; in the default scene the warm light and cream wall are part of the illumination
const NEUTRAL = { ...LOOK, wall: '#d0d0d0', sun: '#ffffff', warm: '#c8c8c8', deep: '#c8c8c8', sigma: [0, 0, 0], shafts: 0, thickness: 0 };
const pxn = (m, illum) => { const R = render(m, 64, 36, { grain: 0, illuminant: illum, look: NEUTRAL }); const o = 4 * (Math.round(0.55 * 36 - 0.5) * 64 + 32); return [R.data[o], R.data[o + 1], R.data[o + 2]]; };
const px = (m, illum) => { const R = render(m, 64, 36, { grain: 0, illuminant: illum }); const o = 4 * (Math.round(0.55 * 36 - 0.5) * 64 + 32); return [R.data[o], R.data[o + 1], R.data[o + 2]]; };
const medium = { filter_metamers_dE_D65: +dE(spectrumRGB(T1), spectrumRGB(T2)).toFixed(3) };
for (const illum of ['D65', 'A']) medium[illum] = { ink_alone: +dE(px(tank(A1, false), illum), px(tank(A2, false), illum)).toFixed(2), with_third_ink: +dE(px(tank(A1, true), illum), px(tank(A2, true), illum)).toFixed(2), neutral_scene_ink_alone: +dE(pxn(tank(A1, false), illum), pxn(tank(A2, false), illum)).toFixed(2), neutral_scene_with_third_ink: +dE(pxn(tank(A1, true), illum), pxn(tank(A2, true), illum)).toFixed(2) };

const out = { date: '2026-10-26', method: 'true metamers by construction (same XYZ under D65, 16 bands, CIE 1931 2-degree observer); dE CIE76 in D65-adapted Lab', pairs: rows, in_medium: medium,
  note: 'The RGB engine sees each pair as one colour, so every recombination of the pair is identical in it (dE 0) by construction; separation here is the spectral engine reading what the RGB summary hides.' };
writeFileSync(new URL('../tests/golden/metamer-spectral.json', import.meta.url), JSON.stringify(out, null, 1));
console.table(rows); console.log('in the medium', JSON.stringify(medium));
