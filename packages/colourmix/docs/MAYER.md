# Mayer 1775: the colour triangle

## What the historical system computes

Tobias Mayer described every pigment mixture as a count of equal parts of three primaries: red, yellow and
blue. A mixture is three whole numbers that add up to a fixed total, written here as `n`. Laid out on a
plane, the mixtures with the same total fill a triangle. Each corner holds one pure primary, each edge holds
the mixtures of two primaries, and the inside holds the mixtures of all three.

The kernel answers one question: which mixture sits in a given cell of that triangle. It also counts the
cells and converts between a cell and its position in reading order. It says nothing about what colour a
mixture looks like.

The book holds two triangles by two hands. Mayer's own scheme divides each primary into 12 parts and gives 91
mixtures, drawn as the engraved Tab. II. The painted plate Tab. III has 28 cells and belongs to the editor,
Georg Christoph Lichtenberg, who describes it in his appendix: a triangle whose parts add up to 6, made from
his own pigments. The kernel keeps the two apart.

## Source

Tobias Mayer, "De affinitate colorum commentatio", in *Opera inedita*, volume I, edited by Georg Christoph
Lichtenberg, Göttingen: Johann Christian Dieterich, 1775. Copy: ETH-Bibliothek Zürich, Rar 9106, digitised on
e-rara.

- Record: https://www.e-rara.ch/zut/content/titleinfo/2514966 (DOI https://doi.org/10.3931/e-rara-8854)
- Plate Tab. III: https://www.e-rara.ch/i3f/v20/2515094/full/full/0/default.jpg (leaf 126 of the PDF)
- Plate Tab. II: the engraved triangle of 91 cells, leaf 125 of the PDF
- Mayer's text: printed page 37 (leaf 50), sections 16 to 18
- Lichtenberg's appendix: printed pages 98 to 100 (leaves 111 to 113)
- Rights: Public Domain Mark, as stated by e-rara

Every page named here was read from the page image.

## Contract

All arguments and results are 64-bit signed integers. `out` is a pointer the caller owns; it must have room
for the stated number of values. A rejected call writes nothing to `out`.

| Export | Returns | Writes |
|---|---|---|
| `cm_mayer_count(n)` | number of cells, or -1 | |
| `cm_mayer_mix(n, row, col, out)` | status | red, yellow, blue |
| `cm_mayer_index(n, row, col)` | position in reading order, or -1 | |
| `cm_mayer_cell(n, index, out)` | status | row, col |
| `cm_mayer_tab2(n, row, col, out)` | status | red, yellow, blue |
| `cm_lichtenberg_mass(row, col, out)` | status | weights of red, yellow, blue pigment |

- `n`: parts per primary, 1 to 4096.
- `row`: 0 to `n`, counted from the red corner. Row `r` holds `r + 1` cells.
- `col`: 0 to `row`, counted from the blue side of the row.
- Mixture: red = `n - row`, yellow = `col`, blue = `row - col`.
- Reading order: row 0 first, each row from the blue side. Position = `row * (row + 1) / 2 + col`.
- `cm_mayer_tab2` uses the layout of Tab. II: `row` counted from the yellow corner at the top, `col` from
  the red side. Mixture: yellow = `n - row`, blue = `col`, red = `row - col`. It holds the same mixtures as
  `cm_mayer_mix` in another order.
- `cm_lichtenberg_mass` takes a cell of the 6-part triangle in the layout of `cm_mayer_mix` and returns the
  pigment weights of Lichtenberg's table: 3 per part of red, 1 per part of yellow, 6 per part of blue.
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
| Order of cells in Tab. II | yellow `G^12` at the apex, `R^12` bottom left, `B^12` bottom right; each row runs from red to blue | historical | Tab. II, leaf 125 |
| A colour scale results when the cells are painted | | historical | printed p. 37, section 18 |
| Painted plate is a 6-part triangle | parts are whole numbers "whose sum is always 6" | historical, Lichtenberg | appendix, p. 99 |
| The 28-cell triangle is the editor's | he would not have one painted from Mayer's corner pigments and built his own | historical, Lichtenberg | appendix, p. 98 |
| Tinting strengths | equal strength at masses blue : red : yellow = 6 : 3 : 1, for his dry pigments only | historical, Lichtenberg | appendix, p. 98 |
| Table of weights | 25 cells printed with weights, e.g. `r12 b6 g1`; the 3 corners printed as letters | historical, Lichtenberg | appendix, p. 99 |
| Layout of the table of weights | red at the apex, blue bottom left, yellow bottom right | historical, Lichtenberg | appendix, p. 99; the same as Tab. III |
| Corner weights 18, 6 and 36 | | inferred | the corners carry no number; these follow the rule of the other cells |
| Corner pigments of the painted plate | native cinnabar, lighter Prussian blue, gamboge | historical, Lichtenberg | appendix, p. 99 |
| How the plate was painted | thin glazes laid over each other in shrinking triangles, each layer dry first | historical, Lichtenberg | appendix, p. 100 |
| Why 28 cells and no more | a triangle of 91 cells would have needed a very large apparatus | historical, Lichtenberg | appendix, p. 100 |
| A statement by Mayer on a 28-cell plate | none found | not found | sections 16 to 18 and the appendix give none |
| Letter `g` means the yellow primary | | inferred | read as Latin *gilvus* or German *gelb*; the defining sentence was not located |
| Row and column convention of `cm_mayer_mix` | row from red, column from blue | historical, Lichtenberg | the layout of Tab. III and of the table on p. 99 |
| Upper bound 4096 on `n` | | ours | a safety bound of the contract, absent from the source |

## Limits

- No swatch has been measured against a colour standard. No kernel output is claimed to match the pigment
  colours on the plate. The kernel returns part counts only.
- The scans are uncalibrated. A separate study read median scan values from the 28 cells of Tab. III. Those
  values describe aged paint on aged paper as one scanner saw it, and they are no ground truth for this
  kernel.
- The weights of `cm_lichtenberg_mass` hold for Lichtenberg's dry pigments, as he says himself. The painted
  plate was made by glazing, and the appendix gives no pigment amounts for a painted cell.
- Lichtenberg omits the colour shares from his table because they follow from Tab. II. The kernel takes them
  from the 6-part triangle on that ground.
- Any extension of the triangle with white or black was not read and is not implemented.
- The caller is responsible for a valid `out` pointer. The kernel cannot check it.
