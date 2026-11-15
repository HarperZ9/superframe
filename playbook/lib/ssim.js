// Origin: lib/ssim.js of the playbook builds in the author's workspace, left out of the first publish; carried on 2026-11-14.
// lib/ssim.js: SSIM on luma code values (Wang et al. 2004: Gaussian
// window sigma 1.5, K1 0.01, K2 0.03, L 255). Returns the mean and the worst 32 px tile, so a small local
// regression is not averaged away. Dependency-free.
const C1 = (0.01 * 255) ** 2, C2 = (0.03 * 255) ** 2;

export function luma(rgba, w, h) { const y = new Float32Array(w * h); for (let i = 0; i < w * h; i++) y[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]; return y; }

const KER = (() => { const r = 5, k = []; let s = 0; for (let i = -r; i <= r; i++) { const v = Math.exp(-(i * i) / (2 * 1.5 * 1.5)); k.push(v); s += v; } return k.map((v) => v / s); })();
function blur(src, w, h) {
  const t = new Float32Array(w * h), o = new Float32Array(w * h), r = 5;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0; for (let k = -r; k <= r; k++) { const X = Math.min(w - 1, Math.max(0, x + k)); s += src[y * w + X] * KER[k + r]; } t[y * w + x] = s; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0; for (let k = -r; k <= r; k++) { const Y = Math.min(h - 1, Math.max(0, y + k)); s += t[Y * w + x] * KER[k + r]; } o[y * w + x] = s; }
  return o;
}

export function ssimMap(a, b, w, h) {
  const A = luma(a, w, h), B = luma(b, w, h), AA = new Float32Array(w * h), BB = new Float32Array(w * h), AB = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) { AA[i] = A[i] * A[i]; BB[i] = B[i] * B[i]; AB[i] = A[i] * B[i]; }
  const ma = blur(A, w, h), mb = blur(B, w, h), saa = blur(AA, w, h), sbb = blur(BB, w, h), sab = blur(AB, w, h), m = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const va = saa[i] - ma[i] * ma[i], vb = sbb[i] - mb[i] * mb[i], cv = sab[i] - ma[i] * mb[i];
    m[i] = ((2 * ma[i] * mb[i] + C1) * (2 * cv + C2)) / ((ma[i] * ma[i] + mb[i] * mb[i] + C1) * (va + vb + C2));
  }
  return m;
}

export function ssim(a, b, w, h, tile = 32) {
  const m = ssimMap(a, b, w, h); let s = 0; for (let i = 0; i < m.length; i++) s += m[i];
  let worst = 1;
  for (let ty = 0; ty < h; ty += tile) for (let tx = 0; tx < w; tx += tile) {
    let t = 0, n = 0; for (let y = ty; y < Math.min(h, ty + tile); y++) for (let x = tx; x < Math.min(w, tx + tile); x++) { t += m[y * w + x]; n++; }
    worst = Math.min(worst, t / n);
  }
  return { mean: s / m.length, worst };
}
