// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// ops.mjs: recombination. Each operator takes recipes and returns a new recipe; none touches pixels, so every
// result is itself a recipe that renders, hashes and studies like any other.
//   edit(r, path, value)       one weight or property, by dotted path ('elements.coral.weights.F')
//   reseed(r, seed)            the same laws, a new draw
//   isomer(r, kind)            same elements, same weights, new structure: 'permute' rotates which region each
//                              element holds; 'mirror' reflects every region left to right (BLEED section 19)
//   route(r, id, medium, w)    move an element into or out of a medium (its transparency weight)
//   cross(a, b, take)          align by law (a part meets its counterpart before anything blends, BLEED section 20),
//                              keep a's version of shared laws unless take names b, then add b's unmatched elements
//   metamer(r, id)             give one element an ink spectrum that matches its colour under D65 but not under A:
//                              the same readout in daylight, a split under tungsten (BLEED section 18)
import { specOf } from '../../../creation/lib/core/spectral.mjs';
import { hexLin } from '../../../creation/lib/core/layer.mjs';
import { metamericBlack } from '../medium/spectral.mjs';

const clone = r => JSON.parse(JSON.stringify(r));
const byId = (r, id) => { const e = r.elements.find(x => x.id === id); if (!e) throw new Error(`ops: no element ${id}`); return e; };

export function edit(r, path, value) {
  const out = clone(r), parts = path.split('.'); let o = out;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i]; o = Array.isArray(o) ? o.find(x => x.id === p) ?? o[+p] : (o[p] ??= {});
    if (o === undefined) throw new Error(`ops.edit: bad path ${path}`);
  }
  o[parts.at(-1)] = value; return out;
}

export const reseed = (r, seed) => ({ ...clone(r), seed });

export function isomer(r, kind = 'permute') {
  const out = clone(r), regs = out.elements.map(e => ({ ...(e.region ?? {}) }));
  if (kind === 'permute') out.elements.forEach((e, i) => { e.region = regs[(i + 1) % regs.length]; });
  else if (kind === 'mirror') out.elements.forEach(e => { e.region = { ...e.region, cx: 1 - (e.region?.cx ?? 0.5) }; });
  else throw new Error(`ops.isomer: unknown kind ${kind}`);
  return out;
}

export function route(r, id, medium, w) { const out = clone(r), e = byId(out, id); e.transparency = { ...(e.transparency ?? {}), [medium]: w }; return out; }

export function cross(a, b, take = []) {
  const out = clone(a), seen = new Map(out.elements.map((e, i) => [e.law, i]));
  for (const e of clone(b).elements) {
    if (seen.has(e.law)) { if (take.includes(e.law)) out.elements[seen.get(e.law)] = { ...e, id: out.elements[seen.get(e.law)].id }; continue; }
    let id = e.id; while (out.elements.some(x => x.id === id)) id += 'b';
    out.elements.push({ ...e, id }); seen.set(e.law, out.elements.length - 1);
  }
  return out;
}

export function metamer(r, id, { scale = 0.9, seed = 2 } = {}) {
  const out = clone(r), e = byId(out, id), base = specOf(hexLin(e.ink ?? '#22252c')), v = metamericBlack(base, 'D65', { seed, scale });
  e.spectrum = base.map((b, i) => Math.min(0.998, Math.max(0.002, b + v[i])));
  return out;
}
