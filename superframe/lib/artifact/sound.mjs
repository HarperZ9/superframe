// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// sound.mjs: the elements as heard. The frame is read as a score, the way a spectrogram is read backwards: x is
// time (left to right over `seconds`), y is pitch (top is high), split into log-spaced bands from lo to hi. Each
// band is one partial whose loudness at each moment is the sound-weighted field's mean over that band's rows in
// that column. Phases come from the recipe seed, never from a weight. Gain is fixed and the limiter is a per-sample
// tanh: there is no peak normalisation, so an edit to one element changes the sound only inside its own time window
// and its own bands. Left and right take alternate bands, a slight spread that is still local.
import { xmur3, Mulberry32 } from '../../../substrate/lib/vendor/superstack.mjs';
import { wavBytes } from '../export.mjs';
import { fieldFor } from './common.mjs';

export function bandsOf(r) {
  const { bands, lo, hi } = r.sound;
  return Array.from({ length: bands }, (_, b) => lo * (hi / lo) ** (b / (bands - 1)));
}

export function sound(r, layers) {
  const [w, h] = r.sim, { seconds, rate, bands } = r.sound, n = Math.round(seconds * rate), F = fieldFor(r, layers, 'sound'), freqs = bandsOf(r);
  // envelope[b][col]: the mean of rows that fall in band b (row 0 = highest band)
  const env = freqs.map((_, b) => {
    const r0 = Math.floor((bands - 1 - b) * h / bands), r1 = Math.max(r0 + 1, Math.floor((bands - b) * h / bands)), E = new Float32Array(w);
    for (let x = 0; x < w; x++) { let s = 0; for (let y = r0; y < r1; y++) s += F[y * w + x]; E[x] = s / (r1 - r0); }
    return E;
  });
  const m = new Mulberry32(xmur3(`${r.seed}/sound/phase`)), phase = freqs.map(() => m.nextFloat() * 2 * Math.PI);
  const L = new Float32Array(n), R = new Float32Array(n), gain = 2.2 / Math.sqrt(bands) * r.media.sound, tilt = freqs.map(f => (220 / Math.max(220, f)) ** 0.35);
  for (let b = 0; b < bands; b++) {
    const E = env[b], dphi = 2 * Math.PI * freqs[b] / rate, out = b % 2 ? R : L, other = b % 2 ? L : R, g = gain * tilt[b];
    let ph = phase[b];
    for (let i = 0; i < n; i++) {
      const xf = Math.min(w - 1.0001, Math.max(0, (i + 0.5) / n * w - 0.5)), x = xf | 0, f = xf - x, a = E[x] + (E[x + 1] - E[x]) * f;
      if (a > 0) { const s = g * a * Math.sin(ph); out[i] += 0.8 * s; other[i] += 0.2 * s; }
      ph += dphi; if (ph > 6.283185307179586) ph -= 6.283185307179586;
    }
  }
  for (let i = 0; i < n; i++) { L[i] = Math.tanh(L[i]); R[i] = Math.tanh(R[i]); }
  return { rate, channels: [L, R], env, freqs, seconds, bytes: () => wavBytes({ rate, channels: [L, R] }) };
}

// a vibration pattern for touch (Web Vibration API style: alternating on and off milliseconds), from the loudness
// over time in 100 ms steps. The Pacinian band peaks near 250 Hz, so a phone motor reads pulse length as strength.
export function tactile(snd, stepMs = 100) {
  const { channels: [L, R], rate } = snd, per = Math.round(rate * stepMs / 1000), pattern = [];
  for (let i = 0; i + per <= L.length; i += per) {
    let s = 0; for (let k = i; k < i + per; k++) s += L[k] * L[k] + R[k] * R[k];
    const on = Math.round(Math.min(1, Math.sqrt(s / per) * 3) * stepMs); pattern.push(on, stepMs - on);
  }
  return { schema: 'superframe.tactile/1', stepMs, pattern, doc: 'alternating on/off milliseconds; pulse length follows loudness over time' };
}
