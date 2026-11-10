# Lambert 1772: the colour pyramid

## What the historical system computes

Johann Heinrich Lambert stacked seven triangles of pigment mixtures into a pyramid. The base triangle mixes
three pigments, blue, yellow and red, in eighths. Each triangle above it uses fewer steps of pigment and is
meant to be paler, so the pyramid ends in a single white cell.

Lambert calls the unit of a mixture a *Portion*. The kernel treats a portion as one abstract equal part. It
answers three questions about a cell of a triangle: which pigment mixture sits there, how much white the
book states for that triangle, and which number the cell carries on Lambert's numbered leaf. It says nothing
about what colour a mixture looks like.

## Source

Johann Heinrich Lambert, *Beschreibung einer mit dem Calauschen Wachse ausgemalten Farbenpyramide*, Berlin:
Haude und Spener, 1772. Copy: Wellcome Library, digitised on the Internet Archive.

- Record: https://archive.org/details/b3051552x
- Text: sections 80 to 87, printed pages 75 to 79, which are leaves 85 to 89 of the scan
- Numbered leaf: the seven triangles with a number in each cell, leaf 137 of the scan
- Plate: the engraved and hand-coloured pyramid, leaf 141 of the scan
- Rights: Public Domain Mark, as stated on the record

Sections 80 to 87 and the numbered leaf were read from the page images. The book is set in Fraktur, a German
blackletter typeface that the scan's text layer misreads, so no statement below rests on that layer.

## Contract

Arguments and results are 64-bit signed integers. `out` is a pointer the caller owns with room for the
values listed. A rejected call writes nothing to `out`.

| Export | Returns | Writes |
|---|---|---|
| `cm_lambert_side(tier)` | parts per pigment in the triangle, or -1 | |
| `cm_lambert_count(tier)` | number of cells in the triangle, or -1 | |
| `cm_lambert_total()` | 108 | |
| `cm_lambert_mix(tier, row, col, out)` | status | blue, yellow, red |
| `cm_lambert_white(tier, out)` | status | portions of white, portions of the whole |
| `cm_lambert_number(tier, row, col)` | the cell's number 1 to 67, 0 for the white cell, or -1 | |

- `tier`: 1 to 7, the base first. Sides are 8, 6, 4, 3, 2, 1, 0.
- `row`: 0 to side, counted from the blue corner. `col`: 0 to `row`, counted from the yellow side.
- Pigment mixture: blue = side - `row`, yellow = `row` - `col`, red = `col`. The three add up to the side.
- White: (0, 8), (2, 8), (4, 8) and (6, 8) for triangles 1, 2, 3 and 5, and (1, 1) for triangle 7, which is
  wholly white. Triangles 4 and 6 return status 5 because the book prints no amount for them.
- Status: 0 accepted, 1 tier outside 1 to 7, 2 cell outside the triangle, 5 the source states no amount.

## Historical and inferred

Every row marked historical was read from the page image at the place given.

| Parameter | Value | Status | Where |
|---|---|---|---|
| Pigments | blue, yellow, red (*b*, *g*, *r*) | historical | section 80, p. 75 |
| Base triangle | 45 cells, mixtures in eighths, no white | historical | section 80, pp. 75 to 76; "ohne Weiß", p. 77 |
| Row and column convention | `b^8` at the apex, bottom row from `g^8` to `r^8` | historical | table printed on p. 76 |
| How the base was mixed | the pigments weighed out | historical | p. 77: "so wie ich sie abgewogen hatte" |
| Second triangle | 28 cells, sixths, with 2 portions of white making 8 | historical | section 81, p. 76 |
| Third triangle | 15 cells, quarters; 4 portions of white "properly should" be added | historical | section 82, pp. 77 to 78 |
| Fourth triangle | 10 cells, thirds, applied lighter | historical | section 83, p. 78 |
| Fourth triangle white | no amount printed | undefined | section 83, p. 78; the kernel returns status 5 |
| Fifth triangle | 6 cells, halves; 6 parts of white "would have to" be added | historical | section 84, p. 78 |
| Sixth triangle | the 3 pigments alone, applied lighter | historical | section 85, p. 79 |
| Sixth triangle white | no amount printed | undefined | section 85, p. 79; the kernel returns status 5 |
| Seventh triangle | one cell, left wholly white | historical | section 86, p. 79 |
| Distinct mixtures | 67 numbers, 68 with white; 108 cells in all | historical | section 87, p. 79 |
| Numbers 1 to 67 | one number per mixture, repeated where a mixture returns | historical | numbered leaf, scan leaf 137 |
| Third triangle doubled lies in the base | | historical | section 82; the leaf repeats base numbers in triangle 3 |
| Fourth triangle doubled lies in the second | | historical | section 83; the leaf repeats numbers of triangle 2 |
| Front rows on the plate | 9, 7, 5, 4, 3, 2, 1 cells | historical | counted on the plate scan |
| Rule behind the numbering | base column by column from the yellow side, then the new cells of triangle 2 the same way from 46 | inferred | ours; it reproduces every number on the leaf |
| White of triangle 7 as (1, 1) | | ours | the book counts no portions there; it says the cell is white |

The numbered leaf is kept in the reference as a literal table, transcribed from the page image. The kernel
computes the numbers from the rule above, and the equality suite compares the two for every cell.

The count of 67 was also checked by arithmetic: the pigment ratios of the first six triangles, each reduced
to lowest terms, give exactly 67 distinct values, and each number on the leaf belongs to exactly one of them.

## Limits

- No swatch has been measured against a colour standard. No kernel output is claimed to match the pigment
  colours on the plate.
- The white amounts are the stated recipe. For triangles 3 and 5 the book words them as what should be added
  (*eigentlich sollten*, *kommen müßten*), so they are no record of what was painted.
- An earlier version of this kernel gave triangles 4 and 6 a white share of 5 and 7 eighths by the rule
  white = 8 - side. The book prints neither number, so both were removed.
- The plinth of the plate shows 12 pigment swatches that this kernel does not model.
- The scans are uncalibrated. A separate study read median scan values from the front row of the base and
  from the plinth. Those values are no ground truth for this kernel.
- The caller is responsible for a valid `out` pointer. The kernel cannot check it.
