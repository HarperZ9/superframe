# Lambert 1772: the colour pyramid

## What the historical system computes

Johann Heinrich Lambert stacked seven triangles of pigment mixtures into a pyramid. The base triangle mixes
three pigments, blue, yellow and red, in eighths. Each triangle above it uses fewer steps of pigment and adds
white, so the pyramid grows paler toward the top and ends in a single white cell.

Lambert calls the unit of a mixture a *Portion*. The kernel treats a portion as one abstract equal part. It
answers one question: which mixture, in eighths of blue, yellow, red and white, sits in a given cell of a
given triangle. It also counts the cells. It says nothing about what colour a mixture looks like.

## Source

Johann Heinrich Lambert, *Beschreibung einer mit dem Calauschen Wachse ausgemalten Farbenpyramide*, Berlin:
Haude und Spener, 1772. Copy: Wellcome Library, digitised on the Internet Archive.

- Record: https://archive.org/details/b3051552x
- Text: sections 80 to 87, printed pages 75 to 79; section 120, printed page 108
- Plate: the engraved and hand-coloured pyramid, scan leaf 141
- Rights: Public Domain Mark, as stated on the record

The text was read from the scan's OCR layer, which is unreliable for the Fraktur typeface. Printed page 79
was also read from the page image. Numbers that come from OCR alone are marked below.

## Contract

All arguments and results are 64-bit signed integers. `out` is a pointer the caller owns with room for four
values. A rejected call writes nothing to `out`.

| Export | Returns | Writes |
|---|---|---|
| `cm_lambert_side(tier)` | parts per pigment in the triangle, or -1 | |
| `cm_lambert_count(tier)` | number of cells in the triangle, or -1 | |
| `cm_lambert_total()` | 108 | |
| `cm_lambert_mix(tier, row, col, out)` | status | blue, yellow, red, white |

- `tier`: 1 to 7, the base first. Sides are 8, 6, 4, 3, 2, 1, 0.
- `row`: 0 to side, counted from the blue corner. `col`: 0 to `row`, counted from the yellow side.
- Mixture in eighths: blue = side - `row`, yellow = `row` - `col`, red = `col`, white = 8 - side. The four
  numbers always add up to 8.
- Status: 0 accepted, 1 tier outside 1 to 7, 2 cell outside the triangle.

## Historical and inferred

| Parameter | Value | Status | Where |
|---|---|---|---|
| Pigments | blue, yellow, red (*b*, *g*, *r*) | historical | section 80, printed pp. 75 to 76 (OCR) |
| Base triangle | 45 cells, mixtures in eighths | historical | section 80 (OCR); 45 cells counted on the plate |
| Second triangle | 28 cells, sixths, 2 portions of white | historical | section 81 (OCR) |
| Third triangle | 15 cells, quarters, 4 portions of white | historical | section 82 (OCR) |
| Fourth triangle | 10 cells, thirds | historical | section 83 (OCR) |
| Fourth triangle white share | 5 of 8 | inferred | not stated in section 83; follows the rule white = 8 - side |
| Fifth triangle | 6 cells, halves, 6 parts of white | historical | section 84 (OCR) |
| Sixth triangle | the 3 pigments alone, lighter | historical | section 85 (OCR) |
| Sixth triangle white share | 7 of 8 | inferred | not stated; follows the rule white = 8 - side |
| Seventh triangle | one cell, left white | historical | section 86, printed p. 79 (page image) |
| Empty compartment above the seventh | represents nothing, added for symmetry | historical | section 86; seen as an empty shelf on the plate |
| Distinct mixtures | 67, or 68 with white; 108 cells in all | historical | section 87, printed p. 79 (page image) |
| Third triangle doubled lies in the base | | historical | section 82 (OCR) |
| Fourth triangle doubled lies in the second | | historical | section 83 (OCR) |
| Front rows on the plate | 9, 7, 5, 4, 3, 2, 1 cells | historical | counted on the plate scan |
| Corners on the plate | yellow front left, red front right, blue at the back | historical | seen on the plate scan |
| Whole pyramid in eighths | pigment + white = 8 in every triangle | inferred | stated for triangle 2; extended by us to the others |
| Row and column convention | row from blue, column from yellow | inferred | ours; matches the table in section 80 with `b^8` at the apex |
| Lambert's numbering 1 to 67 | not implemented | unread | the numbered table was not fully read |

The count of 67 was also checked by arithmetic: the pigment ratios of the first six triangles, each reduced
to lowest terms, give exactly 67 distinct values. A test repeats that count.

## Limits

- No swatch has been measured against a colour standard. No kernel output is claimed to match the pigment
  colours on the plate.
- Lambert treats the white shares as nominal. Section 82 says the white "properly should" be added
  (*eigentlich sollten*), and the text claims no exact share for the painted cells. The white column is the
  stated recipe and no record of what was painted.
- What physical quantity one portion measures (weight, volume or tinting strength) was not read. The plinth
  of the plate shows 12 pigment swatches that this kernel does not model.
- The scans are uncalibrated. A separate study read median scan values from the front row of the base and
  from the plinth. Those values are no ground truth for this kernel.
- The caller is responsible for a valid `out` pointer. The kernel cannot check it.
