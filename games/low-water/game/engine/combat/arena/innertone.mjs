// The inner arena's Oil and Ink pass on the arena page, in place of the plain five-tone dither:
//   figurePass(V, g, draw)  the bodies drawn on their own layer, then the painter's found edge on it (the engine's
//                           painted rim, game/engine/paint/edge.mjs, on the side toward the shaft's source), an ink
//                           contour where the ground behind is lighter, a cool back light where it is darker, and
//                           composited; the character's own mask kept for the measures and for the occluded outline
//   tone(V, g)              values to paint: the value planes of the engine's painter (paint/planes.mjs) with the
//                           paraffin night palette (paint/palette.mjs) glazed in pigment space (paint/km.mjs), the
//                           dream's saturation at 55% (design/sensory/01-LOOKS.md L6), lit pixels toward the
//                           light's glaze and the rest toward the shadow glaze, then a fixed mezzotint grain (rocked
//                           ground: heavy in the darks, burnished out of the lights) quantised by a fixed threshold
//                           field; nothing moves in the grain from frame to frame, so it cannot flicker
// Original code; the brush painter itself (paint/painter.mjs) needs the 3D figures' bind space, which these
// placeholder forms do not have, and is not used here.
import { paintRim } from "../../paint/edge.mjs";
import { paletteAt } from "../../paint/palette.mjs";
import { planeValue } from "../../paint/planes.mjs";
import { glaze, toLin, toByte } from "../../paint/km.mjs";

const IW = 640, IH = 360, N = IW * IH;
const layer = (V, k) => ((V.layers ||= {})[k] ||= new OffscreenCanvas(IW, IH));

// the bodies on their own layer, in three passes so each edge is found against what is really behind it: the bodies
// behind the character, the character (his edge stronger: the player must read at every moment), the bodies in
// front of him; then his outline wherever a body in front covers him. His mask and box are kept (V.lambMask, V.lambBox)
export function figurePass(V, g, { behind, lamb, front }) {
  const [sx, sy] = V.stage.src, l2 = [sx - IW / 2, sy - IH * 0.7];
  edgePass(V, g, behind, l2, 1);
  const me = edgePass(V, g, lamb, l2, 3.5), cover = edgePass(V, g, front, l2, 1);
  occluded(V, g, me, cover);
}

// one pass: draw, find the edge against the picture so far, composite; returns the pixels as drawn (before the edge)
function edgePass(V, g, draw, l2, boost) {
  const fl = layer(V, "figs"), fg = fl.getContext("2d", { willReadFrequently: true });
  fg.clearRect(0, 0, IW, IH); draw(fg);
  const img = fg.getImageData(0, 0, IW, IH), d = img.data, drawn = d.slice();
  // the rim is set from the ground round the bodies, as the painter's own is (a value above the ground's): a fixed
  // bright rim on this dark ground shimmered as the edges moved, a change of over 10% of a window's light (05-CARE)
  if (!V.off || !V.off.has("rim")) {
    const back = g.getImageData(0, 0, IW, IH).data, G0 = groundOf(back, d);
    if (G0 < 0) return drawn;
    paintRim(d, IW, IH, l2, Math.min(0.09, G0 * boost), { light: [1.0, 0.78, 0.5] }); contour(d, back, l2, boost);
  }
  fg.putImageData(img, 0, 0); g.drawImage(fl, 0, 0);
  return drawn;
}

// the mean linear light of the ground just round the bodies (their box, grown by 6 px, outside the bodies)
function groundOf(back, d) {
  let x0 = IW, y0 = IH, x1 = -1, y1 = -1;
  for (let p = 0; p < N; p += 3) if (d[p * 4 + 3] > 128) { const x = p % IW, y = (p / IW) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return -1;
  let s = 0, n = 0;
  for (let y = Math.max(0, y0 - 6); y < Math.min(IH, y1 + 6); y += 2) for (let x = Math.max(0, x0 - 6); x < Math.min(IW, x1 + 6); x += 2) { const p = y * IW + x; if (d[p * 4 + 3] > 128) continue; s += toLin(Math.round(lumAt(back, p * 4) * 255)); n++; }
  return Math.max(0.012, Math.min(0.08, n ? s / n : 0.02));
}

const lumAt = (a, i) => (a[i] * 0.3 + a[i + 1] * 0.59 + a[i + 2] * 0.11) / 255;
// edge pixels of the figure layer: ink where the ground just outside is lighter than the body, a cool back light
// where it is as dark or darker (the found edge's far side)
function contour(d, back, l2, boost = 1) {
  const ll = Math.hypot(l2[0], l2[1]) || 1, lx = l2[0] / ll, ly = l2[1] / ll, A = (i) => d[i * 4 + 3] > 128;
  const edits = [];
  for (let y = 1; y < IH - 1; y++) for (let x = 1; x < IW - 1; x++) {
    const p = y * IW + x; if (!A(p)) continue;
    let nx = 0, ny = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!A(p + dy * IW + dx)) { nx += dx; ny += dy; }
    if (!nx && !ny) continue;
    const ox = Math.min(IW - 1, Math.max(0, x + nx * 2)), oy = Math.min(IH - 1, Math.max(0, y + ny * 2)), bg = lumAt(back, (oy * IW + ox) * 4), me = lumAt(d, p * 4);
    edits.push(p, bg, me, nx * lx + ny * ly);
  }
  for (let k = 0; k < edits.length; k += 4) {
    const i = edits[k] * 4, bg = edits[k + 1], me = edits[k + 2], facing = edits[k + 3];
    if (bg > me + 0.06) { const v = Math.round(Math.min(me, 0.03) * 255); d[i] = d[i + 1] = d[i + 2] = v; }
    else if (facing <= 0.15) { const v = toByte(Math.min(0.05 * boost, Math.max(toLin(Math.round(me * 255)), toLin(Math.round(bg * 255)) * (1 + 0.9 * boost), boost > 1 ? 0.045 : 0))); d[i] = Math.max(d[i], v - 6); d[i + 1] = Math.max(d[i + 1], v); d[i + 2] = Math.max(d[i + 2], v + 8); }
  }
}

// where a body in front covers the character, his outline is drawn over it, pale (the player reads at every
// moment); his mask and box are kept for the measures
function occluded(V, g, lamb, cover) {
  const mask = (V.lambMask ||= new Uint8Array(N)); let x0 = IW, y0 = IH, x1 = -1, y1 = -1, hid = 0;
  for (let p = 0; p < N; p++) { const on = lamb[p * 4 + 3] > 128; mask[p] = on ? 1 : 0; if (!on) continue; const x = p % IW, y = (p / IW) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  V.lambBox = x1 >= 0 ? [x0, y0, x1 - x0 + 1, y1 - y0 + 1] : null;
  g.fillStyle = "rgba(235,235,235,0.9)";
  for (let p = IW; p < N - IW; p++) {
    if (!mask[p] || (mask[p - 1] && mask[p + 1] && mask[p - IW] && mask[p + IW]) || cover[p * 4 + 3] <= 128) continue;
    g.fillRect(p % IW, (p / IW) | 0, 1, 1); hid++;
  }
  V.lambHidden = hid;
}

// the tone tables: for each 8-bit value, the painted colour in shadow and in light (sRGB bytes), built once. A warm
// ink to a cream paper (a mezzotint printed in warm black), the value pulled a little toward the painter's planes,
// the darks glazed toward the palette's violet shadow and the lights toward its lamp, at the dream's 55% saturation
let LUT = null;
const INK = [0.006, 0.0045, 0.006], PAPER = [0.84, 0.74, 0.58];
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function tables() {
  if (LUT) return LUT;
  const P = paletteAt("room", 23.5), sh = new Uint8Array(256 * 3), li = new Uint8Array(256 * 3), T = [0, 0, 0];
  for (let v = 0; v < 256; v++) {
    const L0 = toLin(v), L = L0 > 0 ? planeValue(L0, P.planes, 0.22) : 0, base = INK.map((k, c) => k + (PAPER[c] - k) * Math.min(1, L * 1.25));
    for (const [tab, tint, t] of [[sh, P.shadowA, 0.32 * (1 - ss(0.0, 0.25, L))], [li, P.light, 0.55 * ss(0.01, 0.3, L)]]) {
      glaze(base, tint, t, 0, T);
      const y = 0.2126 * T[0] + 0.7152 * T[1] + 0.0722 * T[2];
      for (let c = 0; c < 3; c++) tab[v * 3 + c] = toByte(y + (T[c] - y) * 0.88);
    }
  }
  return (LUT = { sh, li });
}

// fixed grain and threshold fields (a hash per pixel, two scales so it reads as a rocked plate, not a pattern)
let GRAIN = null;
const h2 = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function grainField() {
  if (GRAIN) return GRAIN;
  const gr = new Float32Array(N), th = new Float32Array(N);
  for (let y = 0; y < IH; y++) for (let x = 0; x < IW; x++) { const p = y * IW + x; gr[p] = 0.6 * h2(x, y, 1) + 0.4 * h2(x >> 1, y >> 1, 2) - 0.5; th[p] = h2(x, y, 3); }
  return (GRAIN = { gr, th });
}

const LEVELS = 24;
// light: per pixel 0..1 from the light map (V.lightMap, a quarter-resolution field the stage fills), how far toward
// the light's glaze a pixel goes
export function tone(V, g) {
  const { sh, li } = tables(), { gr, th } = grainField(), img = g.getImageData(0, 0, IW, IH), d = img.data, LM = V.lightMap, lw = IW >> 2;
  for (let p = 0, i = 0; p < N; p++, i += 4) {
    const v = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255, amp = v < 0.3 ? 0.045 : v < 0.65 ? 0.03 : 0.014;
    const s = Math.min(1, Math.max(0, v + gr[p] * amp)) * LEVELS, lo = Math.floor(s), q = Math.min(LEVELS, lo + (s - lo > th[p] ? 1 : 0)) / LEVELS, b = Math.round(q * 255) * 3;
    const k = LM ? LM[((p / IW) >> 2) * lw + ((p % IW) >> 2)] : 0;
    d[i] = sh[b] + (li[b] - sh[b]) * k; d[i + 1] = sh[b + 1] + (li[b + 1] - sh[b + 1]) * k; d[i + 2] = sh[b + 2] + (li[b + 2] - sh[b + 2]) * k;
  }
  g.putImageData(img, 0, 0);
}

// the light map: the shaft (inside its trapezoid, soft at the sides) and the lamps' pools on the floor
export function lightMap(V, lit) {
  const lw = IW >> 2, lh = IH >> 2, M = (V.lightMap ||= new Float32Array(lw * lh)), G = V.stage, sh = G.st.shaft, [sx, sy] = G.src, [px, py, rx] = G.pool, W = V.W;
  for (let j = 0; j < lh; j++) for (let i = 0; i < lw; i++) {
    const x = i * 4 + 2, y = j * 4 + 2, u = (y - sy) / Math.max(1, py - sy);
    let k = 0;
    if (u >= 0 && u <= 1.1) { const cx = sx + (px - sx) * u, hw = sh.w0 / 2 + (rx - sh.w0 / 2) * u; k = Math.max(0, 1 - Math.abs(x - cx) / Math.max(1, hw)) * 0.8; }
    if (y > G.yBack) { const wx = V.cam.x + (x - IW / 2 - V.sx) / 30, wz = V.cam.z + (y - IH / 2 - V.sy) / (30 * 0.62); k = Math.max(k, Math.min(1, W.field.lightAt(wx, wz, lit) * 1.3) * 0.7); }
    M[j * lw + i] = k;
  }
}
export { toLin };
