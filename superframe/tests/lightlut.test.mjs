// lightlut.test.mjs: the spectral light-response tables built for Low Water's light kinds.
// Accept: white returns the game's light colour; spectral and RGB lighting nearly agree under daylight (control);
// under the sodium lamp the spectral table collapses hues that an RGB product keeps apart (the design intent).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { loadTable, reflect } from '../lib/medium/lightlut.mjs';

const DIR = new URL('../out/light-response/', import.meta.url);
const ready = existsSync(new URL('spectral-response.json', DIR));
const M = ready ? JSON.parse(readFileSync(new URL('spectral-response.json', DIR), 'utf8')) : null;
const T = ready ? loadTable(M, new Float32Array(readFileSync(new URL('spectral-response.bin', DIR)).buffer.slice(0))) : null;
const rgbOf = kind => M.kinds.find(k => k.kind === kind).game_rgb;
const hue = c => { const [r, g, b] = c, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn || 1e-9; const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return ((h * 60) + 360) % 360; };
const chroma = c => (Math.max(...c) - Math.min(...c)) / (Math.max(...c) || 1);
// surfaces: a red coat, a green field, a blue door, skin, the road
const SURF = { red: [0.45, 0.06, 0.05], green: [0.08, 0.30, 0.06], blue: [0.05, 0.09, 0.40], skin: [0.50, 0.30, 0.22], road: [0.20, 0.19, 0.17] };
const meanChroma = (f) => Object.values(SURF).reduce((a, s) => a + chroma(f(s)), 0) / 5;

test('the table exists (run tools/light-response.mjs first)', { skip: !ready }, () => assert.ok(T.kinds.size >= 18));
test('white returns the game\'s light colour for every kind marked for use', { skip: !ready }, () => {
  // a channel the game holds under 0.01 (a flame's blue) is dark on both sides and is matched to within 0.01
  for (const k of M.kinds.filter(k => k.use === 'yes')) reflect(T, k.kind, [1, 1, 1]).forEach((v, c) => assert.ok(Math.abs(v - k.game_rgb[c]) < (k.game_rgb[c] < 0.01 ? 0.01 : 1e-5), `${k.kind} ${c}: ${v} vs ${k.game_rgb[c]}`));
});
test('every flame and lamp source is marked for use; the fluorescent recipe disagrees and is advisory', { skip: !ready }, () => {
  for (const kind of ['embers', 'stove', 'tallow', 'candle', 'paraffin', 'bulb', 'sun', 'moon', 'window']) assert.equal(M.kinds.find(k => k.kind === kind).use, 'yes', kind);
  assert.notEqual(M.kinds.find(k => k.kind === 'fluorescent').use, 'yes');
});
test('control: under daylight through a window, spectral and RGB lighting nearly agree', { skip: !ready }, () => {
  const L = rgbOf('window');
  for (const [name, s] of Object.entries(SURF)) { const a = reflect(T, 'window', s), b = s.map((v, c) => v * L[c]); a.forEach((v, c) => assert.ok(Math.abs(v - b[c]) < 0.03, `${name} ${c}: ${v} vs ${b[c]}`)); }
});
test('under the sodium lamp, colours collapse toward one hue far more than an RGB product shows', { skip: !ready }, () => {
  const L = rgbOf('sodium');
  const hs = Object.values(SURF).map(s => hue(reflect(T, 'sodium', s))), hr = Object.values(SURF).map(s => hue(s.map((v, c) => v * L[c])));
  const span = h => Math.max(...h) - Math.min(...h);
  assert.ok(span(hs) < span(hr), `hue span spectral ${span(hs)} vs rgb ${span(hr)}`);
  // amended 2026-10-27 after the first run: max-min chroma is blind under warm light (every surface's blue is near 0),
  // so the collapse is read as the spread of r / (r + g) across the surfaces
  const rg = c => c[0] / (c[0] + c[1] + 1e-9), spread = f => { const v = Object.values(SURF).map(s => rg(f(s))); return Math.max(...v) - Math.min(...v); };
  const ss = spread(s => reflect(T, 'sodium', s)), sr = spread(s => s.map((v, c) => v * L[c]));
  assert.ok(ss < 0.6 * sr, `r/(r+g) spread spectral ${ss} vs rgb ${sr}`);
});
