// Wind instruments as digital waveguides, after Cook's models: a flute (a jet delay feeding a cubic jet
// table into an open bore, with breath noise) and a single reed (a pressure-controlled reed table at the
// mouth of a cylindrical bore, then two formant peaks that push the clarinet-like tone toward a nasal,
// oboe-like colour). Pitch is set by a short probe render and one correction, so the note lands in tune.
import { SR, TAU, rng, biquad, onepole, fadeEdges } from "../dsp.mjs";
import { pitchOf } from "../analysis.mjs";

function delay(max) {
  const buf = new Float32Array(max + 4); let w = 0, len = 2, last = 0;
  return {
    set(d) { len = Math.max(1.5, Math.min(max, d)); },
    tick(x) {
      buf[w] = x; let r = w - len; if (r < 0) r += buf.length;
      const i = Math.floor(r), f = r - i, j = i + 1 === buf.length ? 0 : i + 1;
      last = buf[i] * (1 - f) + buf[j] * f; w = w + 1 === buf.length ? 0 : w + 1; return last;
    },
    get last() { return last; },
  };
}
// breath: attack, sustain with a slow swell, release; vibrato starts late, the way a player's does
function breathEnv(n, dur, o) {
  const env = new Float32Array(n), na = Math.round(o.attack * SR), nd = Math.round(dur * SR), nr = Math.round(o.release * SR);
  for (let i = 0; i < n; i++) {
    let e = i < na ? Math.pow(i / na, 0.6) : 1;
    if (i >= nd) e *= Math.max(0, 1 - (i - nd) / nr);
    env[i] = e * (1 + o.swell * Math.sin(Math.PI * Math.min(1, i / Math.max(1, nd))));
  }
  return env;
}

function fluteRun(f0, dur, v, o, r, ratio) {
  const n = Math.round((dur + o.release + 0.05) * SR), out = new Float32Array(n);
  const bore = delay(4096), jet = delay(4096), lp = onepole(o.tone), dc = biquad("hp", 30, 0.7);
  const d = SR / f0 * ratio; bore.set(d); jet.set(d * o.jet);
  const env = breathEnv(n, dur, o), P = 0.75 + 0.35 * v, vibStart = Math.round(0.35 * SR);
  for (let i = 0; i < n; i++) {
    const vib = i > vibStart ? o.vib * Math.sin(TAU * o.vibHz * i / SR) * Math.min(1, (i - vibStart) / SR) : 0;
    let p = P * env[i]; p += p * (o.noise * r.bi() + vib);
    const t = dc(-lp(bore.last));
    let pd = jet.tick(p - 0.5 * t);
    pd = Math.max(-1, Math.min(1, pd * (pd * pd - 1))) + 0.5 * t;
    out[i] = bore.tick(pd) * 0.3 + o.air * p * r.bi() * 0.04;
  }
  return out;
}

function reedRun(f0, dur, v, o, r, ratio) {
  const n = Math.round((dur + o.release + 0.05) * SR), out = new Float32Array(n);
  const bore = delay(4096); bore.set(SR / f0 * 0.5 * ratio);
  const env = breathEnv(n, dur, o), P = 0.62 + 0.28 * v; let z = 0;
  for (let i = 0; i < n; i++) {
    let p = P * env[i]; p += p * (o.noise * r.bi() + o.vib * Math.sin(TAU * o.vibHz * i / SR));
    const x = bore.last, filt = 0.5 * (x + z); z = x;
    const pd = -0.95 * filt - p;
    const reed = Math.max(-1, Math.min(1, 0.7 - 0.3 * pd));
    out[i] = bore.tick(p + pd * reed);
  }
  return out;
}

export const WIND = {
  flute: { run: fluteRun, attack: 0.07, release: 0.12, swell: 0.08, noise: 0.06, air: 1, vib: 0.035, vibHz: 4.8, jet: 0.32, tone: 2600, gain: 0.5 },
  breathy: { run: fluteRun, attack: 0.16, release: 0.25, swell: 0.12, noise: 0.16, air: 3.2, vib: 0.02, vibHz: 4.2, jet: 0.32, tone: 1800, gain: 0.55 },
  reed: { run: reedRun, attack: 0.05, release: 0.1, swell: 0.06, noise: 0.03, vib: 0.02, vibHz: 5, formants: [[1150, 2.5, 7], [2800, 3, 5], [400, 1, -4]], gain: 0.33 },
};

// a note: probe 0.7 s, measure, correct the delay ratio (up to three times), render the note, then colour and level
export function wind(f0, dur, v = 0.7, preset = "flute", seed = 1, over = {}) {
  const o = { ...WIND[preset], ...over };
  let ratio = 1;
  for (let k = 0; k < 3; k++) {
    const probe = o.run(f0, 0.7, v, o, rng(seed), ratio);
    const got = pitchOf(probe, Math.round(0.3 * SR), 8192, 60, 3000);
    if (!(got > 0) || Math.abs(1200 * Math.log2(got / f0)) < 1) break;
    ratio *= got / f0;
  }
  const out = o.run(f0, dur, v, o, rng(seed), ratio);
  for (const [f, q, g] of o.formants || []) biquad("peak", f, q, g).run(out);
  for (let i = 0; i < out.length; i++) out[i] *= o.gain;
  return fadeEdges(out, 0.001, 0.03);
}
