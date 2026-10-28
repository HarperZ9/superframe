// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// lightlut.mjs: read a spectral light-response table (tools/light-response.mjs) and look a surface up in it.
// A table maps a surface's albedo (linear RGB) to the light it reflects under one source, integrated through
// spectra, so a near-monochrome lamp collapses colours the way physical surfaces do; an RGB product cannot.
//   loadTable(manifest, float32)  -> { kinds: Map(kind -> { n, data }) }
//   reflect(table, kind, albedo)  -> [r, g, b] linear, trilinear in the table's gamma-2.2 grid
//   (an optional fourth argument replaces the gamma step's pow; tests pass Math.pow as a control)
// The same layout is read by C (see the manifest's encoding line). The gamma step uses the portable pow from
// detmath.mjs, the algorithm BuildLang's runtime uses, so this sampler and the BuildLang kernel agree to the bit.
import { detPow } from './detmath.mjs';
export function loadTable(manifest, f32) {
  const n = manifest.grid, size = n * n * n * 3, kinds = new Map();
  for (const k of manifest.kinds) kinds.set(k.kind, { n, data: f32.subarray(k.offset_floats, k.offset_floats + size) });
  return { kinds };
}

export function reflect(table, kind, albedo, pow = detPow) {
  const T = table.kinds.get(kind);
  if (!T) throw new Error(`lightlut: no table for light kind "${kind}"`);
  const { n, data } = T, q = albedo.map(v => pow(Math.min(1, Math.max(0, v)), 1 / 2.2) * (n - 1));
  const i0 = q.map(v => Math.min(n - 2, Math.floor(v))), f = q.map((v, c) => v - i0[c]);
  // nested lerps along r, then g, then b: the operation order of the BuildLang kernel (native/lightlut), so the
  // two agree to the bit
  const at = (r, g, b, ch) => data[((b * n + g) * n + r) * 3 + ch];
  const [r0, g0, b0] = i0, [fr, fg, fb] = f;
  return [0, 1, 2].map(ch => {
    const c00 = at(r0, g0, b0, ch) * (1 - fr) + at(r0 + 1, g0, b0, ch) * fr;
    const c10 = at(r0, g0 + 1, b0, ch) * (1 - fr) + at(r0 + 1, g0 + 1, b0, ch) * fr;
    const c01 = at(r0, g0, b0 + 1, ch) * (1 - fr) + at(r0 + 1, g0, b0 + 1, ch) * fr;
    const c11 = at(r0, g0 + 1, b0 + 1, ch) * (1 - fr) + at(r0 + 1, g0 + 1, b0 + 1, ch) * fr;
    const c0 = c00 * (1 - fg) + c10 * fg, c1 = c01 * (1 - fg) + c11 * fg;
    return c0 * (1 - fb) + c1 * fb;
  });
}
