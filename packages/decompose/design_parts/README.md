# design-parts

## Mission

Take a picture apart into the parts design works with, measure each part, and build new work back
from those parts using raw geometry. Colour, shape, form, geometry, space, rhythm and perspective
each get a number you can check, so a claim like "this work's meaning travels in its colour" can be
tested. Nothing here copies a source image. Only measurements and mathematics move from a reference
into new work.

## Ideals

- **Known answers first.** Every extractor ships with a test on a synthetic image whose answer is
  set by construction: a disk at the golden section, an n-fold rosette, a four-colour palette, a
  stroke of known width, noise with a known spectral slope, each of the 17 wallpaper groups.
- **One normaliser.** Images are reduced to RGB, longest side 512, one JPEG round trip at q80, then
  measured on a 256 px working copy. That matches the earlier taste table, so numbers line up.
- **Ideas, not people.** Renders come from parameters and geometry. A shape-only or colour-only
  render keeps one channel and destroys the rest, so a channel can be judged on its own.
- **Media are data.** Images are decoded by PIL and never executed.

## Parts

| Module | Measures or makes |
|---|---|
| `palette` | palette count, hue harmonics m1 m2 m3 (analogous, complementary, triadic), hue entropy, chroma, value structure |
| `shape` | primitive regions and their kind (circle, quad, tri, irregular), straight-edge share, curvature |
| `geometry` | mirror and rotational symmetry (order and strength), grid alignment, split lines and their golden and thirds distances, focal point |
| `texture` | negative space, line weight, self-similarity, rhythm and period, spectrum slope |
| `perspective` | line segments, vanishing points, horizon, figure-ground ratio and reversibility, framing ratio |
| `wallpaper` | the 17 wallpaper groups: a generator from each group's operations, and a classifier |
| `impossible` | whether a line drawing with local 3D readings has any consistent 3D source (the depth cocycle) |
| `spacegen` | hyperbolic {p,q} tiling of the Poincare disk, Droste log-polar map, metamorphosis strip |
| `channels` | colour-only, shape-only, layout-only and perspective-only renders of an image |
| `generate` | a composition from 18 design parameters: flat ground, shapes, lines |
| `extract` | `measure_all(rgb)`: 74 features in 7 families |

## Use

```python
import sys; sys.path.insert(0, r"packages/decompose/design_parts")
from design_parts.imageio import open_image, to_array
from design_parts.extract import measure_all
features, extra = measure_all(to_array(open_image("picture.jpg")))
```

Tests (about 3 minutes, most of it the wallpaper cases):
`python -B -m pytest -q -p no:cacheprovider tests`

Dependencies: numpy, scipy, Pillow. Research tooling only; nothing here is shipped.

## Measured limits

- Wallpaper classifier: 34 of 34 clean synthetic tilings (two seeds per group); 67 of 68 rotated by
  17 degrees with noise sd 0.05 (one p6 read as p6m, whose chiral content was weak). Real images are
  rarely periodic; group labels are meaningful only when lattice strength is at least 0.5.
- Vanishing points: within 0.03 of the true point on a drawn perspective floor; horizontals come back
  as a point at infinity.
- Rotational symmetry: orders 3, 4, 5, 6 and 8 recovered on rosettes; the centre is searched within
  6% of the image centre only.
- Primitive kinds use convex-hull circularity, so a concave shape is "irregular" by design.

## Mathematics reused, with sources

- Wallpaper group decision tree after Liu, Collins and Tsin, "A computational model for periodic
  pattern perception based on frieze and wallpaper groups", IEEE TPAMI 26(3), 2004 (from memory,
  moderate confidence on the volume and issue).
- Droste map: B. de Smit and H. W. Lenstra Jr., "The mathematical structure of Escher's Print
  Gallery", Notices of the AMS 50(4), 446 to 451, 2003 (bibliography checked against the Leiden
  copy; the formula here is derived, not transcribed).
- Impossible figures as cohomology: R. Penrose, "On the cohomology of impossible figures", Leonardo
  25(3/4), 245 to 247, 1992 (venue checked; page range from memory, moderate confidence).
- Two-lines test (used by the study, not this library): Simonsohn 2018.
