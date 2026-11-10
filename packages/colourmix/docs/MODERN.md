# Modern mappings of the Benson cube

## What these kernels compute

William Benson's cube of 1872 orders colours by levels of red, green and blue light. The historical kernel
returns those levels as whole numbers and stops there. The kernels in this document go one step further
and read a level as a signal of a modern display. That step is ours. The 1872 book names no display, no
primaries in today's sense and no white point.

Four terms carry the rest of this page.

- A *primary* is one of the three lights a display adds together.
- A *chromaticity* is a pair (x, y) that fixes the hue and purity of a light without its brightness, in the
  CIE 1931 system. CIE is the International Commission on Illumination.
- *CIE XYZ* describes a colour by three numbers that do not depend on a device. Y is the luminance, the
  brightness as the CIE standard observer weighs it.
- A *white point* is the chromaticity a system treats as white. D65 stands for average daylight and D50 for
  a warmer daylight that printing and colour profiles use.

An *RGB colour space* names three primaries, a white point and a *transfer function*, the curve that turns
linear light into the stored signal. Linear light is a value in proportion to physical power.

## The mappings

| Export | Meaning |
|---|---|
| `cm_modern_benson_linear_rgb(n, r, g, b, out)` | level / n for each light; names no space and no white |
| `cm_modern_benson_xyz(space, white, n, r, g, b, out)` | the same fractions as linear RGB of a named space, written as XYZ under the chosen white |
| `cm_modern_benson_encoded(space, n, r, g, b, out)` | the same fractions passed through the transfer function of the space |
| `cm_modern_rgb_to_xyz(space, white, r, g, b, out)` | linear RGB of a named space to XYZ |
| `cm_modern_xyz_to_rgb(space, white, x, y, z, out)` | XYZ to linear RGB of a named space |
| `cm_modern_encode(space, v, out)` | linear light to the encoded value |
| `cm_modern_decode(space, e, out)` | encoded value to linear light |

`space` is 0, 1 or 2. `white` is 0 for D65 or 1 for D50. Whole-number arguments are 64-bit signed integers
and the others are IEEE 754 doubles. `out` has room for three doubles, or one for encode and decode.

Status: 0 accepted, 1 `n` outside 1 to 4096, 2 a point outside the cube, a float that is no finite number,
or an encode or decode value outside 0 to 1, 6 an unknown space or white. A rejected call writes nothing.

The transfer function is a separate step by design. `cm_modern_benson_xyz` works on linear light and never
applies it. `cm_modern_benson_encoded` applies it and never leaves the space.

## Constants and their standards

| Space | Red x, y | Green x, y | Blue x, y | White | Transfer function | Standard |
|---|---|---|---|---|---|---|
| 0 sRGB | 0.6400, 0.3300 | 0.3000, 0.6000 | 0.1500, 0.0600 | D65 | 12.92 v up to 0.0031308, then 1.055 v^(1/2.4) - 0.055 | IEC 61966-2-1:1999 |
| 1 Display P3 | 0.6800, 0.3200 | 0.2650, 0.6900 | 0.1500, 0.0600 | D65 | the sRGB curve | primaries of SMPTE EG 432-1, with D65 |
| 2 Rec. 2020 | 0.7080, 0.2920 | 0.1700, 0.7970 | 0.1310, 0.0460 | D65 | 4.5 v below 0.0181, then 1.0993 v^0.45 - 0.0993 | ITU-R BT.2020, 12-bit constants |

- D65 white: x = 0.3127, y = 0.3290, as the three standards above state it.
- D50 white: X = 0.9642, Y = 1, Z = 0.8249, the profile connection white of ICC.1:2010.
- Change of white: the linear Bradford transform, with the matrix rows (0.8951, 0.2664, -0.1614),
  (-0.7502, 1.7135, 0.0367) and (0.0389, -0.0685, 1.0296), as ICC.1:2010 Annex E gives it. A chromatic
  adaptation transform predicts how a colour must change to look the same under another white.
- The decode threshold of sRGB is 0.04045, as in the standard.

Confidence: the numbers were entered from memory of the standards, with high confidence, and were not
compared with the text of the standards for this package. Two checks stand in for that comparison. The
luminance of each primary comes out as the standards print it to four places (sRGB 0.2126, 0.7152, 0.0722;
Display P3 0.2290, 0.6917, 0.0793; Rec. 2020 0.2627, 0.6780, 0.0593), and the first column of the sRGB matrix
comes out as 0.4124, 0.2126, 0.0193. These published rows also came from memory.

## How the numbers are computed

A kernel result must have the same bits on every machine, so the kernels use only +, -, * and / on doubles
in a fixed order, and store no rounded matrix.

- Each constant enters as a ratio of two whole numbers, such as 3127 / 10000.
- The RGB to XYZ matrix is derived from the chromaticities on every call. The inverse direction solves three
  linear equations by the rule of Cramer, a ratio of two determinants.
- The powers of the transfer functions are rational: 5/12, 12/5, 9/20 and 20/9. A power p/q is a q-th root
  found by 48 steps of Newton's method from 1, then p multiplications. No math library is called.

## What is checked

- Equality by bits with the Python reference: 73964 cases for the cube mappings and 74150 for the spaces,
  0 mismatches. The cases cover every name and one beyond, not-a-number, both infinities and negative zero.
- Round trip: XYZ to RGB of RGB to XYZ returns the input within 1e-12, for both whites.
- Round trip: decode of encode returns the input within 1e-12, with one exception stated below.
- The encode curves agree with a library power function within 1e-13.
- Ten planted defects in these sources are each caught, among them a primary moved by 0.001, a rounded D50
  white, a Bradford sign and the 10-bit Rec. 2020 offset.

## Limits

- No swatch has been measured. These mappings say what a cube point means under a stated assumption. They
  claim nothing about the colours on Benson's plate or about his lights.
- Rec. 2020 with its rounded constants has a step of about 0.0002 in the encoded value where its two
  branches meet at 0.0181. Within 0.0002 of that point, decode of encode differs from the input by up to
  7e-7. The step is in the standard's constants.
- Inputs are compared within a bounded range. A finite input large enough to overflow gives infinity or
  not-a-number, and the bits of such a result are outside the contract.
- Values outside 0 to 1 are accepted by the XYZ mappings, since a colour outside one space is a valid input
  to another. Encode and decode reject them.
- Display P3 here means the P3 primaries with the D65 white and the sRGB curve. The cinema variant with its
  own white and a 2.6 power is not implemented.
- The caller is responsible for a valid `out` pointer. The kernel cannot check it.
