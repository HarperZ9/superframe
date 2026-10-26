import test from "node:test";
import assert from "node:assert/strict";
import { grainField, fitCanvas, rng } from "../raster.mjs";

const stats = (a) => { let s = 0, s2 = 0; for (const v of a) { s += v; s2 += v * v; } const m = s / a.length; return { mean: m, sd: Math.sqrt(s2 / a.length - m * m) }; };

test("grain SD matches the request (dither off)", () => {
  for (const sd of [0.5, 1.2, 4]) {
    const f = grainField(256, 256, { sd, clump: 2, dither: 0, seed: 3 });
    const st = stats(f);
    assert.ok(Math.abs(st.sd - sd) / sd < 0.02, `sd ${st.sd} vs ${sd}`);
    assert.ok(Math.abs(st.mean) < 1e-3);
  }
});

test("clumped grain is correlated over about the clump size; clump 1 is not", () => {
  const corr = (f, w) => { let a = 0, b = 0; for (let y = 0; y < w; y++) for (let x = 0; x < w - 1; x++) { const i = y * w + x; a += f[i] * f[i + 1]; b += f[i] * f[i]; } return a / b; };
  const c2 = corr(grainField(128, 128, { clump: 2, dither: 0, seed: 5 }), 128);
  const c1 = corr(grainField(128, 128, { clump: 1, dither: 0, seed: 5 }), 128);
  assert.ok(c2 > 0.5, `neighbour correlation at clump 2: ${c2}`);
  assert.ok(Math.abs(c1) < 0.1, `neighbour correlation at clump 1: ${c1}`);
});

test("TPDF dither alone has the triangular variance (1/6 of peak squared)", () => {
  const f = grainField(256, 256, { sd: 0, dither: 1, seed: 9 });
  const st = stats(f);
  assert.ok(Math.abs(st.sd * st.sd - 1 / 6) < 0.01, `variance ${st.sd * st.sd}`);
  assert.ok(Math.max(...f) <= 1 && Math.min(...f) >= -1);
});

test("same seed, same field; different seed, different field", () => {
  const a = grainField(64, 64, { seed: 12 }), b = grainField(64, 64, { seed: 12 }), c = grainField(64, 64, { seed: 13 });
  assert.deepEqual(Array.from(a), Array.from(b));
  assert.notDeepEqual(Array.from(a), Array.from(c));
  assert.notEqual(rng(1)(), rng(2)());
});

test("parameters out of range fail loudly", () => {
  assert.throws(() => grainField(0, 10), /positive size/);
  assert.throws(() => grainField(8, 8, { sd: 40 }), /sd must be/);
  assert.throws(() => grainField(8, 8, { clump: 0 }), /clump must be/);
});

test("fitCanvas sizes the backing store to CSS size x DPR, capped", () => {
  globalThis.devicePixelRatio = 2;
  const cv = { width: 300, height: 150, clientWidth: 700, clientHeight: 400 };
  assert.deepEqual(fitCanvas(cv), { changed: true, dpr: 2 });
  assert.equal(cv.width, 1400); assert.equal(cv.height, 800);
  assert.equal(fitCanvas(cv).changed, false);
  const big = { width: 1, height: 1, clientWidth: 2000, clientHeight: 100 };
  fitCanvas(big, { maxPx: 2600 });
  assert.equal(big.width, 2600);
  globalThis.devicePixelRatio = 3;
  const c3 = { width: 1, height: 1, clientWidth: 100, clientHeight: 100 };
  fitCanvas(c3, { maxDpr: 2.5 });
  assert.equal(c3.width, 250);
});
