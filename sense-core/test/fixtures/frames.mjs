// Deterministic synthetic RGBA frames for parity tests. No Math.random.
// Each returns { data: Uint8ClampedArray(w*h*4), width, height } with w=h=32, alpha=255.

const W = 32, H = 32;

// gradient: R=G=B ramped by Math.round(x/(w-1)*255); alpha=255.
export function gradient() {
  const w = W, h = H;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const v = Math.round(x / (w - 1) * 255);
      data[o] = v; data[o + 1] = v; data[o + 2] = v; data[o + 3] = 255;
    }
  }
  return { data, width: w, height: h };
}

// checker: ((x>>3 ^ y>>3)&1) ? 255 : 0 for all channels; alpha=255.
export function checker() {
  const w = W, h = H;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const v = ((x >> 3 ^ y >> 3) & 1) ? 255 : 0;
      data[o] = v; data[o + 1] = v; data[o + 2] = v; data[o + 3] = 255;
    }
  }
  return { data, width: w, height: h };
}

// noisy: fixed LCG (seed=12345); seed=(seed*1103515245+12345)&0x7fffffff; byte=seed%256; alpha=255.
export function noisy() {
  const w = W, h = H;
  const data = new Uint8ClampedArray(w * h * 4);
  let seed = 12345;
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    seed = (seed * 1103515245 + 12345) & 0x7fffffff; data[o]     = seed % 256;
    seed = (seed * 1103515245 + 12345) & 0x7fffffff; data[o + 1] = seed % 256;
    seed = (seed * 1103515245 + 12345) & 0x7fffffff; data[o + 2] = seed % 256;
    data[o + 3] = 255;
  }
  return { data, width: w, height: h };
}
