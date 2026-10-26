// lib/mosaic/digits.mjs: the digit tesserae of the top view's mosaic reading (lib/medium/gpu/display.js, mode 1),
// one of the four tile libraries merged here (BLEED section 3). A digit is a 3 x 5 figure packed in 15 bits, row by
// row from the top, high bit first; display.js takes the table from here, and digitMosaic is the CPU twin of that
// shader path, for tests and stills.
export const DIGITS_3x5 = Object.freeze([31599, 11415, 29671, 29647, 23497, 31183, 31215, 29257, 31727, 31695]);
export const DIGITS_GLSL = `int G[10] = int[10](${DIGITS_3x5.join(', ')});`;
export const digitBit = (d, row, col) => (DIGITS_3x5[d] >> (14 - (row * 3 + col))) & 1;
// tone 0..1 per cell of `cell` px: the digit floor(m * 10) drawn in a 4 x 6 grid in the cell, at strength .18 + .62 m
export function digitMosaic(tone, W, H, { cell = 12, floor = 0.05 } = {}) {
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell), m = tone[Math.min(H - 1, Math.floor((cy + 0.5) * cell)) * W + Math.min(W - 1, Math.floor((cx + 0.5) * cell))];
    if (m <= floor) continue;
    const fx = (x - cx * cell) / cell, fy = (y - cy * cell) / cell, col = Math.floor(fx * 4), row = Math.floor(fy * 6);
    if (col < 3 && row < 5 && digitBit(Math.floor(Math.min(m, 0.999) * 10), row, col)) out[y * W + x] = 0.18 + 0.62 * m;
  }
  return out;
}
