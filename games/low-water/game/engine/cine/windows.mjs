// The flash rule's windows over one frame (design/sensory/05-CARE.md section 2): 1/16 of the frame, sliding by half
// (7 x 7), each with its mean relative luminance and its share of saturated red. No imports, so the page can run it
// where the pixels are (cine/tools/cinecapture.mjs); cine/flash.mjs judges a run of them.
// E is WCAG 2.0's red measure (its Understanding note, no longer maintained): a saturated-red pixel (R / (R + G + B)
// of 0.8 or more, linear) counts (R - G - B) x 320, any other 0, averaged over the window. R is the share of
// saturated-red pixels, the first count (to 2026-10-23).
// M is each window's mean linear colour, the state WCAG 2.2's red rule reads (cine/redflash.mjs), and the measure
// the judge uses; R and E are kept for the record.
//   windowsOf(rgba, w, h, step) -> { L: [49], R: [49], E: [49], M: [49 x [r, g, b]] }
const LIN = Float32Array.from({ length: 256 }, (_, v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
export function windowsOf(d, w, h, step = 2) {
  const CL = new Float64Array(64), CR = new Float64Array(64), CE = new Float64Array(64), CS = new Float64Array(192), CN = new Float64Array(64), cw = w / 8, ch = h / 8;
  for (let y = 0; y < h; y += step) { const cy = Math.min(7, Math.floor(y / ch)); for (let x = 0; x < w; x += step) {
    const i = (y * w + x) * 4, r = LIN[d[i]], g = LIN[d[i + 1]], b = LIN[d[i + 2]], k = cy * 8 + Math.min(7, Math.floor(x / cw));
    const sat = r / Math.max(1e-6, r + g + b) >= 0.8;
    CL[k] += 0.2126 * r + 0.7152 * g + 0.0722 * b; CR[k] += sat && r > 0.05 ? 1 : 0; CE[k] += sat ? Math.max(0, r - g - b) * 320 : 0; CS[k * 3] += r; CS[k * 3 + 1] += g; CS[k * 3 + 2] += b; CN[k]++;
  } }
  const L = [], R = [], E = [], M = [];
  for (let oy = 0; oy < 7; oy++) for (let ox = 0; ox < 7; ox++) {
    let l = 0, r = 0, e = 0, n = 0; const m = [0, 0, 0]; for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const c = (oy + dy) * 8 + ox + dx; l += CL[c]; r += CR[c]; e += CE[c]; n += CN[c]; for (let j = 0; j < 3; j++) m[j] += CS[c * 3 + j]; }
    L.push(l / Math.max(1, n)); R.push(r / Math.max(1, n)); E.push(e / Math.max(1, n)); M.push(m.map((x) => x / Math.max(1, n)));
  }
  return { L, R, E, M };
}
