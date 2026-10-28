<!-- writing-profile: research -->
# Newton's thick-plate rings: pre-registration

Written 2026-10-28, before the model or the study ran. It is the second of a set of tests of questions Newton left open. Changes after the run go in a dated section at the end.

## What Newton reported

Source: *Opticks*, 4th edition 1730, Book II, Part IV (Project Gutenberg 33504), read before writing this.

- **Obs. 1.** Sunlight entered through a hole one third of an inch wide and fell perpendicularly on a glass speculum. The speculum was concave on one side and convex on the other, ground to a sphere of 5 feet 11 inches radius, and silvered on the convex side. Coloured rings appeared on a chart about six feet away.
- **Obs. 2.** The centre of the rings was "a white round Spot". It was edged with "dark grey or russet", followed by violet, indigo, blue, greenish yellow, yellow and red.
- **Obs. 3.** At six feet, the first four bright rings measured 1-11/16, 2-3/8, 2-11/12 and 3-3/8 inches across. Their squares run as 1, 2, 3, 4. The first four dark rings measured 1-3/16, 2-1/16, 2-2/3 and 3-3/20 inches.
- **Obs. 5.** In single colours, red gives the largest rings and violet the smallest.
- **Obs. 7.** With the silvering rubbed off, the rings remain but are fainter. "a Speculum of Metal without Glass ... produced none of those Rings."
- **Obs. 8.** The glass was "every where 1/4 of an Inch precisely" thick. From his fits theory he computes bright diameters of 1.688, 2.389, 2.925 and 3.375 inches.
- **Obs. 9.** A second plate, 5/62 inch thick, gave first three bright rings of 3, 4-1/6 and 5-1/8 inches. Diameters scale inversely as the square root of thickness.

## Model (fixed now; superframe `lib/medium/thickplate.mjs`)

- **Two coherent paths reach direction θ (angle in air) from the same normally incident beam:**
  - A is scattered by the front surface on the way in, crosses the glass at the internal angle θg, and reflects off the back.
  - B crosses normally, reflects, and is scattered by the same front-surface point on the way out.
  - Both have one scatter and one mirror reflection, so they share their phase changes.
- **Optical path difference:** Δ = 2 n t (1/cos θg − 1), with sin θ = n sin θg.
- **Fringes:** bright where Δ = kλ, dark where Δ = (k + ½)λ. The ring diameter on a chart at distance L is D = 2 L tan θ.
- **Inputs, all from Newton's text (no free parameters):**
  - λ = 570.8 nm, his yellow, from 1/89000 inch × 2;
  - n = 17/11, from his sines;
  - t = 1/4 inch and 5/62 inch;
  - L = 72 inches.
- **Intensity:** I(θ) = |a1 + a2 e^(i 2π Δ/λ)|². a1 and a2 are the two paths' scattered amplitudes, taken equal.

## Predictions

- **P1.** For t = 1/4 inch, the bright diameters k = 1 to 4 fall within 1.5% of the measured 1.6875, 2.375, 2.9167 and 3.375 inches.
- **P2.** The dark diameters k + ½ = 0.5 to 3.5 fall within 2% of the measured 1.1875, 2.0625, 2.6667 and 3.15 inches.
- **P3.** For t = 5/62 inch, the bright diameters k = 1 to 3 fall within 2% of the measured 3, 4.1667 and 5.125 inches.
- **P4.** The centre is bright (Δ = 0 gives a maximum).
- **P5.** In single colours, the diameter scales as the square root of λ, so red rings are larger than violet ones. Newton's measured 9 : 8 ratio between the red-orange and blue-indigo confines is checked as exploratory only, because the wavelengths of his colour confines are uncertain.

## Controls (must fail)

- **C1, metal speculum.** With one surface (no front-surface scatter path, so a1 = 0), the ring contrast must be zero. This is his own control.
- **C2, no refraction.** Using Δ = t θ² (ignoring the glass index, the small-angle form with n = 1) must miss P1 by more than 1.5% on every ring. This tests that the glass is doing the work.

## Ways this could mislead

- **Geometry is idealised.** The model assumes a flat plate of uniform thickness. The real speculum was curved, with the chart near its centre of curvature, and it was viewed with a finite hole and the Sun's 0.53° disc. Both blur the rings, but should not move their positions at this precision.
- **Measurement precision.** Newton's measurements are given to a sixteenth of an inch on diameters of 1.7 to 3.4 inches, about 1 to 4%, so agreement better than that is not meaningful.
- **Prior explanation.** The two-path account is old (Stokes 1851, *On the colours of thick plates*, from memory, unverified). This is a reproduction.

## Result, 2026-10-28 (after the run)

Run: `node tools/thickplate-study.mjs`, output in `out/thickplate/result.json`. No bugs were found, and nothing was changed after the run.

| Prediction | Stated | Measured | Verdict |
|---|---|---|---|
| P1, bright rings, 1/4 inch | within 1.5% | 0.58, 1.07, 0.80, 0.60% | holds |
| P2, dark rings | within 2% | 1.07, 0.79, 0.65, 0.82% | holds |
| P3, 5/62 inch plate | within 2% | 0.38, 1.46, 1.04% | holds |
| P4, bright centre | maximum | 4 of 4 (the maximum) | holds |
| C1, metal speculum | contrast 0 | 0 | holds (fails as required) |
| C2, glass index ignored | over 1.5% on every ring | 18.7 to 19.1% | holds (fails as required) |
| P5, colour (exploratory) | diameter as the square root of λ | the ratio for 620 / 455 nm is 1.167, against Newton's 9 : 8 = 1.125 | unresolved: depends on the wavelengths of his colour confines |

**Measured against Newton's own figures:**
- With no free parameters, the model runs about 0.8% large on every thick-plate ring. That is what a yellow near 562 nm would give, instead of the 571 nm implied by his 1/89000 inch.
- The thin-film study (F14) put the eye-weighted daylight dark ring at 275.7 nm against his 285.4. Both point the same way: his 1/89000 inch is probably about 2 to 3% thick for the light he judged. This is an inference from two studies, not a measurement.
- Newton's own fits computation (1.688, 2.389, 2.925, 3.375) lands within 0.6%, closer than our model, because his 106-means rule carries a constant fitted to these data.

**Rendered.** The image shows his chart at six feet, under D65, using the CIE functions, with his four measured diameters drawn as arcs on the right half. Checked by eye at 960 × 540 and rendered at 3840 × 2160 (`out/thickplate/thickplate-3840.png`).
- The colour sequence reproduces Observation 2: a white spot edged dark russet, then violet, indigo, blue, greenish yellow, yellow and red, then purple, blue, green, yellow and red.
- His measured arcs fall on the brightest yellow of each ring.

**Status.** This is a reproduction, not new physics. The two-path explanation is old (Stokes 1851, from memory, unverified). New here:
- an exact check against his measurements with no fitted constants;
- the consistent offset across his two experiments.
