# superframe/lib/look

The finishing core. A renderer hands these modules a linear-light float picture and they return the picture a file or a screen receives. `superframe/lib/pix.mjs` sends every 8-bit export through `displayPixel` from `tone.mjs`.

| Module | What it does |
|---|---|
| `tone.mjs` | two display transforms: `display` keeps hue under a shoulder and rolls past 1.0 toward white; `agx` is the scene-referred curve |
| `bloom.mjs` | lens and film scatter as a sum of Gaussians whose weights sum to one, so total light stays the same |
| `blur.mjs` | separable Gaussian filter, binomial halving and bilinear upsampling for interleaved float pictures |
| `grain.mjs` | film grain from three dye layers with two crystal sizes chosen by tone |
| `dither.mjs` | 8-bit sRGB encode with a seeded TPDF dither of one code value |
| `colour.mjs` | OKLab conversion, a chroma move that protects saturated pixels, and a two-ink duotone |
| `print.mjs` | a newsprint press: CMYK separation, screened plates, dot gain, ink trap, misregister and mottle |
| `ink.mjs` | a brush line and shadow hatching for shapes given as signed distance fields |
| `comic.mjs` | a panel compositor that stacks distance-field layers and inks them |
| `warp.mjs` | caricature warps as inverse maps: bulge, lean and wobble |
| `index.mjs` | re-exports tone, bloom, grain, dither, blur and colour |

Tests: `superframe/tests/look.test.mjs`, 8 tests. The node goldens in `superframe/tests/golden/nodes.json` hold four nodes whose bytes changed when `pix.mjs` took the display shoulder: `site.retro`, `marble.bath`, `universe.seam-brush` and `universe.seam-halftone`.

## Origin

These files were written in the author's workspace on 2026-10-28, after the last full publish of this repository, and reached the repository on 2026-11-14. The code is unchanged.

## BuildLang port candidates

Every module here is JavaScript carried from the workspace; the folder holds no new feature code. Each one is array arithmetic with no browser API, so each can move to BuildLang with `look.test.mjs` as its known answers.

| Module | Exports |
|---|---|
| `tone.mjs` | `KNEE`, `shoulder`, `displayPixel`, `display`, `agxPixel`, `agx` |
| `bloom.mjs` | `bloom` |
| `blur.mjs` | `gaussKernel`, `gauss`, `half`, `upTo` |
| `grain.mjs` | `filmGrain` |
| `dither.mjs` | `encode8` |
| `colour.mjs` | `toOklab`, `fromOklab`, `chroma`, `duotone` |
| `print.mjs` | `INKS`, `ORDER`, `ANGLES`, `spotThreshold`, `separate`, `paper`, `press` |
| `ink.mjs` | `gradient`, `brushLine`, `hatch`, `splatter` |
| `comic.mjs` | `circle`, `ellipse`, `capsule`, `star`, `union`, `smin`, `subtract`, `through`, `field`, `panel`, `lay`, `inkOver`, `samplers` |
| `warp.mjs` | `caricature`, `warpField` |
