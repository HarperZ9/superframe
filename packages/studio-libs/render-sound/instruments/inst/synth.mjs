// The ensemble instruments, built where synthesis is strong: a pad (detuned band-limited
// saws through a swelling lowpass), a string section (more saws, slow vibrato, a violin-family body), and a
// wordless choir (several glottal voices through vowel formants, each with its own pitch and vibrato).
// All three are stereo: the left and right sides are separate players, which is where the width comes from.
import { SR, TAU, rng, biquad, fadeEdges } from "../dsp.mjs";
import { hum } from "./pad.mjs";

const blep = (t, dt) => (t < dt ? ((t /= dt), t + t - t * t - 1) : t > 1 - dt ? ((t = (t - 1) / dt), t * t + t + t + 1) : 0);

// a band of n detuned saws at f0 (cents spread), with optional vibrato; returns one channel
function sawBand(f0, n, spread, len, r, vib = null) {
  const out = new Float32Array(len);
  for (let k = 0; k < n; k++) {
    const cents = n === 1 ? 0 : (k / (n - 1) - 0.5) * 2 * spread + (r() - 0.5) * spread * 0.3;
    const f = f0 * Math.pow(2, cents / 1200), vr = 4.6 + r() * 1.4, vp = r() * TAU;
    let ph = r();
    for (let i = 0; i < len; i++) {
      const v = vib ? 1 + vib.depth * Math.min(1, i / (vib.delay * SR)) * Math.sin(TAU * vr * i / SR + vp) : 1;
      const dt = f * v / SR;
      ph += dt; if (ph >= 1) ph -= 1;
      out[i] += (2 * ph - 1 - blep(ph, dt)) / n;
    }
  }
  return out;
}
function envelope(len, nd, att, rel) {
  const na = Math.max(1, Math.round(att * SR)), nr = Math.max(1, Math.round(rel * SR));
  return (i) => Math.sin(Math.PI / 2 * Math.min(1, i / na)) * (i < nd ? 1 : Math.max(0, 1 - (i - nd) / nr));
}

export function pad(m, dur, v = 0.5, seed = 1, o = {}) {
  const r = rng(seed), f0 = 440 * Math.pow(2, (m - 69) / 12), rel = o.release ?? 2.5;
  const nd = Math.round(dur * SR), len = nd + Math.round(rel * SR), env = envelope(len, nd, o.attack ?? 1.2, rel);
  const cut = o.cutoff ?? 1800, side = (k) => {
    const x = sawBand(f0, o.voices ?? 3, o.detune ?? 9, len, r), lp = biquad("lp", cut, 0.6), lp2 = biquad("lp", cut * 1.4, 0.5);
    for (let i = 0; i < len; i++) {
      if ((i & 63) === 0) { const e = Math.min(1, i / ((o.attack ?? 1.2) * SR)); lp.set(cut * (0.35 + 0.65 * e) * (0.7 + 0.3 * v)); }
      x[i] = lp2(lp(x[i])) * env(i) * v * (o.gain ?? 0.16);
    }
    return fadeEdges(x, 0.002, 0.05);
  };
  return [side(0), side(1)];
}

const BODY = [[280, 1.2, 5], [1100, 1.5, 3], [3000, 2, 2], [6500, 0.7, -8]];
export function strings(m, dur, v = 0.5, seed = 1, o = {}) {
  const r = rng(seed), f0 = 440 * Math.pow(2, (m - 69) / 12), rel = o.release ?? 0.8;
  const nd = Math.round(dur * SR), len = nd + Math.round(rel * SR), env = envelope(len, nd, o.attack ?? 0.35, rel);
  const side = () => {
    const x = sawBand(f0, o.players ?? 4, o.detune ?? 7, len, r, { depth: 0.0018, delay: 0.4 });
    const peaks = BODY.map(([f, q, g]) => biquad("peak", f, q, g)), lp = biquad("lp", o.cutoff ?? (2500 + 3500 * v), 0.6), hp = biquad("hp", 60, 0.7);
    for (let i = 0; i < len; i++) { let y = hp(lp(x[i])); for (const p of peaks) y = p(y); x[i] = y * env(i) * v * (o.gain ?? 0.11); }
    return fadeEdges(x, 0.002, 0.05);
  };
  return [side(), side()];
}

// a choir section: `voices` singers a side, each a little off the note and with its own vibrato
export function choir(m, dur, v = 0.5, seed = 1, o = {}) {
  const r = rng(seed), f0 = 440 * Math.pow(2, (m - 69) / 12), n = o.voices ?? 3;
  const side = (s) => {
    const len = Math.round((dur + (o.release ?? 0.8)) * SR), out = new Float32Array(len);
    for (let k = 0; k < n; k++) {
      const f = f0 * Math.pow(2, (r() - 0.5) * 16 / 1200), d = Math.round(r() * 0.04 * SR);
      const h = hum(f, dur + (o.release ?? 0.8) - 0.05, 1, seed * 31 + s * 7 + k, { vowel: o.vowel || "ah", attack: o.attack ?? 0.4, release: o.release ?? 0.8, air: 0.12 });
      for (let i = 0; i + d < len && i < h.length; i++) out[i + d] += h[i] / Math.sqrt(n);
    }
    for (let i = 0; i < len; i++) out[i] *= v * (o.gain ?? 3);
    return out;
  };
  return [side(0), side(1)];
}
