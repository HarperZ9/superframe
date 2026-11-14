# Changelog

## Unreleased

Added:

- `superframe/lib/look`: the finishing core, carried from the author's workspace where it was written on 2026-10-28: a hue-preserving display shoulder and an AgX curve, energy-conserving bloom, film grain in three dye layers, a dithered 8-bit encode, OKLab grading, a modelled newsprint press, a brush ink line, a comic panel compositor and caricature warps, with 8 tests. The code is JavaScript and unchanged; `superframe/lib/look/README.md` lists each module as a BuildLang port candidate.

- `packages/plot-sheet`: plotter output for any line drawing, written in BuildLang. `npm run make -- "<intent>" out/dir --plot a4` writes `plot.svg` in millimetres with one layer for each pen, `plot.hpgl`, `plot.gcode` and `plot.json` beside `lines.svg`; without `--plot` the make command writes what it wrote before. Paths are clipped to the printable area, joined where their ends meet, simplified, and ordered to cut pen-up travel (nearest end, then 2-opt inside a time and evaluation limit), and each sheet states metres drawn, pen-up travel before and after, pen lifts and estimated time for every pen. Each file is read back by an independent reader in the tests, with controls that must fail, and a fixture pins the bytes across machines. No real plotter has drawn the files yet. `node superframe/tools/plot-strata.mjs` writes the demonstration sheet, ridgelines of a terrain in two pens.

Changed:

- Every 8-bit export now passes through the display shoulder in `superframe/lib/look/tone.mjs`: `toSRGB8` in `superframe/lib/pix.mjs` rolls values past 1.0 toward white with the hue held, where it used to clip each channel, and the dither is one value shared by the three channels. Four node goldens changed with it (`site.retro`, `marble.bath`, `universe.seam-brush`, `universe.seam-halftone`); the new hashes equal the ones the workspace recorded on 2026-10-28.
- Twelve engine files that changed in the author's workspace after the last full publish now match it. `lettering/lib/letter.mjs` stops rebuilding a destroyed or detached letter. `sound/sound/v3/instruments/reed.js` removes the DC offset of a held note with a 30 Hz high-pass. `name-art/lib/img.mjs` and the `compose.finish` node take grain, bloom and the shoulder from `superframe/lib/look`. The name-art nodes default to the text "Low Water". Name-art concepts 11 and 15 can hold their grain still across a loop, and concept 16 gains a line-pitch setting and the press finish in the new `name-art/lib/press.mjs`. `superframe/lib/compose/stats.mjs` adds an exact binomial interval and a bound rule, with `superframe/tests/compose-stats.test.mjs` (3 tests). Five node goldens changed: `inst.reed`, `compose.finish`, `nameart.word`, `nameart.textfield`, `nameart.mosaic`.
- Six capabilities the engine loaded from a vendored snapshot of site code are engine code now, moved with their history and with the tests the site held for them: `packages/weave` (loom drafts and WIF 1.1), `packages/retro` (palettes, dither, tube stage), `packages/fractal` (formula language and CPU renders), `sound/reference/` (the reference sound renderer), `superframe/lib/formats/` (MIDI and relief STL writers) and `typeface/forge/lib/` (the type forge). The seed helpers they share are `superframe/lib/seed-streams.mjs`. The moved code is JavaScript and unchanged apart from import paths; each README lists its modules as BuildLang port candidates. `npm test` now also runs `sound/reference/tests` and `typeface/forge/tests`. Plot maps and the plotter still load from `superframe/upstream/`.

## 0.3.0 (2026-11-14)

This repository is now The Playground, the engine: the C++23 renderer, Low Water, the Studio primitives and the two engine repositories moved in with their history, and `packages/` holds the instruments under the engine, each with known-answer tests. The first renderer module and several kernels are now BuildLang, held bit for bit to their references in CI. The package is not on npm; clone the repository at the tag.

Tests: `npm test`, `npm run test:packages`, `npm run test:py`, `npm run test:games` and the manifest check ran on CI on the release head, with the BuildLang jobs. Tests that need a plate bake, a private table or a site checkout report as skipped.

Added:

- `packages/registry`: one entry shape for every named thing the stack uses, with a stable id, a reference, families and neighbours. The first table is `data/units.json`, 90 units in six scale kinds. A checker written in BuildLang runs 14 checks on the table; each broken control table must fail on its own check and no other.
- `native/bld`: the renderer is moving from C++ to BuildLang one module at a time. The art scene renderer is the first module moved; its output equals the hash the C++ tests pin, and CI fails unless the runner reports it identical.
- `packages/colourmix`: three historical colour-mixing systems as BuildLang kernels, Mayer's triangle (1775), Lambert's pyramid (1772) and Benson's cube (1872), with named mappings of the cube to sRGB, Display P3, Rec. 2020 and CIE XYZ. Each is held to a Python reference with planted defects and a fuzz run.
- `packages/emeans`: k-means where each centre forgets, in BuildLang, with a study of when it escapes the traps Lloyd's algorithm cannot. The negative result at the setting fixed in advance is kept.
- `packages/remastering`: decode an audio file, read its condition, split it into stems, restore and master it, with a receipt for every stage and a map of which regions are original, restored or made by the tool. The Demucs weights are not in this repository; the README says how to fetch and check them.
- `packages/cosmo`: a particle-mesh cosmological N-body solver on CPU or CUDA, with the Eisenstein-Hu spectrum, halofit and an Ewald force reference.
- `packages/wavelab`: shocks and acoustic saturation, cavitation collapse, Earth's free oscillations from PREM, the Lamb wave, phased focusing, time reversal, and sound on Mars, as checked computations.
- `packages/strings` and `packages/latticechiral`: string theory and lattice fermions as checkable computations, among them critical dimensions, T-duality, cosmic-string backgrounds, the 2D index theorem and continuum chiral fermions on interpolated lattice gauge fields.
- `packages/rooms`: the Fluid Room (a Navier-Stokes solver with a regime gate and the Blasius known answer) and the Map Room, a typed registry of maps between fields. `npm run test:rooms` runs their tests.
- `packages/transducers`: 60 named kernels in 11 groups on one field interface, each stating what it lost in measured bits, with four demo chains (photon to pixel, photon to spike, text to motif spectrum, DNA to alignment) and a budget sweep. `npm run test:packages` runs its 112 tests; seven skip in the public tree, five because the Schott and Kodak 5219 tables are private and two because no BuildLang line breaker is bound. It was written on 2026-10-30 against 0.2.0 and brought onto main with its commit.
- `native/`: the C++23 renderer, formerly the raw-native repository, with its history. Ten of its workflows run from here as `native-*`; they start only when `native/` changes.
- `games/low-water/`: Low Water, formerly a private repository, with its history. The engine it reads is now the sibling `native/` folder, so no path points at a workstation. `npm run test:games` runs 256 tests; six that need a plate bake skip where the bake is absent.
- `packages/studio-libs`: the Studio primitives now live here with their history. The parity test against the site skips when no site checkout sits beside it.
- `packages/superstack` and `packages/reconcile`: the two engine repositories now live here with their full history. Their old repositories are archived and point at this one.
- `packages/`: the instruments under the engine, each with its known-answer tests. See `packages/README.md`.
- `npm run test:packages` and `npm run test:py`, both run on CI.
- `packages/quality`: SSIM, banding, edge, grain, frame-pacing and type checks with known answers; browser checks skip without Playwright.
- `packages/daw`: physical-model instruments from measured materials and real shapes, sound in space (delay, spreading, ISO 9613-1 air absorption, Doppler), a voice from a vocal-tract shape, arrangement, mixer, WAV and FLAC export with a superstack receipt, and the real-time core in BuildLang. Design and measurements: `packages/daw/DESIGN.md`.
- `packages/daw`, fourth slice: an f32 vector voice bank (0.41 ns per mode-sample, through BuildLang's unchecked slice access and vectorised release builds); impacts from the rooms' collision geometry (`rooms/core/data/impact-scene.js`) with the landing point choosing the modes; live raindrop bubbles; wind held to three measured storm recordings (`measured/data/storm_spectra.json`); folds coupled to a waveguide vocal tract, a nasal branch, and the oesophageal voice. The DSP other packages may import is listed in `packages/daw/ARCHITECTURE.md`.
- `packages/daw`, third slice: the audio thread on the performance cores and a faster voice bank (19,200 modes held in two 60 s runs); live engine events into the BuildLang host, with impacts from `engine/impacts.mjs`; the rooms' rain scene reads its streak density from the shared scene-physics record; area functions of the 44 Dresden MRI tracts (`measured/data/vocal_tract_areas_dvtd.json`), with the 1D tract within 10 percent of the measured F1 for 41 of 44.
- `packages/daw`, second slice: the real-time host is BuildLang (`bld/main.bld`, through BuildLang's audio binding); aluminium and steel loss factors measured from recorded bars; a bowed string and a reed; waveguide strings and piano; swell, tremolo and delay with an analyser; lip radiation, yielding walls and two-mass vocal folds; scenes that make their own sound from one physics record (`packages/daw/ARCHITECTURE.md`), with rain as the first source.
- `packages/measured`: `decay_iowa.json` (loss factors from the University of Iowa samples) and `vocal_tracts_dvtd.json` (measured resonances of 44 printed MRI vocal tracts).
- `packages/measured`: `mechanical.json`, elastic constants, densities, sound speeds and air absorption from Kaye and Laby, and Leissa's clamped-plate table.
- `packages/studio`: the design studio documented as a package, with a command line (`node packages/studio/bin/studio.mjs`). Two ports held byte-identical to goldens from their source commits: the TrueType and variable-font writers from Flywheel (`harness/typeface_ttf.py`, `typeface_variable.py`), and the eye (difference hash, drift verdict, readings) from studio-engine. `packages/studio/docs/STUDIO-MATRIX.md` maps 103 older features to the studio with the check that would prove each port.
- `packages/lenspipe`: an open lens design in, checked performance, manufacturability, tolerance, limits, as-built fit and interchange out.
- `packages/lenspipe`: the verdict line names the optical performance class beside the manufacturability status; drawings print a radius tolerance and say when no mechanical diameter is stated; a clear-aperture rule with `mech_semi`.
- `packages/diagram`: a sheet lint for words crossed by drawn work and for crossed balloon leaders; resistors and capacitors on stocked E-series values with tolerance and voltage in both BOMs; units in the CAD manifest; board mounting holes taken from the model's standoffs, with a non-plated drill file; a silkscreen overlap rule; seeded fuzz tests for the CAD drawings and the Gerber and Excellon writers.

## 0.2.0 (2026-10-28)

Superframe is one part of a larger creative and study platform. This release adds the study generator and the measured libraries. Each library was written against a pre-registration, and its README keeps the PREREG and RESULTS, misses included.

Added:

- `lib/study`: a study of any image. `tools/study.mjs` writes `study.json`, nine plates at 3840 px and a viewer. `schemas/study.schema.json` states the record, and `tools/study_verify.py` checks it with the Python standard library: canonical bytes, receipt, schema and plate hashes.
- `lib/body`: joint limits and coupling for the knee, the jaw and stance.
- `lib/compose`: vanishing points, edge score, depth ratio, anchors and the café-wall check.
- `lib/stack`: slices of a volume read back by stacking, for streaks, echoes, onion skins and frame cadence.
- `lib/value`: the value budget, gold as tinted reflection, and metamers that split when the light changes.
- `lib/quantize`: period codebooks, dither, halftone, duotone and two-ink overprint, scored through a model of the eye.
- `lib/marble` and `lib/fluid`: marbling between sources with exact provenance, and the same ink moved by a thin-layer Stokes flow.
- `lib/medium`: metamers, a hidden picture that appears by candlelight, refraction and dispersion, Newton's rings and thick plates, and directional light from 9 numbers.
- `lib/bio`: nuclei packing and branching from measured laws.
- `native/`: the light kernel in BuildLang and its C driver, as source.
- `docs/prereg/`: the pre-registrations for the optics, light and fluid studies.
- Adapters for `bio`, `marble`, `spectral` and `study`, and new optics nodes. 171 technique nodes and 31 converters in all.
- Tools for the plates, demos and studies of each library. Paths they need come from settings (`SUPERFRAME_PY`, `SUPERFRAME_DECOMPOSE`, `SUPERFRAME_LIBRARY`, `SUPERFRAME_CIE`, `FFMPEG`), listed in the README.
- A test workflow that runs `npm test` on every pull request.

Changed:

- Node 24 or later is now required. 0.1.0 stated Node 22, but on Node 22 six of its golden hashes fail (`sound.phrase`, `sound.shepard`, `reveal.spectrogram`, `perceive.haas`, `perceive.maskreveal`, `perceive.features`), and two more nodes in this release fail there too. The same suite passes on Node 24 and Node 25. The cause is not traced; the likely candidate is a change in the engine's floating-point maths between versions.

Tests: 461 in all. A clean clone passes 446 and skips 15 that need a render, a light table, the reference library or a native build.

Recorded misses, kept as measured:

- `lib/body`: the whole jaw path is off one circle by 0.475 mm RMS, where over 1 mm was predicted; same-direction stances are flagged in 98.5% of cases against a 99% line.
- `lib/value`: 0.0089% of the white scene is above 0.95, against a 0.05% floor; grazing gold reads 0.9696 against 0.97.
- `lib/quantize`: nearest mapping on the red-cyan ramp reads 5.68 against 6; Bayer 4x4 banding reads 5.14 against 3; the duotone 8-bit residual is 0.0059 against 0.004.
- `lib/stack`: the motion lens reads a cadence of threes as still.

Limits: the motion lens and the reference library are not in this repository, and the tests that need them skip. Renders, clips and plates are written under `out/` and are not committed.

## 0.1.0 (2026-10-26)

First public release: one seeded recipe rendered as paint, living type, line, material, sound and touch, with a study of its own parts. 160 nodes and 271 tests.
