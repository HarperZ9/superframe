// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// plates.mjs: the study-plate back end (CORE.md "Study plates"). Every IR property gets a variable type, and the type
// picks the chart; the key variable is encoded by position first (Cleveland and McGill 1984: position, then length,
// angle, area, colour intensity). Plates follow the scientific-plate grammar: a number, a title, named axes, a legend
// tied to the measurement. Drawn into a linear-rgb raster at any size (4K for delivery), with a 5x7 face for labels.
//   typeOf(property)            proportion | ordered | cyclic | spectrum | series | distribution | relation |
//                               pairwise | structure | network
//   PLATES[type](canvas, box, data, meta)   draws one plate and returns { recovered } where the chart can be read back
//   readBack                    the plate's key values re-measured from its own pixels (the clarity proxy)
import { FACE } from '../core/layer.mjs';

const DIG = { '0': '01110100011001110101110011000101110', '1': '00100011000010000100001000010001110', '2': '01110100010000100010001000100011111', '3': '11110000010000101110000010000111110', '4': '00010001100101010010111110001000010', '5': '11111100001111000001000011000101110', '6': '00110010001000011110100011000101110', '7': '11111000010001000100010000100001000', '8': '01110100011000101110100011000101110', '9': '01110100011000101111000010001001100', '%': '11001110010001000100010001001110011', '-': '00000000000000011111000000000000000', ',': '00000000000000000000001100010001000', ':': '00000011000110000000011000110000000', '/': '00001000010001000100010001000010000', '(': '00010001000100001000010000010000010', ')': '01000001000001000010000100010001000', '+': '00000001000010011111001000010000000' };
const GLYPH = { ...FACE, ...DIG };
export const INK = [0.07, 0.07, 0.09], PAPER = [0.95, 0.93, 0.88], MARK = [0.66, 0.23, 0.16];

export function canvas(w, h, bg = PAPER) { const rgb = new Float32Array(w * h * 3); for (let k = 0; k < w * h; k++) rgb.set(bg, 3 * k); return { w, h, rgb }; }
const put = (C, x, y, c, a = 1) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= C.w || y >= C.h) return; const k = 3 * (y * C.w + x); for (let q = 0; q < 3; q++) C.rgb[k + q] += (c[q] - C.rgb[k + q]) * a; };
export const rect = (C, x, y, w, h, c, a = 1) => { for (let j = Math.max(0, y | 0); j < Math.min(C.h, y + h); j++) for (let i = Math.max(0, x | 0); i < Math.min(C.w, x + w); i++) put(C, i, j, c, a); };
export function line(C, x0, y0, x1, y1, c, wd = 2) { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0)) + 1; for (let s = 0; s <= n; s++) { const x = x0 + (x1 - x0) * s / n, y = y0 + (y1 - y0) * s / n; rect(C, x - wd / 2, y - wd / 2, wd, wd, c); } }
export function disc(C, cx, cy, r, c, a = 1) { for (let j = Math.floor(cy - r); j <= cy + r; j++) for (let i = Math.floor(cx - r); i <= cx + r; i++) { const d = Math.hypot(i + 0.5 - cx, j + 0.5 - cy); if (d <= r + 0.5) put(C, i, j, c, a * Math.min(1, r + 0.5 - d)); } }
export function text(C, s, x, y, px = 4, c = INK) { let cx = x; for (const ch of String(s).toUpperCase()) { const g = GLYPH[ch] ?? GLYPH[' ']; for (let j = 0; j < 7; j++) for (let i = 0; i < 5; i++) if (g[j * 5 + i] === '1') rect(C, cx + i * px, y + j * px, px, px, c); cx += 6 * px; } return cx; }
const textW = (s, px) => String(s).length * 6 * px;

export function typeOf(p) {
  if (p.type) return p.type;
  const v = p.values;
  if (p.network) return 'network'; if (p.pairs) return 'pairwise'; if (p.xy) return 'relation'; if (p.order) return 'structure';
  if (p.cyclic) return 'cyclic'; if (p.bands) return 'spectrum'; if (p.times) return 'series'; if (p.samples) return 'distribution';
  if (Array.isArray(v) && Math.abs(v.reduce((a, b) => a + b, 0) - 1) < 1e-3) return 'proportion';
  return 'ordered';
}

function frame(C, box, n, title, xName, yName, px) {
  const [x, y, w, h] = box; rect(C, x, y, w, h, PAPER); line(C, x + 2, y + 2, x + w - 2, y + 2, [0.6, 0.58, 0.54], 2);
  text(C, `${n}`, x + px * 2, y + px * 3, px * 2, MARK); text(C, String(title).slice(0, Math.floor((w - px * 19) / (6 * px))), x + px * 17, y + px * 4, px, INK);
  const inner = [x + px * 16, y + px * 16, w - px * 22, h - px * 30];
  line(C, inner[0], inner[1] + inner[3], inner[0] + inner[2], inner[1] + inner[3], INK, Math.max(2, px / 2)); line(C, inner[0], inner[1], inner[0], inner[1] + inner[3], INK, Math.max(2, px / 2));
  text(C, xName, inner[0] + inner[2] - textW(xName, px * 0.8), inner[1] + inner[3] + px * 4, px * 0.8, INK); text(C, yName, inner[0] + px * 2, inner[1] - px * 5.2, px * 0.6, INK);
  return inner;
}

export const PLATES = {
  // proportion and ordered: bars by position (length from a common baseline), colour as a secondary key
  proportion(C, box, d, m) { const [x, y, w, h] = frame(C, box, m.n, m.title, d.xName ?? 'part', d.yName ?? 'share', m.px), v = d.values, mx = Math.max(...v) || 1, bw = w / v.length; v.forEach((s, i) => { const bh = h * s / mx; rect(C, x + i * bw + bw * 0.15, y + h - bh, bw * 0.7, bh, d.colours?.[i] ?? INK); }); text(C, `MAX ${(mx * 100).toFixed(1)}%`, x + m.px * 2, y + h + m.px * 4, m.px * 0.8); return { recovered: readBars(C, [x, y, w, h], v.length).map(r => r * mx), method: 'bar heights re-measured from the plate pixels' }; },
  ordered(C, box, d, m) { const [x, y, w, h] = frame(C, box, m.n, m.title, d.xName ?? 'step', d.yName ?? 'value', m.px), v = d.values, lo = Math.min(0, ...v), hi = Math.max(...v), bw = w / v.length; v.forEach((s, i) => { const cy = y + h - h * (s - lo) / ((hi - lo) || 1); disc(C, x + (i + 0.5) * bw, cy, m.px * 2.2, d.colours?.[i] ?? INK); if (i) line(C, x + (i - 0.5) * bw, y + h - h * (v[i - 1] - lo) / ((hi - lo) || 1), x + (i + 0.5) * bw, cy, [0.5, 0.5, 0.5], 2); }); return { recovered: null }; },
  cyclic(C, box, d, m) { const [x, y, w, h] = frame(C, box, m.n, m.title, d.xName ?? 'angle', d.yName ?? '', m.px), cx = x + w / 2, cy = y + h / 2, R = Math.min(w, h) * 0.45; for (let a = 0; a < 360; a += 1) put(C, cx + R * Math.cos(a * Math.PI / 180), cy - R * Math.sin(a * Math.PI / 180), INK); d.values.forEach((deg, i) => { const r = R * (0.3 + 0.7 * (d.weights?.[i] ?? 1) / Math.max(...(d.weights ?? [1]))); line(C, cx, cy, cx + r * Math.cos(deg * Math.PI / 180), cy - r * Math.sin(deg * Math.PI / 180), d.colours?.[i] ?? INK, m.px); }); return { recovered: null }; },
  spectrum(C, box, d, m) { return PLATES.series(C, box, { ...d, times: d.bands }, m); },
  series(C, box, d, m) { const [x, y, w, h] = frame(C, box, m.n, m.title, d.xName ?? 'time', d.yName ?? 'value', m.px), t = d.times, v = d.values, t0 = Math.min(...t), t1 = Math.max(...t), lo = Math.min(...v), hi = Math.max(...v); for (let i = 1; i < v.length; i++) line(C, x + w * (t[i - 1] - t0) / (t1 - t0 || 1), y + h - h * (v[i - 1] - lo) / (hi - lo || 1), x + w * (t[i] - t0) / (t1 - t0 || 1), y + h - h * (v[i] - lo) / (hi - lo || 1), MARK, m.px * 0.8); return { recovered: null }; },
  distribution(C, box, d, m) { const s = d.samples, lo = Math.min(...s), hi = Math.max(...s), bins = 24, cnt = new Array(bins).fill(0); for (const v of s) cnt[Math.min(bins - 1, Math.floor((v - lo) / ((hi - lo) || 1) * bins))]++; return PLATES.proportion(C, box, { values: cnt.map(c => c / s.length), xName: d.xName ?? 'value', yName: 'share' }, m); },
  relation(C, box, d, m) { const [x, y, w, h] = frame(C, box, m.n, m.title, d.xName, d.yName, m.px), xs = d.xy.map(p => p[0]), ys = d.xy.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys); d.xy.forEach((p, i) => disc(C, x + w * (p[0] - x0) / (x1 - x0 || 1), y + h - h * (p[1] - y0) / (y1 - y0 || 1), m.px * 2.5 * Math.sqrt(d.sizes?.[i] ?? 1), d.colours?.[i] ?? INK, 0.9)); return { recovered: null }; },
  pairwise(C, box, d, m) { const [x, y, w, h] = frame(C, box, m.n, m.title, d.xName ?? 'part', d.yName ?? 'part', m.px), n = d.pairs.length, cs = Math.min(w, h) / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) rect(C, x + j * cs + 1, y + i * cs + 1, cs - 2, cs - 2, d.pairs[i][j]); return { recovered: null }; },
  structure(C, box, d, m) { const [x, y, w, h] = frame(C, box, m.n, m.title, d.xName ?? 'order', d.yName ?? 'layer', m.px), n = d.order.length; d.order.forEach((c, i) => rect(C, x + w * 0.05 + i * w * 0.05, y + i * h / n, w * 0.9 - i * w * 0.1, h / n - 4, c)); return { recovered: null }; },
  network(C, box, d, m) { const [x, y, w, h] = frame(C, box, m.n, m.title, '', '', m.px), N = d.network.nodes, pos = N.map((nd, i) => [x + w * (nd.x ?? (0.15 + 0.7 * i / Math.max(1, N.length - 1))), y + h * (nd.y ?? 0.5)]); for (const [a, b, wt] of d.network.edges) line(C, pos[a][0], pos[a][1], pos[b][0], pos[b][1], [0.45, 0.45, 0.45], Math.max(2, m.px * wt)); N.forEach((nd, i) => { const r = m.px * 3 + m.px * 14 * Math.sqrt(nd.size ?? 0.1); disc(C, pos[i][0], pos[i][1], r, nd.colour ?? INK, nd.opacity ?? 1); text(C, nd.label, pos[i][0] - textW(nd.label, m.px * 0.8) / 2, pos[i][1] + r + m.px * 2, m.px * 0.8); }); return { recovered: null }; },
};

// read bar heights back from the plate: for each bar, the topmost non-paper pixel in its centre column
export function readBars(C, [x, y, w, h], n) {
  const bw = w / n, out = [];
  for (let i = 0; i < n; i++) { const cx = Math.round(x + (i + 0.5) * bw); let top = y + h; for (let j = Math.round(y); j < y + h; j++) { const k = 3 * (j * C.w + cx); if (Math.abs(C.rgb[k] - PAPER[0]) + Math.abs(C.rgb[k + 1] - PAPER[1]) + Math.abs(C.rgb[k + 2] - PAPER[2]) > 0.05) { top = j; break; } } out.push((y + h - top) / h); }
  return out;
}

// a study set: one plate per property, laid out on a grid; returns the canvas and the per-plate records
export function studySet(props, { W = 3840, H = 2160, cols = 3, title = '' } = {}) {
  const C = canvas(W, H), rows = Math.ceil(props.length / cols), pw = Math.floor(W / cols), ph = Math.floor((H - 120) / rows), px = Math.max(3, Math.round(Math.min(pw, ph) / 140)), recs = [];
  text(C, String(title).slice(0, Math.floor((W - 80) / (6 * Math.round(px * 1.4)))), 40, 30, Math.round(px * 1.4), INK);
  props.forEach((p, i) => { const t = typeOf(p), box = [(i % cols) * pw + 10, 120 + Math.floor(i / cols) * ph + 10, pw - 20, ph - 20], r = PLATES[t](C, box, p, { n: i + 1, title: p.title, px }); const err = r.recovered && p.values ? r.recovered.reduce((s, v, q) => s + Math.abs(v - p.values[q]), 0) / p.values.length / Math.max(1e-9, Math.max(...p.values)) : null; recs.push({ plate: i + 1, title: p.title, type: t, encoding: ['proportion', 'ordered', 'distribution', 'series', 'spectrum', 'relation'].includes(t) ? 'position' : t === 'cyclic' ? 'angle' : t === 'network' ? 'connection and area' : 'area and colour', readBackError: err }); });
  return { canvas: C, plates: recs };
}
