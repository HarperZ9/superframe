// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// gif.mjs: a GIF89a writer for indexed pixel art (our own code; the format is the CompuServe GIF89a specification).
// One global colour table, a NETSCAPE2.0 loop block, and per frame: a graphic control block with the delay, then the
// changed rectangle only, with unchanged pixels sent as the transparent index (disposal 1, keep the previous frame).
// Upscaling is by whole numbers only, each pixel to a k x k block, so the pixels stay square and hard.
//
//   encodeGIF({ w, h, palette: [[r,g,b]...], frames: [Uint8Array(w*h)], delay (1/100 s), scale, loop })
//   lzw(indices, minCode)  -> bytes (exported for the round-trip test)
export function encodeGIF({ w, h, palette, frames, delay = 8, scale = 1, loop = 0 }) {
  if (palette.length > 255) throw new Error('gif: at most 255 colours (one index is kept for transparency)');
  const W = w * scale, H = h * scale, bits = Math.max(2, Math.ceil(Math.log2(palette.length + 1))), size = 1 << bits, tr = palette.length;
  const out = new Bytes();
  out.str('GIF89a'); out.u16(W); out.u16(H); out.u8(0x80 | ((bits - 1) << 4) | (bits - 1)); out.u8(0); out.u8(0);
  for (let i = 0; i < size; i++) { const c = palette[i] ?? [0, 0, 0]; out.u8(c[0]); out.u8(c[1]); out.u8(c[2]); }
  out.u8(0x21); out.u8(0xff); out.u8(11); out.str('NETSCAPE2.0'); out.u8(3); out.u8(1); out.u16(loop); out.u8(0);
  let prev = null;
  for (const f of frames) {
    const big = scale === 1 ? f : upscale(f, w, h, scale), box = prev ? changed(prev, big, W, H) : [0, 0, W, H];
    const [x0, y0, x1, y1] = box ?? [0, 0, 1, 1], bw = x1 - x0, bh = y1 - y0, px = new Uint8Array(bw * bh);
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { const i = (y + y0) * W + x + x0; px[y * bw + x] = prev && prev[i] === big[i] ? tr : big[i]; }
    out.u8(0x21); out.u8(0xf9); out.u8(4); out.u8((1 << 2) | 1); out.u16(delay); out.u8(tr); out.u8(0);
    out.u8(0x2c); out.u16(x0); out.u16(y0); out.u16(bw); out.u16(bh); out.u8(0);
    out.u8(bits); const data = lzw(px, bits);
    for (let i = 0; i < data.length; i += 255) { const n = Math.min(255, data.length - i); out.u8(n); out.bytes(data.subarray(i, i + n)); }
    out.u8(0); prev = big;
  }
  out.u8(0x3b);
  return out.done();
}

function upscale(f, w, h, k) {
  const W = w * k, o = new Uint8Array(W * h * k);
  for (let y = 0; y < h * k; y++) { const sy = (y / k) | 0; for (let x = 0; x < W; x++) o[y * W + x] = f[sy * w + ((x / k) | 0)]; }
  return o;
}
function changed(a, b, W, H) {
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (a[y * W + x] !== b[y * W + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : [x0, y0, x1 + 1, y1 + 1];
}

// variable-width LZW as GIF uses it: clear code, end code, codes grow to 12 bits, then a clear resets the table
export function lzw(px, minCode) {
  const clear = 1 << minCode, end = clear + 1, out = [];
  let width = minCode + 1, next = end + 1, dict = new Map(), acc = 0, nb = 0;
  const emit = c => { acc |= c << nb; nb += width; while (nb >= 8) { out.push(acc & 255); acc >>>= 8; nb -= 8; } };
  emit(clear);
  let cur = px.length ? px[0] : 0;
  for (let i = 1; i < px.length; i++) {
    const k = px[i], key = cur * 4096 + k, hit = dict.get(key);
    if (hit !== undefined) { cur = hit; continue; }
    emit(cur);
    if (next < 4096) { dict.set(key, next++); if (next > (1 << width) && width < 12) width++; }
    else { emit(clear); dict = new Map(); next = end + 1; width = minCode + 1; }
    cur = k;
  }
  emit(cur); emit(end);
  if (nb > 0) out.push(acc & 255);
  return Uint8Array.from(out);
}

class Bytes {
  constructor() { this.buf = new Uint8Array(1 << 20); this.n = 0; }
  grow(k) { if (this.n + k <= this.buf.length) return; const b = new Uint8Array(Math.max(this.buf.length * 2, this.n + k)); b.set(this.buf.subarray(0, this.n)); this.buf = b; }
  u8(v) { this.grow(1); this.buf[this.n++] = v & 255; }
  u16(v) { this.u8(v); this.u8(v >> 8); }
  str(s) { for (const ch of s) this.u8(ch.charCodeAt(0)); }
  bytes(a) { this.grow(a.length); this.buf.set(a, this.n); this.n += a.length; }
  done() { return this.buf.slice(0, this.n); }
}
