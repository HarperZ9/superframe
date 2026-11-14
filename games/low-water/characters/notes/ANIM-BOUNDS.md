<!-- writing-profile: research -->
# Bodies and animation: bounds, controls, results

2026-10-22. Character and animation lead. Author direction (2026-10-22): "The character bodies and
animations should be done very well. The mechanics must be fluid. Let's push for a completion."
Companion to PIPELINE.md section 7 (known limits) and PROGRESS.md.

## Order of work, stated plainly

The house method is bounds first, then code. This pass measured the baselines first (the scripts below,
run on the unchanged runtime), then built a first version of the foot lock and the fades, then wrote these
bounds with the numbers the baselines gave. So the bounds were set after the first build pass, not before
it. The controls keep them honest: each bound has a switch that restores the old behaviour, and the old
behaviour must fail it. The baselines in the tables are from the unchanged code (the footlock baseline:
`out/footlock-baseline.json`, run before any change to `runtime/actor.mjs` beyond the `footIK` switch).

## 1. Foot lock

**Measure.** `node proto/footlock_check.mjs --who lamb,tomas,aaron`. Sixteen scenarios per body at 60 Hz:
steady walk at 1.0 and 1.5 m/s, run at 2.6, 3.6 and 4.5, walk-to-run acceleration, idle-to-walk start,
walk-to-idle stop, the run's `stop` clip, turn in place, turn from a run, and combat's clock (`drive`)
walking straight, a 3 m circle, a 4 m running circle, up a 10 degree slope and across it. A foot is planted
on a frame when the clip, with no lock, holds the ankle within 1.2 cm of its standing height (the idle
clip's), and the final foot is down too. A step is a planted run of 6 or more frames; its slide is the
horizontal path of the final ankle over the run, less two frames at each end.

**Bound.** Slide at most **1.0 cm per step** in every scenario for all three bodies (Lamb, adult, 1.86 m;
Tomas, 11, 1.31 m; Aaron, 9, 1.24 m). A planted foot within **1.5 cm** of the ground under it, slopes
included. Every scenario keeps at least two planted steps (a lock that lifted every foot to dodge the
measure would show there), and the count of "lifted" frames (clip down, final foot over 1.2 cm up: a
catch-up step or clearance) is printed beside each row.

**Control.** `--ik off` (no runtime locks, no ground fit) must exceed a bound in the non-steady scenarios.

**Baseline (unchanged code, measurement revision 2).** Worst 25.8 cm (Tomas, turn in place); starts 16 to
19 cm, stops 10 to 23 cm, walking a circle 5.8 to 8.5 cm, steady gaits 0.8 to 1.7 cm, slopes 7.9 to
9.1 cm of height error (the feet stayed level with the body's own height).

## 2 and 3. Fades and layering: no step in any joint's speed

**Measure.** `node proto/blend_check.mjs`. Every pair of a locomotion clip (idle, walk, run) and a combat
clip in the library, both ways: 286 combat clips, 3,432 transitions (three entry phases each way in, one
out). The switch is played as the actor plays it, sampled at 60 Hz. Per joint: the world angular
acceleration (degrees per frame squared) and position acceleration (cm per frame squared), centred on the
tick where the fade starts and the tick where it ends, less the larger of the two clips' own at the same
clip times. With `--layer`: the combat clip faded in on the upper body over walking or running (1,398
attacks and uses at three phases).

**Bound.** Edge excess at most **2.0 deg/frame^2** and **3.0 cm/frame^2** for every transition, cross-fade
and layer. The excess inside a fade (the ease itself, no step) is printed and not bounded.

**Control.** `--curve linear --wrap old` (the actor's fade before this pass) must exceed on most pairs.

**Baseline (unchanged code).** Edge worst 30.4 deg/frame^2 and 44.7 cm/frame^2; all 3,432 over the bound.
Inside the fade, 118.7 deg/frame^2: a whole-turn fault, below.

**Additive layers.** Hit reactions were already additive (runtime/feel.mjs `makeReactions`, applied as the
actor's "hit" adjust layer by the fight drawer) and are unchanged. Lean is new: into a curve, toward its
centre, more than 3 degrees on a 4 m curve at 3.6 m/s; under 0.5 degrees running straight.

## 4. Bodies

**Measure.** `node proto/body_check.mjs`: each Quota member's heads per height, hip height over height,
shoulder width over height and arm over height, against a reference by age scaled to the cast's own adult
style (the adults run 6.2 to 6.9 heads, stylised from a natural 7.5); a contact sheet of all 22 at one
scale (`proto/body_sheet.mjs`), front and side, looked at for clipping and broken weights.

**Bound.** Children within 6 % of the style-scaled heads-per-height for their age and within 0.03 of the
reference hip height ratio. `cast/quota.mjs` is another lead's file this pass, so any change there is
listed for its owner, not made.

## 5. Portraits

**Bound.** `PORTRAIT_CAST=quota node proto/portraits.mjs` and the glyph bake run for all 22 without a
crash; Anni after the commit that set her inherit (bdb4a67: Bet and Ned).

## 6. Visual

Contact sheets and frame strips of walk, run, stop, turn, a strike while walking, a hit reaction and a
child's walk, looked at, with what is still wrong written down (section 7).

## 7. Results (2026-10-22)

`node proto/anim_bounds_test.mjs` passes, controls included.

| Target | Bound | Baseline | Result | Met |
|---|---|---|---|---|
| 1. Slide per planted step, 16 scenarios, Lamb, Tomas, Aaron | 1.0 cm | 25.8 cm | 0.77 cm over 600 steps | yes |
| 1. Planted foot height on 10 degree slopes and flat | 1.5 cm | 9.1 cm | 1.19 cm | yes |
| 1. Control, locks off, every start, stop, turn, curve, slope, acceleration | must break | | 30 of 30 break, worst 227 cm | yes |
| 2 and 3. Fade edges, 3,432 locomotion and combat pairs | 2.0 deg/f^2, 3.0 cm/f^2 | 30.4, 44.7 | 1.84, 2.48 | yes |
| 2. Upper-body layer fade-in, 1,398 pairs over walk and run | same | 28.1, 23.5 (linear) | 1.65, 1.65 | yes |
| 2 and 3. Control, old linear fade and per-frame wrap | must break | | 3,432 of 3,432 | yes |
| 2. Layer leaves legs as the walk's; hit window reported | 1 mm | | 0.00 mm; 6 ticks for 3 frames | yes |
| 2. Lean into a curve, none straight | over 3, under 0.5 deg | none | 11.0 (clamped), 0.00 | yes |
| 4. Children's heads per height (style-scaled) | 6 % | | Aaron -4, Tomas -4, Pell -3, Davey +1, Anni 0, Rose +1 | yes |
| 4. Children's hip ratio | 0.03 | | all within, except Rose (4): 0.376 against 0.420 | **no** |
| 5. Portrait and glyph rebake, all 22 | no crash | crash | 22 of 22, Anni after bdb4a67 | yes |

**Not bounded, measured, worse.** The older whole-sequence pop count (`proto/popcheck.mjs`, joint
acceleration over 3.5 cm/frame^2) went from 162 frames (summed excess 965 cm) to 213 (1,148 cm). Its
planted-slide count fell from 83 to 36. Two causes: the smootherstep fade has no step but a faster middle
than the linear one, and the catch-up steps and clearance lifts move feet quickly over 6 to 12 frames.
Longer fades or inertialisation would cut the first; neither is done.

**Fixes found on the way.** (a) The root's whole-turn rule was decided every frame from the sign of the
leaving angle, so an arriving clip turning past 30 degrees mid-fade (every dodge) jumped a whole turn
times the fade weight: 118.7 deg/frame^2 inside fades, now 16.3. (b) The gait's hip drop, lift and bob were
absolute metres written for an adult: a nine-year-old walked in a crouch (seen in the first child strip);
they now scale with the leg. (c) The swing's landing skimmed in at the body's speed; it now leaves and
meets the ground at rest and stays inside the leg's reach (walk reach 0.95, was 1.0). (d) Soft reach in
the two-bone IK, so a straight planted leg's knee does not swing.

**For cast/quota.mjs's owner (not edited here).** `AGES[4].leg` 0.8 to about 0.89 puts Rose's hips at
0.42 of her height. In side view the apron's ties read as a rigid light bar sticking out behind the hips
(Mary, Bet, Lil, Edie, Anni): the ties want to hang or be dropped at play size.
