// render.mjs: draws a plate spec to 8-bit sRGB pixels and PNG bytes. A spec is resolution-free: it is laid out in
// logical units on a page `w` wide and `h` tall, and scaled to the output width (3840 px or more). Swatch colours
// are written as their exact 8-bit codes with no dither, so a hex printed on a plate is the hex in the file.
//   spec = { id, title, w, h, ground, ops: [op...], images: { name: { w, h, rgba } } }
//   ops: rect {x,y,w,h,fill} | poly {pts,fill} | line {pts,width,color} | circle {cx,cy,r,fill}
//        text {x,y,text,size,color,style,weight,align,track} | para {x,y,w,text,size,lead,...} | image {x,y,w,h,src}
import { deflateSync } from 'node:zlib';
import { encodePNG } from '../../../feed-23/build/brush/png.js';
import { fillNonzero } from '../fill.mjs';
import { parseHex } from './cmath.mjs';
import { rasterText, measure, wrap } from './type.mjs';

export const MIN_WIDTH = 3840;

function blendCov(C, x0, y0, w, h, cov, rgb) {
  const { W, H, px } = C;
  for (let y = 0; y < h; y++) { const Y = y0 + y; if (Y < 0 || Y >= H) continue;
    for (let x = 0; x < w; x++) { const X = x0 + x, a = cov[y * w + x]; if (X < 0 || X >= W || a <= 0) continue;
      const p = 4 * (Y * W + X);
      if (a >= 1) { px[p] = rgb[0]; px[p + 1] = rgb[1]; px[p + 2] = rgb[2]; }
      else for (let c = 0; c < 3; c++) px[p + c] = Math.round(px[p + c] * (1 - a) + rgb[c] * a);
    } }
}

function fillPolys(C, polys, rgb, clip = null) {
  const all = polys.flat(); if (!all.length) return;
  let xa = Infinity, ya = Infinity, xb = -Infinity, yb = -Infinity;
  for (const [x, y] of all) { xa = Math.min(xa, x); ya = Math.min(ya, y); xb = Math.max(xb, x); yb = Math.max(yb, y); }
  if (clip) { xa = Math.max(xa, clip[0]); ya = Math.max(ya, clip[1]); xb = Math.min(xb, clip[2]); yb = Math.min(yb, clip[3]); }
  const x0 = Math.max(0, Math.floor(xa)), y0 = Math.max(0, Math.floor(ya)), w = Math.min(C.W, Math.ceil(xb) + (clip ? 0 : 1)) - x0, h = Math.min(C.H, Math.ceil(yb) + (clip ? 0 : 1)) - y0;
  if (w <= 0 || h <= 0) return;
  blendCov(C, x0, y0, w, h, fillNonzero(polys.map(P => P.map(([x, y]) => [x - x0, y - y0])), w, h), rgb);
}

function strokeQuads(pts, hw) {
  const q = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], L = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / L * hw, ny = (x1 - x0) / L * hw;
    q.push([[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]]);
  }
  return q;
}
const circlePts = (cx, cy, r, n = Math.max(24, Math.ceil(r * 0.8))) => Array.from({ length: n }, (_, k) => [cx + r * Math.cos(2 * Math.PI * k / n), cy + r * Math.sin(2 * Math.PI * k / n)]);

// Area-average resample of an RGBA image into a pixel rectangle.
function drawImage(C, img, x0, y0, w, h) {
  const sx = img.w / w, sy = img.h / h;
  for (let y = 0; y < h; y++) { const Y = y0 + y; if (Y < 0 || Y >= C.H) continue;
    const ya = y * sy, yb = (y + 1) * sy;
    for (let x = 0; x < w; x++) { const X = x0 + x; if (X < 0 || X >= C.W) continue;
      const xa = x * sx, xb = (x + 1) * sx; let r = 0, g = 0, b = 0, n = 0;
      for (let j = Math.floor(ya); j < Math.min(img.h, Math.ceil(yb)); j++) { const wy = Math.min(yb, j + 1) - Math.max(ya, j);
        for (let i = Math.floor(xa); i < Math.min(img.w, Math.ceil(xb)); i++) { const wt = wy * (Math.min(xb, i + 1) - Math.max(xa, i)), p = 4 * (j * img.w + i);
          r += img.rgba[p] * wt; g += img.rgba[p + 1] * wt; b += img.rgba[p + 2] * wt; n += wt; } }
      const p = 4 * (Y * C.W + X); C.px[p] = Math.round(r / n); C.px[p + 1] = Math.round(g / n); C.px[p + 2] = Math.round(b / n);
    } }
}

function drawText(C, s, op, x, y, text) {
  const o = { style: op.style ?? 'text', weight: op.weight ?? 400, track: op.track ?? 0 }, size = op.size * s;
  const wd = measure(text, op.size, o) * s, bx = op.align === 'right' ? x - wd : op.align === 'center' ? x - wd / 2 : x;
  const t = rasterText(text, bx, y, size, o); if (t) blendCov(C, t.x0, t.y0, t.w, t.h, t.cov, parseHex(op.color ?? '#e8e6f0'));
}

// Bands of colour laced with two crossed families of diagonal lines, drawn per pixel with exact line coverage, so
// the lace stays inside its rectangle and its mean coverage equals 1 - (1 - width/period)^2.
function drawLace(C, op, s) {
  const x0 = Math.round(op.x * s), y0 = Math.round(op.y * s), w = Math.round(op.w * s), h = Math.round(op.h * s);
  const n = op.colours.length, P = op.period * s, t = op.width * s, lace = parseHex(op.lace), cols = op.colours.map(parseHex), r2 = Math.SQRT1_2;
  const line = u => { const m = ((u % P) + P) % P, d = Math.min(m, P - m); return Math.min(1, Math.max(0, t / 2 - d + 0.5)); };
  for (let y = 0; y < h; y++) { const Y = y0 + y; if (Y < 0 || Y >= C.H) continue;
    for (let x = 0; x < w; x++) { const X = x0 + x; if (X < 0 || X >= C.W) continue;
      const base = cols[Math.min(n - 1, Math.floor(x * n / w))], c1 = line((x + 0.5 - y - 0.5) * r2), c2 = line((x + y + 1) * r2), a = 1 - (1 - c1) * (1 - c2), p = 4 * (Y * C.W + X);
      for (let c = 0; c < 3; c++) C.px[p + c] = Math.round(base[c] * (1 - a) + lace[c] * a);
    } }
}

export function renderPlate(spec, { width = MIN_WIDTH } = {}) {
  if (width < MIN_WIDTH) throw new Error(`study: plates render at ${MIN_WIDTH} px wide or more (asked ${width})`);
  const s = width / spec.w, W = width, H = Math.round(spec.h * s), C = { W, H, px: new Uint8ClampedArray(W * H * 4) };
  const g = parseHex(spec.ground); for (let i = 0; i < W * H; i++) { C.px[4 * i] = g[0]; C.px[4 * i + 1] = g[1]; C.px[4 * i + 2] = g[2]; C.px[4 * i + 3] = 255; }
  const S = ([x, y]) => [x * s, y * s];
  for (const op of spec.ops) {
    if (op.op === 'rect') fillPolys(C, [[[op.x, op.y], [op.x + op.w, op.y], [op.x + op.w, op.y + op.h], [op.x, op.y + op.h]].map(S)], parseHex(op.fill));
    else if (op.op === 'poly') fillPolys(C, [op.pts.map(S)], parseHex(op.fill));
    else if (op.op === 'polys') fillPolys(C, op.polys.map(P => P.map(S)), parseHex(op.fill));
    else if (op.op === 'circle') fillPolys(C, [circlePts(op.cx * s, op.cy * s, op.r * s)], parseHex(op.fill));
    else if (op.op === 'line') for (const q of strokeQuads(op.pts.map(S), Math.max(0.5, (op.width ?? 1) * s / 2))) fillPolys(C, [q], parseHex(op.color), op.clip ? op.clip.map(v => v * s) : null);
    else if (op.op === 'text') drawText(C, s, op, op.x * s, op.y * s, op.text);
    else if (op.op === 'para') wrap(op.text, op.size, op.w, op).forEach((ln, k) => drawText(C, s, op, op.x * s, (op.y + k * (op.lead ?? op.size * 1.4)) * s, ln));
    else if (op.op === 'image') drawImage(C, spec.images[op.src], Math.round(op.x * s), Math.round(op.y * s), Math.round(op.w * s), Math.round(op.h * s));
    else if (op.op === 'lace') drawLace(C, op, s);
    else throw new Error(`study: unknown plate op ${op.op}`);
  }
  return { w: W, h: H, rgba: C.px };
}

export const pngOf = R => encodePNG(R.w, R.h, R.rgba, b => deflateSync(b, { level: 6 }));
export const paraLines = (text, size, w, o) => wrap(text, size, w, o).length;
