// People without words: a crowd's murmur (many voices as glottal buzz through moving vowel formants,
// gated in syllables, never intelligible), the queue (feet shifting in snow, a cough now and then, the
// murmur thin and low: a hungry queue does not talk much), coughs, claps and stamps for the yard.
import { SR, TAU, rng, biquad, noise, fadeEdges, addAt } from "../lib/dsp.mjs";
import { snowstep } from "./weather.mjs";

const FORMANTS = [[300, 870], [730, 1090], [530, 1840], [400, 2000], [600, 1000]];

function talker(n, r, pitch, level) {
  const out = new Float32Array(n), f1 = biquad("bp", 500, 3), f2 = biquad("bp", 1500, 5);
  let ph = 0, syl = 0, gate = 0, vow = r.pick(FORMANTS), pause = 0;
  for (let i = 0; i < n; i++) {
    if (syl <= 0) {
      syl = Math.round((0.12 + r() * 0.18) * SR); vow = r.pick(FORMANTS);
      f1.set(vow[0] * (0.9 + r() * 0.2), 3); f2.set(vow[1] * (0.9 + r() * 0.2), 5);
      if (pause <= 0 && r() < 0.12) pause = Math.round((0.4 + r() * 1.6) * SR);
    }
    syl--; if (pause > 0) pause--;
    gate += ((pause > 0 ? 0 : 1) * Math.sin(Math.PI * (1 - syl / (0.3 * SR))) - gate) * 0.004;
    ph += pitch * (1 + 0.05 * Math.sin(TAU * 0.7 * i / SR)) / SR; if (ph >= 1) ph -= 1;
    const src = (ph < 0.5 ? ph * 2 : 2 - ph * 2) - 0.5 + r.bi() * 0.15;
    out[i] = (f1(src) + f2(src) * 0.5) * Math.max(0, gate) * level;
  }
  return out;
}

export function murmur(dur, v = 0.5, seed = 1, o = {}) {
  const r = rng(seed), n = Math.round(dur * SR), out = new Float32Array(n), count = o.count || 12;
  for (let k = 0; k < count; k++) {
    const t = talker(n, r, (r() < 0.5 ? 105 : 190) * (0.85 + r() * 0.3), 0.4 + r() * 0.6);
    for (let i = 0; i < n; i++) out[i] += t[i];
  }
  const lp = biquad("lp", o.muffle || 2400, 0.7), hp = biquad("hp", 120, 0.7), g = v * 0.7 / Math.sqrt(count);
  for (let i = 0; i < n; i++) out[i] = lp(hp(out[i])) * g;
  return fadeEdges(out, 0.5, 0.5);
}

export function cough(dur = 0.6, v = 0.5, seed = 1) {
  const r = rng(seed), n = Math.round(0.6 * SR), out = noise(n, r, "white"), f = biquad("bp", 700 + r() * 500, 1.5), lp = biquad("lp", 2500, 0.7);
  const bursts = 1 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    let e = 0;
    for (let b = 0; b < bursts; b++) { const s = b * 0.16 * SR, k = i - s; if (k >= 0) e += Math.exp(-k / (0.05 * SR)) * (1 - Math.exp(-k / 200)); }
    out[i] = lp(f(out[i])) * e * v;
  }
  return fadeEdges(out, 0.001, 0.05);
}

// the relief queue: shifting feet in snow, coughs, a low thin murmur. o.length (0..1) is the queue's size
export function queue(dur, v = 0.5, seed = 1, o = {}) {
  const r = rng(seed), n = Math.round(dur * SR), size = o.length ?? 0.6, out = new Float32Array(n);
  const steps = Math.round(dur * (1 + 5 * size)), coughs = Math.round(dur / 9 * (0.3 + size) * (1 + (o.sick || 0.3)));
  for (let k = 0; k < steps; k++) addAt(out, snowstep(0.4, 0.25 + r() * 0.3, seed * 7 + k), Math.floor(r() * n), 0.6);
  for (let k = 0; k < coughs; k++) addAt(out, cough(0.6, 0.3 + r() * 0.4, seed * 11 + k), Math.floor(r() * n), 0.5);
  const m = murmur(dur, 0.25 * size, seed + 3, { count: Math.max(3, Math.round(10 * size)), muffle: 1600 });
  for (let i = 0; i < n; i++) out[i] = (out[i] + m[i]) * v;
  return out;
}

export function claps(dur, v = 0.5, seed = 1, o = {}) {
  const r = rng(seed), n = Math.round(dur * SR), out = new Float32Array(n), hands = o.hands || 8;
  const beat = 60 / (o.bpm || 100), pattern = o.pattern || [1, 0, 1, 0];
  for (let b = 0, t = 0; t < dur; b++, t += beat / 2) {
    if (!pattern[b % pattern.length]) continue;
    for (let h = 0; h < hands; h++) {
      const at = Math.round((t + r.gauss() * 0.012) * SR), len = 0.03 * SR, bp = biquad("bp", 900 + r() * 1400, 1.3), a = 0.3 + r() * 0.5;
      for (let k = 0; k < len && at + k < n; k++) if (at + k >= 0) out[at + k] += bp(r.bi()) * a * Math.exp(-k / (0.006 * SR));
    }
  }
  for (let i = 0; i < n; i++) out[i] *= v * 0.5 / Math.sqrt(hands);
  return out;
}

export function stamp(dur = 0.3, v = 0.6, seed = 1) {
  const r = rng(seed), n = Math.round(0.3 * SR), out = new Float32Array(n), lp = biquad("lp", 260, 0.9);
  for (let i = 0; i < n; i++) out[i] = lp(r.bi() + Math.sin(TAU * 70 * i / SR)) * Math.exp(-i / (0.03 * SR)) * v;
  return fadeEdges(out, 0.0005, 0.02);
}
