// The house: the stove (a low roar, crackle, the iron ticking as it heats or cools), the ledger pen
// (a steel nib's stick-slip scratch in strokes, a dip in the inkwell), bowls set down on a deal table,
// a spoon in a bowl, and the yard's brazier.
import { SR, TAU, rng, biquad, noise, fadeEdges, addAt } from "../lib/dsp.mjs";
import { vessel } from "../lib/inst/modal.mjs";

export function stove(dur, v = 0.5, seed = 1, o = {}) {
  const r = rng(seed), n = Math.round(dur * SR), out = noise(n, r, "brown"), lp = biquad("lp", 220, 0.7);
  const fire = o.fire ?? 0.6;                       // a famine stove burns little: low fire, few pops
  for (let i = 0; i < n; i++) out[i] = lp(out[i]) * 0.6 * fire * (0.8 + 0.2 * Math.sin(TAU * 0.21 * i / SR));
  const hp = biquad("hp", 900, 0.7);
  for (let t = 0; t < dur; t += r() * 1.6 / (0.3 + fire)) {
    const len = Math.round((0.002 + r() * 0.01) * SR), at = Math.round(t * SR), a = r() * fire;
    for (let k = 0; k < len && at + k < n; k++) out[at + k] += hp(r.bi()) * a * Math.exp(-k / (len * 0.3));
  }
  for (let t = 1 + r() * 3; t < dur; t += 3 + r() * 7) addAt(out, vessel("iron", 2200 + r() * 1800, 0.25, seed + Math.round(t), { gain: 0.15, span: 0.2 }), Math.round(t * SR));
  for (let i = 0; i < n; i++) out[i] *= v;
  return fadeEdges(out, 0.3, 0.3);
}

// one line of figures: a few strokes, each a run of stick-slip impulses through the paper's resonance
export function pen(dur = 1.6, v = 0.5, seed = 1, o = {}) {
  const r = rng(seed), n = Math.round(Math.max(0.4, dur) * SR), out = new Float32Array(n);
  const paper = biquad("bp", 3800, 1.4), grain = biquad("hp", 1500, 0.7);
  let t = 0.05;
  while (t < dur - 0.15) {
    const len = 0.05 + r() * 0.16, s = Math.round(t * SR), L = Math.round(len * SR), rate = 900 + r() * 1400;
    let ph = 0;
    for (let k = 0; k < L && s + k < n; k++) {
      ph += rate * (1 + 0.3 * r.bi()) / SR; let imp = 0; if (ph >= 1) { ph -= 1; imp = r.bi(); }
      out[s + k] += (paper(imp) * 1.5 + grain(r.bi()) * 0.05) * Math.sin(Math.PI * k / L);
    }
    t += len + 0.03 + r() * (o.slow ? 0.25 : 0.1);
  }
  if (o.dip) addAt(out, vessel("waterglass", 2600, 0.25, seed + 5, { gain: 0.2, span: 0.2 }), 0);
  for (let i = 0; i < n; i++) out[i] *= v;
  return fadeEdges(out, 0.002, 0.02);
}

// a bowl set down: the earthenware rings briefly, damped by the wood; the table thuds under it.
// p (MIDI) picks the bowl's pitch, so five bowls are five slightly different notes.
export function bowlset(dur = 1, v = 0.5, seed = 1, o = {}, p = 74) {
  const r = rng(seed), f = 440 * Math.pow(2, (p - 69) / 12);
  const ring = vessel("bowl", f, v, seed, { gain: 0.3, span: o.full ? 0.35 : 0.8 });  // a full bowl rings less
  const n = ring.length + 2000, out = new Float32Array(n), lp = biquad("lp", 400, 0.7);
  addAt(out, ring, 0, 0.8);
  for (let i = 0; i < 0.06 * SR; i++) out[i] += lp(r.bi()) * v * 0.9 * Math.exp(-i / (0.01 * SR));
  return fadeEdges(out, 0.0005, 0.03);
}
export function spoon(dur = 0.5, v = 0.4, seed = 1) {
  const r = rng(seed), n = Math.round(0.5 * SR), out = new Float32Array(n), bp = biquad("bp", 3000, 2);
  for (let i = 0; i < n; i++) out[i] = bp(r.bi()) * Math.sin(Math.PI * i / n) * 0.3 * v;
  addAt(out, vessel("bowl", 1300, 0.3, seed, { gain: 0.15, span: 0.3 }), Math.round(0.4 * SR));
  return out;
}
export function brazier(dur, v = 0.5, seed = 1) { return stove(dur, v, seed, { fire: 1 }); }
