// Brush strokes for the portrait painter: curved strokes that follow the form, laid coarse to fine where the
// canvas is still wrong (each layer's strokes go where the canvas differs most from the study at that brush
// size, as a painter refines only what needs it), with bristle ridges, a dry tail, and a paint height kept
// per pixel so the finished canvas can be lit for its impasto. Original code; deterministic by seed.
//   layer(canvas, ref, opts) lays one layer;  relief(canvas, height, dir, k) lights the paint's height
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export function rnd(seed) { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

// separable box blur of an n*k float image, r pixels, two passes (close to a gaussian)
export function blurK(a, w, h, k, r, passes = 2) {
  if (r < 1) return a.slice();
  let s = a; const t = new Float32Array(a.length), cl = (i, n) => (i < 0 ? 0 : i >= n ? n - 1 : i), d = 2 * r + 1;
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) for (let c = 0; c < k; c++) { let acc = 0; for (let x = -r; x <= r; x++) acc += s[(y * w + cl(x, w)) * k + c]; for (let x = 0; x < w; x++) { t[(y * w + x) * k + c] = acc / d; acc += s[(y * w + cl(x + r + 1, w)) * k + c] - s[(y * w + cl(x - r, w)) * k + c]; } }
    const o = new Float32Array(a.length);
    for (let x = 0; x < w; x++) for (let c = 0; c < k; c++) { let acc = 0; for (let y = -r; y <= r; y++) acc += t[(cl(y, h) * w + x) * k + c]; for (let y = 0; y < h; y++) { o[(y * w + x) * k + c] = acc / d; acc += t[(cl(y + r + 1, h) * w + x) * k + c] - t[(cl(y - r, h) * w + x) * k + c]; } }
    s = o;
  }
  return s;
}
const lum3 = (a, i) => 0.3 * a[i * 3] + 0.59 * a[i * 3 + 1] + 0.11 * a[i * 3 + 2];

// The direction of the form at each pixel: along the contours of the reference's value (the structure
// tensor, smoothed at radius r), or a given field
export function contourField(ref, w, h, r) {
  const n = w * h, L = new Float32Array(n); for (let i = 0; i < n; i++) L[i] = lum3(ref, i);
  const J = new Float32Array(n * 3);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x, gx = L[i + 1] - L[i - 1], gy = L[i + w] - L[i - w]; J[i * 3] = gx * gx; J[i * 3 + 1] = gx * gy; J[i * 3 + 2] = gy * gy; }
  const S = blurK(J, w, h, 3, r, 2), dir = new Float32Array(n * 2), str = new Float32Array(n); let smax = 0;
  for (let i = 0; i < n; i++) {
    const a = S[i * 3], b = S[i * 3 + 1], d = S[i * 3 + 2], th = 0.5 * Math.atan2(2 * b, a - d) + Math.PI / 2;
    dir[i * 2] = Math.cos(th); dir[i * 2 + 1] = Math.sin(th); str[i] = Math.sqrt((a - d) ** 2 + 4 * b * b); if (str[i] > smax) smax = str[i];
  }
  return { dir, str, weak: smax * 0.02 };
}

// One layer: brush radius R; strokes placed on a grid of R where the error area beats T; each stroke
// follows the field for up to maxLen, stopping where the reference turns away from its colour.
// clip: how far (colour distance) a pixel may be from the stroke's colour and still take it (soft)
export function layer(canvas, ref, { w, h, R, T = 0.06, maxLen = 8, minLen = 2, field, rand, alpha = 0.95, clip = 0.2, only = null, height = null, bristle = 1, fallback = [0, 1], jitter = 0.03, curv = 1 }) {
  const strokes = [], g = Math.max(1, Math.round(R)), err = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) { const dr = canvas[i * 3] - ref[i * 3], dg = canvas[i * 3 + 1] - ref[i * 3 + 1], db = canvas[i * 3 + 2] - ref[i * 3 + 2]; err[i] = Math.sqrt(dr * dr + dg * dg + db * db); }
  for (let gy = 0; gy < h; gy += g) for (let gx = 0; gx < w; gx += g) {
    let sum = 0, best = -1, bi = -1, cnt = 0;
    for (let y = gy; y < Math.min(h, gy + g); y++) for (let x = gx; x < Math.min(w, gx + g); x++) { const i = y * w + x; if (only && !only[i]) continue; sum += err[i]; cnt++; if (err[i] > best) { best = err[i]; bi = i; } }
    if (!cnt || sum / cnt < T) continue;
    strokes.push(bi);
  }
  // random order, so no stroke always lands on top of its neighbour in a scan direction
  for (let i = strokes.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [strokes[i], strokes[j]] = [strokes[j], strokes[i]]; }
  for (const i0 of strokes) {
    const c = [ref[i0 * 3], ref[i0 * 3 + 1], ref[i0 * 3 + 2]].map((v) => clamp(v * (1 + (rand() - 0.5) * 2 * jitter)));
    const pts = trace(i0, c, ref, { w, h, R, maxLen, minLen, field, fallback, curv });
    draw(canvas, ref, pts, { w, h, R, c, alpha, clip, height, bristle, seed: rand() * 1000 });
  }
  return strokes.length;
}
function trace(i0, c, ref, { w, h, R, maxLen, minLen, field, fallback, curv }) {
  const x0 = i0 % w, y0 = (i0 / w) | 0, pts = [[x0, y0]];
  for (const sgn of [1, -1]) {
    let x = x0, y = y0, dx = 0, dy = 0, steps = 0;
    while (steps < maxLen / 2) {
      const i = (y | 0) * w + (x | 0); let fx = field ? field.dir[i * 2] : fallback[0], fy = field ? field.dir[i * 2 + 1] : fallback[1];
      if (field && field.str[i] < field.weak) { fx = fallback[0]; fy = fallback[1]; }
      if (steps === 0) { dx = fx * sgn; dy = fy * sgn; } else { if (fx * dx + fy * dy < 0) { fx = -fx; fy = -fy; } dx = dx * (1 - curv * 0.5) + fx * curv * 0.5; dy = dy * (1 - curv * 0.5) + fy * curv * 0.5; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l; }
      const nx = x + dx * R * 0.9, ny = y + dy * R * 0.9; if (nx < 0 || ny < 0 || nx >= w || ny >= h) break;
      const j = (ny | 0) * w + (nx | 0), d = Math.hypot(ref[j * 3] - c[0], ref[j * 3 + 1] - c[1], ref[j * 3 + 2] - c[2]);
      if (steps >= minLen / 2 && d > 0.09) break;
      x = nx; y = ny; steps++; if (sgn > 0) pts.push([x, y]); else pts.unshift([x, y]);
    }
  }
  return pts;
}
// a stroke as a tapering ribbon: coverage per pixel (max over the path), then one blend
function draw(canvas, ref, pts, { w, h, R, c, alpha, clip, height, bristle, seed }) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const pad = R + 2, X0 = Math.max(0, Math.floor(x0 - pad)), Y0 = Math.max(0, Math.floor(y0 - pad)), X1 = Math.min(w - 1, Math.ceil(x1 + pad)), Y1 = Math.min(h - 1, Math.ceil(y1 + pad));
  const segL = []; let total = 0; for (let k = 1; k < pts.length; k++) { const l = Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); segL.push(l); total += l; }
  total = Math.max(total, 1e-3);
  for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
    // nearest point on the path: distance across (v), and how far along (u, 0..1)
    let bd = Infinity, bu = 0, bv = 0, acc = 0;
    if (pts.length === 1) { bd = Math.hypot(x - pts[0][0], y - pts[0][1]); bu = 0.5; bv = 0; }
    for (let k = 1; k < pts.length; k++) {
      const [ax, ay] = pts[k - 1], [bx, by] = pts[k], ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey || 1e-6;
      const t = clamp(((x - ax) * ex + (y - ay) * ey) / l2), px = ax + ex * t, py = ay + ey * t, d = Math.hypot(x - px, y - py);
      if (d < bd) { bd = d; bu = (acc + t * segL[k - 1]) / total; bv = ((x - ax) * ey - (y - ay) * ex) / Math.sqrt(l2); }
      acc += segL[k - 1];
    }
    const taper = 0.55 + 0.45 * Math.sin(Math.PI * clamp(bu * 0.9 + 0.05)), rad = R * taper;
    if (bd > rad + 1) continue;
    const i = y * w + x, edge = clamp(rad + 0.5 - bd), across = clamp(Math.abs(bv) / Math.max(rad, 0.5));
    // bristles: streaks along the stroke; a dry tail where the brush runs out
    const br = 1 - bristle * 0.22 * (0.5 + 0.5 * Math.sin(bv * 2.3 + seed)) * (0.5 + 0.5 * Math.sin(bv * 5.1 + seed * 1.7));
    const dry = bu > 0.78 ? clamp(1 - (bu - 0.78) * 4.5 * (0.6 + 0.8 * frac(Math.sin((bv + seed) * 12.9898) * 43758.5))) : 1;
    const dc = Math.hypot(ref[i * 3] - c[0], ref[i * 3 + 1] - c[1], ref[i * 3 + 2] - c[2]), keep = Math.exp(-((dc / clip) ** 2));
    const a = alpha * edge * dry * keep * (1 - 0.25 * across * across);
    if (a <= 0.003) continue;
    const shade = 0.97 + 0.06 * br - 0.03;
    for (let ch = 0; ch < 3; ch++) canvas[i * 3 + ch] = canvas[i * 3 + ch] * (1 - a) + clamp(c[ch] * shade) * a;
    if (height) height[i] = height[i] * (1 - a) + a * (0.4 + 0.6 * (1 - across * across)) * (0.75 + 0.25 * br) * (0.5 + R / 16);
  }
}
const frac = (x) => x - Math.floor(x);

// light the paint's own relief from the key's side (a raking light on impasto), and a fine canvas weave
export function relief(canvas, height, w, h, dir = [-0.6, -0.5], k = 0.5, weave = 0.025) {
  const H = blurK(height, w, h, 1, 1, 1);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x, gx = H[i + 1] - H[i - 1], gy = H[i + w] - H[i - w], s = 1 + k * (gx * dir[0] + gy * dir[1]) * -1;
    const wv = 1 + weave * (Math.sin(x * 1.9) * Math.sin(y * 1.9 + 0.7) * 0.6 + Math.sin(x * 0.37 + y * 0.41) * 0.4);
    for (let c = 0; c < 3; c++) canvas[i * 3 + c] = clamp(canvas[i * 3 + c] * s * wv);
  }
}
