<!-- writing-profile: research -->
# compose: composition-axis scorer and wide-angle checker

Source: STUDY-MAP section 3 (perspective, framing and composition); intake rows B1 19, 20, 27; C2 25, 53, 54; D café wall.

## PREREG (2026-10-28, written before any code in this folder)

Every scene below is generated here with a pinhole camera (35 mm-equivalent focal length on a 36 mm wide sensor) and ray-cast, so the answers are planted by geometry. Angles are in degrees, counterclockwise positive as seen on screen. W is frame width in pixels.

**Line detector.** Gradient level lines grown into regions (the LSD idea of von Gioi et al., from memory, moderate confidence), each region kept only if its a-contrario number of false alarms is below 1, then fitted by total least squares.

**P1. Vanishing point.**
- Prediction: on 12 seeded synthetic renders at 1280 x 720 (a corridor at 16, 24, 35 and 50 mm and a rail track on a ground plane, camera yaw and pitch drawn in plus or minus 10 degrees), the detected vanishing point lies within 1% of W of the true one in every scene.
- Planted answer: the true point is K R d for the corridor axis d.
- Control that must fail: the same segments with their directions shuffled (midpoints and lengths kept, angles drawn uniformly) must give "no significant vanishing point" in all 12 scenes. Significance is the real support against the best support of 19 shuffled sets (p < 0.05).

**P2. Lines reach the edges.**
- Prediction: a corridor at 16 mm with the camera inside it scores 1.0, the fraction of converging lines whose far end lies within 2% of the ray from the vanishing point to the frame edge.
- Control that must fail: the same corridor at 200 mm, framed from 23.8 m in front of its mouth so the mouth fills 70% of W, scores under 0.5. Its vanishing point must still be found within 1% of W, so the low score cannot come from a failed detection.
- Second probe, a blind spot I expect: the same corridor at 200 mm from the 16 mm camera position (a pure zoom) scores 0.9 or more. Reaching the edges reads framing, not focal length.

**P3. Depth ratio (physics).** Along a straight line, image distance from its vanishing point is proportional to 1 / depth, so the ratio of a line's far and near radii equals the ratio of the depths it spans.
- Prediction: the median measured ratio is within 15% of the planted ratio for the 16 mm corridor, the 200 mm zoom and the 200 mm framing from the mouth.
- Expected values: 16 mm reads 10 or more, and the 200 mm zoom reads 2.5 or less. This reading separates the two cases that P2's probe cannot.

**P4. Composition axis.** The anchor is the argmax of line convergence times local contrast. The product rule is an authored convention, not physics.
- Prediction: on 40 seeded corridor scenes, each with a planted subject 3 to 12% of W from the vanishing point and 4 distractor lamps of higher contrast placed away from it, the anchor lies within 10% of W of the subject in at least 90% of scenes.
- Planted answer: the projected centre of the subject box.
- Control that must fail: shuffled line directions bring the hit rate down to chance, 30% or less. Two chance references are reported beside it. A uniform random point hits about 5.6% of the time. Picking one of the 5 contrast blobs at random hits 20% of the time.
- Ablations are reported too: contrast alone and lines alone.

**P5. Café wall.**
- Prediction: on a café wall strip whose mortar lines are exactly horizontal, the angle reads 0.00 within 0.05 for the pooled fit and for each mortar line. The same strip rotated 1 degree reads 1.00 within 0.05.
- Control that must fail: white noise and a uniform field give no segments and no angle, so the method reports nothing on structureless input.

**Noise floor (applies to all).** White noise and a uniform grey field at 1280 x 720 give 0 segments and no vanishing point.

## RESULTS

Filled in after the run, below this line, with no edits above it.

### Run of 2026-10-28

The numbers come from `node tools/compose-eval.mjs`, written to `out/compose/prereg-results.json` and, after the post-hoc changes listed below, to `prereg-results-final.json`. Both runs give the same numbers.

| Check | Prediction | Measured | Verdict |
|---|---|---|---|
| P1 vanishing point | 1% of W or less in 12 of 12 scenes | worst 0.25% of W (rail, 35 mm); corridors 0.01 to 0.03% | held |
| P1 control | shuffled directions: no significant point in 12 of 12 | 12 of 12 not significant; lowest p 0.10 | held |
| P2 16 mm corridor | edge score 1.0 | 1.0 (24 of 24 lines) | held |
| P2 control, 200 mm framed | under 0.5, with the point found | 0.4545 (10 of 22); point within 0.03% of W | held, but fragile (see below) |
| P2 probe, 200 mm zoom | 0.9 or more (blind spot) | 1.0 | held: the edge score reads framing, not focal length |
| P3 depth ratio | within 15% of planted, all three | 16 mm: 17.52 against 18.03 (2.8%); 200 mm framed: 2.36 against 2.34 (0.7%); zoom: 1.46 against 1.45 (1.0%) | held |
| P3 expected | 16 mm at 10 or more, zoom at 2.5 or less | 17.52 and 1.46 | held |
| P4 anchor | within 10% of W in 90% or more of 40 scenes | 40 of 40 (100%); worst 7.95% of W | held, weak test (see below) |
| P4 control | shuffled at 30% or less | 0 of 40 (0%); uniform random point 2.5%; contrast alone 0%; lines alone 100% | held |
| P5 café wall | 0.00 within 0.05, every line | pooled 0.0000, worst of 14 edge lines 0.0000 | held |
| P5 rotated strip | 1.00 within 0.05 | pooled 1.0000, worst line off by 0.0001 | held |
| P5 control | noise and uniform give nothing | 0 segments, no angle | held |
| Noise floor | 0 segments, no point | 0 and 0, no point in either | held |

**What the passes do not show.**
- **The P2 control is fragile.** `tools/compose-spec.mjs` moved the 200 mm camera from 21 to 27 m before the mouth, and the edge score read 0.64, 0.60, 0.55, 0.50, 0.60, 0.50, 0.60. The registered 23.81 m read 0.4545, and 6 of the 7 neighbours fail the "under 0.5" line. The cause is geometric. A 3 m square mouth at 70% of W is taller than a 16:9 frame, so the floor and ceiling lines still run off the top and bottom edges. The 3840 px demo of the same framing reads 0.60. Read the held verdict as luck of placement. The depth ratio separates the long lens robustly: 2.36 against 17.5.
- **P4 is a weak test.** The anchor sits on the vanishing point: the median distance from anchor to point is 0.57% of W. The planted subjects all fell 3.0 to 8.2% from the point, so an anchor at the point lands inside 10% by construction. Lines alone also scored 100%. The contrast term moved the anchor closer to the subject in 10 scenes and further in 3. The control does show that the lines carry the information. Contrast alone found the subject in 0 of 40 scenes, because the planted lamps out-contrast it, and shuffling the lines gave 0 of 40. On the registered settings, the scorer does not show that it finds the subject rather than the convergence point.
- No held-out photographs were tested. Every planted answer here is synthetic.

**Post-hoc, lower weight (each was changed after seeing data):**
1. Line grouping tolerance. On the first look at the wide checker it was 0.5 degrees, which counted the two edges of one painted line as two lines and gave an edge score of 0.86. It is now 1.5 degrees. This change came before the registered run, after a look at the same scenes.
2. `minLines = 3`. On the rainbow demo (`out/refraction/bow-3840.png`) the detector declared a significant vanishing point at (3351, 813) from chords of one arc: 15 segments in 2 groups. That was a false accept, and the shuffle null did not catch it. A vanishing point now needs 3 distinct converging lines. The registered scenes all have 20 or more, so their results are unchanged (rerun in `prereg-results-final.json`).
3. Axis fallback. With no convergence, the axis is now read from contrast alone and says so. Before, a line map built from noise chords pulled the anchor onto a ring band in the Newton's rings render.
4. Line-map width sigma (`tools/compose-posthoc.mjs`, `out/compose/posthoc-sigma.json`). At sigma 3 degrees (registered) the anchor was within 2% of W of the subject in 10% of scenes. At 6 degrees: 35%, with the hit rate within 10% falling to 92.5%. At 15 degrees: 15%, and a 50% hit rate. Contrast can pull the anchor onto the subject, at a cost of lamps capturing it. The registered default stays 3.

## Spec sheet

Generated from `tools/compose-spec.mjs` (`out/compose/spec.json`), the registered run, and the tests. Calibration date 2026-10-28.

**Range.**
- Inputs are 8-bit sRGB RGBA at any size. Tested from 640 x 360 to 3840 x 2160.
- One dominant vanishing point is chosen: the strongest significant point within 1.5 W of the frame centre. Up to 4 are listed.
- The café-wall angle is read for one family of parallel lines, within 15 degrees of the length-weighted mode.

**Resolution.**
- Line angle: 0.01 degree planted reads 0.0076. 0.02 reads 0.0205. 0.05 reads 0.0496. Steps of about 0.01 degree are resolved on a 1600 x 480 strip.
- Vanishing point: 0.02% of W or better on clean corridors at every tested size (0.01% at 640, 1280 and 1920; 0.02% at 960).
- Polar grouping: lines closer than 1.5 degrees as seen from the vanishing point merge into one line.
- Axis grid: W / 160 (0.625% of W).

**Accuracy on planted answers.**
- Vanishing point, 12 scenes: worst 0.25% of W, rail tracks worst and corridors at 0.03% or better.
- Depth ratio, 1280 px: within 3%.
- Café wall: within 0.0002 degree clean, 0.012 degree at noise sd 16.

**Resolution dependence of the depth ratio.** For the 16 mm corridor with the camera turned (yaw 6, pitch -3; planted 17.05, a different scene from the P3 corridor, planted 18.03):

| Width | 640 | 960 | 1280 | 1920 |
|---|---|---|---|---|
| Reads | 15.55 | 16.29 | 17.21 | 16.98 |

The far ends crowd round the vanishing point at small sizes.

**Noise floor.**
- White noise and a uniform field give 0 segments, no vanishing point and no angle, at 640, 1280 and 1600 px.
- Detection is a contrario: on average fewer than 1 false segment per image under independent orientations.

**Known blind spots.**
- **Sensor noise.** The registered detector has no smoothing, and it degrades fast. On the 16 mm corridor, Gaussian noise of sd 4 code values drops the edge score to 0.79. At sd 8: edge 0.38 and depth 2.1. At sd 16: no lines at all. The `smooth` option is post-hoc and off by default. At smooth 1 the vanishing point stays within 0.04% at sd 16, but the depth ratio under-reads (12.5 clean). At smooth 1.5 or more, white noise gives false segments (5 at 1.5, 145 at 2), because blurring breaks the independence the false-alarm count assumes. For photographs, smooth 0.75 to 1 is the useful range. That is untested on real photos.
- **Edge score reads framing.** A 200 mm zoom from inside a corridor scores 1.0, as predicted.
- **Object edges count as lines.** In the 3840 demo corridor, the lamp sides point at the vanishing point and stop inside the frame, so the score is 0.80 rather than 1.0. Occluded lines also stop short.
- **Curved edges.** Chords of one arc can pass the shuffle null. The 3-line rule stops the rainbow case, and arcs with many chords are untested.
- **Thick textured lines at 3840.** On the rail plate the near rails, about 30 px wide and crossed by sleepers, are not returned as converging segments. The vanishing point came from the far rails and the sleeper ends (0.099% of W).
- **The axis follows the convergence point,** not the subject (P4). Without a subject, as in the 200 mm framing and the rail track, the anchor lands on the strongest contrast edge.
- **Café wall scope.** The angle measures geometry only. It says nothing about the size of the perceived tilt.

### Adversarial verification, 2026-10-28

- The P2 control and P2 probe had no test: a constant edge score of 1 passed every test. `tests/compose.test.mjs` now renders all three registered lens scenes and asserts the registered thresholds (16 mm at 1.0, framed under 0.5 with the point within 1% of W, zoom at 0.9 or more, depth within 15% for all three). The framed assertion inherits the fragility above.
- The contrast term of the axis is not tested by anything. Replacing the anchor with the argmax of the line map alone passes every test, matching the 100% lines-alone rate in the registered run.
- The PREREG named a second chance reference for P4, one of the 5 contrast blobs picked at random (20%). The results report contrast alone (0%) in its place; the 20% reference was not measured.
- Controls that do fail against their naive versions: no shuffle null (P1), no a-contrario validation (noise floor), anchor at the frame centre (P4 shuffle control, 3 of 3 shuffled hits), angle from the histogram mode bin (P5 resolution test only; the 0 and 1 degree checks pass it because the planted angles are whole degrees).
- With smooth 1 and noise sd 16 on the turned 16 mm corridor, the depth ratio reads 6.6 against 17.05.

## Files

`camera.mjs` (pinhole, 35 mm-equivalent), `scene.mjs` (ray-cast corridor and rail scenes with box-filtered lines), `lines.mjs` (segments, a contrario), `stats.mjs`, `vp.mjs` (vanishing points and the shuffle null), `wide.mjs` (reach and depth ratio), `axis.mjs` (composition axis), `cafewall.mjs` (strip and line-angle reading), `plant.mjs` (seeded scene sets), `prereg.mjs` (the registered checks), `plate.mjs` (demo plates). Tools: `tools/compose-eval.mjs`, `compose-spec.mjs`, `compose-posthoc.mjs`, `compose-demo.mjs`. Tests: `tests/compose.test.mjs`, `tests/compose-axis.test.mjs`.
