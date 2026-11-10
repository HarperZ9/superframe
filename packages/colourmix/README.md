<!-- writing-profile: readme -->
# colourmix

Three historical systems for ordering colour mixtures, written as BuildLang kernels. Give a kernel the
coordinates of a cell in the historical figure and it returns the mixture that the author assigned to that
cell, as whole-number parts.

A kernel here means a small function with a fixed typed contract: stated argument types, stated ranges, a
status code for every rejected input, and the same result on every machine.

| Kernel | System | Figure | Doc |
|---|---|---|---|
| `mayer` | Tobias Mayer, 1775: parts of red, yellow and blue pigment; the order of his Tab. II; Lichtenberg's table of weights | a triangle; 91 cells for 12 parts, 28 on the editor's painted plate | `docs/MAYER.md` |
| `lambert` | J. H. Lambert, 1772: portions of blue, yellow and red, the stated white, and his numbers 1 to 67 | a pyramid of seven triangles, 108 cells | `docs/LAMBERT.md` |
| `benson` | William Benson, 1872: steps of red, green and blue light | a cube; the plate shows nine sections of nine discs | `docs/BENSON.md` |
| `modern` | our reading of the Benson cube as linear-light fractions, then as sRGB, Display P3 or Rec. 2020 and as CIE XYZ under D65 or D50 | none; mappings with stated primaries, white point and transfer function | `docs/MODERN.md` |

The three historical kernels return part counts and nothing else. The `modern` exports carry their own
name, so a modern interpretation never passes for a historical one. Where a book prints no amount, the
kernel returns status 5 and no number.

No swatch on any plate has been measured against a colour standard. No kernel output is claimed to match the
pigment colours on the plates.

## Run it now

The kernels need `buildc` (the BuildLang compiler) and a C compiler. Set `BUILDC` to the compiler, or put
`buildc` on the path.

```
cd packages/colourmix
python -m colourmix                 # every check, counts as JSON
python -m colourmix.fuzz            # the fuzz target alone: 60000 cases from the recorded seed
python -m pytest -q -p no:cacheprovider --import-mode=importlib tests
```

Without `buildc` the property tests still run against the Python reference, and the tests that need the
compiled kernels skip with the reason. Set `COLOURMIX_REQUIRE_NATIVE=1` to turn a skip into a failure.

## Use it

```python
from colourmix import native

k = native.kernels()
k.mayer_mix(12, 5, 2)        # (0, (7, 2, 3)): status 0; red 7, yellow 2, blue 3 of 12 parts
k.lambert_mix(2, 6, 0)       # (0, (0, 6, 0)): the yellow corner of the second triangle
k.lambert_white(2)           # (0, (2, 8)): 2 portions of white in 8, as section 81 states
k.lambert_white(4)           # (5, None): the book prints no amount for the fourth triangle
k.lambert_number(2, 6, 0)    # 9: its number on Lambert's leaf, shared with the yellow corner of the base
k.benson_section(2, 0, 2, 2, 0)   # (0, (2, 2, 0)): red full, green full, blue nil, the yellow corner
k.modern_benson_xyz(0, 0, 2, 2, 2, 0)   # that corner as sRGB linear light, in CIE XYZ under D65
```

`colourmix.reference` has the same functions in plain Python.

## What is checked

| Check | What it does | Result |
|---|---|---|
| Equality, `mayer` | every cell for 1 to 24 parts with a border of rejected cells, in both cell orders; Lichtenberg's printed table; then sampled inputs up to 4096 parts | 39899 cases, 0 mismatches |
| Equality, `lambert` | all 108 cells and every rejected tier and cell around them, for the mixture, the white and the number; the numbers against the leaf as transcribed | 3214 cases, 0 mismatches |
| Equality, `benson` | every lattice point for 1 to 6 steps, every line between lattice points for 1 to 3 steps, then a sample | 102385 cases, 0 mismatches |
| Equality, `modern` | every point for 1 to 16 steps in every space and white, then a sample; doubles compared by their bits | 73964 cases, 0 mismatches |
| Equality, `spaces` | the transfer functions on a grid, at their joints and at odd values; RGB to XYZ and back for every space and white; doubles compared by their bits | 74150 cases, 0 mismatches |
| Round trips | XYZ to RGB of RGB to XYZ, and decode of encode, return the input | within 1e-12; Rec. 2020 within 1e-6 at its joint, see `docs/MODERN.md` |
| Planted defects | 25 wrong edits to the kernel sources (swapped primaries, a white amount invented where the book has none, a primary moved by 0.001, a changed rounding); each mutant must fail its equality suite | 25 of 25 caught |
| Properties | parts add up to the whole, corners are pure primaries, relabelling the primaries keeps the figure, cell counts match the plates and the texts | run on the reference and on the kernels |
| Fuzz | 60000 calls with extreme, out-of-range and raw 64-bit values, in a child process; then 850 calls with values of the wrong type or size | 0 mismatches, 0 crashes, 850 of 850 refused |

Equality means the compiled BuildLang kernel and the Python reference return the same status and the same
values. Samples use the recorded seed 177517721872 and the fuzz run uses 0x177517721872, both through a
xorshift64 generator, so a run can be repeated exactly. The counts above come from one run on Windows with
buildc 1.11.0 and gcc.

A rejected call returns a status code and writes nothing to the output buffer. The Python layer fills the
buffer with a sentinel before each call and reports any write made by a rejected call.

## Layout

- `bld/`: the BuildLang sources. `rgbspace.bld` and `transfer.bld` hold the named spaces that `modern.bld` uses.
- `colourmix/reference.py` and `reference_modern.py`: the reference. `native.py` builds and loads the
  kernels. `check.py` and `check_modern.py` hold the equality suites, `controls.py` the planted defects, `fuzz.py` the fuzz target.
- `docs/`: one document per system and one for the modern mappings, with the source, the contract, and each parameter marked historical or
  inferred.

## Limits

- The kernels encode the stated recipes. They do not predict the colour of a mixture.
- The white of Lambert's fourth and sixth triangles is undefined, because the book prints no amount.
- Benson's sections across the secondary axes are not implemented. The docs list what was read and what
  was not.
- The constants of the modern mappings were entered from memory of the standards and checked against
  published luminance values, not against the text of the standards.
- The caller owns every output pointer. A kernel cannot check that a pointer is valid.
