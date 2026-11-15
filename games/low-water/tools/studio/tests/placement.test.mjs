// A changed head: a source whose reference fingerprint differs is re-baked (strokes replayed on the new
// reference, even when layer images exist), and strokes that now land on another material are flagged.
// Control: on the same head nothing is flagged and the cached images are used.
//   node --test tools/studio/tests/placement.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { smallDoc, memSink, line } from "./fixture.mjs";
import { createHistory } from "../core/history.mjs";
import { beginStroke, strokeTo, endStroke } from "../core/stroke.mjs";
import { saveSource, loadSource } from "../core/store.mjs";

// a fake reference: skin (4) left of column `edge`, ground right of it
function refOf(w, h, edge, hash) { const G = { w, h, id: new Uint8Array(w * h), N: new Float32Array(w * h * 3), loc: new Float32Array(w * h * 3) }; for (let i = 0; i < w * h; i++) if (i % w < edge) G.id[i] = 4; return { G, meta: { refHash: hash, key: { az: 0, el: 0 } }, anchors: [] }; }
function sitting(edge, hash) { const D = smallDoc(); D.doc.ref = refOf(D.doc.w, D.doc.h, edge, hash); D.doc.meta.refHash = "painted"; return { doc: D.doc, ref: D.doc.ref, history: createHistory(D.doc) }; }
async function paintAndReload(edgeNow, hashNow) {
  const s = sitting(60, "painted"), stroke = (y, x0, x1) => { const S = beginStroke(s.doc, s.doc.layers[1], { colour: [0.8, 0.2, 0.2], size: 4 }, {}); for (const [x, yy, p] of line(x0, y, x1, y, 10)) strokeTo(S, x, yy, p); endStroke(S); };
  stroke(10, 10, 40); stroke(40, 45, 58);   // both on skin when painted
  const sink = memSink(); await saveSource(s, sink, "src/p");
  return loadSource(sink, "src/p", { newSitting: () => sitting(edgeNow, hashNow), moodSitting: () => {} });
}
test("on a narrower head the stroke near the old edge is flagged; the other is placed", async () => {
  const b = await paintAndReload(50, "changed");
  assert.ok(b.refChanged && b.rebuilt, "re-baked even though the layer images were there");
  assert.equal(b.unplaced, 1); assert.deepEqual(b.doc.meta.unplaced, [1]); assert.ok(b.doc.meta.repaint.some((v) => v));
});
test("control: the same head uses the cached images and flags nothing", async () => {
  const b = await paintAndReload(60, "painted");
  assert.ok(!b.refChanged && !b.rebuilt); assert.equal(b.unplaced, undefined);
});
