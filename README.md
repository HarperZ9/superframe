# Superframe

Describe a piece in plain words and get it back in every medium at once: a painting, a page of living type, a line drawing, a carved material, a sound and a touch pattern. All of them come from one seeded recipe. You can then read the piece back as a study of its own parts, in whichever sense works for you.

Superframe is one part of a larger creative and study platform. It is the engine part: the laws, media and measures that the other tools draw on. It ships here on its own, under its own name.

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

The rest of the tree is the engine the recipes run on. It has 171 technique nodes and 31 converters behind one typed interface: lettering, Chladni plates, marbling, optics, instruments, retro display models and more. The graph inserts converters between media by itself.

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

```
npm test
```

There are 461 tests. On a clean clone 446 pass and 15 skip: the skipped ones need a render, a light table, the reference library or a native build that this repository does not carry. They cover these properties:

- the same recipe gives the same bytes;
- an edit changes nothing outside its element's region or its time window, with a control that proves the check can fail;
- an unused word changes nothing;
- the metamer split;
- golden hashes for every node;
- each measured library's predictions, with a control beside each that must fail.

Node 24 or later. There are no dependencies. Python 3 runs the study verifier, with the standard library only.

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
| `superframe/` | the node interface, graph, converters, CLI, the artifact engine (`lib/artifact/`) and the measured libraries |
| `creation/` | the creation engine's laws |
| `typeengine/`, `typeface/` | living type and the Accession family |
| `substrate/` | the seed and receipt contracts |
| other folders | the techniques the nodes wrap, each imported unchanged |

`MANIFEST.json` lists every file with the SHA-256 of its source.

## Licence

The code is under FSL-1.1-MIT (`LICENSE`), which becomes MIT two years after each release. The Accession fonts are under the SIL Open Font License 1.1 (`OFL-Accession.txt`). Hanken Grotesk is under the same licence, from its authors (`OFL-Hanken-Grotesk.txt`). The creation engine's Zipf test reads one of the author's published essays as its corpus (CC BY 4.0, credited in the file).

By Zain Dana Harper.
