// The industrial palette (SCORE.md section 2): the export train, the notice press, the grain chute, the
// requisition lamps' hum (the diegetic signal), the Captain's chain, the requisition cart, the mill's
// stones. Each is mono and built from noise and struck-iron modes; the score uses them as instruments.
import { SR, TAU, rng, biquad, noise, fadeEdges, addAt } from "../lib/dsp.mjs";
import { vessel } from "../lib/inst/modal.mjs";

const burst = (r, len, f, q, decay) => {
  const n = Math.round(len * SR), out = new Float32Array(n), bp = biquad("bp", f, q);
  for (let i = 0; i < n; i++) out[i] = bp(r.bi()) * Math.exp(-i / (decay * SR));
  return out;
};

// the export train: o.mode "idle" (standing, hissing, sacks thrown in) or "depart" (couplings take up
// the slack, chuffs quicken, the wheels start to count the rail joints)
export function train(dur, v = 0.6, seed = 1, o = {}) {
  const r = rng(seed), n = Math.round(dur * SR), out = new Float32Array(n);
  const hiss = noise(n, r), hp = biquad("hp", 2500, 0.6), pk = biquad("peak", 5200, 2, 5);
  for (let i = 0; i < n; i++) out[i] += pk(hp(hiss[i])) * 0.05 * (1 + 0.3 * Math.sin(TAU * 0.3 * i / SR));
  if (o.mode !== "depart") { sacks(out, r, dur); return scaleOut(out, v); }
  for (let k = 0; k < 9; k++) addAt(out, vessel("iron", 70 + r() * 50, 0.9 - k * 0.07, seed + k, { gain: 0.5 }), Math.round((0.8 + k * (0.28 + r() * 0.1)) * SR));
  let t = 2.4, speed = 0.4;
  while (t < dur) {
    const rate = Math.max(0.6, speed * 4 / 4.7), far = Math.max(0.15, 1 - t / (dur * 1.2));
    addAt(out, chuff(r, 0.35 / Math.sqrt(rate)), Math.round(t * SR), 0.9 * far);
    if (r() < 0.5 && speed > 1) addAt(out, clack(r, seed, 1.8 / speed), Math.round((t + 0.1) * SR), 0.5 * far);
    t += 1 / rate; speed = Math.min(o.top || 7, speed + 0.25);
  }
  return scaleOut(out, v);
}
const chuff = (r, len) => { const a = burst(r, len, 420, 0.7, len * 0.35), lp = biquad("lp", 140, 0.8); for (let i = 0; i < a.length; i++) a[i] += lp(r.bi()) * 2 * Math.exp(-i / (0.05 * SR)); return a; };
function clack(r, seed, gap) {
  const a = vessel("iron", 900 + r() * 300, 0.5, seed + 99, { gain: 0.2, span: 0.25 }), out = new Float32Array(a.length + Math.round(gap * SR));
  addAt(out, a, 0); addAt(out, a, Math.round(gap * SR), 0.85); return out;
}
function sacks(out, r, dur) {
  for (let t = 0.5; t < dur; t += 1.5 + r() * 2.5) {
    const thud = burst(r, 0.25, 180, 0.8, 0.04);
    addAt(out, thud, Math.round(t * SR), 0.8);
  }
}
const scaleOut = (out, v) => { for (let i = 0; i < out.length; i++) out[i] *= v; return fadeEdges(out, 0.05, 0.3); };

// one cycle of a hand press printing a notice: the ratchet, the platen coming down, the release
export function press(dur = 1.2, v = 0.6, seed = 1) {
  const r = rng(seed), n = Math.round(1.4 * SR), out = new Float32Array(n);
  for (let k = 0; k < 3; k++) addAt(out, burst(r, 0.03, 3200, 2, 0.004), Math.round(k * 0.07 * SR), 0.5);
  const platen = vessel("iron", 62, 0.9, seed, { gain: 0.6, span: 0.5 }), thump = burst(r, 0.2, 90, 0.7, 0.05);
  addAt(out, platen, Math.round(0.28 * SR)); addAt(out, thump, Math.round(0.28 * SR), 1.4);
  addAt(out, vessel("iron", 240, 0.5, seed + 2, { gain: 0.3, span: 0.3 }), Math.round(0.75 * SR));
  addAt(out, burst(r, 0.3, 2400, 0.6, 0.1), Math.round(0.9 * SR), 0.15);                     // the sheet drawn off
  return scaleOut(out, v);
}

// grain running down a chute: thousands of small impacts on wood, and the chute's own boom
export function chute(dur, v = 0.5, seed = 1, o = {}) {
  const r = rng(seed), n = Math.round(dur * SR), out = new Float32Array(n), flow = o.flow ?? 0.7;
  const bp = biquad("bp", 2800, 0.7), body = biquad("bp", 180, 3), lp = biquad("lp", 6000, 0.7);
  for (let i = 0; i < n; i++) {
    const t = i / n, env = Math.min(1, t * 8) * Math.min(1, (1 - t) * 8) * (0.8 + 0.2 * Math.sin(TAU * 0.4 * i / SR));
    const grain = r() < 0.25 * flow ? r.bi() : 0;
    out[i] = (lp(bp(grain)) * 1.2 + body(grain) * 1.5) * env * v;
  }
  return out;
}

// the requisition lamps: a mains hum at 100 Hz (G2 a third of a semitone sharp), its harmonics and a
// rough buzz. It sits against the score's D on purpose. o.near (0..1) brings up the buzz.
export function lamphum(dur, v = 0.4, seed = 1, o = {}) {
  const r = rng(seed), n = Math.round(dur * SR), out = new Float32Array(n), near = o.near ?? 0.5;
  const H = [[1, 1], [2, 0.6], [3, 0.35], [4, 0.25], [5, 0.12], [7, 0.08]], f0 = o.hz || 100;
  const bp = biquad("bp", 1800, 1.5);
  for (let i = 0; i < n; i++) {
    const t = i / SR; let s = 0;
    for (const [k, a] of H) s += Math.sin(TAU * f0 * k * t + k) * a;
    const buzz = bp(r.bi()) * Math.max(0, Math.sin(TAU * f0 * t)) * near * 1.5;
    out[i] = (s * 0.25 + buzz) * v * (0.9 + 0.1 * Math.sin(TAU * 0.13 * t));
  }
  return fadeEdges(out, 0.2, 0.2);
}

export function chain(dur = 0.8, v = 0.5, seed = 1) {
  const r = rng(seed), n = Math.round(Math.max(0.5, dur) * SR), out = new Float32Array(n), links = 8 + Math.floor(r() * 8);
  for (let k = 0; k < links; k++) addAt(out, vessel("iron", 1800 + r() * 2200, 0.3 + r() * 0.4, seed + k, { gain: 0.25, span: 0.15 }), Math.round(r() * (n - 0.2 * SR)));
  return scaleOut(out, v);
}

// the cart: an ungreased axle (stick-slip squeal), iron tyres on frozen ruts, sacks settling
export function cart(dur, v = 0.5, seed = 1, o = {}) {
  const r = rng(seed), n = Math.round(dur * SR), out = new Float32Array(n), speed = o.speed ?? 0.6;
  const sq = biquad("bp", 780, 12), sq2 = biquad("bp", 1560, 14);
  let slip = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, turn = Math.max(0, Math.sin(TAU * speed * 0.45 * t)) ** 6;
    slip += (650 + 300 * turn) / SR; let pulse = 0; if (slip >= 1) { slip -= 1; pulse = 1; }
    out[i] = (sq(pulse) * 2 + sq2(pulse)) * turn * 0.6;
  }
  for (let t = 0.2; t < dur; t += (0.25 + r() * 0.6) / speed) addAt(out, burst(r, 0.12, 120 + r() * 80, 0.8, 0.03), Math.round(t * SR), 0.7 + r() * 0.5);
  return scaleOut(out, v);
}

// the mill's stones turning: a low grind with a slow periodic catch
export function millgrind(dur, v = 0.5, seed = 1, o = {}) {
  const r = rng(seed), n = Math.round(dur * SR), out = noise(n, r, "brown"), lp = biquad("lp", 320, 0.8), pk = biquad("peak", 95, 4, 9);
  const rev = o.rpm ? o.rpm / 60 : 1.6;
  for (let i = 0; i < n; i++) out[i] = pk(lp(out[i])) * (0.75 + 0.25 * Math.sin(TAU * rev * i / SR) ** 2) * v * 0.7;
  return fadeEdges(out, 0.5, 0.5);
}
