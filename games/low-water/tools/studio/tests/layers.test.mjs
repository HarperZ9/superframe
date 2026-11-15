// Layers and undo: the stack composites in order, a glaze keeps the value below, a mask clips its layer,
// a hidden layer shows nothing; undo restores a layer to the bit and redo puts the stroke back, with the
// stroke list kept in step; layer changes undo too.
//   node --test tools/studio/tests/layers.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { smallDoc, line, same } from "./fixture.mjs";
import { addLayer, composite, moveLayer } from "../core/doc.mjs";
import { beginStroke, strokeTo, endStroke } from "../core/stroke.mjs";
import { undo, redo, structural } from "../core/history.mjs";
import { lum } from "../core/passes.mjs";

const solid = (doc, c, a = 1) => { const f = new Float32Array(doc.w * doc.h * 4); for (let i = 0; i < doc.w * doc.h; i++) { f.set(c, i * 4); f[i * 4 + 3] = a; } return f; };
const outAt = (doc, x, y) => Array.from(doc.flat.subarray((y * doc.w + x) * 4, (y * doc.w + x) * 4 + 3));
function paint(doc, L, brush, pts, history = null, seed = 5) { const S = beginStroke(doc, L, brush, { history, seed }); for (const [x, y, p] of pts) strokeTo(S, x, y, p); return endStroke(S); }

test("layers composite in order: the top paint wins; moving it under hides it", () => {
  const { doc } = smallDoc(); const a = addLayer(doc, { name: "a", fill: solid(doc, [1, 0, 0]) }), b = addLayer(doc, { name: "b", fill: solid(doc, [0, 0, 1]) });
  composite(doc); assert.deepEqual(outAt(doc, 5, 5), [0, 0, 1]);
  moveLayer(doc, b.id, -1); composite(doc); assert.deepEqual(outAt(doc, 5, 5), [1, 0, 0]);
  b.visible = false; a.visible = false; composite(doc);
  assert.deepEqual(outAt(doc, 5, 5).map((v) => +v.toFixed(3)), [0.5, 0.5, 0.5], "control: hidden layers show nothing, the grey ground is back");
});

test("a glaze changes the hue and keeps the value; a paint layer of the same colour (control) changes the value", () => {
  const { doc } = smallDoc(); addLayer(doc, { name: "glaze", kind: "glaze", fill: solid(doc, [0.9, 0.5, 0.1], 0.6) }); composite(doc);
  const g = outAt(doc, 5, 5); assert.ok(Math.abs(lum(...g) - 0.5) < 0.03, `value kept (${lum(...g).toFixed(3)})`); assert.ok(g[0] > g[2] + 0.1, "warmer");
  const k = smallDoc(); addLayer(k.doc, { name: "paint", fill: solid(k.doc, [0.9, 0.5, 0.1], 0.6) }); composite(k.doc);
  assert.ok(Math.abs(lum(...outAt(k.doc, 5, 5)) - 0.5) > 0.03, "control: opaque paint moves the value");
});

test("a mask clips its layer: paint shows where the mask is, not elsewhere", () => {
  const { doc } = smallDoc(); const top = addLayer(doc, { name: "top", fill: solid(doc, [1, 0, 0]) });
  const m = new Float32Array(doc.w * doc.h * 4); for (let y = 0; y < doc.h; y++) for (let x = 0; x < 40; x++) m[(y * doc.w + x) * 4 + 3] = 1;
  addLayer(doc, { name: "mask", kind: "mask", target: top.id, fill: m }); composite(doc);
  assert.deepEqual(outAt(doc, 10, 10), [1, 0, 0]); assert.deepEqual(outAt(doc, 60, 10).map((v) => +v.toFixed(3)), [0.5, 0.5, 0.5]);
});

test("undo restores the layer to the bit, redo puts the stroke back, and the stroke list follows", () => {
  const { doc, paint: L, history: H } = smallDoc(); const blank = Float32Array.from(L.rgba);
  paint(doc, L, { colour: [0.2, 0.6, 0.3], size: 10 }, line(10, 30, 85, 30), H); const after = Float32Array.from(L.rgba);
  assert.ok(!same(after, blank), "control: the stroke changed the layer, so restoring it is a real check");
  assert.equal(doc.strokes.length, 1);
  undo(H); assert.ok(same(L.rgba, blank), "undo restores every value"); assert.equal(doc.strokes.length, 0);
  redo(H); assert.ok(same(L.rgba, after), "redo puts it back exactly"); assert.equal(doc.strokes.length, 1);
  paint(doc, L, { colour: [0.9, 0.9, 0.2], size: 6 }, line(10, 10, 85, 50), H); undo(H); undo(H);
  assert.ok(same(L.rgba, blank), "two undos past two strokes");
});

test("a new stroke after undo clears redo; layer changes undo", () => {
  const { doc, paint: L, history: H } = smallDoc();
  paint(doc, L, { colour: [0.2, 0.6, 0.3] }, line(10, 30, 85, 30), H); undo(H);
  paint(doc, L, { colour: [0.6, 0.2, 0.3] }, line(10, 20, 85, 20), H);
  assert.equal(redo(H), null, "nothing to redo after a new stroke");
  const n = doc.layers.length; structural(H, "add", () => addLayer(doc, { name: "extra" }));
  assert.equal(doc.layers.length, n + 1); undo(H); assert.equal(doc.layers.length, n); redo(H); assert.equal(doc.layers.length, n + 1);
  structural(H, "opacity", () => { L.opacity = 0.3; }); undo(H); assert.equal(L.opacity, 1); redo(H); assert.equal(L.opacity, 0.3);
});
