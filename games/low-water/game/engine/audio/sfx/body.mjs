// Things in the hands: a sack set down (the thud and the grain settling), a sack dragged on stone, grain or sand
// pouring, the arm of a balance moving (iron creak, the pan's chain), a thread snapping, a blade through cloth or
// thread, a knock through a wall, a breath held and let go, a heartbeat, a latch, a chair scraped back, water
// dripping. For the sensory cues (world/senses.mjs); same signature as every sound here: (dur, v, seed, opt) ->
// mono samples at SR.
import { SR, TAU, rng, biquad, noise, fadeEdges, addAt } from "../lib/dsp.mjs";
import { vessel } from "../lib/inst/modal.mjs";

const N = (s) => Math.max(1, Math.round(s * SR));
function env(out, a, d) { const n = out.length, A = N(a); for (let i = 0; i < n; i++) out[i] *= i < A ? i / A : Math.exp(-(i - A) / N(d)); return out; }

// a sack set down: a low body thump, then the grain inside settling for a moment
export function thud(dur = 0.9, v = 0.7, seed = 1, o = {}) {
  const r = rng(seed), out = new Float32Array(N(dur)), body = noise(N(0.25), r, "brown"), lp = biquad("lp", o.low || 140, 0.9);
  for (let i = 0; i < body.length; i++) body[i] = lp(body[i]) * 2.2 * Math.exp(-i / N(0.06));
  addAt(out, body, 0);
  const settle = noise(N(0.5), r, "white"), bp = biquad("bp", 2400, 0.8);
  for (let i = 0; i < settle.length; i++) settle[i] = bp(settle[i]) * 0.12 * Math.exp(-i / N(0.15)) * (r() < 0.3 ? 1 : 0.4);
  addAt(out, settle, N(0.04));
  for (let i = 0; i < out.length; i++) out[i] *= v;
  return fadeEdges(out, 0.002, 0.1);
}

// a sack dragged over setts: a rough scrape in pulls, each pull a heave
export function drag(dur = 2.4, v = 0.6, seed = 1) {
  const r = rng(seed), n = N(dur), out = noise(n, r, "pink"), bp = biquad("bp", 900, 0.6), lp = biquad("lp", 3000, 0.7);
  const pulls = Math.max(1, Math.round(dur / 0.8));
  for (let i = 0; i < n; i++) { const u = (i / n) * pulls, ph = u - Math.floor(u), g = Math.sin(Math.PI * Math.min(1, ph * 1.4)) ** 2; out[i] = lp(bp(out[i])) * g * (0.7 + 0.3 * r()); }
  for (let i = 0; i < n; i++) out[i] *= v * 1.4;
  return fadeEdges(out, 0.05, 0.2);
}

// grain or sand pouring: a hiss of many small impacts; o.wet makes it duller (wet sand)
export function pour(dur = 2.5, v = 0.6, seed = 1, o = {}) {
  const r = rng(seed), n = N(dur), out = new Float32Array(n), hp = biquad("hp", o.wet ? 400 : 1200, 0.7), lp = biquad("lp", o.wet ? 2200 : 7000, 0.7);
  for (let i = 0; i < n; i++) { const u = i / n, flow = Math.min(1, u * 6) * Math.min(1, (1 - u) * 3); out[i] = (r() < 0.25 * flow ? r.bi() : r.bi() * 0.15) * flow; out[i] = lp(hp(out[i])); }
  for (let i = 0; i < n; i++) out[i] *= v * 0.9;
  return fadeEdges(out, 0.05, 0.3);
}

// the arm of a balance moving: an iron creak that slides in pitch, the pan's chain chinking as it settles
export function creak(dur = 1.4, v = 0.6, seed = 1, o = {}) {
  const r = rng(seed), n = N(dur), out = new Float32Array(n), bp = biquad("bp", 600, 6);
  let ph = 0;
  for (let i = 0; i < n; i++) { const u = i / n, f = (o.down ? 90 - 40 * u : 60 + 40 * u) * (1 + 0.1 * r.bi()); ph += f / SR; let imp = 0; if (ph >= 1) { ph -= 1; imp = 1; } bp.set(500 + 500 * u, 6); out[i] = bp(imp + r.bi() * 0.02) * Math.sin(Math.PI * Math.min(1, u * 1.2)) * 24; }
  for (let k = 0; k < 3; k++) addAt(out, vessel("iron", 3100 + r() * 1500, 0.2, seed + k, { gain: 0.25, span: 0.15 }), N(dur * (0.55 + 0.12 * k)));
  for (let i = 0; i < n; i++) out[i] *= v;
  return fadeEdges(out, 0.02, 0.15);
}

// a thread snapping: a tight high tick and the slack whisper after it
export function snap(dur = 0.5, v = 0.6, seed = 1) {
  const r = rng(seed), out = new Float32Array(N(dur)), hp = biquad("hp", 3500, 0.9);
  for (let i = 0; i < N(0.004); i++) out[i] = hp(r.bi()) * 0.8;
  const tail = noise(N(0.3), r, "white"), bp = biquad("bp", 5000, 2);
  for (let i = 0; i < tail.length; i++) tail[i] = bp(tail[i]) * 0.08 * Math.exp(-i / N(0.08));
  addAt(out, tail, N(0.01));
  for (let i = 0; i < out.length; i++) out[i] *= v;
  return out;
}

// a blade through thread or cloth: two short shears
export function snip(dur = 0.4, v = 0.6, seed = 1) {
  const r = rng(seed), out = new Float32Array(N(dur));
  for (const at of [0, 0.14]) { const s = noise(N(0.06), r, "white"), bp = biquad("bp", 4200, 3); for (let i = 0; i < s.length; i++) s[i] = bp(s[i]) * Math.exp(-i / N(0.012)); addAt(out, s, N(at)); addAt(out, vessel("iron", 5200 + r() * 800, 0.15, seed, { gain: 0.15, span: 0.05 }), N(at)); }
  for (let i = 0; i < out.length; i++) out[i] *= v;
  return out;
}

// a knock on a door or through a wall: o.count knocks
export function knock(dur = 1.2, v = 0.6, seed = 1, o = {}) {
  const r = rng(seed), out = new Float32Array(N(dur)), k = o.count || 3;
  for (let j = 0; j < k; j++) { const s = noise(N(0.08), r, "brown"), lp = biquad("lp", 260, 1.2); for (let i = 0; i < s.length; i++) s[i] = lp(s[i]) * 1.8 * Math.exp(-i / N(0.018)); addAt(out, s, N(0.05 + j * (0.22 + r() * 0.04))); }
  for (let i = 0; i < out.length; i++) out[i] *= v;
  return out;
}

// a breath in, held, let out
export function breath(dur = 2.4, v = 0.4, seed = 1) {
  const r = rng(seed), n = N(dur), out = noise(n, r, "pink"), bp = biquad("bp", 1100, 0.6);
  for (let i = 0; i < n; i++) { const u = i / n, g = u < 0.3 ? Math.sin((u / 0.3) * Math.PI) : u < 0.55 ? 0 : Math.sin(((u - 0.55) / 0.45) * Math.PI) * 0.8; out[i] = bp(out[i]) * g * 0.8; }
  for (let i = 0; i < n; i++) out[i] *= v;
  return fadeEdges(out, 0.05, 0.2);
}

// a heartbeat felt more than heard: lub-dub at o.bpm
export function heart(dur = 3, v = 0.6, seed = 1, o = {}) {
  const out = new Float32Array(N(dur)), period = 60 / (o.bpm || 72);
  const beat = (f, g) => { const s = new Float32Array(N(0.12)); for (let i = 0; i < s.length; i++) s[i] = Math.sin(TAU * f * i / SR) * g * Math.exp(-i / N(0.03)); return s; };
  for (let t = 0.05; t < dur - 0.3; t += period) { addAt(out, beat(48, 1), N(t)); addAt(out, beat(56, 0.6), N(t + 0.16)); }
  for (let i = 0; i < out.length; i++) out[i] *= v;
  return fadeEdges(out, 0.01, 0.1);
}

// a latch lifted and a door swinging on dry hinges
export function latch(dur = 1.6, v = 0.5, seed = 1) {
  const out = creak(dur, 0.6, seed, { down: true });
  addAt(out, vessel("iron", 2600, 0.4, seed, { gain: 0.4, span: 0.08 }), 0);
  for (let i = 0; i < out.length; i++) out[i] *= v;
  return out;
}

// a chair scraped back over boards
export function chair(dur = 0.7, v = 0.5, seed = 1) {
  const r = rng(seed), n = N(dur), out = noise(n, r, "white"), bp = biquad("bp", 1400, 4);
  for (let i = 0; i < n; i++) { const u = i / n; out[i] = bp(out[i]) * Math.sin(Math.PI * u) * (0.6 + 0.4 * Math.sin(TAU * 31 * i / SR)); }
  for (let i = 0; i < n; i++) out[i] *= v;
  return fadeEdges(out, 0.01, 0.05);
}

// water dripping into a pail, every second or so
export function drip(dur = 4, v = 0.4, seed = 1) {
  const r = rng(seed), out = new Float32Array(N(dur));
  for (let t = 0.2; t < dur - 0.2; t += 0.8 + r() * 0.7) addAt(out, vessel("waterglass", 900 + r() * 300, 0.6, seed + Math.round(t * 10), { gain: 1.2, span: 0.12 }), N(t));
  for (let i = 0; i < out.length; i++) out[i] *= v;
  return out;
}
