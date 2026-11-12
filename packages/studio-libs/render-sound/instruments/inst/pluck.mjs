// Plucked strings by extended Karplus-Strong (Jaffe and Smith's extensions: a tuned allpass for the
// fractional part of the loop, a loss filter with a decay set in seconds, a pick-position comb and a
// dynamics lowpass on the excitation), then a small body of resonant peaks. Presets: harp, guitar
// (a clean archtop through a small amp), mandolin-like doubled courses, and the upright bass.
import { SR, biquad, onepole, rng, clamp, dcblock, fadeEdges, softclip } from "../dsp.mjs";
import { convolve } from "../fft.mjs";
import { partials } from "./modal.mjs";

// the upright's body: the air resonance near 58 Hz, the top's main wood mode near 98 Hz and those above it,
// each a short decaying mode, plus the direct sound (README, targets)
const WOOD = [[58, 1, 0.25], [98, 1.2, 0.18], [140, 0.8, 0.12], [196, 0.6, 0.1], [280, 0.5, 0.07], [410, 0.35, 0.05], [620, 0.25, 0.04]];
let wood = null;
export function woodIR() {
  if (wood) return wood;
  const ir = partials(WOOD.map(([f, a, t]) => ({ f, a, t60: t, ph: 0 })), Math.round(0.3 * SR));
  let pk = 0; for (const x of ir) pk = Math.max(pk, Math.abs(x));
  for (let i = 0; i < ir.length; i++) ir[i] *= 0.012 / pk;      // the modes ring under the direct sound
  ir[0] += 1;
  return (wood = ir);
}

export const PLUCK = {
  harp: { t60: 3.2, bright: 0.38, pick: 0.5, soft: 0.6, body: [[180, 2, 3], [420, 2, 2], [1100, 1.5, 1]], courses: 1, ring: true, out: 0.5 },
  guitar: { t60: 2.6, bright: 0.45, pick: 0.18, soft: 0.35, body: [[105, 3, 4], [210, 2.5, 3], [430, 2, 2]], courses: 1, amp: 1.6, cab: 4200, out: 0.42 },
  mandolin: { t60: 1.1, bright: 0.55, pick: 0.12, soft: 0.2, body: [[300, 2.5, 3], [650, 2, 2]], courses: 2, detune: 3, out: 0.36 },
  bass: { t60: 1.6, bright: 0.25, pick: 0.28, soft: 0.8, body: [], wood: true, courses: 1, thump: 0.5, finger: 1, buzz: 0.55, exciteLp: [250, 1800], out: 0.62 },
};

// one string: returns mono samples. f0 in Hz, dur in seconds; v velocity 0..1
export function string(f0, dur, v, o, r, sr = SR) {
  const n = Math.max(1, Math.round(dur * sr));
  const out = new Float32Array(n);
  const s = clamp(o.bright, 0.05, 0.5);                       // loss filter (1-s) + s z^-1, phase delay s
  const D = sr / f0;
  const N = Math.max(2, Math.floor(D - s - 0.1)), frac = D - s - N;
  const C = (1 - frac) / (1 + frac);                          // first-order allpass for the fraction
  const g = Math.pow(0.001, 1 / (f0 * o.t60));
  const line = new Float32Array(N), th = o.buzz ? o.buzz * v : 0, rattle = th ? new Float32Array(n) : null;
  excite(line, v, o, r);
  let idx = 0, prev = 0, apx = 0, apy = 0;
  for (let i = 0; i < n; i++) {
    const x = line[idx];
    const lp = (1 - s) * x + s * prev; prev = x;
    const ap = C * lp + apx - C * apy; apx = lp; apy = ap;   // y = C x + x1 - C y1
    line[idx] = ap * Math.min(0.99999, g);
    if (th) { const ex = Math.abs(x) - th; if (ex > 0) rattle[i] = ex * r.bi(); }   // the string slapping the fingerboard
    out[i] = x;
    idx = idx + 1 === N ? 0 : idx + 1;
  }
  if (rattle) { const hp = biquad("hp", 1200, 0.7), lp = biquad("lp", 6000, 0.7); for (let i = 0; i < n; i++) out[i] += lp(hp(rattle[i])) * 1.2; }
  return out;
}

function excite(line, v, o, r) {
  const N = line.length;
  for (let i = 0; i < N; i++) line[i] = r.bi();
  // a finger is rounder than noise: blend toward a smooth bump for soft plucks
  const soft = clamp(o.soft * (1.2 - v), 0, 1);
  for (let i = 0; i < N; i++) { const bump = Math.sin(Math.PI * i / N); line[i] = line[i] * (1 - soft) + bump * soft * 1.4; }
  // pick position: a comb that removes the harmonics with a node at the pick
  const p = Math.max(1, Math.round(o.pick * N)), tmp = Float32Array.from(line);
  for (let i = 0; i < N; i++) line[i] = tmp[i] - 0.9 * tmp[(i - p + N) % N];
  // dynamics: softer plucks are darker
  const lp = onepole((o.exciteLp || [800, 9000])[0] + (o.exciteLp || [800, 9000])[1] * v * v);   // a fingertip is darker than a pick
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < N; i++) line[i] = lp(line[i]);
  let m = 0; for (let i = 0; i < N; i++) m += line[i]; m /= N;
  let pk = 1e-9; for (let i = 0; i < N; i++) { line[i] -= m; pk = Math.max(pk, Math.abs(line[i])); }
  for (let i = 0; i < N; i++) line[i] *= v / pk;
}

// a note on a preset: courses, body, the bass's thump, the guitar's amp; returns mono
export function pluck(f0, dur, v = 0.7, preset = "harp", seed = 1, over = {}) {
  const o = { ...PLUCK[preset], ...over }, r = rng(seed);
  const tail = Math.min(o.t60, 6), n = Math.round((dur + tail * 0.6) * SR);
  const out = new Float32Array(n);
  for (let c = 0; c < o.courses; c++) {
    const cents = o.courses > 1 ? (c ? 1 : -1) * (o.detune || 2) : 0;
    const s = string(f0 * Math.pow(2, cents / 1200), n / SR, v, o, r);
    for (let i = 0; i < n; i++) out[i] += s[i] / o.courses;
  }
  if (o.thump) thump(out, f0, v * o.thump, r);
  if (o.finger) finger(out, v * o.finger, r);
  if (o.body.length) body(out, o.body);
  if (o.wood) { const w = convolve(out, woodIR()); out.set(w.subarray(0, out.length)); }
  if (o.amp) amp(out, o.amp, o.cab);
  damp(out, dur, o);
  if (o.swell) { const k = Math.round(o.swell * SR); for (let i = 0; i < Math.min(k, n); i++) out[i] *= Math.pow(i / k, 2); }   // a volume-pedal swell
  dcblock(out);
  for (let i = 0; i < n; i++) out[i] *= o.out;
  return fadeEdges(out, 0.0005, 0.03);
}

function body(buf, peaks) {
  const dry = Float32Array.from(buf);
  for (const [f, q, gdb] of peaks) {
    const bq = biquad("peak", f, q, gdb);
    for (let i = 0; i < buf.length; i++) buf[i] = bq(buf[i]);
  }
  for (let i = 0; i < buf.length; i++) buf[i] = buf[i] * 0.7 + dry[i] * 0.3;
}
function thump(buf, f0, a, r) {
  const n = Math.min(buf.length, Math.round(0.06 * SR)), lp = biquad("lp", Math.max(120, f0 * 2.2), 0.9);
  for (let i = 0; i < n; i++) buf[i] += lp(r.bi() * 0.4 + Math.sin(Math.PI * i / n)) * a * Math.exp(-i / (0.012 * SR));
}
// the finger leaving the string: a short bright slip a few milliseconds after the pluck
function finger(buf, a, r) {
  const s = Math.round(0.006 * SR), n = Math.min(buf.length - s, Math.round(0.012 * SR)), bp = biquad("bp", 2600, 1.2);
  for (let i = 0; i < n; i++) buf[s + i] += bp(r.bi()) * a * 0.9 * Math.exp(-i / (0.004 * SR));
}
function amp(buf, drive, cab) {
  const lp = biquad("lp", cab, 0.8), lp2 = biquad("lp", cab * 1.3, 0.7), hp = biquad("hp", 80, 0.7);
  for (let i = 0; i < buf.length; i++) buf[i] = lp2(lp(hp(softclip(buf[i] * drive) / drive)));
}
// a release: the finger stops the string at the note's end, with a short damped tail
function damp(buf, dur, o) {
  if (o.ring) return;
  const at = Math.round(dur * SR), rel = Math.round((o.release || 0.12) * SR);
  for (let i = at; i < buf.length; i++) { const k = i - at; buf[i] *= k < rel ? Math.exp(-5 * k / rel) : 0; }
}
