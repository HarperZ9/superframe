// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* perceive/signal: tones, a Butterworth low-pass, the heterodyne, an FFT peak finder, a synthetic bat call,
   and vibration patterns. Heterodyning is the bat detector's method: multiply by a local oscillator at f_LO
   and low-pass, leaving the difference |f - f_LO| in hearing. */
(function (g) {
  "use strict";
  const P = (g.Perceive = g.Perceive || {});

  P.rng = (seed) => { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
  P.tone = (f, fs, n, phase = 0) => { const y = new Float64Array(n); for (let i = 0; i < n; i++) y[i] = Math.sin(2 * Math.PI * f * i / fs + phase); return y; };

  /* One RBJ biquad low-pass section, run forward. */
  function biquad(x, fs, fc, Q) {
    const w = 2 * Math.PI * fc / fs, al = Math.sin(w) / (2 * Q), cw = Math.cos(w), a0 = 1 + al;
    const b0 = (1 - cw) / 2 / a0, b1 = (1 - cw) / a0, b2 = b0, a1 = -2 * cw / a0, a2 = (1 - al) / a0;
    const y = new Float64Array(x.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) {
      const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
    }
    return y;
  }
  /* Fourth-order Butterworth: two sections with Q 0.5412 and 1.3066. */
  P.lowpass = (x, fs, fc) => biquad(biquad(x, fs, fc, 0.5411961), fs, fc, 1.3065630);
  P.heterodyne = (x, fs, fLO, cutoff = 15000) => {
    const m = new Float64Array(x.length);
    for (let i = 0; i < x.length; i++) m[i] = 2 * x[i] * Math.cos(2 * Math.PI * fLO * i / fs);
    return P.lowpass(m, fs, cutoff);
  };
  P.decimate = (x, k) => { const y = new Float64Array(Math.floor(x.length / k)); for (let i = 0; i < y.length; i++) y[i] = x[i * k]; return y; };

  /* In-place radix-2 FFT on re, im (length a power of two): X_k = sum_j x_j e^(-2 pi i j k / n), unscaled.
     Twiddles come from one table of cos and sin per n (cached), not from a running product, so the error
     stays near the exact DFT's rounding (tests/fft-parity.test.mjs measures it). This is the FFT the
     packages share: field's ops call it, and src/fft.mjs exports it to ES modules. */
  const TWIDDLES = new Map();
  const twiddles = (n) => {
    let t = TWIDDLES.get(n);
    if (!t) {
      t = { cos: new Float64Array(n >> 1), sin: new Float64Array(n >> 1) };
      for (let i = 0; i < n >> 1; i++) { t.cos[i] = Math.cos(-2 * Math.PI * i / n); t.sin[i] = Math.sin(-2 * Math.PI * i / n); }
      if (TWIDDLES.size > 32) TWIDDLES.clear();
      TWIDDLES.set(n, t);
    }
    return t;
  };
  P.fft = (re, im) => {
    const n = re.length;
    if (n & (n - 1)) throw new Error("fft: length " + n + " is not a power of two");
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
    }
    const { cos, sin } = twiddles(n);
    for (let len = 2; len <= n; len <<= 1) {
      const half = len >> 1, step = n / len;
      for (let i = 0; i < n; i += len) {
        for (let k = 0; k < half; k++) {
          const c = cos[k * step], d = sin[k * step], a = i + k, b = a + half;
          const tr = re[b] * c - im[b] * d, ti = re[b] * d + im[b] * c;
          re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        }
      }
    }
  };
  /* Magnitude spectrum with a Hann window, zero-padded to a power of two. */
  P.spectrum = (x) => {
    let n = 1; while (n < x.length) n <<= 1;
    const re = new Float64Array(n), im = new Float64Array(n);
    for (let i = 0; i < x.length; i++) re[i] = x[i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (x.length - 1)));
    P.fft(re, im);
    const mag = new Float64Array(n / 2);
    for (let i = 0; i < n / 2; i++) mag[i] = Math.hypot(re[i], im[i]);
    return { mag, n };
  };
  /* Frequency of the strongest bin, refined by a parabola through the log magnitudes around it. */
  P.peakFrequency = (x, fs) => {
    const { mag, n } = P.spectrum(x);
    let k = 1;
    for (let i = 2; i < mag.length - 1; i++) if (mag[i] > mag[k]) k = i;
    const a = Math.log(mag[k - 1] + 1e-300), b = Math.log(mag[k] + 1e-300), c = Math.log(mag[k + 1] + 1e-300);
    const d = (a - c) / (2 * (a - 2 * b + c) || 1);
    return ((k + d) * fs) / n;
  };

  /* A synthetic frequency-modulated bat call: a downward sweep f0 to f1, then a quasi-constant tail at f1. */
  P.batCall = (fs, o = {}) => {
    const f0 = o.f0 || 75000, f1 = o.f1 || 45000, ts = (o.sweepMs || 3) / 1000, tc = (o.cfMs || 4) / 1000;
    const n = Math.round((ts + tc) * fs), y = new Float64Array(n);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / fs, f = t < ts ? f0 + (f1 - f0) * (t / ts) : f1;
      ph += 2 * Math.PI * f / fs;
      const env = Math.sin(Math.PI * Math.min(1, t / (ts + tc))) ** 0.5;
      y[i] = env * Math.sin(ph);
    }
    return y;
  };

  /* A vibration pattern for navigator.vibrate: one pulse per value in [0, 1], length scaled, then a gap. */
  P.haptic = (values, o = {}) => {
    const pulse = o.pulseMs || 80, gap = o.gapMs || 40, out = [];
    for (const v of values) { out.push(Math.max(1, Math.round(4 + Math.max(0, Math.min(1, v)) * pulse)), gap); }
    return out;
  };

  if (typeof module !== "undefined" && module.exports) module.exports = P;
})(typeof globalThis !== "undefined" ? globalThis : this);
