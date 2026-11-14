// Era 3's line (design/sensory/01-LOOKS.md L3): the ink plate printed out of register with the colour, as a
// lithograph run on a tired press. Each pixel keeps its own value (the ink and the drawing stay where they were)
// and takes its hue from the pixel (dx, dy) away, so the colour sits off the line by a few pixels. Original code.
//   misregister(rgba8, W, H, { dx = 2, dy = 1 }) -> Uint8ClampedArray (rgba8)
const lum = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
export function misregister(src, W, H, { dx = 2, dy = 1 } = {}) {
  const out = new Uint8ClampedArray(src.length);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, sx = Math.min(W - 1, Math.max(0, x - dx)), sy = Math.min(H - 1, Math.max(0, y - dy)), j = (sy * W + sx) * 4;
    const L = lum(src, i), Lj = lum(src, j);
    for (let c = 0; c < 3; c++) out[i + c] = L + (src[j + c] - Lj);
    out[i + 3] = src[i + 3];
  }
  return out;
}
