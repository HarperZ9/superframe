// medium.test.mjs: the living medium (lib/medium). Same seed gives the same bytes; a bad additive is refused by
// name; poured pigment is carried and settled, never created after the pour ends; every field stays finite; the
// readings (sheets, view, mosaic, core sample) have the shapes they promise; a form travels by its mode; every port
// type pours. Small grids keep the slice fast. The medium.tank node golden lives in adapters.golden.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Medium, KINDS, LAWS, SHEETS, PLANES, render, view, core, exportSheets, tank, additivesFromPort, printSheets } from '../lib/medium/index.mjs';
import { make } from '../lib/types.mjs';

const hash = R => createHash('sha256').update(Buffer.from(R.data.buffer, R.data.byteOffset, R.data.byteLength)).digest('hex');
const small = (seed = 't') => { const m = new Medium({ nx: 64, ny: 36, seed }); m.add('text', { x: 0.45, y: 0.4, w: 0.4, h: 0.12 }, 1, { text: 'ab', at: 0.1, for: 0.2 }); m.add('heat', 'bottom', 2); m.add('wind', 'air', 0.8, { gusts: true }); return m; };
const total = (m, f) => { let s = 0; for (const a of f) for (let k = 0; k < m.n; k++) s += a[k]; return s; };

test('same seed, same bytes; another seed differs', () => {
  const a = small().run(1.5), b = small().run(1.5), c = small('other').run(1.5);
  assert.equal(hash(render(a, 160, 90)), hash(render(b, 160, 90)));
  assert.notEqual(hash(render(a, 160, 90)), hash(render(c, 160, 90)));
});

test('an unknown additive is refused by name, and a form needs a raster', () => {
  const m = new Medium({ nx: 32, ny: 18 });
  assert.throws(() => m.add('lava', {}, 1), /no additive "lava"/);
  assert.throws(() => { m.add('form', { x: 0.5, y: 0.5, w: 0.2, h: 0.2 }, 1, { at: 0 }); m.run(0.2); }, /needs props.raster/);
  for (const k of ['ink', 'text', 'oil', 'heat', 'wind', 'glass', 'bubbles', 'tiles', 'salt', 'sugar', 'smoke', 'mist', 'sound']) assert.ok(KINDS[k], k);
});

test('pigment is carried, not created: after the pour ends the water holds no more than was poured, and every field stays finite', () => {
  const m = new Medium({ nx: 64, ny: 36, seed: 'mass' });
  m.add('ink', { x: 0.5, y: 0.45, r: 0.06 }, 1, { color: '#1d2a3a', at: 0, for: 0.3 }); m.add('heat', 'bottom', 2);
  m.run(0.4); const after = total(m, m.pig) + total(m, m.sed);
  m.run(2.5); const later = total(m, m.pig) + total(m, m.sed);
  assert.ok(after > 0.5, `pigment poured (${after})`);
  // carried and settled pigment is kept (advection renormalised); a little leaves as stain and in bubbles
  assert.ok(later <= after * 1.01 && later >= after * 0.9, `pigment neither created nor lost after the pour: ${after.toFixed(3)} then ${later.toFixed(3)}`);
  for (const f of [m.u, m.v, m.T, m.h, ...m.pig, ...m.sed]) for (const x of f) assert.ok(Number.isFinite(x));
});

test('the real text is kept beside the ink', () => {
  const m = small(); m.run(0.5);
  assert.deepEqual(m.texts(), ['ab']);
});

test('sheets: every property, element, medium and law; laws do not shadow properties', () => {
  for (const l of LAWS) assert.equal(SHEETS[l].group, 'law', l);
  assert.equal(SHEETS.index.group, 'property');
  const m = small().run(1), S = exportSheets(m);
  assert.equal(S.length, Object.keys(SHEETS).length);
  for (const s of S) { assert.equal(s.values.length, m.n, s.name); for (const v of s.values) assert.ok(v >= -1 && v <= 1, `${s.name} ${v}`); }
  const c = core(m, 0.5, 0.6);
  assert.equal(c.phase, 'water'); assert.ok(Math.abs(c.sheets.index - (c.raw.ior - 1) / 0.5) < 1e-3, 'index reads the refractive index');
});

test('views: stack, exploded, planes and mosaic on every axis return rasters of the asked size', () => {
  const m = small().run(1), W = 96, H = 54;
  for (const v of [view(m, { W, H, layers: ['pigment', 'temperature'] }), view(m, { W, H, layers: ['pigment', 'oil'], mode: 'exploded' }), view(m, { W, H, layers: 'planes' }), view(m, { W, H, layers: ['pigment'], mode: 'solo', solo: 'pigment' })]) assert.equal(v.raster.data.length, W * H * 4);
  for (const axis of ['laws', 'elements', 'mediums', 'temperature']) assert.equal(view(m, { W, H, mosaic: { axis } }).raster.data.length, W * H * 4, axis);
  assert.equal(view(m, { W, H, mosaic: { axis: 'speed', ribbons: true } }).raster.w, W);
  assert.throws(() => view(m, { W, H, layers: ['nonsense'] }), /no sheet/);
  assert.deepEqual(Object.keys(PLANES), ['background', 'middle', 'foreground']);
});

test('a poured form travels by its mode: rigid keeps its shape, stretch and dissolve deform', () => {
  const R = make.raster(16, 16); for (let i = 0; i < 256; i++) R.data.set([i % 16 < 8 ? 0.1 : 0.9, 0.2, 0.2, 1], 4 * i);
  const out = {};
  for (const mode of ['rigid', 'stretch', 'dissolve']) {
    const m = new Medium({ nx: 64, ny: 36, seed: 'form' }); m.add('form', { x: 0.5, y: 0.5, w: 0.25, h: 0.25 }, 1, { raster: R, mode, at: 0 }); m.add('heat', 'bottom', 3); m.run(1.5);
    out[mode] = hash(render(m, 128, 72)); assert.ok(m.details.length >= 1, mode);
  }
  assert.equal(new Set(Object.values(out)).size, 3, 'each mode moves the form differently');
});

test('every port type pours as additives', () => {
  const ports = {
    text: make.text ? make.text('hi') : { text: 'hi' }, raster: make.raster(8, 8),
    series: { y: Float32Array.from([0, 1, 0.5]) }, events: { duration: 2, events: [{ t: 0.5, args: { note: 61, vel: 0.8 } }] },
    material: { core: { flow: 0.2, tension: 0.6, sheen: 0.4, particles: 0.5 }, palette: { accent: '#b0603a' } }, particles: { n: 1000 },
  };
  for (const [type, value] of Object.entries(ports)) { const a = additivesFromPort(type, value); assert.ok(a.length >= 1, type); for (const [k] of a) assert.ok(KINDS[k], `${type} -> ${k}`); }
  assert.equal(additivesFromPort('distribution', { kind: 'normal', mean: 0, sd: 0.8 })[0][0], 'turbulence');
  assert.deepEqual(additivesFromPort('score', { name: 'q', value: 0.5, target: [0.4, 0.6] }), [], 'a met goal leaves the water calm');
  assert.equal(additivesFromPort('score', { name: 'q', value: 0.1, target: [0.4, 0.6] })[0][0], 'turbulence', 'a missed goal stirs it');
  assert.deepEqual(additivesFromPort('time', { t: 1, duration: 2 }), [], 'time is the clock, not an additive');
  assert.deepEqual(additivesFromPort('nothing', {}), []);
});

test('the tank scene runs and its log names every additive', () => {
  const m = tank('flow', { nx: 64, ny: 36 }); m.run(0.5);
  assert.ok(m.log.length >= 6); assert.deepEqual(m.texts(), ['flow']);
});

test('props.spread sets how far a pour blooms, and the pigment total is kept while it does', () => {
  const run = spread => {
    const m = new Medium({ nx: 64, ny: 36, seed: 'bloom' }); m.add('ink', { x: 0.5, y: 0.55, r: 0.05 }, 1, { at: 0, for: 0.2, spread }); m.run(0.25);
    const P = k => m.pig[0][k] + m.pig[1][k] + m.pig[2][k], tot = () => { let t = 0; for (let k = 0; k < m.n; k++) t += P(k); return t; }, poured = tot();
    m.run(2.75); const t = tot(); let mx = 0, my = 0, v = 0;
    for (let k = 0; k < m.n; k++) { mx += P(k) * (k % 64); my += P(k) * Math.floor(k / 64); } mx /= t; my /= t;
    for (let k = 0; k < m.n; k++) v += P(k) * ((k % 64 - mx) ** 2 + (Math.floor(k / 64) - my) ** 2);
    return { radius: Math.sqrt(v / t), drift: Math.abs(t - poured) / poured };
  };
  const tight = run(0), plain = run(1), bloom = run(30);
  assert.ok(tight.radius <= plain.radius && plain.radius + 0.15 < bloom.radius, `rms radius in cells: tight ${tight.radius}, plain ${plain.radius}, bloom ${bloom.radius}`);
  for (const r of [tight, plain, bloom]) assert.ok(r.drift < 0.01, `pigment total drifted ${(100 * r.drift).toFixed(2)}%`);
});

// sRGB (0..1) to CIE L*a*b* (D65), for the Albers check
const toLab = rgb => { const lin = rgb.map(c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); const [x, y, z] = [[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]].map((r, i) => (r[0] * lin[0] + r[1] * lin[1] + r[2] * lin[2]) / [0.95047, 1, 1.08883][i]); const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116); return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))]; };
const lin2s = c => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const dE = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));

test('stacked sheets follow Albers XX-1: each further sheet darkens less (Weber-Fechner); multiply does not', async () => {
  const { readFileSync } = await import('node:fs');
  // the one Albers XX-1 measurement, kept by the reference library (method agreed 2026-10-26: unclipped depths 1 to 4)
  const G = JSON.parse(readFileSync(new URL('../../library/measures/albers-xx1.json', import.meta.url), 'utf8')), lv = G.levels.map(l => l.rgb_median.map(v => v / 255));
  const s2l = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4), paper = lv[0].map(s2l), ink = lv[1].map((c, k) => s2l(c) / paper[k]);
  const depthOf = (n, depth) => printSheets(paper, Array.from({ length: n }, () => ({ ink, cover: 1 })), { law: depth }).map(lin2s);
  const err = depth => [3, 4].map(n => dE(toLab(depthOf(n, depth)), toLab(lv[n])));
  const weber = err('weber'), mult = err('multiply');
  for (const e of weber) assert.ok(e < 6, `held-out depths 3 and 4 within dE 6 of the plate: ${weber.map(x => x.toFixed(1))}`);
  for (const e of mult) assert.ok(e > 10, `control: plain multiply misses the plate (${mult.map(x => x.toFixed(1))})`);
  const steps = [1, 2, 3].map(n => dE(toLab(depthOf(n, 'weber')), toLab(depthOf(n + 1, 'weber'))));
  assert.ok(steps[0] > steps[1] && steps[1] > steps[2], `each step smaller than the last: ${steps.map(x => x.toFixed(2))}`);
  assert.ok(dE(toLab(depthOf(1, 'weber')), toLab(lv[1])) < 0.5, 'one sheet prints exactly as its ink');
});

test('light loses red first with depth: the wall is bluer the deeper it sits', () => {
  const m = new Medium({ nx: 64, ny: 36, seed: 'depth' }); m.run(0.2); const R = render(m, 64, 36, { grain: 0 });
  const rb = y => { const o = 4 * (y * 64 + 32); return R.data[o] / R.data[o + 2]; };
  assert.ok(rb(20) > rb(28) && rb(28) > rb(33), `red over blue by depth: ${[20, 28, 33].map(y => rb(y).toFixed(3))}`);
});

test('a stratified start: a fresh ink drop floats on a salt layer; without the layer it sinks into that band', () => {
  const below = salt => { const m = new Medium({ nx: 64, ny: 36, seed: 's' }); if (salt) m.add('layer', { x: 0.5, y: 0.8, w: 0.5, h: 0.12 }, 1, { salt }); m.add('ink', { x: 0.5, y: 0.4, r: 0.05 }, 1, { at: 0.1, for: 0.3 }); m.run(5);
    let t = 0, deep = 0; for (let k = 0; k < m.n; k++) { const p = m.pig[0][k] + m.pig[1][k] + m.pig[2][k] + m.sed[0][k] + m.sed[1][k] + m.sed[2][k]; t += p; if (Math.floor(k / 64) / 36 > 0.68) deep += p; } return deep / t; };
  const layered = below(1.5), fresh = below(0);
  assert.ok(layered < 0.05, `pigment below the halocline with it: ${layered.toFixed(3)}`);
  assert.ok(fresh > 0.2, `control, no layer: ${fresh.toFixed(3)} sinks into that band`);
});

test('tesserae ride the flow as tiles: laid once, every tile kept, deformed by the plume, corners held in the water', async () => {
  const { tileShape, invBilinear } = await import('../lib/medium/tesserae.mjs');
  const m = new Medium({ nx: 96, ny: 54, seed: 'tess' });
  m.add('heat', { x: 0.6, y: 0.88, w: 0.08, h: 0.02 }, 3, { at: 0, for: 60 });
  m.add('tesserae', { x: 0.6, y: 0.6, w: 0.2, h: 0.04 }, 1, { cols: 8, rows: 2, at: 0.2 });
  m.run(0.3); assert.equal(m.tesserae.length, 16, 'a pour with no duration lays its tiles exactly once');
  const w0 = m.tesserae.map(t => tileShape(t).width);
  m.run(4);
  assert.equal(m.tesserae.length, 16);
  const ratio = m.tesserae.map((t, i) => tileShape(t).width / w0[i]), spread = Math.max(...ratio) - Math.min(...ratio);
  assert.ok(spread > 0.05, `tiles foreshorten unequally (width ratios ${Math.min(...ratio).toFixed(2)} to ${Math.max(...ratio).toFixed(2)})`);
  for (const t of m.tesserae) for (const [x, y] of t.c) assert.ok(y >= m.surfaceY(Math.round(x)) && y <= m.ny - 1, 'corner in the water');
  assert.deepEqual(invBilinear(5, 2, [0, 0], [10, 0], [10, 4], [0, 4]), [0.5, 0.5]);
  assert.equal(invBilinear(12, 2, [0, 0], [10, 0], [10, 4], [0, 4]), null);
});

test('smoke releases threads that the air carries, and they leave when they fall into the water or age out', () => {
  const m = new Medium({ nx: 96, ny: 54, seed: 'wick' }); m.add('smoke', { x: 0.1, y: 0.2, r: 0.03 }, 20, { at: 0, for: 30 }); m.add('wind', {}, 1, { at: 0, for: 30 });
  m.run(3); assert.ok(m.wisps.length > 500, `${m.wisps.length} tracers`);
  const xs = m.wisps.map(w => w.x); assert.ok(Math.max(...xs) - Math.min(...xs) > 5, 'the thread is drawn out by the air');
  for (const w of m.wisps) assert.ok(w.y < m.surfaceY(Math.round(w.x)) && w.age < 9);
  const quiet = new Medium({ nx: 96, ny: 54 }); quiet.add('smoke', { x: 0.1, y: 0.2, r: 0.03 }, 20, { at: 0, for: 30, threads: 0 }); quiet.run(1); assert.equal(quiet.wisps.length, 0, 'threads: 0 turns them off');
});

test('each sheet carries its own law: density_add traps ink over ink, screen adds light, and laws can meet in one stack', () => {
  const paper = [0.9, 0.88, 0.82], cyan = [0.05, 0.6, 0.85], yellow = [0.92, 0.75, 0.05];
  const mult = printSheets(paper, [{ ink: cyan, cover: 1 }, { ink: yellow, cover: 1 }], { law: 'multiply' }), dens = printSheets(paper, [{ ink: cyan, cover: 1 }, { ink: yellow, cover: 1 }], { law: 'density_add' });
  assert.ok(dens[2] > mult[2], 'the second ink over the first adds only part of its density (trap)');
  const lit = printSheets(paper, [{ ink: [0.3, 0.3, 0.3], cover: 1, law: 'screen' }]); assert.ok(lit.every((v, k) => v > paper[k]), 'a screen adds light');
  const mixed = printSheets(paper, [{ ink: cyan, cover: 1, law: 'density_add' }, { ink: yellow, cover: 1, law: 'weber' }, { ink: [0.2, 0.2, 0.2], cover: 0.5, law: 'screen' }]);
  for (const v of mixed) assert.ok(Number.isFinite(v) && v >= 0);
  assert.equal(printSheets(paper, [{ ink: cyan, cover: 1 }], { law: 'weber' }).map(v => +v.toFixed(5)).join(), printSheets(paper, [{ ink: cyan, cover: 1 }], { law: 'multiply' }).map(v => +v.toFixed(5)).join(), 'one sheet prints as its ink under weber');
});
