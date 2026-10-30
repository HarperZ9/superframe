// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: AGPL-3.0-only
//
// node.mjs: the materials library as a superframe node. Not registered in superframe/adapters/ yet: the
// engine core is FSL-1.1-MIT and this package is AGPL-3.0-only, so wiring it into the default registry is
// the author's licence decision (see packages/README.md). A host registers it explicitly:
//   import { NODES } from './packages/materials/js/node.mjs'
//
//   materials.swatch  one measured material under a light, swept across the frame from normal incidence
//                     (left) to grazing (right). Output: a linear-light raster and the spectrum (radiance
//                     factor) at the chosen view angle, so raw-native and the marbling solver read one number.
import { defineNode } from '../../../superframe/lib/node.mjs';
import { make } from '../../../superframe/lib/types.mjs';
import { GRID, allMaterials, get, illuminant, nk, shade, toXyz, xyzToLinearSrgb } from './materials.mjs';

export const SHADEABLE = allMaterials().filter(m => nk(m)[0] != null).map(m => m.id).sort();
const ONES = GRID.map(() => 1);

/** Radiance factor spectrum (pi x BRDF x cos weighting removed): 1 for a white Lambertian surface. */
export function radianceFactor(material, thetaDeg, roughness) {
  const cl = Math.max(Math.cos((thetaDeg * Math.PI) / 180), 1e-4);
  return shade(material, ONES, thetaDeg, { roughness }).map(v => (Math.PI * v) / cl);
}

export const NODES = [
  defineNode({
    id: 'materials.swatch', title: 'Measured material swatch', lane: 'matter',
    domains: ['optics', 'colour science', 'materials science'], source: 'packages/materials/js/materials.mjs',
    doc: 'Spectral n and k from the materials library, Fresnel with complex N, a GGX lobe and the body term, integrated under a CIE light. Left edge is normal incidence, right edge 85 degrees.',
    outputs: { raster: 'raster', spectrum: 'series' },
    params: {
      material: { type: 'enum', options: SHADEABLE, default: SHADEABLE.includes('gold') ? 'gold' : SHADEABLE[0] },
      light: { type: 'enum', options: ['D65', 'A', 'sodium', 'E'], default: 'D65' },
      roughness: { type: 'number', min: 0.02, max: 1, default: 0.25, unit: 'GGX roughness' },
      theta: { type: 'number', min: 0, max: 85, default: 30, unit: 'degrees, for the spectrum output' },
    },
    cost: () => 30, runtime: ['node'],
    render: ({ params, w, h }) => {
      const mat = get(params.material), light = illuminant(params.light);
      const cols = Math.min(w, 64), ramp = [];
      for (let c = 0; c < cols; c++) ramp.push(xyzToLinearSrgb(toXyz(radianceFactor(mat, (85 * c) / Math.max(1, cols - 1), params.roughness), light)));
      const R = make.raster(w, h);
      for (let x = 0; x < w; x++) {
        const rgb = ramp[Math.min(cols - 1, Math.floor((x * cols) / w))];
        for (let y = 0; y < h; y++) { const o = (y * w + x) * 4; R.data[o] = Math.max(0, rgb[0]); R.data[o + 1] = Math.max(0, rgb[1]); R.data[o + 2] = Math.max(0, rgb[2]); R.data[o + 3] = 1; }
      }
      return { raster: R, spectrum: make.series(radianceFactor(mat, params.theta, params.roughness), { x: Float64Array.from(GRID), label: `${params.material} radiance factor`, unit: '1' }) };
    },
  }),
];
