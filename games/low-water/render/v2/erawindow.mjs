// The era window (design/art/PAINT-LANGUAGE.md; after the inspiration batch's old-town story where a window shows the
// same street in colour in another century; technique only). From one era, a window, a mirror or a photograph shows
// the same place in another era, painted in that era's palette. The world outside the window is held in its own
// era (drained toward ink and paper when the window should carry all the colour); inside the window the other era
// is painted through the paint language; the frame is painted as timber with a cold highlight down the glass.
//   eraWindow(W, H, { here, there, rect: [x, y, w, h], arch, drain, frame }) -> Uint8ClampedArray
//   here, there: rgba8 of the same plate in the two eras (render/v2/language.mjs with era set)
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export function eraWindow(W, H, { here, there, rect, arch = true, drain = 0.85, frame = [0.16, 0.11, 0.08], frameW = 10 }) {
  const [rx, ry, rw, rh] = rect, out = new Uint8ClampedArray(W * H * 4), cx = rx + rw / 2, ar = rw / 2;
  const inside = (x, y) => { if (x < rx || x >= rx + rw || y >= ry + rh) return false; if (y >= ry + ar || !arch) return y >= ry; return Math.hypot(x - cx, y - (ry + ar)) <= ar; };
  const dist = (x, y) => {   // distance into the opening from its edge (for the frame and the glass's soft inner shadow)
    let d = Math.min(x - rx, rx + rw - 1 - x, ry + rh - 1 - y); if (arch && y < ry + ar) d = Math.min(d, ar - Math.hypot(x - cx, y - (ry + ar))); else d = Math.min(d, y - ry); return d;
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4; let c;
    if (inside(x, y)) {
      const d = dist(x, y), glint = Math.exp(-(((x - rx - rw * 0.72) - (y - ry) * 0.18) ** 2) / 30) * 0.18, shadow = clamp(1 - d / 18) * 0.35;
      c = [0, 1, 2].map((k) => (there[i + k] / 255) * (1 - shadow) + glint);
      if (d < frameW) c = frame.map((v, k) => v * (0.85 + 0.3 * clamp((d / frameW) * (k === 0 ? 1.1 : 1))));   // the painted frame
      if (Math.abs(x - cx) < frameW * 0.35 && d >= frameW && y > ry + ar * 0.4) c = frame;   // the glazing bar
    } else {
      const r = here[i] / 255, g = here[i + 1] / 255, b = here[i + 2] / 255, L = 0.2126 * r + 0.7152 * g + 0.0722 * b, ink = [L * 1.02, L, L * 0.94];   // drained toward ink on paper
      c = [r, g, b].map((v, k) => v * (1 - drain) + ink[k] * drain);
    }
    for (let k = 0; k < 3; k++) out[i + k] = clamp(c[k]) * 255; out[i + 3] = 255;
  }
  return out;
}
