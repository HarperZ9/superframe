# alive

Stills that move and loops that close. A photograph or an engraving gets a depth estimate and then breathes, leans with the pointer and takes wind, water and a passing light. A few views of one moment become a wigglegram. A clip becomes a loop whose length is measured and whose seam is closed. The result leaves as a GIF or an APNG written by this package, with no dependency.

## Run it now

From a clone of this repo, with Node 24 or later and no install step:

```
node --test packages/alive/tests/*.test.js       # 48 tests, a few seconds
node packages/alive/tools/make_loops.mjs         # writes two loops to out/alive/, each as a GIF and an APNG, and prints sizes and seam numbers
```

```js
import { encodeGIF, encodeAPNG, exportLoop } from './packages/alive/src/gif.js';
import { estimateDepth, renderFrame } from './packages/alive/src/livestill.js';
import { bestLoop, closeLoop } from './packages/alive/src/loop.js';

// frames: [{ data: Uint8ClampedArray of RGBA, delayMs: 100 }, ...], all w by h
const gif = encodeGIF(w, h, frames, { colors: 64, dither: 'bayer' });   // Uint8Array
const apng = await encodeAPNG(w, h, frames);                             // Uint8Array, lossless
```

`make_loops.mjs` turns the 1901 Columbia disc once and closes the first row of Muybridge's Plate 758 into a loop. On 2026-11-14 it wrote the bird loop as a 194 kB GIF and a 444 kB APNG, with the seam step at 1.12 times the clip's typical step after closing (1.32 before).

## What is in it

| Module | What it does |
|---|---|
| `src/gif.js` | a GIF89a encoder: median-cut palette (one table or one per frame), Floyd-Steinberg or 8x8 Bayer dither, delays carried as an exact running sum, frames after the first cropped to the changed box; `exportLoop` picks GIF or APNG |
| `src/lib/apng.js` | APNG encode and decode, 8-bit RGBA, each later frame cropped to what changed |
| `src/lib/zlib.js` | deflate and inflate through `node:zlib` in Node and `CompressionStream` in a browser |
| `src/livestill.js` | depth with no learned model, from cues a painter would use (ground plane, haze, detail, figure against ground) and hand-drawn masks; 2.5D parallax, breath, wind, water and light; a CPU path for tests and a WebGL2 path with the same arithmetic |
| `src/wiggle.js` | wigglegrams from one still (synthetic views) or from two to four real frames aligned on a pivot, with a measure of the wiggle |
| `src/loop.js` | loop length from a self-similarity matrix (after Schödl and others, video textures, 2000), seams closed by crossfade, block-matched flow or ping-pong, sprite-sheet slicing, bar snapping |
| `src/framemosaic.js` | mosaics whose tiles are frames at a delay, cells of a data series, or source code inked by token class |
| `src/alive.js`, `src/lives.js`, `src/alive.css` | the page layer: one clock, a budget for how many things move at once, pointer and scroll response, a rest state, and one still frame under reduced motion. These run in a browser |
| `src/lib/gl.js`, `offload.js`, `worker.js` | WebGL2 helpers and a worker hand-off, for the browser |
| `src/lib/img.js` | the small image kit the rest stands on: resize, blur, guided filter, noise, distance fields |
| `src/lib/clock.js` | the cadence presets, from `playbook/cadence.js` |
| `src/nodes.mjs` | four superframe nodes: `alive.depth`, `alive.livestill`, `alive.wiggle`, `alive.mosaic`. They are defined and tested here and are not yet in the engine's registry |

## Tests

48 tests in seven files. Eight are golden pictures in `tests/golden/`, compared by SSIM (mean at least 0.995, worst 32 px tile at least 0.97) through `playbook/lib/ssim.js`; a failing compare leaves the new render in `out/alive-actual/` to look at. The GIF tests encode, decode with the vendored decoder and compare; the APNG test reads its own file back. The plates in `tests/fixtures/` are public-domain and CC0 pictures; `tests/fixtures/SOURCES.md` names each source and licence.

## Licences

The package is FSL-1.1-MIT like the rest of the repository, with one exception. `src/vendor/daylight-gif/media-gif.js` and `media-gif-lzw.js` are the GIF decoder from CMMNS (HarperZ9/cmmns, same author), copied unmodified, and their headers state AGPL-3.0-only as in that repository. Only decoding uses them: `decodeGif` in `gif.js`, the round-trip tests and `make_loops.mjs`. The GIF encoder is this package's own code.

## Origin

`src/` and `tools/make_loops.mjs` were carried from `world/alive/` on HarperZ9.github.io at commit c8866cc4 on 2026-11-14. Three import paths and the tool's output folder changed; nothing else did. The seven test files, their helper, the plates and the goldens were written with the code on 2026-10-23 and had not been published; they come from the author's workspace with import paths repointed. `playbook/lib/ssim.js`, which the helper needs, came with them.

## BuildLang port candidates

This package is JavaScript that moved; it holds no new feature code. The modules below are queued for a BuildLang port, with the tests here as the known answers the port must reproduce.

| Module | Exports | Notes for the port |
|---|---|---|
| `src/gif.js` | `encodeGIF`, `medianCut`, `indexFrame`, `delaysCs`, `lzwEncode`, `exportLoop`, `SPEC` | byte writer; ports first, with the decode round trip as the check |
| `src/lib/apng.js` | `encodeAPNG`, `decodeAPNG`, `diffBox` | byte writer and reader; needs deflate |
| `src/lib/zlib.js` | `deflate`, `inflate` | a wrapper today; a port needs its own deflate or a binding |
| `src/lib/img.js` | `image`, `resize`, `blur`, `guided`, `gradient`, `luma`, `sample`, `sampleField`, `sdf`, `polyMask`, `vnoise`, `mad`, `field`, `rng`, `hash01` and the scalar helpers | arrays and arithmetic only |
| `src/livestill.js` | `estimateDepth`, `renderFrame`, `warp`, `region`, `pose`, `percentile`, `toImage`, `LiveStill`, `SPEC`, `DEFAULTS` | the CPU path ports; `LiveStill` and `toImage` draw through a canvas and WebGL2 |
| `src/wiggle.js` | `sequence`, `viewAt`, `cams`, `synthViews`, `shiftAt`, `alignViews`, `measureWiggle`, `Wiggle`, `SPEC` | `Wiggle` is the browser class |
| `src/loop.js` | `bestLoop`, `closeLoop`, `seamRatio`, `selfSimilarity`, `proxyOf`, `periodOf`, `pingpong`, `stepOf`, `frameAt`, `snapToBar`, `sliceGrid`, `sheetFrames`, `crop`, `flow`, `advect`, `SPEC` | arrays and arithmetic only |
| `src/framemosaic.js` | `partition`, `layoutAt`, `layoutOn`, `shared`, `tilePx`, `tokens`, `codeImage`, `codeSource`, `seriesSource`, `framesSource`, `sheetSource`, `renderMosaic`, `intoSheet`, `drawMosaic`, `SPEC`, `INKS`, `CODE_INKS` | `drawMosaic` draws through a canvas |
| `src/alive.js`, `src/lives.js`, `src/lib/gl.js`, `offload.js`, `worker.js` | `Alive`, `Rhythm`, `BAR`, `CONFIG`, `LIVES`, the WebGL helpers, `offload` | browser code; waits for a BuildLang web target |
