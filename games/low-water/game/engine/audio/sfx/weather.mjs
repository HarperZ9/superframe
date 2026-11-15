// Weather: wind as pink noise through a moving resonance with gusts and a corner whistle; frost as
// sparse crackle (ice in the ruts, a frozen gutter); a footstep in packed snow (a dense run of small
// grains breaking). Mono; the place module puts them at a distance.
import { SR, TAU, rng, biquad, noise, fadeEdges } from "../lib/dsp.mjs";

function gusts(r, n, rate = 0.12) {
  const ph = [r() * TAU, r() * TAU, r() * TAU];
  return (i) => {
    const t = i / SR;
    const g = 0.55 + 0.25 * Math.sin(TAU * rate * t + ph[0]) + 0.15 * Math.sin(TAU * rate * 2.3 * t + ph[1]) + 0.08 * Math.sin(TAU * rate * 5.1 * t + ph[2]);
    return Math.max(0.05, g);
  };
}

export function wind(dur, v = 0.5, seed = 1, o = {}) {
  const r = rng(seed), n = Math.round(dur * SR), src = noise(n, r, "pink"), out = new Float32Array(n);
  const g = gusts(r, n, o.rate || 0.11), bp = biquad("bp", 400, 0.8), lp = biquad("lp", 900, 0.6);
  const whistle = biquad("bp", o.whistle || 1450, 18), hp = biquad("hp", 40, 0.7);
  for (let i = 0; i < n; i++) {
    const k = g(i);
    if ((i & 63) === 0) { bp.set(250 + 900 * k, 0.9); lp.set(500 + 2200 * k); whistle.set((o.whistle || 1450) * (0.92 + 0.16 * k), 18); }
    const body = lp(src[i]) * 0.7 + bp(src[i]) * 0.5;
    const w = whistle(src[i]) * Math.max(0, k - 0.62) * 3 * (o.corner ?? 1);
    out[i] = hp(body * k + w) * v * 0.9;
  }
  return fadeEdges(out, 0.4, 0.6);
}

export function frost(dur, v = 0.4, seed = 1, o = {}) {
  const r = rng(seed), n = Math.round(dur * SR), out = new Float32Array(n), rate = o.rate || 3;
  const hp = biquad("hp", 1800, 0.7);
  for (let i = 0; i < n; i++) {
    if (r() < rate / SR) {
      const len = Math.round((0.0008 + r() * 0.004) * SR), a = (0.3 + r() * 0.7) * v;
      for (let k = 0; k < len && i + k < n; k++) out[i + k] += r.bi() * a * Math.exp(-k / (len * 0.25));
    }
  }
  return hp.run(out);
}

// one step: heel then toe, each a crunch of grains; o.depth (0..1) lowers it as snow gets deeper
export function snowstep(dur = 0.4, v = 0.5, seed = 1, o = {}) {
  const r = rng(seed), n = Math.round(Math.max(0.3, dur) * SR), out = new Float32Array(n);
  const lp = biquad("lp", 3200 - 1600 * (o.depth || 0.3), 0.7), hp = biquad("hp", 220, 0.7);
  for (const [at, len, a] of [[0, 0.09, 1], [0.11, 0.12, 0.7]]) {
    const s = Math.round(at * SR), L = Math.round(len * SR);
    for (let k = 0; k < L && s + k < n; k++) {
      const env = Math.sin(Math.PI * k / L);
      if (r() < 0.35) out[s + k] += r.bi() * env * a;
    }
  }
  for (let i = 0; i < n; i++) out[i] = lp(hp(out[i])) * v * 0.8;
  return fadeEdges(out, 0.001, 0.02);
}
