// The portrait painter's tests, and the in-world painter's map-aware step (R4): node --test game/engine/paint/tests/
import test from "node:test";
import assert from "node:assert/strict";
import { findEyes, openEyes } from "../portrait/eyes.mjs";
import { MOODS, exprFor } from "../portrait/moods.mjs";
import { formAccent } from "../rim.mjs";
import { makePainter } from "../painter.mjs";
import { tables } from "../install.mjs";
import { paletteAt } from "../palette.mjs";
import { figure } from "./fixture.mjs";

const MATS = { coat: { id: 1 }, skin: { id: 4 }, hat: { id: 6 }, cheek: { id: 29 }, jawcool: { id: 39 }, eye: { id: 15 } };
function eyeG(w, h, eyes) {   // a G with eye pixels only: each eye an ellipse of white (28) round a disc of iris (15)
  const G = { w, h, id: new Uint8Array(w * h) };
  for (const [cx, cy, rx, ry] of eyes) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = (x - cx) / rx, v = (y - cy) / ry; if (u * u + v * v > 1) continue;
    G.id[y * w + x] = Math.hypot(x - cx, y - cy) < ry * 0.8 ? 15 : 28;
  }
  return G;
}

test("eyes: two openings found and ordered left to right; a single far eye alone is one", () => {
  const E = findEyes(eyeG(200, 100, [[60, 50, 14, 6], [140, 52, 16, 7]]));
  assert.equal(E.length, 2); assert.ok(E[0].cx < E[1].cx);
  assert.ok(Math.abs(E[0].wd - 29) <= 2 && Math.abs(E[1].wd - 33) <= 2, `widths ${E.map((e) => e.wd)}`);
  assert.equal(findEyes(eyeG(200, 100, [[60, 50, 14, 6]])).length, 1);
});

test("eyes: a hidden eye is opened to an almond; an open one is kept as modelled (the control)", () => {
  // buried: a few pixels of pupil under the brow, 80 px apart
  const hid = findEyes(eyeG(240, 120, [[80, 60, 3, 2], [160, 62, 3, 2]])), opened = openEyes(hid, { turn: -1, lids: 0, w: 240, h: 120 });
  assert.ok(opened.every((e) => e.opened), "both opened");
  assert.ok(opened[1].wd > 25 && opened[1].ht >= opened[1].wd * 0.25, `near eye ${opened[1].wd} x ${opened[1].ht}`);
  assert.ok(opened[0].wd < opened[1].wd, "the far eye (the face turns left) is narrower");
  const heavy = openEyes(hid, { turn: -1, lids: 1, w: 240, h: 120 });
  assert.ok(heavy[1].ht < opened[1].ht, "heavy lids paint a lower opening");
  const open = findEyes(eyeG(240, 120, [[80, 60, 16, 7], [160, 62, 18, 8]])), kept = openEyes(open, { turn: -1, lids: 0, w: 240, h: 120 });
  assert.ok(kept.every((e) => !e.opened), "a modelled open eye is not repainted");
});

test("moods: the voice bible's cue moves the face; the lie holds the mouth; the old head gets its own units", () => {
  // a stand-in for portraitCue with its published shape (direction.mjs): the test checks the mapping, not the cue
  const cue = (d) => ({ preset: d.emo === "afraid" ? "startled" : "neutral", brow: d.emo === "angry" ? -0.6 : 0, browInner: 0, lids: d.emo === "angry" ? 0.3 : 0, corners: d.lie ? 0.1 : d.emo === "warm" ? 0.8 : 0 });
  const EX = { neutral: {}, startled: { browY: 0.16, lidsAdd: -0.6, open: 0.13 } };
  assert.deepEqual(Object.keys(MOODS).sort(), ["afraid", "angry", "anxious", "contempt", "grieving", "lying", "neutral", "warm"]);
  for (const v of Object.values(MOODS)) if (v.emo) assert.equal(v.int, v.lie ? 1 : 3);
  const sc = exprFor(cue, EX, MOODS.warm, true), old = exprFor(cue, EX, MOODS.warm, false);
  assert.equal(sc.corners, 0.8); assert.ok(old.mouthW > 1, "the old head widens the mouth for a smile");
  assert.ok(exprFor(cue, EX, MOODS.angry, false).browY < 0, "anger lowers the old head's brow");
  assert.ok(exprFor(cue, EX, MOODS.lying, true).corners < sc.corners, "the lie holds the corners");
  assert.ok(exprFor(cue, EX, MOODS.afraid, false).lidsAdd < exprFor(cue, EX, MOODS.neutral, false).lidsAdd, "fear opens the eyes");
});

test("R4 form accent: cavity darkens, a lit convex stroke rises, a flat open stroke is unchanged", () => {
  const base = () => [0.5, 0.4, 0.35];
  assert.deepEqual(formAccent(base(), 0, 0, 0.5, 1, null), base());
  const cav = formAccent(base(), 0, 0.8, 0.5, 1, null), lit = formAccent(base(), 0.8, 0, 0.8, 1, null), unlit = formAccent(base(), 0.8, 0, -0.5, 1, null);
  assert.ok(cav[0] < 0.35, `cavity ${cav}`); assert.ok(lit[0] > 0.55, `convex lit ${lit}`); assert.deepEqual(unlit, base());
  assert.ok(formAccent(base(), 0, 0.8, 0.5, 0, null)[0] > cav[0], "cloth takes half");
});

test("R4 in the painter: without G.curv the frame is byte for byte as before; with maps, a cavity darkens its strokes", () => {
  const ctx = { key: "t", ppm: 87, yawDeg: 26, palette: paletteAt("quay", 23), haze: 0 };
  const run = (maps) => { const P = makePainter({ ...tables(MATS) }), F = figure({ w: 120, h: 250, ppm: 87 }); if (maps) Object.assign(F.G, maps(F.G)); P.paint(F.rgba, F.w, F.h, F.G, 1, ctx); return F; };
  const a = run(null), b = run(null);
  assert.deepEqual(Buffer.from(a.rgba), Buffer.from(b.rgba), "deterministic without maps");
  const flat = run((G) => ({ curv: new Uint8Array(G.w * G.h).fill(128), cav: new Uint8Array(G.w * G.h) }));
  assert.deepEqual(Buffer.from(flat.rgba), Buffer.from(a.rgba), "flat, open maps change nothing");
  const deep = run((G) => ({ curv: new Uint8Array(G.w * G.h).fill(128), cav: Uint8Array.from(G.id, (id) => (id === 4 ? 230 : 0)) }));
  let s0 = 0, s1 = 0; for (let i = 0; i < a.w * a.h; i++) if (a.G.id[i] === 4) { s0 += a.rgba[i * 4]; s1 += deep.rgba[i * 4]; }
  assert.ok(s1 < s0 * 0.85, `the enclosed face paints darker: ${s1} against ${s0}`);
});
