// The brush engine: a loaded brush lays paint, its bristles leave a texture, it picks up wet colour,
// it runs dry along a long stroke, pressure sets its width, impasto adds height; the knife flattens and
// ridges, the smudge drags colour, the eraser takes paint off. Each check has a control that must fail it.
//   node --test tools/studio/tests/brush.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { smallDoc, alphaAt, line } from "./fixture.mjs";
import { beginStroke, strokeTo, endStroke } from "../core/stroke.mjs";
import { addLayer } from "../core/doc.mjs";

function paint(doc, L, brush, pts, seed = 3) { const S = beginStroke(doc, L, brush, { seed }); for (const [x, y, p] of pts) strokeTo(S, x, y, p); endStroke(S); return S; }
const covered = (doc, L, x, y) => alphaAt(L, doc.w, x, y) > 0.4;
const red = [0.8, 0.1, 0.1], blue = [0.1, 0.2, 0.85];

test("a loaded brush lays paint on its path and nowhere else; a zero-flow brush (control) lays none", () => {
  const { doc, paint: L } = smallDoc(); paint(doc, L, { colour: red, size: 6 }, line(10, 32, 80, 32));
  assert.ok(covered(doc, L, 30, 32) && covered(doc, L, 50, 32), "paint on the path");
  assert.ok(!covered(doc, L, 30, 10) && !covered(doc, L, 50, 58), "no paint off the path");
  const c = L.rgba.subarray((32 * doc.w + 30) * 4); assert.ok(c[0] > c[1] + 0.3, `red laid (${c[0].toFixed(2)}, ${c[1].toFixed(2)})`);
  const k = smallDoc(); paint(k.doc, k.paint, { colour: red, size: 6, flow: 0 }, line(10, 32, 80, 32));
  assert.ok(!covered(k.doc, k.paint, 30, 32), "control: zero flow lays nothing, so the check above can fail");
});

test("bristles leave streaks across the stroke; a one-bristle brush (control) does not", () => {
  const rough = (bristles) => {
    const { doc, paint: L } = smallDoc(); paint(doc, L, { colour: red, size: 12, bristles, flow: 0.35, load: 0.6, jitter: 0 }, line(10, 32, 80, 32, 30, 0.8));
    const prof = []; for (let y = 16; y <= 48; y++) prof.push(alphaAt(L, doc.w, 45, y));
    let d = 0; for (let k = 1; k < prof.length; k++) d += Math.abs(prof[k] - prof[k - 1]);
    const peak = Math.max(...prof); return d / Math.max(1e-6, peak);   // total variation over the peak: 2 for one smooth bump
  };
  const many = rough(18), one = rough(1);
  assert.ok(many > 2.6, `bristle streaks (variation ${many.toFixed(2)})`);
  assert.ok(one < 2.6, `control: one bristle is one smooth bump (variation ${one.toFixed(2)})`);
});

test("the brush picks up wet colour it passes through; with pickup 0 (control) it stays clean", () => {
  const run = (pickup) => {
    const { doc, paint: L } = smallDoc(120, 40); paint(doc, L, { colour: blue, size: 10, load: 1, depletion: 0 }, line(5, 20, 50, 20), 1);
    paint(doc, L, { colour: red, size: 8, pickup, depletion: 0 }, line(10, 20, 115, 20, 40), 2);
    const i = (20 * doc.w + 108) * 4; return L.rgba[i + 2] - (blue[2] * 0 + 0.1);   // blue left in the red at the far end
  };
  const dirty = run(0.9), clean = run(0);
  assert.ok(dirty > clean + 0.04, `blue carried into the red (${dirty.toFixed(3)} against ${clean.toFixed(3)})`);
});

test("a long stroke runs dry and breaks up at its end; with no depletion (control) it stays solid", () => {
  const cover = (depletion) => {
    const { doc, paint: L } = smallDoc(300, 40); paint(doc, L, { colour: red, size: 8, depletion, load: 0.8 }, line(5, 20, 295, 20, 80));
    const seg = (x0, x1) => { let s = 0, n = 0; for (let x = x0; x < x1; x++) for (let y = 16; y <= 24; y++) { s += alphaAt(L, doc.w, x, y); n++; } return s / n; };
    return { start: seg(10, 50), end: seg(250, 290) };
  };
  const d = cover(0.03), c = cover(0);
  assert.ok(d.end < d.start * 0.8, `dry at the end (${d.start.toFixed(2)} -> ${d.end.toFixed(2)})`);
  assert.ok(!(c.end < c.start * 0.8), `control: a brush that never empties does not dry (${c.start.toFixed(2)} -> ${c.end.toFixed(2)})`);
});

test("pressure sets width: a hard press is wider than a light one", () => {
  const width = (p) => { const { doc, paint: L } = smallDoc(); paint(doc, L, { colour: red, size: 12 }, line(10, 32, 80, 32, 20, p)); let n = 0; for (let y = 0; y < doc.h; y++) if (alphaAt(L, doc.w, 45, y) > 0.2) n++; return n; };
  const hard = width(1), light = width(0.15);
  assert.ok(hard > light * 1.6, `hard ${hard} px against light ${light} px`);
  assert.ok(!(light > hard * 1.6), "control: the comparison is not symmetric");
});

test("impasto raises the paint's height and the composite lights it; a glaze layer (control) has none", () => {
  const { doc, paint: L } = smallDoc(); paint(doc, L, { colour: red, size: 8, impasto: 1 }, line(10, 32, 80, 32));
  assert.ok(L.height[32 * doc.w + 45] > 0.2, `height ${L.height[32 * doc.w + 45].toFixed(2)}`);
  const litCount = (d) => { let n = 0; for (let i = 0; i < d.w * d.h; i++) if (Math.abs(d.out[i * 4] - d.flat[i * 4]) > 0.01) n++; return n; };
  assert.ok(litCount(doc) > 30, `the light moves ${litCount(doc)} pixels off their flat colour`);
  const k = smallDoc(); const g = addLayer(k.doc, { name: "glaze", kind: "glaze" }); paint(k.doc, g, { colour: red, size: 8, impasto: 1 }, line(10, 32, 80, 32));
  assert.equal(g.height, null); assert.equal(litCount(k.doc), 0, "control: a glaze carries no body, so nothing is lit");
});

test("the knife flattens the height it passes over and pushes a ridge at the blade's end", () => {
  const { doc, paint: L } = smallDoc(120, 80);
  for (let y = 20; y < 60; y += 4) paint(doc, L, { colour: red, size: 3, impasto: 1.2, bristles: 6 }, line(10, y, 110, y, 30), y);
  const spread = () => { const v = []; for (let x = 40; x < 80; x++) v.push(L.height[40 * doc.w + x]); const m = v.reduce((a, b) => a + b) / v.length; return v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length; };
  const before = spread();
  paint(doc, L, { tool: "knife", colour: [0.7, 0.6, 0.5], size: 30, impasto: 0.8, flow: 0.9 }, line(60, 5, 60, 75, 40, 0.8));
  const after = spread();
  assert.ok(after < before * 0.6, `flatter under the blade (${before.toFixed(4)} -> ${after.toFixed(4)})`);
  const mid = L.height[40 * doc.w + 60], end = Math.max(...[-27, -26, -25, 25, 26, 27].map((d) => L.height[40 * doc.w + 60 + d]));
  assert.ok(end > mid, `a ridge at the blade's end (${end.toFixed(2)} over ${mid.toFixed(2)})`);
});

test("the smudge drags colour forward; the eraser takes paint off", () => {
  const { doc, paint: L } = smallDoc(120, 40); paint(doc, L, { colour: blue, size: 10, depletion: 0 }, line(5, 20, 30, 20), 1);
  const at = (x) => L.rgba[(20 * doc.w + x) * 4 + 2];
  const before = at(55);
  paint(doc, L, { tool: "smudge", size: 8, flow: 0.9 }, line(20, 20, 70, 20, 30), 2);
  assert.ok(at(55) > before + 0.1, `blue dragged to x 55 (${before.toFixed(2)} -> ${at(55).toFixed(2)})`);
  const a0 = alphaAt(L, doc.w, 15, 20);
  paint(doc, L, { tool: "eraser", size: 10, flow: 1 }, line(10, 20, 22, 20, 10, 1), 3);
  assert.ok(alphaAt(L, doc.w, 15, 20) < a0 * 0.5, `erased (${a0.toFixed(2)} -> ${alphaAt(L, doc.w, 15, 20).toFixed(2)})`);
});

test("a locked layer refuses strokes (the underpainting is regenerated, never painted)", () => {
  const { doc } = smallDoc();
  assert.throws(() => beginStroke(doc, doc.layers[0], { colour: red }), /locked/);
});

test("a wide brush with few bristles leaves continuous tracks, not rows of beads", () => {
  const flicker = (strokes) => {
    const { doc, paint: L } = smallDoc(300, 80);
    for (const pts of strokes) { const S = beginStroke(doc, L, { colour: red, size: 40, bristles: 22, spread: 0.8, depletion: 0, jitter: 0 }, { seed: 2 }); for (const [x, y, p] of pts) strokeTo(S, x, y, p); endStroke(S); }
    let best = 0, cv = 0;   // the most-painted row is a bristle's track; how much does it flicker along the stroke?
    for (let y = 20; y < 60; y++) { const row = []; for (let x = 60; x < 240; x++) row.push(alphaAt(L, doc.w, x, y)); const m = row.reduce((a, b) => a + b) / row.length; if (m > best) { best = m; cv = Math.sqrt(row.reduce((a, b) => a + (b - m) ** 2, 0) / row.length) / m; } }
    return cv;
  };
  const smooth = flicker([line(20, 40, 280, 40, 60, 0.9)]);
  assert.ok(smooth < 0.15, `even along the track (variation ${smooth.toFixed(3)})`);
  const taps = []; for (let x = 20; x <= 280; x += 24) taps.push([[x, 40, 0.9], [x + 1, 40, 0.9]]);
  const control = flicker(taps);   // control: separate dabs 24 px apart are beads, and the measure sees them
  assert.ok(control > 0.15, `control: dabs apart read as beads (variation ${control.toFixed(3)})`);
});

test("the underpainting is dry: a brush picks up only this layer's wet paint, unless it is told wet-under", () => {
  const end = (wetUnder) => {
    const { doc, paint: L } = smallDoc(200, 40, 0.1); const S = beginStroke(doc, L, { colour: [0.9, 0.8, 0.3], size: 8, pickup: 1, depletion: 0, wetUnder }, { seed: 3 });
    for (const [x, y, p] of line(5, 20, 195, 20, 60)) strokeTo(S, x, y, p); endStroke(S); return L.rgba[(20 * doc.w + 185) * 4];
  };
  const dry = end(false), wet = end(true);
  assert.ok(dry > 0.85, `clean over a dry ground (${dry.toFixed(3)})`);
  assert.ok(wet < dry - 0.1, `control: wet-under, the dark ground dirties it (${wet.toFixed(3)})`);
});

test("the light-stroke brush loads with the canvas colour lifted toward the key; a plain brush keeps its own", () => {
  const run = (extra) => { const { doc, paint: L } = smallDoc(120, 40, 0.4); doc.meta.keyColour = [1.25, 0.9, 0.58]; const S = beginStroke(doc, L, { colour: [0.1, 0.1, 0.9], size: 8, depletion: 0, ...extra }, { seed: 5 }); for (const [x, y, p] of line(10, 20, 60, 20)) strokeTo(S, x, y, p); endStroke(S); return Array.from(L.rgba.subarray((20 * doc.w + 30) * 4, (20 * doc.w + 30) * 4 + 3)); };
  const lit = run({ light: 0.8 }), plain = run({});
  assert.ok(lit[0] > 0.45 && lit[0] > lit[2], `lighter than the grey and warm (${lit.map((v) => v.toFixed(2))})`);
  assert.ok(plain[2] > plain[0], "control: without light the brush lays its own blue");
});
