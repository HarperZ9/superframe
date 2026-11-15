// The per-region blend between the underpainting and the paint: a region at 0 shows the underpainting's
// own strokes, at 1 the paint; other regions are untouched; undo puts it back; a rebuild replays it.
//   node --test tools/studio/tests/blend.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { smallDoc } from "./fixture.mjs";
import { composite } from "../core/doc.mjs";
import { setBlend } from "../core/blend.mjs";
import { undo } from "../core/history.mjs";
import { replay } from "../core/stroke.mjs";

// a fake reference: the left half is skin facing the key, the right half is ground
function withRef(D) {
  const { w, h } = D.doc, n = w * h, G = { w, h, id: new Uint8Array(n), N: new Float32Array(n * 3), loc: new Float32Array(n * 3), depth: new Float32Array(n) };
  for (let i = 0; i < n; i++) if (i % w < w / 2) { G.id[i] = 4; G.N[i * 3 + 2] = 1; }
  D.doc.ref = { G, meta: { key: { az: 0, el: 0 } }, anchors: [] };
  D.paint.rgba.fill(0); for (let i = 0; i < n; i++) { D.paint.rgba[i * 4] = 1; D.paint.rgba[i * 4 + 3] = 1; }
  composite(D.doc); return D;
}
const at = (doc, x, y) => Array.from(doc.flat.subarray((y * doc.w + x) * 4, (y * doc.w + x) * 4 + 3)).map((v) => +v.toFixed(3));

test("a region at 0 shows the underpainting there and nowhere else; undo restores it", () => {
  const D = withRef(smallDoc());
  assert.deepEqual(at(D.doc, 80, 30), [1, 0, 0], "control: at 1 the paint covers the ground");
  setBlend(D.doc, "ground", 0, { history: D.history });
  assert.deepEqual(at(D.doc, 90, 30), [0.5, 0.5, 0.5], "the ground region shows the grey underpainting");
  assert.deepEqual(at(D.doc, 10, 30), [1, 0, 0], "the face keeps its paint");
  assert.equal(D.doc.strokes.at(-1).op, "blend");
  undo(D.history); composite(D.doc); assert.deepEqual(at(D.doc, 90, 30), [1, 0, 0]); assert.equal(D.doc.strokes.length, 0);
});
test("a blend record replays in a rebuild; an unknown region is an error", () => {
  const A = withRef(smallDoc()); setBlend(A.doc, "face, light side", 0.25);
  const B = withRef(smallDoc()); replay(B.doc, A.doc.strokes);
  assert.ok(B.doc.flat.every((v, i) => Math.abs(v - A.doc.flat[i]) < 1e-6));
  assert.ok(Math.abs(at(B.doc, 10, 30)[0] - (0.25 + 0.75 * 0.5)) < 0.02, `face at a quarter paint (${at(B.doc, 10, 30)})`);
  assert.throws(() => setBlend(B.doc, "elbows", 0), /no blend region/);
});
