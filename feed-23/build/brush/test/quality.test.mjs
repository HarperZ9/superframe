import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Surface, liveStroke, preset, render, starcloud, linear, SPEC } from '../index.js';

test('S5: the star cloud at 160 px matches its golden image (mean under 0.25 codes, worst 32 px tile under 2)', async () => {
  const s = await render(starcloud(3), 160), got = s.toRGBA8({ dither: false });
  const gold = new Uint8Array(readFileSync(new URL('./golden/starcloud-160.rgba', import.meta.url)));
  assert.equal(got.length, gold.length);
  let sum = 0; for (let i = 0; i < got.length; i++) sum += Math.abs(got[i] - gold[i]);
  assert.ok(sum / got.length < 0.25, `mean ${sum / got.length}`);
  for (let ty = 0; ty + 32 <= s.h; ty += 32) for (let tx = 0; tx + 32 <= s.w; tx += 32) {
    let t = 0;
    for (let y = ty; y < ty + 32; y++) for (let x = tx; x < tx + 32; x++) for (let c = 0; c < 3; c++) { const i = (y * s.w + x) * 4 + c; t += Math.abs(got[i] - gold[i]); }
    assert.ok(t / (32 * 32 * 3) < 2, `tile ${tx},${ty}`);
  }
});

test('S4: one live billow sample on a 2880 x 1800 surface, painted and converted for blit, p95 under 8.3 ms', () => {
  const s = new Surface(2880, 1800).fill(linear('#0d0e14')), st = liveStroke(s, preset('billow'), { unit: 2880, seed: 2, color: '#e9e8f4' });
  const ms = [];
  for (let i = 0; i < 80; i++) {
    const t = performance.now();
    st.add({ x: 300 + i * 9, y: 900 + Math.sin(i / 7) * 80, p: 0.7, t: i / 120 });
    const d = s.takeDirty(); if (d) s.toRGBA8({ rect: d });
    ms.push(performance.now() - t);
  }
  ms.sort((a, b) => a - b);
  const p95 = ms[Math.floor(ms.length * 0.95)];
  assert.ok(p95 < 8.3, `p95 ${p95.toFixed(2)} ms`);
  assert.ok(SPEC.budget.includes('8.3'));
});

test('film grain is monochrome and leaves the mean tone where it was', () => {
  const s = new Surface(200, 200).fill([0.2, 0.3, 0.4]), before = s.read(0, 0);
  s.filmGrain({ period: 3, amount: 0.02 });
  const m = [0, 0, 0]; let spread = 0;
  for (let i = 0; i < s.px.length; i += 4) {
    for (let c = 0; c < 3; c++) m[c] += s.px[i + c];
    spread = Math.max(spread, Math.abs(Math.sqrt(s.px[i]) - Math.sqrt(0.2) - (Math.sqrt(s.px[i + 1]) - Math.sqrt(0.3))));
  }
  for (let c = 0; c < 3; c++) assert.ok(Math.abs(m[c] / 40000 - before[c]) / before[c] < 0.01, `channel ${c} mean moved`);
  assert.ok(spread < 1e-6, 'the same offset on every channel (no chroma noise)');
});
