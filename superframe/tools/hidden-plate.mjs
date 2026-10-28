// hidden-plate.mjs: a day picture that hides a second picture, shown by candlelight.
//   node tools/hidden-plate.mjs OUT_DIR DAY.png HIDDEN.png [--invert] [--light candle|A]
// HIDDEN is centre-cropped to DAY's size. Writes day.png (the encoded picture under D65), night.png (under the light),
// plain-night.png (the plain picture under the same light, for comparison) and check.json.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { encodePNG } from '../../feed-23/build/brush/png.js';
import { decodePNG } from '../adapters/core.mjs';
import { spectrumRGB } from '../lib/medium/spectral.mjs';
import { reflectanceOf, deltaE } from '../lib/medium/metamers.mjs';
import { makeHidden } from '../lib/medium/hidden.mjs';
import { toSrgb } from '../lib/pix.mjs';

const args = process.argv.slice(2), flag = f => args.includes(f), light = flag('--light') ? args[args.indexOf('--light') + 1] : 'candle';
const [out, dayPath, hidPath] = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--light');
if (!hidPath) { console.error('usage: node tools/hidden-plate.mjs OUT_DIR DAY.png HIDDEN.png [--invert] [--light candle|A]'); process.exit(2); }
mkdirSync(out, { recursive: true });
const D = decodePNG(readFileSync(dayPath)), H = decodePNG(readFileSync(hidPath)), w = D.w, h = D.h, n = w * h;
const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const rgb = new Float32Array(3 * n), t = new Float32Array(n), ox = Math.max(0, (H.w - w) >> 1), oy = Math.max(0, (H.h - h) >> 1);
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const i = y * w + x; for (let c = 0; c < 3; c++) rgb[3 * i + c] = lin(D.rgba[4 * i + c]);
  const j = (Math.min(H.h - 1, y + oy) * H.w + Math.min(H.w - 1, x + ox)) * 4, l = 0.2126 * lin(H.rgba[j]) + 0.7152 * lin(H.rgba[j + 1]) + 0.0722 * lin(H.rgba[j + 2]);
  t[i] = flag('--invert') ? 1 - Math.min(1, l) : Math.min(1, l);
}
// stretch the hidden picture's brightness to [0, 1], so its own ground maps to 0 (the plain picture) and its strongest
// mark to 1
{ let a = Infinity, b = -Infinity; for (let i = 0; i < n; i++) { a = Math.min(a, t[i]); b = Math.max(b, t[i]); } if (b > a) for (let i = 0; i < n; i++) t[i] = (t[i] - a) / (b - a); }
const t0 = Date.now(), res = makeHidden(rgb, t, n, { night: light, render: spectrumRGB }), secs = (Date.now() - t0) / 1000;
const enc = v => Math.round(Math.min(1, Math.max(0, toSrgb(Math.min(1, Math.max(0, v))))) * 255);
const write = async (name, f) => { const a = new Uint8ClampedArray(4 * n); for (let i = 0; i < n; i++) { const c = f(i); a[4 * i] = enc(c[0]); a[4 * i + 1] = enc(c[1]); a[4 * i + 2] = enc(c[2]); a[4 * i + 3] = 255; } writeFileSync(`${out}/${name}.png`, await encodePNG(w, h, a, b => deflateSync(b, { level: 6 }))); };
const plainDay = i => spectrumRGB(reflectanceOf([rgb[3 * i], rgb[3 * i + 1], rgb[3 * i + 2]]), 'D65'), plainNight = i => spectrumRGB(reflectanceOf([rgb[3 * i], rgb[3 * i + 1], rgb[3 * i + 2]]), light);
await write('day', i => [res.day[3 * i], res.day[3 * i + 1], res.day[3 * i + 2]]);
await write('night', i => [res.night[3 * i], res.night[3 * i + 1], res.night[3 * i + 2]]);
await write('plain-night', plainNight);
// checks on a pixel sample: the daylight match, and how far the candle picture moves
const M = [[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]], X = c => M.map(m => m[0] * c[0] + m[1] * c[1] + m[2] * c[2]), W = X([1, 1, 1]);
let worst = 0; const moved = [];
for (let i = 0; i < n; i += 97) { worst = Math.max(worst, deltaE(X([res.day[3 * i], res.day[3 * i + 1], res.day[3 * i + 2]]), X(plainDay(i)), W)); moved.push(deltaE(X([res.night[3 * i], res.night[3 * i + 1], res.night[3 * i + 2]]), X(plainNight(i)), W)); }
moved.sort((a, b) => a - b);
const check = { day: dayPath, hidden: hidPath, light, w, h, colours_solved: res.colours, colours_unsolved: res.failed, seconds: secs, d65_worst_dE_sampled: worst, night_dE_vs_plain: { median: moved[moved.length >> 1], p95: moved[Math.floor(moved.length * 0.95)] } };
writeFileSync(`${out}/check.json`, JSON.stringify(check, null, 1));
console.log(JSON.stringify(check));
