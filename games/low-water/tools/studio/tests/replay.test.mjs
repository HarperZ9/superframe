// Stroke recording and replay: a painting replays to the same pixels from its records; at twice the size
// it lands in the same places; through a map it moves with the form; a changed seed (control) does not
// reproduce the bristles.
//   node --test tools/studio/tests/replay.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { smallDoc, line, same } from "./fixture.mjs";
import { addLayer, composite } from "../core/doc.mjs";
import { beginStroke, strokeTo, endStroke, replay } from "../core/stroke.mjs";

function paintSet(doc, L) {
  const strokes = [
    [{ colour: [0.8, 0.3, 0.2], size: 9 }, line(8, 20, 88, 24)],
    [{ colour: [0.2, 0.3, 0.8], size: 6, tool: "brush" }, line(20, 50, 70, 10, 25, 0.9)],
    [{ tool: "knife", colour: [0.9, 0.85, 0.7], size: 14 }, line(40, 5, 44, 60, 20)],
    [{ tool: "smudge", size: 8 }, line(10, 22, 60, 40, 20)],
  ];
  strokes.forEach(([b, pts], k) => { const S = beginStroke(doc, L, b, { seed: 10 + k, author: "script" }); for (const [x, y, p] of pts) strokeTo(S, x, y, p); endStroke(S); });
}

test("records replay to identical pixels on a fresh canvas", () => {
  const A = smallDoc(); paintSet(A.doc, A.paint);
  assert.equal(A.doc.strokes.length, 4); assert.ok(A.doc.strokes.every((s) => s.author === "script" && s.pts.length > 5));
  const B = smallDoc(); replay(B.doc, JSON.parse(JSON.stringify(A.doc.strokes)));
  assert.ok(same(B.paint.rgba, A.paint.rgba), "colour and alpha identical");
  assert.ok(same(B.paint.height, A.paint.height), "height identical");
});

test("control: replaying with another seed does not reproduce the bristles", () => {
  const A = smallDoc(); paintSet(A.doc, A.paint);
  const B = smallDoc(); replay(B.doc, A.doc.strokes.map((s) => ({ ...s, seed: s.seed + 1 })));
  assert.ok(!same(B.paint.rgba, A.paint.rgba));
});

test("replay at twice the size lands on the same places", () => {
  const A = smallDoc(); paintSet(A.doc, A.paint);
  const B = smallDoc(192, 128); replay(B.doc, A.doc.strokes);
  let agree = 0, n = 0;
  for (let y = 0; y < 64; y++) for (let x = 0; x < 96; x++) {
    const a = A.paint.rgba[(y * 96 + x) * 4 + 3] > 0.3, b = B.paint.rgba[(y * 2 * 192 + x * 2) * 4 + 3] > 0.3; if (a || b) { n++; if (a === b) agree++; }
  }
  assert.ok(agree / n > 0.75, `coverage agrees on ${((100 * agree) / n).toFixed(0)} percent of painted pixels`);
});

test("a map moves the strokes (re-projection): shifted 20 px right, the paint follows", () => {
  const A = smallDoc(); const S = beginStroke(A.doc, A.paint, { colour: [0.8, 0.3, 0.2], size: 6 }, { seed: 1 }); for (const [x, y, p] of line(10, 30, 40, 30)) strokeTo(S, x, y, p); endStroke(S);
  const B = smallDoc(); replay(B.doc, A.doc.strokes, { map: (x, y) => [x + 20, y] });
  assert.ok(B.paint.rgba[(30 * 96 + 55) * 4 + 3] > 0.4 && B.paint.rgba[(30 * 96 + 15) * 4 + 3] < 0.05);
  const C = smallDoc(); replay(C.doc, A.doc.strokes, { map: () => null });
  assert.ok(C.paint.rgba.every((v, i) => i % 4 !== 3 || v === 0), "a map with no form there drops the stroke");
});

test("replay makes a missing layer through addLayer, with the record's author", () => {
  const A = smallDoc(); const L = addLayer(A.doc, { name: "eyes", author: "script" });
  const S = beginStroke(A.doc, L, { colour: [0.9, 0.9, 0.9], size: 3 }, { author: "script" }); for (const [x, y, p] of line(10, 10, 20, 10)) strokeTo(S, x, y, p); endStroke(S);
  const B = smallDoc(); let made = null;
  replay(B.doc, A.doc.strokes, { addLayer: (name, author) => (made = addLayer(B.doc, { name, author })) });
  assert.equal(made.name, "eyes"); assert.equal(made.author, "script");
  const C = smallDoc(); assert.throws(() => replay(C.doc, A.doc.strokes), /no layer "eyes"/, "control: without addLayer a missing layer is an error, not a silent skip");
});

test("a stroke replays against the layers that were visible when it was made", () => {
  const make = () => { const D = smallDoc(); const top = addLayer(D.doc, { name: "over", author: "human" }); top.rgba.fill(0); for (let i = 0; i < 96 * 64; i++) { top.rgba[i * 4] = 0.1; top.rgba[i * 4 + 2] = 0.9; top.rgba[i * 4 + 3] = 1; } composite(D.doc); return { ...D, top }; };
  const A = make(); A.top.visible = false; composite(A.doc);
  const S = beginStroke(A.doc, A.paint, { colour: [0.8, 0.3, 0.2], size: 8, pickup: 1, wetUnder: true }, { seed: 4 }); for (const [x, y, p] of line(10, 30, 85, 30)) strokeTo(S, x, y, p); endStroke(S);
  assert.deepEqual(A.doc.strokes[0].vis, ["underpainting", "paint"]);
  const B = make(); replay(B.doc, A.doc.strokes);
  assert.ok(same(B.paint.rgba, A.paint.rgba), "same pickup, same paint, though 'over' is shown now");
  assert.equal(B.top.visible, true, "visibility is put back after the replay");
  const C = make(); replay(C.doc, A.doc.strokes.map(({ vis, ...r }) => r));
  assert.ok(!same(C.paint.rgba, A.paint.rgba), "control: without the record, the brush picks up the blue layer over it");
});
