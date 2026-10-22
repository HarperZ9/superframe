// The instruments (render-sound/instruments): pitch, headroom, determinism, and the measuring
// tools they are checked with. Every check has a control that must fail it, so a check that passes
// everything is caught.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { pluck } from "../instruments/inst/pluck.mjs";
import { vessel } from "../instruments/inst/modal.mjs";
import { piano } from "../instruments/inst/piano.mjs";
import { wind, WIND } from "../instruments/inst/wind.mjs";
import { organ } from "../instruments/inst/organ.mjs";
import { kick, ride, tap } from "../instruments/inst/drums.mjs";
import { drone } from "../instruments/inst/pad.mjs";
import { pitchOf, centsOff, loudness, clipped } from "../instruments/analysis.mjs";
import { spectrum } from "../instruments/fft.mjs";
import { SR, mtof, peak, rng } from "../instruments/dsp.mjs";

const at = (s) => Math.round(s * SR);
const hash = (buf) => createHash("sha256").update(Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength)).digest("hex");
// the first partial by the spectrum's peak near f, interpolated
function firstPartial(buf, f) {
  const N = 65536, mag = spectrum(buf, at(0.1), N), k0 = Math.round(f * N / SR);
  let bk = k0; for (let k = k0 - 30; k <= k0 + 30; k++) if (mag[k] > mag[bk]) bk = k;
  const a = mag[bk - 1], b = mag[bk], c = mag[bk + 1];
  return (bk + 0.5 * (a - c) / (a - 2 * b + c)) * SR / N;
}
// Karplus-Strong as first published: an integer delay and a two-point average, no tuning allpass
function naiveKS(f0, dur) {
  const N = Math.round(SR / f0), line = new Float32Array(N), r = rng(3), out = new Float32Array(at(dur));
  for (let i = 0; i < N; i++) line[i] = r.bi();
  let idx = 0, prev = 0;
  for (let i = 0; i < out.length; i++) { const x = line[idx]; line[idx] = 0.996 * 0.5 * (x + prev); prev = x; out[i] = x; idx = (idx + 1) % N; }
  return out;
}

test("plucked strings land within 3 cents from A1 to E6; an untuned Karplus-Strong does not", () => {
  for (const [preset, m] of [["bass", 33], ["bass", 43], ["guitar", 52], ["guitar", 76], ["harp", 60], ["harp", 88]]) {
    const est = pitchOf(pluck(mtof(m), 1, 0.8, preset, 3), at(0.1), 8192, 25, 4000);
    assert.ok(Math.abs(centsOff(est, mtof(m))) < 3, `${preset} ${m}: ${centsOff(est, mtof(m)).toFixed(2)} cents`);
  }
  const ctl = centsOff(pitchOf(naiveKS(mtof(91), 1), at(0.1), 8192, 25, 4000), mtof(91));
  assert.ok(Math.abs(ctl) > 5, `control should be out of tune, was ${ctl.toFixed(2)} cents`);
});

test("the piano's first partial sits on the note: within 1.5 cents on one string, 3 cents with its unison strings", () => {
  for (const m of [33, 48, 60, 72, 84]) {
    const c = centsOff(firstPartial(piano(m, 2, 0.8, 2, { unison: 1 }), mtof(m)), mtof(m));
    assert.ok(Math.abs(c) < 1.5, `piano ${m}, one string: ${c.toFixed(2)} cents`);
    // with its unison strings the peak moves as they beat; averaged over seeds it stays on the note
    const mean = [1, 2, 3, 4, 5, 6].reduce((s, k) => s + centsOff(firstPartial(piano(m, 2, 0.8, k), mtof(m)), mtof(m)), 0) / 6;
    assert.ok(Math.abs(mean) < 3, `piano ${m}, unison: ${mean.toFixed(2)} cents on average`);
  }
  const ctl = centsOff(firstPartial(piano(60, 2, 0.8, 2), mtof(60)), mtof(60) * Math.pow(2, 30 / 1200));
  assert.ok(Math.abs(ctl) > 20, "control: the same note checked against a target 30 cents away must fail");
});

test("winds are tuned by their probe within 5 cents from C4 up; the same waveguide unprobed is not", () => {
  for (const [preset, m] of [["flute", 62], ["flute", 69], ["breathy", 64], ["reed", 55], ["reed", 69], ["reed", 79]]) {
    const c = centsOff(pitchOf(wind(mtof(m), 1.2, 0.7, preset, 5), at(0.5), 8192, 60, 3000), mtof(m));
    assert.ok(Math.abs(c) < 5, `${preset} ${m}: ${c.toFixed(2)} cents`);
  }
  const raw = WIND.flute.run(mtof(69), 1.2, 0.7, WIND.flute, rng(5), 1);
  const ctl = centsOff(pitchOf(raw, at(0.5), 8192, 60, 3000), mtof(69));
  assert.ok(Math.abs(ctl) > 5, `control should be out of tune, was ${ctl.toFixed(2)} cents`);
});

test("the organ's 8-foot drawbar alone is the note; no instrument clips at full velocity; the clip check catches gain", () => {
  const o = organ(69, 1, 1, 1, { drawbars: "008000000", click: 0 });
  assert.ok(Math.abs(centsOff(pitchOf(o, at(0.3), 4096, 60, 3000), 440)) < 1);
  const loud = [pluck(mtof(40), 1, 1, "bass", 1), pluck(mtof(76), 1, 1, "guitar", 1), piano(36, 1, 1, 1), piano(96, 1, 1, 1), vessel("churchbell", 220, 1, 1),
    wind(mtof(72), 1, 1, "reed", 1), organ(48, 1, 1, 1, { reg: "full", perc: 3 }), kick(1, 1), tap(1, 1), ride(1, 1, { bell: true }), drone(mtof(38), 3, 1, 1, { sub: 1 })];
  for (const [i, b] of loud.entries()) assert.ok(peak(b) < 0.9, `instrument ${i} peaks at ${peak(b).toFixed(3)}`);
  for (const b of loud) assert.equal(clipped([b]), 0);
  const ctl = Float32Array.from(loud[0], (x) => x * 4);
  assert.ok(clipped([ctl]) > 0, "control: four times the bass must register as clipped");
});

test("a render is a pure function of its seed; the check tells two seeds apart", () => {
  const a = pluck(mtof(57), 0.5, 0.7, "harp", 11), b = pluck(mtof(57), 0.5, 0.7, "harp", 11), c = pluck(mtof(57), 0.5, 0.7, "harp", 12);
  assert.equal(hash(a), hash(b));
  assert.notEqual(hash(a), hash(c), "control: a different seed must change the samples");
  const d1 = drone(110, 1, 0.5, 4), d2 = drone(110, 1, 0.5, 4);
  assert.equal(hash(d1), hash(d2));
});

test("loudness reads a -20 dBFS stereo 997 Hz tone as -20 LUFS; the same tone in one channel reads 3 dB lower", () => {
  const n = at(5), s = Float32Array.from({ length: n }, (_, i) => 0.1 * Math.sin(2 * Math.PI * 997 * i / SR));
  const both = loudness([s, s]).integrated, one = loudness([s, new Float32Array(n)]).integrated;
  assert.ok(Math.abs(both + 20) < 0.3, `stereo: ${both.toFixed(2)}`);
  assert.ok(Math.abs(one + 23.01) < 0.3, `control, one channel: ${one.toFixed(2)}`);
});
