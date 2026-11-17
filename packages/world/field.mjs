// SPDX-License-Identifier: FSL-1.1-MIT
// field.mjs: one field, many properties. The kernel mirrors src/field_kernel.bld function for function (that file is
// the source of record; tests/field.test.mjs holds this file to its output). Nothing here imports anything, so the
// site can carry this file as it is.
//
// An element is anything in the world: a pane of glass, a body of water, a probe, a word. It carries properties at
// weights from 0 to 1, and it carries them over a soft region: a disc whose rim is a gradient, never a hard edge.
// A property is a capability, not a place: refraction, flow, measurement, shape, voice, territory, circuitry. Where
// two elements overlap, the property's strength there is the union of what each carries and its value is their
// mixture, so light that crosses from glass into moving water bends by both at once, at the weights they hold.

// The property names, in the order the page shows them. properties.mjs gives each its core, its record and its limits.
export const PROPERTY_IDS = Object.freeze(['lens', 'flow', 'measure', 'shape', 'sound', 'map', 'circuit']);

// ---- the kernel (src/field_kernel.bld) ----
export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export function smooth(e0, e1, x) { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); }
export const disc = (dx, dy, radius, edge) => 1 - smooth(radius - edge, radius + edge, Math.sqrt(dx * dx + dy * dy));
export const carry = (mask, weight) => clamp01(mask * weight);
export const union2 = (a, b) => 1 - (1 - a) * (1 - b);
export function mix2(ca, va, cb, vb) { const s = ca + cb; return s <= 1e-12 ? 0 : (ca * va + cb * vb) / s; }
export const luneburgN2 = (r, R) => (r >= R ? 1 : 2 - (r * r) / (R * R));
export const n2Blend = (strength, mixed) => 1 + strength * (mixed - 1);
export function micro(x) { return x < 0 ? -Math.trunc(-x * 1e6 + 0.5) : Math.trunc(x * 1e6 + 0.5); }

// The kernel's own table, line for line as src/field_kernel.bld prints it.
export function kernelTable() {
  const out = [];
  for (let i = 0; i <= 10; i++) {
    const x = i * 0.1;
    out.push(`smooth ${i} ${micro(smooth(0.2, 0.8, x))}`, `disc ${i} ${micro(disc(x, 0, 0.5, 0.1))}`, `carry ${i} ${micro(carry(disc(x, 0.3, 0.6, 0.15), 0.7))}`,
      `union ${i} ${micro(union2(x, 0.4))}`, `mix ${i} ${micro(mix2(x, 1.7, 0.5, 1.3))}`, `luneburg ${i} ${micro(luneburgN2(x, 0.8))}`, `n2 ${i} ${micro(n2Blend(x, luneburgN2(0.3, 0.8)))}`);
  }
  return out.join('\n') + '\n';
}

// ---- elements ----
// { id, name, x, y, radius, edge, carries: { lens: 0.8, ... }, traits }. Positions and sizes are in scene units.
// traits are what the element is made of, which a property reads (a lens profile, a material, a colour).
export function element({ id, name = id, x, y, radius, edge = radius * 0.25, carries = {}, traits = {} }) {
  if (!id || ![x, y, radius].every(Number.isFinite) || radius <= 0) throw new Error(`field: element ${id} needs an id, a place and a radius`);
  if (!(edge > 0)) throw new Error(`field: element ${id} needs a rim wider than 0; a boundary is a gradient`);
  const c = {};
  for (const [p, w] of Object.entries(carries)) {
    if (!PROPERTY_IDS.includes(p)) throw new Error(`field: "${p}" is not a property; the properties are ${PROPERTY_IDS.join(', ')}`);
    if (!(w >= 0 && w <= 1)) throw new Error(`field: ${id} carries ${p} at ${w}; a weight is from 0 to 1`);
    c[p] = w;
  }
  for (const p of PROPERTY_IDS) if (!(p in c)) c[p] = 0;
  return { id, name, x, y, radius, edge, carries: c, traits: { ...traits } };
}
// What one element gives one property at a point.
export const carryAt = (el, prop, px, py) => carry(disc(px - el.x, py - el.y, el.radius, el.edge), el.carries[prop]);
// The property's strength at a point: the union over every element.
export function strength(elements, prop, px, py) {
  let s = 0;
  for (const el of elements) s = union2(s, carryAt(el, prop, px, py));
  return s;
}
// The property's value at a point: each element's own value there, mixed by what each carries. valueOf(el, px, py).
// Returns { strength, value, carried }: carried is the sum of what the elements carry there (0 where none does).
export function mixture(elements, prop, px, py, valueOf) {
  let s = 0, acc = 0, v = 0;
  for (const el of elements) {
    const c = carryAt(el, prop, px, py);
    if (c <= 0) continue;
    s = union2(s, c); v = mix2(acc, v, c, valueOf(el, px, py)); acc += c;
  }
  return { strength: s, value: v, carried: acc };
}

// ---- continuity ----
// The largest change between neighbouring samples of f over weights 0 to 1, at n steps.
export function largestStep(f, n) {
  let prev = f(0), worst = 0;
  for (let i = 1; i <= n; i++) { const y = f(i / n); worst = Math.max(worst, Math.abs(y - prev)); prev = y; }
  return worst;
}
// A continuous output's largest step shrinks when the sampling is made finer; a jump stays the same size however fine
// the sampling. So sample at n and 2n: continuous when the finer largest step is at most `shrink` of the coarser one.
// A smooth output's ratio tends to 0.5; a jump's stays at 1. 0.75 leaves room for an output that is steep near one
// end (a small carrier meeting a large one) and still fails every switch.
export function continuity(f, { n = 100, shrink = 0.75, floor = 1e-9 } = {}) {
  const coarse = largestStep(f, n), fine = largestStep(f, 2 * n);
  return { coarse, fine, ratio: coarse > floor ? fine / coarse : 0, continuous: coarse <= floor || fine <= shrink * coarse };
}
