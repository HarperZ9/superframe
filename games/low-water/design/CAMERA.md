<!-- writing-profile: research -->
# The camera: decision

Director, 2026-10-17. For the systems engineer, the character lead and the look work. Asked by the
character lead after the skinned 3D figures went in (raw-native#171).

## The decision

**Accepted: bring the camera closer.**

| | Today | Decision |
|---|---|---|
| Lamp Quay | Whole plate in view; a person about 40 to 50 px tall in a 720-line view | **2.25 times closer**: about 88 px per person in a 720-line view, about 132 px at 1080p (the bottom of the clean-room spec's 130 to 160 px at 1080p) |
| Rooms (the Brine, the weigh-house, the lamp room) | Whole room in view | **1.75 times closer** |
| Projection | Perspective on painted plates | **Orthographic**, scrolling snapped to whole plate pixels, so painted plates never shimmer |
| Talking | The talk panel covers the right third of the room | While a conversation is open, the camera **slides left by a third** so the speakers stay in view (presentation note 3 in STATE.md) |

## Why

1. **This is a game about people's faces and bodies under bad light.** The writing leans on what
   people do while they talk: Keel's drip, Fennick's jar, Marrow's apron, Wenna's hands. At today's
   framing the true-scale figures read worse than the old cutouts, and two people standing together
   merge into one shape (presentation note 1); at the closer framing they split.
2. **Value design needs size.** Under sodium only value survives (CHARACTERS-ART rule 2). Fennick's
   surplice did not read at quay distance (presentation note 2); at about 100 px it is the largest
   pale shape on the quay, as designed.
3. **The fights need readable bodies.** The Fray is read by telegraphs: a windup, a guard, a step.
   The clean-room spec puts readable combat figures at 130 to 160 px; at 40 px no telegraph reads.
4. **Stealth needs the light to show on people.** A watcher's cone and Lamb's lantern radius are
   only fair if the player can see where the light falls on a body.

## What it costs, and how the cost is met

- **Less of the town in view at once.** The quay becomes a scrolling place rather than a single
  picture. Met by **three pull-back moments** where the camera eases out to the whole plate and
  holds: Lamb's arrival at the mole steps (22:41), the two blackouts (21:38 told, 02:50 played), and
  the dawn minute of colour. These are the protected moments that are about the town, not a person.
- **Tide Runs need to see the water coming.** During a run the camera frames the run's course (the
  gully, the frost on the mole) even if that means pulling back; the water front must always be on
  screen.
- **Plate framing changes.** Plates are re-framed and re-baked for the closer orthographic camera
  (the bake tools already take a camera; the plates' resolution must rise about 2.25 times on the
  quay so a pixel of plate is not magnified). This is look and engine work.
- **Pacing.** Walking on screen takes longer, but the night's clock does not move with walking
  distance: node costs and exit costs set the minutes, and they do not change. Real-time Tide Runs
  and sneaks are tuned in arena metres, not screen pixels, so they do not change either.
- **The painted look.** Closer plates show more brushwork. The look bible's painter must hold at the
  larger plate size; if it does not, the plate is painted at the higher resolution, never upscaled.

## Owners

Systems engineer: the camera (scale per area, orthographic, pixel snap, the talk slide, the
pull-backs as area or event keys such as `camera: wide` on an event or node). Look work: re-framed
plates. Character lead: figures at the new size, and the cast sheets in `design/CAST-SHEETS.md`.

## Play size by measurement, 2026-10-21
The plates were re-baked after this decision, so the fixed scales drifted: at 2.25 the quay showed a person
at 115 px at 1080p, and at 1.75 the rooms showed 300 to 470 px. Every wired area now sets its own camera
from its plate (a person's height in plate pixels at the spawn, times the fit to a 1080-line view), so a
person measures 134 to 137 px everywhere, the decision's own target. Rooms baked close take a camera below
1: the view pulls back past the plate, centred, on the plate's ground colour (world/camera.mjs frame,
ui/platecam.mjs). The pull-back moments and fight framing are unchanged. Measured per area by
game/engine/tools/placeshot.py (report.json, cam.scaleAt x 1.75 m).

## Correction, 2026-10-17

The first version of this page gave "about 100 to 110 px per person at 1080p" beside "2.25 times
closer". Those disagree: the px figure was the character lead's, measured on 720-line plates. The
ratio is what was meant. The quay stays at 2.25 (`camera-outdoor`), which gives about 88 px in a
720-line view and about 132 px at 1080p, the bottom of the clean-room spec's range. Pointed out by
the systems engineer after building the camera.

## Impact shake size, 2026-10-23 (CB8 fixed)

Impact-capture on the quay fight read 15.8 px against T10's 6 px. Bisect (good: 7 px or less) found 63515f2
(keyed shake with a spring) as the first commit over, at 11.5 px; the 15.8 px came from the fight's later blows
(two 0.75 blows on one frame). The 6.4 px record above was measured with the old shake, a 10 Hz swing under a
60 ms decay sampled at 1/60 s, which showed about 0.38 of its nominal 18 px. The keyed shake shows its full
nominal size at frame 3, so the 18 became real, and the spring added on top. The limit on the tell was per layer.

Now: `SHAKE_MAX` is 6 px, the peak of a full-weight blow at 1080p (the 0.75 blow is 4.9, a 0.15 blow 1.6), and
one limit applies to the keyed shake and the spring together: 6 px, or 3 px while a tell shows. Quay fight
capture: 5.3 px peak at frame 200, still by frame 212. The 6.4 px figure above stays as a record of the old
shake. `tests/fightcam.test.mjs` replays the fight's blows and fails above 7 px.

## Combat impacts, 2026-10-21 (supersedes the shipped choice below)

Author, 2026-10-21: "Make it more like No Rest for the Wicked". From the study role's spec
(cleanroom/spec/NRFTW-PRESENTATION-2.md, section 3): the reference has no hit-stop, no zoom punch and no
hit flash; weight comes from a keyed shake, an inertial spring and knockback. Shipped now:
`IMPACT_DEFAULT = "shake"` (the punch stays as `?impact=both`); the shake is keyed (peak at frame 3, a 40%
swing back at frame 7 to 8, rest at frame 12; 15 for a heavier blow; a catch runs 40 frames with a second
swing) with a spring under it (stiffness 300, damping 30, 100 Hz); contact hit-stop is a tuning value,
`FEEL.hitstop` in combat/sim/hits.mjs. Author, 2026-10-21: "2-frame freeze on heavy blows": light contacts
0 frames, heavy and charged blows (and guard breaks and catches) 2, capped at 4 whenever three or more
opponents stand. Measured in the impact capture: peak 9.9 px at frame 2 on the
quay fight's first blows (1080p), the swing back at frames 6 to 7, still by frame 12. Talk exits and fight
outcomes over 20 seeds do not move outside the noise with hit-stop off.

## Combat impacts, 2026-10-17

Systems engineer, for the coordinator and the combat engineer. The author's standard for dashes,
rolls, dodges, parries and combination strikes is that they "feel incredible, and have weight".
The 2-plate-pixel cap of LOOK-UNIFIED R5 is lifted for combat impacts only. Exploring, talking and
sneaking keep the calm camera: the impact camera (`engine/ui/fightcam.mjs`) runs only inside a
fight layer.

**Shipped: both treatments together** (`IMPACT_DEFAULT = "both"` in `engine/ui/fightlayer.mjs`),
with hit-stop as combat sets it.

| Treatment | What it does |
|---|---|
| Shake | Along the blow's direction, amplitude weight^0.7 x 18 px at 1080p (combat's amp 0.15 gives about 5 px, 1.0 gives 18), a damped 10 Hz swing gone in 0.25 s |
| Punch | A zoom of 2 to 4 % about the struck body, in and back over 120 ms, on a hit of power 0.66 or more, a guard break or a catch |

How it was chosen. The same fight (the lamplighters on the quay, "Stand your ground", combat's
pilot playing Lamb) ran once per treatment at 1920 x 1080 with the world loop held and stepped one
frame at a time, so each treatment saw the same blows on the same frames
(`engine/tools/impact-capture.mjs`; stills in `game/capture/impact/`, a frame run in
`game/capture/impact-clip/`). Measured from the logs: shake peaks at 6.4 px and settles below
1 px by 8 frames; the punch peaks at 3.94 % 4 frames after contact and is gone by frame 7.

Why both:

1. Shake alone is small at combat's amps (0.15 to 0.4 gives about 5 to 9.5 px; the test fight peaked at 6.4). It tells the player which
   way a blow went but adds little weight to a heavy one.
2. The punch alone fires only on heavy blows, catches and guard breaks (2 of the 4 contacts in the
   test fight), so a light combination gets no answer at all.
3. Together, every blow moves the view along its direction and a heavy one also closes in on the
   body it struck. The two are short (0.25 s and 0.12 s) and fall inside the hit-stop and recoil,
   so the next exchange starts on a still view.

A shaking view never hides a telegraph. While an opponent's tell shows, the shake is clamped to
3 px, and a punch that would push any tell point within 8 px of the view's edge is skipped. Both
rules are covered by `engine/tests/fightcam.test.mjs`. In the test fight no tell showed during an
impact, so the clamp was exercised by the tests only, not seen in a capture.

Ruling, same day (coordinator): the 3 px cap stays. Light hits get their weight from the 4- and
6-frame hit-stop and the body reactions, not from shake. An edge-only clamp (a22426f) was tried and
taken back in the next commit; it had crossed with the ruling.

Setting: **Camera shake** full, reduced (40 %), off. Off, and calm mode, turn both treatments off;
hit-stop stays.

Limits. Chosen from frame captures and logs, not from a player playing at speed. The framing's own
easing (about 2 px a frame, and an 11 px step when the fight's bounds change) is separate from the
impact camera and is not changed here.

## One exterior angle: the Lamp Quay test, 2026-10-22 (proposal approved, measured choice)

The author approved the art archivist's proposal on 2026-10-22 ("I like the proposal"): one fixed three-quarter
angle for every exterior plate, so neighbours join; a whole-town map plate in Oil and Ink; the closer camera
kept for people and fights. The isometric area maps of the 2026-10-22 references (CATALOGUE.md 70 to 73) were
the model for framing, method only.

**Test.** Lamp Quay's night plate baked three times through bake2 at a 3200 x 1800 window round the quay's own
target, nothing else changed (render/places/quay_camA, quay_camB, quay_camC; plates in render/preview/camtest,
never in content). The pixels a metre were set so a standing person is the same size on all three plates.
Stills: game/capture/camtest-2026-10-22/ (cam*-1080.png, the 1080-line window; sheet-1080.png side by side).

| | A, present | B | C |
|---|---|---|---|
| Yaw, elevation | 26, 30 | 38, 40 | 45, 48 |
| Plate pixels a metre | 80 | 90.4 | 103.5 |
| A 1.75 m person, plate px (1.75 cos e ppm) | 121 | 121 | 121 |
| Ground in one 1920 x 1080 frame (m2) | 648 | 395 | 260 |
| Floor hidden behind a 3 m quay wall (m) | 5.2 | 3.6 | 2.7 |
| A step's tread against its riser, on screen | 0.96 | 1.40 | 1.86 |

**Checks.**
1. People at 130 to 160 px: all three plates hold a person at 121 plate px, and the game's per-area camera
   brings every person to 134 to 137 px (section above), a zoom of about 1.12 on each. Equal by construction;
   no candidate fails.
2. The mole steps and the incoming water for Tide Runs: B and C read the mole steps as a stair (treads wider
   than risers on screen) and hide less of the floor behind the quay wall. C sees 60% less ground in a frame
   than A at the same person size, so a Tide Run sees the water coming much later; B gives up 39%, which the
   run camera's existing pull-back covers. A hides 5.2 m of floor behind the wall, the most.
3. Brushwork: the painter's radii are screen pixels, so stroke size is the same on all three. In C the roofs
   become the largest planes in the frame and read as flat dark masses with few strokes; the facades, where
   the lit windows and the paint language carry the place, shrink. B keeps the facades and adds the roofs'
   slope without losing them. Seen in the stills; not measured.

**Choice: B, yaw 38 degrees, elevation 40 degrees,** pixels a metre scaled by cos 30 / cos 40 from a plate's
present value (1.13) so people keep their size. It passes all three checks; C fails check 2 for Tide Runs, and
A keeps the floor hidden behind the walls that the steeper view is meant to open. The game's camera code is not
changed: the angle is a plate bake setting. First applied to the Quota slice's exterior plates
(render/places/_q2.mjs EXTERIOR_CAM). Not measured: Tide Run timing on a B-angle quay (the quay plate itself is
not rebaked here).
