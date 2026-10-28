<!-- writing-profile: research -->
# Newton's rings against his own tables: pre-registration

Written 2026-10-28, before the model or the study ran. It is the first of a set of tests of questions Newton left open. Changes after the run go in a dated section at the end.

## What Newton reported (primary text, read before writing this)

*Opticks*, 4th edition 1730 (Project Gutenberg 33504), Book II, Part I.

- **Observation 6.** For a lens of 182-inch sphere diameter, the fifth dark ring's true semi-diameter is 8/79 inch. That gives "the 1/88739 Part of an Inch" at the first dark ring; a second lens gives 1/88850. Corrected from his 4° viewing to perpendicular light, these become "1/88952 and 1/89063", rounded to "the 1/89000th Part of an Inch". He states that half this thickness times 1, 3, 5, 7, 9, 11 gives the brightest rings, and that the even multiples give the dark ones.
- **Observation 7.** He gives a table of ring diameter and air thickness at thirteen obliquities, the thickness column scaled to 10 at perpendicular light. His sources were "partly by measuring ... partly by other Means, as also by making use of the two Prisms for very great Obliquities". He then states a rule he "seem[s] to gather": the thickness goes as the secant of an angle whose sine is "the first of an hundred and six arithmetical mean Proportionals" between the sines of incidence and refraction, counted from the bigger sine.

Read in advance: the table's last row (90° in air, 40°11' in glass) is 122½, where a plain secant of the air angle is infinite. A quick check of his rule at that row gives about 122.9, so the steep rows may come from his rule rather than from measurement. The survey's hypothesis H1 (an unexplained drift beyond 65°) is therefore to be tested against his rule as well as against physics.

## Model (fixed now; superframe `lib/medium/rings.mjs`)

- **Geometry.** A glass, air gap, glass stack, with exact Airy multiple-beam reflectance for s and p polarisation. The glass is N-BK7 from `refraction.mjs`; the gap is air, n = 1.
- **White light.** CIE D65 against the CIE 1931 2° ȳ at 1 nm, both the official CIE tables on H (`light/cie-data-tables`).
- **Unpolarised.** The average of s and p.

## Predictions

- **A, the first dark ring in white light.** The first minimum of reflected luminance Y(d), for d > 0, lies within 5% of Newton's 285.4 nm (1/89000 inch).
- **B, the bright-ring progression.** The first four luminance maxima in white light stand as 1 : 3 : 5 : 7 within 3%.
- **C, the obliquity law of the physics.** For monochromatic 571 nm light, the thickness at the first dark ring follows 1/cos(θ_air) within 0.1% from 0° to 85°.
- **D, Newton's table against physics.** His thickness column matches 10/cos(θ_air) within 1% for rows from 0° to 60°.
- **E, Newton's table against his own rule.** His thickness column matches his 106-means rule within 1.5% at every row, including 65° to 90°. If E holds and D fails beyond 60°, the steep rows follow his fitted rule, and the physics (C) says the true thickness keeps growing as the secant.

## Controls (must fail)

- **C1, no sign flip.** Force both interface reflections to the same sign. The centre becomes bright, and the first luminance minimum moves to near a quarter wavelength. It must not lie within 5% of 285.4 nm.
- **C2, shuffled table.** Shuffle the thickness column across the rows. The match to his own rule must fail the 1.5% bound at three or more rows.

## Ways this could mislead

- **Light source.** Newton used daylight, not D65. Sunlight is the alternative, and the result is checked under both if the solar spectrum loads.
- **"Dark ring" in white light** means a luminance minimum. His eye judged the darkest part, which may sit at a different place in a coloured fringe.
- **His thickness column is his diameters squared over 10**, a step he took himself. The diameters are the more direct data.

## Result, 2026-10-28 (after the run)

Run: `node tools/rings-study.mjs`, output in `out/rings/result.json`.

**A bug fixed before grading.** The first run gave prediction C a ratio of exactly 1 at every angle. The dark-ring search started at d = 1 nm, where reflectance is still rising out of the dark centre, so it stopped at once. Fixed to take the first minimum after the first maximum, and rerun. The model was not changed.

| Prediction | Stated | Measured | Verdict |
|---|---|---|---|
| A, first dark ring, white light | within 5% of 285.4 nm | 275.7 nm (3.4%) | holds |
| B, bright rings 1 : 3 : 5 : 7 | within 3% | 1 : 3.005 : 5.031 : 7.070 (1.0%) | holds |
| C, physics follows the secant | within 0.1% to 85° | max 0.0075% | holds |
| D, table against the secant, 0° to 60° | within 1% | max 0.41% | holds |
| E, table against his 106-means rule, all rows | within 1.5% | max 0.99%; 0.33% at the 90° row | holds |
| C1, no sign flip | must miss 285.4 nm by over 5% | 137.7 nm (52%), bright centre | holds (fails as required) |
| C2, shuffled table | at least 3 rows over 1.5% | at least 7 in every one of 200 shuffles | holds (fails as required) |

**H1 resolved.** The steep rows of Newton's obliquity table follow his own fitted rule, not the secant:

| Air angle | His table | His rule | Secant (the physics) |
|---|---|---|---|
| 60° | 20 | 19.80 | 20.00 |
| 70° | 28.25 | 28.53 | 29.24 |
| 80° | 52.25 | 52.29 | 57.59 |
| 85° | 84.08 | 84.02 | 114.74 |
| 90° | 122.5 | 122.90 | infinite |

The 60° row equals the secant exactly, and every row from 65° on equals the rule. A reading, marked as interpretation: the rows to 60° are measurements, and the steep rows were filled in from the rule. Newton wrote that his values came "partly by measuring ... partly by other Means".

Exact theory for a symmetric glass, air, glass gap says the thickness keeps following the secant: the two interface phase shifts cancel at every angle below the critical one. So his rule is right to about 60° and wrong at grazing angles, by 27% at 85°.

**First dark ring.** Under D65 daylight weighted by the eye, the luminance minimum sits at 275.7 nm. Newton's 285.4 nm implies the light he judged was centred near 571 nm rather than our 551 nm. That is plausible for sunlight and an eye judging "the darkest Part" of a coloured fringe. It is not checked: no solar-spectrum or perceptual model was run.

**Does not prove.**
- Which of his table rows were measured and which were computed. The text cannot settle it, and the reading above is an inference.
- The search for prior analyses of the obliquity table was limited.
