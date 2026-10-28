// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// plate.mjs: a study plate, the artifact shown as its own parts. Everything on the plate is read from the render:
//   sheets      the medium readouts (material, lines, type, paint) as a fanned stack of prints, back to front
//   graph       each element joined to each medium; an edge's width is the measured transparency record (the
//               correlation between the element's ticks and that medium's readout), its colour the element's ink,
//               and an edge the study could not measure is drawn as a dotted hairline
//   spectrogram the sound's 72 band envelopes, which are the picture read as a score
//   words       title and line set in Accession through the house forge (real outlines, nonzero fill)
// Linear-light float RGB in, linear-light float RGB out; the caller encodes. Any aspect: the layout is proportional.
import { setText } from '../../adapters/type.mjs';
import { fillNonzero } from '../fill.mjs';
import { hexLin } from '../../../creation/lib/core/layer.mjs';
import { MEDIA } from './ir.mjs';

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);

// area-average downscale of a linear RGB image to w x h
function shrink(src, W, H, w, h) {
  const out = new Float32Array(3 * w * h), sx = W / w, sy = H / h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx)), y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
    let r = 0, g = 0, b = 0;
    for (let j = y0; j < y1; j++) for (let i = x0; i < x1; i++) { const k = 3 * (j * W + i); r += src[k]; g += src[k + 1]; b += src[k + 2]; }
    const n = (x1 - x0) * (y1 - y0), o = 3 * (y * w + x); out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n;
  }
  return out;
}

// draw an image of size w x h centred at (cx, cy), rotated by a radians, with a soft drop shadow underneath
function sheet(P, PW, PH, img, w, h, cx, cy, a, shadow = 0.38) {
  const c = Math.cos(a), s = Math.sin(a), hw = w / 2, hh = h / 2, R = Math.ceil(Math.hypot(hw, hh)) + 40;
  const blur = Math.max(6, w * 0.025), off = [w * 0.012, w * 0.022];
  for (let Y = Math.max(0, Math.floor(cy - R)); Y < Math.min(PH, Math.ceil(cy + R)); Y++) for (let X = Math.max(0, Math.floor(cx - R)); X < Math.min(PW, Math.ceil(cx + R)); X++) {
    // shadow: distance outside the offset rectangle, falling off over `blur`
    const dx = X - cx - off[0], dy = Y - cy - off[1], u = c * dx + s * dy, v = -s * dx + c * dy;
    const ex = Math.max(0, Math.abs(u) - hw), ey = Math.max(0, Math.abs(v) - hh), d = Math.hypot(ex, ey);
    if (d < blur * 2) { const t = shadow * Math.exp(-(d * d) / (blur * blur)), k = 3 * (Y * PW + X); for (let q = 0; q < 3; q++) P[k + q] *= 1 - t; }
  }
  for (let Y = Math.max(0, Math.floor(cy - R)); Y < Math.min(PH, Math.ceil(cy + R)); Y++) for (let X = Math.max(0, Math.floor(cx - R)); X < Math.min(PW, Math.ceil(cx + R)); X++) {
    const dx = X + 0.5 - cx, dy = Y + 0.5 - cy, u = c * dx + s * dy + hw, v = -s * dx + c * dy + hh;
    if (u < -1 || v < -1 || u > w + 1 || v > h + 1) continue;
    const cov = clamp(Math.min(u + 0.5, w + 0.5 - u, v + 0.5, h + 0.5 - v));   // antialiased sheet edge
    if (!cov) continue;
    const x = clamp(u - 0.5, 0, w - 1.001), y = clamp(v - 0.5, 0, h - 1.001), i = x | 0, j = y | 0, fx = x - i, fy = y - j, k = 3 * (Y * PW + X);
    for (let q = 0; q < 3; q++) {
      const A = img[3 * (j * w + i) + q], B = img[3 * (j * w + i + 1) + q], C = img[3 * ((j + 1) * w + i) + q], D = img[3 * ((j + 1) * w + i + 1) + q];
      P[k + q] += ((A * (1 - fx) + B * fx) * (1 - fy) + (C * (1 - fx) + D * fx) * fy - P[k + q]) * cov;
    }
  }
}

// words, spaced by profile: each glyph is set alone at one height-bound scale and rasterised; the next glyph is
// placed so the mean row-by-row distance between the facing ink profiles equals the gap, and no row comes closer
// than a third of it. That is how a type designer kerns by eye, so the unkerned forge masters set as a word
// (an "r" before an "a" closes up under its arm instead of keeping a box's width away).
function text(P, PW, PH, str, x, y, w, h, ink, { style = 'display', weight = 800, fill = 0.98, track = 0.07 } = {}) {
  const gap = h * track, glyphs = [];
  for (const ch of str) {
    if (ch === ' ') { glyphs.push(null); continue; }
    const { polys } = setText(ch, h * 8, h, { style, weight, fill });
    if (!polys.length) { glyphs.push(null); continue; }
    let x0 = Infinity, x1 = -Infinity; for (const p of polys) for (const [q] of p) { x0 = Math.min(x0, q); x1 = Math.max(x1, q); }
    const gw = Math.ceil(x1 - x0) + 2, local = polys.map(p => p.map(([q, r]) => [q - x0 + 1, r])), cov = fillNonzero(local, gw, h);
    const L = new Float32Array(h).fill(NaN), R = new Float32Array(h).fill(NaN);
    for (let j = 0; j < h; j++) for (let i = 0; i < gw; i++) if (cov[j * gw + i] > 0.3) { if (Number.isNaN(L[j])) L[j] = i; R[j] = i; }
    glyphs.push({ local, gw, L, R });
  }
  const placed = []; let prev = null, pen = 0, end = 0;
  for (const g of glyphs) {
    if (!g) { pen = end + h * 0.26; prev = null; continue; }
    let at = pen;
    if (prev) {
      // d: where the new glyph's box starts, relative to the previous glyph's box start (prev.at)
      let sum = 0, n = 0, need = -Infinity;
      for (let j = 0; j < h; j++) { if (Number.isNaN(prev.g.R[j]) || Number.isNaN(g.L[j])) continue; const base = prev.g.R[j] - g.L[j]; sum += base; n++; need = Math.max(need, base + gap / 3); }
      const d = n ? Math.max(sum / n + gap, need) : prev.g.gw + gap;
      at = prev.at + Math.max(d, prev.g.gw * 0.35);
    }
    placed.push(...g.local.map(p => p.map(([q, r]) => [q + at, r])));
    prev = { g, at }; end = at + g.gw;
  }
  const span = Math.max(1, end), k = Math.min(1, w / span), polys = placed.map(p => p.map(([q, r]) => [q * k, h / 2 + (r - h / 2) * k]));
  const cw = Math.ceil(Math.min(w, span * k)) + 2, cov = fillNonzero(polys, cw, h);
  for (let j = 0; j < h; j++) for (let i = 0; i < cw; i++) {
    const a = cov[j * cw + i]; if (!a) continue; const X = Math.round(x + i), Y = Math.round(y + j); if (X < 0 || Y < 0 || X >= PW || Y >= PH) continue;
    const q0 = 3 * (Y * PW + X); for (let q = 0; q < 3; q++) P[q0 + q] += (ink[q] - P[q0 + q]) * a;
  }
  return span * k;
}

// a cubic Bezier stroke, width wd, colour ink at opacity op; dotted when dash
function curve(P, PW, PH, p0, p1, p2, p3, wd, ink, op, dash = false) {
  const n = Math.ceil(Math.hypot(p3[0] - p0[0], p3[1] - p0[1]) / 1.5), r = wd / 2;
  for (let t = 0; t <= n; t++) {
    if (dash && (t % 18) > 6) continue;
    const u = t / n, m = 1 - u, x = m * m * m * p0[0] + 3 * m * m * u * p1[0] + 3 * m * u * u * p2[0] + u * u * u * p3[0], y = m * m * m * p0[1] + 3 * m * m * u * p1[1] + 3 * m * u * u * p2[1] + u * u * u * p3[1];
    for (let Y = Math.floor(y - r - 1); Y <= Math.ceil(y + r + 1); Y++) for (let X = Math.floor(x - r - 1); X <= Math.ceil(x + r + 1); X++) {
      if (X < 0 || Y < 0 || X >= PW || Y >= PH) continue;
      const a = clamp(r + 0.5 - Math.hypot(X + 0.5 - x, Y + 0.5 - y)) * op * 0.35; if (!a) continue;
      const k = 3 * (Y * PW + X); for (let q = 0; q < 3; q++) P[k + q] += (ink[q] - P[k + q]) * a;
    }
  }
}

function disc(P, PW, PH, cx, cy, rad, ink, ring = null) {
  for (let Y = Math.floor(cy - rad - 2); Y <= Math.ceil(cy + rad + 2); Y++) for (let X = Math.floor(cx - rad - 2); X <= Math.ceil(cx + rad + 2); X++) {
    if (X < 0 || Y < 0 || X >= PW || Y >= PH) continue;
    const d = Math.hypot(X + 0.5 - cx, Y + 0.5 - cy), a = clamp(rad + 0.5 - d), k = 3 * (Y * PW + X);
    if (a) for (let q = 0; q < 3; q++) P[k + q] += (ink[q] - P[k + q]) * a;
    if (ring) { const b = clamp(1.4 - Math.abs(d - rad - 3)) ; if (b) for (let q = 0; q < 3; q++) P[k + q] += (ring[q] - P[k + q]) * b * 0.8; }
  }
}

const RAMP = ['#0f1220', '#2b3a6b', '#6b3a6b', '#a4482a', '#d99a3c', '#f2e6c8'].map(hexLin);
function ramp(v) { const x = clamp(v) * (RAMP.length - 1), i = Math.min(RAMP.length - 2, x | 0), f = x - i; return RAMP[i].map((c, q) => c + (RAMP[i + 1][q] - c) * f); }

export function plate(out, { W = 3840, H = 2160, title = 'Superframe', line = 'one recipe, every medium', ground = '#14161c', paper = '#ece6d9' } = {}) {
  const P = new Float32Array(3 * W * H), G = hexLin(ground), ink = hexLin(paper), dim = ink.map(c => c * 0.55);
  for (let k = 0; k < W * H; k++) P.set(G, 3 * k);
  const { r } = out, [SW, SH] = r.size, u = Math.min(W / 3840, H / 2160);
  // sheets: back to front, fanned around the left-centre
  const sw = Math.round(W * 0.43), sh = Math.round(sw * SH / SW), cx = W * 0.275, cy = H * 0.52;
  const layers = [['material', out.material.preview()], ['lines', out.lines.rgb], ['type', out.type.rgb], ['paint', out.paint.rgb]];
  layers.forEach(([, img], i) => {
    const a = (-9 + i * 5) * Math.PI / 180, ox = (i - 1.5) * W * 0.022, oy = (i - 1.5) * H * 0.028;
    sheet(P, W, H, shrink(img, SW, SH, sw, sh), sw, sh, cx + ox, cy + oy, a);
  });
  // graph: elements on the left of the panel, media on the right
  const gx0 = W * 0.64, gx1 = W * 0.93, gy0 = H * 0.30, gy1 = H * 0.70, els = out.study.elements, md = [...MEDIA];
  const ey = i => gy0 + (gy1 - gy0) * (els.length === 1 ? 0.5 : i / (els.length - 1)), my = i => gy0 + (gy1 - gy0) * (i / (md.length - 1));
  els.forEach((e, i) => md.forEach((m, j) => {
    const t = e.transparency_record[m], c = t.correlation, ink2 = hexLin(e.properties.ink.startsWith('#') ? e.properties.ink : '#888888');
    const p0 = [gx0, ey(i)], p3 = [gx1, my(j)], mid = (gx0 + gx1) / 2;
    if (c === null || !t.weight) curve(P, W, H, p0, [mid, p0[1]], [mid, p3[1]], p3, 1.6 * u, dim, 0.9, true);
    else curve(P, W, H, p0, [mid, p0[1]], [mid, p3[1]], p3, Math.max(1.5, 22 * u * Math.max(0, c)), ink2.map(v => Math.min(1, v * 1.35 + 0.06)), 0.35 + 0.65 * Math.max(0, c));
  }));
  els.forEach((e, i) => disc(P, W, H, gx0, ey(i), (10 + 26 * Math.sqrt(e.properties.coverage)) * u, hexLin(e.properties.ink), ink));
  md.forEach((m, j) => { disc(P, W, H, gx1, my(j), 9 * u, ink); text(P, W, H, m, gx1 + 26 * u, my(j) - 22 * u, Math.round(260 * u), Math.round(46 * u), ink, { style: 'text', weight: 500, fill: 0.9, track: 0.15 }); });
  els.forEach((e, i) => text(P, W, H, e.id, gx0 - 250 * u, ey(i) - 20 * u, Math.round(200 * u), Math.round(40 * u), dim, { style: 'text', weight: 500, fill: 0.9, track: 0.15 }));
  // spectrogram strip: the sound's band envelopes, time to the right, pitch up
  const env = out.sound.env, B = env.length, cols = env[0].length, sx0 = W * 0.60, sx1 = W * 0.95, sy0 = H * 0.78, sy1 = H * 0.90;
  let peak = 1e-6; for (const e of env) for (const v of e) peak = Math.max(peak, v);
  for (let Y = Math.floor(sy0); Y < sy1; Y++) for (let X = Math.floor(sx0); X < sx1; X++) {
    const b = Math.min(B - 1, Math.floor((sy1 - Y) / (sy1 - sy0) * B)), c = Math.min(cols - 1, Math.floor((X - sx0) / (sx1 - sx0) * cols));
    const v = Math.sqrt(env[b][c] / peak), col = ramp(v), k = 3 * (Y * W + X); for (let q = 0; q < 3; q++) P[k + q] = col[q];
  }
  // words
  text(P, W, H, title, W * 0.60, H * 0.075, Math.round(W * 0.36), Math.round(H * 0.12), ink, { style: 'display', weight: 800, fill: 0.98, track: 0.11 });
  text(P, W, H, line, W * 0.60, H * 0.19, Math.round(W * 0.34), Math.round(H * 0.05), dim, { style: 'text', weight: 400, fill: 0.95, track: 0.13 });
  text(P, W, H, 'sound: time to the right, pitch up', sx0, sy1 + H * 0.018, Math.round(W * 0.3), Math.round(H * 0.035), dim, { style: 'text', weight: 400, fill: 0.9, track: 0.15 });
  return { W, H, rgb: P };
}
