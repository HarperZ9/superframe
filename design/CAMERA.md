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

## Correction, 2026-10-17

The first version of this page gave "about 100 to 110 px per person at 1080p" beside "2.25 times
closer". Those disagree: the px figure was the character lead's, measured on 720-line plates. The
ratio is what was meant. The quay stays at 2.25 (`camera-outdoor`), which gives about 88 px in a
720-line view and about 132 px at 1080p, the bottom of the clean-room spec's range. Pointed out by
the systems engineer after building the camera.

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

A shaking view never hides a telegraph. The layers move as one, so a tell inside the view stays on
its body; only the view's edge can hide it. The shake is therefore clamped so that no showing tell
point comes within 8 px of the edge, and a punch that would push a tell there is skipped. Both rules
are covered by `engine/tests/fightcam.test.mjs`.

Correction, same day. The first rule was a flat 3 px cap on the shake while any tell showed. The
combat engineer's frame-by-frame capture (combat/capture/feel5) showed that in a two-opponent fight a
tell is nearly always up, so every light string was held to the 3 px cap and Lamb's light strikes
measured 1.2 to 1.4 px, inside the quiet-moment noise (median 1.2 px). The edge clamp replaced it. In
the systems engineer's own test fight no tell showed during an impact under either rule (per-contact
peaks 4.5, 6.4, 4.5 and 6.4 px both times), so the change is confirmed by the tests and awaits the
combat engineer's recapture.

Setting: **Camera shake** full, reduced (40 %), off. Off, and calm mode, turn both treatments off;
hit-stop stays.

Limits. Chosen from frame captures and logs, not from a player playing at speed. The framing's own
easing (about 2 px a frame, and an 11 px step when the fight's bounds change) is separate from the
impact camera and is not changed here.
