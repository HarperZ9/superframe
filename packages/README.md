# packages

The instruments that sit under the engine: measured data, materials, sampling geometry, renderers, circuit and CAD models, and the study tools. Every result here ships with its known-answer tests and with planted bad values that the tests must reject.

```
npm run test:packages                                # the JavaScript tests
python -m pip install -r packages/requirements.txt
npm run test:py                                      # the Python tests
```

| Package | What it does | Licence |
|---|---|---|
| `measured` | measured-data tables, each row with source, sha256, licence and status; `generated/` holds the physical constants every package imports | AGPL-3.0-only code, data under upstream terms, `generated/` CC0-1.0 |
| `materials` | spectral material records with Drude fits | AGPL-3.0-only, data per `materials/REUSE.toml` |
| `lattice` | grid choice: square, hex and BCC lattices, band-limit error, Gabor frames; `lattice/packing` adds packing algebra and tilings | FSL-1.1-MIT |
| `ndim` | n-dimensional renderer core, polytopes, Coxeter planes, slices | FSL-1.1-MIT |
| `perceive` | spectra and fields into sight, sound and touch, with the bits lost | FSL-1.1-MIT, CIE data CC BY-SA 4.0 |
| `joules` | RAPL, nvidia-smi and NVML power meter, joules per study | FSL-1.1-MIT |
| `diagram` | one model, every view: CAD, EDA and a circuit simulator | FSL-1.1-MIT |
| `kernels` | kernel contract with CPU and CUDA equivalence, planted bad kernels, receipts | FSL-1.1-MIT |
| `crt` | a CRT simulated as physics, from beam to phosphor to glass | FSL-1.1-MIT |
| `evolve` | a genetic-algorithm engine that must reproduce Eigen and Kimura first | FSL-1.1-MIT |
| `lawspace` | a law as a knob, with the wall where behaviour changes | FSL-1.1-MIT |
| `decompose` | `design_parts` takes a picture into palette, shape, geometry and rhythm; `textphase` reads a symbol stream as gas, liquid, crystal or critical | AGPL-3.0-only |
| `field` | the core type: unit, uncertainty, provenance, representation; graded transducers; a chain ledger | FSL-1.1-MIT |
| `cleanroom` | internal-copy vault, blends, difference report, release gate; see `cleanroom/LEGAL-CHECK.md` | FSL-1.1-MIT |
| `library` | a SQLite catalogue of every artifact, with an MCP server | FSL-1.1-MIT |
| `instruments` | the instrument pipeline from a law to a reading with a receipt, and the room meter | FSL-1.1-MIT |
| `quality` | image, motion and type checks: SSIM, banding, edges, grain, frame pacing, type rules and source evidence | FSL-1.1-MIT |
| `lenspipe` | an open lens design in, checked performance, manufacturability, tolerance, limits, as-built fit and interchange out | FSL-1.1-MIT, data CC0-1.0 |
| `emeans` | k-means where each centre forgets, in BuildLang, with a study of when it escapes the traps Lloyd cannot; includes the negative result at the setting fixed in advance | FSL-1.1-MIT |
| `superstack` | one contract for renderers and sound engines: canonical bytes, seed rule and vectors in JavaScript, Python and C++; moved here from its own repository with its history | FSL-1.1-MIT, text CC BY 4.0 |
| `reconcile` | creative generators as replayable browser worlds: expression algebra, refine loop, compositor and timeline (`node packages/reconcile/cli.js create gyroid --seed 7 --out out`); moved here from its own repository with its history | FSL-1.1-MIT |
| `studio-libs` | the Studio primitives: n-dimensional rendering (`render-nd`), sound rendering (`render-sound`), layered perception readouts (`sense-core`), the perceive, render and measure MCP server, and `viable-viz`; moved here from its own repository with its history | FSL-1.1-MIT |
| `strings` | string theory as checkable computations: critical dimensions, Virasoro central charges, the classical string, T-duality, the Hagedorn temperature, balanced metrics on the quintic, and extra dimensions against inverse-square-law limits | FSL-1.1-MIT |
| `cosmo` | the universe simulator's core: a particle-mesh cosmological N-body solver (Zel'dovich initial conditions, FFT gravity, kick-drift-kick in the scale factor) on CPU or CUDA, with the Eisenstein-Hu spectrum, halofit and an Ewald force reference | FSL-1.1-MIT, `data/camb_reference.json` is CAMB output |
| `latticechiral` | lattice fermions and their cures, the 2D index theorem, and continuum chiral fermions on interpolated lattice gauge fields (anomaly, 3-4-5 model, sign problem) | FSL-1.1-MIT |
| `wavelab` | waves pushed hard and timed well: shocks and acoustic saturation, cavitation collapse, Earth's free oscillations from PREM, the Lamb wave, parametric pumping, phased focusing, time reversal, a vibrating chain as a reservoir computer, and sound on Mars | FSL-1.1-MIT |
| `daw` | a workstation whose instruments are physical models: measured materials and real shapes to modes, struck, plucked or blown, heard in space; arrangement, mixer, WAV and FLAC export with a receipt; the real-time core in BuildLang | FSL-1.1-MIT |
| `remastering` | decode any audio file, read its condition, split it into stems and layers, restore, resynthesize and master it, with a receipt for every stage and a map of which regions are original, restored or made by the tool; see `remastering/README.md` | FSL-1.1-MIT |
| `colourmix` | three historical colour-mixing systems as BuildLang kernels: Mayer's triangle (1775), Lambert's pyramid (1772) and Benson's cube (1872); coordinates in, mixture in parts out, with named mappings of the cube to sRGB, Display P3, Rec. 2020 and CIE XYZ; each held to a Python reference with planted defects and a fuzz target; see `colourmix/README.md` | FSL-1.1-MIT |
| `studio` | the design studio: one material rendered as type, image, motion and sound from one seed; the house typeface as static and variable fonts; a recomputable eye for every picture; see `studio/README.md` | FSL-1.1-MIT |
| `rooms` | experimental rooms: lenses, optical trains, sound, PCB and fluid solvers, and a typed map registry; see `rooms/README.md` | FSL-1.1-MIT |
| `_vectors` | CC0 golden vectors for canonical records and statistics, shared with Flywheel and CMMNS | CC0-1.0 |

## Dependencies

The JavaScript engine has none. The Python packages use the versions pinned in `requirements.txt`. PyTorch with CUDA is optional: without it the full `kernels` check and the CRT's GPU backend skip, and say why.

## Environment variables

| Variable | Used by | Holds |
|---|---|---|
| `SITE_KIT` | page builders | the site repo's `system/kit`, inlined into each built page |
| `RENDER_OUT` | page builders, screenshot tools | where far-side renders go; default `out/render` |
| `CRT_STUDY_OUT` | `crt/study` | study output; default `out/crt-study` |
| `MEASURED_PRIVATE` | `measured` | tables kept out of this repo; `measured/data/PRIVATE.json` lists them by sha256, and tests that need one skip with the reason |
| `CLEANROOM_VAULT` | `cleanroom` | the vault directory |
| `LIBRARY_DB` | `library` | the catalogue database |
| `KERNELS_RECEIPTS` | `kernels` | receipt output; default `kernels/out/receipts` |
| `LAW_TABLE`, `RINGS_DATA`, `CHECKS_JSON` | data and page builders | private study inputs, needed only to rebuild the data they name |
| `FIELD_DEMO_IMAGE`, `FIELD_DEMO_TEXT` | `field/demos` | inputs for two demos |

## Built pages

Built pages, renders and receipts are never committed. Each page builder rebuilds its page; for example `SITE_KIT=<site>/system/kit python packages/ndim/page/build.py`.

`instruments/examples/*.json` are the exception, kept as dated worked examples. The room example reads private study results, so it rebuilds only where they are present; `diagram/tests/cad.test.js` checks all three against one record per instrument in `instruments/records`.

## Provenance

`PROVENANCE.json` lists every file the packages migration added, with its source (`workstation-tools@d82f57f:<path>`, a named private study folder, or new) and both sha256 values. `MANIFEST.json` holds the current hash of every file here.

## Who writes this folder

`packages/` is edited in this repo only. The publish tool writes the other top-level folders and leaves this one alone, and it keeps the `packages/` rows of `MANIFEST.json` when it rewrites that file. After a change here, run `python packages/build_manifest.py`.

## Licence boundary

Some FSL packages import AGPL ones at run time: `crt` imports `materials` and `measured`, and `cleanroom` imports `decompose` and `materials`. They share one author, so this repo may ship them together. A third party who distributes a modified combination takes on the AGPL terms for those parts.
