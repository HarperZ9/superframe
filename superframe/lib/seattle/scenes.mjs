// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// scenes.mjs: the three Seattle scenes behind one interface for film.mjs:
//   { W, H, create(), step(S, dt), render(S), palette(), exposure(S) }
//   car    the back seat in the rain (the memory itself), sodium or incandescent street lamps
//   porch  a person on a back porch, moonlight, snow falling through an alley lamp
//   trees  wind and rain in a Douglas fir, a western redcedar and a bigleaf maple at dusk
import { createCar, stepCar, renderCar } from './carscene.mjs';
import { carPaletteSpec } from './lights.mjs';
import { lampPalette } from './palette.mjs';

const cache = new Map();
const memo = (key, f) => { if (!cache.has(key)) cache.set(key, f()); return cache.get(key); };

export async function scene(name, { W = 320, H = 180, variant = 'sodium', loop = true, T = 12, seed } = {}) {
  if (name === 'car') return {
    W, H, create: () => createCar({ W, H, variant, loop, T, seed: seed ?? 'seattle-car' }), step: stepCar, render: renderCar,
    palette: () => memo(`car:${variant}`, () => lampPalette(carPaletteSpec(variant))), exposure: S => S.exposure,
  };
  if (name === 'porch') { const m = await import('./porch.mjs'); return m.porchScene({ W, H, variant, loop, T, seed: seed ?? 'seattle-porch' }); }
  if (name === 'trees') { const m = await import('./trees.mjs'); return m.treesScene({ W, H, variant, loop, T, seed: seed ?? 'seattle-trees' }); }
  throw new Error(`seattle: unknown scene ${name}`);
}
