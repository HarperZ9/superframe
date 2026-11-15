<!-- writing-profile: research -->
# Low Water: render target

Rendering lead, 2026-10-21. The author's direction (verbatim, 2026-10-21): "Make it more like
No Rest for the Wicked", then "The art style, and rendering is really cool. We can do much better."
Art direction A, "Oil and Ink" (author, 2026-10-18). The reference is read only through the clean-room
spec `cleanroom/spec/RENDER-NRFTW.md`; nothing here comes from the game's files.

## 1. What the reference does, in one paragraph

Its paint lives in painted textures and painted light: most ground pools are projected light shapes
that fade over the last quarter of their reach; fires pair a hard 90 degree spot with a short point;
the player carries a light 2 m up with a 12.5 m reach that adapts to the scene. Fog stops at about
half opacity and runs warm by day and saturated blue by night. The grade lowers contrast and makes the
darks in the lighting, with blue shadows and a hot penumbra at dawn and dusk. Figures get their own key
and rim light and no outline. Four discrete times of day per area. Stability comes from temporal
anti-aliasing with a long history; there are no brush strokes anywhere, so nothing painterly can
shimmer, and nothing painterly moves with the figures either.

## 2. Targets

Each target names its measure. "Play size" is the quay camera at 1920 x 1080 (a person about 130 to
190 px tall). Measured by `game/engine/paint/tools/` (stability, readability, timing).

| # | Target | Measure | Pass |
|---|---|---|---|
| T1 | Painted figures, one look in every mode | The same painter and palette run walking, talking and fighting (one code path) | Mode stills show the same stroke scale and value planes |
| T2 | Object-anchored strokes, no shimmer | A figure walking 2 s at 60 fps: the stroke a bind-space point belongs to, frame to frame; and the painted value change at that point beyond the change in its unpainted shading | Stroke kept for 98% or more of tracked points; flicker (excess change over 6/255) on 2% or fewer. The screen-anchored control must fail both |
| T3 | Stroke scale tied to the screen | Stroke length in screen pixels per region at play size | Figures 2 to 7 px (faces finest), always finer than the plates' 11/6/3.5/2 px brushes on the coarse end (LOOK rule 4) |
| T4 | Coarse to fine with region budgets | Strokes per region per frame, layers per region | Face and hands 2 layers at the finest scale; coats 2 layers mid; boots and hats 1 coarse |
| T5 | Painted value planes, palette per place and hour | Value planes per stroke from palette data keyed to the eight slots; blend continuous | Palette at any hour is a smooth key blend; largest step per game minute under 1 delta E |
| T6 | Pigment-space mixing | Glazes and stroke-over-stroke laid by Kubelka-Munk per channel, not RGB lerp | Test chart: blue and yellow paint make green where an RGB average makes grey; complementaries make a dark warm neutral; a glaze keeps the base value. (First draft asked for chroma kept on complementaries; the model gives less, as real paint does, so the target was wrong and is replaced.) |
| T7 | Light pools carried by lamps and the player | Lamb's lantern pool on the plate's ground: reach, falloff, painted bands | Reach 4.5 m, (1 - d/r)^2 falloff with the last 25% faded (as the reference fades its planes), three painted bands, world-anchored edges |
| T8 | Aerial perspective | Figures fogged to the plate's own distance haze; never past half | Figure-to-ground mean colour difference does not grow with depth |
| T9 | Wet ground reflects the pools | Lamp and lantern reflections on wet ground, streaked down the screen, broken by world-anchored ripples | Present for every lamp in view on wet variants and wet footing; stable under a camera pan |
| T10 | Readability at play size on dark plates | Figure-to-surround mean luminance ratio, and edge contrast at the silhouette (3 px rings) | Ratio inside the visual check's band 0.25 to 1.6; edge contrast 0.25 or more on the floor and quay plates |
| T11 | Frame time | Painter per figure and the light layer per frame, headless CPU Chrome, 1280 x 720 | Painter 4 ms or less per figure; light layer 6 ms or less per frame |

## 3. Where Low Water goes past the reference

- **Strokes that belong to the body.** The reference has no strokes; its paint is texture. Ours are
  brush marks stored in each figure's bind space, so they ride the body through a walk, a talk and a
  fight and never swim (T2). That is a painted figure the reference cannot show.
- **Paint mixed as paint.** The reference mixes every light and tint in RGB. Ours glazes shadow and
  light colours in a pigment model, so a sodium glaze over a violet shadow goes to a painter's warm
  dark, not to grey (T6).
- **Palettes on a running clock.** The reference has four set times per area. Ours keys eight slots per
  place and blends them continuously with the night's clock (T5).
- **Wet ground that answers the light.** The reference has wetness and screen-space reflections, at
  half resolution with an edge cut-off. Ours reflects every lamp and the lantern in the painted ground as
  brushed streaks, anchored to the world (T9).

## 4. Where it does not, yet

- The plates are baked paintings. Live light on them is laid over the painting, not relit from albedo,
  so a pool brightens what was painted rather than revealing new colour.
- The reference has 22,000 authored lights, cookies and fog cards per area and a full lighting
  preset system. We have one place file per plate with its lights.
- No capture of the reference ran (the GPU belongs to training); figure, stroke and pool numbers on
  its screen are unknown, so "go past" is judged on capability, not on a side-by-side frame.

## 5. Measured, 2026-10-21 (first pass)

Tools in `game/engine/paint/tools/`; stills in `game/capture/paint/` (git-ignored): `final-before/`
(`?paint=0&light=0`, the drawer as it was), `after/` (painter and light), `glyph5/` (glyph mode),
`stability-final.json`. Headless Chromium with the GPU off: every canvas is drawn on the CPU, so the
times compare builds on this machine and are not the game's frame rate.

| # | Result | Verdict |
|---|---|---|
| T2 | Lamb walking 1.5 m at 60 frames a second, then turning a full circle (150 frames, about 44,000 matched bind points). Painter: stroke kept 98.5%, flicker 0.67%, painted jumps over 6/255 on 1.2% of points against 2.4% for the unpainted drawer. Screen-anchored control: kept 56.6%, flicker 22.9%. | Pass; the control fails as it must |
| T3 | Levels at 11, 7, 4.5 and 3 px on screen; quay cells 0.088, 0.063, 0.031, 0.022 m | Pass by construction; not measured on screen |
| T5 | Largest palette step per game minute under 0.01 (linear) on four places | Pass (test) |
| T6 | Test chart passes (blue and yellow make green; complementaries a warm dark; glazes keep value) | Pass (test) |
| T7 | Pool built as specified; drawn in the light layer | Built; judged by eye |
| T9 | Lamp reflections where the reflected ray finds a lamp: on the quay the sodium heads' images fall past the quay's lip onto the floor below, so on the quay itself they show only near lamps on its far side | Built; weak on the quay views captured |
| T10 | Figure-to-surround ratio, eleven figures in five views: before 0.23 to 1.56 (two figures under the band's 0.25), after 0.30 to 1.56 (all inside). Silhouette contrast along the edge profile, mean 0.52 before, 0.51 after; better in talk and the Brine, worse in the rain (the wet sheen and the lantern pool lift the ground behind dark coats) | Band met; edge contrast not improved overall |
| T11 | quay-talk, 1280 x 720: frame 62 ms before, 75 ms with the painter, 80 ms with painter and light; painter 2.7 ms a figure, light layer 1.0 ms of its own (the rest is compositing three blended canvases on the CPU), glyph layer 21 ms. Room figures are 2.5 times larger on screen and cost 15 to 45 ms each | Painter and light pass at play size; rooms and glyph mode do not |
| Glyph | Still camera, five seconds, world clock held, floor plate: 2 of 9,525 ground cells changed (animated water) | Near; the strict rule fails on animated water |

Faces: Lamb's wide brim hides the face from this camera in every view; the lamplighters' faces now
read as a warm plane with a dark eye band. Not measured.

### Second pass, 2026-10-21 (author's answers: rims both, lantern on the ground only, glyph mode further, full quality)

- T2 rerun on the value-neutral painter: kept 98.6%, flicker 0.71%; control kept 56.9%, flicker 21.6%.
- T10: the painter no longer brightens a figure on average; the visual check's ratios run 0.36 to 1.38
  in every view (the unpainted drawer's 0.43 to 1.61). Visual check 8 of 8, twice, controls failing.
- Rims: the warm rim only toward the lamp, yielding wherever the drawer's cool back rim already lifts
  the edge; no edge pixel carries both (render/PROGRESS.md step 30).
- Faces: a catch-light from the ground on face planes under a brim (step 31); judged on stills.
- Glyph mode: 0.47% of ground cells change glyph per frame while the camera follows a walk, against
  13.1% for a screen-anchored grid; figure cells carry 2.9 times the ink of the ground round them.
- Frame time per scene: render/PROGRESS.md step 34.
