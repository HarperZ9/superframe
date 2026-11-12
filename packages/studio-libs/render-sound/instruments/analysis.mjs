// Measurements for the tests and the render reports: pitch, loudness (ITU-R BS.1770-4 integrated LUFS
// with K-weighting and the two gates), true peak by 4x oversampling, clipped samples, and the loop seam.
import { SR, biquad } from "./dsp.mjs";

// fundamental by normalised autocorrelation (YIN's difference function, cumulative mean normalised),
// with parabolic interpolation. Returns Hz, or 0 when nothing periodic is found.
export function pitchOf(buf, start = 0, n = 4096, fmin = 30, fmax = 2000, sr = SR) {
  const maxLag = Math.min(Math.floor(sr / fmin), Math.floor(n / 2)), minLag = Math.floor(sr / fmax);
  const d = new Float64Array(maxLag + 2);
  for (let tau = 1; tau <= maxLag + 1; tau++) {
    let s = 0;
    for (let i = 0; i < n - maxLag - 1; i++) { const x = buf[start + i] - buf[start + i + tau]; s += x * x; }
    d[tau] = s;
  }
  let run = 0; const cm = new Float64Array(maxLag + 2); cm[0] = 1;
  for (let tau = 1; tau <= maxLag + 1; tau++) { run += d[tau]; cm[tau] = d[tau] * tau / (run || 1); }
  let best = -1;
  for (let tau = minLag; tau <= maxLag; tau++) if (cm[tau] < 0.15 && cm[tau] <= cm[tau + 1]) { best = tau; break; }
  if (best < 0) { let m = Infinity; for (let tau = minLag; tau <= maxLag; tau++) if (cm[tau] < m) { m = cm[tau]; best = tau; } }
  const a = cm[best - 1], b = cm[best], c = cm[best + 1], den = a - 2 * b + c;
  const t = best + (den ? 0.5 * (a - c) / den : 0);
  return t > 0 ? sr / t : 0;
}
export const centsOff = (f, target) => 1200 * Math.log2(f / target);

// K-weighting: the BS.1770 head shelf (+4 dB above about 1.5 kHz) and the RLB high-pass at 38 Hz
function kweight(x, sr) {
  const shelf = biquad("highshelf", 1681.97, 0.7072, 3.99984, sr), hp = biquad("hp", 38.135, 0.5003, 0, sr);
  const y = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) y[i] = hp(shelf(x[i]));
  return y;
}
function blockPowers(chs, sr, win, hop) {
  const kw = chs.map((c) => kweight(c, sr)), W = Math.round(win * sr), H = Math.round(hop * sr), out = [];
  for (let s = 0; s + W <= kw[0].length; s += H) {
    let z = 0;
    for (const c of kw) { let e = 0; for (let i = s; i < s + W; i++) e += c[i] * c[i]; z += e / W; }
    out.push(z);
  }
  return out;
}
const lufsOf = (z) => -0.691 + 10 * Math.log10(Math.max(1e-20, z));
export function loudness(chs, sr = SR) {
  const z = blockPowers(chs, sr, 0.4, 0.1);
  const abs = z.filter((p) => lufsOf(p) > -70);
  if (!abs.length) return { integrated: -Infinity, shortMax: -Infinity, momentaryMax: -Infinity };
  const rel = lufsOf(abs.reduce((a, b) => a + b, 0) / abs.length) - 10;
  const gated = abs.filter((p) => lufsOf(p) > rel);
  const st = blockPowers(chs, sr, 3, 1);
  return {
    integrated: lufsOf(gated.reduce((a, b) => a + b, 0) / gated.length),
    momentaryMax: lufsOf(Math.max(...z)),
    shortMax: st.length ? lufsOf(Math.max(...st)) : lufsOf(Math.max(...z)),
  };
}

// true peak: 4x oversampling with a windowed-sinc interpolator (BS.1770 Annex 2 in spirit)
export function truePeak(chs) {
  const taps = 12, K = [];
  for (let ph = 1; ph < 4; ph++) {
    const k = [];
    for (let j = -taps; j <= taps; j++) { const x = j - ph / 4; const w = 0.5 + 0.5 * Math.cos(Math.PI * x / (taps + 1)); k.push(x === 0 ? 1 : (Math.sin(Math.PI * x) / (Math.PI * x)) * w); }
    K.push(k);
  }
  let pk = 0;
  for (const c of chs) for (let i = taps; i < c.length - taps; i++) {
    pk = Math.max(pk, Math.abs(c[i]));
    if (Math.abs(c[i]) < 0.25) continue;
    for (const k of K) { let s = 0; for (let j = 0; j < k.length; j++) s += c[i + j - taps] * k[j]; pk = Math.max(pk, Math.abs(s)); }
  }
  return 20 * Math.log10(Math.max(1e-9, pk));
}
export const clipped = (chs, at = 0.9999) => chs.reduce((n, c) => { for (let i = 0; i < c.length; i++) if (Math.abs(c[i]) >= at) n++; return n; }, 0);

// the loop seam: the jump from the last sample to the first, against the signal's typical step, and the
// level either side of the seam (50 ms). A clean loop has a jump ratio near 1 and a level change near 0 dB.
export function seam(chs, sr = SR) {
  const W = Math.round(0.05 * sr);
  let jump = 0, step = 0, cnt = 0, dbs = [];
  for (const c of chs) {
    jump = Math.max(jump, Math.abs(c[0] - c[c.length - 1]));
    for (let i = 1; i < c.length; i += 7) { step += Math.abs(c[i] - c[i - 1]); cnt++; }
    const e = (a, b) => { let s = 0; for (let i = a; i < b; i++) s += c[i] * c[i]; return Math.sqrt(s / (b - a)) + 1e-9; };
    dbs.push(20 * Math.log10(e(0, W) / e(c.length - W, c.length)));
  }
  const typ = step / Math.max(1, cnt);
  return { jumpRatio: jump / Math.max(1e-9, typ), levelDb: Math.max(...dbs.map(Math.abs)) };
}
