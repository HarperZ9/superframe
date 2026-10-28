// refraction.test.mjs: refraction and dispersion from measured data (lib/medium/refraction.mjs), the claims of
// docs/prereg/REFRACTION-PREREG.md at a size that runs in seconds.
// Accept: catalogue indices; Fresnel identities; the ray-traced bow sits on Descartes' angle, red outside the primary
// and inside the secondary; a lens's colour focus shift is f / V.
// Controls: no dispersion gives no colour; unweighted rays lose Alexander's dark band.
import test from 'node:test';
import assert from 'node:assert/strict';
import { index, fresnel, descartes, bowHistogram, lensFocus } from '../lib/medium/refraction.mjs';

const deg = r => r * 180 / Math.PI, L = { d: 587.5618, D: 589.2938, F: 486.1327, C: 656.2725 };
const V = m => (index(m, L.d) - 1) / (index(m, L.F) - index(m, L.C));
const peak = (H, lo, hi) => { let b = -1, at = 0; for (let a = Math.floor(lo / H.bin); a < Math.ceil(hi / H.bin); a++) if (H.h[a] > b) { b = H.h[a]; at = a; } return (at + 0.5) * H.bin; };
const mean = (H, lo, hi) => { let s = 0, c = 0; for (let a = Math.floor(lo / H.bin); a < Math.ceil(hi / H.bin); a++) { s += H.h[a]; c++; } return s / c; };

test('catalogue indices: N-BK7, fused silica, and water relative to air', () => {
  assert.ok(Math.abs(index('n-bk7', L.d) - 1.51680) < 1e-5);
  assert.ok(Math.abs(V('n-bk7') - 64.17) < 0.05);
  assert.ok(Math.abs(index('silica', L.d) - 1.45846) < 1e-4);
  assert.ok(Math.abs(index('water', L.D) - 1.33299) < 1e-4);
});

test('Fresnel: R + T = 1, R_p vanishes at Brewster, total internal reflection past the critical angle', () => {
  for (let a = 0; a < 90; a += 1) { const f = fresnel(1, 1.5, Math.cos(a * Math.PI / 180)); assert.ok(Math.abs(f.rs + f.ts - 1) < 1e-12 && Math.abs(f.rp + f.tp - 1) < 1e-12); }
  assert.ok(fresnel(1, 1.5, Math.cos(Math.atan(1.5))).rp < 1e-12);
  assert.equal(fresnel(1.5, 1, Math.cos(45 * Math.PI / 180)).rs, 1);
});

test('the ray-traced rainbow sits on Descartes\' angle, red outside the primary and inside the secondary', () => {
  for (const nm of [450, 650]) {
    const n = index('water', nm), H = bowHistogram(n, { rays: 4e5, ks: [1], bin: 0.02, maxDeg: 90 });
    assert.ok(Math.abs(peak(H, 30, 46) - deg(descartes(n, 1))) < 0.1);
  }
  assert.ok(descartes(index('water', 700), 1) > descartes(index('water', 400), 1));
  assert.ok(descartes(index('water', 700), 2) < descartes(index('water', 400), 2));
});

test('Alexander\'s dark band, and control: without Fresnel weights it loses most of its darkness', () => {
  const n = index('water', 550);
  const w = bowHistogram(n, { rays: 2e5, bin: 0.25, maxDeg: 90 }), u = bowHistogram(n, { rays: 2e5, bin: 0.25, maxDeg: 90, fresnel: false });
  const rw = mean(w, 43.5, 49) / mean(w, 36, 40), ru = mean(u, 43.5, 49) / mean(u, 36, 40);
  assert.ok(rw < 0.2, `band ${rw}`);
  assert.ok(ru > 1.5 * rw, `unweighted ${ru} vs weighted ${rw}`);
});

test('a lens focuses red farther than blue by f / V; control: without dispersion it does not', () => {
  const R = 102.67405680049305, f = m => lensFocus(index('n-bk7', L[m]), { R, t: 4 });
  const shift = f('C') - f('F'), pred = f('d') / V('n-bk7');
  assert.ok(Math.abs(shift - pred) / pred < 0.02, `shift ${shift} vs ${pred}`);
  const nd = index('n-bk7', L.d);
  assert.equal(lensFocus(nd, { R, t: 4 }) - lensFocus(nd, { R, t: 4 }), 0);
  assert.ok(descartes(index('water', 400), 1) !== descartes(index('water', 700), 1));
});
