// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// lib/look: the shared finishing core. Every renderer's picture passes through these on its way to a file:
//   tone.mjs    display (hue-preserving shoulder, path to white) and agx (scene-referred) transforms
//   bloom.mjs   energy-conserving multi-scale scatter
//   grain.mjs   film grain: dye layers, two crystal sizes by tone, density envelope
//   dither.mjs  8-bit encode with TPDF dither
//   print.mjs, ink.mjs, warp.mjs   the weird-print family: newsprint stack, brush ink line, caricature warp
// Pictures are { w, h, px: Float32Array(w*h*3) } in linear light.
export * from './tone.mjs';
export * from './bloom.mjs';
export * from './grain.mjs';
export * from './dither.mjs';
export { gauss, half, upTo } from './blur.mjs';
export * from './colour.mjs';
