// Re-projection through the form, on synthetic G-buffers: a head (skin) and a coat; the new reference
// moves and enlarges the head and adds a hat (the frame comes from the eyes, so the hat does not move it). Paint follows the head; the hat is flagged for repainting;
// a mark carried by picture position alone (control) lands in the wrong place.
//   node --test tools/studio/tests/reproject.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { correspond, warpLayer, pointMap, repaintMask } from "../core/reproject.mjs";

function fakeRef(w, h, cx, cy, r, hat = false) {
  const n = w * h, G = { w, h, id: new Uint8Array(n), loc: new Float32Array(n * 3), N: new Float32Array(n * 3), depth: new Float32Array(n) };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, u = (x - cx) / r, v = (y - cy) / r;
    if (u * u + v * v < 1) { const eye = Math.hypot(Math.abs(u) - 0.35, v + 0.1) < 0.12; G.id[i] = hat && v < -0.6 ? 6 : eye ? 15 : 4; G.loc[i * 3] = u * 0.1; G.loc[i * 3 + 1] = -v * 0.1 + 1.6; G.loc[i * 3 + 2] = Math.sqrt(Math.max(0, 1 - u * u - v * v)) * 0.1; }
    else if (y > cy + r) { G.id[i] = 57; G.loc[i * 3] = (x - cx) / r * 0.1; G.loc[i * 3 + 1] = 1.6 - (y - cy) / r * 0.1; }
  }
  return { G };
}

test("paint on the head follows the head when it moves and grows", () => {
  const A = fakeRef(100, 80, 30, 30, 15), B = fakeRef(100, 80, 60, 32, 20), corr = correspond(A, B, { cell: 0.06 });
  const L = { rgba: new Float32Array(100 * 80 * 4), height: new Float32Array(100 * 80) };
  for (let y = 28; y <= 32; y++) for (let x = 34; x <= 38; x++) { L.rgba[(y * 100 + x) * 4] = 1; L.rgba[(y * 100 + x) * 4 + 3] = 1; }   // a mark right of the head's centre
  const W = warpLayer(L, corr); let sx = 0, sy = 0, n = 0;
  for (let i = 0; i < 8000; i++) if (W.rgba[i * 4 + 3] > 0.5) { sx += i % 100; sy += (i / 100) | 0; n++; }
  assert.ok(n > 10, `the mark arrives (${n} px)`);
  const ex = 60 + (6 / 15) * 20, ey = 32; assert.ok(Math.abs(sx / n - ex) < 2.5 && Math.abs(sy / n - ey) < 2.5, `at (${(sx / n).toFixed(1)}, ${(sy / n).toFixed(1)}), expected near (${ex.toFixed(1)}, ${ey})`);
  assert.ok(Math.abs(sx / n - 36) > 10, "control: the same mark left at its picture position would be 20 px away");
  const map = pointMap(corr), q = map(36, 30); assert.ok(q && Math.abs(q[0] - ex) < 3 && Math.abs(q[1] - ey) < 3, `point map ${q}`);
});

test("a hat the old reference did not have is flagged where paint was; elsewhere it is not", () => {
  const A = fakeRef(100, 80, 40, 35, 18), B = fakeRef(100, 80, 40, 35, 18, true), corr = correspond(A, B, { cell: 0.06 });
  let hat = 0, flaggedHat = 0, flaggedFace = 0;
  for (let i = 0; i < 8000; i++) { if (B.G.id[i] === 6) { hat++; if (corr.flags[i]) flaggedHat++; } else if ((B.G.id[i] === 4 || B.G.id[i] === 15) && corr.flags[i]) flaggedFace++; }
  assert.ok(hat > 20 && flaggedHat === hat, `every hat pixel flagged (${flaggedHat}/${hat})`);
  assert.equal(flaggedFace, 0, "the face carries over");
  const painted = new Uint8Array(8000).fill(1), none = new Uint8Array(8000);
  assert.ok(repaintMask(corr, painted).reduce((a, b) => a + b) === hat);
  assert.equal(repaintMask(corr, none).reduce((a, b) => a + b), 0, "control: nothing painted there, nothing to repaint");
});
