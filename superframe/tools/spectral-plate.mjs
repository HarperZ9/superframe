// spectral-plate.mjs: metamer plates (one colour's metamer set under D65 above, under a second light below) and a
// picture relit through its spectra.
//   node tools/spectral-plate.mjs OUT_DIR SIZE SEED [picture.png]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { encodePNG } from '../../feed-23/build/brush/png.js';
import { decodePNG } from '../adapters/core.mjs';
import { spectrumOf, spectrumRGB } from '../lib/medium/spectral.mjs';
import { metamerSet, spread, matchError, reflectanceOf } from '../lib/medium/metamers.mjs';
import { toSrgb } from '../lib/pix.mjs';
import { rngFrom } from '../lib/seed.mjs';

const [out, sizeArg, seed, picture] = process.argv.slice(2);
if (!seed) { console.error('usage: node tools/spectral-plate.mjs OUT_DIR SIZE SEED [picture.png]'); process.exit(2); }
mkdirSync(out, { recursive: true });
const S = Number(sizeArg), report = {};
const enc = v => Math.round(Math.min(1, Math.max(0, toSrgb(Math.min(1, Math.max(0, v))))) * 255);
const png = async (name, w, h, rgba) => writeFileSync(`${out}/${name}.png`, await encodePNG(w, h, rgba, b => deflateSync(b, { level: 6 })));

for (const [hex, observer, light] of [['#7a8a5a', 'standard', 'A'], ['#3b5bd9', 'standard', 'candle'], ['#c23b22', 'standard', 'A'], ['#7a8a5a', 'protan', 'A']]) {
  const T = spectrumOf(hex), set = metamerSet(T, { observer, n: 32, rng: rngFrom(`${seed}/${hex}/${observer}`) });
  // order the members by their colour under the second light, so the lower band reads as a gradient
  const lit = set.map(s => ({ s, top: spectrumRGB(s, 'D65'), bot: spectrumRGB(s, light) })).sort((a, b) => (a.bot[0] - a.bot[2]) - (b.bot[0] - b.bot[2]));
  const rgba = new Uint8ClampedArray(S * S * 4), n = lit.length, gap = Math.round(S * 0.004);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const k = Math.min(n - 1, Math.floor(x / S * n)), edge = (x % Math.ceil(S / n)) < gap, mid = Math.abs(y - S / 2) < gap, i = 4 * (y * S + x);
    const c = edge || mid ? [0.9, 0.88, 0.84] : (y < S / 2 ? lit[k].top : lit[k].bot);
    rgba[i] = enc(c[0]); rgba[i + 1] = enc(c[1]); rgba[i + 2] = enc(c[2]); rgba[i + 3] = 255;
  }
  const name = `metamers-${hex.slice(1)}-${observer}-${light}`;
  await png(name, S, S, rgba);
  report[name] = { match_dE_D65: matchError(set, T), spread_dE: +spread(set, light).max.toFixed(2), spread_D65_to_standard: +spread(set, 'D65').max.toFixed(2) };
}
if (picture) {
  const P = decodePNG(readFileSync(picture));
  for (const light of ['D65', 'A', 'candle']) {
    const rgba = new Uint8ClampedArray(P.w * P.h * 4);
    for (let i = 0; i < P.w * P.h; i++) {
      const lin = [0, 1, 2].map(c => { const v = P.rgba[4 * i + c] / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
      const c = spectrumRGB(reflectanceOf(lin), light);
      rgba[4 * i] = enc(c[0]); rgba[4 * i + 1] = enc(c[1]); rgba[4 * i + 2] = enc(c[2]); rgba[4 * i + 3] = 255;
    }
    await png(`prism-${light}`, P.w, P.h, rgba);
  }
  report.prism = { picture, w: P.w, h: P.h };
}
writeFileSync(`${out}/plates.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report));
