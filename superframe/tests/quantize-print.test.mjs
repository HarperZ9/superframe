// quantize-print.test.mjs: the era quantizer's print checks (PREREG P4 to P6 in lib/quantize/README.md). Duotone on
// one line, two-ink overlap as a product of transmittances with alpha blending as the control, an area-true
// halftone with the raw spot threshold as the control, and every preset running on a render.
import test from 'node:test';
import assert from 'node:assert/strict';
import { toLinear, linToLab, dE00 } from '../lib/quantize/ciede.mjs';
import { eyeLab } from '../lib/quantize/eye.mjs';
import { duotone, lineResidual, solidOverprint, screenCover, inksToImage, linOf } from '../lib/quantize/print.mjs';
import { twoInk } from '../lib/quantize/twoink.mjs';
import { PRESETS } from '../lib/quantize/presets.mjs';
import { loadRender, flat, hasRenders } from '../lib/quantize/planted.mjs';

test('P4: duotone lies on one line; 8-bit residual is the recorded miss; tritone control fails', { skip: !hasRenders() && 'renders not built' }, () => {
  for (const name of ['bow', 'rings']) {
    const img = loadRender(name, 8), d = duotone(img), t = duotone(img, { stops: ['#1d2a44', '#c0306a', '#f0d9a8'] });
    assert.ok(lineResidual(d.lin) < 1e-9, `${name} float ${lineResidual(d.lin)}`);
    // PREREG said < 0.004 after 8-bit encoding; it measured about 0.006. The bound was mis-derived: half a code at
    // the bright end is 0.0045 linear per channel, up to about 0.008 across three. Kept as a miss.
    const r8 = lineResidual(toLinear(d)); assert.ok(r8 > 0.004 && r8 < 0.008, `${name} 8-bit ${r8}`);
    assert.ok(lineResidual(t.lin) > 0.05, `${name} tritone ${lineResidual(t.lin)}`);
  }
});

test('P5: solid two-ink overlap equals paper x T1 x T2 within 2/255; alpha midpoint misses by more than 20/255', () => {
  const o = solidOverprint('#f4efe2', '#1fa3c8', '#e0462e'), one = new Float32Array([1]);
  const pix = inksToImage(1, 1, o.P, [o.T1, o.T2], [one, one]).rgba;
  const want = o.productLin.map(v => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055));
  for (let c = 0; c < 3; c++) assert.ok(Math.abs(pix[c] - want[c]) <= 2, `channel ${c}: ${pix[c]} vs ${want[c]}`);
  assert.ok(Math.max(...[0, 1, 2].map(c => Math.abs(o.alphaMid[c] - o.overlap[c]))) > 20, `alpha ${o.alphaMid} vs ${o.overlap}`);
});

test('P5: screened two-ink overlap pixels (both coverages 1) equal the solid product', () => {
  const r = twoInk(flat(32, 32, [20, 30, 25]), { cell: 8 }), o = solidOverprint('#f4efe2', '#1fa3c8', '#e0462e');
  let n = 0;
  for (let i = 0; i < 32 * 32; i++) if (r.rgba[4 * i] === o.overlap[0] && r.rgba[4 * i + 1] === o.overlap[1] && r.rgba[4 * i + 2] === o.overlap[2]) n++;
  assert.ok(n > 0, 'no full-overlap pixel found in a dark two-ink patch');
});

const coverMean = (t, o, N = 256) => { let s = 0; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) s += screenCover(x, y, t, o); return s / (N * N); };

test('P6: the area-true screen inks the tone within 0.5% (256 px patches, 8 px cell, 45 deg)', () => {
  for (let k = 1; k <= 9; k++) { const t = k / 10, m = coverMean(t, { cell: 8, angle: 45 }); assert.ok(Math.abs(m - t) < 0.005, `${t}: ${m}`); }
});

test('P6 control: the raw spot threshold misses area by more than 2% at some tone', () => {
  const worst = Math.max(...[1, 2, 3, 7, 8, 9].map(k => Math.abs(coverMean(k / 10, { cell: 8, angle: 45, areaTrue: false }, 64) - k / 10)));
  assert.ok(worst > 0.02, `worst ${worst}`);
});

test('P6: the eye-filtered halftone matches its target within dE00 1 at 187 ppd', () => {
  const N = 192, P = linOf('#f2ede1'), I = linOf('#15130f'), T = I.map((v, c) => v / P[c]);
  for (let k = 1; k <= 9; k++) { // all nine PREREG tones; the first build failed at 0.7, 0.8 and 0.9
    const t = k / 10;
    const cov = new Float32Array(N * N); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) cov[y * N + x] = screenCover(x, y, t, { cell: 8, angle: 45 });
    const lab = eyeLab(inksToImage(N, N, P, [T], [cov]).lin, N, N, 187), tgt = linToLab(P.map((p, c) => p * (1 - t * (1 - T[c]))));
    let m = 0, n = 0; for (let y = 48; y < 144; y++) for (let x = 48; x < 144; x++) { const i = 3 * (y * N + x); m += dE00([lab[i], lab[i + 1], lab[i + 2]], tgt); n++; }
    assert.ok(m / n < 1, `${t}: ${m / n}`);
  }
});

test('every preset runs on a render and returns an opaque image of the same size', { skip: !hasRenders() && 'renders not built' }, () => {
  const img = loadRender('bow', 16);
  for (const p of PRESETS) {
    const out = p.run(img); assert.equal(out.w, img.w); assert.equal(out.h, img.h);
    for (let i = 3; i < out.rgba.length; i += 4) assert.equal(out.rgba[i], 255, p.id);
    assert.ok(p.ppd > 5 && p.ppd < 400, `${p.id} ppd ${p.ppd}`); assert.ok(p.fact && p.authored, `${p.id} provenance`);
  }
});
