// seattle-spd.test.mjs: the lamp spectra and the colour they make (lib/seattle/spd.mjs, palette.mjs).
// Accept: blackbodies land on their known chromaticities through the 16-band observer; the sodium model sits in the
// published HPS colour-temperature range and shows its self-reversed D line; moonlight near 4100 K; sodium drains
// colour (the spread of saturated surfaces in a*b* at equal luminance) far more than a filament does.
// Controls: a 2700 K filament keeps most of daylight's chroma; a palette built under sodium spans fewer hues than the
// same palette under the filament. The drain is measured at the scenes' adaptation degree (0.3); see spd.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { hps, planckSPD, moonSPD, xy, cctMcCamy, colourSpread, NM, litRGB } from '../lib/seattle/spd.mjs';
import { spectrumOf } from '../lib/medium/spectral.mjs';
import { linToXYZ, xyzToLab } from '../lib/study/cmath.mjs';
import { lampPalette } from '../lib/seattle/palette.mjs';

const labOf = v => xyzToLab(linToXYZ(v));
const SAT = ['#c8281e', '#1e9a3c', '#2848c8', '#e0b020', '#8a2aa0', '#20a0b0'].map(spectrumOf);

test('blackbodies through the 16-band observer land on the Planckian locus', () => {
  const [x, y] = xy(planckSPD(2856));   // CIE illuminant A: 0.4476, 0.4074
  assert.ok(Math.abs(x - 0.4476) < 0.003 && Math.abs(y - 0.4074) < 0.003, `${x} ${y}`);
  const c = xy(planckSPD(2700));
  assert.ok(Math.abs(cctMcCamy(c) - 2700) < 40, `CCT ${cctMcCamy(c)}`);
});

test('the sodium model: CCT in the published HPS range, and a self-reversed D line', () => {
  const s = hps(), cct = cctMcCamy(xy(s));
  assert.ok(cct > 1900 && cct < 2200, `CCT ${cct}`);
  const at = nm => s[nm - 380];
  // the line centre is a local minimum between two wing peaks
  assert.ok(at(589) < at(584) && at(589) < at(595), 'self-reversal dip at 589 nm');
  // most of the visible power lies between 560 and 620 nm
  const sum = (a, b) => NM.reduce((t, l, i) => t + (l >= a && l < b ? s[i] : 0), 0);
  assert.ok(sum(560, 620) / sum(400, 700) > 0.6);
});

test('moonlight sits near 4100 K', () => { const k = cctMcCamy(xy(moonSPD())); assert.ok(k > 3900 && k < 4300, `${k}`); });

test("sodium drains colour at the night eye's partial adaptation; a filament does not (control)", () => {
  const day = colourSpread(SAT, planckSPD(6504), labOf), inc = colourSpread(SAT, planckSPD(2700), labOf), na = colourSpread(SAT, hps(), labOf);
  assert.ok(inc / day > 0.7, `filament keeps colour: ${inc / day}`);
  assert.ok(na / day < 0.6, `sodium drains colour: ${na / day}`);
});

test('partial adaptation never invents colour the light does not carry', () => {
  // a blue surface under sodium stays darker in blue than in red at the scenes' adaptation degree
  const c = litRGB(spectrumOf('#2a6ac8'), hps(), { adapt: 0.3 });
  assert.ok(c[2] < c[0], `${c}`);
});

test('a sodium palette spans fewer hues than a filament palette of the same materials', () => {
  const spec = spd => ({ max: 24, lights: [{ spd, adapt: 0.3, gains: [0.05, 0.2, 0.6, 2] }], materials: ['#c8281e', '#1e9a3c', '#2848c8', '#a3a3a3', '#e0b020'] });
  const hueSpread = P => { const h = P.cb.lab.filter(l => Math.hypot(l[1], l[2]) > 6).map(l => Math.atan2(l[2], l[1])); return h.length ? Math.max(...h) - Math.min(...h) : 0; };
  const na = lampPalette(spec(hps())), inc = lampPalette(spec(planckSPD(2700)));
  assert.ok(hueSpread(na) < hueSpread(inc), `${hueSpread(na)} vs ${hueSpread(inc)}`);
});
