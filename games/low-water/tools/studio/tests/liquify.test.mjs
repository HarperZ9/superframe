// Liquify and transform: push moves paint along the stroke, pinch draws it in, bloat pushes it out; a
// transform moves a lassoed region; both reshape every layer (the underpainting too), undo, and replay
// exactly. Controls: a liquify with zero strength moves nothing; a point outside the lasso stays put.
//   node --test tools/studio/tests/liquify.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { smallDoc, same } from "./fixture.mjs";
import { composite } from "../core/doc.mjs";
import { beginLiquify, liquifyTo, endLiquify, transform, footprint } from "../core/liquify.mjs";
import { undo } from "../core/history.mjs";
import { replay } from "../core/stroke.mjs";

// a red disc on the paint layer at (cx, cy), radius r; the underpainting gets a dark spot there too
function disc(D, cx, cy, r) { const { w, h } = D.doc; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) { const i = y * w + x; D.paint.rgba.set([1, 0, 0, 1], i * 4); D.doc.layers[0].rgba.set([0.1, 0.1, 0.1, 1], i * 4); } composite(D.doc); return D; }
const mass = (L, w, h) => { let n = 0, sx = 0, sy = 0; for (let i = 0; i < w * h; i++) { const a = L.rgba[i * 4 + 3]; n += a; sx += (i % w) * a; sy += ((i / w) | 0) * a; } return { n, cx: sx / n, cy: sy / n }; };
function stroke(D, mode, pts, strength = 1, radius = 20) { const Q = beginLiquify(D.doc, { mode, radius, strength }, D.history); for (const [x, y] of pts) liquifyTo(Q, x, y, 1); return endLiquify(Q); }

test("push drags paint along the stroke, on every layer; zero strength (control) moves nothing", () => {
  const D = disc(smallDoc(), 30, 32, 8), before = mass(D.paint, 96, 64);
  stroke(D, "push", [[30, 32], [40, 32], [50, 32]]);
  const after = mass(D.paint, 96, 64); assert.ok(after.cx > before.cx + 4, `the paint moved right (${before.cx.toFixed(1)} -> ${after.cx.toFixed(1)})`);
  assert.ok(mass(D.doc.layers[0], 96, 64).n > 0 && D.doc.layers[0].rgba[(32 * 96 + 44) * 4] < 0.3, "the underpainting's dark spot moved with it");
  const K = disc(smallDoc(), 30, 32, 8), k0 = Float32Array.from(K.paint.rgba); stroke(K, "push", [[30, 32], [50, 32]], 0);
  assert.ok(same(K.paint.rgba, k0), "control: no strength, no change");
});
test("pinch shrinks, bloat grows; undo restores the layer exactly", () => {
  const area = (mode) => { const D = disc(smallDoc(), 48, 32, 10); stroke(D, mode, [[48, 32]], 1, 18); return { D, n: mass(D.paint, 96, 64).n }; };
  const base = mass(disc(smallDoc(), 48, 32, 10).paint, 96, 64).n, pin = area("pinch"), blo = area("bloat");
  assert.ok(pin.n < base * 0.9 && blo.n > base * 1.1, `pinch ${pin.n.toFixed(0)} < ${base.toFixed(0)} < bloat ${blo.n.toFixed(0)}`);
  const D = disc(smallDoc(), 48, 32, 10), keep = Float32Array.from(D.paint.rgba); stroke(D, "bloat", [[48, 32]], 1, 18); undo(D.history);
  assert.ok(same(D.paint.rgba, keep)); assert.equal(D.doc.strokes.length, 0);
});
test("a transform moves the lassoed region and nothing outside it; it replays exactly", () => {
  const D = disc(smallDoc(), 25, 32, 6); D.doc.layers[0].rgba.set([0.9, 0.9, 0.2, 1], (5 * 96 + 80) * 4); composite(D.doc);
  const rec = { op: "transform", poly: [[15, 22], [35, 22], [35, 42], [15, 42]], dx: 40, dy: 0, scale: 1.2, rot: 0, feather: 2, layers: D.doc.layers.map((l) => l.name), size: [96, 64] };
  transform(D.doc, rec, D.history);
  assert.ok(D.paint.rgba[(32 * 96 + 65) * 4 + 3] > 0.9, "the disc arrived 40 px right"); assert.ok(D.paint.rgba[(32 * 96 + 25) * 4 + 3] > 0.9, "and the original stays (a copy)");
  assert.deepEqual(Array.from(D.doc.layers[0].rgba.subarray((5 * 96 + 80) * 4, (5 * 96 + 80) * 4 + 3)).map((v) => +v.toFixed(2)), [0.9, 0.9, 0.2], "control: outside the lasso, untouched");
  const B = disc(smallDoc(), 25, 32, 6); B.doc.layers[0].rgba.set([0.9, 0.9, 0.2, 1], (5 * 96 + 80) * 4); composite(B.doc); replay(B.doc, D.doc.strokes);
  assert.ok(same(B.paint.rgba, D.paint.rgba) && same(B.doc.layers[0].rgba, D.doc.layers[0].rgba));
  assert.ok(footprint(rec, 96, 64)[32 * 96 + 25] === 1 && footprint(rec, 96, 64)[5 * 96 + 80] === 0);
});

test("reach moves a mass: at two thirds of the radius it still carries most of the push; tight (control) does not", () => {
  const moved = (reach) => {
    const D = smallDoc(160, 120); for (let y = 0; y < 120; y++) for (let x = 0; x < 160; x++) if (y % 8 < 4) D.paint.rgba.set([1, 0, 0, 1], (y * 160 + x) * 4);   // stripes across the push, to see it move
    const before = Float32Array.from(D.paint.rgba); const Q = beginLiquify(D.doc, { mode: "push", radius: 45, strength: 1, reach }, null);
    liquifyTo(Q, 80, 30, 1); liquifyTo(Q, 80, 60, 1); endLiquify(Q);
    let changed = 0; for (let y = 0; y < 120; y++) { const x = 80 + 30, i = (y * 160 + x) * 4 + 3; if (Math.abs(D.paint.rgba[i] - before[i]) > 0.3) changed++; } return changed;
  };
  const broad = moved(true), tight = moved(false);
  assert.ok(broad > tight, `pixels changed at two thirds of the radius: reach ${broad}, tight ${tight}`);
});
