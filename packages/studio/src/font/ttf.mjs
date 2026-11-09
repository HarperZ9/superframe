// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
// ttf.mjs: a minted face becomes an installable TrueType font. A port of Flywheel's harness/typeface_ttf.py
// (HarperZ9/flywheel@681810fe), table by table. The forge's polygon rings are valid TrueType contours (every
// point on-curve), so the file carries exactly the outlines the legibility rules approved, with no curve
// fitting. Timestamps are pinned, so the same face gives the same font bytes; tests/font.test.mjs holds this
// port to the font bytes Flywheel wrote at that commit (goldens/font.golden.json).
//
//   import { mint, DEFAULTS } from '../../../../typeface/forge/upstream/type-forge/forge.mjs';
//   const ttf = toTtf(mint({ ...DEFAULTS }, 58), 'Zain Mint', 'Regular');   // Uint8Array
import { pyRound } from '../../../../typeface/forge/upstream/type-forge/pyround.mjs';
import { pack, concat, Bytes } from './struct.mjs';

export const EM = 1000;
const EPOCH = 3768211200n;   // 2023-06-01 in longdatetime units, pinned (the source's _EPOCH)

export const log2i = n => Math.floor(Math.log2(n));
export const round = x => pyRound(x);   // Python round(): half to even on the exact binary value

export const pad4 = b => (b.length % 4 ? concat(b, new Uint8Array(4 - (b.length % 4))) : b);

export function checksum(b) {
  const p = pad4(b), dv = new DataView(p.buffer, p.byteOffset, p.byteLength);
  let s = 0;
  for (let i = 0; i < p.length; i += 4) s = (s + dv.getUint32(i)) >>> 0;
  return s;
}

// One glyf entry from integer contours. Returns [bytes, [xmin, ymin, xmax, ymax], points, contours].
export function glyfEntry(contours) {
  const xs = contours.flatMap(c => c.map(([x]) => x)), ys = contours.flatMap(c => c.map(([, y]) => y));
  const xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys);
  const out = new Bytes().push(pack('>hhhhh', contours.length, xmin, ymin, xmax, ymax));
  const ends = [];
  let n = 0;
  for (const c of contours) { n += c.length; ends.push(n - 1); }
  out.push(pack(`>${ends.length}H`, ...ends)).push(pack('>H', 0));   // no instructions
  out.push(new Uint8Array(n).fill(1));                                // every point on-curve
  let px = 0, py = 0;
  for (const c of contours) for (const [x] of c) { out.push(pack('>h', x - px)); px = x; }
  for (const c of contours) for (const [, y] of c) { out.push(pack('>h', y - py)); py = y; }
  return [out.bytes(), [xmin, ymin, xmax, ymax], n, contours.length];
}

// cmap: format 4 with one segment per code point, Windows Unicode BMP.
export function cmap(tableMap) {
  const codes = [...tableMap.keys()].sort((a, b) => a - b);
  const segs = [...codes.map(c => [c, c, tableMap.get(c)]), [0xffff, 0xffff, null]];
  const segCount = segs.length, sc2 = segCount * 2, search = 2 ** log2i(segCount) * 2;
  const deltas = segs.map(([s, , g]) => (g !== null ? (g - s) & 0xffff : 1)).map(d => (d > 0x7fff ? d - 0x10000 : d));
  const tail = concat(
    pack('>HHHH', sc2, search, log2i(search / 2), sc2 - search),
    pack(`>${segCount}H`, ...segs.map(([, e]) => e)), pack('>H', 0),
    pack(`>${segCount}H`, ...segs.map(([s]) => s)), pack(`>${segCount}h`, ...deltas), pack(`>${segCount}H`, ...segs.map(() => 0)));
  return concat(pack('>HHHHL', 0, 1, 3, 1, 12), pack('>HHH', 4, tail.length + 6, 0), tail);
}

const utf16be = s => {
  const b = new Uint8Array(s.length * 2);
  for (let i = 0; i < s.length; i++) { b[2 * i] = s.charCodeAt(i) >> 8; b[2 * i + 1] = s.charCodeAt(i) & 0xff; }
  return b;
};

// name: family, style, unique, full and PostScript names; extra rows are [nameID, string] (named instances).
export function name(family, style = 'Regular', extra = []) {
  const recs = [[1, family], [2, style], [3, `${family} ${style}`], [4, `${family} ${style}`],
    [6, family.replaceAll(' ', '') + '-' + style.replaceAll(' ', '')], ...extra];
  const stored = new Bytes(), entries = new Bytes();
  for (const [nid, s] of recs) {
    const enc = utf16be(s);
    entries.push(pack('>HHHHHH', 3, 1, 0x409, nid, enc.length, stored.length));
    stored.push(enc);
  }
  return concat(pack('>HHH', 0, recs.length, 6 + 12 * recs.length), entries.bytes(), stored.bytes());
}

// Assemble tables (an object of tag -> bytes) into a checksummed sfnt.
export function sfnt(tables) {
  const tags = Object.keys(tables).sort(), n = tags.length, p2 = 2 ** log2i(n);
  const header = pack('>LHHHH', 0x00010000, n, p2 * 16, log2i(p2), (n - p2) * 16);
  let offset = 12 + 16 * n;
  const dir = new Bytes(), body = new Bytes(), offsets = {};
  for (const tag of tags) {
    const data = tables[tag];
    offsets[tag] = offset;
    dir.push(pack('>4sLLL', tag, checksum(data), offset, data.length));
    body.push(pad4(data));
    offset += pad4(data).length;
  }
  const font = concat(header, dir.bytes(), body.bytes());
  const adjust = (0xb1b0afba - checksum(font)) >>> 0;
  new DataView(font.buffer).setUint32(offsets.head + 8, adjust);
  return font;
}

// Python sorted() on str compares code points; the forge charset is ASCII, where that equals code-unit order.
export const sortedKeys = o => Object.keys(o).sort();

function tableHead(gxmin, gymin, gxmax, gymax, epoch, dirHint) {
  return pack('>LLLLHHQQhhhhHHhhh', 0x00010000, 0x00010000, 0, 0x5f0f3cf5, 0b11, EM, epoch, epoch, gxmin, gymin, gxmax, gymax, 0, 8, dirHint, 1, 0);
}

export function tableHhea(ascent, descent, hmtx, gxmax, n) {
  return pack('>LhhhHhhhhhhhhhhhH', 0x00010000, ascent, descent, 0, Math.max(...hmtx.map(([a]) => a)), Math.min(...hmtx.map(([, l]) => l)),
    0, gxmax, 1, 0, 0, 0, 0, 0, 0, 0, n);
}

export const tableMaxp = (n, pts, ctrs) => pack('>LHHHHHHHHHHHHHH', 0x00010000, n, pts, ctrs, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0);
export const tablePost = () => pack('>LLhhLLLLLL', 0x00030000, 0, -75, 50, 0, 0, 0, 0, 0, 0);
export const tableHmtx = hmtx => concat(...hmtx.map(([a, l]) => pack('>Hh', a, l)));
export { tableHead };

function tableOs2(hmtx, weight, ascent, descent, xh) {
  const n = hmtx.length;
  return concat(
    pack('>HhHHHhhhhhhhhhhhh', 4, Math.floor(hmtx.reduce((a, [w]) => a + w, 0) / n), Math.max(100, Math.min(900, round(weight * 4706))), 5, 0,
      650, 600, 0, 0, 650, 600, 0, 0, 75, 50, 0, 0),
    new Uint8Array(10),                                   // panose
    pack('>LLLL', 1, 0, 0, 0),                            // unicode ranges
    pack('>4s', 'ZLAB'),
    pack('>HHHhhhHH', 0x40, 32, 115, ascent, descent, 0, ascent, -descent),
    pack('>LLhhHHH', 1, 0, xh, 0, 0, 32, 1));
}

function tableKern(face, chars) {
  const gid = Object.fromEntries(chars.map((ch, i) => [ch, 2 + i]));
  const pairs = Object.entries(face.kerning ?? {})
    .filter(([p, v]) => gid[p[0]] !== undefined && gid[p[1]] !== undefined && Math.trunc(v) !== 0)
    .map(([p, v]) => [gid[p[0]], gid[p[1]], Math.trunc(v)])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  if (!pairs.length) return null;
  const np = pairs.length, p2k = 2 ** log2i(np);
  const sub = concat(pack('>HHHHHHH', 0, 14 + 6 * np, 0x0001, np, p2k * 6, log2i(p2k), (np - p2k) * 6), ...pairs.map(([l, r, v]) => pack('>HHh', l, r, v)));
  return concat(pack('>HH', 0, 1), sub);
}

// The rounded glyf contours of one forge glyph: the ring's closing point dropped, rings under 3 points skipped.
export const glyphContours = g => g.contours.map(ring => ring.slice(0, -1).map(([x, y]) => [round(x), round(y)])).filter(c => c.length >= 3);

// A minted face document (forge.mint output) to TrueType font bytes.
export function toTtf(face, family = 'Zain Mint', style = 'Regular') {
  const gsrc = face.glyphs, chars = sortedKeys(gsrc), order = ['.notdef', 'space', ...chars];
  const cmapMap = new Map([[32, 1]]);
  chars.forEach((ch, i) => cmapMap.set(ch.codePointAt(0), 2 + i));

  const glyf = new Bytes(), loca = [0], hmtx = [];
  let gxmin = 32767, gymin = 32767, gxmax = -32768, gymax = -32768, maxPts = 0, maxCtrs = 0;
  for (const gname of order) {
    if (gname === '.notdef' || gname === 'space') { hmtx.push([gname === 'space' ? 250 : 600, 0]); loca.push(glyf.length); continue; }
    const g = gsrc[gname];
    const [entry, [x0, y0, x1, y1], npts, nctr] = glyfEntry(glyphContours(g));
    glyf.push(pad4(entry));
    loca.push(glyf.length);
    hmtx.push([round(g.advance), round(g.lsb)]);
    gxmin = Math.min(gxmin, x0); gymin = Math.min(gymin, y0); gxmax = Math.max(gxmax, x1); gymax = Math.max(gymax, y1);
    maxPts = Math.max(maxPts, npts); maxCtrs = Math.max(maxCtrs, nctr);
  }

  const n = order.length, ascent = Math.max(gymax + 60, 900), descent = Math.min(gymin - 40, -180);
  const xh = Math.trunc(face.metrics?.x_height ?? 500), weight = face.receipt?.params?.weight ?? 0.085;
  const tables = {
    cmap: cmap(cmapMap), glyf: glyf.bytes(), head: tableHead(gxmin, gymin, gxmax, gymax, EPOCH, 2), hhea: tableHhea(ascent, descent, hmtx, gxmax, n),
    hmtx: tableHmtx(hmtx), loca: pack(`>${loca.length}L`, ...loca), maxp: tableMaxp(n, maxPts, maxCtrs), name: name(family, style),
    post: tablePost(), 'OS/2': tableOs2(hmtx, weight, ascent, descent, xh),
  };
  const kern = tableKern(face, chars);
  if (kern) tables.kern = kern;
  return sfnt(tables);
}
