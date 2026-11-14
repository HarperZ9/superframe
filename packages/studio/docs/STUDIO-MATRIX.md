# Studio feature matrix

One row per feature in the older code that moves into the design studio: `studio/` (the material model and its four lanes) and this package. Each row says where the feature lives now, whether the studio has it, its licence, and the parity check that would prove a port.

## Terms

- **studio/**: superframe's `studio/lib` (the material model, blends and the four lanes) plus `packages/studio` (the package that documents it and holds the ports). "Has it" also counts superframe folders the studio already imports, such as `typeface/forge`.
- **Port**: the feature's code moves into superframe and is held to the source's own outputs.
- **Golden**: a stored output (or its sha256) produced by the source code at a pinned commit, before the port runs, so a port cannot pass by comparing against itself.
- **Seeded**: every random choice comes from one integer seed, so the same inputs give the same output.
- **Byte-identical**: the output files have the same sha256.
- **Parity check**: the test that proves a port equals its source. Kinds used below: byte-identical file; exact value equality of numbers or JSON; SSIM (structural similarity, 1.0 for identical pictures) at least 0.995 where float order may legitimately differ; a null test (port output minus source output) below -90 dBFS RMS for audio that is not integer-exact.
- **Planted change**: a deliberate seeded fault that the parity check must reject. Every port row below also needs one.

## Sources and commits

| Source | Commit | Licence | Status |
|---|---|---|---|
| Flywheel creative modules (`harness/design_studio.py`, `sound_studio.py`, `typeface_*.py`) | HarperZ9/flywheel@681810fe (2026-11-05) | FSL-1.1-MIT | live in the accountability platform |
| studio-engine | HarperZ9/studio-engine@328a0ddf (2026-10-23) | FSL-1.1-MIT | deprecated (author, 2026-10-23) |
| studio-libs | HarperZ9/studio-libs@b6dad12f (2026-10-22), private repo | FSL-1.1-MIT | publication inside superframe not yet cleared |
| Telos creative engine | HarperZ9/telos@e0867789 (2026-10-31), `demo/creative-*.mjs`, `demo/render-nd`, `demo/render-sound` | FSL-1.1-MIT | must leave Telos before Telos moves into THE FLYWHEEL |
| Site Studio (`studio.html`, 28 sources) | HarperZ9/HarperZ9.github.io@0151b773 (2026-11-09) | site code all rights reserved; vendored `render-nd`, `sense-core`, `reconcile`, raw-native and `media-engine/contracts.mjs` are FSL-1.1-MIT | live page; old shell |
| superframe | HarperZ9/superframe@29bf3ed (2026-11-08) | FSL-1.1-MIT; `measured`, `materials`, `decompose` AGPL-3.0-only | target |

The site Studio holds 28 sources, not the 24 the older memory note gives: `system/studio-shell.js` says "the 28 sources", and one stale comment in `studio.html` still says 24.

## Counts

| Source | Rows | studio/ has it | partial | no | Ported in the first release |
|---|---|---|---|---|---|
| Flywheel | 14 | 6 | 5 | 3 | 3 (static TTF, variable TTF, variable family) |
| studio-engine | 21 | 1 | 12 | 8 | 1 (the eye) |
| studio-libs | 31 | 7 | 14 | 10 | 0 |
| Telos creative | 8 | 2 | 3 | 3 | 0 |
| Site Studio | 29 | 5 | 14 | 10 | 0 |
| **Total** | **103** | **21** | **48** | **34** | **4 rows, 2 features** |

"Has it" counts the state after the first ported release, so the four ported rows count as yes. Before the PR the yes column was 17 and the no column 38.

## Flywheel (HarperZ9/flywheel@681810fe, FSL-1.1-MIT)

| # | Feature | Lives now | studio/ has it | Parity check that proves a port | Disposition |
|---|---|---|---|---|---|
| FW1 | Poster composer: title and subtitle on a seeded plate, set in the seed's own face, receipt line on the artwork; five formats, two grounds | `harness/design_studio.py` `compose` | partial: `superframe/adapters/poster.mjs` (`gradfield.poster`), studio image and type lanes | SVG side byte-identical for the same title, seed, format and ground; PNG at SSIM 0.995 or better against Flywheel's Pillow PNG, since a JS rasterizer cannot match Pillow's bytes | planned, once the Flywheel creative modules are cleared to move |
| FW2 | Aperture plate: fine radial line-work on a calm ground | `design_studio.py` `_aperture` | partial: `studio/lib/plates-matter.mjs` `sunburst` | line list (centres, radii, angles) equal as JSON from the same seed | with FW1 |
| FW3 | Scanlines, orbs, format and ground presets | `design_studio.py` `_scanlines`, `ORBS`, `FORMATS`, `GROUNDS` | no | preset tables equal by hash; scanline overlay pixel-equal on a flat ground | with FW1 |
| FW4 | Seeded chime study: a pentatonic tone row over a drone, 16-bit PCM WAV, score in the receipt | `harness/sound_studio.py` `compose_sound` | partial: `studio/lib/lanes/sound.mjs` (material to score), `packages/daw` | WAV sample-exact from the same seed, duration and root (16-bit integer output); refusal strings equal for out-of-range duration and root | next candidate; small and integer-exact |
| FW5 | Forge mint: skeletons traced by a direction-sensitive pen, legibility rules that refuse by name | `harness/typeface_forge.py` `mint` | yes: `typeface/forge/lib/forge.mjs` | outlines, advances and kerning equal; proved indirectly by the font goldens (seven fonts byte-identical through the JS forge) | done (already in superframe) |
| FW6 | Skeletons: the alphabet's topology, apart from style | `harness/typeface_skeletons.py` `build` | yes: `typeface/forge/lib/skeletons.mjs`, `skeletons-caps.mjs` | as FW5 | done |
| FW7 | Spacing from measured ink, kerning from measured white | `typeface_forge.py` `_profiles`, `_kerning` | yes: `forge.mjs` `profiles`, `kerning` | kerning tables equal; inside the font goldens through the `kern` table | done |
| FW8 | Specimen: the proving word "adhesion" drawn from the outlines, kerned | `typeface_forge.py` `_specimen` | partial: `forge.mjs` `setText` (any text) | SVG string equal for "adhesion" at the same face | small; next type row |
| FW9 | Static TrueType writer: a minted face to an installable font, every point on-curve, timestamps pinned | `harness/typeface_ttf.py` `to_ttf` | **yes, ported**: `packages/studio/src/font/ttf.mjs` | three goldens byte-identical (55,316 to 55,900 bytes); two runs identical; three seeded one-unit point moves caught | done |
| FW10 | Variable font writer: one font with a weight axis, masters checked for interpolation, `fvar` named instances and `gvar` point deltas | `harness/typeface_variable.py` `to_variable_ttf` | **yes, ported**: `packages/studio/src/font/variable.mjs` | three goldens byte-identical (54,476 to 83,836 bytes); a one-unit move in one master caught; a topology mismatch refused by name | done |
| FW11 | Family mint: one seed at several weights, a static font per survivor, refusals by name, a family receipt | `harness/typeface_family.py` `mint_family` | partial: per-weight fonts through FW9; no family receipt | per-instance `ttf_sha256` equal. The `mint_id` and `family_id` hash Flywheel's Python source files, so they cannot match a port by design; the port needs its own id over the same fields | next type row |
| FW12 | Variable family: the family's weights as masters of one variable font | `typeface_family.py` `mint_variable_family` | **yes, ported**: `variable.mjs` `mintVariableFamily` | font bytes, refusals and refused styles equal for four cases, one of them a too-few-masters refusal; the receipt's `variable_id` is left out for the FW11 reason | done |
| FW13 | Face gallery: publish, list and fetch minted faces in Flywheel's store | `harness/typeface_gallery.py` | no | n/a | stays in Flywheel: it is a receipted store, which is accountability work |
| FW14 | `/api/typeface*` request handling | `harness/typeface_route.py` | no | n/a | stays in Flywheel as the thin client; it would call the studio package once FW11 lands |

## studio-engine (HarperZ9/studio-engine@328a0ddf, FSL-1.1-MIT, deprecated)

| # | Feature | Lives now | studio/ has it | Parity check that proves a port | Disposition |
|---|---|---|---|---|---|
| SE1 | Witnessed simulation loop: perceive, generate, critique, refine, witness into a World | `studio_engine/engine.py`, `registry.py`, `model.py` | partial: `creation/lib/gen/index.mjs` (generator registry, no loop) | World JSON equal for the same seed and generator, minus wall-clock fields | planned, through reconcile |
| SE2 | Aesthetic criteria and cohesion score | `criteria.py` | partial: `typeengine/lib/score.mjs`, `packages/quality` | per-axis scores equal to 1e-12 on the test corpus | planned |
| SE3 | Certificate through the coherence-membrane oracle | `certify.py` | no | n/a | drop from the studio: certification is Flywheel's job; the studio emits receipts |
| SE4 | Novelty corpus: nearest neighbour in a 5-D feature space | `corpus.py` | partial: `typeengine/lib/score.mjs` novelty term | distances equal on the stored corpus | planned |
| SE5 | Compositor with palette harmony scoring | `compose.py` | partial: `creation/lib/core/layer.mjs`, `combine.mjs` | layer stack and scores equal as JSON | planned |
| SE6 | Seeded OKLCH palettes (analogous and other schemes) | `organs/palette.py` | partial: `studio/lib/blend.mjs` converts OKLab, generates no scheme | hex lists equal per seed and scheme; needs Python's Mersenne Twister reproduced, or kept in Python | high value for the studio's materials; next image row |
| SE7 | Point organs: phyllotaxis, damped harmonograph, attractor | `organs/geometry.py`, `harmonograph.py`, `attractor.py` | partial: `creation/lib/gen/path.mjs` (undamped Lissajous) | point lists equal to 1e-12; SVG byte-identical | planned |
| SE8 | Field organs: gyroid, quasicrystal, flow field, turbulence, metaballs, moire, rings | `organs/fields.py`, `flowfield.py`, `turbulence.py`, `metaballs.py`, `moire.py`, `rings.py` | partial: quasicrystal, moire and noise fields exist; no gyroid | sampled field values equal to 1e-12 on a grid; expressions equal as text | planned |
| SE9 | strand expression algebra with GLSL emit and parse | `strand/expr.py`, `strand/glsl.py` | no | canonical SHA of each expression equal; emitted GLSL text byte-identical | planned (reconcile carries the algebra) |
| SE10 | strand point recipes | `strand/recipe.py` | no | evaluated points equal | planned |
| SE11 | Sonification of a palette and score trajectory; WebAudio graph emit | `organs/sonify.py`, `strand/webaudio.py` | partial: `studio/lib/lanes/sound.mjs`, `creation/lib/gen/sound.mjs` | artifact samples within a -90 dBFS null test; graph JSON equal | planned |
| SE12 | Render programs: GLSL fragment, point and audio programs | `organs/program.py` | partial: `typeengine/lib/program.mjs` | program text byte-identical | planned |
| SE13 | Headless raster and PNG, loop strips with a sha receipt | `organs/raster.py`, `raster_renderer.py` | partial: `creation/lib/ir/png.mjs` | PNG frames byte-identical on the CPU path | planned |
| SE14 | Temporal witness: loop continuity, timeline | `temporal.py` | partial: `studio/lib/lanes/motion.mjs` | verdicts equal on stored frame strips | planned |
| SE15 | Interactive steering session with a "why" per axis | `session.py` | no | step-by-step state equal for a scripted session | front-end feature; later |
| SE16 | HTTP server and CLI | `server.py`, `__main__.py` | no | n/a | drop: superframe's CLI and the site front end replace it |
| SE17 | Native render bridge to an external binary | `native_render.py` | no | n/a | drop: raw-native is the renderer |
| SE18 | Browser port of generate, judge, certify and refine | `showcase/engine.js`, `verdict.js` | no | outputs equal to SE1 and SE2 | with SE1 |
| SE19 | Grounded dialogue: answers drawn only from measured numbers | `showcase/dialogue.js` | no | answer text equal for stored Worlds | later, with the Studio front end |
| SE20 | The eye: dHash, Hamming distance, drift verdict, five features | `showcase/eye.js` | **yes, ported**: `packages/studio/src/eye.mjs` | ten goldens (seven seeded buffers, three studio renders) equal in hash and every feature; six drift verdicts equal; seeded neighbour-pair reversals caught; a luma-rounding mutant caught | done |
| SE21 | Showcase UI: media in, WebGL and Canvas out | `showcase/media.js`, `render.js`, `showcase.js` | partial: `superframe/lib/medium/gpu/*` | n/a (DOM) | drop: the site Studio is the UI |

## studio-libs (HarperZ9/studio-libs@b6dad12f, FSL-1.1-MIT, private)

A private library of 31 features: n-D rendering (`render-nd`, also vendored on the site), sonification and instruments (`render-sound`), perception readouts (`sense-core`, also vendored on the site), and a perception server. Seven are covered by `packages/ndim`, `packages/perceive` and `sound/`, 14 in part, 10 not at all. None moves here until the library is cleared for publication; each row and its parity check are kept in the maintainer's internal matrix.

## Telos creative engine (HarperZ9/telos@e0867789, FSL-1.1-MIT)

| # | Feature | Lives now | studio/ has it | Parity check that proves a port | Disposition |
|---|---|---|---|---|---|
| TE1 | Creative-engine catalogue with MATCH, DRIFT and UNVERIFIABLE verdicts | `demo/creative-engine.mjs`, `demo/integrations/creative-engine-manifest.json` | no | manifest JSON equal by hash | planned into `creation` |
| TE2 | Ordered dither with a recursive Bayer matrix | `demo/creative-kernel-raster.mjs` | yes: `superframe/lib/quantize/dither.mjs` | dithered output byte-identical | drop the copy after the check |
| TE3 | Pixel sort of luminance runs | `creative-kernel-raster.mjs` `pixelSortRows` | no | RGBA byte-identical | planned |
| TE4 | Damped harmonograph path | `demo/creative-kernel-geometry.mjs` | partial: `creation/lib/gen/path.mjs` | points equal to 1e-12 | planned, with SE7 |
| TE5 | Clustered light bins against a budget | `creative-kernel-geometry.mjs` `clusterLightBins` | no | bin lists equal | to raw-native, not the studio |
| TE6 | Kernel packets with stable receipt hashes | `demo/creative-kernel-utils.mjs`, `creative-kernels.mjs` | partial: `studio/lib/schema.mjs` canonical form | hashes equal | planned |
| TE7 | Vendored render-nd | `demo/render-nd/**` | yes: `packages/ndim` | n/a | drop: a third copy, older than studio-libs |
| TE8 | Vendored render-sound | `demo/render-sound/*` | partial (DFT yes, sonify no) | as SL10 | drop the copy; SL10 carries it |

## Site Studio (HarperZ9/HarperZ9.github.io@0151b773)

Site code is all rights reserved, held by the same author. The engine side moves into superframe under FSL-1.1-MIT; the page stays on the site as the front end.

| # | Tool | Lives now | studio/ has it | Parity check that proves an engine port | Disposition |
|---|---|---|---|---|---|
| ST1 | Atelier: generative pen studies from a seed | `system/atelier.js`, `media-engine/plugins/atelier.mjs` | partial: `creation/lib/gen/*`, `superframe/adapters/print.mjs` | SVG byte-identical per algorithm and seed | engine port, planned |
| ST2 | 2D fractal: 13 families, deep zoom, flight video | `system/fractal*.js`, `studio-fractal-*.js` | partial: `site.fractal` node (CPU only) | CPU frames byte-identical; GPU frames SSIM 0.995 | planned for the CPU core |
| ST3 | 3D fractal: Mandelbox, Mandelbulb, Menger, Kleinian | `fractal3d.js`, `fractal3d-pro.js` | no | SSIM 0.995 on reference views | raw-native |
| ST4 | Dimensions: 4D+ polytopes with painting | `ndim.js`, vendored `render-nd` | yes: `packages/ndim` | n/a | front end reads `ndim` |
| ST5 | Spatial: receipt-checked splat worlds | `studio-spatial.js`, `spatial-*.js` | no | n/a: worlds are fixed packages with SHA-256 receipts | raw-native |
| ST6 | Poster: seeded field, type and layers | `poster-panel.js`, `poster.js`, `generative-field.js` | partial: `adapters/poster.mjs`, image lane | PNG byte-identical per seed on the CPU path | with FW1 |
| ST7 | Living neural field | `studio-neural.js`, `neural*.js` | partial: `creation/lib/gen/automata.mjs` | CPU frames byte-identical per seed | planned |
| ST8 | Seed sound: a seed as a melody, loudness, PCM receipt | `studio-sound.js`, `media-engine/sound.mjs` | yes: `site.seedsound`, `studio/lib/loudness.mjs`, `wav.mjs` | 16-bit PCM hash equal | done |
| ST9 | Plot maps: field, plate or picture to a plotter sheet, SVG and G-code | `plot-maps.js`, `plot-compose.js`, `plotter.js` | partial: `site.terrain`, `site.ridgelines` | SVG and G-code byte-identical per seed | planned |
| ST10 | Voxels: build, carve, paint; .vox and OBJ | `voxel.js`, `voxel-forge.js` | no | .vox and OBJ byte-identical per seed | planned |
| ST11 | Sketch to plotter sheet | `sketch.js` | no | SVG equal for a recorded stroke list | front end only |
| ST12 | Threads: particles through 15 fields | `studio-threads.js`, raw-native `threads.mjs` | partial: `visualizer/lib/flow.mjs`, `studio/lib/fluid.mjs` | SSIM 0.995 on fixed frames | raw-native |
| ST13 | Worlds: raymarched One Step dioramas | `studio-worlds.js`, raw-native `worlds.mjs` | partial: `universe/lib/seam-cores.mjs` | SSIM 0.995 | raw-native |
| ST14 | Films: narrated explainers | `studio-films*.js`, `system/explainer/*` | no | n/a (media) | site only |
| ST15 | Bring your own: image, video, model or sound in, transformed and measured | `importers.js`, `exporters.js`, `mesh-transform.js` | partial: `superframe/adapters/core.mjs` | measurements equal on stored inputs | front end, engine measures |
| ST16 | Watch with me: screen or camera read frame by frame | in `studio.js` | no | n/a (live input) | front end; the eye (SE20) reads the frames |
| ST17 | Music-reactive visuals | `reactive*.js` | partial: `visualizer/lib/*` | analysis values equal on a stored track | planned |
| ST18 | Physics discovery of a conserved quantity | `discovery/*` | partial: `packages/lawspace`, `packages/instruments` | discovered expression and verification equal | `lawspace`, not the studio |
| ST19 | Showcase: first integral fitted and re-checked | `showcase/*` | partial: `packages/instruments` | fitted coefficients equal to 1e-12 | `instruments` |
| ST20 | Retro Engine: pixelate, palette, dither, CRT tube | `retro-*.js`, `media-engine/plugins/retro.mjs` | partial: `site.retro`, `glass/crt.js`, `packages/crt` | front half byte-identical (the site already byte-checks its worker); GPU tube SSIM 0.995 | planned for the front half |
| ST21 | Gallery: a seed and up to 3 of 95 instruments draw a plate | `gallery-desk.js`, `generative-field.js` | partial: `studio/lib/plates-*.mjs` (different instruments) | plate PNG byte-identical per seed and instrument | planned; the 95 instruments are the largest single gap |
| ST22 | Loom: a picture woven as cloth, WIF draft out | `loom-studio.js`, `weave-*.js` | yes (core): `site.loom` | WIF text byte-identical; render PNG byte-identical | planned for render and WIF |
| ST23 | Type forge: mint Zain Mint in the browser | `type-forge/*`, `studio-type.js` | yes: `typeface/forge/lib`, plus the ported TTF and variable writers | font bytes equal to the goldens in `packages/studio/goldens/font.golden.json` | front end can call `packages/studio` for TTF and variable fonts |
| ST24 | Splat Lab: a door to Spatial | `studio-engine.js` slot | no | n/a | site only |
| ST25 | BRender: re-hash the restoration's release media | `media-engine/plugins/evidence.mjs` | no | n/a (hash check) | site only |
| ST26 | Engine Revival: re-hash its release media | same plugin | no | n/a | site only |
| ST27 | RAW: one scene on GPU and CPU, AO certificate | `media-engine/plugins/raw.mjs`, raw-native wasm | yes: `raw.render` node | certificate equal | done |
| ST28 | Verified viewer: glTF on GPU and CPU reference | `studio-viewer.js`, raw-native viewer | no | n/a | raw-native |
| ST29 | Finish layer: raw-native post looks over any source | `system/studio-finish.js` | partial: `superframe/adapters/finish.mjs` (composition rules) | SSIM 0.995 per look | raw-native |

## What the matrix says

- The two first ports were picked for value against effort. The font writers turn the studio's type lane into installable fonts, static and variable, which answers the author's 2026-10-24 ask that the font tooling become "a full flagship part of our design studio". The eye gives every studio picture a recomputable fingerprint and a drift verdict, which the later image ports need as their own parity check where bytes may legitimately differ.
- The largest gaps by value: the Gallery's 95 instruments (ST21), seeded OKLCH palettes (SE6), the integer OKLab contract and channel fusion (in the private library), and the poster composer (FW1).
- Dropped rows have a reason in the row. No row is left open without a disposition.

## Verified

- Every Flywheel, studio-engine, Telos and site path above was read at the named commit through `git show` and `git ls-tree`. The private library was read at its default branch.
- The four ported rows: `node --test packages/studio/tests/*.test.mjs` in superframe, 32 of 32 passing on Windows with Node 25.2.1, before the PR's CI run.
- Not checked: the parity checks named for unported rows have not run. "Has it" for rows marked partial comes from reading file headers and exports, not from running both sides.
