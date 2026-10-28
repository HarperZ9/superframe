<!-- writing-profile: research -->
# lib/body: joint limits and coupling

## PREREG (2026-10-28, written before any code in this folder)

Source: STUDY-MAP.md section 2, intake rows A 8, 10, 11, 23, 24, B2 contrapposto row. Figures quoted from the intake or from memory carry a confidence label. Every number below is fixed before the model exists.

### Knee and hip

Model: the tibia hangs from four inextensible cords (medial and lateral collaterals, anterior and posterior cruciates). Each femoral attachment sits on the far side of the flexion axis from its tibial attachment in the side view, so every cord is at its longest at full extension and slackens as the knee bends. That is geometry, not a fitted curve. The attachment coordinates are authored, set near textbook positions. Screw-home is an authored coupling path: 10 degrees of tibial outward turn at full extension (moderate confidence), unwinding over the last 30 degrees of extension (moderate confidence). Hip turn limits are 35 degrees inward (intake row A 23) and 45 degrees outward (from memory, moderate).

- **K1 lock.** At 0 degrees of flexion the cords allow no axial turn beyond 1e-6 degrees either way. For every flexion under 5 degrees, the foot's turn against the kneecap's locked line (coupled unwind plus the widest cord-allowed turn) stays within 2.0 degrees. Pass: worst case at most 2.0 degrees on a 0.05 degree grid.
- **K2 opening.** The cord range grows monotonically with flexion from 0 to 90 degrees. Its total at 90 degrees is a calibration target (30 to 60 degrees, moderate confidence), not a prediction, because the attachment eccentricity is tuned to it.
- **K3 sign.** The collaterals block outward turn and the cruciates block inward turn. That is a known anatomical fact the geometry has to reproduce; the tuning does not touch it. Pass: the binding cord at each end of the range is of the predicted family at 30, 60 and 90 degrees.
- **K4 routing.** A foot-turn request of plus or minus 30 degrees at 0 degrees of flexion is carried by the hip to within 2 degrees. At 90 degrees, the knee carries at least 10 degrees of a 30 degree outward request.
- **Planted answer K5.** Twelve rig poses, six of them with a known straight-leg foot twist (3, 5, 8, 12, 20 and 30 degrees at flexion under 5 degrees), six clean. The checker must flag exactly the six planted ones.
- **Control C1 (must fail).** A plain hinge rig with a free twist channel at the knee takes a 30 degree foot turn at 0 degrees of flexion through the shin. The foot-turn check must flag it, with a deviation of 30 degrees.

### Jaw

Model: the mandible is rigid and its condyle centre is a point. Phase 1 is pure rotation about the condyle up to 12 degrees (moderate confidence; about 20 mm of incisor opening). Phase 2 adds forward and downward travel of the condyle along the articular eminence: an arc whose slope runs from 40 degrees down to 10 degrees over 16 mm (authored, moderate). Travel is coupled linearly to rotation beyond the phase 1 limit. The coupling factor is set so the full opening at the incisors reaches 50 mm (moderate). Landmarks are in millimetres, condyle at the origin. The neck front and the soft tissue under the chin (8 mm) are authored landmarks.

- **J1.** For phase 1 openings, a circle fit to the incisor path has an RMS residual under 0.01 mm. Its centre lies within 0.1 mm of the condyle.
- **J2.** A single circle fit to the whole two-phase path, 0 to 50 mm, has an RMS residual over 1 mm.
- **Planted answer J3.** The break detector sees only the incisor points, never the angles. On paths with a planted phase 1 limit of 12 degrees and of 8 degrees, it must recover the planted break opening to within 0.5 mm.
- **J4.** At 50 mm of incisor opening, the two-phase jaw keeps the chin's soft tissue in front of the neck line, with positive clearance.
- **Control C2 (must fail).** A pure hinge jaw opened to 50 mm. Its path keeps a circle residual under 0.01 mm everywhere, so the detector finds no break. Its chin crosses the neck line, with negative clearance. Both parts must show.
- **Noise floor.** With 0.1 mm of seeded jitter on a hinge path, the detector reports no break when its tolerance is 5 sigma.

### Contrapposto

Model: frontal stick figure in centimetres. The centre of mass comes from segment mass fractions (Winter's table, from memory, moderate). A seeded generator builds standing poses by physics. Weight goes onto one leg, and the pelvis rises on that side. The upper body shifts until the centre of mass sits over the support ankle, and the shoulders tilt the other way. Keypoint jitter is 0.5 cm.

- **P1.** Of 200 generated contrapposto poses, at least 90 percent classify as contrapposto, with the centre of mass inside the support foot (ankle plus or minus 4.5 cm).
- **Control C3 (must fail).** Of 200 poses with both girdles tilted the same way, at least 99 percent are flagged as same-direction.
- **Control C4 (must fail).** Of 200 poses whose centre of mass falls more than 8 cm outside the support ankle, at least 99 percent are flagged as off-support.
- **Shuffled control C5.** Against labels shuffled across the pooled 400 poses (P1 plus C3), the checker's agreement is between 40 and 60 percent.
- **Structureless control.** A level, symmetric stance classifies as level, never as contrapposto.

What this preregistration does not cover: no real labelled pose set exists here, so P1 tests the checker against the generator's own physics, not against people. That limit stays on the spec sheet.

## Results (2026-10-28, measured after the build; numbers from `node tools/body-spec.mjs`, file `out/body/spec.json`)

| Prediction | Threshold | Measured | Verdict |
|---|---|---|---|
| K1 lock at 0 deg | under 1e-6 deg both ways | 0 and 0 | held |
| K1 worst foot turn under 5 deg flexion | at most 2.0 deg | 0.78 deg (0.74 of it is the coupled screw-home unwind; the cords allow 0.11 out and 0.06 in at 5 deg) | held |
| K2 monotone growth, total at 90 deg | calibration target 30 to 60 | monotone; 39.3 deg (23.7 out, 15.6 in) | held (calibration, not a prediction) |
| K3 binding cords | collaterals outward, cruciates inward at 30, 60, 90 | LCL or MCL outward, ACL or PCL inward at all three | held |
| K4 routing | hip within 2 deg of a 30 deg straight-leg request; knee at least 10 deg at 90 deg | hip 30.0 and -30.0; knee 13.7 at 90 deg (23.7 of cord turn minus the 10 deg unwind) | held |
| K5 planted answer | flags exactly the 6 planted | 6 of 6 flagged, 0 of 6 clean flagged | held |
| C1 plain hinge (must fail) | flagged, deviation 30 | flagged `lock` and `cord`, deviation 30.0 | failed as it must |
| J1 phase 1 on one circle | RMS under 0.01 mm, centre within 0.1 mm | RMS 1e-14 mm, centre at the condyle to 1e-13 mm | held |
| J2 whole path off one circle | RMS over 1 mm | RMS 0.475 mm (max 1.19 mm) | **failed** |
| J3 planted break, 12 deg | within 0.5 mm | planted 19.70, found 19.70 | held |
| J3 planted break, 8 deg | within 0.5 mm | planted 13.15, found 13.15 | held |
| J4 two-phase chin clearance at 50 mm | positive | +10.0 mm | held |
| C2 pure hinge (must fail) | residual under 0.01, no break, clearance negative | residual 4e-14 mm, no break, clearance -5.8 mm | failed as it must |
| Noise floor | no break at 5 sigma, 0.1 mm jitter | no break (also at 0.05 and 0.2 mm) | held |
| P1 contrapposto | at least 90 percent | 98.0 percent (196 of 200; 4 read level) | held |
| C3 same-direction flagged | at least 99 percent | 98.5 percent (197 of 200; 3 read level, 0 read contrapposto) | **failed** |
| C4 off-support flagged | at least 99 percent | 100 percent | held |
| C5 shuffled labels | 40 to 60 percent | 51.5 percent | held |
| Level stance | level | level | held |

What the two failures say:
- **J2.** A circle with a free centre absorbs most of the glide. The two-phase incisor path sits within 0.475 mm RMS of some circle, and that circle is not centred on the condyle. "Leaves the circle" holds only against the circle about the condyle, which the phase 1 fit finds. The detector (J3) gets the break right because it fits a growing prefix, so it never lets the circle refit to the whole path. Lesson: test the departure against the phase 1 circle, never against a best-fit circle of the full path.
- **C3.** Jitter of 0.5 cm on a 38 cm shoulder line adds about 1.1 deg of angle noise. The generator draws shoulder tilts from 2 deg, so the smallest same-direction tilts fall under the 1 deg dead band and read as level. None was accepted as contrapposto: the miss is a missed flag, not a false accept. The three misses measured shoulder tilts of 0.99, -0.53 and 0.24 deg, all inside the dead band, with pelvis tilts of 6 to 9 deg. Power was not measured separately. The smallest tilt this design flags reliably is unknown until a tilt sweep runs.

Post-hoc, labelled as such: a break planted at 10.1 deg, off the 0.25 deg sampling grid, is found at 16.43 mm against a planted 16.59 mm (0.16 mm early). A false-accept control added after the first run: cords 0.5 mm lax let the straight knee turn 3.1 deg out and 4.8 deg in. The lax cords accept that pose, and the lock gate flags it.

Post-hoc, from the adversarial verify pass (2026-10-28, not preregistered, no test pins it): on the two-phase path with seeded jitter and the tolerance at 5 sigma, the detector still finds the 12 deg break (planted 19.70 mm) but late: 19.80 at 0.05 mm jitter, 21.10 at 0.1 mm, 25.80 at 0.2 mm. Under noise it misses the 0.5 mm accuracy that J3 holds on clean paths. The shuffled control C5 also passes for a checker that calls every pose contrapposto (agreement 50 percent), so C5 rules out label leakage only; C3, C4 and the level stance are the controls that reject a trivial checker.

Emergent, not preregistered: once the centre of mass is solved over the support ankle, the neck lands within 3 cm of the plumb line over that ankle. That is the artist's rule (pit of the neck over the standing foot), and the generator never encodes it.

## Spec sheet

| | Knee and hip | Jaw | Contrapposto |
|---|---|---|---|
| Range | flexion 0 to 140 deg (authored limit); hip turn 35 in, 45 out | openings 0 to 50 mm at the incisors; any 2D path for the detector | frontal stick poses with 15 named keypoints, in centimetres |
| Resolution | cord edges found by bisection to 1e-12 mm of stretch; lock check on a 0.05 deg grid | path sampled every 0.25 deg; break located to one sample | tilt dead band 1 deg; support base plus or minus 4.5 cm |
| Accuracy on planted answers | 12 of 12 rig poses classified right (K5) | breaks at 12 and 8 deg recovered exactly; 0.16 mm off the grid (post-hoc) | 98 percent of 200 contrapposto; 98.5 percent of 200 same-direction flagged; 100 percent of off-support |
| Noise floor | none applies (the model is deterministic) | no false break at 5 sigma with 0.05 to 0.2 mm jitter | shuffled labels give 51.5 percent agreement; a level stance reads level |
| Calibration | eccentricities tuned to a 39.3 deg total at 90 deg (target 30 to 60, moderate) | coupling 0.866 mm per deg sets full travel at 50 mm | none: no labelled human set exists |
| Known blind spots | attachment points are authored. Screw-home is an authored path, not derived from condyle shape. The real PCL tightens in flexion, but here every cord slackens. No rolling or gliding of the condyles (the cam of intake row A 8). The ankle is fixed | rigid condyle point. The eminence arc and the neck line are authored, so the hinge collision (C2) depends on where the neck line sits, a moderate-severity control. No left-right asymmetry and no lateral jaw shift | generator and checker share one author, so P1 tests the checker against its own physics. Frontal plane only: no twist of the ribcage against the pelvis, which the B2 drawing marks |

## Files

- `knee.mjs`: cords, axial range, screw-home path, foot routing, rig-pose checker, side-view leg.
- `jaw.mjs`: two-phase mandible, eminence arc, coupling solve, incisor path, neck clearance.
- `fit.mjs`: circle fit (algebraic then geometric) and the prefix break detector.
- `pose.mjs`: segment centre of mass, contrapposto checker, physics-built pose generator and labelled sets.
- `measure.mjs`: shared measures for the tests and the spec tool. `plate.mjs`: the demo plate spec.
- Tests: `tests/body-knee.test.mjs`, `tests/body-jaw.test.mjs`, `tests/body-pose.test.mjs` (26 tests).
- Tools: `node tools/body-plate.mjs` writes `out/body/body-plate.png` (3840 x 2680); `node tools/body-spec.mjs` writes `out/body/spec.json`.
