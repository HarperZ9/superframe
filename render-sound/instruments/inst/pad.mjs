// Sustained material: additive drones (a sub-bass, an open fifth),
// metal drones (iron partials held and beating), breath (noise through a throat's
// formants, inhale and exhale), and a wordless hum (a glottal pulse through vowel formants, meant to sit
// far back in a room; it is not a singer).
import { SR, TAU, rng, biquad, noise, fadeEdges } from "../dsp.mjs";
import { VESSELS } from "./modal.mjs";

// a slow seeded wander in 0..1 (several sines at unrelated rates), for drift that never loops audibly
function wander(r, rate) {
  const fs = [rate, rate * 1.618, rate * 2.71], ph = fs.map(() => r() * TAU);
  return (t) => 0.5 + fs.reduce((s, f, i) => s + Math.sin(TAU * f * t + ph[i]) / (i + 2), 0) * 0.55;
}
function swell(n, att, rel) {
  const na = Math.round(att * SR), nr = Math.round(rel * SR);
  // equal-power edges, so a looped drone's folded tail crossfades into its head without a dip
  return (i) => Math.sin(Math.PI / 2 * Math.min(1, i / Math.max(1, na))) * Math.sin(Math.PI / 2 * Math.min(1, (n - i) / Math.max(1, nr)));
}

// partials: [ratio, amplitude]; every partial drifts in level, the pair beats by `beat` Hz
export function drone(f0, dur, v = 0.5, seed = 1, o = {}) {
  const r = rng(seed), n = Math.round(dur * SR), out = new Float32Array(n), env = swell(n, o.attack ?? 3, o.release ?? 4);
  const parts = o.partials || [[1, 1], [2, 0.35], [3, 0.18], [4, 0.08]];
  for (const [k, a] of parts) for (const side of [-1, 1]) {
    const f = f0 * k + side * (o.beat ?? 0.12) * k, w = TAU * f / SR, wd = wander(r, 0.03 + r() * 0.05);
    let ph = r() * TAU, lvl = 0;
    for (let i = 0; i < n; i++) { if ((i & 63) === 0) lvl = a * (0.5 + 0.5 * wd(i / SR)); out[i] += Math.sin(ph) * lvl; ph += w; }
  }
  if (o.sub) { let ph = 0; const w = TAU * f0 * 0.5 / SR; for (let i = 0; i < n; i++) { out[i] += Math.sin(ph) * o.sub; ph += w; } }
  const g = v * 0.12;
  for (let i = 0; i < n; i++) out[i] *= env(i) * g;
  return fadeEdges(out, 0.01, 0.05);
}

// iron held: the vessel table's partials as a drone; rubbed, so each partial swells on its own
export function metal(f0, dur, v = 0.5, seed = 1, o = {}) {
  const parts = VESSELS[o.kind || "iron"].map(([k, a]) => [k, a * 0.6]);
  const out = drone(f0, dur, v, seed, { ...o, partials: parts, beat: o.beat ?? 0.6 });
  if (o.grit) {
    const r = rng(seed + 7), bp = biquad("bp", f0 * 6, 2);
    for (let i = 0; i < out.length; i++) out[i] += bp(r.bi()) * o.grit * 0.02 * Math.abs(out[i] * 8);
  }
  return out;
}

// breath: noise through two throat formants; out on exhale, a higher, thinner inhale
export function breath(dur, v = 0.4, seed = 1, o = {}) {
  const r = rng(seed), n = Math.round(dur * SR), src = noise(n, r, "pink"), out = new Float32Array(n);
  const inh = o.inhale, f1 = biquad("bp", inh ? 1600 : 900, 1.2), f2 = biquad("bp", inh ? 3200 : 2300, 1.6), hp = biquad("hp", 250, 0.7);
  for (let i = 0; i < n; i++) {
    const t = i / n, e = Math.pow(Math.sin(Math.PI * Math.pow(t, inh ? 0.7 : 0.45)), 2);
    out[i] = hp(f1(src[i]) * 0.8 + f2(src[i]) * 0.5) * e * v * 0.9;
  }
  return fadeEdges(out, 0.01, 0.05);
}

const VOWELS = { oh: [[450, 1], [800, 0.5], [2830, 0.12]], oo: [[300, 1], [870, 0.4], [2240, 0.1]], ah: [[730, 1], [1090, 0.6], [2440, 0.25]], mm: [[250, 1], [1200, 0.08], [2200, 0.04]], eh: [[530, 1], [1840, 0.5], [2480, 0.3]] };
// a wordless voice: a Rosenberg-like glottal pulse (with jitter and shimmer) through three formants
export function hum(f0, dur, v = 0.5, seed = 1, o = {}) {
  const r = rng(seed), n = Math.round(dur * SR), out = new Float32Array(n), env = swell(n, o.attack ?? 0.25, o.release ?? 0.4);
  const fm = (VOWELS[o.vowel || "oo"]).map(([f, a]) => [biquad("bp", f, f / 90), a]);
  const asp = biquad("hp", 1500, 0.7);
  let ph = 0, f = f0;
  for (let i = 0; i < n; i++) {
    if (ph >= 1) { ph -= 1; f = f0 * (1 + 0.004 * r.bi() + 0.006 * Math.sin(TAU * 5.1 * i / SR) * Math.min(1, i / SR)); }
    const g = ph < 0.6 ? 0.5 - 0.5 * Math.cos(Math.PI * ph / 0.6) : Math.cos(Math.PI * (ph - 0.6) / 0.8);
    const src = Math.max(0, g) * (1 + 0.05 * r.bi()) + asp(r.bi()) * (o.air ?? 0.08);
    let y = 0; for (const [bq, a] of fm) y += bq(src) * a;
    out[i] = y * env(i) * v * 0.6;
    ph += f / SR;
  }
  return fadeEdges(out, 0.01, 0.05);
}
