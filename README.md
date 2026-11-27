# Superframe (The Playground)

The Playground rendering and simulation engine. Describe a piece in plain words and get it back across media from one seeded recipe: paint, living type, line drawings, relief materials, sound, and tactile patterns. Beside the seeded artifact engine, the same repository holds the C++23 GPU renderer, Low Water, 6-DOF physical-AI and biomechanical tree simulation, ITU-R BT.2020/2100 spectral optics, the `NOH-3` world bridge, and measured study tools.

## One-command install

Downloads the prepackaged Playground bundle (`superframe`, `packages/`, and compiled `raw_native_cli`), verifies `SHA256SUMS` fail-closed before extracting, and adds `superframe` to your user `PATH`:

Windows (PowerShell):
```powershell
irm https://raw.githubusercontent.com/HarperZ9/superframe/main/install.ps1 | iex
```

Linux / macOS:
```sh
curl -fsSL https://raw.githubusercontent.com/HarperZ9/superframe/main/install.sh | sh
```

Pass `-WithRawDx12` / `--with-raw-dx12` for SHA-256 verification guidance on optional RAW DX12 game runtime binaries (Skyrim SE / Fallout 4 / Starfield).

| Where | What |
|---|---|
| `superframe/`, `creation/`, `typeengine/` | Core seeded artifact engine: 15 laws, 181 technique nodes, 31 converters, living type, and measured study libraries |
| `native/` | C++23 renderer (Direct3D 12, Vulkan, WebGPU) with modular WGSL shader assembly (`native/src/renderer/gpu/shaders/`) and BuildLang parity shaders (`native/bld/`). See `native/README.md` |
| `games/low-water/` | Low Water, the narrative action game built on the engine. `npm run test:games` runs its engine, weather, light, paint, and combat tests |
| `packages/world/physai/` | SI rigid-body PGS/Coulomb contact physics, 6-DOF aerospace and powered-descent dynamics, biomechanical tree dynamics, and the `NOH-3` world bridge (Buckingham-Pi scale normalizer, caustic sparse scheduler, CODIT fault guard) |
| `packages/lenspipe/`, `packages/crt/` | ITU-R BT.2020/2100 PQ spectral optics, Draine-HG scattering, dark-mist radiance, Sellmeier dispersion/caustics, and CRT phosphor/scanline physics |
| `packages/superstack/`, `packages/kernels/` | Shared colour/hash kernels (`kcore`) and stdlib-only canonical SHA-256 `engine-receipt/1` emission and verification (`packages/superstack/engine_receipt.py`) |
| `packages/` | Additional instruments and study tools (colour mixing, DAW/sound, CAD/EDA, fractals, voxels, weave, study tools), each with known-answer tests |
| `library/open-archives/` | Cross-archive search and download tool tagging each downloaded item with its licence (AGPL-3.0-only) |

```
npm run make -- "heavy rust coral upper left, fine teal frost on the right, \"seeing sounds, hearing images\"" out/first --seed first
```

The same words and seed give the same files, byte for byte. Change one word and only that element changes, in every medium, in the same place.

## Hear an image, see a sound

Every element in a piece is a law acting on a field. Reaction-diffusion coral, marbling, frost, ink in water, a slime-mould network and Kepler orbits are among the 15 laws. Each medium reads the same field in its own way:

| Medium | How it reads the field |
|---|---|
| Paint | pigment on paper, mixed band by band over 16 wavelengths and lit by the material's relief |
| Type | the text set across the page; each letter gets heavier and darker where an element acts |
| Lines | contour lines at even levels, as a drawing and as SVG |
| Material | height, roughness and normals, shown as clay under a raking light |
| Sound | left to right is time, top to bottom is pitch: you hear the picture as a score |
| Touch | a vibration pattern that follows the loudness over time |

An element in the upper left of the frame plays early and high. A dense element plays loud. The mapping is fixed and stated, so a person can learn to hear where things are, the way one learns to read a spectrogram.

## For every kind of reader

Each render writes a study of its own parts:

- `study.md` for people and screen readers. It gives one plain sentence per element and alt text for each medium.
- `study.json` for software and language models. It lists each element's properties, the weights its law read and the ones it ignored, and whether the law had settled. It also holds a measured record of how much of each element survived into each medium.
- `tactile.json` is a vibration pattern for a phone.

The engine never asks you to use one sense. Pick the readout that works for you, or layer two. The `room` command opens a local, private space for this kind of work, with words, numbers, pictures and sound converting into one another. It is a creative tool, and it makes no claims about therapy or outcomes.

## Plot it

Add `--plot a4` (or `a3`, `letter`, or a specification file) and the lines are also written for a pen plotter:

```
npm run make -- "heavy rust coral upper left, fine teal frost on the right" out/first --seed first --plot a4
```

```
out/first/plot.svg     millimetres, one layer for each pen, stroke width = pen tip
out/first/plot.hpgl    for HP and Roland plotters
out/first/plot.gcode   for G-code machines
out/first/plot.json    metres drawn, pen-up travel, pen lifts and estimated time for each pen
```

The paths are joined, simplified and ordered to cut the distance the pen travels lifted, and the same recipe gives the same bytes. It needs BuildLang's `buildc` on the PATH the first time, to build the program. `packages/plot-sheet/README.md` has the specification, the measures and the tests. No real plotter has drawn these files yet.

## Change it freely

A piece is a recipe you can edit by hand or recombine:

```
node superframe/cli/superframe.mjs artifact out/first/recipe.json out/b --isomer permute
node superframe/cli/superframe.mjs artifact out/first/recipe.json out/c --metamer coral
node superframe/cli/superframe.mjs artifact out/first/recipe.json out/d --route coral:sound:0
node superframe/cli/superframe.mjs artifact out/first/recipe.json out/e --edit elements.coral.weights.F=0.03
```

| Operation | What it does |
|---|---|
| `--isomer` | keeps every weight and moves the parts: the same ingredients in a new arrangement |
| `--metamer` | gives an ink a spectrum that matches in daylight and splits under tungsten light |
| `--route` | sets how much of an element passes into a medium; 0 silences it there |
| `--edit` | changes one weight |

## Beyond the artifact engine

The rest of the tree is the engine the recipes run on. It has 181 technique nodes and 31 converters behind one typed interface: lettering, Chladni plates, marbling, optics, instruments, retro display models and more. The graph inserts converters between media by itself.

```
node superframe/cli/superframe.mjs list
node superframe/cli/superframe.mjs try chladni.sand
node superframe/cli/superframe.mjs room
```

`superframe/docs/NODES.md` lists every node, generated from the registry by `node superframe/tools/gendocs.mjs`.

Every node and converter draws from its own substream of one seed rule, `xmur3-mulberry32/1`. That is the same rule the [site](https://harperz9.github.io/) uses, so a seed means the same thing everywhere.

## Study an image

```
node superframe/tools/study.mjs picture.png --out out/study/picture
python -I superframe/tools/study_verify.py out/study/picture/study.json superframe/schemas/study.schema.json
```

The study generator reads any image and writes `study.json`, nine plates at 3840 px and a viewer page. The colour criterion measures the palette, the area shares, value, hue and composition, and runs controls beside each one. `study.json` is canonical JSON with a SHA-256 receipt over every other field. The Python checker needs only the standard library. It checks the canonical bytes, the receipt, the shape that `study.schema.json` states and the hash of each plate, so a second language can confirm a study without Node.

PNG is read natively. Other formats go through OpenCV in the Python that `SUPERFRAME_PY` names.

## Measured libraries

Each library below was written against a pre-registration: the predictions, thresholds and controls came first, and the results were filled in after the run without editing what came before. Misses stay in the record. Each folder's README carries its PREREG and RESULTS; the optics and fluid studies are in `superframe/docs/prereg/`.

| Library | What it does | What the tests hold | Recorded misses and limits |
|---|---|---|---|
| `lib/study` | studies of any image: palette, shares, value, hue, composition, plates, viewer | shares within 0.5% on known colours; a uniform grey gives one swatch; shuffled pixels keep the palette while coherence falls; byte-identical repeats | colour is the only criterion so far |
| `lib/body` | joint limits and coupling for knee, jaw and stance | knee lock and screw-home, cord routing, planted jaw breaks found at the planted point (19.70 and 13.15 mm), contrapposto read on 98% of 200 poses; plain hinges fail as they must | the whole jaw path is off one circle (0.475 mm RMS, predicted over 1 mm); same-direction stances flagged 98.5% against 99% |
| `lib/compose` | vanishing points, edge score, depth ratio, anchors, the café-wall check | vanishing point within 0.25% of width in 12 of 12 scenes; shuffled directions find no point | the 200 mm control holds but is fragile; the anchor test is weak |
| `lib/stack` | slices of a volume read back by stacking: streaks, echoes, onion skins, frame cadence | streak length equals speed times shutter, exactly at the FWHM; lag peaks at the planted k; cadence of twos read at 15.00 Hz | the motion lens reads threes as still; the lens itself is not in this repository |
| `lib/value` | value budget, gold as tinted reflection, illuminant-swap metamers | every pixel above 0.95 is specular; the illuminant-swap pair matches at 0.000 under D65 and splits by 30 under A | the bright-pixel floor missed (0.0089% against 0.05%); grazing gold reads 0.9696 against 0.97 |
| `lib/quantize` | period codebooks, dither, halftone, duotone and two-ink overprint, scored through a model of the eye | CIEDE2000 matches published pairs to 4.2e-5; dither stays under 3 dE00 at 60 ppd; the area-true screen lands within 0.14% | nearest mapping on the red-cyan ramp read 5.68 against 6; Bayer 4x4 banding 5.14 against 3; duotone 8-bit residual 0.0059 against 0.004 |
| `lib/marble`, `lib/fluid` | marbling between sources with exact provenance, and the same ink moved by a thin-layer Stokes flow | the inverse is exact; each source keeps a share equal to its weight; the tine map comes out of floor friction with nothing fitted | tests on library concept inks skip without the reference library |
| `lib/medium` | spectral light: metamers, a picture hidden until candlelight, refraction and dispersion, Newton's rings and thick plates, directional light from 9 numbers | the rainbow sits on Descartes' angle; the thick-plate rings match Newton's diameters within 1.5% and 2%; MaxEnt-2 never goes negative | a light table and the native kernel tests skip until built |
| `lib/bio` | nuclei packing and branching from measured laws | the hard core reproduces the tissue spacing; random placement fails it | |

## Settings

| Variable | Used by | Default |
|---|---|---|
| `SUPERFRAME_PY` | the study loader for non-PNG images, `tools/stack-clip.mjs` | `python` on PATH |
| `PYTHON` | the study test that runs `study_verify.py` | `python` on PATH |
| `SUPERFRAME_DECOMPOSE` | the motion lens in `tools/stack-clip.mjs` | unset; the lens is not part of this repository |
| `SUPERFRAME_LIBRARY` | concept inks in `lib/marble/library.mjs` | unset; those tests skip |
| `SUPERFRAME_CIE` | `tools/rings-study.mjs`, the CIE 1931 tables as CSV | none; pass the folder |
| `FFMPEG`, `STACK_FFMPEG` | the clip and loop tools | `ffmpeg` on PATH |
| `PW`, `CHROME`, `AXE`, `OUT` | `tools/verify-room.mjs` (Playwright and axe-core) | Playwright's own browser, `out/verify-room` |

## Run the tests

```bash
npm test                 # core JS engine, laws, sound, type, and measured libraries
npm run test:packages    # JS package suites and cross-language superstack vector parity
npm run test:py          # Python suites across packages/ (physai, lenspipe, crt, kcore, superstack, colour) and library/open-archives/
npm run test:games       # Low Water engine, weather, light, paint, and combat suites
npm run test:rooms       # room solver suites
npm run test:slow        # name-art mosaic, site-music, and ear controls (~100s)
```

The suites verify:

- byte-identical output for the same recipe and seed;
- local edit isolation (an edit changes nothing outside its element's region or time window, paired with a control that fails if isolation breaks);
- metamer splits, golden node hashes, and known-answer physics/optics bounds with planted-wrong controls;
- fail-closed canonical `engine-receipt/1` SHA-256 verification (`packages/superstack/engine_receipt.py`).

Node 24 or later. The JavaScript engine has no third-party runtime dependencies. Python 3 runs the study verifier and `engine_receipt.py` using the standard library alone; `packages/` Python tests list their dependencies in `packages/README.md`.

## Limits

- The laws run on their own grids at half the output size. Fine texture at 4K comes from seeded grain, and the law itself runs coarser, so close up the paint is soft.
- Elements don't act on one another yet. Each law runs alone in its own region.
- Type is the weakest crossing. On the first full render, an element's ticks correlate with what the type shows at 0.06 to 0.34. Paint, material and sound reach up to 0.87 to 0.91.
- The intent reader knows a small English vocabulary. Words it doesn't know are listed, never guessed.
- The `explore` command needs a local reference corpus and is not part of this repository.
- Renders, clips and study plates are not in the repository. The tools write them under `out/`.
- The native light kernel ships as source (`superframe/native/`). Its tests skip until you build it with BuildLang and a C compiler.

## Layout

The engine was built as one workspace, and its folders keep their working names:

| Folder | What it holds |
|---|---|
| `superframe/` | the node interface, graph, converters, CLI, the artifact engine (`lib/artifact/`), the file writers and readers (`lib/formats/`), the finishing core (`lib/look/`) and the measured libraries |
| `creation/` | the creation engine's laws |
| `typeengine/`, `typeface/` | living type, the Accession family and the type forge (`typeface/forge/lib/`) |
| `substrate/` | the seed and receipt contracts |
| `sound/` | the sound engine: instruments, sequencer, sampler and players in `sound/sound/`, the reference renderer in `sound/reference/` |
| `packages/` | the instruments under the engine: measured data, materials, renderers, CAD and EDA, kernels, the CRT, the field type, the study tools, the weave, retro, fractal and voxel generators, the ear that measures rendered audio, the site's composed music with its measured instrument voices, and the living stills and loops with their GIF and APNG writers |
| other folders | the techniques the nodes wrap, each imported unchanged |

`MANIFEST.json` lists every file with the SHA-256 of its source.

## Licence

The code is under the OSI-approved MIT License (`LICENSE`). The Accession fonts are under the SIL Open Font License 1.1 (`OFL-Accession.txt`). Hanken Grotesk is under the same licence, from its authors (`OFL-Hanken-Grotesk.txt`). The creation engine's Zipf test reads one of the author's published essays as its corpus (CC BY 4.0, credited in the file).

By Zain Dana Harper.
