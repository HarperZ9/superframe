// layer.mjs: the bridge from the puppet to lib/stack. A puppet rendered as a premultiplied layer ({ w, h, px, a },
// the section stack's own container) can be onion-skinned, echoed and stacked by lib/stack/echo.mjs and
// lib/stack/stack.mjs without either side knowing about the other. Also the silhouette shadow a puppet throws on
// the set behind it.
import { canvas, coverage, blurCov, shiftCov, paintSafe } from './raster.mjs';
import { drawPuppet, place } from './puppet.mjs';

// The union coverage of a puppet's closed parts, as a full-frame alpha.
export function silhouette(parts, theta, m, W, H) {
  const S = place(parts, theta, m).filter(s => !s.open && !s.p.clip).map(s => s.C);
  const A = coverage(S, W, H), a = new Float32Array(W * H);
  if (A) for (let y = 0; y < A.h; y++) for (let x = 0; x < A.w; x++) a[(y + A.y0) * W + x + A.x0] = A.a[y * A.w + x];
  return { cov: A, a };
}

export function puppetLayer(parts, theta, m, W, H, opts = {}) {
  const K = canvas(W, H, '#000000');
  drawPuppet(K, parts, theta, m, opts);
  const { a } = silhouette(parts, theta, m, W, H);
  for (let i = 0; i < W * H; i++) if (a[i] === 0) { K.px[3 * i] = 0; K.px[3 * i + 1] = 0; K.px[3 * i + 2] = 0; }
  return { w: W, h: H, px: K.px, a };
}

// A soft shadow of the puppet thrown on the set: its silhouette, blurred, offset and darkened.
export function castShadow(K, parts, theta, m, { dx = 40, dy = 10, blur = 24, opacity = 0.35, color = '#1b1410', squash = null } = {}) {
  let parts2 = parts, m2 = m;
  if (squash) m2 = [m[0], m[1] + squash.shear, m[2], m[3] * squash.k, m[4], m[5]];
  const { cov } = silhouette(parts2, theta, m2, K.w, K.h);
  paintSafe(K, shiftCov(blurCov(cov, blur), dx, dy), color, opacity);
  return K;
}

// Composite a premultiplied layer over a canvas.
export function over(K, L, k = 1) {
  for (let i = 0; i < K.w * K.h; i++) { const a = L.a[i] * k; if (a <= 0) continue; for (let c = 0; c < 3; c++) K.px[3 * i + c] = L.px[3 * i + c] * k + K.px[3 * i + c] * (1 - a); }
  return K;
}
