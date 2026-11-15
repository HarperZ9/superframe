<!-- writing-profile: research -->
# The Quota's heads: bounds, controls, results

2026-10-22. Head sculptor (character lead). Author direction (2026-10-22): "The character bodies and
animations should be done very well." The coordinator's verdict on the old head: balls with features painted
on, no skull, goggle eyes, pink cheek discs, smeared lips, ears too large, a flat cap of hair, and faces that
fall apart in three-quarter and profile view.

## Order of work

These bounds were written before any of the new head's code. The old head was measured first, as the
control, by the same script (`proto/sculpt_check.mjs --old`), so the measure is known to see what the
coordinator saw. The proportion ranges are adult anthropometric norms from memory (Farkas-style head and
face measures, Ricketts' E-line), moderate confidence; they are ranges for ordinary faces, so a character's
one idea may sit near an edge of a range but not outside it.

Units. H is the head height, vertex to menton (the chin's underside), measured on the built mesh. All
lengths below are fractions of H. For an adult man H is about 23 cm, so 0.01 H is about 2.3 mm.

Landmarks are found on the built mesh (skin, lip and eye vertices, the hair and hats left out), not on the
sculpt's own numbers: the front profile is the largest z in a 6 mm strip about the midline, per 3 mm of
height. Pronasale is the profile's furthest point between the eyes and the mouth; subnasale the profile's
deepest point in the 0.09 H below it; the lips the two furthest points below that; pogonion the furthest
point of the lower face; menton the lowest point still within 0.06 H of pogonion's depth.

## 1. Profile (silhouette in side view)

| Measure | Adults | Children (under 16) |
|---|---|---|
| Head breadth (twice the largest half-width above the brow) / H | 0.60 to 0.72 | 0.62 to 0.78 |
| Head length (front to back above the brow) / H | 0.78 to 0.92 | 0.78 to 0.94 |
| Brow: glabella ahead of the cornea | 0.02 to 0.07 | 0.01 to 0.06 |
| Nose: pronasale ahead of subnasale | 0.055 to 0.10 | 0.04 to 0.085 |
| Lips: both behind the E-line (pronasale to pogonion), at most 1 mm ahead | -0.004 to 0.05 | -0.004 to 0.05 |
| Chin: pogonion behind subnasale | 0.00 to 0.08 | 0.00 to 0.09 |
| Ear length / H | 0.22 to 0.30 | 0.22 to 0.31 |

**Control.** The old head (`--old`: the same face records through `cast/parts.mjs` `head()`) must fail at
least head breadth and head length for every person, and the lips or chin for most.

## 2. Eyes (frontal render, the G-buffer's material ids, 4 px a millimetre or more)

- **Visible white.** Eye white pixels / (white + iris + pupil) inside each eye at neutral: **0.30 to 0.65**.
- **No goggles.** Over the iris's middle half of columns, the share of columns with eye white directly above
  the iris or directly below it: **at most 0.15** at neutral. Fear is allowed to show white above the iris
  (it is how fear reads), so this bound is for neutral only.
- **Wet highlight.** In the live shaded render under the portrait's paraffin key, at least **one pixel a
  eye** inside the iris's box with value at least **0.75** (the old iris is a matt dark disc).

**Control.** The old head must fail the no-goggles bound or the highlight bound for every person.

## 3. Three-quarter view (40 degrees, the far side's contour)

The far contour (cheekbone, cheek, jaw, chin) of skin vertices projected for a head turned 40 degrees:
- **Cheekbone.** From the cheekbone point (the contour's furthest point between the eyes and the nose's base)
  to the jaw point (the furthest point between the mouth and menton), the contour dips inside the straight
  chord by at least **0.005 H** (a hollow under the cheekbone, so the cheekbone reads as an edge).
- **Jaw corner.** In the lower contour (mouth to menton), the sharpest turn (degrees per 0.02 H) is at least
  **2.5 times** the zone's median turn: a corner, not an even arc.

Adults only. Children and Pask ("the one soft round fed face") are reported and not bound: their full
cheeks are their idea.

**Control.** The old head must fail the cheekbone bound for most adults (a ball is convex everywhere).

## 4. Distinctness

Each person's descriptor: the front profile depth, the frontal half-width and the 40-degree far contour, each
sampled at 24 heights from vertex to menton, centred, in H. The distance between two people is the RMS
difference of their descriptors.

- **Every pair** at least **0.012 H** apart; the **median pair** at least **0.03 H**.

**Control.** A clone cast (every person given Ned's face record) must fail: its distances are near zero.
The old head is reported: distinctness was not the coordinator's complaint, so it may pass.

## 5. What must keep passing

The foot lock and fade bounds (ANIM-BOUNDS.md, `proto/anim_bounds_test.mjs`), every `proto/*_test.mjs`, and
Low Water's 36 heads unchanged (the new head is The Quota's only).

## Results

Measured by `node proto/sculpt_check.mjs` (and `--old`) on the final build; JSON and text in
game/capture/sculpt-2026-10-22/after/ (`sculpt-check*.json`, `sculpt-check*.txt`). 22 people, neutral.

| Measure | Bound (adults; children) | Old head (control) | Sculpted head | Met |
|---|---|---|---|---|
| Head breadth / H | 0.60 to 0.72; 0.62 to 0.78 | 0.92 to 1.06, all 22 fail | 0.57 to 0.77 | 16 of 22: Ned, Mott, Captain under (long faces); Ilo, Pask over (broad Hesh, a fed face); Rose under |
| Head length / H | 0.78 to 0.92; 0.78 to 0.94 | 0.93 to 1.09, all 22 fail | 0.68 to 0.98 | 17 of 22 |
| Brow ahead of the cornea | 0.02 to 0.07; 0.01 to 0.06 | 16 fail | 0.019 to 0.066 | 22 of 22 |
| Nose: pronasale ahead of subnasale | 0.055 to 0.10; 0.04 to 0.085 | 20 fail (see the note below) | 0.045 to 0.101 | 20 of 22: Will 0.047 (his flattened broken nose), Abel 0.101 |
| Lips behind the E-line | -0.004 to 0.05 | 5 fail | -0.012 to 0.029 | 18 of 22: Bet, Pell, Tomas, Rose a few millimetres ahead |
| Chin behind subnasale | 0 to 0.08; 0 to 0.09 | 14 fail | 0.003 to 0.17 | 20 of 22: Ilo 0.103, Rose 0.17 |
| Ear length / H | 0.22 to 0.30; 0.22 to 0.31 | 8 fail | 0.19 to 0.31 | 16 of 22, the misses within 0.013 of the edge, and Rose (four) at 0.19 |
| Visible white at neutral | 0.30 to 0.65 | 7 fail | 0.31 to 0.36 | 22 of 22, near the low edge |
| White above or below the iris (goggles) | at most 0.15 | 0.10 to 1.0, 20 fail | 0.00 for all | 22 of 22 |
| Wet highlight, pixels an eye | at least 1 | 0 for all 22 | 11 to 69 | 22 of 22 |
| Three-quarter: hollow under the cheekbone | at least 0.005 | 1 of 15 fail (the control did not hold) | 0.000 to 0.040 | 11 of 15 adults bound (Pask exempt) |
| Three-quarter: jaw corner, sharpest turn over median | at least 2.5 | 11 of 15 fail | 1.2 to 5.5 | 7 of 15 adults bound |
| Distinctness: every pair / median pair | 0.012 / 0.03 | 0.009 / 0.175 | 0.0046 / 0.021 | no |

Every bound passed for 5 of 22 (Aaron, Anni, Mary, Pell as an adult, Davey); the old head passes every bound
for none.

**What the controls showed.** The old head fails breadth, length, the goggle bound and the highlight for
nearly every person, as written. The cheekbone-hollow bound did not discriminate: the old head's cheek disc
meets its jaw ellipsoid in a dip, so 14 of 15 old adult heads pass it. That measure sees a dip in the far contour,
not a cheekbone; it is kept and reported, not trusted. The jaw corner measure passes 4 of 15 old adult heads; it
counts corners in the lower contour (lip, chin fold, chin) as well as the jaw's. The old head's nose and chin
figures are partly landmark failures (its midline has holes where props stood off the face), so its fails
there are not all real. Distinctness: the clone control gives zero, so the measure sees sameness; the old
head's large median comes from its oversized noses (6 to 10 cm), not from better faces.

**Distinctness failed.** The closest pairs are Pell and Davey (two Tarn boys of nine and ten), and Anni at
forty against Lil and Bet (Tarn women of an age under a scarf or hair). A push away from the cast's centre
(cast/sculpt_face.mjs `CENTRE`) raised the median from 0.013 to 0.021, short of 0.03. The people ranges in
cast/peoples.mjs are narrow by design; the faces need more of each person's own idea in the records, which is
the story lead's material as much as mine.

**Cloth (the same pass).** `proto/fidelity_check.mjs`, legs through coat or dress, vertices a frame (walk,
run, strike): target at most 5 for every cast member. Before: 0 to 8, the Captain 26, Lamb 9 (FIDELITY.md).
After: 0.0 to 3.2 for all 23 (Mott 3.2, Gedge 2.9, Abel and Will 2.2, the Captain 1.8, Lamb 1.8). Met.

## Second pass (2026-10-22, the coordinator's order: light, children, distinctness)

Captures: game/capture/sculpt-2026-10-22/light/ (faces after each step and a play-size crop; the step 3
measures as JSON and text).

1. **Light.** The sculpted head's skin is a material of its own (flesh) lit on a softer ramp: a lifted floor
   so a face never falls to the darkest band, softer band edges, warmth kept in shadow in place of the violet
   shift, an eased top (no hot cheek disc). Eye parts are their own materials drawn without ink between them,
   with a painted catchlight cap on the cornea that the light still shades. Judged on faces.png: the bruised
   mask is gone and the eyes read at play size. The highlight bound now counts the catchlight cap (11 to 69
   pixels before, 180 to 290 after), so it no longer measures a specular highlight alone.
2. **Children.** Lips painted into the flesh (no islands of another material), the mouth line cut by flat
   ellipsoids (no pits at the corners), a child's mouth and brows scaled with the face.
3. **Distinctness.** One idea per face (cast/sculpt_ideas.mjs) drawn at 1.6 times its written factor, with face
   length and skull width held near the person's own. Closest pair 0.0046 to 0.0075 H, median 0.021 to 0.022 H:
   still short of 0.012 and 0.03. Doubling the ideas raised the median to 0.025 but put 16 heads outside the
   breadth bound and 15 outside length, because the descriptor is normalised by head height and the cheapest
   way to move it is to change the head's proportions. Within the proportion bounds this measure barely moves;
   the bound or the descriptor needs rethinking (weight features such as nose, brow, jaw and chin over the
   outline), and that is a decision for the coordinator. Every head bound: 4 of 22 after this pass (5 before;
   the ideas move some heads to the edges of the ranges).
