// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// ir.mjs: the artifact recipe, the one readable IR every medium is transpiled from.
//
//   { schema: 'superframe.artifact/1', seed, size: [w, h], sim: [w, h], text, palette: { paper, ink },
//     media: { type, paint, lines, material, sound },        // each a weight 0..1, never an on/off rule
//     detail: 0..1,                                          // full-resolution grain carried into every medium
//     elements: [ { id, law, weights: {...}, ink, region: { cx, cy, rx, ry, feather }, scale, detail,
//                   transparency: { type, paint, lines, material, sound }, roughness, spectrum? } ] }
//
// An element is properties plus the laws acting on them (CORE.md). Its transparency is a per-medium weight: how much
// of the element passes into each medium. Nothing in the IR fixes which element goes where; a medium only reads the
// weights. The structure (which region each element holds) is kept apart from the weights, so an isomer (same
// weights, new structure) is one operation (ops.mjs). Every element draws from its own seed substream, so adding,
// removing or editing one element never moves another element's randomness.
import { canonicalSha256, substream } from '../../../substrate/lib/vendor/superstack.mjs';

export const SCHEMA = 'superframe.artifact/1';
export const MEDIA = ['type', 'paint', 'lines', 'material', 'sound'];

// laws the engine knows, with the creation-engine generator, its seed key, default steps and default roughness
export const LAWS = {
  rd: { gen: 'rd', ink: '#a4482a', seeded: true, steps: 520, defaults: { seedSpots: 16 }, rough: 0.7, doc: 'reaction-diffusion (Gray-Scott)' },
  marble: { gen: 'marble', ink: '#22252c', seeded: true, steps: 300, rough: 0.25, doc: 'marbling: drops and tine pulls (Lu, Jaffer and others)' },
  frost: { gen: 'frost', ink: '#2c5d7a', seeded: 'points', steps: 220, defaults: { rate: 90 }, rough: 0.12, doc: 'snowflake automaton (Reiter)' },
  dla: { gen: 'dla', ink: '#5a3a22', seeded: true, steps: 90, rough: 0.8, doc: 'diffusion-limited aggregation (Witten and Sander)' },
  physarum: { gen: 'physarum', ink: '#b8862f', seeded: true, steps: 260, rough: 0.6, doc: 'slime-mould transport network (Jones)' },
  contour: { gen: 'contour', ink: '#22252c', seeded: true, steps: 60, rough: 0.5, doc: 'contour lines over a grained field' },
  advect: { gen: 'advect', ink: '#2b3a6b', seeded: true, steps: 140, defaults: { stir: 1.6 }, pour: true, rough: 0.35, doc: 'ink poured and carried by a stable fluid (Stam)' },
  life: { gen: 'life', ink: '#24302a', seeded: true, steps: 70, rough: 0.9, doc: 'Conway\'s Life' },
  lenia: { gen: 'lenia', ink: '#4b3a7a', seeded: true, steps: 200, rough: 0.55, doc: 'Lenia, continuous automata (Chan)' },
  symmetry: { gen: 'symmetry', ink: '#8a93a3', seeded: 'int', steps: 80, defaults: { scale: 40, size: 0.12 }, rough: 0.3, doc: 'a wallpaper group tiling' },
  cloud: { gen: 'cloud', ink: '#9aa3ad', seeded: true, steps: 80, rough: 0.95, doc: 'cumulus lobes with erosion' },
  roads: { gen: 'roads', ink: '#3a3a40', seeded: true, steps: 120, rough: 0.65, doc: 'branching roads' },
  spray: { gen: 'spray', ink: '#c2412b', seeded: true, steps: 90, rough: 0.85, doc: 'spray with drips' },
  ribbon: { gen: 'ribbon', ink: '#2a6f73', seeded: true, steps: 90, rough: 0.2, doc: 'ribbons on a wave' },
  orbit: { gen: 'orbit', ink: '#22252c', seeded: 'int', steps: 90, rough: 0.15, doc: 'Kepler orbits' },
};

const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

export function normalise(r) {
  if (r.schema && r.schema !== SCHEMA) throw new Error(`artifact: schema ${r.schema} is not ${SCHEMA}`);
  const size = r.size ?? [3840, 2160], sim = r.sim ?? [Math.round(size[0] / 2), Math.round(size[1] / 2)];
  const media = Object.fromEntries(MEDIA.map(m => [m, clamp01(num(r.media?.[m], 1))]));
  const elements = (r.elements ?? []).map((e, i) => {
    if (!LAWS[e.law]) throw new Error(`artifact: element ${e.id ?? i} has unknown law ${e.law}`);
    const reg = e.region ?? {};
    return {
      id: e.id ?? `${e.law}${i}`, law: e.law, weights: { ...(e.weights ?? {}) }, ink: e.ink ?? LAWS[e.law].ink ?? r.palette?.ink ?? '#22252c',
      region: { cx: num(reg.cx, 0.5), cy: num(reg.cy, 0.5), rx: num(reg.rx, 0.3), ry: num(reg.ry, 0.3), feather: clamp01(num(reg.feather, 0.25)) },
      scale: Math.max(48, Math.min(480, Math.round(num(e.scale, 220)))), strength: clamp01(num(e.strength, 0.8)), detail: clamp01(num(e.detail, 0.5)),
      transparency: Object.fromEntries(MEDIA.map(m => [m, clamp01(num(e.transparency?.[m], 1))])),
      roughness: clamp01(num(e.roughness, LAWS[e.law].rough)), spectrum: e.spectrum ?? null,
    };
  });
  const ids = new Set(); for (const e of elements) { if (ids.has(e.id)) throw new Error(`artifact: duplicate element id ${e.id}`); ids.add(e.id); }
  return {
    schema: SCHEMA, seed: String(r.seed ?? 'artifact'), size, sim, text: String(r.text ?? ''),
    palette: { paper: r.palette?.paper ?? '#ece6d9', ink: r.palette?.ink ?? '#22252c' },
    media, detail: clamp01(num(r.detail, 0.5)),
    lines: { hatch: ['curvature', 'flat', 'none'].includes(r.lines?.hatch) ? r.lines.hatch : 'curvature', angle: num(r.lines?.angle, 45) },
    sound: { seconds: num(r.sound?.seconds, 16), rate: 48000, bands: 72, lo: 70, hi: 7000 },
    elements,
  };
}

// the compiled recipe's identity: intent prose and reports are not part of it, only what the media read
export function recipeHash(r) { const { intent, report, ...laws } = r; return canonicalSha256(laws); }
export const elementSeed = (r, e) => substream(r.seed, `element/${e.id}`);

// an element's support on a w x h grid: a feathered ellipse. bbox() is the rectangle outside which the mask is 0,
// which is the whole claim locality rests on (tests/artifact.test.mjs checks it).
export function bbox(e, w, h) {
  const { cx, cy, rx, ry } = e.region;
  return { x0: Math.max(0, Math.floor((cx - rx) * w)), y0: Math.max(0, Math.floor((cy - ry) * h)), x1: Math.min(w, Math.ceil((cx + rx) * w)), y1: Math.min(h, Math.ceil((cy + ry) * h)) };
}
export function maskAt(e, u, v) {
  const { cx, cy, rx, ry, feather } = e.region, d = Math.hypot((u - cx) / rx, (v - cy) / ry);
  if (d >= 1) return 0; const f = Math.max(1e-3, feather); if (d <= 1 - f) return 1;
  const t = (1 - d) / f; return t * t * (3 - 2 * t);
}
