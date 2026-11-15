// The release gate: a painting rebuilt from its source (the stroke log, no layer images) matches the
// painting that was saved to within 1/255 on every channel. The case that drifted before: a layer added
// with a fill (a mood's override) and then painted over wet-under. Control: the same painting made with
// the composite left stale, the old bug, does not match its rebuild.
//   node --test tools/studio/tests/rebuild.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { smallDoc, memSink, line } from "./fixture.mjs";
import { addLayer, composite } from "../core/doc.mjs";
import { beginStroke, strokeTo, endStroke } from "../core/stroke.mjs";
import { createHistory } from "../core/history.mjs";
import { saveSource, loadSource } from "../core/store.mjs";

const blue = (doc) => { const f = new Float32Array(doc.w * doc.h * 4); for (let i = 0; i < doc.w * doc.h; i++) { f[i * 4 + 2] = 0.9; f[i * 4 + 3] = (i % doc.w) > 50 ? 1 : 0; } return f; };
const override = (doc) => { const L = addLayer(doc, { name: "mood: test", author: "procedural", locked: true, fill: blue(doc) }); L.mood = "test"; return L; };
function paint(doc, layer, colour, y, seed) { const S = beginStroke(doc, layer, { colour, size: 8, pickup: 1, wetUnder: true }, { seed, author: "script" }); for (const [x, yy, p] of line(5, y, 90, y, 30)) strokeTo(S, x, yy, p); endStroke(S); }
function make(stale) {
  const D = smallDoc(); paint(D.doc, D.paint, [0.8, 0.3, 0.2], 20, 1);
  override(D.doc); if (stale) D.doc.stale = false;   // the old bug: a filled layer added, the composite not refreshed
  const mp = addLayer(D.doc, { name: "mood: test paint", author: "script" }); mp.mood = "test"; if (stale) D.doc.stale = false;
  paint(D.doc, mp, [0.9, 0.8, 0.3], 40, 2); composite(D.doc); return D;
}
async function rebuild(D) {
  const sink = memSink(); await saveSource({ doc: D.doc }, sink, "src/g");
  for (const k of [...sink.files.keys()]) if (k.endsWith(".png")) sink.files.delete(k);   // images stay out of git
  const newSitting = () => { const B = smallDoc(); return { doc: B.doc, history: createHistory(B.doc) }; };
  const back = await loadSource(sink, "src/g", { newSitting, moodSitting: (s) => override(s.doc) });
  composite(back.doc); let worst = 0; for (let i = 0; i < D.doc.out.length; i++) worst = Math.max(worst, Math.abs(back.doc.out[i] - D.doc.out[i]) * 255);
  return { worst, rebuilt: back.rebuilt };
}
test("a rebuild from the stroke log matches the saved painting within 1/255", async () => {
  const r = await rebuild(make(false)); assert.ok(r.rebuilt); assert.ok(r.worst <= 1, `worst ${r.worst.toFixed(3)}/255`);
});
test("control: a painting made over a stale composite does not match its rebuild", async () => {
  const r = await rebuild(make(true)); assert.ok(r.worst > 1, `worst ${r.worst.toFixed(3)}/255`);
});
