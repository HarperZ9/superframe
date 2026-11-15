// The record look as a grade (design/sensory/01-LOOKS.md L12 and L13: the record, flat, in paper and ink), mixed
// over a finished frame by the morph's weight w. Value is kept and pushed toward a print's two tones: ink for the
// shadows, paper for the lights, with a coarse ordered screen in the middle values so it reads as a printed sheet.
//   recordGrade(g, w)      g: a 2D context the size of the frame; w 0..1
//   gradePixel(r, g, b, w, x, y) -> [r, g, b]   the same rule on one pixel (tests)
const INK = [29, 20, 24], PAPER = [233, 227, 212];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
export function gradePixel(r, g, b, w, x, y) {
  const v = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255, cell = BAYER[((y >> 1) & 3) * 4 + ((x >> 1) & 3)];
  // a soft print curve: lifted lights, deep shadows, the middle screened by the cell's threshold
  const c = Math.min(1, Math.max(0, (v - 0.5) * 1.6 + 0.5)), k = c < 0.25 || c > 0.8 ? c : c + (c > cell ? 0.12 : -0.12);
  const q = Math.min(1, Math.max(0, k));
  return [0, 1, 2].map((i) => { const p = INK[i] + (PAPER[i] - INK[i]) * q; return [r, g, b][i] * (1 - w) + p * w; });
}
export function recordGrade(g, w) {
  if (w <= 0) return;
  const { width: W, height: H } = g.canvas, im = g.getImageData(0, 0, W, H), d = im.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, o = gradePixel(d[i], d[i + 1], d[i + 2], w, x, y);
    d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2];
  }
  g.putImageData(im, 0, 0);
}
