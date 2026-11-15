// Glyph's raster: the frame's cells into pixels. Cells are tied to the world, so the last frame's
// pixels are shifted with the camera's pan and only cells whose glyph, ink or ground changed are drawn
// again (base buffer); then each frame, over a copy: glyph-shaped bloom and a warmer halation round
// every emitting cell, and the optional phosphor stage. Original code.
//   const R = makeRaster(atlas); R.draw({ G, FG, BG, EM, cols, rows, ox, oy, W, H, shiftX, shiftY, bloom, halation, crt }) -> ImageData
export function makeRaster(atlas) {
  const cw = atlas.cw, ch = atlas.ch;
  let W = 0, H = 0, base = null, img = null, prev = null;
  return {
    reset() { prev = null; },
    draw(f) {
      if (f.W !== W || f.H !== H || !base) { W = f.W; H = f.H; base = new Uint8ClampedArray(W * H * 4); img = new ImageData(W, H); prev = null; }
      const { G, FG, BG, EM, cols, rows, ox, oy } = f, ink = atlas.inkFor(W);
      if (prev && (f.shiftX || f.shiftY)) shift(base, W, H, f.shiftX, f.shiftY);
      const keyNow = new Float64Array(cols * rows); let drawn = 0;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const o = y * cols + x, x0 = ox + x * cw, y0 = oy + y * ch;
        const k = G[o] * 16777216 + FG[o * 3] * 65536 + FG[o * 3 + 1] * 256 + FG[o * 3 + 2] + (((BG[o * 3] >> 3) << 10) | ((BG[o * 3 + 1] >> 3) << 5) | (BG[o * 3 + 2] >> 3)) * 4294967296;   // glyph, ink, and ground to 5 bits a channel, in one exact number (under 2^53)
        keyNow[o] = k;
        const whole = x0 >= 0 && y0 >= 0 && x0 + cw <= W && y0 + ch <= H;
        if (whole && prev && f.prevKey && f.prevKey(x, y, prev) === k) continue;
        drawn++; cell(base, W, H, x0, y0, BG, FG, o, ink[G[o]], whole, cw, ch);
      }
      prev = { keys: keyNow, cols, rows };
      // over a copy: bloom and halation round emitting cells (the glyph's soft copy, three cells across)
      const d = img.data; d.set(base);
      if (f.bloom > 0 || f.halation > 0) for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const o = y * cols + x; if (!EM[o]) continue;
        const s = atlas.soft(G[o]), e = EM[o] / 255, x0 = ox + x * cw - cw, y0 = oy + y * ch - ch, r = FG[o * 3], g = FG[o * 3 + 1], b = FG[o * 3 + 2];
        for (let py = 0; py < s.h; py++) { const Y = y0 + py; if (Y < 0 || Y >= H) continue; for (let px = 0; px < s.w; px++) { const X = x0 + px; if (X < 0 || X >= W) continue; const a = s.al[py * s.w + px]; if (a < 0.01) continue;
          const q = (Y * W + X) * 4, k1 = a * e * f.bloom, k2 = a * e * f.halation; d[q] += r * k1 + 255 * 0.9 * k2; d[q + 1] += g * k1 + 255 * 0.42 * k2; d[q + 2] += b * k1 + 255 * 0.22 * k2; } }
      }
      if (f.crt) for (let y = 0; y < H; y++) { const sl = 0.8 + 0.2 * Math.cos((2 * Math.PI * y) / 3); for (let x = 0; x < W; x++) { const q = (y * W + x) * 4, t = x % 3; d[q] *= sl * (t === 0 ? 1.12 : 0.92); d[q + 1] *= sl * (t === 1 ? 1.12 : 0.92); d[q + 2] *= sl * (t === 2 ? 1.12 : 0.92); } }
      return { img, drawn };
    },
  };
}
function cell(buf, W, H, x0, y0, BG, FG, o, G0, whole, w, h) {
  const br = BG[o * 3], bg = BG[o * 3 + 1], bb = BG[o * 3 + 2], fr = FG[o * 3], fg = FG[o * 3 + 1], fb = FG[o * 3 + 2];
  for (let py = 0; py < h; py++) { const Y = y0 + py; if (Y < 0 || Y >= H) continue; for (let px = 0; px < w; px++) { const X = x0 + px; if (X < 0 || X >= W) continue; const q = (Y * W + X) * 4; buf[q] = br; buf[q + 1] = bg; buf[q + 2] = bb; buf[q + 3] = 255; } }
  for (let t = 0; t < G0.off.length; t++) {
    const off = G0.off[t], py = Math.floor(off / W), px = off - py * W;
    if (!whole && (y0 + py < 0 || y0 + py >= H || x0 + px < 0 || x0 + px >= W)) continue;
    const q = ((y0 + py) * W + x0 + px) * 4, a = G0.al[t]; buf[q] = br + (fr - br) * a; buf[q + 1] = bg + (fg - bg) * a; buf[q + 2] = bb + (fb - bb) * a;
  }
}
function shift(buf, W, H, dx, dy) {
  if (Math.abs(dx) >= W || Math.abs(dy) >= H) return;
  const u = new Uint32Array(buf.buffer, buf.byteOffset, W * H), len = W - Math.abs(dx), [y0, y1, st] = dy > 0 ? [H - 1, -1, -1] : [0, H, 1];
  for (let y = y0; y !== y1; y += st) { const sy = y - dy; if (sy < 0 || sy >= H) continue; const from = sy * W + Math.max(0, -dx), to = y * W + Math.max(0, dx); u.copyWithin(to, from, from + len); }
}
