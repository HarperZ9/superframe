// The hardest instruments against measurable targets (instruments/README.md, "Targets"): the piano's
// inharmonicity by register, its two-stage decay and aftersound, hammer noise, sympathetic strings; the
// upright bass's body modes, finger noise and fingerboard buzz; the ride's decay and its delayed high
// swell. Each target has a control the measurement must reject.
import { test } from "node:test";
import assert from "node:assert/strict";
import { piano, pianoB, sympathetic } from "../instruments/inst/piano.mjs";
import { pluck } from "../instruments/inst/pluck.mjs";
import { ride } from "../instruments/inst/drums.mjs";
import { spectrum } from "../instruments/fft.mjs";
import { pitchOf, centsOff } from "../instruments/analysis.mjs";
import { SR, mtof, biquad } from "../instruments/dsp.mjs";

const at = (s) => Math.round(s * SR);
const dB = (x) => 10 * Math.log10(x + 1e-30);
// energy at frequency f over a window (Goertzel)
function goertzel(x, f, s, n) { const w = 2 * Math.PI * f / SR, c = 2 * Math.cos(w); let a = 0, b = 0; for (let i = s; i < s + n && i < x.length; i++) { const y = x[i] + c * a - b; b = a; a = y; } return a * a + b * b - c * a * b; }
function peakNear(mag, N, f, span = 0.03) { let bk = 0, bv = -1; for (let k = Math.floor(f * (1 - span) * N / SR); k <= Math.ceil(f * (1 + span) * N / SR); k++) if (mag[k] > bv) { bv = mag[k]; bk = k; } const a = mag[bk - 1], b = mag[bk], c = mag[bk + 1]; return (bk + 0.5 * (a - c) / (a - 2 * b + c)) * SR / N; }
function fitB(buf, f0) {
  const N = 131072, mag = spectrum(buf, at(0.05), N), f1 = peakNear(mag, N, f0);
  // each partial is searched where the fit so far puts it, so a stretched series is followed as it climbs
  let num = 0, den = 0, B = 0;
  for (let k = 2; k <= 9; k++) {
    const fk = peakNear(mag, N, k * f1 * Math.sqrt(1 + B * (k * k - 1)), 0.02), y = (fk / (k * f1)) ** 2 - 1, x = k * k - 1;
    num += x * y; den += x * x; B = Math.max(0, num / den);
  }
  return B;
}
const slope = (x, f, t0, t1) => (dB(goertzel(x, f, at(t1), at(0.2))) - dB(goertzel(x, f, at(t0), at(0.2)))) / (t1 - t0);

test("piano inharmonicity follows the register table within 30%, at C2, C4 and C6", () => {
  for (const m of [36, 60, 84]) {
    const est = fitB(piano(m, 3, 0.7, 4, { unison: 1, pedal: true }), mtof(m)), want = pianoB(m);
    assert.ok(Math.abs(est / want - 1) < 0.3, `m ${m}: B ${est.toExponential(2)} against ${want.toExponential(2)}`);
  }
  const harmonic = new Float32Array(at(3)); for (let k = 1; k <= 9; k++) for (let i = 0; i < harmonic.length; i++) harmonic[i] += Math.sin(2 * Math.PI * k * mtof(84) * i / SR) / k;
  assert.ok(fitB(harmonic, mtof(84)) < pianoB(84) * 0.3, "control: a harmonic tone must read as no inharmonicity");
});

test("middle C decays in two stages, the aftersound near 16 s; a single exponential fails the two-stage check", () => {
  const x = piano(60, 9, 0.7, 4, { pedal: true }), f = mtof(60);
  const early = slope(x, f, 0.1, 0.7), late = slope(x, f, 4, 7);
  assert.ok(early < 2 * late, `early ${early.toFixed(1)} dB/s against late ${late.toFixed(1)} dB/s`);
  const t60 = -60 / late;
  assert.ok(t60 > 12 && t60 < 20, `aftersound t60 ${t60.toFixed(1)} s`);
  const one = Float32Array.from({ length: at(8) }, (_, i) => Math.sin(2 * Math.PI * f * i / SR) * Math.exp(-6.9 * i / (6 * SR)));
  assert.ok(!(slope(one, f, 0.1, 0.7) < 2 * slope(one, f, 4, 7)), "control: one decay has one slope");
});

test("hammer noise lifts the attack's highs by 3 dB or more and is gone 100 ms later", () => {
  const hiE = (x, t) => { const y = biquad("hp", 4000, 0.7).run(Float32Array.from(x)); let e = 0; for (let i = at(t); i < at(t + 0.01); i++) e += y[i] * y[i]; return dB(e); };
  const withN = piano(55, 1, 0.8, 4), without = piano(55, 1, 0.8, 4, { noise: false });
  assert.ok(hiE(withN, 0) - hiE(without, 0) > 3, `attack: ${(hiE(withN, 0) - hiE(without, 0)).toFixed(1)} dB`);
  assert.ok(Math.abs(hiE(withN, 0.1) - hiE(without, 0.1)) < 1, "control window: 100 ms on, the two are the same");
});

test("sympathetic strings answer the octave of a struck C3, not the semitone beside it; a tone between strings gets no such answer", () => {
  const s = sympathetic(piano(48, 2, 0.8, 4, { pedal: true }));
  const oct = goertzel(s, mtof(60), at(0.5), at(1)), semi = goertzel(s, mtof(61), at(0.5), at(1));
  assert.ok(dB(oct) - dB(semi) > 10, `octave against semitone: ${(dB(oct) - dB(semi)).toFixed(1)} dB`);
  const between = Float32Array.from({ length: at(2) }, (_, i) => Math.sin(2 * Math.PI * mtof(60.5) * i / SR) * 0.2), sb = sympathetic(between);
  assert.ok(Math.abs(dB(goertzel(sb, mtof(60), at(0.5), at(1))) - dB(goertzel(sb, mtof(61), at(0.5), at(1)))) < 10);
});

test("the upright bass: body modes at 58 and 98 Hz, the finger's slip, fingerboard buzz that keeps the pitch", () => {
  const N = 32768, band = (x, f) => { const m = spectrum(x, 0, N); let e = 0; for (let k = Math.round((f - 6) * N / SR); k <= Math.round((f + 6) * N / SR); k++) e += m[k] * m[k]; return dB(e); };
  const w = pluck(mtof(28), 1, 1, "bass", 3), d = pluck(mtof(28), 1, 1, "bass", 3, { wood: false });
  for (const f of [58, 98]) assert.ok(band(w, f) - band(d, f) > 6, `body at ${f} Hz`);
  assert.ok(Math.abs(band(w, 500) - band(d, 500)) < 2, "control: the body leaves 500 Hz alone");
  const hiE = (x) => { const y = biquad("bp", 4000, 1).run(Float32Array.from(x)); let e = 0; for (let i = at(0.005); i < at(0.012); i++) e += y[i] * y[i]; return dB(e); };
  // a soft jazz pizzicato: the string is dark, so the finger's slip is what you hear up top
  assert.ok(hiE(pluck(mtof(33), 1, 0.4, "bass", 3)) - hiE(pluck(mtof(33), 1, 0.4, "bass", 3, { finger: 0 })) > 3, "finger slip");
  const hiBand = (x) => { const y = biquad("hp", 1500, 0.7).run(Float32Array.from(x)); let e = 0; for (let i = at(0.02); i < at(0.2); i++) e += y[i] * y[i]; return dB(e); };
  const buzz = pluck(mtof(33), 1, 0.4, "bass", 3), clean = pluck(mtof(33), 1, 0.4, "bass", 3, { buzz: 0 });
  assert.ok(hiBand(buzz) - hiBand(clean) > 3, `rattle lifts the highs ${(hiBand(buzz) - hiBand(clean)).toFixed(1)} dB`);
  assert.ok(Math.abs(centsOff(pitchOf(buzz, at(0.15), 8192, 25, 800), mtof(33))) < 5);
});

test("the ride rings 4 to 7 s and its highs swell for 40 to 200 ms; its lows do not swell", () => {
  const x = ride(0.8, 3), seg = (y, t) => { let e = 0; for (let i = at(t); i < at(t + 0.05); i++) e += y[i] * y[i]; return dB(e); };
  const t60 = -60 / ((seg(x, 4) - seg(x, 1)) / 3);
  assert.ok(t60 > 4 && t60 < 7, `ride t60 ${t60.toFixed(1)} s`);
  const peakT = (y) => { let best = 0, bt = 0; for (let t = 0; t < 0.4; t += 0.01) { const e = seg(y, t); if (e > best || t === 0) { best = e; bt = t; } } return bt; };
  const hi = biquad("hp", 5000, 0.7).run(Float32Array.from(x)), lo = biquad("lp", 1500, 0.7).run(Float32Array.from(x));
  assert.ok(peakT(hi) >= 0.04 && peakT(hi) <= 0.2, `high peak at ${peakT(hi)} s`);
  assert.ok(peakT(lo) < 0.035, `control: low band peaks at ${peakT(lo)} s`);
});
