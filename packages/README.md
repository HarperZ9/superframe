# packages

Engine packages that started as standalone workshop tools and now live in the monorepo, one folder each.
Each package keeps its own README (mission, contents, limits), its own tests and its own licence.

| Package | What it gives the engine | Language | Licence |
|---|---|---|---|
| `formulas` | statistics units that beat the rule they replace on held-out data: the exact binomial bound rule with Holm, the guarded two-lines U test, the shareability estimator | Python (numpy, scipy) | FSL-1.1-MIT |
| `materials` | 111 measured materials with spectral n and k, Fresnel with complex N, GGX, Drude and Drude-Lorentz, CIE colour; a JavaScript twin checked against the Python on shared vectors; the `materials.swatch` node | Python (stdlib) and JS | code AGPL-3.0-only; data per field (CC0-1.0, US Government works, CC-BY-4.0); CIE tables CC-BY-SA-4.0 |
| `kernels` | the kernel contract (spec, reference, fast CPU, fast GPU, bit-identical equivalence, benchmark, receipt) and four kernels: blend, advect_diffuse, lattice_resample, spectral_shade | Python (numpy; torch CUDA optional) | FSL-1.1-MIT |

## Test

```
npm test            # the JS suite, including packages/*/tests/*.test.mjs
npm run test:py     # the Python packages: pip install numpy scipy pytest
npm run test:all
```

The kernel tests run every kernel's equivalence check on the CPU paths present, and on CUDA when torch
with CUDA is installed. They write no receipts.

## Open decisions

- `materials.swatch` is not in the default node registry. The engine core is FSL-1.1-MIT and this package
  is AGPL-3.0-only, so loading it from `superframe/adapters/` is a licence call for the author.
- `kernels/spectral_shade` reads its spectra through the `materials` Python package (AGPL) at run time.
- `formulas` is meant to be the one statistics home for the Commons (AGPL) and the Flywheel (FSL). FSL code
  cannot be pulled into an AGPL program without care, so MIT may suit this package better.
