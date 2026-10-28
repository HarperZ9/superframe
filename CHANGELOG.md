# Changelog

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

Tests: 461 in all. A clean clone passes 446 and skips 15 that need a render, a light table, the reference library or a native build.

Recorded misses, kept as measured:

- `lib/body`: the whole jaw path is off one circle by 0.475 mm RMS, where over 1 mm was predicted; same-direction stances are flagged in 98.5% of cases against a 99% line.
- `lib/value`: 0.0089% of the white scene is above 0.95, against a 0.05% floor; grazing gold reads 0.9696 against 0.97.
- `lib/quantize`: nearest mapping on the red-cyan ramp reads 5.68 against 6; Bayer 4x4 banding reads 5.14 against 3; the duotone 8-bit residual is 0.0059 against 0.004.
- `lib/stack`: the motion lens reads a cadence of threes as still.

Limits: the motion lens and the reference library are not in this repository, and the tests that need them skip. Renders, clips and plates are written under `out/` and are not committed.

## 0.1.0 (2026-10-26)

First public release: one seeded recipe rendered as paint, living type, line, material, sound and touch, with a study of its own parts. 160 nodes and 271 tests.
