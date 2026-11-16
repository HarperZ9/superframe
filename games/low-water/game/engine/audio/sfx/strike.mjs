// Contact in a fight: a blow landing on a body, a blow stopped on a guard, a parry, a guard broken, a near miss,
// a body going down. Same signature as every sound here: (dur, v, seed, opt) -> mono samples at SR.
// Every sound starts at sample 0 with its loudest part inside the first 8 ms: the contact is the attack, so the
// ear hears the hit on the frame the sim lands it (combat/sim/hits.mjs emits on the contact tick).
//   blow(dur, v, seed, { weight 0..1, edge, armor })   flesh and bone: a skin slap, a body thump, a crack when heavy
//   guard(dur, v, seed, { mat: "wood" | "iron" })       a blow taken on a guard: a hard knock and the guard's ring
//   ring(dur, v, seed)                                   a parry: iron on iron, bright and short
//   breakguard(dur, v, seed)                             a guard broken: the knock, then the guard torn aside
//   whoosh(dur, v, seed, { speed 0..1 })                 a miss past the head: air, rising then gone
//   fall(dur, v, seed)                                   a body put down on stone
import { SR, rng, biquad, noise, fadeEdges, addAt } from "../lib/dsp.mjs";
import { vessel } from "../lib/inst/modal.mjs";

const N = (s) => Math.max(1, Math.round(s * SR));
const clamp01 = (x) => Math.max(0, Math.min(1, x));
// a body taking weight: a sine that drops in pitch and dies away; its first crest is about 2 ms in, so the
// thump is loudest at the contact (a leaky-integrated brown noise swells for tens of ms and lands late)
function thump(n, f0, f1, tau, gain) {
  const b = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR, f = f1 + (f0 - f1) * Math.exp(-t / 0.03); ph += (2 * Math.PI * f) / SR; b[i] = Math.sin(ph) * gain * Math.exp(-t / tau); }
  return b;
}
// scale so the peak is v (never above 1): a sound's level is its v, whatever was mixed into it
function level(out, v) { let p = 0; for (const x of out) p = Math.max(p, Math.abs(x)); const k = p > 0 ? Math.min(1, v) / p : 0; for (let i = 0; i < out.length; i++) out[i] *= k; return out; }
function burst(n, r, type, f, q, gain, tau) {
  const b = noise(n, r, "white"), fl = biquad(type, f, q);
  for (let i = 0; i < n; i++) b[i] = fl(b[i]) * gain * Math.exp(-i / N(tau));
  return b;
}

export function blow(dur = 0.35, v = 0.8, seed = 1, o = {}) {
  const r = rng(seed), w = clamp01(o.weight ?? 0.5), out = new Float32Array(N(dur));
  // the slap: skin or cloth struck, a few milliseconds of bright noise
  addAt(out, burst(N(0.012), r, "hp", o.edge ? 2600 : 1400, 0.8, o.armor ? 0.25 : 0.55, 0.0025), 0);
  // the thump: the body taking it, lower and longer as the blow gets heavier
  addAt(out, thump(N(0.25 + 0.1 * w), (o.armor ? 120 : 160) - 30 * w, 48, 0.03 + 0.05 * w, 0.55 + 0.45 * w), 0);
  // the crack: bone or a joint going, only in the heavy ones
  if (w > 0.55 && !o.armor) addAt(out, burst(N(0.05), r, "bp", 1100 + 500 * r(), 3, 0.5 * (w - 0.45), 0.012), N(0.004));
  // an edge leaves a short tearing hiss after the contact
  if (o.edge) addAt(out, burst(N(0.12), r, "bp", 3800, 1.2, 0.18, 0.04), N(0.006));
  // loudness by weight: a light blow sits under a heavy one at the same v
  return fadeEdges(level(out, v * (0.6 + 0.4 * w)), 0.0004, 0.05);
}

export function guard(dur = 0.4, v = 0.7, seed = 1, o = {}) {
  const r = rng(seed), out = new Float32Array(N(dur)), iron = o.mat === "iron";
  addAt(out, burst(N(0.01), r, "bp", iron ? 3000 : 1300, 0.9, 0.7, 0.002), 0);
  addAt(out, vessel(iron ? "iron" : "woodbowl", iron ? 900 + 200 * r() : 380 + 80 * r(), 0.8, seed, { span: iron ? 0.25 : 1 }), 0, iron ? 0.25 : 0.45);
  addAt(out, thump(N(0.12), 220, 90, 0.018, 0.9), 0);
  return fadeEdges(level(out, v), 0.0004, 0.06);
}

export function ring(dur = 0.7, v = 0.7, seed = 1) {
  const r = rng(seed), out = new Float32Array(N(dur));
  addAt(out, burst(N(0.006), r, "hp", 4200, 0.9, 1.2, 0.0015), 0);
  addAt(out, vessel("iron", 1700 + 300 * r(), 0.9, seed, { span: 0.35 }), 0, 0.5);
  return fadeEdges(level(out, v), 0.0003, 0.15);
}

export function breakguard(dur = 0.6, v = 0.8, seed = 1) {
  const r = rng(seed), out = guard(dur, 1, seed, { mat: "wood" });
  // the guard torn aside: a scrape and a stumble after the knock, both under it
  addAt(out, burst(N(0.22), r, "bp", 700, 0.8, 0.3, 0.08), N(0.03));
  addAt(out, thump(N(0.12), 130, 60, 0.03, 0.45), N(0.18));
  return level(out, v);
}

export function whoosh(dur = 0.28, v = 0.5, seed = 1, o = {}) {
  const r = rng(seed), n = N(dur), out = noise(n, r, "pink"), s = clamp01(o.speed ?? 0.6), bp = biquad("bp", 600, 1.2);
  for (let i = 0; i < n; i++) {
    const u = i / n, g = Math.sin(Math.PI * Math.min(1, u * 1.15)) ** 2;
    bp.set(500 + (900 + 1400 * s) * Math.sin(Math.PI * u), 1.2 + s);
    out[i] = bp(out[i]) * g * (1.6 + s);
  }
  return fadeEdges(level(out, v), 0.003, 0.03);
}

export function fall(dur = 0.9, v = 0.8, seed = 1) {
  const r = rng(seed), out = new Float32Array(N(dur));
  // the shoulder, then the head and the rest a moment after, then cloth settling
  addAt(out, burst(N(0.01), r, "hp", 900, 0.8, 0.5, 0.003), 0);
  for (const [at, g] of [[0, 1], [0.09, 0.55], [0.2, 0.3]]) addAt(out, thump(N(0.18), 140, 50, 0.05, g), N(at));
  addAt(out, burst(N(0.4), r, "bp", 1800, 0.7, 0.08, 0.15), N(0.1));
  return fadeEdges(level(out, v), 0.0004, 0.1);
}
