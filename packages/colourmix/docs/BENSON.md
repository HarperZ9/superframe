# Benson 1872: the colour cube

## What the historical system computes

William Benson placed every colour inside a cube. Its three axes are the intensities of three lights: red,
green and blue. Black sits at the corner where all three are nil, and white sits at the far corner where
all three are at full intensity. This is a model of mixing lights, where Mayer and Lambert mixed pigments.

The kernel works on a lattice, which here means the grid of points whose three levels are whole steps from 0
to `n`. It answers four questions: which point lies at a given place in a flat section of the cube, which
point is the complement of a given point, which corner letter a point carries, and which point lies a given
number of steps along a straight line between two points.

## Source

William Benson, *Principles of the Science of Colour*, second edition, London: Chapman and Hall, 1872. Copy:
Getty Research Institute, digitised on the Internet Archive.

- Record: https://archive.org/details/gri_c00033125008694651
- Text: scan pages 14, 15, 35, 37 and 39 (read from the OCR layer)
- Plate: nine blocks of painted discs, scan page 48
- Rights: marked not in copyright on the record

## Contract

Integer arguments and results are 64-bit signed. `out` is a pointer the caller owns with room for three
values. `ends` points to six values: the red, green and blue levels of point `a`, followed by those of point `b`.
A rejected call writes nothing to `out`.

| Export | Returns | Writes |
|---|---|---|
| `cm_benson_count(n)` | number of lattice points, `(n + 1)^3`, or -1 | |
| `cm_benson_section(n, axis, level, u, v, out)` | status | red, green, blue |
| `cm_benson_complement(n, r, g, b, out)` | status | `n - r`, `n - g`, `n - b` |
| `cm_benson_corner(n, r, g, b)` | ASCII code of the corner letter, 0 for a point that is no corner, -1 on reject | |
| `cm_benson_line(n, ends, steps, k, out)` | status | point `k` of the line from `a` to `b` cut into `steps` equal steps |

- `n`: steps per light, 1 to 4096. The plate uses `n = 2`.
- `axis`: 0 red, 1 green, 2 blue. The section holds that light at `level`; `u` and `v` are the other two
  lights in red, green, blue order.
- Corner letters: Z black, R red, G green, B blue, Y yellow, S sea-green, P pink, W white.
- Line: `steps` is 1 to 4096 and `k` is 0 to `steps`. A point that falls between lattice points is rejected.
- Status: 0 accepted, 1 `n` outside 1 to 4096, 2 point outside the cube, 3 axis outside 0 to 2, 4 line
  request invalid or off the lattice.

### The modern mapping, a separate kernel

`cm_modern_benson_linear_rgb(n, r, g, b, out)` writes three doubles, each `level / n`. It rests on an
assumption that is ours and absent from the book: the three lights are the primaries of an additive display,
and a level is a fraction of full intensity in linear light. Linear light means a value in proportion to
physical power, before any display encoding. The mapping names no particular set of display primaries and
no white point. Each output is one IEEE 754 double division, so the bits are the same on every target.

Named mappings build on it: sRGB, Display P3 and Rec. 2020, each with stated primaries, white point and
transfer function, and CIE XYZ under D65 and D50. They are described in `MODERN.md`.

## Historical and inferred

| Parameter | Value | Status | Where |
|---|---|---|---|
| Axes | red, green, blue lights; black all nil, white all full | historical | scan p. 35 (OCR) |
| Corner letters | Z, R, G, B, Y, S, P, W | historical | scan p. 37 (OCR) |
| Uniform gradation along any straight line | | historical | scan p. 39 (OCR) |
| Complementary pairs | red and sea-green, green and pink, blue and yellow | historical | scan p. 14 (OCR) |
| Sections at right angles to the primary axes | | historical | list of plates, scan p. 15 (OCR) |
| Plate layout | nine blocks of 3 by 3 discs, 81 discs | historical | scan p. 48, counted on the scan |
| Three levels per light on the plate | nil, half, full (`n = 2`) | inferred | from 3 discs per row; the level values were not read in the text |
| Nine blocks are the nine primary-axis sections | 3 axes by 3 levels | inferred | supported by an exploratory reading, below |
| Black and white as a complementary pair | Z and W | inferred | follows from the complement rule; not listed on p. 14 |
| Complement as `n - level` on each axis | | inferred | consistent with the three pairs on p. 14 |
| Sections at right angles to the secondary axes | not implemented | unread | named on p. 15; those plates were not read |
| Upper bound 4096 on `n` and `steps` | | ours | a safety bound of the contract |

Exploratory reading, kept outside every test: a separate study took median scan values from the 81 discs. By
eye, the corner discs of the blocks fit this order: blocks 1 to 3 hold red, green and blue at full, blocks 4
to 6 hold them at half with a grey disc in the centre, and blocks 7 to 9 hold them at nil with black in one
corner. The scan is uncalibrated, so this supports the inferred layout and proves nothing about the colours.

## Limits

- No swatch has been measured against a colour standard. No kernel output is claimed to match the colours of
  the discs on the plate. The modern mapping is a reading of the model and no reconstruction of the paint.
- The text pages were read from OCR. The definitions on scan pages 35 to 39 were not re-read from the page
  images for this package.
- The caller is responsible for valid `out` and `ends` pointers. The kernel cannot check them.
