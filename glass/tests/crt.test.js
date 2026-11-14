// CRT: bar levels, snow statistics, scan pitch, roll and tear.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signal, display, bars, stats } from '../crt.js';

const BARS = [[.75, .75, .75], [.75, .75, 0], [0, .75, .75], [0, .75, 0], [.75, 0, .75], [.75, 0, 0], [0, 0, .75]];

test('75% bars: seven bars in order at 0.75 gamma-encoded, PLUGE below black, levels survive the band limit', () => {
  BARS.forEach((c, k) => assert.deepEqual(bars((k + 0.5) / 7, 0.3), c));
  assert.ok(bars(5.15 / 7, 0.9)[0] < 0, 'sub-black step');
  const s = signal({ content: 'bars', jitter: 0, lines: 60, samples: 700 }), row = 20 * 700;
  for (let k = 0; k < 7; k++) {
    const i = (row + Math.round((k + 0.5) * 100)) * 3;
    BARS[k].forEach((v, c) => assert.ok(Math.abs(s.data[i + c] - v) < 0.03, `bar ${k} channel ${c}: ${s.data[i + c]}`));
  }
});

test('snow is Gaussian, band-limited along the line and independent across lines', () => {
  const st = stats(signal({ content: 'static', snow: 0.3, jitter: 0, lines: 120, samples: 640, seed: 3 }));
  assert.ok(Math.abs(st.kurtosis - 3) < 0.15, `kurtosis ${st.kurtosis}`);
  assert.ok(st.lagLine > 0.15, `along-line correlation ${st.lagLine}`);
  assert.ok(Math.abs(st.lagAcross) < 0.03, `across-line correlation ${st.lagAcross}`);
  const wide = stats(signal({ content: 'static', snow: 0.3, jitter: 0, lines: 120, samples: 640, seed: 3, lumaCycles: 600 }));
  assert.ok(wide.lagLine < st.lagLine, 'a wider luma band means less correlation');
});

test('the beam draws one bright row per scan line', () => {
  const s = signal({ content: 'static', snow: 0, jitter: 0, lines: 40, samples: 64 }), w = 64, h = 320;
  const O = display(s, w, h, { curve: 0, vignette: 0, mask: 0, halation: 0, spot: 0.25, bloom: 0 });
  const col = Array.from({ length: h }, (_, y) => O.data[(y * w + 32) * 4 + 1]);
  const peaks = col.filter((v, y) => y > 0 && y < h - 1 && v > col[y - 1] && v >= col[y + 1]).length;
  assert.equal(peaks, 40);
});

test('roll moves the blanking bar by roll x t frames; tear shifts the top lines far more than the bottom', () => {
  const a = signal({ content: 'card', roll: 0.25, t: 1, lines: 100, samples: 64, jitter: 0 });
  assert.ok(Math.abs(a.roll - 0.25 * 100 / (1 - 21 / 262)) < 1e-9);
  const blank = l => { let s = 0; for (let i = 0; i < 64 * 3; i++) s += Math.abs(a.data[l * 64 * 3 + i]); return s === 0; };
  assert.ok(Array.from({ length: 100 }, (_, l) => blank(l)).some(Boolean), 'a blank band is on screen');
  const t0 = signal({ content: 'bars', tear: 0, jitter: 0, lines: 100, samples: 700 });
  const t1 = signal({ content: 'bars', tear: 0.05, jitter: 0, lines: 100, samples: 700, t: 0.3 });
  const diff = l => { let s = 0; for (let i = 0; i < 2100; i++) s += Math.abs(t0.data[l * 2100 + i] - t1.data[l * 2100 + i]); return s; };
  assert.ok(diff(2) > 5 * diff(95) + 1e-6);
});
