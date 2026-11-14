// The runtime mixer (game/engine/audio/mixer.mjs) and the ducking rules (duck.mjs): fades on bar lines,
// harmony changes as equal-power crossfades that persist, ducking under lines from the voice tags, the
// read-back's silence, and a lie ducked exactly like the truth. Each check has a control that fails it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createMixer } from "../audio/mixer.mjs";
import { duckFor, duckLine } from "../audio/duck.mjs";
import { render } from "../audio/score.mjs";
import { seam } from "../audio/lib/analysis.mjs";

const onBar = (t, barSec, origin = 0) => Math.abs(((t - origin) / barSec) - Math.round((t - origin) / barSec)) < 1e-9;
const mk = () => createMixer({ bpm: 92, meter: 4, origin: 0.25 });

test("a level change starts on the next bar line and lasts whole bars; a scheduler that starts now fails the check", () => {
  const M = mk().layer("drums", { db: null });
  for (const now of [0, 1.1, 3.3, 7.77, 12.0001]) {
    const [r] = M.set("drums", 0, now, 2);
    assert.ok(r.t0 >= now && onBar(r.t0, M.barSec, 0.25), `t0 ${r.t0} after ${now}`);
    assert.ok(onBar(r.t1, M.barSec, 0.25) && Math.abs(r.t1 - r.t0 - 2 * M.barSec) < 1e-9);
  }
  const naive = (now) => now;                                                     // the control
  assert.equal(onBar(naive(3.3), M.barSec, 0.25), false);
  const M2 = mk().layer("bass", { db: null }), [r2] = M2.set("bass", 0, 3.3, 1);
  assert.equal(M2.gainAt("bass", r2.t0 - 0.01), 0, "nothing before the bar line");
  assert.ok(Math.abs(M2.gainAt("bass", r2.t1) - 1) < 1e-9);
});

test("a harmony change crossfades a stem's variants at equal power on a bar line and stays changed", () => {
  const M = mk().layer("drone", { db: null }).variants("drone", { true: "drone", inflated: "drone@inflated" });
  M.set("drone", -6, 0, 0.0001);
  const ramps = M.harmony("inflated", 10, 2), t0 = ramps[0].t0, t1 = ramps[0].t1;
  assert.ok(onBar(t0, M.barSec, 0.25));
  const lvl = Math.pow(10, -6 / 20), mid = (t0 + t1) / 2;
  const p = M.gainAt("drone", mid) ** 2 + M.gainAt("drone@inflated", mid) ** 2;
  assert.ok(Math.abs(p - lvl * lvl) < 1e-6, `power at the midpoint ${p} against ${lvl * lvl}`);
  const linMid = (lvl * 0.5) ** 2 * 2;                                            // the control: a linear crossfade dips
  assert.ok(Math.abs(linMid - lvl * lvl) > 0.1 * lvl * lvl);
  assert.equal(M.gainAt("drone", t1 + 100), 0);
  assert.ok(Math.abs(M.gainAt("drone@inflated", t1 + 100) - lvl) < 1e-9);
  assert.deepEqual(M.harmony("inflated", 50), [], "asking again changes nothing");
  M.set("drone", 0, 60, 1);                                                       // a later level change follows the new harmony
  assert.equal(M.gainAt("drone", 200), 0);
  assert.ok(Math.abs(M.gainAt("drone@inflated", 200) - 1) < 1e-9);
});

test("ducking follows the line, not the bar: down before it, held through it, released after; no duck fails", () => {
  const M = mk().layer("drone", { db: 0 }).layer("wind", { db: 0, group: "amb" });
  duckLine(M, { speaker: "NED", kind: "line", dir: { emo: "tired", int: 1 } }, 5, 8);
  const music = M.gainAt("drone", 6.5), amb = M.gainAt("wind", 6.5);
  assert.ok(Math.abs(20 * Math.log10(music) + 9) < 0.01, `music ${20 * Math.log10(music)} dB`);
  assert.ok(Math.abs(20 * Math.log10(amb) + 4) < 0.01);
  assert.equal(M.gainAt("drone", 4.7), 1);
  assert.equal(M.gainAt("drone", 9), 1);
  assert.ok(M.gainAt("drone", 8.4) < 1 && M.gainAt("drone", 8.4) > music);
  const ctl = mk().layer("drone", { db: 0 });                                     // the control: no duck at all
  assert.equal(ctl.gainAt("drone", 6.5) < 0.5, false);
});

test("lines close together share one duck, so the music does not pump in the gap", () => {
  const M = mk().layer("drone", { db: 0 });
  duckLine(M, { speaker: "MARY", kind: "line" }, 2, 4);
  duckLine(M, { speaker: "NED", kind: "line" }, 4.5, 6);
  assert.ok(M.gainAt("drone", 4.3) < 0.36, "held in the 0.5 s gap");
});

test("the read-back silences music and room; a lie is ducked exactly like the truth", () => {
  const k = duckFor({ speaker: "READBACK", kind: "line", dir: { emo: "flat" } });
  assert.equal(k.music, -Infinity); assert.equal(k.amb, -Infinity);
  const M = mk().layer("drone", { db: 0 }).layer("room", { db: 0, group: "amb" });
  duckLine(M, { speaker: "READBACK", kind: "line" }, 10, 20);
  assert.equal(M.gainAt("drone", 15), 0); assert.equal(M.gainAt("room", 15), 0);
  const truth = duckFor({ speaker: "WILL", kind: "line", dir: { emo: "warm", int: 2 } });
  const lie = duckFor({ speaker: "WILL", kind: "line", dir: { emo: "warm", int: 2, lie: true } });
  assert.deepEqual(lie, truth);
  const whisper = duckFor({ speaker: "DAVEY", kind: "line", dir: { vol: "whisper" } });
  assert.notDeepEqual(whisper, truth, "control: a tag the duck does read changes it");
});

test("the mixer can only move gains: an unknown layer is silent, and nothing it schedules adds a sound", () => {
  const M = mk().layer("drone", { db: 0 });
  assert.equal(M.gainAt("sting", 3), 0);
  M.set("drone", null, 0, 1);
  for (const s of M.ramps("drone")) assert.ok(s.g1 <= 1 && s.g0 <= 1);
});

test("a looped piece folds its tail onto its head: no jump at the seam, against an unfolded render", () => {
  const piece = {
    id: "t", bpm: 120, meter: 4, bars: 2, loop: true, stems: { s: { room: "kitchen", send: 0.4 } },
    compose: () => [{ stem: "s", at: 0, dur: 4, inst: "harp", p: 62, v: 0.6 }, { stem: "s", at: 6, dur: 4, inst: "harp", p: 69, v: 0.6 }],
  };
  const folded = seam(render(piece, { tail: 3 }).stems.s);
  const open = render({ ...piece, loop: false }, { tail: 3 }), n = open.n;
  const cut = seam(open.stems.s.map((c) => c.slice(0, n)));
  assert.ok(folded.jumpRatio < cut.jumpRatio, `folded ${folded.jumpRatio} against cut ${cut.jumpRatio}`);
  assert.ok(folded.jumpRatio < 4, `folded jump ${folded.jumpRatio}`);
});

test("a render seals a valid superstack receipt; a receipt with its content changed after sealing does not verify", async () => {
  const { sealRender } = await import("../audio/receipt.mjs");
  const ss = await import("../audio/vendor/superstack.mjs");
  const pair = [Float32Array.from({ length: 44100 }, (_, i) => 0.1 * Math.sin(i / 20)), new Float32Array(44100)];
  const s = sealRender({ id: "t", title: "t", pair, seed: 1, target: -18, game: 0 });
  assert.deepEqual(s.errors, []);
  assert.ok(Math.abs(s.lufs - s.receipt.outputs.integrated_lufs) < 1e-5);
  const forged = { ...s.receipt, content_sha256: "0".repeat(64) };
  assert.notDeepEqual(ss.verifyReceipt(forged), [], "control: a changed field breaks the seal");
});

test("the game's copy of the instrument library matches the pinned studio-libs commit", async () => {
  const { spawnSync } = await import("node:child_process");
  const { join } = await import("node:path");
  const r = spawnSync(process.execPath, [join(import.meta.dirname, "..", "tools", "audio-vendor.mjs"), "--check"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
