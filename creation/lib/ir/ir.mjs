// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// ir.mjs: the transpiler's intermediate representation (BLEED section 17). It is refdb.parts/1 (the reference
// library's schema, PARTS-SCHEMA.md) with the 2026-10-26 fields: each layer is a named law with a weight bound to its
// place (law, layer, tick, role: BLEED section 20), its ticks, its cached value, its structure (order, side, hand,
// connectivity, branching: section 19) and its metamer breakdown (readout, spectrum, class, light change: 18).
// Readable on purpose: a person can open the JSON and see why a result came out as it did.
export const FORMAT = 'refdb.parts/1';

export function weight(value, label = 'measured', method = '') { return { value: +(+value).toFixed(6), label, method }; }
// a tick (proposed amendments A1, A2): its value, where or when, the instrument that took it, and whether it was
// measured or estimated; optional fields, so ticks written before stay valid
export function tick(value, { at = null, unit = null, instrument = null, estimated = false } = {}) { return { value, ...(at !== null ? { at } : {}), ...(unit ? { unit } : {}), ...(instrument ? { instrument } : {}), basis: estimated ? 'estimated' : 'measured' }; }
// a test result in three states: pass, fail, or unverifiable (nothing available could have shown it either way)
export const verdict = (ok, verifiable = true) => (!verifiable ? 'unverifiable' : ok ? 'pass' : 'fail');
export function irLayer({ name, order, law, w, params = {}, ticks = [], value = null, structure = {}, metamer = null, role = null, parts = [] }) {
  // CORE.md keys: ticks are the properties' measurements; function is the law (shape + weight, with the shape's
  // parameters); value is the cache; structure is itself a property (order, side, hand, connection, role); metamer
  // records the readout law and the light change. Nothing else is stored.
  return { name, order, function: { law, weight: w, params }, ticks, value, structure: { order, role, side: 'above', hand: null, connectivity: [], branching: 0, ...structure }, metamer, parts };
}
export function irDoc({ study, kind, medium, source, concepts, timing_layers = [], transparency = null }) {
  return { format: FORMAT, study, kind, medium, records: [], source, concepts, timing_layers, transparency };
}

// OKLab (Ottosson 2020) from linear sRGB, and LCh: the perceptual coordinates of the palette IR (a practical stand-in
// for Munsell renotation; BLEED colour batch item 3)
export function oklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
export function fromOklab([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}
export const oklch = rgb => { const [L, a, b] = oklab(rgb); return [L, Math.hypot(a, b), ((Math.atan2(b, a) * 180 / Math.PI) + 360) % 360]; };
export const hexToLin = h => { const n = parseInt(h.slice(1), 16); return [16, 8, 0].map(s => { const c = ((n >> s) & 255) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); };
export const linToHex = c => '#' + c.map(v => { const x = Math.min(1, Math.max(0, v)); return Math.round(255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055)).toString(16).padStart(2, '0'); }).join('');
export const okDist = (a, b) => { const p = oklab(a), q = oklab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };

// Compare two IRs property by property. spec: [{ name, get(ir) -> number | array, tol, kind: 'abs' | 'rel' | 'set' }].
// Survived: within tolerance. Lost: outside it, or absent in b. The loss list is what medium B cannot carry.
export function compareIR(a, b, spec) {
  const survived = [], lost = [], absent = [];
  for (const s of spec) {
    let va, vb; try { va = s.get(a); } catch { va = undefined; } try { vb = s.get(b); } catch { vb = undefined; }
    if (va === undefined || va === null || (typeof va === 'number' && Number.isNaN(va))) { absent.push({ property: s.name, why: 'not in the source IR' }); continue; }
    if (vb === undefined || vb === null || (typeof vb === 'number' && Number.isNaN(vb))) { lost.push({ property: s.name, a: va, b: null, why: 'not present after the round trip' }); continue; }
    const err = s.kind === 'set' ? jaccardDist(va, vb) : s.kind === 'rel' ? Math.abs(va - vb) / Math.max(1e-9, Math.abs(va)) : Array.isArray(va) ? meanAbs(va, vb) : Math.abs(va - vb);
    (err <= s.tol ? survived : lost).push({ property: s.name, a: round(va), b: round(vb), err: +err.toFixed(4), tol: s.tol, ...(err > s.tol ? { why: s.why ?? 'outside tolerance' } : {}) });
  }
  return { survived, lost, absent, score: survived.length / Math.max(1, survived.length + lost.length) };
}
const round = v => (Array.isArray(v) ? v.map(round) : typeof v === 'number' ? +v.toFixed(4) : v);
const meanAbs = (a, b) => { const n = Math.min(a.length, b.length); let s = 0; for (let i = 0; i < n; i++) s += Math.abs(a[i] - b[i]); return s / Math.max(1, n) + Math.abs(a.length - b.length); };
const jaccardDist = (a, b) => { const A = new Set(a), B = new Set(b); let i = 0; for (const x of A) if (B.has(x)) i++; return 1 - i / Math.max(1, new Set([...A, ...B]).size); };
