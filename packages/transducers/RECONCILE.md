<!-- writing-profile: research -->
# Reconcile with the package migration

For the agent moving `tools/*` into `packages/*`. This package touches neighbours only through `src/adapter.js`, and its subpaths under the root match both layouts, so once `packages/field`, `perceive`, `measured`, `materials`, `diagram` and `kernels` land, it binds with no edit and with `TRANSDUCERS_ROOT` unset.

## State on main, 2026-11-13

The package is on main's layout. All six neighbours sit at the subpaths the adapter expects, so `TRANSDUCERS_ROOT` stays unset. Item 1 below was decided on 2026-10-31: the Schott and Kodak 5219 tables are private, and the adapter now reads them from `MEASURED_PRIVATE` or `measured/data/private/`. The page builds without them. Root `npm run test:packages` runs these tests on CI, `MANIFEST.json` has the rows, and `CHANGELOG.md` and `packages/README.md` list the package. Everything else below is still open.

## Must decide or change

1. **Measured data that may stay private.** `schott_glass.json` and `kodak_5219.json` are marked internal or undecided in PLACEMENT.md. The demos, the lens and film tests and the built page read them. If they stay private, public CI skips those tests with the stated reason, and `demoCamera` falls back to a Gaussian PSF. `p22_kuhn2002.json` carries the same question for its digitised figure; only the `model` block is used here.
2. **Built page.** It inlines one Schott row and a materials record, and links kit fonts including Conso. It builds to `TRANSDUCERS_OUT`, never into the repo. Publishing it needs the data decision, `system/kit` from the site PR, and no Conso.
3. **Field in a page.** `field/src/ledger.js` calls Node's `Buffer`; `page/shim.js` supplies a small one and a synchronous sha256. Move both into the field package, or replace `Buffer` in `bytesOf`.
4. **Field units.** No farad, mV, mol/L or per-square-metre names beyond the composite parser. These kernels use SI numbers and `"1"` in places. Add units, then tighten `hh`, `cable` and `modalFilter` ports.
5. **Field grade rule.** `decideGrade` reads `keeps` only on a lossy map, so a lossless map with a broken structure passes. `T.run` adds the stricter rule. It belongs in `F.apply`, which may refuse a converter that passes today.
6. **Field sphere and graph domains.** `shIrradiance` runs on a plain sequence. The study proposed a sphere domain with quadrature weights; adopt it there.

## Duplicates to merge

| Here | There | Action |
|---|---|---|
| `core.js` `T.rng` | `substrate/lib/vendor/superstack.mjs`, `superframe/lib/seed.mjs` | same stream, tested; share one classic-script build |
| `pixels.js` Huffman | none found in `field`, `perceive` | candidate home if the migration adds a shared coder |
| `space.js` `denseSolve` | `diagram/sim/src/linalg.js` | use the simulator's LU once its API is stable |
| `space.js` `jacobiEig`, `T.modes` | `field/py/modal_basis.py` | keep JS for small domains; parity test exists |
| `organic.js` `nelderMead` | check `formulas`, `latent` | one optimiser if one exists |
| `noise.js` `Phi`, `varOf` | CMMNS stats vectors | test against the CC0 vectors |
| `time.js` `p22Decay` | `crt/crt/phosphors.py` `KuhnDecay` | one record: the measured model; add a shared vector |
| `structure.js` `helix`, `contactOf` | `lattice`, `ndim` | none merged; no overlap found by name |
| `demos.js` `gaussPsf` | `lattice` Gabor frames | leave |

No FFT was added: every transform goes through `F.fft`, or `P.fft` for the raw window spread. Physical constants come from `measured`; none are copied, except where a kernel marks `from_memory`.

## Repo wiring not done here

- `MANIFEST.json`, root `package.json` test script and `CHANGELOG.md` are untouched, to avoid conflicts with `feat/packages`. Root `npm test` does not run this package yet.
- The kernels registry (`kernels.json`) is read for name collisions, and `T.toKernelsRow` maps a kernel onto its slots. No row was added. No kernel here has a GPU path, so the equivalence slot says so.
- `tests/chain.test.js` loads superstack by relative path from `packages/transducers`.
- `publish-repo.mjs` must leave `packages/` alone.

## Downloads wanted (none made)

| Name | Source | Size | Licence |
|---|---|---|---|
| Photoreceptor Naka-Rushton fits, to replace `from_memory` retina values | Baylor, Nunn and Schnapf 1984, 1987; PMC where open | unknown | journal terms; values are facts |
| EMVA 1288 sensor measurement, to test the shared curve on a real photosite | a camera maker's published report | about 1 MB | unknown, read terms first |
| Hodgkin and Huxley 1952 Table 3, to replace the textbook constants | J Physiol, via PMC | about 3 MB | journal terms; values are facts |
| Tissue refractive index table for the glass-frog kernel | Taboada et al. 2022 and a tissue-optics review | unknown | journal terms |
