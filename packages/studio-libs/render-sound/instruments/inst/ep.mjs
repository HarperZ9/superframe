// An electric piano of the tine kind, by FM: a body pair (a sine modulated at its own frequency, the
// index falling after the strike, so a hard note barks and then goes round), a tine pair (a high ratio
// modulator that rings for a moment, the metallic attack), and the pickup's asymmetry (a little second
// harmonic, the bell in the tone). Decay is longer low and shorter high; the damper ends the note. The
// tremolo and the auto-pan are stem effects (fx.mjs autopan), as they are on the instrument.
import { SR, TAU, rng, dcblock, fadeEdges } from "../dsp.mjs";

export function ep(m, dur, v = 0.6, seed = 1, o = {}) {
  const r = rng(seed), f = 440 * Math.pow(2, (m - 69) / 12);
  const t60 = Math.max(1.2, 6 * Math.pow(2, -(m - 48) / 18)) * (o.decay ?? 1), rel = o.release ?? 0.18;
  const nd = Math.round(dur * SR), len = nd + Math.round(rel * SR), out = new Float32Array(len);
  const k = Math.exp(-6.9078 / (t60 * SR)), kr = Math.exp(-6.9078 / (rel * SR));
  const bark = (0.4 + 2.6 * v * v) * (o.bark ?? 1), tineLvl = (0.12 + 0.3 * v) * (o.tine ?? 1) * Math.min(1, 600 / f);
  const p0 = r() * TAU, p1 = r() * TAU;
  let a = 1;
  for (let i = 0; i < len; i++) {
    const t = i / SR, att = Math.min(1, i / (0.0015 * SR));
    const I1 = bark * Math.exp(-t / 0.35) + 0.15, I2 = 1.8 * Math.exp(-t / 0.03);
    const body = Math.sin(TAU * f * t + p0 + I1 * Math.sin(TAU * f * t));
    const tine = Math.sin(TAU * f * t + I2 * Math.sin(TAU * 14 * f * t + p1)) * Math.exp(-t / 0.25);
    const x = body * 0.8 + tine * tineLvl;
    out[i] = (x + 0.18 * x * x) * a * att;
    a *= i < nd ? k : kr;
  }
  dcblock(out);
  const g = (o.gain ?? 0.22) * (0.35 + 0.65 * v);
  for (let i = 0; i < len; i++) out[i] *= g;
  return fadeEdges(out, 0.0005, 0.02);
}
