// Stage 2 of the plate bake, on Float32 RGB frames (8 Mpx plates do not fit the Float64 RGBA path):
// display encode (the engine's labEncode8 curve), the engine painter, an ink pass that is heavy on
// silhouettes and light on folds, back to scene-linear for the lens, the Low Water grade, and the
// lens split into layers the player's settings mix: halo, streak, flare (starburst), ca.
// Ghosts are left out of plates: they mirror about the screen centre, and a scrolling plate has
// none. Original glue code; the lens terms follow web/shaders/lens (plan constants from resolveLens).
import { rn } from "../rn.mjs";
import { lwLook } from "../grade.mjs";
const PAINT = await import(rn("web/shaders/paintover/painter.mjs")), LENS = await import(rn("web/shaders/lens/plan.mjs")), LP = await import(rn("web/shaders/lens/params.mjs"));
const SPEC = await import(rn("web/shaders/lens/spectrum.mjs"));

const enc1 = (v, gain) => { const l = Math.min(1, 1 - Math.exp(-Math.max(0, v) * gain)); return l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055; };
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
// Float32 RGB (scene-linear) to RGBA8 display.
export function encode(rgb, n, gain) { const o = new Uint8ClampedArray(n * 4); for (let i = 0; i < n; i++) { for (let c = 0; c < 3; c++) o[i * 4 + c] = Math.round(enc1(rgb[i * 3 + c], gain) * 255); o[i * 4 + 3] = 255; } return o; }

// The engine painter over the display frame; ink is ours (below).
// Big plates are painted in horizontal bands that overlap and cross-fade, to keep memory in hand.
export function paint(rgba8, W, H, pid, nrm, opt, bandRows = 1100, over = 160) {
  if (H <= bandRows + over) return paintBand(rgba8, W, 0, H, pid, nrm, opt);
  const out = new Uint8ClampedArray(W * H * 4); let prevEnd = 0;
  for (let y0 = 0; y0 < H; y0 += bandRows) {
    const a = Math.max(0, y0 - over), b = Math.min(H, y0 + bandRows + over), p = paintBand(rgba8, W, a, b, pid, nrm, opt);
    for (let y = a; y < b; y++) {
      const w = y < y0 ? (y - a) / Math.max(1, y0 - a) : 1; // fade in over the overlap with the band above
      if (y >= y0 + bandRows + over) break;
      for (let x = 0; x < W; x++) { const i = (y * W + x) * 4, j = ((y - a) * W + x) * 4; for (let c = 0; c < 4; c++) out[i + c] = y < prevEnd ? out[i + c] * (1 - w) + p[j + c] * w : p[j + c]; }
    }
    prevEnd = b;
  }
  return out;
}
function paintBand(rgba8, W, a, b, pid, nrm, opt) {
  const h = b - a, n = W * h, rgb = new Float32Array(n * 3); for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) rgb[i * 3 + c] = rgba8[(a * W + i) * 4 + c] / 255;
  return PAINT.paint({ w: W, h, rgb }, { id: pid.subarray(a * W, b * W), N: nrm.subarray(a * W * 3, b * W * 3) }, { ...opt, ink: false }).rgba8;
}
const hash = (x, y, s) => { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const vn = (x, y, s) => { const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy); return (hash(x0, y0, s) * (1 - sx) + hash(x0 + 1, y0, s) * sx) * (1 - sy) + (hash(x0, y0 + 1, s) * (1 - sx) + hash(x0 + 1, y0 + 1, s) * sx) * sy; };
// Ink: dark violet-brown, never black. Silhouettes (a depth step) about w px, object edges (a paint
// id change) thinner, folds (a normal crease) light. The line wanders a little, as a pen does.
export function ink(rgba8, W, H, pid, nrm, depth, { w = 2.2, col = [26, 17, 24], seed = 7, sil = 0.9, edge = 0.65, fold = 0.35, depthStep = 0.35 } = {}) {
  const o = new Uint8ClampedArray(rgba8), R = Math.ceil(w), at = (x, y) => Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, ox = (vn(x * 0.07, y * 0.07, seed) - 0.5) * 2.4, oy = (vn(x * 0.07 + 9, y * 0.07, seed + 1) - 0.5) * 2.4, cx = Math.round(x + ox), cy = Math.round(y + oy), c = at(cx, cy);
    const dc = depth[c], idc = pid[c]; let k = 0;
    for (let dy = -R; dy <= R && k < sil; dy++) for (let dx = -R; dx <= R; dx++) {
      const r2 = dx * dx + dy * dy; if (r2 === 0 || r2 > w * w) continue;
      const j = at(cx + dx, cy + dy);
      // silhouettes: this pixel is the near side of a depth step
      if (depth[j] - dc > depthStep * (1 + dc * 0.004)) { k = Math.max(k, sil); break; }
      if (r2 <= (w * 0.55) ** 2 && pid[j] !== idc) k = Math.max(k, edge);
    }
    if (k < fold) { const a = at(cx + 1, cy), b = at(cx, cy + 1); if (idc !== 255) { const d1 = nrm[c * 3] * nrm[a * 3] + nrm[c * 3 + 1] * nrm[a * 3 + 1] + nrm[c * 3 + 2] * nrm[a * 3 + 2], d2 = nrm[c * 3] * nrm[b * 3] + nrm[c * 3 + 1] * nrm[b * 3 + 1] + nrm[c * 3 + 2] * nrm[b * 3 + 2]; if (Math.min(d1, d2) < 0.72) k = fold; } }
    if (k <= 0) continue;
    k *= 0.72 + 0.28 * vn(x * 0.35, y * 0.35, seed + 3);
    for (let ch = 0; ch < 3; ch++) o[i * 4 + ch] = o[i * 4 + ch] * (1 - k) + col[ch] * k;
  }
  return o;
}
// Back to scene-linear: invert the encode; keep the source energy where the light was brighter
// than the painting holds (lamps), so the lens sees the lamp.
export function reHdr(rgba8, src, n, gain, keepAbove = 1.2) {
  const d = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const L = 0.2126 * src[i * 3] + 0.7152 * src[i * 3 + 1] + 0.0722 * src[i * 3 + 2]; for (let c = 0; c < 3; c++) { const l = Math.min(0.995, toLin(rgba8[i * 4 + c] / 255)), v = -Math.log(1 - l) / gain; d[i * 3 + c] = L > keepAbove ? Math.max(v, src[i * 3 + c]) : v; } }
  return d;
}
// The Low Water grade (render/grade.mjs terms, keyed to the hour), into a new Float32 frame.
export function grade(rgb, n, hour, over = {}) {
  const t = { ...lwLook.at(hour), ...over }, o = new Float32Array(n * 3), k = t.toe * 0.12;
  for (let i = 0; i < n; i++) {
    let r = rgb[i * 3] * t.exposure, g = rgb[i * 3 + 1] * t.exposure, b = rgb[i * 3 + 2] * t.exposure;
    const L = 0.2126 * r + 0.7152 * g + 0.0722 * b, crush = L / (L + k + 1e-9), m = Math.min(1, L / t.shadowRange), s = m * m * (3 - 2 * m);
    r *= crush * (t.shadowTint[0] + (1 - t.shadowTint[0]) * s); g *= crush * (t.shadowTint[1] + (1 - t.shadowTint[1]) * s); b *= crush * (t.shadowTint[2] + (1 - t.shadowTint[2]) * s);
    const sh = 1 - s; r += t.lift[0] * sh; g += t.lift[1] * sh; b += t.lift[2] * sh;
    const l2 = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    o[i * 3] = Math.max(0, l2 + (r - l2) * t.saturation); o[i * 3 + 1] = Math.max(0, l2 + (g - l2) * t.saturation); o[i * 3 + 2] = Math.max(0, l2 + (b - l2) * t.saturation);
  }
  return o;
}

// Lens sources: per 16 px tile the over-threshold energy and its centroid (as the engine's
// extractSources, with no cap on the count: a plate holds the whole quay's lamps).
export function sources(rgb, W, H, thr, T = 16) {
  const out = [];
  for (let ty = 0; ty < H; ty += T) for (let tx = 0; tx < W; tx += T) {
    const E = [0, 0, 0]; let sw = 0, sx = 0, sy = 0;
    for (let y = ty; y < Math.min(H, ty + T); y++) for (let x = tx; x < Math.min(W, tx + T); x++) {
      const i = (y * W + x) * 3, Y = 0.2126 * rgb[i] + 0.7152 * rgb[i + 1] + 0.0722 * rgb[i + 2]; if (!(Y > thr)) continue;
      const f = (Y - thr) / Y; E[0] += rgb[i] * f; E[1] += rgb[i + 1] * f; E[2] += rgb[i + 2] * f; const y0 = (Y - thr); sw += y0; sx += (x + 0.5) * y0; sy += (y + 0.5) * y0;
    }
    if (sw > 0) out.push({ x: sx / sw, y: sy / sw, E });
  }
  return out;
}
// Lens glow terms added to a copy of the frame: which = "halo" | "streak" | "star".
export function glow(rgb, W, H, srcs, params, which) {
  const plan = LENS.resolveLens({ ...params }, { width: 1920, height: 1080 }), p = plan.p, B = SPEC.BINS, o = new Float32Array(rgb);
  const sR = plan.R0.map((r) => (p.streakGain * r) / plan.Rbar), ca = Math.cos(p.streakAngle), sa = Math.sin(p.streakAngle), L = p.streakLenPx, sg = p.streakThickPx;
  const star = plan.star, M = star.M, hM = (M - 1) / 2, cell = plan.starCell, sInv = 1 / (cell * cell);
  for (const s of srcs) {
    let rx, ry; if (which === "streak") { rx = Math.ceil(7 * L); ry = Math.ceil(5 * sg + 1); } else if (which === "halo") { rx = ry = Math.ceil(8 * plan.halo[B - 1][1]); } else { rx = ry = Math.ceil(hM * cell); }
    const x0 = Math.max(0, Math.floor(s.x - rx)), x1 = Math.min(W - 1, Math.ceil(s.x + rx)), y0 = Math.max(0, Math.floor(s.y - ry)), y1 = Math.min(H - 1, Math.ceil(s.y + ry));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - s.x, dy = y + 0.5 - s.y, i = (y * W + x) * 3;
      if (which === "streak") { const a = ca * dx + sa * dy, b = -sa * dx + ca * dy, k = (Math.exp(-Math.abs(a) / L) / (2 * L)) * (Math.exp((-b * b) / (2 * sg * sg)) / (sg * 2.5066282746310002)); for (let l = 0; l < B; l++) for (let c = 0; c < 3; c++) o[i + c] += s.E[c] * plan.binRgb[l][c] * sR[l] * k; }
      else if (which === "halo") { const r = Math.hypot(dx, dy); for (let l = 0; l < B; l++) { const h = plan.halo[l], hk = (h[0] * Math.exp(-r / h[1])) / (6.283185307179586 * h[1] * h[1]); for (let c = 0; c < 3; c++) o[i + c] += s.E[c] * plan.binRgb[l][c] * hk; } }
      else { const u = dx / cell + hM, v = dy / cell + hM; if (u < 0 || v < 0 || u > M - 1 || v > M - 1) continue; const xa = Math.min(M - 2, Math.floor(u)), ya = Math.min(M - 2, Math.floor(v)), fx = u - xa, fy = v - ya, j = (ya * M + xa) * 3, d = star.data; for (let c = 0; c < 3; c++) { const t = (d[j + c] * (1 - fx) + d[j + 3 + c] * fx) * (1 - fy) + (d[j + M * 3 + c] * (1 - fx) + d[j + M * 3 + 3 + c] * fx) * fy; o[i + c] += s.E[c] * p.starGain * t * sInv; } }
    }
  }
  return o;
}
// Lateral dispersion about the plate centre (kept so the prototype's ca layer has data; small).
export function chroma(rgb, W, H, params) {
  const plan = LENS.resolveLens({ ...params }, { width: W, height: H }), B = SPEC.BINS, o = new Float32Array(W * H * 3), cx = W / 2, cy = H / 2;
  const smp = (px, py, c) => { const x = Math.min(W - 1.001, Math.max(0, px - 0.5)), y = Math.min(H - 1.001, Math.max(0, py - 0.5)), x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, i = (y0 * W + x0) * 3 + c; return (rgb[i] * (1 - fx) + rgb[i + 3] * fx) * (1 - fy) + (rgb[i + W * 3] * (1 - fx) + rgb[i + W * 3 + 3] * fx) * fy; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const qx = x + 0.5, qy = y + 0.5, i = (y * W + x) * 3; for (let l = 0; l < B; l++) { const s = plan.caScale[l], sx = cx + (qx - cx) / s, sy = cy + (qy - cy) / s; for (let c = 0; c < 3; c++) o[i + c] += plan.binRgb[l][c] * smp(sx, sy, c); } }
  return o;
}
export const lensAt = (hour, body = {}) => ({ ...LP.lensAtHour(hour), ...body });
