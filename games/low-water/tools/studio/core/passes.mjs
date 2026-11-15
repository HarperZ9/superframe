// Reference passes from a sitter's render: value only (a greyscale of the lit colour) and line/edge
// (where the material changes, where the depth steps, and where the surface turns sharply, from the
// G-buffer). Also the shared image helpers the Studio uses everywhere: luminance, dilation, a box blur.
export const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

// rgba float -> rgba float, each pixel its luminance (the value checker uses the same function)
export function valuePass(rgba, w, h) {
  const out = new Float32Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const v = lum(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
    out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = v; out[i * 4 + 3] = rgba[i * 4 + 3] ?? 1;
  }
  return out;
}

// edge strength 0..1 per pixel: a silhouette or material seam is 1, a depth step or a crease in between
export function edgePass(G) {
  const { w, h } = G, e = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x; if (!G.id[i]) { if (G.id[i + 1] || G.id[i + w]) e[i] = 1; continue; }
    let s = 0;
    for (const j of [i + 1, i + w]) {
      if (G.id[j] !== G.id[i]) { s = 1; break; }
      const dz = Math.abs(G.depth[j] - G.depth[i]), dn = 1 - (G.N[i * 3] * G.N[j * 3] + G.N[i * 3 + 1] * G.N[j * 3 + 1] + G.N[i * 3 + 2] * G.N[j * 3 + 2]);
      s = Math.max(s, Math.min(1, dz * 40), Math.min(1, dn * 6));
    }
    e[i] = s;
  }
  return e;
}
// edges drawn as dark lines on paper, for display and the PNG pass
export function edgesToRgba(e, w, h) {
  const out = new Float32Array(w * h * 4);
  for (let i = 0; i < w * h; i++) { const v = 0.94 - 0.8 * e[i]; out[i * 4] = v; out[i * 4 + 1] = v * 0.98; out[i * 4 + 2] = v * 0.95; out[i * 4 + 3] = 1; }
  return out;
}

// binary mask dilation by r pixels (square), in place safe
export function dilate(m, w, h, r) {
  const t = new Uint8Array(m.length), o = new Uint8Array(m.length);
  for (let y = 0; y < h; y++) { let run = -1e9; for (let x = 0; x < w; x++) { if (m[y * w + x]) run = x; t[y * w + x] = x - run <= r ? 1 : 0; } run = 1e9; for (let x = w - 1; x >= 0; x--) { if (m[y * w + x]) run = x; if (run - x <= r) t[y * w + x] = 1; } }
  for (let x = 0; x < w; x++) { let run = -1e9; for (let y = 0; y < h; y++) { if (t[y * w + x]) run = y; o[y * w + x] = y - run <= r ? 1 : 0; } run = 1e9; for (let y = h - 1; y >= 0; y--) { if (t[y * w + x]) run = y; if (run - y <= r) o[y * w + x] = 1; } }
  return o;
}
// separable box blur of a single float channel, r pixels, two passes
export function blur1(a, w, h, r) {
  if (r < 1) return Float32Array.from(a);
  let s = Float32Array.from(a); const t = new Float32Array(a.length), cl = (i, n) => (i < 0 ? 0 : i >= n ? n - 1 : i), d = 2 * r + 1;
  for (let p = 0; p < 2; p++) {
    for (let y = 0; y < h; y++) { let acc = 0; for (let x = -r; x <= r; x++) acc += s[y * w + cl(x, w)]; for (let x = 0; x < w; x++) { t[y * w + x] = acc / d; acc += s[y * w + cl(x + r + 1, w)] - s[y * w + cl(x - r, w)]; } }
    for (let x = 0; x < w; x++) { let acc = 0; for (let y = -r; y <= r; y++) acc += t[cl(y, h) * w + x]; for (let y = 0; y < h; y++) { s[y * w + x] = acc / d; acc += t[cl(y + r + 1, h) * w + x] - t[cl(y - r, h) * w + x]; } }
  }
  return s;
}
