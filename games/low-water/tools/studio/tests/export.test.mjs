// Export and the painting's source: a portrait set in the talk panel's shape (who -> mood -> light ->
// path) at 640 x 800, era ids beside the plain slice id, a manifest that says who painted what, and a
// source that saves and loads back to the same layers and strokes.
//   node --test tools/studio/tests/export.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { smallDoc, memSink, line } from "./fixture.mjs";
import { exportPortrait, mergeIndex, mergeManifest, authorship, resample, OUT_W, OUT_H } from "../core/export.mjs";
import { saveSource, loadSource } from "../core/store.mjs";
import { beginStroke, strokeTo, endStroke } from "../core/stroke.mjs";
import { createHistory } from "../core/history.mjs";

const stroke = (doc, L, author) => { const S = beginStroke(doc, L, { colour: [0.7, 0.3, 0.2], size: 12 }, { author }); for (const [x, y, p] of line(10, 32, 85, 32)) strokeTo(S, x, y, p); endStroke(S); };
// the talk panel's own lookup (game/engine/ui/portrait.mjs pathFor), restated: an entry must resolve through it
const pathFor = (index, who, face, light) => { const e = index[who]; if (!e) return null; const x = e[face] || e.neutral; return x ? x[light] || x.paraffin || null : null; };

test("a portrait exports at 640 x 800 under its era id and the plain slice id", async () => {
  const { doc, paint } = smallDoc(); stroke(doc, paint, "human"); doc.meta.person = "ned"; doc.meta.era = 2;
  const sink = memSink(), { entry } = await exportPortrait(doc, { mood: "neutral", sink });
  const img = sink.files.get("characters/portraits-painted/ned@e2/neutral-paraffin.png");
  assert.equal(img.width, OUT_W); assert.equal(img.height, OUT_H); assert.equal(img.data.length, OUT_W * OUT_H * 4);
  assert.ok(img.data.every((v, i) => i % 4 !== 3 || v === 255), "opaque");
  const index = mergeIndex({ fewell: { neutral: { paraffin: "x.png" } } }, [entry]);
  assert.equal(pathFor(index, "ned@e2", "neutral", "paraffin"), entry.file); assert.equal(pathFor(index, "ned", "warm", "paraffin"), entry.file, "the panel falls back to neutral");
  assert.equal(index.fewell.neutral.paraffin, "x.png", "other speakers kept");
  const e3 = { ...entry, id: "ned@e3", plain: null, file: "y.png" };
  assert.equal(mergeIndex(index, [e3]).ned.neutral.paraffin, entry.file, "control: another era never takes the plain id");
});

test("the manifest says who painted what; an all-procedural doc (control) credits nobody human", async () => {
  const { doc, paint } = smallDoc(); stroke(doc, paint, "human");
  const a = authorship(doc); assert.ok(a.pixels.human > 0.02 && a.pixels.procedural > 0.5, JSON.stringify(a)); assert.equal(a.strokes.human, 1);
  const k = smallDoc(), b = authorship(k.doc); assert.equal(b.pixels.human, undefined); assert.deepEqual(b.strokes, {});
  const man = mergeManifest(null, [{ id: "ned@e2", mood: "neutral", light: "paraffin", authorship: a }]);
  assert.ok(man.portraits["ned@e2/neutral-paraffin"].authorship.strokes.human === 1);
});

test("the area resample keeps the mean (768 to 640 has no integer factor)", () => {
  const w = 12, h = 6, src = new Float32Array(w * h * 4); for (let i = 0; i < w * h; i++) { src[i * 4] = (i % w) / w; src[i * 4 + 3] = 1; }
  const out = resample(src, w, h, 8, 4), mean = (a, n) => { let s = 0; for (let i = 0; i < n; i++) s += a[i * 4]; return s / n; };
  assert.ok(Math.abs(mean(src, w * h) - mean(out, 32)) < 1e-6);
});

test("the source saves and loads back: same layers, same pixels to 8 bits, same strokes", async () => {
  const A = smallDoc(); stroke(A.doc, A.paint, "human"); const sink = memSink(), sitting = { doc: A.doc };
  const r = await saveSource(sitting, sink, "src/test"); assert.equal(r.layers, 1, "only the hand-painted layer is stored"); assert.equal(r.strokes, 1);
  assert.ok(!sink.files.has("src/test/underpainting.png"), "the underpainting is regenerated, not stored");
  const newSitting = () => { const B = smallDoc(); return { doc: B.doc, history: createHistory(B.doc) }; };
  const back = await loadSource(sink, "src/test", { newSitting, moodSitting: () => {} });
  const L = back.doc.layers.find((l) => l.name === "paint"); let worst = 0;
  for (let i = 0; i < L.rgba.length; i++) worst = Math.max(worst, Math.abs(L.rgba[i] - A.paint.rgba[i]));
  assert.ok(worst <= 0.5 / 255 + 1e-6, `within 8-bit rounding (${worst})`); assert.equal(back.doc.strokes.length, 1);
  sink.files.get("src/test/doc.json").format = "other";
  await assert.rejects(loadSource(sink, "src/test", { newSitting, moodSitting: () => {} }), /not a Studio source/, "control: a foreign file is refused");
});

test("a mask that clips a painted layer is stored with it and comes back clipping the same layer", async () => {
  const A = smallDoc(); stroke(A.doc, A.paint, "script");
  const fill = new Float32Array(A.doc.w * A.doc.h * 4); for (let i = 0; i < A.doc.w * A.doc.h; i++) fill[i * 4 + 3] = (i % A.doc.w) < 40 ? 1 : 0;
  const { addLayer } = await import("../core/doc.mjs"); addLayer(A.doc, { name: "paint mask", kind: "mask", author: "procedural", locked: true, target: A.paint.id, fill });
  const sink = memSink(); await saveSource({ doc: A.doc }, sink, "src/m");
  const newSitting = () => { const B = smallDoc(); return { doc: B.doc, history: createHistory(B.doc) }; };
  const back = await loadSource(sink, "src/m", { newSitting, moodSitting: () => {} });
  const m = back.doc.layers.find((l) => l.name === "paint mask"), p = back.doc.layers.find((l) => l.name === "paint");
  assert.ok(m && m.target === p.id, "the mask clips the reloaded paint layer");
  assert.equal(m.rgba[3], 1); assert.equal(m.rgba[(60) * 4 + 3], 0);
  const lone = smallDoc(); await saveSource({ doc: lone.doc }, sink, "src/n");
  assert.ok(!sink.files.has("src/n/paint-mask.png"), "control: no mask, nothing stored for one");
});

test("with the layer images gone (images stay out of git) the strokes rebuild the painting exactly", async () => {
  const A = smallDoc(); stroke(A.doc, A.paint, "human"); const sink = memSink(); await saveSource({ doc: A.doc }, sink, "src/r");
  sink.files.delete("src/r/paint.png"); sink.files.delete("src/r/paint.height.png");
  const newSitting = () => { const B = smallDoc(); return { doc: B.doc, history: createHistory(B.doc) }; };
  const back = await loadSource(sink, "src/r", { newSitting, moodSitting: () => {} });
  const L = back.doc.layers.find((l) => l.name === "paint");
  assert.ok(back.rebuilt, "rebuilt from strokes"); assert.equal(back.doc.strokes.length, 1);
  assert.ok(L.rgba.every((v, i) => v === A.paint.rgba[i]), "bit-identical to the painting that was saved");
  sink.files.delete("src/r/strokes.jsonl");
  await assert.rejects(loadSource(sink, "src/r", { newSitting, moodSitting: () => {} }), /no src\/r\/strokes.jsonl/, "control: with no strokes either, loading fails loudly");
});
