# Mayer 1775: the colour triangle

## What the historical system computes

Tobias Mayer described every pigment mixture as a count of equal parts of three primaries: red, yellow and
blue. A mixture is three whole numbers that add up to a fixed total, written here as `n`. Laid out on a
plane, the mixtures with the same total fill a triangle. Each corner holds one pure primary, each edge holds
the mixtures of two primaries, and the inside holds the mixtures of all three.

The kernel answers one question: which mixture sits in a given cell of that triangle. It also counts the
cells and converts between a cell and its position in reading order. It says nothing about what colour a
mixture looks like.

## Source

Tobias Mayer, "De affinitate colorum commentatio", in *Opera inedita*, volume I, edited by Georg Christoph
Lichtenberg, Göttingen, 1775. Copy: Zentralbibliothek Zürich, shelfmark NE 256, digitised on e-rara.

- Record: https://www.e-rara.ch/zut/content/titleinfo/2514966
- Plate Tab. III: https://www.e-rara.ch/i3f/v20/2515094/full/full/0/default.jpg (page 126 of the PDF)
- Text: printed page 37 (page 50 of the PDF), sections 16 and 17
- Rights: Public Domain Mark, as stated by e-rara

## Contract

All arguments and results are 64-bit signed integers. `out` is a pointer the caller owns; it must have room
for the stated number of values. A rejected call writes nothing to `out`.

| Export | Returns | Writes |
|---|---|---|
| `cm_mayer_count(n)` | number of cells, or -1 | |
| `cm_mayer_mix(n, row, col, out)` | status | red, yellow, blue |
| `cm_mayer_index(n, row, col)` | position in reading order, or -1 | |
| `cm_mayer_cell(n, index, out)` | status | row, col |

- `n`: parts per primary, 1 to 4096.
- `row`: 0 to `n`, counted from the red corner. Row `r` holds `r + 1` cells.
- `col`: 0 to `row`, counted from the blue side of the row.
- Mixture: red = `n - row`, yellow = `col`, blue = `row - col`.
- Reading order: row 0 first, each row from the blue side. Position = `row * (row + 1) / 2 + col`.
- Status: 0 accepted, 1 `n` outside 1 to 4096, 2 cell outside the triangle.

Every export checks its arguments before any arithmetic, so no value can overflow.

## Historical and inferred

| Parameter | Value | Status | Where |
|---|---|---|---|
| Three primaries | red, yellow, blue | historical | Tab. III corners, seen on the scan |
| Parts per primary in the text | 12 | historical | printed p. 37, section 16: mixtures differ by a twelfth part |
| Notation | `r^a g^b b^c`, exponents adding to 12 | historical | printed p. 37 |
| Tally for 12 parts | 3 simple, 33 binary, 55 ternary, 91 in all | historical | printed p. 37, sections 16 and 17 |
| 91 as a triangular number | side 13 | historical | printed p. 37, section 17 |
| Cells on the painted plate | 28, in rows of 1 to 7 | historical | Tab. III, counted on the scan |
| Corner positions on the plate | red top, blue bottom left, yellow bottom right | historical | Tab. III, seen on the scan |
| Painted plate is the 6-part triangle | `n = 6` | inferred | 28 = (6 + 1)(6 + 2) / 2; the text read so far does not say why the plate uses 6 |
| Letter `g` means the yellow primary | | inferred | read as Latin *gilvus* or German *gelb*; the defining sentence was not located |
| Row and column convention | row from red, column from blue | inferred | ours; chosen to match the plate when read top to bottom, left to right |
| Order of cells in Tab. II | not implemented | unread | section 17 points to Tab. II for the order; that plate was not read |
| Upper bound 4096 on `n` | | ours | a safety bound of the contract, absent from the source |

## Limits

- No swatch has been measured against a colour standard. No kernel output is claimed to match the pigment
  colours on the plate. The kernel returns part counts only.
- The scans are uncalibrated. A separate study read median scan values from the 28 cells of Tab. III. Those
  values describe aged paint on aged paper as one scanner saw it, and they are no ground truth for this
  kernel.
- Any extension of the triangle with white or black was not read and is not implemented.
- The caller is responsible for a valid `out` pointer. The kernel cannot check it.
