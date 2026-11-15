// Radix-2 FFT and FFT convolution (overlap-add). The rooms are impulse responses we generate ourselves
// (ir.mjs); convolving a three-minute stem with a three-second room costs a few hundred milliseconds here.
export function fft(re, im, inverse = false) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (inverse ? 2 : -2) * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang), half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k, b = a + half;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}
export const nextPow2 = (n) => { let p = 1; while (p < n) p <<= 1; return p; };

// y = x * h, length x.length + h.length - 1. Blocks of the IR's length, FFT size twice that.
export function convolve(x, h) {
  const B = nextPow2(Math.max(h.length, 4096)), N = B * 2;
  const Hr = new Float64Array(N), Hi = new Float64Array(N);
  Hr.set(h); fft(Hr, Hi);
  const y = new Float32Array(x.length + h.length - 1);
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let s = 0; s < x.length; s += B) {
    re.fill(0); im.fill(0);
    const e = Math.min(x.length, s + B);
    for (let i = s; i < e; i++) re[i - s] = x[i];
    fft(re, im);
    for (let k = 0; k < N; k++) { const r = re[k] * Hr[k] - im[k] * Hi[k]; im[k] = re[k] * Hi[k] + im[k] * Hr[k]; re[k] = r; }
    fft(re, im, true);
    const lim = Math.min(N, y.length - s);
    for (let i = 0; i < lim; i++) y[s + i] += re[i];
  }
  return y;
}

// magnitude spectrum of a frame (Hann window), for the pitch tests and the measurements
export function spectrum(buf, start, n) {
  const N = nextPow2(n), re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < n && start + i < buf.length; i++) re[i] = buf[start + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1)));
  fft(re, im);
  const mag = new Float64Array(N / 2);
  for (let k = 0; k < N / 2; k++) mag[k] = Math.hypot(re[k], im[k]);
  return mag;
}
