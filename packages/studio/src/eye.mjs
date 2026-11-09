// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
// eye.mjs: the studio's eye. It reads any picture the studio makes (or one a person drops in) as numbers anyone
// can recompute: a 64-bit difference hash, a drift verdict between two pictures, and five descriptive features.
// A port of studio-engine's showcase/eye.js (HarperZ9/studio-engine@328a0ddf), which is itself a port of the
// coherence-membrane perceptual hash; tests/eye.test.mjs holds this file to the source's outputs
// (goldens/eye.golden.json).
//
// A difference hash (dHash) turns the picture to Rec.601 luma, box-averages it to 9 x 8 cells, and keeps one bit
// per horizontal neighbour pair: 1 when the left cell is brighter. Two pictures that look alike share most bits,
// so the Hamming distance (the count of differing bits, 0 to 64) measures how far a render moved. Bytes that
// match exactly need no hash; that is the MATCH case below.
//
//   const { phash, features } = eyeOf(rgba, w, h);              // rgba: 4 channels per pixel, alpha ignored
//   compareDrift(shaA, shaB, phashA, phashB)                    // MATCH, DRIFT with distance, or UNVERIFIABLE
const HASH_W = 8, HASH_H = 8;

// Rec.601 luma in integer arithmetic, as the source: floor((299 R + 587 G + 114 B) / 1000).
function toGray(px, w, h, ch) {
  const n = w * h, gray = new Array(n);
  if (ch === 1) for (let i = 0; i < n; i++) gray[i] = px[i];
  else if (ch === 2) for (let i = 0; i < n; i++) gray[i] = px[i * 2];
  else for (let i = 0; i < n; i++) { const b = i * ch; gray[i] = Math.floor((px[b] * 299 + px[b + 1] * 587 + px[b + 2] * 114) / 1000); }
  return gray;
}

// Box average onto a tw x th grid; every cell covers at least one source pixel.
function downscale(gray, w, h, tw, th) {
  const out = new Array(tw * th).fill(0);
  for (let ty = 0; ty < th; ty++) {
    const y0 = Math.floor((ty * h) / th), y1 = Math.max(y0 + 1, Math.floor(((ty + 1) * h) / th));
    for (let tx = 0; tx < tw; tx++) {
      const x0 = Math.floor((tx * w) / tw), x1 = Math.max(x0 + 1, Math.floor(((tx + 1) * w) / tw));
      let total = 0, count = 0;
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { total += gray[yy * w + xx]; count++; }
      out[ty * tw + tx] = count ? Math.floor(total / count) : 0;
    }
  }
  return out;
}

function dhashBits(gray, w, h) {
  const small = downscale(gray, w, h, HASH_W + 1, HASH_H);
  let bits = 0n;
  for (let y = 0; y < HASH_H; y++) {
    const row = y * (HASH_W + 1);
    for (let x = 0; x < HASH_W; x++) { bits <<= 1n; if (small[row + x] > small[row + x + 1]) bits |= 1n; }
  }
  return bits;
}

// 64-bit dHash of pixels with ch channels each (4 = RGBA, alpha ignored) as 16 hex digits.
export function perceptualHash(px, w, h, ch = 4) {
  return dhashBits(toGray(px, w, h, ch), w, h).toString(16).padStart(16, '0');
}

// Count of differing bits between two 16-hex hashes.
export function hamming(aHex, bHex) {
  let x = BigInt('0x' + aHex) ^ BigInt('0x' + bHex), c = 0;
  while (x) { c += Number(x & 1n); x >>= 1n; }
  return c;
}

// The drift verdict, fail-closed: MATCH on identical bytes, DRIFT with a distance when the bytes differ, and
// UNVERIFIABLE when either side lacks the identity hash or the perceptual hash needed to decide.
export function compareDrift(baseSha, curSha, basePhash, curPhash) {
  if (!baseSha || !curSha) return { verdict: 'UNVERIFIABLE', distance: null, reason: 'a SHA-256 identity is missing on one side' };
  if (baseSha === curSha) return { verdict: 'MATCH', distance: 0, reason: 'identical bytes (sha256 equal)' };
  if (basePhash == null || curPhash == null) return { verdict: 'UNVERIFIABLE', distance: null, reason: 'bytes differ but a perceptual hash is missing' };
  const dist = hamming(basePhash, curPhash);
  return { verdict: 'DRIFT', distance: dist, reason: `bytes differ; perceptual distance ${dist}/64` };
}

// Five descriptive readings, each 0 to 1: contrast (luma range), coverage (share of pixels above mid grey),
// entropy (16-bin luma histogram, normalised), balance (1 when brightness is centred on both axes) and hue (of
// the mean colour). They describe a picture for discussion; the hashes are the recomputable claims.
export function features(px, w, h, ch = 4) {
  const gray = toGray(px, w, h, ch), n = gray.length;
  let mn = 255, mx = 0, sum = 0, bright = 0;
  for (const g of gray) { if (g < mn) mn = g; if (g > mx) mx = g; sum += g; if (g > 127) bright++; }
  const hist = new Array(16).fill(0);
  for (const g of gray) hist[Math.min(15, Math.floor(g / 16))]++;
  let H = 0;
  for (const c of hist) if (c > 0) { const p = c / n; H -= p * Math.log(p); }
  let left = 0, right = 0, top = 0, bot = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const g = gray[y * w + x];
    if (x < w / 2) left += g; else right += g;
    if (y < h / 2) top += g; else bot += g;
  }
  const balance = 1 - Math.min(1, (Math.abs(left - right) + Math.abs(top - bot)) / (sum || 1));
  return { contrast: (mx - mn) / 255, coverage: bright / n, entropy: H / Math.log(16), balance, hue: meanHue(px, n, ch), width: w, height: h };
}

function meanHue(px, n, ch) {
  if (ch < 3) return 0;
  let R = 0, G = 0, B = 0;
  for (let i = 0; i < n; i++) { const b = i * ch; R += px[b]; G += px[b + 1]; B += px[b + 2]; }
  R /= n; G /= n; B /= n;
  const mxc = Math.max(R, G, B), d = mxc - Math.min(R, G, B);
  if (!(d > 0)) return 0;
  const hue = mxc === R ? ((G - B) / d) % 6 : mxc === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return (((hue / 6) % 1) + 1) % 1;
}

// SHA-256 of the bytes as hex, through Web Crypto, so it runs in node and the browser alike.
export async function identitySha256(bytes) {
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// One call for an RGBA raster from the studio's image lane (lanes/image.mjs toRGBA).
export const eyeOf = (rgba, w, h) => ({ phash: perceptualHash(rgba, w, h, 4), features: features(rgba, w, h, 4) });
