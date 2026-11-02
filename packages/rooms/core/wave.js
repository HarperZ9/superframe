// SPDX-License-Identifier: FSL-1.1-MIT
// ======================================================================= Wave view
// Exit phase comes from the optical path of the same rays. Far field by FFT of the pupil, padded.
export function fft1(re, im, n, st, off, tw) {
  for (let i = 1, j = 0; i < n; i++) {
    let b = n >> 1;
    for (; j & b; b >>= 1) j ^= b;
    j ^= b;
    if (i < j) {
      const a = off + i * st,
        c = off + j * st;
      let t = re[a];
      re[a] = re[c];
      re[c] = t;
      t = im[a];
      im[a] = im[c];
      im[c] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const h = len >> 1,
      step = n / len;
    for (let i = 0; i < n; i += len)
      for (let j = 0; j < h; j++) {
        const w = j * step,
          cr = tw[2 * w],
          ci = tw[2 * w + 1],
          a = off + (i + j) * st,
          b = off + (i + j + h) * st,
          xr = re[b] * cr - im[b] * ci,
          xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
      }
  }
}
export function fft2(re, im, N) {
  const tw = new Float64Array(2 * N);
  for (let i = 0; i < N; i++) {
    tw[2 * i] = Math.cos((-2 * Math.PI * i) / N);
    tw[2 * i + 1] = Math.sin((-2 * Math.PI * i) / N);
  }
  for (let y = 0; y < N; y++) fft1(re, im, N, 1, y * N, tw);
  for (let x = 0; x < N; x++) fft1(re, im, N, N, x, tw);
}
