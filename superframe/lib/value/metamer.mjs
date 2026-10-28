// metamer.mjs: the illuminant-swap view (batch E). Two surfaces that match under one light and split under another,
// drawn from the metamer set of a target (lib/medium/metamers.mjs, unedited): every member reads the same XYZ as
// the target under D65; the pair kept is the one that comes apart most under illuminant A. The split is followed
// across blackbody light from 1900 K to 10000 K. Control: an RGB engine carries three numbers per colour, so a pair
// that matches in RGB under D65 stays matched however it is relit.
import { spectrumOf, spectrumRGB, toXYZ, toLinearRGB, LAMBDA } from '../medium/spectral.mjs';
import { metamerSet, spread, observerRows, read, deltaE, whiteOf } from '../medium/metamers.mjs';
import { linToXYZ } from '../study/cmath.mjs';
import { rngFrom } from '../seed.mjs';

export const dEUnder = (R1, R2, illum) => { const rows = observerRows('standard', illum); return deltaE(read(rows, R1), read(rows, R2), whiteOf(illum)); };
// Planck's law at the 16 bands, normalised at 560 nm
export function blackbody(K) {
  const p = nm => { const l = nm * 1e-9; return 1 / (l ** 5 * (Math.exp(1.4387769e-2 / (l * K)) - 1)); };
  return LAMBDA.map(l => 100 * p(l) / p(560));
}

export function metamerPair(hex, { n = 64, seed = 'value/metamer' } = {}) {
  const T = spectrumOf(hex), set = metamerSet(T, { n, rng: rngFrom(`${seed}/${hex}`) }), sp = spread(set, 'A'), [i, j] = sp.pair;
  const a = set[i], b = set[j];
  return { hex, target: T, a, b, gentle: gentlePair(set), d65: dEUnder(a, b, 'D65'), A: dEUnder(a, b, 'A'), candle: dEUnder(a, b, 'candle'), set: set.length };
}

export function blackbodySweep(pair, { from = 1900, to = 10000, steps = 41 } = {}) {
  return Array.from({ length: steps }, (_, k) => { const K = from + (to - from) * k / (steps - 1), S = blackbody(K); return { K, dE: dEUnder(pair.a, pair.b, S) }; });
}

// the control: RGB relighting. Each member becomes its D65 linear RGB; the new light multiplies the channels by its
// own white's linear RGB (no adaptation), and the difference is read in CIELAB relative to that white
export function rgbRelight(pair, illum = 'A') {
  const light = toLinearRGB(toXYZ(new Array(16).fill(1), illum), 'D65');          // the light's colour, unadapted
  const relit = R => linToXYZ(spectrumRGB(R, 'D65').map((v, c) => v * light[c]));
  return deltaE(relit(pair.a), relit(pair.b), linToXYZ(light));
}

// a member's display colour (linear sRGB, viewer adapted to the light) under an illuminant
export const shown = (R, illum) => spectrumRGB(R, illum).map(v => Math.min(1, Math.max(0, v)));

// the smoothest pair that still splits by more than `min` under A: roughness is the sum of squared steps between
// neighbouring bands, the larger of the two members' (an exploratory reading of how far paint-like spectra go)
const rough = R => R.reduce((s, v, i) => (i ? s + (v - R[i - 1]) ** 2 : 0), 0);
export function gentlePair(set, min = 4) {
  const r = set.map(rough); let best = null;
  for (let i = 0; i < set.length; i++) for (let j = i + 1; j < set.length; j++) {
    const m = Math.max(r[i], r[j]); if (best && m >= best.rough) continue;
    const A = dEUnder(set[i], set[j], 'A'); if (A > min) best = { i, j, rough: m, A, d65: dEUnder(set[i], set[j], 'D65') };
  }
  return best;
}
