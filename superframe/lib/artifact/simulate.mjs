// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// simulate.mjs: run each element's law and lay its ticks onto the shared canvas.
//
// Each element runs its creation-engine generator on its own grid, sized to its region (scale cells across), so a
// law keeps its own grain whatever the canvas size. The generator draws only from the element's seed substream. Its
// ticks are then read onto the canvas inside the element's feathered region; outside the region bbox nothing is
// written. That is the whole of locality: a weight edit on one element can change pixels only inside its bbox.
// The canvas holds one layer per element (the creation engine's layer shape), never a merged picture: every medium
// reads the layers with its own transparency weights, so mixing is the medium's law, not the canvas's.
import * as G from '../../../creation/lib/gen/index.mjs';
import { makeLayer, hexLin } from '../../../creation/lib/core/layer.mjs';
import { xmur3, Mulberry32 } from '../../../substrate/lib/vendor/superstack.mjs';
import { LAWS, bbox, maskAt, elementSeed } from './ir.mjs';

const GENS = { rd: G.rd, marble: G.marble, frost: G.frost, dla: G.dla, physarum: G.physarum, contour: G.contour, advect: G.advect, life: G.life, lenia: G.lenia, symmetry: G.symmetry, cloud: G.cloud, roads: G.roads, spray: G.spray, ribbon: G.ribbon, orbit: G.orbit };
const streamOf = s => { const m = new Mulberry32(xmur3(s)); return () => m.nextFloat(); };

// the generator's own parameters: the element's weights pass straight through (a weight the generator does not
// know is ignored by it, and recorded as unread in the study), plus the seed in the form that generator takes
function paramsFor(e, seed, gw, gh) {
  const kind = LAWS[e.law].seeded, p = { ...(LAWS[e.law].defaults ?? {}), ...e.weights, w: gw, h: gh };
  delete p.steps;
  if (kind === true) p.seed = seed;
  else if (kind === 'int') p.seed = (xmur3(seed) % 2147483646) + 1;
  else if (kind === 'points') { const r = streamOf(seed), n = 1 + Math.floor(r() * 3); p.seeds = Array.from({ length: n }, () => [0.25 + 0.5 * r(), 0.25 + 0.5 * r()]); }
  if (LAWS[e.law].pour) p.initial = blots(seed, gw, gh);
  return p;
}

// a law that only carries what it is given (ink in a fluid) starts from seeded blots of its own substream
function blots(seed, w, h) {
  const r = streamOf(`${seed}/blots`), A = new Float32Array(w * h), n = 3 + Math.floor(r() * 4);
  for (let b = 0; b < n; b++) {
    const cx = (0.2 + 0.6 * r()) * w, cy = (0.2 + 0.6 * r()) * h, rad = (0.06 + 0.1 * r()) * Math.min(w, h) * 2;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const d = Math.hypot(i - cx, j - cy) / rad; if (d < 1) A[j * w + i] = Math.min(1.2, A[j * w + i] + (1 - d * d)); }
  }
  return A;
}

export function runElement(r, e) {
  const g = GENS[e.law], [sw, sh] = r.sim, B = bbox(e, sw, sh), bw = Math.max(1, B.x1 - B.x0), bh = Math.max(1, B.y1 - B.y0);
  const gw = Math.max(24, Math.round(Math.min(e.scale, bw))), gh = Math.max(16, Math.round(gw * bh / bw));
  const L = g.create(paramsFor(e, elementSeed(r, e), gw, gh)), steps = Math.round(e.weights.steps ?? LAWS[e.law].steps);
  for (let s = 0; s < steps; s++) g.step(L, 1 / 30, {});
  return { L, gw, gh, B, steps, settled: L.settledAt !== null, change: L.history.change.at(-1) ?? 0 };
}

// bilinear read of a gw x gh field at local coords (0..1)
function read(F, gw, gh, u, v, c = 0, C = 1) {
  const x = Math.min(gw - 1.001, Math.max(0, u * gw - 0.5)), y = Math.min(gh - 1.001, Math.max(0, v * gh - 0.5)), i = x | 0, j = y | 0, fx = x - i, fy = y - j;
  const a = F[(j * gw + i) * C + c], b = F[(j * gw + i + 1) * C + c], d = F[((j + 1) * gw + i) * C + c], q = F[((j + 1) * gw + i + 1) * C + c];
  return (a * (1 - fx) + b * fx) * (1 - fy) + (d * (1 - fx) + q * fx) * fy;
}

// one canvas layer per element: amount = ticks x mask x strength; rgb carried where the law makes its own colour
export function layOut(r, e, run) {
  const [sw, sh] = r.sim, { L, gw, gh, B } = run, n = sw * sh, amount = new Float32Array(n), mask = new Float32Array(n);
  const src = L.fields.amount, rgbSrc = L.fields.rgb && L.law.shape !== 'emit' ? L.fields.rgb : null, rgb = rgbSrc ? new Float32Array(3 * n) : null;
  const bw = B.x1 - B.x0, bh = B.y1 - B.y0;
  for (let y = B.y0; y < B.y1; y++) for (let x = B.x0; x < B.x1; x++) {
    const m = maskAt(e, (x + 0.5) / sw, (y + 0.5) / sh); if (!m) continue;
    const k = y * sw + x, u = (x - B.x0 + 0.5) / bw, v = (y - B.y0 + 0.5) / bh;
    mask[k] = m; amount[k] = Math.min(1, Math.max(0, read(src, gw, gh, u, v))) * m * e.strength;
    if (rgb) for (let c = 0; c < 3; c++) rgb[3 * k + c] = read(rgbSrc, gw, gh, u, v, c, 3);
  }
  const layer = makeLayer(`artifact.${e.law}`, { w: sw, h: sh, law: { shape: rgb ? 'cover' : 'absorb', params: { strength: 1.6 } }, ink: hexLin(e.ink), fields: rgb ? { amount, rgb } : { amount }, name: e.id });
  if (e.spectrum) layer.spectrum = e.spectrum;
  return { id: e.id, layer, mask, bbox: B, element: e, run: { gw, gh, steps: run.steps, settled: run.settled, change: run.change, law: L.law.shape } };
}

export function simulate(r) { return r.elements.map(e => layOut(r, e, runElement(r, e))); }
