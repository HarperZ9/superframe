// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// glass: a witness you can see through (SYNTHESIS-MAP section 3). A height field of glass over whatever lies below;
// combine.mjs applies its law, 'refract', reading the layers under it at displaced positions:
//   deviation   a thin prism of slope g bends light by delta = (n(lambda) - 1) g (small angles), so a cell sees the
//               layer below at x - depth * (n(lambda) - 1) * grad h, separately for red, green and blue
//   dispersion  n(lambda) = A + B / lambda^2 (Cauchy), with A and B set from a refractive index nd at 587.6 nm and an
//               Abbe number V = (nd - 1) / (nF - nC), so a flint (low V) splits colour more than a crown
//   caustic     the light on the paper follows the mapping's area change: I = 1 / |det J|,
//               J = I + depth * (n - 1) * Hessian(h), approximated by 1 / (1 + depth (n - 1) lap h)
// The height is base + ripple. base comes from a context source (the engraved-glass case: an intaglio layer's cuts
// become grooves, SYNTHESIS-MAP section 4) or a built-in shape; ripple is a damped wave equation
// h_tt = c^2 lap h - damping h_t, struck by a context drive layer, so the glass moves.
import { defineGen } from '../core/gen.mjs';
import { makeLayer, F32, laplace } from '../core/layer.mjs';

export function cauchy(nd = 1.52, V = 58) {
  const lF = 0.4861, lC = 0.6563, ld = 0.5876, B = (nd - 1) / (V * (1 / lF ** 2 - 1 / lC ** 2)), A = nd - B / ld ** 2;
  return { A, B, n: um => A + B / (um * um) };
}
export const RGB_UM = [0.61, 0.55, 0.465];

export const glass = defineGen({
  id: 'glass',
  kind: 'conformational',
  law: { shape: 'refract', params: { lambdas_um: RGB_UM } },
  weights: { nd: 'refractive index at 587.6 nm', abbe: 'Abbe number', depth: 'glass-to-paper distance, cells per unit slope', groove: 'how deep a source cut becomes a groove', c: 'ripple wave speed', damping: 'ripple damping', strike: 'how hard a drive layer strikes the surface' },
  inputs: { source: 'optional: carved into the base height (grooves)', drive: 'optional: strikes the ripple' },
  mechanism: 'offset_c = -depth (n(lambda_c) - 1) grad h; n = A + B / lambda^2 from (nd, V); caustic = 1 / (1 + depth (n - 1) lap h); ripple: h_tt = c^2 lap h - damping h_t',
  credits: ['Snell 1621; Cauchy 1836 (dispersion)', 'Abbe (the dispersion number)', 'Nye 1999, Natural Focusing (caustics)', 'wheel-engraved and cut crystal (the craft the engraved-glass recombination follows)', 'superframe lib/medium/optics.mjs (the tank lens, the in-medium sibling)'],
  create({ w = 160, h = 100, shape = 'lens', nd = 1.52, abbe = 40, depth = 18, groove = 0.5, c = 0.35, damping = 0.04, strike = 0.6 } = {}) {
    const n = w * h, base = F32(n);
    for (let k = 0; k < n; k++) {
      const x = (k % w) / w, y = (k / w | 0) / h;
      if (shape === 'lens') base[k] = Math.max(0, 1 - ((x - 0.5) / 0.32) ** 2 - ((y - 0.5) / 0.42) ** 2) * 0.6;
      else if (shape === 'prism') base[k] = x * 0.8;
      else if (shape === 'slab') base[k] = 0.3 + 0.04 * Math.sin(x * 40 + 3 * Math.sin(y * 9)) ;
    }
    const L = makeLayer('glass', { w, h, law: { shape: 'refract', params: { lambdas_um: RGB_UM } }, weights: { nd, abbe, depth, groove, c, damping, strike }, fields: { height: F32(n) }, state: { base, r: F32(n), rv: F32(n), lap: F32(n), carved: F32(n) } });
    compose(L); return L;
  },
  step(L, dt, ctx) {
    const S = L.state, W = L.weights, s = Math.min(2, dt * 30);
    if (ctx.source) { const a = ctx.source.fields.amount; for (let k = 0; k < L.n; k++) S.carved[k] = a[k]; }
    if (ctx.drive) { const a = ctx.drive.fields.amount; for (let k = 0; k < L.n; k++) S.rv[k] -= W.strike * 0.02 * a[k] * s; }
    laplace(S.r, L.w, L.h, S.lap);
    for (let k = 0; k < L.n; k++) { S.rv[k] += s * (W.c * W.c * S.lap[k] - W.damping * S.rv[k]); }
    for (let k = 0; k < L.n; k++) S.r[k] += s * S.rv[k];
    compose(L);
  },
});

function compose(L) {
  const S = L.state, H = L.fields.height, A = L.fields.amount;
  for (let k = 0; k < L.n; k++) { H[k] = S.base[k] - L.weights.groove * S.carved[k] * 0.25 + S.r[k]; A[k] = Math.min(1, Math.max(0, H[k])); }
}
