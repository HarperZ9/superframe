# lattice

**Mission.** Make the choice of grid a measured decision. Most signals are stored on a square
grid because screens and arrays are square, and that choice costs samples whenever the content
does not care about the axes. This library samples, decomposes and rebuilds signals on square,
hexagonal and other lattices with exact error accounting, so anyone can check where a hexagonal
(or BCC, or geodesic) layout pays, where it does not, and why. Every claim it supports ships with
its control and its limit.

## What it does

| Module | Does |
|---|---|
| `basis.py` | The one definition of the square, hex, SC (cubic), FCC and BCC bases. `packing` reads them from here. |
| `lattices.py` | Generators for square, hex, cubic, BCC, FCC at a given density; packing radius and density; least alias-free density for a ball spectrum; exact-count point sets in a box. |
| `bandlimit.py` | Isotropic random fields on a lattice's periodic supercell; the ideal low-pass rebuild error, exact by Parseval; the continuum error (no k-grid) by Monte Carlo; least-squares rebuild from jittered samples. |
| `imagerep.py` | Point sampling with a Gaussian prefilter and normalised kernel rebuild; decomposition into Gaussian discs or soft hexagons with a constant or first-order colour field (exact least-squares fit); weighted Lloyd placement; PSNR, SSIM; a spectral axis-alignment index. |
| `gabor.py` | Discrete Gabor frames on rectangular and hexagonal (quincunx) time-frequency lattices; fast frame operator by the Walnut structure; frame bounds; canonical-dual rebuild; chirplet atoms; orthogonal matching pursuit. |
| `sphere.py` | Lat-long, icosahedral geodesic and Fibonacci grids; real spherical harmonics; isotropic and zonal random fields; least-squares rebuild. |
| `cells.py` | Constant or first-order fields per Voronoi cell, in a periodic box or on the sphere, at matched parameter budgets. |
| `tonnetz.py` | Interval distance on the hexagonal Tonnetz (fifths, major thirds, minor thirds) and on the semitone line. |
| `stats.py` | Bootstrap intervals and one-sided p, Spearman with bootstrap, Benjamini-Hochberg. |

## Run it

From the repo root (runs the lattice and packing suites in one process):

```
python -m pytest -q -p no:cacheprovider packages/lattice
```

`tests/test_stats_vectors.py` checks `stats.bh` against the shared golden vectors in
`packages/_vectors/stats_vectors.json`.

```python
import sys; sys.path.insert(0, "packages/lattice")
from lattice import lattices as L, bandlimit as B
L.nyquist_density("hex", 1) / L.nyquist_density("square", 1)   # 0.8660: 13.4% fewer samples
L.nyquist_density("bcc", 1) / L.nyquist_density("cubic", 1)    # 0.7071
```

## Known answers the tests hold

- Packing densities of square, hex, cubic, BCC and FCC equal pi/4, pi/(2 sqrt 3), pi/6, pi sqrt 3/8 and pi/(3 sqrt 2).
- Alias-free density ratio hex/square is sqrt(3)/2 (Petersen and Middleton 1962) and BCC/cubic is 1/sqrt 2, by two independent routes (packing radius and a boundary-direction bisection).
- A disc spectrum inside the reciprocal Voronoi cell rebuilds with zero error; least squares on a regular lattice equals the fold formula.
- The Walnut frame operator equals the dense G G^H; a short window gives the diagonal "painless" frame operator.
- Normalised kernels form a partition of unity, and a first-order field reproduces a linear ramp exactly (images and 3-D cells).
- Geodesic frequency 5 has 252 vertices; real spherical harmonics are orthonormal under a dense Fibonacci quadrature.

## Limits

- Hexagonal primitives here have fixed centres and supports; only their colours are solved. Methods that optimise shape and position jointly (Gaussian splatting, Hexels) can do better than any fixed layout.
- The time-frequency hex lattice is a quincunx; it is hexagonal after the window's time-frequency rescaling, which the window search provides.
- Isotropic random fields are a model. Real images, sounds and globes are not isotropic, and that is where results change.

Licence: FSL-1.1-MIT, from the repository root.

`packing/` is the packing algebra (basis plus motif, tilings, spirals, Penrose, Apollonian, crystals).
Import it with `packages/lattice/packing` on `sys.path` as `from packing import algebra`; see `packing/README.md`.
