// The occlusion depth under a screen pixel, as a pure function of the plate's occlusion data, its
// painted colours and the camera's view, so the plate camera (ui/platecam.mjs depthAt) and a figure
// worker (characters/runtime/figworker.mjs) answer the same. Where the four geo samples round the
// pixel agree within 0.12 m their depths are blended; across a depth break the pixel takes the
// sample whose painted colour is nearest its own; a point more than overhead m above the figure's
// floor and over open floor (a hanging lamp, a beam) never hides a figure.
//   occludeDepth(O, rgb, view, sx, sy, floorY, overhead)   O { s, gw, gh, D, up }, rgb { d, w, h } | null, view { left, top, zoom }
export function rgbAt(rgb, px, py) {
  if (!rgb || !rgb.d) return null;
  const x = Math.max(0, Math.min(rgb.w - 1, Math.floor(px))), y = Math.max(0, Math.min(rgb.h - 1, Math.floor(py))), k = (rgb.cw ? (y - rgb.y0c) * rgb.cw + (x - rgb.x0c) : y * rgb.w + x) * 4;
  return [rgb.d[k], rgb.d[k + 1], rgb.d[k + 2]];
}
export function occludeDepth(O, rgb, cur, sx, sy, floorY, OVERHEAD) {
  if (!O || !cur) return Infinity;
  const u = cur.left + sx / cur.zoom, v = cur.top + sy / cur.zoom, gx = u * O.s - 0.5, gy = v * O.s - 0.5, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
  const ks = [], ds = [];
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { const X = Math.max(0, Math.min(O.gw - 1, x0 + i)), Y = Math.max(0, Math.min(O.gh - 1, y0 + j)), k = O.cw ? (Y - O.y0c) * O.cw + (X - O.x0c) : Y * O.gw + X; ks.push(k); ds.push(O.D[k]); }
  let lo = Infinity, hi = -Infinity; for (const d of ds) { lo = Math.min(lo, d); hi = Math.max(hi, d); }
  let pick = -1, d;
  if (Number.isFinite(hi) && hi - lo < 0.12) { d = (ds[0] * (1 - fx) + ds[1] * fx) * (1 - fy) + (ds[2] * (1 - fx) + ds[3] * fx) * fy; pick = (fy < 0.5 ? 0 : 2) + (fx < 0.5 ? 0 : 1); }
  else {
    const me = rgbAt(rgb, u, v); let best = Infinity;
    for (let q = 0; q < 4; q++) {
      const cx = (x0 + (q & 1) + 0.5) / O.s, cy = (y0 + (q >> 1) + 0.5) / O.s, c = me && rgbAt(rgb, cx, cy);
      const near = Math.hypot((q & 1) - fx, (q >> 1) - fy), score = (c ? Math.hypot(c[0] - me[0], c[1] - me[1], c[2] - me[2]) : 0) + 24 * near;
      if (score < best) { best = score; pick = q; }
    }
    d = ds[pick];
  }
  if (floorY != null && pick >= 0) { const up = O.up[ks[pick]]; if (up === up && up - floorY > OVERHEAD) return Infinity; }
  return d;
}

// The part of a plate's occlusion data and colours that the test can read for a screen box (a figure's
// image) at a view: the cells and plate pixels under the box, a margin round them, clamped as the test
// clamps. occludeDepth reads a crop through its offsets (x0c, y0c, cw) and gives the same answers inside
// the box. A figure job carries its crop instead of each worker holding the whole plate.
export function cropOcclusion(src, view, box) {
  const { O, rgb } = src, [bx0, by0, bx1, by1] = box, M = 4;
  const u0 = view.left + bx0 / view.zoom, u1 = view.left + bx1 / view.zoom, v0 = view.top + by0 / view.zoom, v1 = view.top + by1 / view.zoom;
  const gx0 = Math.max(0, Math.floor(Math.min(u0, u1) * O.s - 0.5) - M), gx1 = Math.min(O.gw - 1, Math.floor(Math.max(u0, u1) * O.s - 0.5) + M);
  const gy0 = Math.max(0, Math.floor(Math.min(v0, v1) * O.s - 0.5) - M), gy1 = Math.min(O.gh - 1, Math.floor(Math.max(v0, v1) * O.s - 0.5) + M);
  const cw = Math.max(1, gx1 - gx0 + 1), ch = Math.max(1, gy1 - gy0 + 1), D = new Float32Array(cw * ch), up = new Float32Array(cw * ch);
  for (let y = 0; y < ch; y++) { const g = (gy0 + y) * O.gw + gx0; D.set(O.D.subarray(g, g + cw), y * cw); up.set(O.up.subarray(g, g + cw), y * cw); }
  const crop = { O: { s: O.s, gw: O.gw, gh: O.gh, D, up, x0c: gx0, y0c: gy0, cw }, rgb: null };
  if (rgb && rgb.d) {
    const px0 = Math.max(0, Math.floor(gx0 / O.s) - M), px1 = Math.min(rgb.w - 1, Math.ceil((gx1 + 1) / O.s) + M), py0 = Math.max(0, Math.floor(gy0 / O.s) - M), py1 = Math.min(rgb.h - 1, Math.ceil((gy1 + 1) / O.s) + M);
    const rw = px1 - px0 + 1, rh = py1 - py0 + 1, d = new Uint8ClampedArray(rw * rh * 4);
    for (let y = 0; y < rh; y++) { const g = ((py0 + y) * rgb.w + px0) * 4; d.set(rgb.d.subarray(g, g + rw * 4), y * rw * 4); }
    crop.rgb = { w: rgb.w, h: rgb.h, d, x0c: px0, y0c: py0, cw: rw };
  }
  return crop;
}
