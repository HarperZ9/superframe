// Drums from noise and modal partials. The brushed snare is two gestures: the sweep (a wire brush drawn
// across the head: band-limited noise under a slow swell, its centre moving with the stroke) and the tap
// (a short noise burst on the snare wires plus the head's first membrane modes). The ride is about sixty
// inharmonic partials with a noisy wash, the bell of the cymbal on its own modes; the kick is a felt beater
// on a loose head (Bessel-ratio modes with a falling pitch); the hat is a foot chick.
import { SR, TAU, rng, biquad, noise, fadeEdges } from "../dsp.mjs";
import { partials } from "./modal.mjs";

const MEMBRANE = [1, 1.594, 2.136, 2.296, 2.653, 2.918];          // circular membrane mode ratios (ideal)

export function sweep(dur, v = 0.5, seed = 1, o = {}) {
  const r = rng(seed), n = Math.round(dur * SR), out = noise(n, r, "white");
  const hp = biquad("hp", 1800, 0.7), f0 = o.from || 3000, f1 = o.to || 5200;
  const bp = biquad("bp", f0, 1.1);
  for (let i = 0; i < n; i++) {
    if ((i & 63) === 0) bp.set(f0 + (f1 - f0) * i / n);
    const t = i / n, env = Math.pow(Math.sin(Math.PI * t), 1.5) * (0.85 + 0.15 * Math.sin(TAU * 11 * t));
    out[i] = bp(hp(out[i])) * env * v * 0.3;
  }
  return fadeEdges(out, 0.002, 0.01);
}

export function tap(v = 0.6, seed = 1, o = {}) {
  const r = rng(seed), n = Math.round(0.35 * SR), f0 = o.tune || 190;
  const head = partials(MEMBRANE.map((k, i) => ({ f: f0 * k, a: 0.5 / (i + 1), t60: 0.18 / (1 + i * 0.4), ph: r() * TAU })), n);
  const wires = noise(n, r), bp = biquad("bp", 4200, 0.8), hp = biquad("hp", 2500, 0.7);
  const decay = o.brush ? 0.03 : 0.07;
  for (let i = 0; i < n; i++) wires[i] = bp(hp(wires[i])) * Math.exp(-i / (decay * SR));
  const out = new Float32Array(n), headMix = o.brush ? 0.35 : 0.8;
  for (let i = 0; i < n; i++) out[i] = (head[i] * headMix + wires[i] * 0.9) * v * 0.6;
  return fadeEdges(out, 0.0005, 0.05);
}

export function kick(v = 0.6, seed = 1, o = {}) {
  const r = rng(seed), n = Math.round(0.8 * SR), out = new Float32Array(n), f0 = o.tune || 56;
  // the fundamental falls a little as the head relaxes after the strike
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, f = f0 * (1 + 0.5 * Math.exp(-t / 0.025));
    ph += TAU * f / SR;
    out[i] = Math.sin(ph) * Math.exp(-t / (o.decay || 0.22)) * 0.9;
  }
  const over = partials(MEMBRANE.slice(1).map((k, i) => ({ f: f0 * k, a: 0.2 / (i + 1), t60: 0.15, ph: r() * TAU })), n);
  const felt = biquad("lp", 900, 0.7);
  for (let i = 0; i < n; i++) out[i] = (out[i] + over[i] + felt(r.bi()) * 0.4 * Math.exp(-i / (0.004 * SR))) * v * 0.7;
  return fadeEdges(out, 0.0005, 0.05);
}

// a ride (or, with o.crash, a crash): about 150 inharmonic modes, denser toward the top as a real plate's
// are; the high modes swell over the first tenth of a second as the strike's energy climbs into them; a
// noisy wash on that swell; the stick's ping on two or three strong bell modes; the tick of the stick
const rise = (buf, tau) => { for (let i = 0; i < buf.length; i++) buf[i] *= 1 - Math.exp(-i / (tau * SR)); return buf; };
export function ride(v = 0.5, seed = 1, o = {}) {
  const r = rng(seed ^ 0x5eed), r2 = rng(seed), T = o.crash ? 4.5 : 5.5, n = Math.round(T * 1.1 * SR), lo = [], hi = [];
  for (let k = 0; k < 150; k++) {
    const f = 280 * Math.pow(2, 5.8 * Math.pow(r(), 0.7)), p = { f, a: (0.4 + r() * 0.6) / Math.sqrt(1 + k * 0.15), t60: T * Math.pow(1000 / f, 0.3), ph: r2() * TAU };
    (f < 3000 ? lo : hi).push(p);
  }
  const L = partials(lo, n), H = rise(partials(hi, n), o.crash ? 0.03 : 0.06);
  const wash = noise(n, r2), hp = biquad("hp", 6000, 0.6), pk = biquad("peak", 9000, 1.2, 4);
  for (let i = 0; i < n; i++) wash[i] = pk(hp(wash[i])) * (1 - Math.exp(-i / (0.05 * SR))) * Math.exp(-i / ((o.crash ? 1.4 : 0.9) * SR));
  const ping = partials([[2450, 1], [3380, 0.7], [4960, 0.5]].map(([f, a]) => ({ f: f * (1 + (r() - 0.5) * 0.02), a, t60: o.bell ? 3 : 1.8, ph: r2() * TAU })), n);
  const out = new Float32Array(n), tick = biquad("hp", 2500, 0.7);
  for (let i = 0; i < n; i++) {
    const stick = i < 200 ? tick(r2.bi()) * Math.exp(-i / 30) * (o.brush ? 0.15 : 0.6) : 0;
    out[i] = (L[i] * 0.05 + H[i] * 0.05 + wash[i] * 0.08 + ping[i] * (o.bell ? 0.16 : 0.07) + stick) * v;
  }
  return fadeEdges(out, 0.0003, 0.2);
}

export function hat(v = 0.4, seed = 1, o = {}) {
  const r = rng(seed), n = Math.round((o.open ? 0.6 : 0.09) * SR), out = noise(n, r);
  const hp = biquad("hp", 7000, 0.7), bp = biquad("bp", 9500, 1.2);
  const d = o.open ? 0.18 : 0.025;
  for (let i = 0; i < n; i++) out[i] = (hp(out[i]) * 0.5 + bp(out[i]) * 0.6) * Math.exp(-i / (d * SR)) * v * 0.5;
  return fadeEdges(out, 0.0005, 0.01);
}

// a finger snap: a sharp band of noise and the click of the finger landing on the palm
export function snap(v = 0.5, seed = 1) {
  const r = rng(seed), n = Math.round(0.12 * SR), out = new Float32Array(n), bp = biquad("bp", 2300, 1.8), hp = biquad("hp", 1200, 0.7);
  for (let i = 0; i < n; i++) out[i] = (bp(r.bi()) * 1.4 * Math.exp(-i / (0.009 * SR)) + hp(r.bi()) * 0.5 * Math.exp(-i / (0.002 * SR))) * v * 0.6;
  return fadeEdges(out, 0.0003, 0.01);
}

// a low drum struck with a soft mallet: the membrane's modes, slow to die (a procession drum)
export function tom(v = 0.6, seed = 1, o = {}) {
  const r = rng(seed), n = Math.round(1.8 * SR), f0 = o.tune || 62;
  const out = partials(MEMBRANE.map((k, i) => ({ f: f0 * k, a: [1, 0.5, 0.35, 0.2, 0.15, 0.1][i], t60: (o.decay || 1.4) / (1 + i * 0.6), ph: r() * TAU })), n);
  const lp = biquad("lp", 500, 0.7);
  for (let i = 0; i < n; i++) out[i] = (out[i] * 0.6 + lp(r.bi()) * 0.5 * Math.exp(-i / (0.01 * SR))) * v;
  return fadeEdges(out, 0.0005, 0.05);
}

// a barrel or a crate struck with the hand: a low wooden thud (a street drum)
export function crate(v = 0.6, seed = 1, o = {}) {
  const r = rng(seed), n = Math.round(0.4 * SR), f0 = o.tune || 110;
  const modes = [1, 1.65, 2.4, 3.3].map((k, i) => ({ f: f0 * k * (1 + (r() - 0.5) * 0.02), a: 0.6 / (i + 1), t60: 0.12 / (1 + i * 0.5), ph: r() * TAU }));
  const out = partials(modes, n), slap = biquad("bp", 1400, 1);
  for (let i = 0; i < n; i++) out[i] = (out[i] + slap(r.bi()) * 0.5 * Math.exp(-i / (0.005 * SR))) * v;
  return fadeEdges(out, 0.0003, 0.03);
}
