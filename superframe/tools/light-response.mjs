// light-response.mjs: what a surface reflects under each of a game's light sources, through spectra.
//   node tools/light-response.mjs SOURCES.mjs OUT_DIR [--n 17]
// SOURCES.mjs exports SOURCES: { kind: { K, rgb, parts? } } and its kelvin module's cmf(nm) (Low Water's
// game/engine/light/sources.mjs and kelvin.mjs). For each kind, the light's power spectrum is built the way the game
// builds its colour (a black body at K, or a mix of black bodies and lines weighted by luminance share), surfaces
// are smooth reflectance spectra (the superframe prism, Jakob-Hanika), and the reflected light is integrated on a
// 5 nm grid through the game's own colour matching functions. A white surface returns the game's light colour
// exactly, so the table changes coloured surfaces only.
// Writes spectral-response.bin (float32, kinds in manifest order, each n^3 x 3, r fastest) and
// spectral-response.json (the manifest: grid, encoding, kinds, white check per kind, the source file's hash).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { LAMBDA } from '../lib/medium/spectral.mjs';
import { reflectanceOf } from '../lib/medium/metamers.mjs';

const args = process.argv.slice(2), srcPath = args[0], out = args[1], N = args.includes('--n') ? Number(args[args.indexOf('--n') + 1]) : 17;
if (!out) { console.error('usage: node tools/light-response.mjs SOURCES.mjs OUT_DIR [--n 17]'); process.exit(2); }
const { SOURCES } = await import(pathToFileURL(srcPath).href);
const { cmf, xyzToRgb } = await import(pathToFileURL(join(dirname(srcPath), 'kelvin.mjs')).href);

const GRID = []; for (let nm = 380; nm <= 780; nm += 5) GRID.push(nm);
const planck = (nm, K) => { const l = nm * 1e-9; return 1 / (l ** 5 * (Math.exp(1.4388e-2 / (l * K)) - 1)); };
// a light as continuous power on GRID plus delta lines, each part scaled to unit luminance then weighted
function spectrumOf(src) {
  const parts = src.parts ?? (src.line ? [{ nm: src.line, w: 1 }] : [{ K: src.K, w: 1 }]);
  const cont = GRID.map(() => 0), lines = [];
  for (const p of parts) {
    if (p.nm) { lines.push({ nm: p.nm, w: p.w / cmf(p.nm)[1] }); continue; }
    const s = GRID.map(nm => planck(nm, p.K)), Y = s.reduce((a, v, i) => a + v * cmf(GRID[i])[1], 0);
    s.forEach((v, i) => { cont[i] += p.w * v / Y; });
  }
  return { cont, lines };
}
// reflectance at nm from the 16-band spectrum (linear between band centres, held at the ends)
const at = (R, nm) => { if (nm <= LAMBDA[0]) return R[0]; if (nm >= LAMBDA[LAMBDA.length - 1]) return R[R.length - 1]; const k = Math.floor((nm - LAMBDA[0]) / 20), t = (nm - LAMBDA[k]) / 20; return R[k] * (1 - t) + R[k + 1] * t; };
function reflectXYZ(sp, R) {
  let X = 0, Y = 0, Z = 0;
  GRID.forEach((nm, i) => { const e = sp.cont[i] * at(R, nm), c = cmf(nm); X += e * c[0]; Y += e * c[1]; Z += e * c[2]; });
  for (const L of sp.lines) { const e = L.w * at(R, L.nm), c = cmf(L.nm); X += e * c[0]; Y += e * c[1]; Z += e * c[2]; }
  return [X, Y, Z];
}

// the kinds' recipes: Low Water stores the rgb, so the parts are read back from the module source text
const text = readFileSync(srcPath, 'utf8'), recipes = {};
for (const [kind, src] of Object.entries(SOURCES)) {
  const m = text.match(new RegExp(`\\b${kind}:\\s*M\\((\\[[^\\]]*\\])`));
  const line = text.match(new RegExp(`\\b${kind}:\\s*\\{[^}]*lineRgb\\((\\d+)\\)`));
  recipes[kind] = m ? { parts: Function(`return ${m[1]}`)() } : line ? { line: +line[1] } : { K: src.K };
}

const kinds = Object.keys(SOURCES), size = N * N * N * 3, buf = new Float32Array(kinds.length * size), manifest = { kinds: [], grid: N, encoding: 'albedo linear = (i / (n - 1)) ^ 2.2 per channel; index ((b * n + g) * n + r) * 3', source: { path: srcPath, sha256: createHash('sha256').update(text).digest('hex') } };
// the table's own white entry (albedo 1, 1, 1 through the prism, about 0.999 reflective) is the normaliser, so that
// entry lands exactly on the game's colour
const WHITE = reflectanceOf([1, 1, 1]);
kinds.forEach((kind, k) => {
  const sp = spectrumOf(recipes[kind]), rgbW = xyzToRgb(...reflectXYZ(sp, WHITE)), target = SOURCES[kind].rgb;
  // white normalisation. Where the physical white and the game's colour agree (black bodies: they differ only by the
  // integration grid), a per-channel scale lands white on the game's colour exactly. Where they do not (sources with
  // lines: the game mixes clipped line colours, a pure 546 nm line lies far outside sRGB), a per-channel scale would
  // blow up, so the table keeps the physical colour, scaled to the game's luminance, and records the gap.
  const lumOf = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  // a channel both sides hold near 0 (a fire's blue) carries no colour information: it takes the other channels' mean
  const peak = Math.max(...rgbW), dark = [0, 1, 2].map(c => Math.abs(target[c]) < 0.01 && rgbW[c] / peak < 0.01);   // negative: out of gamut, the game clips it to 0
  const live = [0, 1, 2].filter(c => !dark[c]), diag = rgbW.map((v, c) => (Math.abs(v) > 1e-9 ? target[c] / v : Infinity));
  const mean = live.reduce((a, c) => a + diag[c], 0) / live.length;
  const agree = live.every(c => Number.isFinite(diag[c]) && Math.abs(diag[c] - mean) / mean < 0.1);
  const scale = agree ? diag.map((s, c) => (dark[c] ? mean : s)) : [0, 1, 2].map(() => lumOf(target) / lumOf(rgbW));
  let worst = 0;
  for (let b = 0; b < N; b++) for (let g = 0; g < N; g++) for (let r = 0; r < N; r++) {
    const alb = [r, g, b].map(i => (i / (N - 1)) ** 2.2), R = reflectanceOf(alb), o = xyzToRgb(...reflectXYZ(sp, R)).map((v, c) => Math.max(0, v * scale[c]));
    buf.set(o, k * size + ((b * N + g) * N + r) * 3);
  }
  const w = buf.subarray(k * size + size - 3, k * size + size);
  worst = Math.max(...[0, 1, 2].map(c => Math.abs(w[c] - target[c])));
  manifest.kinds.push({ kind, recipe: recipes[kind], white: Array.from(w), game_rgb: target, white_error: worst, normalise: agree ? 'per-channel (white = game colour)' : 'luminance only (the game colour approximates the lines; white here is physical)', use: agree ? 'yes' : 'advisory: the recipe read as physical power disagrees with the game colour; restate the line weights before use', offset_floats: k * size });
  console.log(kind.padEnd(12), (agree ? 'per-channel' : 'luminance  ').padEnd(12), 'white', Array.from(w).map(v => v.toFixed(3)).join(','), 'game', target.map(v => v.toFixed(3)).join(','));
});
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'spectral-response.bin'), Buffer.from(buf.buffer));
writeFileSync(join(out, 'spectral-response.json'), JSON.stringify(manifest, null, 1));
console.log('wrote', kinds.length, 'kinds,', (buf.byteLength / 1048576).toFixed(2), 'MB');
