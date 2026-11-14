// Small DSP kit for the instruments. Plain Float32Array work, so the same code renders offline in Node
// (files, tests) and in a browser worker (a player).
// Everything random goes through a seeded generator: one seed, one render, bit for bit.
export const SR = 44100;
export const TAU = Math.PI * 2;
export const dbToGain = (db) => Math.pow(10, db / 20);
export const gainToDb = (g) => 20 * Math.log10(Math.max(1e-12, Math.abs(g)));
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;

// mulberry32: small, fast, good enough for audio noise; deterministic from a 32-bit seed
export function rng(seed) {
  let a = (seed >>> 0) || 0x9e3779b9;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0; let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.bi = () => next() * 2 - 1;
  next.gauss = () => { let s = 0; for (let i = 0; i < 4; i++) s += next(); return (s - 2) * 1.732; };
  next.pick = (xs) => xs[Math.floor(next() * xs.length)];
  return next;
}
export function seedOf(...parts) {
  let h = 0x811c9dc5;
  for (const ch of parts.join("|")) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

// RBJ biquad, direct form I. type: lp hp bp notch peak lowshelf highshelf
export function biquadCoefs(type, f, q = 0.707, gainDb = 0, sr = SR) {
  const w = TAU * clamp(f, 5, sr * 0.49) / sr, cw = Math.cos(w), sw = Math.sin(w), al = sw / (2 * q);
  const A = Math.pow(10, gainDb / 40);
  let b0, b1, b2, a0, a1, a2;
  if (type === "lp") { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
  else if (type === "hp") { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
  else if (type === "bp") { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
  else if (type === "notch") { b0 = 1; b1 = -2 * cw; b2 = 1; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
  else if (type === "peak") { b0 = 1 + al * A; b1 = -2 * cw; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cw; a2 = 1 - al / A; }
  else {
    const s = 2 * Math.sqrt(A) * al, p = type === "lowshelf" ? 1 : -1;
    b0 = A * ((A + 1) - p * (A - 1) * cw + s); b1 = 2 * p * A * ((A - 1) - p * (A + 1) * cw); b2 = A * ((A + 1) - p * (A - 1) * cw - s);
    a0 = (A + 1) + p * (A - 1) * cw + s; a1 = -2 * p * ((A - 1) + p * (A + 1) * cw); a2 = (A + 1) + p * (A - 1) * cw - s;
  }
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}
// a filter keeps its state when retuned (tick.set), so a moving cutoff does not click
export function biquad(type, f, q = 0.707, gainDb = 0, sr = SR) {
  let c = biquadCoefs(type, f, q, gainDb, sr), x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const tick = (x) => { const y = c[0] * x + c[1] * x1 + c[2] * x2 - c[3] * y1 - c[4] * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
  tick.run = (buf) => { for (let i = 0; i < buf.length; i++) buf[i] = tick(buf[i]); return buf; };
  tick.set = (f2, q2 = q, g2 = gainDb) => { c = biquadCoefs(type, f2, q2, g2, sr); };
  tick.reset = () => { x1 = x2 = y1 = y2 = 0; };
  return tick;
}
export const filter = (buf, type, f, q, g) => biquad(type, f, q, g).run(buf);

// one-pole lowpass (coefficient from a cutoff) and a DC blocker
export function onepole(f, sr = SR) {
  const a = Math.exp(-TAU * f / sr); let y = 0;
  const tick = (x) => (y = x * (1 - a) + y * a);
  tick.run = (buf) => { for (let i = 0; i < buf.length; i++) buf[i] = tick(buf[i]); return buf; };
  return tick;
}
export function dcblock(buf, r = 0.995) { let x1 = 0, y1 = 0; for (let i = 0; i < buf.length; i++) { const y = buf[i] - x1 + r * y1; x1 = buf[i]; y1 = y; buf[i] = y; } return buf; }

// envelopes: an attack and an exponential decay in seconds to -60 dB, applied in place
export function adExp(buf, attack, t60, sr = SR) {
  const na = Math.max(1, Math.round(attack * sr)), k = Math.exp(-6.9078 / Math.max(1, t60 * sr));
  let g = 1;
  for (let i = 0; i < buf.length; i++) { const a = i < na ? i / na : 1; if (i >= na) g *= k; buf[i] *= a * g; }
  return buf;
}
export function fadeEdges(buf, inS = 0.005, outS = 0.02, sr = SR) {
  const ni = Math.min(buf.length, Math.round(inS * sr)), no = Math.min(buf.length, Math.round(outS * sr));
  for (let i = 0; i < ni; i++) buf[i] *= i / ni;
  for (let i = 0; i < no; i++) buf[buf.length - 1 - i] *= i / no;
  return buf;
}

export function noise(n, r, color = "white") {
  const out = new Float32Array(n);
  if (color === "white") { for (let i = 0; i < n; i++) out[i] = r.bi(); return out; }
  // pink by Kellet's economy filter; brown by a leaky integrator
  let b0 = 0, b1 = 0, b2 = 0, br = 0;
  for (let i = 0; i < n; i++) {
    const w = r.bi();
    if (color === "pink") { b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; out[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; }
    else { br = 0.997 * br + w * 0.05; out[i] = br * 1.5; }
  }
  return out;
}

// mix src into dst at a sample offset with gain; stereo pan by equal power (-1 left, +1 right)
export function addAt(dst, src, at, gain = 1) {
  const n = Math.min(src.length, dst.length - at);
  for (let i = Math.max(0, -at); i < n; i++) dst[at + i] += src[i] * gain;
}
export const panGains = (p) => { const a = (clamp(p, -1, 1) + 1) * Math.PI / 4; return [Math.cos(a), Math.sin(a)]; };
// a mono source is panned at equal power; a stereo pair [l, r] keeps its own image and `pan` balances it
export function addStereo(L, R, src, at, gain = 1, pan = 0) {
  if (Array.isArray(src)) { const bl = Math.min(1, 1 - pan), br = Math.min(1, 1 + pan); addAt(L, src[0], at, gain * bl); addAt(R, src[1], at, gain * br); return; }
  const [gl, gr] = panGains(pan); addAt(L, src, at, gain * gl); addAt(R, src, at, gain * gr);
}

export const peak = (...bufs) => { let p = 0; for (const b of bufs) for (let i = 0; i < b.length; i++) { const a = Math.abs(b[i]); if (a > p) p = a; } return p; };
export const rms = (b, a = 0, e = b.length) => { let s = 0; for (let i = a; i < e; i++) s += b[i] * b[i]; return Math.sqrt(s / Math.max(1, e - a)); };
export function scale(buf, g) { for (let i = 0; i < buf.length; i++) buf[i] *= g; return buf; }
export const softclip = (x) => (x > 1.5 ? 1 : x < -1.5 ? -1 : x - (4 / 27) * x * x * x);

// fractional delay line with linear interpolation (wow and flutter, chorus, doppler)
export function readFrac(buf, pos) {
  const i = Math.floor(pos), f = pos - i;
  if (i < 0 || i + 1 >= buf.length) return 0;
  return buf[i] * (1 - f) + buf[i + 1] * f;
}
