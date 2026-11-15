// Processing: tape (wow and flutter as a moving read head, saturation with pre- and de-emphasis, a head
// bump, hiss), a tape echo, the rotary speaker, tremolo, reverse, varispeed and a sample-rate crush. Each
// works on a stereo pair [L, R] in place where it can, and returns the pair.
import { SR, TAU, rng, biquad, readFrac, softclip, noise } from "./dsp.mjs";

export function tape(pair, o = {}, seed = 1) {
  const r = rng(seed), wow = o.wow ?? 0.0012, flutter = o.flutter ?? 0.00025, drive = o.drive ?? 1.4, hiss = o.hiss ?? 0.0012;
  const n = pair[0].length, wp = r() * TAU, fp = r() * TAU, wr = 0.55 + r() * 0.2, fr = 9 + r() * 3;
  return pair.map((x, ch) => {
    const y = new Float32Array(n), pre = biquad("highshelf", 3000, 0.7, 4), de = biquad("highshelf", 3000, 0.7, -4.5);
    const bump = biquad("peak", 90, 1.1, 2), lp = biquad("lp", o.top ?? 14000, 0.6), rr = rng(seed + ch * 31);
    const depth = 20 + 5 * ch;                                      // the two tracks of a tape are not quite aligned
    for (let i = 0; i < n; i++) {
      const t = i / SR, off = depth + SR * (wow * Math.sin(TAU * wr * t + wp) + flutter * Math.sin(TAU * fr * t + fp));
      const s = readFrac(x, i - off);
      y[i] = lp(bump(de(softclip(pre(s) * drive) / drive))) + rr.bi() * hiss;
    }
    return y;
  });
}

export function echo(pair, o = {}) {
  const t = o.time ?? 0.375, fb = o.feedback ?? 0.35, mix = o.mix ?? 0.25, n = pair[0].length, d = Math.round(t * SR);
  return pair.map((x, ch) => {
    const y = Float32Array.from(x), lp = biquad("lp", o.tone ?? 2800, 0.7), hp = biquad("hp", 200, 0.7);
    const buf = new Float32Array(n), dd = d + (ch ? Math.round(0.011 * SR) : 0);
    for (let i = 0; i < n; i++) { const fbk = i >= dd ? buf[i - dd] : 0; buf[i] = hp(lp(x[i] + softclip(fbk * fb))); y[i] += (i >= dd ? buf[i - dd] : 0) * mix; }
    return y;
  });
}

// rotary speaker: a horn and a drum turning at different speeds; amplitude and doppler per channel
export function leslie(mono, o = {}) {
  const n = mono.length, fast = o.fast, hornHz = fast ? 6.7 : 0.8, drumHz = fast ? 5.9 : 0.7;
  const lo = biquad("lp", 800, 0.7), hi = biquad("hp", 800, 0.7);
  const low = new Float32Array(n), high = new Float32Array(n);
  for (let i = 0; i < n; i++) { low[i] = lo(mono[i]); high[i] = hi(mono[i]); }
  const out = [new Float32Array(n), new Float32Array(n)];
  for (let i = 0; i < n; i++) {
    const t = i / SR, h = TAU * hornHz * t, d = TAU * drumHz * t + 1.1;
    for (let ch = 0; ch < 2; ch++) {
      const sgn = ch ? 1 : -1;
      const hs = readFrac(high, i - 40 - 18 * Math.sin(h + sgn)) * (0.65 + 0.35 * Math.cos(h + sgn * 1.4));
      const ls = readFrac(low, i - 40 - 6 * Math.sin(d + sgn)) * (0.8 + 0.2 * Math.cos(d + sgn * 1.4));
      out[ch][i] = hs + ls;
    }
  }
  return out;
}

export function tremolo(pair, hz, depth, phase = 0) {
  for (const x of pair) for (let i = 0; i < x.length; i++) x[i] *= 1 - depth * (0.5 + 0.5 * Math.sin(TAU * hz * i / SR + phase));
  return pair;
}
// auto-pan: the sound moves between the speakers at hz; depth 1 goes all the way
export function autopan(pair, hz, depth) {
  const n = pair[0].length, L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = depth * Math.sin(TAU * hz * i / SR), m = (pair[0][i] + pair[1][i]) * 0.5, s = (pair[0][i] - pair[1][i]) * 0.5;
    const a = (p + 1) * Math.PI / 4; L[i] = m * Math.cos(a) * 1.41 + s; R[i] = m * Math.sin(a) * 1.41 - s;
  }
  return [L, R];
}
// width: the side signal scaled (1 leaves it, 0 is mono, 1.5 wider)
export function width(pair, w) {
  for (let i = 0; i < pair[0].length; i++) { const m = (pair[0][i] + pair[1][i]) * 0.5, s = (pair[0][i] - pair[1][i]) * 0.5 * w; pair[0][i] = m + s; pair[1][i] = m - s; }
  return pair;
}
export const reverse = (buf) => Float32Array.from(buf).reverse();
// play at `rate` times speed (0.5: an octave down, twice as long), linear interpolation
export function varispeed(buf, rate) {
  const n = Math.floor(buf.length / rate), out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = readFrac(buf, i * rate);
  return out;
}
export function crush(buf, hold = 4, bits = 10) {
  const q = Math.pow(2, bits - 1);
  for (let i = 0; i < buf.length; i++) buf[i] = Math.round(buf[hold * Math.floor(i / hold)] * q) / q;
  return buf;
}
// a short swell of air and noise as a texture under a cue (the cold, the empty square)
export function airbed(n, seed, level = 0.01, colour = "pink", lpHz = 1800) {
  const r = rng(seed), a = noise(n, r, colour), lp = biquad("lp", lpHz, 0.6);
  for (let i = 0; i < n; i++) a[i] = lp(a[i]) * level;
  return a;
}
