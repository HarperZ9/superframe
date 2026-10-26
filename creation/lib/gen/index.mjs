// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// The generator set, one import. Order is the rank in REGISTRY.md (recurrence in the author's material times motion
// value), highest first; the rank is computed by tools/build_registry.mjs and recorded in registry.json.
export { advect } from './advect.mjs';
export { sheet } from './sheet.mjs';
export { path } from './path.mjs';
export { timing, CURVES } from './timing.mjs';
export { front, unravel } from './front.mjs';
export { mosaic } from './mosaic.mjs';
export { intaglio } from './intaglio.mjs';
export { glass, cauchy } from './glass.mjs';
export { rd, RD_PRESETS } from './rd.mjs';
export { life, rule110, lenia } from './automata.mjs';
export { frost } from './frost.mjs';
export { heat, glow } from './heat.mjs';
export { leaf } from './leaf.mjs';
export { dry } from './dry.mjs';
export { marble } from './marble.mjs';
export { glyph } from './glyph.mjs';
export { sound, soundclock } from './sound.mjs';
export { ribbon } from './ribbon.mjs';
export { orbit, quantizeAngles } from './orbit.mjs';
export { contour } from './contour.mjs';
export { dla, physarum, afterglow } from './growth.mjs';
export { material, MATERIALS } from './material.mjs';
export { symmetry, GROUPS } from './symmetry.mjs';
export { kasane } from './kasane.mjs';
export { ascii, orb, ramp, spray } from './plates.mjs';
export { cloud, swarm, roads } from './plates2.mjs';
export { crt, develop, raking, moire } from './plates3.mjs';
