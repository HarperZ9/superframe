// spectral.test.mjs: the spectral medium (spectral.mjs). White stays white under every light; a colour round-trips
// through its smooth spectrum; a constructed metamer pair matches under D65 and separates under illuminant A and under
// Kubelka-Munk mixing (the RGB engine, the control, cannot separate them: it holds one RGB for both); a spectral tank
// renders finite and close to the RGB tank for the same ink.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spectrumOf, spectrumRGB, toXYZ, metamericBlack, mixKM, ks, fromKS, ILLUMINANTS, BANDS } from '../lib/medium/spectral.mjs';
import { Medium } from '../lib/medium/medium.mjs';
import { render } from '../lib/medium/render.mjs';

const lin = h => { const n = parseInt(h.slice(1), 16); return [16, 8, 0].map(s => { const c = ((n >> s) & 255) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); };
const near = (a, b, e) => a.every((v, i) => Math.abs(v - b[i]) < e);

test('a perfect white is white under D65 and under A; illuminant A is warmer than D65 at the band ends', () => {
  for (const L of Object.keys(ILLUMINANTS)) assert.ok(near(spectrumRGB(new Array(BANDS).fill(1), L), [1, 1, 1], 1e-3), L);
  const A = ILLUMINANTS.A, D = ILLUMINANTS.D65; assert.ok(A[15] / A[0] > D[15] / D[0] * 5);
});

test('measured colours round-trip through their spectra, which stay inside (0, 1)', () => {
  for (const h of ['#a93b29', '#3e7d7f', '#ddd286', '#4c294d', '#263760', '#e8e756']) {
    const R = spectrumOf(h); assert.ok(near(spectrumRGB(R), lin(h), 1e-4), h); for (const r of R) assert.ok(r > 0 && r < 1);
  }
});

test('a constructed metamer: the same XYZ under D65, apart under illuminant A and when mixed with a third pigment', () => {
  const R1 = spectrumOf('#7a8a5a'), R2 = R1.map((v, i) => v + metamericBlack(R1, 'D65', { seed: 3, scale: 0.85 })[i]);
  assert.ok(near(toXYZ(R1), toXYZ(R2), 1e-6), 'one XYZ under D65');
  for (const r of R2) assert.ok(r > 0 && r < 1);
  const apartA = Math.hypot(...spectrumRGB(R1, 'A').map((v, i) => v - spectrumRGB(R2, 'A')[i]));
  const red = spectrumOf('#a93b29'), mixed = Math.hypot(...spectrumRGB(mixKM([{ R: R1, c: 1 }, { R: red, c: 1 }])).map((v, i) => v - spectrumRGB(mixKM([{ R: R2, c: 1 }, { R: red, c: 1 }]))[i]));
  assert.ok(apartA > 0.005 && mixed > 0.005, `apart under A ${apartA.toFixed(4)}, apart mixed ${mixed.toFixed(4)}`);
});

test('Kubelka-Munk: K/S round-trips, and a mix lies between its parts', () => {
  const R = spectrumOf('#ddd286'); assert.ok(near(fromKS(ks(R)), R, 1e-9));
  const a = spectrumOf('#a93b29'), b = spectrumOf('#3e7d7f'), m = mixKM([{ R: a, c: 1 }, { R: b, c: 1 }]);
  for (let i = 0; i < BANDS; i++) assert.ok(m[i] <= Math.max(a[i], b[i]) + 1e-9 && m[i] >= Math.min(a[i], b[i]) - 1e-9);
});

test('a spectral tank renders finite, close to the RGB tank for the same ink', () => {
  const tank = spectral => { const m = new Medium({ nx: 48, ny: 27, seed: 'sp', spectral }); m.add('ink', { x: 0.5, y: 0.55, r: 0.12 }, 2, { color: '#3e7d7f', at: 0 }); m.run(0.2); return render(m, 96, 54, { grain: 0 }); };
  const S = tank(true), R = tank(false); for (const v of S.data) assert.ok(Number.isFinite(v));
  const o = 4 * (30 * 96 + 48), d = Math.hypot(S.data[o] - R.data[o], S.data[o + 1] - R.data[o + 1], S.data[o + 2] - R.data[o + 2]);
  assert.ok(d < 0.08, `spectral and RGB agree for one ink (${d.toFixed(3)})`);
});

test('a spectral tank carries ink particles and ink ticks in the scene, finite and close to the RGB tank', async () => {
  const { loopTank } = await import('../lib/medium/loops.mjs');
  const shot = spectral => { const m = new Medium({ nx: 64, ny: 36, seed: 'sp2', spectral }); m.add('tesserae', { x: 0.5, y: 0.4, w: 0.06, h: 0.04 }, 1, { cols: 2, rows: 1, at: 0, loosen: { after: 0, over: 1, sink: 2 } }); m.run(1.5); return render(m, 128, 72, { grain: 0 }); };
  const S = shot(true), Rg = shot(false); let diff = 0, n = 0;
  for (let i = 0; i < S.data.length; i += 4) { assert.ok(Number.isFinite(S.data[i])); diff += Math.abs(S.data[i] - Rg.data[i]) + Math.abs(S.data[i + 1] - Rg.data[i + 1]) + Math.abs(S.data[i + 2] - Rg.data[i + 2]); n += 3; }
  assert.ok(diff / n < 0.03, `mean channel difference ${(diff / n).toFixed(4)}`);
  const m = loopTank('dry'); m.pigS = null; m.run(0.5); assert.ok(m.items[0].elements[0].look({}).absorbS.length === 16, 'the dry loop ink carries a spectrum');
});

test('in a spectral tank the bed layers, tile bodies and smoke go through the spectra too', () => {
  const mk = spectral => { const m = new Medium({ nx: 48, ny: 27, seed: 'sp3', spectral }); m.add('tesserae', { x: 0.5, y: 0.5, w: 0.1, h: 0.06 }, 1, { cols: 2, rows: 1, at: 0 }); m.add('tesserae', { x: 0.3, y: 0.7, w: 0.05, h: 0.04 }, 1, { cols: 1, rows: 1, at: 0, loosen: { after: 0, over: 0.5, sink: 30, settle: 30 } }); m.add('smoke', { x: 0.5, y: 0.15, r: 0.05 }, 20, { at: 0, for: 2 }); m.run(2.5); return m; };
  const s = mk(true), r = mk(false);
  assert.ok(s.layers.some(L => L.some(l => l.spec && l.spec.length === 16)), 'a settled layer keeps a spectrum');
  const a = render(s, 96, 54, { grain: 0 }), b = render(r, 96, 54, { grain: 0 }), A = render(s, 96, 54, { grain: 0, illuminant: 'A' });
  let diff = 0, shift = 0; for (let i = 0; i < a.data.length; i += 4) { for (let k = 0; k < 3; k++) { assert.ok(Number.isFinite(a.data[i + k])); diff += Math.abs(a.data[i + k] - b.data[i + k]); shift += Math.abs(a.data[i + k] - A.data[i + k]); } }
  const n = a.data.length * 0.75;
  assert.ok(diff / n < 0.03, `close to the RGB tank under D65 (${(diff / n).toFixed(4)})`);
  assert.ok(shift / n > 0.001, `the light change reaches the scene (${(shift / n).toFixed(4)})`);
});

test('opaque paint and glow on ticks go through the spectra: the forge and the dry loop render finite and near their RGB selves', async () => {
  const { loopTank } = await import('../lib/medium/loops.mjs');
  for (const name of ['forge', 'dry']) {
    const shot = spectral => { const m = loopTank(name, { spectral }); m.run(3); return render(m, 160, 90, { grain: 0, view: [0, 0, 1, 1] }); };
    const S = shot(true), Rg = shot(false); let diff = 0;
    for (let i = 0; i < S.data.length; i += 4) for (let k = 0; k < 3; k++) { assert.ok(Number.isFinite(S.data[i + k]), name); diff += Math.abs(S.data[i + k] - Rg.data[i + k]); }
    assert.ok(diff / (S.data.length * 0.75) < 0.05, `${name}: mean channel difference ${(diff / (S.data.length * 0.75)).toFixed(4)}`);
  }
});

test('the oil film integrates over the bands: high orders wash out as real films do, and the three-sample RGB film does not', async () => {
  const { filmSpectral } = await import('../lib/medium/specoptics.mjs');
  const { filmLinear } = await import('../../substrate/lib/thinfilm.mjs');
  const chroma = (f, lo, hi) => { let s = 0, n = 0; for (let d = lo; d < hi; d += 5) { const c = f(d); s += Math.max(...c) - Math.min(...c); n++; } return s / n; };
  const sLow = chroma(filmSpectral, 300, 500), sHigh = chroma(filmSpectral, 850, 1000), rLow = chroma(filmLinear, 300, 500), rHigh = chroma(filmLinear, 850, 1000);
  assert.ok(sHigh < 0.5 * sLow, `spectral ${sLow.toFixed(2)} -> ${sHigh.toFixed(2)}`);
  assert.ok(rHigh > 0.6 * rLow, `the RGB film keeps its saturation (${rLow.toFixed(2)} -> ${rHigh.toFixed(2)}), so the check can tell them apart`);
  assert.notDeepEqual(filmSpectral(400, 'D65'), filmSpectral(400, 'A'), 'the light changes the film');
});

test('the meniscus as a spectrum stays within 1% of the RGB grey (an honest null: grazing water reflection is near flat)', async () => {
  const { meniscusSpectral } = await import('../lib/medium/specoptics.mjs');
  for (const il of ['D65', 'A']) for (const v of meniscusSpectral(il)) assert.ok(Math.abs(v - 0.97) < 0.0097, `${il} ${v}`);
});

test('a spectral tank with the glass sphere and oil renders finite, near its RGB self under D65', async () => {
  const { tank, render, LOOK } = await import('../lib/medium/index.mjs');
  const a = tank('flow', {}), b = tank('flow', { spectral: true }); a.run(1); b.run(1);
  const view = [0.12, 0.7, 0.4, 0.98], A = render(a, 96, 54, { look: LOOK, view, grain: 0 }), B = render(b, 96, 54, { look: LOOK, view, grain: 0 });
  let d = 0; for (let i = 0; i < A.data.length; i++) { assert.ok(Number.isFinite(B.data[i])); d += Math.abs(A.data[i] - B.data[i]); }
  assert.ok(d / A.data.length < 0.04, `mean difference ${(d / A.data.length).toFixed(4)}`);
});
