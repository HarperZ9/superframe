import { test } from "node:test";
import assert from "node:assert/strict";
import { framebuffer, drawLine, drawDisc, rasterize } from "../backends/raster.mjs";
import { renderScene } from "../index.mjs";

const at = (fb, x, y) => { const o = (y * fb.width + x) * 4; return [fb.data[o], fb.data[o + 1], fb.data[o + 2], fb.data[o + 3]]; };

test("framebuffer initializes to background", () => {
  const fb = framebuffer(4, 4, [1, 2, 3, 255]);
  assert.deepEqual(at(fb, 2, 2), [1, 2, 3, 255]);
});
test("drawLine sets pixels along a horizontal run", () => {
  const fb = framebuffer(10, 10, [0, 0, 0, 255]);
  drawLine(fb, 1, 5, 8, 5, [255, 255, 255, 255]);
  assert.deepEqual(at(fb, 1, 5), [255, 255, 255, 255]);
  assert.deepEqual(at(fb, 8, 5), [255, 255, 255, 255]);
});
test("drawDisc fills its centre", () => {
  const fb = framebuffer(20, 20, [0, 0, 0, 255]);
  drawDisc(fb, 10, 10, 3, [200, 100, 50, 255]);
  assert.deepEqual(at(fb, 10, 10), [200, 100, 50, 255]);
});
test("rasterize(scene) returns RGBA with non-background edge pixels present", () => {
  const fb = rasterize(renderScene({ kind: "cube", n: 3, t: 0.3 }), { width: 128, height: 128 });
  assert.equal(fb.data.length, 128 * 128 * 4);
  let lit = 0; for (let i = 0; i < fb.data.length; i += 4) if (fb.data[i] + fb.data[i + 1] + fb.data[i + 2] > 60) lit++;
  assert.ok(lit > 0, "expected drawn edges/vertices");
});
