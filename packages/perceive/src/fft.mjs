// SPDX-License-Identifier: FSL-1.1-MIT
// SPDX-FileCopyrightText: 2026 Zain Dana Harper
/* perceive/fft.mjs: the packages' one FFT (src/signal.js) for ES module callers, in Node and in a browser.
   signal.js is a classic script that also works with require; importing it for its side effect sets
   globalThis.Perceive in both cases, so this file re-exports from there instead of copying the butterfly.
     fft(re, im)    in-place forward radix-2 DFT, unscaled (X_k = sum x_j e^(-2 pi i jk / n)); n a power of two
     ifft(re, im)   in-place inverse, scaled by 1 / n, built on fft by conjugation */
import "./signal.js";

const P = globalThis.Perceive;
export const fft = P.fft;
export function ifft(re, im) {
  const n = re.length;
  for (let i = 0; i < n; i++) im[i] = -im[i];
  P.fft(re, im);
  for (let i = 0; i < n; i++) { re[i] /= n; im[i] = -im[i] / n; }
}
