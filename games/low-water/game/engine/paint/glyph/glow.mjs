// Layered glow in type (after the author's inspiration note, 2026-10-21, section 1: several glow layers of
// different size and hue around lamps and lit glyphs, so night stays dark while what is near a light
// reads, and colours the palette never held come out of the blend). Rebuilt in our own terms: the
// sources are the emitter cells and the brightly lit glyphs of the composed frame; each layer is a box
// blur of the sources in cell space (two passes, so about a tent) at its own radius, tinted by its own
// hue, and added to the ground and, more strongly, to the type over it. Cell space keeps it cheap (a
// 1080p frame is about 21 000 cells) and lets it sit on the grid. Original code.
//   applyGlow(out, cols, rows, cw, ch, layers) ; layers: [{ r (cells), k (strength), hue: [r, g, b], fg }]
export const GLOW_LAYERS = [
  { r: 1.5, k: 0.55, hue: [1.0, 0.78, 0.5], fg: 1.4 },    // the lamp's own warm core
  { r: 5, k: 0.3, hue: [1.0, 0.5, 0.55], fg: 1.2 },       // a rose skirt
  { r: 13, k: 0.16, hue: [0.4, 0.55, 1.0], fg: 1.0 },     // a cold, wide breath
];
let buf = null;
export function applyGlow(out, cols, rows, cw, ch, layers = GLOW_LAYERS, lit = 0.3) {
  const n = cols * rows; if (!buf || buf.n !== n) buf = { n, s: new Float32Array(n), a: new Float32Array(n), b: new Float32Array(n), g: new Float32Array(n * 3) };
  const { s, a, b, g } = buf; g.fill(0);
  for (let i = 0; i < n; i++) {
    const L = (0.2126 * out.FG[i * 3] + 0.7152 * out.FG[i * 3 + 1] + 0.0722 * out.FG[i * 3 + 2]) / 255;
    s[i] = out.EM[i] ? (out.EM[i] / 255) * Math.max(0.5, L) : L > 0.45 ? (L - 0.45) * lit * 2 : 0;
  }
  for (const Ly of layers) {
    const rx = Math.max(1, Math.round(Ly.r)), ry = Math.max(1, Math.round((Ly.r * cw) / ch));
    a.set(s); for (let p = 0; p < 2; p++) { box(a, b, cols, rows, rx, 1); box(b, a, cols, rows, ry, cols); }
    for (let i = 0; i < n; i++) { const v = a[i] * Ly.k; if (v < 1e-4) continue; g[i * 3] += v * Ly.hue[0]; g[i * 3 + 1] += v * Ly.hue[1]; g[i * 3 + 2] += v * Ly.hue[2]; }
  }
  for (let i = 0; i < n; i++) {
    const gr = g[i * 3], gg = g[i * 3 + 1], gb = g[i * 3 + 2]; if (gr + gg + gb < 1e-3) continue;
    const add = (A, k) => { A[i * 3] = Math.min(255, A[i * 3] + 255 * gr * k); A[i * 3 + 1] = Math.min(255, A[i * 3 + 1] + 255 * gg * k); A[i * 3 + 2] = Math.min(255, A[i * 3 + 2] + 255 * gb * k); };
    add(out.BG, 0.35); if (!out.EM[i]) add(out.FG, layers[0].fg);
  }
}
// a running-sum box blur along one axis (step 1: rows; step cols: columns)
function box(src, dst, cols, rows, r, step) {
  const lines = step === 1 ? rows : cols, len = step === 1 ? cols : rows, stride = step === 1 ? cols : 1, w = 1 / (2 * r + 1);
  for (let l = 0; l < lines; l++) {
    const o = l * stride; let acc = 0;
    for (let k = -r; k <= r; k++) acc += src[o + Math.min(len - 1, Math.max(0, k)) * step];
    for (let k = 0; k < len; k++) { dst[o + k * step] = acc * w; acc += src[o + Math.min(len - 1, k + r + 1) * step] - src[o + Math.max(0, k - r) * step]; }
  }
}
