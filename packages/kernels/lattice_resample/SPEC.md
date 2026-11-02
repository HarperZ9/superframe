# lattice_resample 0.1.0: hex and square lattice sampling and reconstruction

Mode: **bit-identical**. Values float32, coordinates float64.

Lattice bases are the ones in `tools/packing/lattice.py` (read only): `SQUARE = I`,
`HEX = [[1, 1/2], [0, sqrt(3)/2]]` (columns are basis vectors).

## Inputs

| Name | Shape, dtype | Meaning |
|---|---|---|
| `img` | [C, H, W] f32 | image; pixel (r, c) sits at (x, y) = (c, r) |
| `geo` | [12] f64 | `ox, oy, sB (4, row-major), inv(sB) (4), a0, b0` |
| `shape` | [3] i64 | `nb, na, hex flag` |

The host computes `sB = spacing * B`, its inverse, and the coefficient box
`[a0, a0+na) x [b0, b0+nb)` that covers the image with a margin, all once in float64.

## Outputs

`samples` [C, nb, na] f32 and `recon` [C, H, W] f32.

## Maths

Sampling: lattice point (a, b) sits at `p = o + (sB00*a + sB01*b, sB10*a + sB11*b)`. Its
value is a clamp-to-edge bilinear read of the image (two float32 products and an add per
row, then per column, as written in `kernel.py`).

Reconstruction: pixel (x, y) maps to lattice coordinates
`al = (i00*(x-ox) + i01*(y-oy)) - a0`, `be = (i10*(x-ox) + i11*(y-oy)) - b0`. With
`ia = clamp(floor(al), 0, na-2)`, `fa = clamp(al - ia, 0, 1)` and the same for b:

- hex: the 60-degree cell splits along its short diagonal into two equilateral
  triangles. If `fa + fb <= 1`, `v = s00*(1-fa-fb) + s10*fa + s01*fb`; otherwise
  `v = s11*(fa+fb-1) + s10*(1-fb) + s01*(1-fa)`. Barycentric weights are affine
  invariants, so computing them in lattice coordinates is exact interpolation on the
  triangle.
- square: bilinear in (fa, fb).

Weights are formed in float64 and rounded once to float32 before the float32 combine.

## Known answers (checked)

A linear image reconstructs to within 1.2e-7 (float32 rounding) in the interior for
both lattices, because both interpolants reproduce linear functions exactly.

## Cost model

Bytes: per sample 16 bytes read + 4 written per channel; per pixel 16 read + 4 written
per channel plus the image. Flops: about 20 per sample position, 11 per sample per
channel, 20 per pixel for coordinates and 6 per pixel per channel.

## Open built-in

`grid_sample` (CUDA) and `map_coordinates` (CPU) for the sampling half only; no library
ships hex reconstruction. Max abs difference from this kernel's samples: 1.2e-7 (CPU)
and 5.7e-6 (CUDA; `grid_sample` normalises coordinates to [-1, 1] in float32).

## BuildLang port note

Blockers from `blend/SPEC.md` apply. Specific: integer-indexed gathers from a runtime
3-D float32 buffer, and a 2x2 float64 inverse on the host (the `linalg` library covers
1-D vectors only per its docs, so the inverse would be written by hand, which is easy).
