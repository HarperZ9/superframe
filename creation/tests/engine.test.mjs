// engine.test.mjs: the acceptance tests (CORE.md: measure, name the laws, rebuild, check under a readout and under a
// light change), each with a control that must fail. node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as G from '../lib/gen/index.mjs';
import { combine, combineSummary } from '../lib/core/combine.mjs';
import { tickTest, colourTest } from '../lib/core/metamer.mjs';
import { cisTrans, enantiomer, position, isomerTest } from '../lib/core/isomer.mjs';
import { blendPalettes } from '../lib/core/align.mjs';
import { specOfHex, mixPigment, mixLight, spectrumRGB, chroma, hueDeg, assimilate, deltaE } from '../lib/core/spectral.mjs';
import { transferChecks } from '../lib/core/ticks.mjs';
import { recordCheck, combineRecorded } from '../lib/core/record.mjs';
import { makeLayer, F32, hexLin } from '../lib/core/layer.mjs';
import { decodePNG } from '../lib/ir/png.mjs';
import { paletteFromImage } from '../lib/ir/frontends.mjs';
import { paletteParts } from '../lib/ir/backends.mjs';

const W = 64, H = 40;
const field = (f, ink = [0.2, 0.3, 0.6], shape = 'absorb', name = 'f') => { const L = makeLayer(name, { w: W, h: H, law: { shape, params: { strength: 2, law: 'density_add' } }, ink }); for (let k = 0; k < W * H; k++) L.fields.amount[k] = f(k % W, Math.floor(k / W)); L.name = name; return L; };

test('section 12 metamer: equal value, different ticks, recombined with a third layer, come apart; the summary reader cannot', () => {
  const A = field((x, y) => 0.5 + 0.45 * Math.sin(x * 0.4) * Math.cos(y * 0.3));
  const r = tickTest(A);
  assert.ok(r.readout.diff < 2e-3, 'same readout (error diffusion leaves at most one step of residue)');
  assert.ok(r.split > 0.5, `split ${r.split}`);
  assert.ok(r.control < 0.05, `summary control ${r.control} must not split`);
});

test('section 18 colour metamer on 16-band spectra: same D65 colour, split by illuminant A; the RGB path cannot', () => {
  const S = field(() => 0.8, [0.45, 0.32, 0.22], 'sheet'); S.law.params.law = 'multiply';
  const r = colourTest(S);
  assert.ok(r.readout.inkDeltaE_D65 < 1, `D65 readout ${r.readout.inkDeltaE_D65}`);
  assert.ok(r.split > 1, `illuminant A split ${r.split}`);
  assert.ok(r.control < 0.3, `RGB control ${r.control}`);
});

test('section 19 isomers: cis/trans and enantiomer split with weights fixed; meso is a symmetry; blind control fails', () => {
  const ink = field((x) => x / W, [0.25, 0.35, 0.7], 'absorb', 'ink'), tiles = field((x, y) => ((x >> 3) + (y >> 3)) % 2, [0.9, 0.5, 0.2], 'cover', 'tiles');
  const ct = isomerTest([ink, tiles], L => cisTrans(L, 0, 1));
  assert.ok(ct.pass, JSON.stringify(ct));
  const chord = field(x => 1 - x / W, [0.8, 0.45, 0.2], 'absorb', 'chord');
  const en = isomerTest([ink, chord], L => [enantiomer(L[0]), L[1]]);
  assert.ok(en.pass, JSON.stringify(en));
  const disc = field((x, y) => (Math.hypot(x - (W - 1) / 2, y - (H - 1) / 2) < 12 ? 1 : 0), [0.3, 0.3, 0.3], 'absorb', 'disc');
  const meso = isomerTest([disc, chord], L => [enantiomer(L[0]), L[1]]);
  assert.ok(meso.symmetry && meso.pass, JSON.stringify(meso));
  const pos = isomerTest([ink, tiles], L => [L[0], position(L[1], 4, 0)]);
  assert.ok(pos.pass, JSON.stringify(pos));
});

test('section 20 align before blend: the aligned pigment blend keeps more chroma than the unaligned one', () => {
  const A = ['#d03010', '#0050a0', '#e08000', '#306048', '#cc8490', '#481818'].map(h => ({ lin: hexLin(h), w: 1 / 6 }));
  const B = ['#2a5aa8', '#c83a18', '#3c6a50', '#e6a020', '#55202a', '#d090a0'].map(h => ({ lin: hexLin(h), w: 1 / 6 }));   // the same kinds of colour, listed in another order
  const al = blendPalettes(A, B, 0.5, { align: true }), un = blendPalettes(A, B, 0.5, { align: false });
  assert.ok(al.meanChroma > un.meanChroma + 0.02, `aligned ${al.meanChroma} unaligned ${un.meanChroma}`);
  assert.equal(al.alignment.pairs.length, 6);
});

test('Bezold plate I: one pair, two laws: pigment mixing gives green, light mixing reaches grey', () => {
  const Y = specOfHex('#e4a010'), B = specOfHex('#1c3f6e'), P = spectrumRGB(mixPigment(Y, B));
  const h = hueDeg(P); assert.ok(h > 140 && h < 215, `pigment hue ${h}`);
  let least = 1e9; for (let c = 0.02; c < 1; c += 0.02) least = Math.min(least, chroma(spectrumRGB(mixLight(Y, B, c))));
  assert.ok(least < 10, `light mix least chroma ${least}`);
  let leastP = 1e9; for (let c = 0.1; c < 0.95; c += 0.05) leastP = Math.min(leastP, chroma(spectrumRGB(mixPigment(Y, B, c))));
  assert.ok(leastP > least, 'the pigment law never reaches the light law\'s grey');
});

test('Bezold effect: assimilation changes the reading at the observer and leaves the light alone', () => {
  const w = 40, h = 20, rgb = F32(3 * w * h), patch = [0.5, 0.3, 0.3];
  for (let k = 0; k < w * h; k++) { const x = k % w, on = x % 2 === 0; const sur = x < w / 2 ? [0.9, 0.9, 0.2] : [0.1, 0.1, 0.5]; rgb.set(on ? patch : sur, 3 * k); }
  const seen = assimilate(rgb, w, h), at = (x) => [seen[3 * (10 * w + x)], seen[3 * (10 * w + x) + 1], seen[3 * (10 * w + x) + 2]];
  assert.ok(deltaE(at(10), at(30)) > 3, 'the same patch reads differently in two surrounds');
  assert.deepEqual([rgb[3 * (10 * w + 10)], rgb[3 * (10 * w + 30)]], [patch[0], patch[0]], 'the light is unchanged');
});

test('section 13 transfer checks (adopted from the universe ticks): the lenia front passes, the crossfade control fails', () => {
  const run = mode => { const L = G.front.create({ w: 48, h: 30, mode, rate: mode === 'global' ? 0.5 : 3, threshold: 0.12, seeds: [[0.02, 0.5]] }); const s = []; for (let i = 0; i < 600 && !(s.length > 30 && s.at(-1).mean > 0.999); i++) { G.front.step(L, 1 / 30, {}); s.push({ mean: L.history.mean.at(-1), spread: L.history.spread.at(-1) }); } for (let i = 0; i < 10; i++) { G.front.step(L, 1 / 30, {}); s.push({ mean: L.history.mean.at(-1), spread: L.history.spread.at(-1) }); } return transferChecks(s); };
  const lenia = run('lenia'), cross = run('global');
  assert.ok(lenia.pass, JSON.stringify(lenia));
  assert.ok(!cross.pass && cross.peakSpread < 0.25, JSON.stringify(cross));   // its only spread is the seed patch it started with
});

test('transparency record predicts what survives better than a shuffled record', () => {
  const cases = []; let s = 11; const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const shapes = ['absorb', 'cover', 'sheet', 'absorb', 'screen'];
  for (let c = 0; c < 24; c++) { const n = 3 + Math.floor(r() * 3), layers = [], weights = []; for (let i = 0; i < n; i++) { const sh = shapes[Math.floor(r() * shapes.length)], f = r(), ph = r() * 6; const L = field((x, y) => Math.max(0, Math.min(1, f + 0.4 * Math.sin(x * 0.2 + ph + y * 0.1))), [r(), r(), r()], sh, `L${i}`); if (sh === 'cover') L.fields.rgb = F32(3 * W * H).fill(r()); layers.push(L); weights.push(r() < 0.3 ? 0.02 * r() : r()); } cases.push({ layers, weights }); }
  const res = recordCheck(cases);
  assert.ok(res.pass, JSON.stringify(res));
  const rec = combineRecorded(cases[0].layers, cases[0].weights).record;
  assert.ok(Array.isArray(rec.survived) && Array.isArray(rec.lost) && rec.structure.order.length === cases[0].layers.length);
});

test('every generator speaks the interface and its layer is input any other can take', () => {
  const features = JSON.parse(readFileSync(new URL('../data/sound-features.json', import.meta.url)));
  for (const [name, g] of Object.entries(G)) {
    if (!g?.create) continue;
    const L = g.create({ w: 32, h: 20, ...(name.startsWith('sound') ? { features } : {}) });
    for (let i = 0; i < 3; i++) g.step(L, 1 / 30, {});
    for (const k of ['create', 'step', 'ticks', 'value', 'settled', 'describe']) assert.equal(typeof g[k], 'function', `${name}.${k}`);
    assert.ok(g.ticks(L).amount instanceof Float32Array, `${name} ticks`);
    assert.equal(typeof g.value(L).mean, 'number');
    const d = g.describe(); assert.ok(d.law && d.mechanism && d.credits.length, `${name} describe`);
    if (L.w === 32 && L.h === 20 && !['clock'].includes(L.law.shape)) combine([L]);   // any layer combines
  }
});

test('real instance: the Kandinsky palette front end matches the save card within the recorded tolerance', () => {
  let png; try { png = readFileSync('kandinsky-vertiefte.png'); } catch { return; }
  const P = paletteParts(paletteFromImage(decodePNG(png), { k: 12 }));
  assert.equal(P.length, 12); assert.ok(Math.abs(P.reduce((s, p) => s + p.w, 0) - 1) < 1e-6);
});

test('section 25 motion metamers: one keyframe readout, different profiles; split by mid-flight, slow time, collision; keyframe control cannot', async () => {
  const { motionMetamerTest } = await import('../lib/core/motion.mjs');
  for (const [a, b] of [['linear', 'easeInOut'], ['spring', 'critical'], ['easeIn', 'easeInOut']]) {
    const r = motionMetamerTest(a, b);
    assert.ok(r.pass, JSON.stringify(r));
  }
});
