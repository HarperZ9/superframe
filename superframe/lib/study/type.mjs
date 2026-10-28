// type.mjs: plate lettering in the house type forge (Accession: text, mono and display styles), set from outlines
// with the forge's own kerning, and filled nonzero into a local box so a label costs only its own area.
import { mintMaster } from '../../../typeface/forge/family/family.mjs';
import { flatten } from '../../../typeface/forge/family/svg.mjs';
import { fillNonzero, contourToPolyline } from '../fill.mjs';

const masters = new Map();
function master(style, weight) {
  const key = `${style}/${weight}`;
  if (!masters.has(key)) {
    const m = mintMaster(style, weight), byChar = new Map(), outlines = new Map();
    for (const [n, g] of Object.entries(m.glyphs)) if (g.unicode && !byChar.has(g.unicode)) byChar.set(g.unicode, n);
    masters.set(key, { m, byChar, outlines, cap: m.k.cap, desc: m.k.desc, asc: m.k.asc });
  }
  return masters.get(key);
}
const glyphOutline = (M, name) => { if (!M.outlines.has(name)) M.outlines.set(name, flatten(M.m.glyphs, name)); return M.outlines.get(name); };

// Lay a string out in em units (1000 per em): [{ name, x }] and the total advance. track is extra em/1000 per glyph.
export function layout(text, { style = 'text', weight = 400, track = 0 } = {}) {
  const M = master(style, weight), out = []; let x = 0, prev = null;
  for (const ch of text) {
    const name = M.byChar.get(ch.codePointAt(0)) ?? M.byChar.get(63);   // unknown characters set as '?'
    if (!name) { x += 300; prev = null; continue; }
    if (prev) x += M.m.kerning?.[`${prev} ${name}`] ?? 0;
    out.push({ name, x }); x += M.m.glyphs[name].advance + track; prev = name;
  }
  return { glyphs: out, advance: Math.max(0, x - track), M };
}
export const measure = (text, size, o) => layout(text, o).advance * size / 1000;
export const metrics = (o = {}) => { const M = master(o.style ?? 'text', o.weight ?? 400); return { cap: M.cap, asc: M.asc, desc: M.desc }; };

// Coverage of a string at pixel size `px` (em), baseline at (bx, by) in pixels. Returns { x0, y0, w, h, cov }.
export function rasterText(text, bx, by, px, o = {}) {
  const { glyphs, M } = layout(text, o), s = px / 1000, polys = [];
  for (const g of glyphs) for (const c of glyphOutline(M, g.name)) polys.push(contourToPolyline(c, ([cx, cy]) => [bx + (g.x + cx) * s, by - cy * s], 4));
  const pts = polys.flat(); if (!pts.length) return null;
  const x0 = Math.floor(Math.min(...pts.map(p => p[0]))) - 1, y0 = Math.floor(Math.min(...pts.map(p => p[1]))) - 1;
  const w = Math.ceil(Math.max(...pts.map(p => p[0]))) - x0 + 2, h = Math.ceil(Math.max(...pts.map(p => p[1]))) - y0 + 2;
  const local = polys.filter(q => q.length > 2).map(q => q.map(([x, y]) => [x - x0, y - y0]));
  return { x0, y0, w, h, cov: fillNonzero(local, w, h) };
}

// Break text into lines no wider than maxW (same units as size).
export function wrap(text, size, maxW, o) {
  const lines = []; let cur = '';
  for (const word of text.split(/\s+/)) {
    const t = cur ? `${cur} ${word}` : word;
    if (cur && measure(t, size, o) > maxW) { lines.push(cur); cur = word; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}
