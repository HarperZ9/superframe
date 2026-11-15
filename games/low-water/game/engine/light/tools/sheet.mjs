// Contact sheets for the light proofs: images in a grid, each with a caption in a small bitmap face (no
// canvas in node). Original code; the 5 x 7 face is drawn here, not copied.
//   sheet(cells, { cols, cellW, cellH, pad }) -> { width, height, data }   cells: [{ img: {width,height,data}, label }]
//   scaleTo(img, w, h) -> img (box filter down, nearest up)
const F5 = {
  A: "01110100011000111111100011000110001", B: "11110100011111010001100011000111110", C: "01110100011000010000100001000101110", D: "11110100011000110001100011000111110",
  E: "11111100001111010000100001000011111", F: "11111100001111010000100001000010000", G: "01110100011000010111100011000101111", H: "10001100011111110001100011000110001",
  I: "01110001000010000100001000010001110", J: "00111000100001000010000101001001100", K: "10001100101010011000101001001010001", L: "10000100001000010000100001000011111",
  M: "10001110111010110001100011000110001", N: "10001110011010110011100011000110001", O: "01110100011000110001100011000101110", P: "11110100011111010000100001000010000",
  Q: "01110100011000110001101011001001101", R: "11110100011111010100100101000110001", S: "01111100000111000001000011000111110", T: "11111001000010000100001000010000100",
  U: "10001100011000110001100011000101110", V: "10001100011000110001100010101000100", W: "10001100011000110101101011101110001", X: "10001100010101000100010101000110001",
  Y: "10001100010101000100001000010000100", Z: "11111000010001000100010001000011111", 0: "01110100011001110101110011000101110", 1: "00100011000010000100001000010001110",
  2: "01110100010000100010001000100011111", 3: "11110000010000101110000010000111110", 4: "00010001100101010010111110001000010", 5: "11111100001111000001000011000101110",
  6: "00110010001000011110100011000101110", 7: "11111000010001000100010000100001000", 8: "01110100011000101110100011000101110", 9: "01110100011000101111000010001001100",
  ".": "00000000000000000000000000110001100", ":": "00000011000110000000011000110000000", "-": "00000000000000011111000000000000000", "/": "00001000010001000100010001000010000",
  "(": "00010001000100001000010000010000010", ")": "01000001000001000010000100010001000", "%": "11001110010001000100010001001110011", "=": "00000000001111100000111110000000000", ",": "00000000000000000000001100010001000",
};
function text(img, s, x0, y0, scale = 2, col = [233, 227, 212]) {
  let x = x0;
  for (const ch of String(s).toUpperCase()) {
    const g = F5[ch]; if (g) for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (g[r * 5 + c] === "1") for (let a = 0; a < scale; a++) for (let b = 0; b < scale; b++) {
      const X = x + c * scale + b, Y = y0 + r * scale + a; if (X < 0 || Y < 0 || X >= img.width || Y >= img.height) continue; const p = (Y * img.width + X) * 4; img.data[p] = col[0]; img.data[p + 1] = col[1]; img.data[p + 2] = col[2]; img.data[p + 3] = 255;
    }
    x += 6 * scale;
  }
}
export function scaleTo(img, w, h) {
  const out = { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }, sx = img.width / w, sy = img.height / h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx)), y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy)); const acc = [0, 0, 0, 0]; let m = 0;
    for (let yy = y0; yy < Math.min(img.height, y1); yy++) for (let xx = x0; xx < Math.min(img.width, x1); xx++) { const p = (yy * img.width + xx) * 4; for (let k = 0; k < 4; k++) acc[k] += img.data[p + k]; m++; }
    const q = (y * w + x) * 4; for (let k = 0; k < 4; k++) out.data[q + k] = acc[k] / (m || 1);
  }
  return out;
}
export function sheet(cells, { cols = 2, cellW = 640, cellH = 360, pad = 8, cap = 26, title = "" } = {}) {
  const rows = Math.ceil(cells.length / cols), top = title ? 34 : 0, width = cols * (cellW + pad) + pad, height = top + rows * (cellH + cap + pad) + pad;
  const out = { width, height, data: new Uint8ClampedArray(width * height * 4) };
  for (let i = 0; i < width * height; i++) { out.data[i * 4] = 16; out.data[i * 4 + 1] = 14; out.data[i * 4 + 2] = 18; out.data[i * 4 + 3] = 255; }
  if (title) text(out, title, pad, 10, 3);
  cells.forEach((c, k) => {
    const X = pad + (k % cols) * (cellW + pad), Y = top + pad + Math.floor(k / cols) * (cellH + cap + pad), img = c.img.width === cellW && c.img.height === cellH ? c.img : scaleTo(c.img, cellW, cellH);
    for (let y = 0; y < cellH; y++) out.data.set(img.data.subarray(y * cellW * 4, (y + 1) * cellW * 4), ((Y + y) * width + X) * 4);
    text(out, c.label || "", X, Y + cellH + 6, 2);
  });
  return out;
}
