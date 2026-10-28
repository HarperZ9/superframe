// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// bath.mjs: marbling between sources. Each source (an image, a study, a concept) is an ink with an element weight.
// The inks are dropped on one bath and combed, and every point of the bath remembers which source it came from and
// where in that source. So one marbled bath can be read three ways:
//   observe      render it: the sources streak through one another
//   deconstruct  read the provenance: shares, which sources touch and how much, the order along a core sample,
//                and each source recovered from its streaks
//   recreate     the same inks under another seed or comb: a new arrangement with the same weights
//
// Sources are images (render) or concept inks (elements laid as rings; readElements, conceptReading).
// The maps are the ones couple.mjs uses (Lu, Jaffer and others, "Mathematical Marbling", IEEE CG&A 2012):
//   drop  P' = C + (P - C) sqrt(1 + r^2 / |P - C|^2), pushing every ink laid before it outward
//   tine  P' = P + z u^d M, d the distance from the tooth's line
// Both preserve area, so each source keeps a share of the bath equal to its weight while nothing leaves the frame.
// Both invert exactly: a tine moves points along its own line, so d is unchanged; a drop's push inverts as
// P = C + (P' - C) sqrt(1 - r^2 / |P' - C|^2). Provenance is that inverse, run from the last op back.
import { xmur3, Mulberry32 } from '../../../substrate/lib/vendor/superstack.mjs';

const streamOf = s => { const m = new Mulberry32(xmur3(s)); return () => m.nextFloat(); };

// area-true radius: a source of weight share s covers s * fill of the frame
export const areaRadius = (share, fill, w, h) => Math.sqrt(share * fill * w * h / Math.PI);

export function lay({ size = [512, 512], sources, seed = 'bath', tines = 6, fill = 0.45, comb = 0.08, radiusOf = areaRadius, layout = 'sectors' }) {
  const [w, h] = size, total = sources.reduce((a, s) => a + s.weight, 0), rnd = streamOf(`${seed}/bath`), ops = [];
  sources.forEach((s, k) => {
    const r = radiusOf(s.weight / total, fill, w, h);
    ops.push({ kind: 'drop', src: k, cx: (0.3 + 0.4 * rnd()) * w, cy: (0.3 + 0.4 * rnd()) * h, r, r2: r * r });
  });
  for (let t = 0; t < tines; t++) {
    const a = rnd() * Math.PI;
    ops.push({ kind: 'tine', bx: (0.25 + 0.5 * rnd()) * w, by: (0.25 + 0.5 * rnd()) * h, mx: Math.cos(a), my: Math.sin(a), z: comb * w * (rnd() < 0.5 ? -1 : 1), u: Math.exp(-1 / (0.06 * Math.min(w, h))) });
  }
  // wedge rotation per source from its own stream, so picture baths keep their ops byte for byte
  const orient = streamOf(`${seed}/orient`);
  return { w, h, seed, layout, sources: sources.map(s => ({ ...s, rot: orient() * 2 * Math.PI })), ops };
}

export function forwardOp(op, x, y) {
  if (op.kind === 'tine') { const d = Math.abs((x - op.bx) * -op.my + (y - op.by) * op.mx), s = op.z * Math.pow(op.u, d); return [x + s * op.mx, y + s * op.my]; }
  const dx = x - op.cx, dy = y - op.cy, d2 = dx * dx + dy * dy;
  if (d2 === 0) return [x, y];
  const s = Math.sqrt(1 + op.r2 / d2); return [op.cx + dx * s, op.cy + dy * s];
}

// where a point of the finished bath came from: { src, u, v } with (u, v) in the source's unit disk, or src -1 (ground)
export function provenance(bath, x, y) {
  const { ops } = bath;
  for (let q = ops.length - 1; q >= 0; q--) {
    const op = ops[q];
    if (op.kind === 'tine') { const d = Math.abs((x - op.bx) * -op.my + (y - op.by) * op.mx), s = op.z * Math.pow(op.u, d); x -= s * op.mx; y -= s * op.my; continue; }
    const dx = x - op.cx, dy = y - op.cy, d2 = dx * dx + dy * dy;
    if (d2 <= op.r2) return { src: op.src, u: dx / op.r, v: dy / op.r };
    const s = Math.sqrt(1 - op.r2 / d2); x = op.cx + dx * s; y = op.cy + dy * s;
  }
  return { src: -1, u: 0, v: 0 };
}

// a disk point of source k carried forward through every op after its own drop
export function carry(bath, k, u, v) {
  const i = bath.ops.findIndex(o => o.kind === 'drop' && o.src === k), d = bath.ops[i];
  let x = d.cx + u * d.r, y = d.cy + v * d.r;
  for (let q = i + 1; q < bath.ops.length; q++) [x, y] = forwardOp(bath.ops[q], x, y);
  return [x, y];
}

// the provenance map at pixel centres
export function read(bath) {
  const { w, h } = bath, src = new Int16Array(w * h), U = new Float32Array(w * h), V = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = provenance(bath, x + 0.5, y + 0.5), k = y * w + x; src[k] = p.src; U[k] = p.u; V[k] = p.v;
  }
  return { w, h, src, u: U, v: V };
}

// share of the frame per source (the conserved weights) and the ground's share
export function shares(map, n) {
  const c = new Float64Array(n + 1);
  for (const s of map.src) c[s + 1]++;
  const N = map.src.length; return { ground: c[0] / N, sources: Array.from(c.subarray(1), x => x / N) };
}

// which sources meet, and how much: boundary length between each pair (4-neighbour pixel edges), ground as -1
export function contacts(map, n) {
  const { w, h, src } = map, M = Array.from({ length: n + 1 }, () => new Float64Array(n + 1));
  const add = (a, b) => { if (a !== b) { M[a + 1][b + 1]++; M[b + 1][a + 1]++; } };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = y * w + x; if (x + 1 < w) add(src[k], src[k + 1]); if (y + 1 < h) add(src[k], src[k + w]);
  }
  return M.map(r => Array.from(r));
}

// a core sample: the sources met along a straight line, as runs
export function core(map, [x0, y0], [x1, y1], n = 512) {
  const runs = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, x = Math.min(map.w - 1, Math.max(0, Math.round(x0 + (x1 - x0) * t))), y = Math.min(map.h - 1, Math.max(0, Math.round(y0 + (y1 - y0) * t)));
    const s = map.src[y * map.w + x], last = runs[runs.length - 1];
    if (last && last.src === s) last.len++; else runs.push({ src: s, len: 1 });
  }
  return runs;
}

// sample a source image at disk coordinates: the disk covers the image's central square
function sampleDisk(img, u, v) {
  const s = Math.min(img.w, img.h), x = Math.min(img.w - 1, Math.max(0, Math.round(img.w / 2 + u * s / 2 - 0.5))), y = Math.min(img.h - 1, Math.max(0, Math.round(img.h / 2 + v * s / 2 - 0.5)));
  const k = (y * img.w + x) * 4; return [img.rgba[k], img.rgba[k + 1], img.rgba[k + 2]];
}

// observe: the bath in colour; images[k] is { w, h, rgba } or a flat colour [r, g, b]
export function render(map, images, ground = [235, 229, 216]) {
  const out = new Uint8ClampedArray(map.w * map.h * 4);
  for (let k = 0; k < map.src.length; k++) {
    const s = map.src[k], im = s < 0 ? ground : images[s], c = Array.isArray(im) ? im : sampleDisk(im, map.u[k], map.v[k]);
    out[4 * k] = c[0]; out[4 * k + 1] = c[1]; out[4 * k + 2] = c[2]; out[4 * k + 3] = 255;
  }
  return { w: map.w, h: map.h, rgba: out };
}

// deconstruct: source k gathered back from its streaks into its own disk, n x n; coverage is the share of the disk
// that some bath pixel lands on (below 1 where the comb stretched it thinner than a pixel, or ink left the frame)
export function unmarble(map, rendered, k, n = 256) {
  const out = new Uint8ClampedArray(n * n * 4), hit = new Uint8Array(n * n);
  for (let i = 0; i < map.src.length; i++) {
    if (map.src[i] !== k) continue;
    const x = Math.min(n - 1, Math.max(0, Math.floor((map.u[i] * 0.5 + 0.5) * n))), y = Math.min(n - 1, Math.max(0, Math.floor((map.v[i] * 0.5 + 0.5) * n))), j = y * n + x;
    out.set(rendered.rgba.subarray(4 * i, 4 * i + 4), 4 * j); hit[j] = 1;
  }
  let inDisk = 0, covered = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const u = (x + 0.5) / n * 2 - 1, v = (y + 0.5) / n * 2 - 1; if (u * u + v * v > 1) continue; inDisk++; if (hit[y * n + x]) covered++;
  }
  return { w: n, h: n, rgba: out, coverage: covered / inDisk };
}

// ---- concept inks
// A source may carry elements [{ id, weight, colour? }] in place of an image: the ideas a study holds, each with its
// weight. Two layouts inside the drop, both giving element k a share of the disk's area equal to its weight share
// (so, the maps preserving area, that share of the bath):
//   sectors  (default) wedges around the centre, wedge k spanning the turn fraction [cum[k-1], cum[k]), rotated by a
//            seeded angle per source. Every element reaches the rim in proportion to its weight, so its chance to meet
//            the other studies follows its weight (`exposure` measures this).
//   rings    concentric, the way a marbler drops ink inside ink, first element at the centre; ring k covers squared
//            radii [cum[k-1], cum[k]). Only the outer ring touches the other inks before the comb, so the inner
//            elements meet little whatever they weigh. Kept as the traditional look and as the control.
export function rings(elements) {
  const t = elements.reduce((a, e) => a + e.weight, 0); let c = 0;
  return elements.map(e => (c += e.weight / t));
}
export function elementAt(cum, u, v, layout = 'rings', rot = 0) {
  const t = layout === 'sectors' ? (((Math.atan2(v, u) + rot) / (2 * Math.PI)) % 1 + 1) % 1 : u * u + v * v;
  for (let k = 0; k < cum.length; k++) if (t < cum[k]) return k;
  return cum.length - 1;
}

// the element map: for each pixel, the index of the element within its source (-1 for ground)
export function readElements(bath, map, ringsOf = rings) {
  const cums = bath.sources.map(s => (s.elements?.length ? ringsOf(s.elements) : null)), out = new Int16Array(map.src.length);
  const layout = bath.layout ?? 'rings', rot = bath.sources.map(s => s.rot ?? 0);
  for (let i = 0; i < out.length; i++) { const s = map.src[i]; out[i] = s < 0 || !cums[s] ? -1 : elementAt(cums[s], map.u[i], map.v[i], layout, rot[s]); }
  return out;
}

// fairness of the meetings: for each element, its share of the borders across studies over its share of the ink.
// 1 everywhere is fair (each idea meets the others in proportion to how much of it there is). `buried` is the share
// of all ink held by elements whose ratio is under 0.25: ideas that barely meet anything.
export function exposure(bath, map, elem) {
  const { w, h, src } = map, ink = new Map(), border = new Map(), key = i => `${src[i]}:${elem[i]}`;
  const bump = (M, k, by = 1) => M.set(k, (M.get(k) ?? 0) + by);
  for (let i = 0; i < src.length; i++) if (src[i] >= 0 && elem[i] >= 0) bump(ink, key(i));
  const edge = (i, j) => { if (src[i] < 0 || src[j] < 0 || src[i] === src[j]) return; bump(border, key(i)); bump(border, key(j)); };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (x + 1 < w) edge(i, i + 1); if (y + 1 < h) edge(i, i + w); }
  const I = [...ink.values()].reduce((a, b) => a + b, 0), B = [...border.values()].reduce((a, b) => a + b, 0) || 1;
  const rows = [...ink].map(([k, n]) => { const [s, e] = k.split(':').map(Number); return { source: bath.sources[s].id, element: bath.sources[s].elements?.[e]?.id ?? e, ink: n / I, ratio: ((border.get(k) ?? 0) / B) / (n / I) }; });
  const buried = rows.filter(r => r.ratio < 0.25).reduce((a, r) => a + r.ink, 0);
  const mean = rows.reduce((a, r) => a + r.ink * r.ratio, 0), cv = Math.sqrt(rows.reduce((a, r) => a + r.ink * (r.ratio - mean) ** 2, 0)) / (mean || 1);
  return { rows: rows.sort((a, b) => a.ratio - b.ratio), buried, cv };
}

// the readings at the level of ideas: each concept's share of the bath, and the borders between concepts, split into
// borders inside one source (the study's own structure) and borders across sources (meetings the marbling made)
export function conceptReading(bath, map, elem) {
  const { w, h, src } = map, N = src.length, key = i => (src[i] < 0 ? null : bath.sources[src[i]].elements?.[elem[i]]?.id ?? null);
  const share = new Map(), within = new Map(), across = new Map();
  const bump = (M, k, by = 1) => M.set(k, (M.get(k) ?? 0) + by);
  for (let i = 0; i < N; i++) { const k = key(i); if (k) bump(share, k, 1 / N); }
  const edge = (i, j) => {
    const a = key(i), b = key(j); if (!a || !b || (a === b && src[i] === src[j])) return;
    const pair = a < b ? `${a} + ${b}` : `${b} + ${a}`; bump(src[i] === src[j] ? within : across, pair);
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (x + 1 < w) edge(i, i + 1); if (y + 1 < h) edge(i, i + w); }
  const list = M => [...M].map(([pair, n]) => ({ pair, edge: n })).sort((a, b) => b.edge - a.edge);
  return { shares: Object.fromEntries([...share].sort((a, b) => b[1] - a[1])), within: list(within), across: list(across) };
}

const hexRGB = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
// a stable colour for an element with none measured
const fallback = id => { let x = 0; for (const c of id) x = (x * 31 + c.charCodeAt(0)) >>> 0; return [60 + (x & 127), 60 + ((x >> 7) & 127), 60 + ((x >> 14) & 127)]; };

export function renderConcepts(bath, map, elem, ground = [235, 229, 216]) {
  const pal = bath.sources.map(s => (s.elements ?? []).map(e => (e.colour ? hexRGB(e.colour) : fallback(e.id))));
  const out = new Uint8ClampedArray(map.src.length * 4);
  for (let i = 0; i < map.src.length; i++) {
    const s = map.src[i], c = s < 0 || elem[i] < 0 ? ground : pal[s][elem[i]];
    out[4 * i] = c[0]; out[4 * i + 1] = c[1]; out[4 * i + 2] = c[2]; out[4 * i + 3] = 255;
  }
  return { w: map.w, h: map.h, rgba: out };
}
