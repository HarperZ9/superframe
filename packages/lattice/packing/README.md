# packing

**Mission.** One algebra for shapes that fill space. A periodic packing is a basis matrix B and a
motif, and its density is the motif's area (or volume) over |det B|. Shearing, rotating and scaling
it are matrix products on B, and undoing a map is its inverse. This library makes that view
computable and checks it against known answers. It also covers the packings the view leaves out:
spirals, Penrose tilings and Apollonian gaskets. These have no basis, so the library builds them
by their own rules.

## Modules

| File | What it does |
|---|---|
| `packing/algebra.py` | `Lattice(B, motif_volume)`: density, `transform(M)` (M @ B), `untransform(M)`, `dual()` (B^-T), Gauss and LLL reduction, shortest vector, packing radius, point enumeration. `with_balls(B, offsets)` fits the largest equal balls. The square, hex, SC, FCC and BCC bases come from `lattice.basis` (one definition shared with the lattice package); `hcp()` builds here. |
| `packing/polygons.py` | Polygon area, the four tilings (square, triangle, hexagon, 72-degree rhombus) with an overlap counter, and the densest lattice packing of any convex polygon by Minkowski's critical determinant of K - K. |
| `packing/spiral.py` | Vogel's model r = c sqrt(n), angle n x 137.508 deg; parastichy counts; nearest-neighbour uniformity; divergence-angle sweep. |
| `packing/penrose.py` | P3 rhombus tiling by Robinson-triangle substitution; rhombus pairing; vertices; exact thick:thin counts. |
| `packing/apollonian.py` | Gasket from the root quadruple (-1, 2, 2, 3) with the complex Descartes theorem; covered fraction; dimension fit. |
| `packing/crystal.py` | The 32 crystal classes, enumerated as subgroups of m-3m and 6/mmm; FCC (ABC) and HCP (AB) stacking with coordination shells. |
| `packing/sampling.py` | Equal-count point sets on the unit disc (spiral, hex, square, Penrose, random, jittered) and on the sphere (Fibonacci, icosahedral geodesic, lat-long, random), with covering radius and discrepancy. |

## Run the tests

From the repo root (the lattice suite runs in the same process):

```
python -m pytest -q -p no:cacheprovider packages/lattice
```

Import: put `packages/lattice/packing` on `sys.path`, then `from packing import algebra, spiral`.
`algebra.py` adds `packages/lattice` to `sys.path` itself to reach `lattice.basis`. Until
2026-10-31 this module was a top-level `lattice.py`, which shadowed the lattice package.

27 tests, about 90 s (the crystal-class enumeration takes about 20 s). Each test checks a known
answer: square pi/4, hex pi/sqrt(12), FCC and HCP pi/sqrt(18), BCC pi sqrt(3)/8, SC pi/6, every tiling
covers each point exactly once, triangle 2/3 and octagon (4 + 4 sqrt 2)/(5 + 4 sqrt 2) as densest lattice
packings, thick:thin to phi, integer Apollonian curvatures, 32 crystal classes, FCC shells 12, 6, 0, 24
against HCP 12, 6, 2, 18.

## What the matrix view leaves out

Penrose tilings, Vogel spirals and Apollonian gaskets have no basis, so `det B` says nothing about them.
A det-1 map still keeps their density, because it keeps area. That holds for any measurable set, so it
is geometry rather than lattice algebra. Rotations keep round discs round. A shear turns them into
ellipses, and refitting round discs to a sheared hex lattice loses density, because the hex lattice is
the densest lattice for discs.

Study using this library: the 2026-10-29 packing study (workspace records, not in this repository).
