# Changelog

## Unreleased

Added:

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
