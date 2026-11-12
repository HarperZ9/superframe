import { test } from "node:test";
import assert from "node:assert/strict";
import { lumaHistogram, hueHistogram } from "../distributions.mjs";
import { gradient, checker } from "./fixtures/frames.mjs";

test("lumaHistogram: length=bins, sums to ~1, gradient spreads across bins", () => {
  const { data, width, height } = gradient();
  const hist = lumaHistogram(data, width, height, 4, 16);
  assert.equal(hist.length, 16);
  assert.ok(Math.abs(hist.reduce((a, b) => a + b, 0) - 1) < 1e-6);
  assert.ok(hist.filter((v) => v > 0).length >= 4);
});
test("hueHistogram: length=bins, grey frame yields all-zero (no saturated pixels)", () => {
  const grey = { data: new Uint8ClampedArray(8 * 8 * 4).fill(128), width: 8, height: 8 };
  for (let i = 3; i < grey.data.length; i += 4) grey.data[i] = 255;
  const hist = hueHistogram(grey.data, 8, 8, 4, 12);
  assert.equal(hist.length, 12);
  assert.equal(hist.reduce((a, b) => a + b, 0), 0);
});
