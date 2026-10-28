<!-- writing-profile: research -->
# lib/stack: the section-stack temporal module

One operation: slice a volume along an axis, then read the slices back by stacking them with offsets, weights and tints. The axis decides the name. Along time it gives the frame-offset echo, the onion skin and the shutter integral. Along height it gives sprite stacking. A held time slice that re-rolls only its noise gives the living still.

Sources: STUDY-MAP.md sections 4 and 11, intake-2026-10-28/E-notes.md (candidates B and K, bridge 1).

## PREREG (written 2026-10-28, before any code in this folder)

Each line names the prediction, the threshold, the planted answer and the control that must fail. Results go in the RESULTS section below, after the run, and the predictions here are not edited after that.

**P1. Shutter streak length (physics: exposure is the time integral of irradiance over the open shutter).**
- Prediction: a bright bar moving at relative image velocity v under a shutter open for T seconds leaves a streak of length |v_object - v_camera| x T.
- Threshold: within 5% for every planted case.
- Planted answers: (v, T) giving L = 8, 16, 32, 64 and 120 px, including a panned camera case where the object moves at 900 px/s and the camera at 600 px/s (L = 300 x T).
- Estimators: the full width at half maximum of the trapezoid (equal to L when L is at least the bar width), and the second moment, L = sqrt(12 (var_streak - var_bar)).
- Control that must fail: a camera that tracks the object exactly. The object streak must read under 1 px, while the background streak reads v_camera x T within 5%.

**P2. A flash under 1% of the shutter stays sharp.**
- Prediction: a strobe event lasting under 1% of the shutter, on a marker that moves with the object, leaves a mark whose extent grows by at most 2% of L over the marker's own width.
- Planted answer: L = 64 px, flash 0.5% of the shutter, so the expected growth is 0.32 px.
- Control that must fail: a plain directional box blur of length L applied after rendering the mid-shutter frame. The flash mark must then read at least 90% of L.

**P3. Frame-offset echo.**
- Prediction: copies of a moving layer delayed by k frames and tinted sit under the base. The residual, output minus the base-only render, cross-correlates with the luma of the base layer and peaks at lag k over lags 0 to 12. A least-squares fit of the residual on the delayed base recovers the tint within 1/255 per channel from 8-bit output.
- Planted answers: k = 3, 5 and 8, with tints (0.90, 0.30, 0.20), (0.20, 0.70, 0.95) and (0.55, 0.85, 0.35).
- Controls that must fail: k = 0, where the base occludes its own echo and the recovery has no support, so it must report unrecoverable or miss by more than 1/255. Jittered delays of k plus a uniform integer in [-2, 2] per frame must miss by more than 1/255 on the fixed-lag fit, and the correlation peak must fall by at least 0.2.

**P4. Onion skin.**
- Prediction: with ghosts at frame offsets -3 to +3, each ghost's centroid sits at the base position of its source frame within 0.5 px.
- Control that must fail: ghosts drawn with zero offset. Their centroids then miss by |j| x v per frame, which is over 0.5 px for every j.

**P5. Living still.**
- Prediction: one locked frame at 30 fps with grain and dither re-rolled every 2 frames reads 15 Hz unique on the module's own counter (exactly), and 15 +/- 1 Hz on the decompose motion lens with boil present and mean flow under 0.01.
- Resolution check: holds of 1 and 3 frames read 30 and 10 Hz, +/- 1 Hz, on the module's counter and on the lens.
- Control that must fail: the same frame with grain frozen. The lens must read "still" with boil absent. If the lens reports boil on the frozen clip, it is reading codec noise and the P5 lens check is void.

**P6. Grain follows photon shot noise (physics: Poisson counting).**
- Prediction: with N photons at full signal, the per-pixel variance of the grain at mean signal s is s / N. The fitted slope of variance against mean over 8 grey levels is 1/N within 5%.
- Control that must fail: signal-independent Gaussian grain of the same mean variance. Its fitted slope must sit under 10% of 1/N.

**P7. Noise floors.**
- A static scene under any shutter must equal its sharp frame (max difference under 1e-6).
- A static base must give an echo residual of zero outside the base silhouette.
- A held frame with grain amplitude 0 must count 0 Hz unique.

## Authored conventions, labelled

- Echo tints and the onion-skin colours (past warm, future cool) are conventions from animation tools, not physics.
- Ordered dither (Bayer 4x4) and the grain cell size are conventions. The grain's amplitude law (P6) is physics.
- Echo copies composite under the base with the Porter-Duff "over" operator. The order is a convention; the operator is exact.

## RESULTS (run 2026-10-28, after the PREREG above)

Numbers come from `out/stack/measures.json` (`node tools/stack-measure.mjs`) and `out/stack/clips/lens.json` (`node tools/stack-clip.mjs`).

| Prediction | Measured | Verdict |
|---|---|---|
| P1 streak = v x T within 5% | FWHM exact (0.00%) for L = 8 to 300 px; second moment within 0.41% at 8 px and 0.01% at 64 px; 16x grid within 0.06% from 0.5 px. Panned camera (900 against 600 px/s, 1/30 s): 10 px read within 5% | held |
| P1 control: tracking camera | object streak under 1 px; world posts read 20 px within 5% | held (the control fails sharpness as it must for the world, and the tracked object stays sharp) |
| P2 flash 0.5% stays sharp | growth 0.329 px against 0.32 expected (16x grid), threshold 1.28 px | held |
| P2 control: post-blur | flash smeared to 64.02 px (threshold at least 57.6) | held (control failed as required) |
| P3 lag peak at k | peak at 3, 5, 8 for planted 3, 5, 8; peak correlation 0.9985 to 0.9997 | held |
| P3 tint within 1/255 | errors 0.511, 0.219, 0.233 /255 | held |
| P3 control k = 0 | support 0, tint unrecoverable | held (control failed) |
| P3 control jitter +/-2 | errors 145 to 177 /255; peak correlation fell from 0.999 to 0.26 to 0.33 (drop 0.67 to 0.74) | held (control failed); the jittered peak lag also moved off k for k = 5 |
| P4 ghosts within 0.5 px | under 0.5 px for all six ghosts on the linear path (test); 0.05 to 0.48 px on the plate's curved path | held |
| P4 control zero offsets | every ghost hidden under the base or off by 12 x j px | held (control failed) |
| P5 counter 15 Hz on twos | 15.00 exactly; ones 30.00, threes 10.00, fours 7.50 | held |
| P5 lens 15 +/- 1 Hz, boil, flow < 0.01 | 720p: 15.05 Hz, "twos", boil present, mean flow 0.0071. 2160p: 15.09 Hz, boil present, flow 0.0027. With rain: 15.05 and 15.09 Hz, boil present, flow 0.0084 and 0.0074 | held |
| P5 resolution, lens | ones 30.00 Hz "ones" (boil absent: regularity is undefined when every frame changes); threes 0 Hz "still" | **failed for threes** |
| P5 control frozen | lens "still", 0.1 Hz, boil absent | held (control failed as required; the P5 lens check is not void) |
| P6 slope x N = 1 within 5% | 1.0007 | held |
| P6 control flat grain | slope x N = -0.0042 (threshold under 0.1) | held |
| P7 noise floors | static scene under any shutter: max difference under 1e-6; static base: zero echo residual outside the silhouette; grain 0: 0 Hz | held |

**The threes failure is the lens's, traced in its code.** `cadence()` in `decompose/dr/d_motion.py` keeps only frames whose 5-frame moving mean of change exceeds 0.25 x the typical change. On threes, a window centred on a change holds only that one change (the next ones are 3 frames away), so its mean is 0.2 x typical and the change frames are dropped as inactive, leaving only holds. The frame differences themselves are clean (4.8e-3 every third frame, under 1e-5 between). Any cadence of threes or slower with uniform changes reads "still". This is a defect report for the decompose lens; this folder does not edit it.

## Spec sheet (instrument view, 2026-10-28)

**Shutter integral (`shutter.mjs`).**
- Range: any constant-velocity rectangle scene, any shutter; tested 0.5 to 300 px streaks, panned and tracked cameras, flashes from 0.1% to 20% of the shutter.
- Resolution: slices are spaced so the fastest item moves at most `step` px (default 0.1); a flash gets at least 4 slices of its own window, so no strobe is stepped over.
- Accuracy on planted streaks: second-moment estimator within 2% from 4 px at 1x, within 0.06% from 0.5 px on a 16x grid. FWHM is exact from 8 px up; at the bar width (4 px) it reads 4.29 (7%), and below the bar width it reads the bar, not the streak. (Corrected 2026-10-28 by the verification pass: the earlier line said exact from 4 px.)
- Noise floor: a static scene equals its sharp frame to 1e-6. Flash growth floor on a 16x grid: about 0.03 px (0.1% flash read 0.090 against 0.064).
- Energy: a flash delivers the same total exposure for any duration (within 0.1% from 0.1% to 20% of the shutter).
- Blind spots: constant velocity only (no acceleration or rotation within a shutter); flashes are emissive and drawn over opaque items, never occluded; FWHM cannot read streaks shorter than the object; the moment estimator at 1x has a pixel-phase floor near 1 px.

**Echo and onion skin (`echo.mjs`).**
- Range: any layer sequence; lags 0 to 12 scanned; one copy per fit.
- Accuracy on planted tints: within 0.52/255 from 40 8-bit frames. The residual floor is 8-bit rounding, which a four-colour sprite does not average away.
- Lag resolution: one frame; neighbouring lags read 0.04 against 1.00 at the peak.
- Blind spots: k = 0 is unrecoverable by construction for a hard-edged base (the base covers its echo); an antialiased base leaks support on its edges and was not measured. Overlapping copies with different tints are not jointly fitted. A motion that repeats within 12 frames would give several peaks.

**Living still (`still.mjs`).**
- Range: any held frame; hold 1 to 4 tested; 720p and 2160p clips through H.264 crf 16.
- Accuracy: counter exact (frame-rate / hold); lens within 0.09 Hz on twos and ones.
- Grain law: variance slope x N = 1.0007 (Poisson exact up to 100 expected photons per cell, normal approximation above).
- Noise floor: frozen grain counts 0 Hz; the lens reads 0.1 Hz "still" on the frozen H.264 clip.
- Blind spots: the lens misreads threes as still (above). Dither, cell size and level count are authored and not measured against any reference.

**Sprite stacking (`stack.mjs`).** Each slice rises `rise` px: a 6-cell-deep, 10-slice stack measures 15 px tall, as planned. Nearest-cell sampling; no shading model beyond an authored per-slice darkening.

## Not done
- Cross-contour hatching (plane sections of a mesh) and the production-stage axis (board, layout, final) are named in the study map as further axes of this module and are not built.
- The rain test from the drive-thru clip (streak length = fall speed x shutter) is drawn in the demo but measured only through the bar fixtures, not on the rain itself.
- Echo fit with several copies at once, antialiased bases, and per-pixel velocity blur as a second control were not built.
- No adapter node: integration into `adapters/` and the registry is left for the integration pass.
- In the 2160p rain clip the rain is barely visible: each drop's light is spread over a streak of about 70 px, so it reads faint at full frame. The 1640 px plate shows it.
- The clips are large (H.264 crf 16 keeps the grain: 44 MB for 10 s at 720p, 170 to 270 MB for 6 s at 2160p).
