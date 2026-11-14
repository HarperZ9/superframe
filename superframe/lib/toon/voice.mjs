// voice.mjs: the cast's sound, synthesised here, no samples. Physics first where it applies:
//   - mumble: source-filter speech. A glottal pulse train (Rosenberg-shaped pulses at the pitch) through three
//     two-pole formant resonators whose centres glide between vowel targets read off the line's own letters. It says
//     nothing; the caption carries the words, the mumble carries the rhythm and the deadpan fall. It also returns the
//     syllable timing, so the mouth on screen opens on the same envelope the ear hears.
//   - foley: a clay thump (damped low sine plus a soft click), a shredder grind (noise through a resonator, chopped by
//     the cutter rate), a fluorescent hum (120 Hz and harmonics, the mains twice over), and a bell sting for the PSA
//     (two-operator FM, the classic struck-metal ratio 1:1.4).
// Formant targets are adult averages from memory, moderate confidence; everything else is authored.
import { rngFrom } from '../seed.mjs';

export const RATE = 48000;
const VOWELS = { a: [730, 1090, 2440], e: [530, 1840, 2480], i: [390, 1990, 2550], o: [570, 840, 2410], u: [440, 1020, 2240], y: [390, 1990, 2550] };

function resonator(f, bw, rate) {
  const r = Math.exp(-Math.PI * bw / rate), c = 2 * r * Math.cos(2 * Math.PI * f / rate);
  let y1 = 0, y2 = 0;
  return { step(x, fNew) { if (fNew) { const cc = 2 * r * Math.cos(2 * Math.PI * fNew / rate); this.c = cc; } const y = (1 - r) * x + (this.c ?? c) * y1 - r * r * y2; y2 = y1; y1 = y; return y; } };
}

// Syllables: one per vowel group of the text, with the consonant run before it.
export function syllables(text) {
  const out = [], s = text.toLowerCase().replace(/[^a-z .,!?]/g, '');
  const re = /([^aeiouy .,!?]*)([aeiouy]+)|([.,!?])/g; let m;
  while ((m = re.exec(s))) { if (m[3]) out.push({ pause: m[3] === ',' ? 0.18 : 0.32 }); else out.push({ cons: m[1].length, vowel: m[2][0] }); }
  return out;
}

// Mumble a line. o: { f0 (Hz), formant (scale; >1 smaller vocal tract), speed (syllables/s), fall (octaves over the
// line), seed }. Returns { pcm: Float32Array, syl: [{ t0, t1 }], seconds }.
export function mumble(text, { f0 = 110, formant = 1, speed = 4.2, fall = 0.35, seed = 'mumble', rate = RATE, gain = 0.5 } = {}) {
  const S = syllables(text), r = rngFrom(`${seed}/${text}`), timeline = []; let t = 0.05;
  for (const s of S) { if (s.pause) { t += s.pause; continue; } const d = (0.7 + r() * 0.5) / speed; timeline.push({ t0: t, t1: t + d, cons: s.cons, v: VOWELS[s.vowel] }); t += d; }
  const seconds = t + 0.15, n = Math.ceil(seconds * rate), pcm = new Float32Array(n), R = [0, 1, 2].map(k => resonator(500, [80, 100, 140][k], rate));
  let phase = 0, k = 0;
  for (let i = 0; i < n; i++) {
    const tt = i / rate; while (k < timeline.length - 1 && tt > timeline[k].t1) k++;
    const sy = timeline[k], inS = tt >= sy.t0 && tt <= sy.t1, u = inS ? (tt - sy.t0) / (sy.t1 - sy.t0) : 1;
    const env = inS ? Math.sin(Math.PI * Math.min(1, u * 1.15)) ** 0.6 : 0, pitch = f0 * 2 ** (-fall * tt / seconds) * (1 + 0.02 * Math.sin(tt * 31));
    phase += pitch / rate; if (phase >= 1) phase -= 1;
    const glot = phase < 0.4 ? 0.5 * (1 - Math.cos(Math.PI * phase / 0.4)) : phase < 0.56 ? Math.cos(Math.PI * (phase - 0.4) / 0.32) : 0;
    const noise = (r() * 2 - 1) * (inS && u < 0.18 && sy.cons ? 0.5 : 0.02);
    const nxt = timeline[Math.min(timeline.length - 1, k + 1)].v, F = sy.v.map((f, j) => (f + (nxt[j] - f) * Math.max(0, u - 0.7) / 0.3 * 0.5) * formant);
    const x = (glot - 0.3) * env + noise * env;
    pcm[i] = gain * (R[0].step(x, F[0]) * 1.0 + R[1].step(x, F[1]) * 0.6 + R[2].step(x, F[2]) * 0.3);
  }
  let peak = 0; for (const v of pcm) peak = Math.max(peak, Math.abs(v));
  if (peak > 0) for (let i = 0; i < n; i++) pcm[i] *= gain / peak;          // each line at the same peak level
  return { pcm, syl: timeline.map(({ t0, t1 }) => ({ t0, t1 })), seconds };
}
// Mouth opening 0..1 at time t from a syllable timeline (the lip-sync curve).
export function mouthAt(syl, t, open = 0.45) {
  for (const s of syl) if (t >= s.t0 && t <= s.t1) return open * Math.sin(Math.PI * (t - s.t0) / (s.t1 - s.t0));
  return 0;
}

// ---- foley; each returns a Float32Array at RATE
export function thump(seconds = 0.25, { f = 90, seed = 'thump' } = {}) {
  const n = Math.ceil(seconds * RATE), x = new Float32Array(n), r = rngFrom(seed);
  for (let i = 0; i < n; i++) { const t = i / RATE; x[i] = 0.6 * Math.sin(2 * Math.PI * f * t * (1 - t)) * Math.exp(-t * 22) + (i < 200 ? (r() * 2 - 1) * 0.3 * (1 - i / 200) : 0); }
  return x;
}
export function grind(seconds = 1, { seed = 'grind', cut = 23 } = {}) {
  const n = Math.ceil(seconds * RATE), x = new Float32Array(n), r = rngFrom(seed), a = resonator(900, 600, RATE), b = resonator(2600, 900, RATE);
  for (let i = 0; i < n; i++) { const t = i / RATE, chop = 0.55 + 0.45 * Math.sign(Math.sin(2 * Math.PI * cut * t)), w = r() * 2 - 1, edge = Math.min(1, t * 30, (seconds - t) * 20);
    x[i] = edge * chop * (a.step(w) * 1.4 + b.step(w) * 0.8 + 0.25 * Math.sin(2 * Math.PI * 58 * t)); }
  return x;
}
export function hum(seconds, { level = 0.03, seed = 'hum' } = {}) {
  const n = Math.ceil(seconds * RATE), x = new Float32Array(n), r = rngFrom(seed);
  for (let i = 0; i < n; i++) { const t = i / RATE; x[i] = level * (Math.sin(2 * Math.PI * 120 * t) + 0.5 * Math.sin(2 * Math.PI * 240 * t) + 0.25 * Math.sin(2 * Math.PI * 360 * t) + 0.2 * (r() * 2 - 1)); }
  return x;
}
export function bell(freq = 660, seconds = 1.2, { ratio = 1.4, index = 3 } = {}) {
  const n = Math.ceil(seconds * RATE), x = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / RATE, e = Math.exp(-t * 3.2), m = index * e * Math.sin(2 * Math.PI * freq * ratio * t); x[i] = 0.4 * e * Math.sin(2 * Math.PI * freq * t + m); }
  return x;
}

// Mix a clip into a bus at time t (seconds) with gain g.
export function mixInto(bus, clip, t, g = 1) { const o = Math.round(t * RATE); for (let i = 0; i < clip.length && o + i < bus.length; i++) if (o + i >= 0) bus[o + i] += clip[i] * g; return bus; }
export const limit = bus => { for (let i = 0; i < bus.length; i++) bus[i] = Math.tanh(bus[i] * 1.2) / Math.tanh(1.2); return bus; };
