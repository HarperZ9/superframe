// The painted rim: a light stroke laid just inside a figure's silhouette on the side the ruling lamp
// is on, the paint a painter uses to pull a dark figure off a dark ground (the reference does it with
// a character-only rim light). The far side is left to the figure drawer's own cool back rim, and where
// that rim already lifts an edge pixel the warm one gives way, so no edge carries both. The
// silhouette is the figure's own (it moves with the body, as the ink line does), so it cannot swim.
// Original code.
//   paintRim(rgba, w, h, light2d, G0, P)   light2d: the lamp's direction on screen [x right, y down]
import { toLin, toByte, ks, rOf } from "./km.mjs";

export const EDGE = { width: 2, litValue: 3.2, litK: 0.85 };
const km = (a, b, t) => rOf(ks(a) * (1 - t) + ks(b) * t);

export function paintRim(rgba, w, h, light2d, G0, P) {
  const lx = light2d ? light2d[0] : -0.6, ly = light2d ? light2d[1] : -0.8, ll = Math.hypot(lx, ly) || 1;
  const R = EDGE.width, A = (x, y) => (x >= 0 && y >= 0 && x < w && y < h && rgba[(y * w + x) * 4 + 3] > 128 ? 1 : 0);
  // chessboard distance to the nearest empty pixel, capped at R + 1 (two passes over the box)
  const D = new Uint8Array(w * h), big = R + 1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (!A(x, y)) { D[i] = 0; continue; } let d = big; if (x > 0) d = Math.min(d, D[i - 1] + 1); else d = 1; if (y > 0) { d = Math.min(d, D[i - w] + 1); if (x > 0) d = Math.min(d, D[i - w - 1] + 1); if (x < w - 1) d = Math.min(d, D[i - w + 1] + 1); } else d = 1; D[i] = d; }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) { const i = y * w + x; if (!D[i]) continue; let d = D[i]; if (x === w - 1 || y === h - 1) d = 1; if (x < w - 1) d = Math.min(d, D[i + 1] + 1); if (y < h - 1) { d = Math.min(d, D[i + w] + 1); if (x < w - 1) d = Math.min(d, D[i + w + 1] + 1); if (x > 0) d = Math.min(d, D[i + w - 1] + 1); } D[i] = d; }
  const edits = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const near = D[y * w + x]; if (!near || near > R) continue;
    // the outward normal: the alpha gradient over a 5 x 5 window (toward the empty side)
    let nx = 0, ny = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if ((dx || dy) && !A(x + dx, y + dy)) { nx += dx; ny += dy; }
    const nl = Math.hypot(nx, ny); if (nl < 1e-6) continue;
    const facing = (nx * lx + ny * ly) / (nl * ll), fall = near === 1 ? 1 : 0.45;
    edits.push(y * w + x, facing, fall, nx / nl, ny / nl);
  }
  const lit = P.light, T = [0, 0, 0], L = (i) => 0.2126 * toLin(rgba[i * 4]) + 0.7152 * toLin(rgba[i * 4 + 1]) + 0.0722 * toLin(rgba[i * 4 + 2]);
  let warm = 0, yielded = 0;
  for (let e = 0; e < edits.length; e += 5) {
    const i = edits[e], facing = edits[e + 1], fall = edits[e + 2]; if (facing <= 0.15) continue;   // the far side is the drawer's cool back rim
    // never two rims on one edge: where the drawer's cool rim already lifts this pixel (bluer than red and
    // a fifth brighter than the coat three pixels in), the warm rim gives way
    const x = i % w, y = (i / w) | 0, xi = Math.round(x - edits[e + 3] * 3), yi = Math.round(y - edits[e + 4] * 3);
    if (xi >= 0 && yi >= 0 && xi < w && yi < h && rgba[(yi * w + xi) * 4 + 3] > 128 && rgba[i * 4 + 2] > rgba[i * 4] && L(i) > 1.2 * L(yi * w + xi)) { yielded++; continue; }
    const k = EDGE.litK * Math.min(1, (facing - 0.15) / 0.5) * fall, val = EDGE.litValue * G0;
    const yt = 0.2126 * lit[0] + 0.7152 * lit[1] + 0.0722 * lit[2] || 1;
    for (let c = 0; c < 3; c++) T[c] = Math.min(1, (lit[c] * val) / yt);
    let did = false; for (let c = 0; c < 3; c++) { const cur = toLin(rgba[i * 4 + c]); if (T[c] > cur) { rgba[i * 4 + c] = toByte(km(cur, T[c], k)); did = true; } }   // a rim only ever lightens
    if (did) warm++;
  }
  (globalThis.__lwRimStats ||= {}).last = { edge: edits.length / 5, warm, yielded };
  return warm;
}
