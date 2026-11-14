# retro

A picture reduced the way old hardware reduced it. `quantizeGrid` snaps a frame to a retro palette in OKLab, `ditherPlate` dithers by a Bayer matrix, by interleaved gradient noise or by error diffusion, `medianCut` builds a palette from the picture itself, and the tube stage (`crtStage`) adds beam scanlines and a shadow mask.

## Run it now

From a clone of this repo, with Node 24 or later and no install step:

```
node --test packages/retro/tests/*.test.mjs      # 14 tests
```

```js
import { quantizeGrid, RETRO_DEFAULT_OPTS, RETRO_PALETTES, paletteNames } from './packages/retro/src/retro-engine.js';
import { ditherPlate, BAYER } from './packages/retro/src/retro-dither.js';
import { medianCut, labPalette } from './packages/retro/src/retro-palettes.js';
```

The engine's retro node in `superframe/adapters/site.mjs` calls `quantizeGrid`. `renderRetro` and `applyChain` in `retro-engine.js` draw to a canvas and need a browser.

The colour conversions come from `packages/superstack/superstack.mjs`.

## Origin

The four files in `src/` began as `system/retro-engine.js`, `retro-palettes.js`, `retro-dither.js` and `retro-crt.js` on HarperZ9.github.io at commit 3ca6529. They sat in the engine as a vendored snapshot until 2026-11-14 and are maintained here from that date. The tests came from the site's `system/retro-engine.test.mjs` and `system/retro-crt.test.mjs`.

## Other implementations in this repo

These overlap with this package and have not been merged with it:

| Where | What it holds |
|---|---|
| `native/src/core/loop_palette.cpp` | the renderer's palette quantise in C++ |
| `native/web/shaders/reference/retro-palettes.mjs` | the renderer's JavaScript reference palettes |
| `packages/crt` | a CRT simulated as physics in Python, from beam to phosphor to glass |
| `glass/crt.js` | a CRT pass in the glass folder |

Which one becomes the reference is an open decision. Until it is made, a change to a palette or to the tube stage has to be checked against the others by hand.

## BuildLang port candidates

This package is JavaScript that moved; it holds no new feature code. Each module below is queued for a BuildLang port, with the tests here as the known answers the port must reproduce.

| Module | Exports | Notes for the port |
|---|---|---|
| `src/retro-palettes.js` | `RETRO_PALETTES`, `paletteNames`, `labPalette`, `nearestIndex`, `medianCut`, OKLab helpers | tables and float arithmetic; no browser API |
| `src/retro-dither.js` | `BAYER`, `DITHER_MODES`, `ign`, `farSideIndex`, `orderedPick`, `ditherPlate` | typed arrays only |
| `src/retro-crt.js` | `MASK_MODES`, `beamTable`, `maskTable`, `crtStage`, `crtActive` | typed arrays only; overlaps `packages/crt` |
| `src/retro-engine.js` | `quantizeGrid`, `gridSize`, `RETRO_DEFAULT_OPTS`, `renderRetro`, `applyChain` | `quantizeGrid` is offline; the two canvas functions wait for a BuildLang browser target |
