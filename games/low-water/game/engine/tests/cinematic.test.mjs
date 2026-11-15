// The opening film as data (design/CINEMATICS.md section 3): its length, its shots in order, the cut spacing of the
// flash rule, every plate and world point real (people stand on painted ground), the reduced-motion version (no
// camera moves, cuts for dissolves, focus and morph), the authored silence at the blow, and the flash measure with
// its controls (a fast flash and a red pulse fail; a slow breath and a single cut pass).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./helpers.mjs";
import { OPENING } from "../cine/opening.mjs";
import { compile, shotAt, keyAt, viewOf, cutRule, cutsOf, morphAt, personAt, peopleAt, onGround } from "../cine/timeline.mjs";
import { judgeFlash, windowsOf } from "../cine/flash.mjs";
import { gradePixel } from "../cine/grade.mjs";
import opening from "../audio/pieces/opening.mjs";
import { projectPlate } from "../world/camera.mjs";

const C = compile(OPENING), CONTENT = join(ROOT, "..", "..", "content");
const plateOf = (name) => {
  const dir = join(CONTENT, name); if (!existsSync(join(dir, "place.json")) || !existsSync(join(dir, "geo-pos.f32"))) return null;   // the bake stays out of the repository
  const b = readFileSync(join(dir, "geo-pos.f32"));
  return { dir, pj: JSON.parse(readFileSync(join(dir, "place.json"), "utf8")), pos: new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4) };
};

test("the opening runs 60 to 120 s, its shots in order with no gap, and the cue is as long as the film", () => {
  assert.ok(C.total >= 60 && C.total <= 120, `${C.total} s`);
  C.shots.forEach((s, i) => { assert.ok(s.dur > 0, s.id); if (i) assert.equal(s.t0, C.shots[i - 1].t1, `${s.id} does not follow on`); });
  assert.equal(new Set(C.shots.map((s) => s.id)).size, C.shots.length, "shot ids repeat");
  assert.equal(opening.bars * opening.meter * 60 / opening.bpm, C.total, "the cue and the film disagree on length");
  assert.equal(shotAt(C, 0).shot.id, "black"); assert.equal(shotAt(C, C.total - 0.01).shot.id, "title");
  assert.ok(C.shots.at(-1).text.some((x) => x.kind === "title" && x.text === "THE PRAYER FOR THE WATER"));
});

test("cuts are at least 0.4 s apart, with and without reduced motion; a planted run of fast cuts fails", () => {
  assert.deepEqual(cutRule(C), []); assert.deepEqual(cutRule(C, 0.4, true), []);
  const fast = compile({ shots: [{ id: "a", dur: 1 }, { id: "b", dur: 0.2 }, { id: "c", dur: 0.2 }, { id: "d", dur: 1 }] });
  assert.ok(cutRule(fast).length >= 1);
  assert.equal(cutsOf(C, true).length, C.shots.length - 1, "under reduced motion every dissolve is a cut");
});

test("every shot's plate and variant are on disk, and the camera and focus stay on the plate", (t) => {
  for (const s of C.shots.filter((x) => x.plate)) {
    const P = plateOf(s.plate); if (!P) { t.skip(`plate ${s.plate} not baked here`); return; }
    assert.ok(existsSync(join(P.dir, `${s.variant}.png`)), `${s.plate}/${s.variant}.png missing`);
    assert.ok(P.pj.variants.includes(s.variant), `${s.plate} has no variant ${s.variant}`);
    for (const k of s.cam) { const v = viewOf(P.pj, k); assert.ok(v.left >= 0 && v.top >= 0 && v.left + v.w <= P.pj.width + 1e-6 && v.top + v.h <= P.pj.height + 1e-6, `${s.id}: the view leaves the plate`); }
    for (const f of s.focus || []) { const [x, y] = projectPlate(P.pj.camera, P.pj.width, P.pj.height, f.at); assert.ok(x >= 0 && y >= 0 && x < P.pj.width && y < P.pj.height, `${s.id}: focus off the plate`); }
  }
});

test("every person stands and walks on painted ground: no figure inside a wall or on a roof", (t) => {
  for (const s of C.shots.filter((x) => x.people)) {
    const P = plateOf(s.plate); if (!P) { t.skip(`plate ${s.plate} not baked here`); return; }
    for (const p of s.people) for (let k = 0; k <= 20; k++) {
      const q = personAt(p, (s.dur * k) / 20);
      assert.ok(onGround(P.pj, P.pos, q.at), `${s.id}: ${p.who} off the ground at ${q.at.map((v) => v.toFixed(1))}`);
    }
  }
  // the control: a point inside the front terrace is not ground
  const P = plateOf("q_square_wide"); if (P) assert.equal(onGround(P.pj, P.pos, [0, 0, 8]), false, "the ground test cannot see a building");
});

test("reduced motion: the camera holds still within each shot, the focus and the morph cut", () => {
  for (const s of C.shots.filter((x) => x.cam)) {
    const vals = Array.from({ length: 11 }, (_, k) => JSON.stringify([keyAt(s.cam, (s.dur * k) / 10, "at", true), keyAt(s.cam, (s.dur * k) / 10, "zoom", true)]));
    assert.equal(new Set(vals).size, 1, `${s.id}: the camera moves under reduced motion`);
  }
  const train = C.shots.find((s) => s.morph);
  for (let k = 0; k <= 140; k++) assert.ok([0, 1].includes(morphAt(train, k / 10, true)), "the morph fades under reduced motion");
  const boy = C.shots.find((s) => s.id === "queue"), f = (x) => JSON.stringify(keyAt(boy.focus, x, "at", true, "cut"));
  assert.equal(f(4), f(8.9)); assert.notEqual(f(8.9), f(9.1), "the focus should cut at its key");
});

test("the morph rises, holds and falls back to the base look; the record grade keeps value and is the identity at 0", () => {
  const s = C.shots.find((x) => x.morph), w = Array.from({ length: 141 }, (_, k) => morphAt(s, k / 10));
  assert.equal(w[0], 0); assert.equal(w[60], 1); assert.equal(w[140], 0);
  for (let k = 1; k <= 45; k++) assert.ok(w[k] >= w[k - 1]);
  for (let k = 91; k <= 105; k++) assert.ok(w[k] <= w[k - 1]);
  assert.deepEqual(gradePixel(120, 80, 40, 0, 3, 5).map(Math.round), [120, 80, 40]);
  const dark = gradePixel(10, 10, 10, 1, 0, 0), light = gradePixel(250, 250, 250, 1, 0, 0);
  assert.ok(dark[0] < 40 && light[0] > 220, "ink for the shadows, paper for the lights");
});

test("the blow: Gedge strikes the man who knelt at the split sack, the man goes down and stays down, and the frame holds", () => {
  const s = C.shots.find((x) => x.id === "blow"), man = s.people.find((p) => p.who === "dunlin" && p.acts), gedge = s.people.find((p) => p.who === "gedge");
  assert.equal(s.cam.length, 1, "the blow is one held frame");
  assert.ok(gedge.acts.filter((a) => a.anim === "long.heavy").length === 2);
  const down = man.acts.find((a) => a.anim === "knockdown"); assert.ok(down && down.hold);
  assert.ok(down.s > gedge.acts[0].s, "he falls after the first blow");
  assert.equal(personAt(man, s.dur - 0.1).gesture.anim, "knockdown");
  const g = personAt(gedge, gedge.acts[0].s + 0.2), m = personAt(man, gedge.acts[0].s + 0.2);
  assert.ok(Math.hypot(g.at[0] - m.at[0], g.at[2] - m.at[2]) < 1.6, "Gedge strikes from out of reach");
  assert.ok(peopleAt(s, 0).length >= 6, "the queue is in the frame and watches");
});

test("the cue's authored silence at the blow: no music sounds between 50.5 s and 56 s", () => {
  const evs = opening.compose({ harm: "true", seed: 1 }), music = ["drone", "harp", "piano", "hum", "bell", "metal"];
  for (const e of evs.filter((x) => music.includes(x.stem))) assert.ok(e.at + e.dur <= 50.5 || e.at >= 56, `${e.stem} at ${e.at} plays through the blow`);
  assert.ok(evs.some((e) => e.stem === "wind" && e.at <= 50 && e.at + e.dur >= 56), "the wind carries the silence");
  for (const e of evs) { assert.ok(opening.stems[e.stem], `unknown stem ${e.stem}`); assert.ok(e.at >= 0 && e.at < C.total, `${e.stem} at ${e.at}`); }
});

// frames for the flash controls, 30 fps, 160 x 90
const frame = (fill) => { const w = 160, h = 90, d = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = fill(x, y), i = (y * w + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; } return windowsOf(d, w, h, 1); };
const run = (secs, f) => Array.from({ length: secs * 30 }, (_, k) => frame((x, y) => f(k / 30, x, y)));
test("the flash measure: a 5 Hz flash and a red pulse fail; a slow 5% breath and one hard cut pass", () => {
  assert.ok(judgeFlash(run(2, (t) => (Math.floor(t * 10) % 2 ? [255, 255, 255] : [10, 10, 10]))).errs.length, "a 5 Hz full-frame flash passed");
  assert.ok(judgeFlash(run(2, (t, x, y) => (Math.floor(t * 4) % 2 && x < 80 && y < 45 ? [255, 0, 0] : [20, 20, 30]))).errs.some((e) => /red/.test(e)), "a 2 Hz red pulse passed");
  assert.deepEqual(judgeFlash(run(4, (t) => { const v = Math.round(40 + 18 * Math.sin(t * Math.PI)); return [v, v, v]; })).errs, []);
  assert.deepEqual(judgeFlash(run(2, (t) => (t < 1 ? [8, 10, 17] : [200, 195, 180]))).errs, []);
});
