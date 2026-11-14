// The underpainting's stray dark squares: a small solid dark patch on skin the reference shows as lit is
// found and covered with the skin round it; a dark that the reference itself has (control) is left alone.
//   node --test tools/studio/tests/cleanup.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanupStrokes } from "../script/cleanup.mjs";

function setup() {
  const w = 80, h = 60, n = w * h, G = { w, h, id: new Uint8Array(n).fill(4) }, colour = new Float32Array(n * 4), under = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { colour.set([0.7, 0.55, 0.45, 1], i * 4); under.set([0.75, 0.58, 0.46, 1], i * 4); }
  const square = (x0, y0, s) => { for (let y = y0; y < y0 + s; y++) for (let x = x0; x < x0 + s; x++) under.set([0.04, 0.03, 0.03, 1], (y * w + x) * 4); };
  square(20, 20, 6);   // a stray square on lit skin
  square(55, 20, 6); for (let y = 20; y < 26; y++) for (let x = 55; x < 61; x++) colour.set([0.05, 0.04, 0.04, 1], (y * w + x) * 4);   // a dark the reference has, as dark as the underpainting there
  return { ref: { G, colour, meta: { w, h } }, under, doc: { w, h } };
}
test("a stray square is found and covered with the skin round it; a real dark (control) is left", () => {
  const { ref, under, doc } = setup(), r = cleanupStrokes(ref, under, doc);
  assert.equal(r.found, 1); assert.equal(r.strokes.length, 1);
  const s = r.strokes[0], [cx] = s.pts[1]; assert.ok(cx > 18 && cx < 28, `the stroke sits on the square (${cx})`);
  assert.ok(s.brush.colour[0] > 0.6, "with the skin's colour round it");
});
