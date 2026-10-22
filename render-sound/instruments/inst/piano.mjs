// The piano, second model (README, "Targets"). A note is a sum of decaying partials on stiff
// strings (f_n = n f0 sqrt(1 + B n^2), B from a register table), struck by a felt hammer whose spectrum
// brightens with velocity, at a strike point that notches about the eighth partial. Two or three unison
// strings sit a cent or so apart, so each partial has a quick prompt decay and a slow aftersound about
// 15 dB down (the coupled-string double decay). Hammer and key noise sit on the attack; the damper thumps
// when it lands. The soundboard and the sympathetic strings are stem effects (soundboardIR, sympathetic),
// because they belong to the instrument as a whole, not to one note.
import { SR, TAU, rng, biquad, fadeEdges } from "../dsp.mjs";
import { partials } from "./modal.mjs";

// register tables (MIDI, value), interpolated in log: B from stiff-string measurements, T the aftersound t60
const B_TABLE = [[21, 0.0003], [33, 0.00018], [45, 0.00022], [60, 0.0005], [72, 0.0012], [84, 0.004], [96, 0.012], [108, 0.03]];
const T_TABLE = [[21, 40], [36, 30], [48, 22], [60, 16], [72, 9], [84, 5], [96, 2.2], [108, 1]];
function interp(table, m) {
  if (m <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) if (m <= table[i][0]) {
    const [m0, v0] = table[i - 1], [m1, v1] = table[i], u = (m - m0) / (m1 - m0);
    return Math.exp(Math.log(v0) + (Math.log(v1) - Math.log(v0)) * u);
  }
  return table[table.length - 1][1];
}
export const pianoB = (m) => interp(B_TABLE, m);
export const pianoT60 = (m) => interp(T_TABLE, m);

function stringsOf(m, f0, v, r, o) {
  const B = pianoB(m), n = o.unison || (m < 35 ? 1 : m < 48 ? 2 : 3), T = pianoT60(m) * (o.decay || 1);
  const fc = f0 * (2.5 + 18 * Math.pow(v, 1.5)) + 200 * v, beta = 1 / (7.5 + r()), list = [];
  for (let k = 1; k <= 80; k++) {
    const f = k * f0 * Math.sqrt((1 + B * k * k) / (1 + B));
    if (f > 14000) break;
    const a = Math.abs(Math.sin(Math.PI * k * beta)) / Math.pow(k, 0.7) / (1 + Math.pow(f / fc, 2.6));
    const t60 = T / (1 + Math.pow(f / 1200, 1.5) * 1.8), strs = k <= 12 ? n : 1;
    for (let s = 0; s < strs; s++) {
      const det = strs > 1 ? (s - (strs - 1) / 2) * (0.5 + r() * 0.7) : 0;
      list.push({ f: f * Math.pow(2, det / 1200), a: a / strs, t60: t60 / 4, t60b: t60, mix: strs > 1 ? 0.18 : 0.4, ph: r() * TAU });
    }
  }
  return { list, T };
}
// the felt on the string, and the key hitting the keybed
function hammerNoise(buf, f0, v, r) {
  const n = Math.min(buf.length, Math.round(0.04 * SR)), felt = biquad("bp", 2400 + f0, 0.8), bed = biquad("lp", 280, 0.8);
  for (let i = 0; i < n; i++) buf[i] += (felt(r.bi()) * 1.1 * v * Math.exp(-i / (0.004 * SR)) + bed(r.bi()) * 0.4 * v * Math.exp(-i / (0.012 * SR)));
}
function damperThump(buf, at, r) {
  const n = Math.min(buf.length - at, Math.round(0.05 * SR)), lp = biquad("lp", 220, 0.8);
  for (let i = 0; i < n; i++) buf[at + i] += lp(r.bi()) * 0.03 * Math.exp(-i / (0.01 * SR));
}

export function piano(m, dur, v = 0.6, seed = 1, o = {}) {
  const r = rng(seed), f0 = 440 * Math.pow(2, (m - 69) / 12), { list, T } = stringsOf(m, f0, v, r, o);
  const tail = o.pedal ? Math.min(T, 10) : 0.5, n = Math.round((dur + tail) * SR), off = Math.round(dur * SR);
  const damp = o.pedal || m > 88 ? null : { at: off, t60: 0.2 + (m < 40 ? 0.4 : 0) };
  const out = partials(list, n, damp);
  if (o.noise !== false) hammerNoise(out, f0, v, r);
  if (damp) damperThump(out, off, r);
  const g = (o.gain || 0.22) * (0.25 + 0.75 * v);
  for (let i = 0; i < n; i++) out[i] *= g;
  return fadeEdges(out, 0.0003, 0.05);
}

// the soundboard: a dense burst of wood modes, 80 Hz to 5 kHz, each dying in 20 to 200 ms; convolved
// with the whole piano stem it gives the struck tone a body
export function soundboardIR(seed = 9) {
  const r = rng(seed), n = Math.round(0.35 * SR), list = [];
  for (let k = 0; k < 140; k++) { const f = 80 * Math.pow(2, r() * 6); list.push({ f, a: (0.4 + r()) / Math.sqrt(1 + f / 400), t60: 0.02 + 0.18 * Math.pow(r(), 2) * Math.min(1, 600 / f) * 3, ph: r() * TAU }); }
  const ir = partials(list, n);
  ir[0] += 1.0;                                                  // keep the direct sound
  let e = 0; for (const x of ir) e += x * x;
  const g = 1 / Math.sqrt(e);
  for (let i = 0; i < n; i++) ir[i] *= g;
  return ir;
}

// sympathetic strings: with the dampers up, every string from C2 to B5 rings when the sound holds its
// frequencies. A bank of resonators fed the stem, mixed back at `level`.
export function sympathetic(mono, level = 0.06, t60 = 4, lo = 36, hi = 83) {
  const out = new Float32Array(mono.length), k = Math.exp(-6.9078 / (t60 * SR));
  for (let m = lo; m <= hi; m++) {
    const w = TAU * 440 * Math.pow(2, (m - 69) / 12) / SR, c = 2 * k * Math.cos(w), k2 = k * k, b = (1 - k) * 2;
    let y1 = 0, y2 = 0;
    for (let i = 0; i < mono.length; i++) { const y = b * mono[i] + c * y1 - k2 * y2; y2 = y1; y1 = y; out[i] += y; }
  }
  for (let i = 0; i < out.length; i++) out[i] *= level;
  return out;
}
