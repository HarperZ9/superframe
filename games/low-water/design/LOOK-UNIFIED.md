<!-- writing-profile: research -->
# One look: walking, talking and fighting

Environment art lead, 2026-10-17. For the systems engineer, the combat engineer and the character
lead. Author direction (2026-10-17, verbatim): "I like the fighting and the lighting; we should try
to better blend the rendering styles and techniques, so that the style does not alternate depending
on what is occuring in game."

## The decision

There is one picture: the painted plate of the place, at the game camera, lit by the place's own
lights. Lamb walks in it, talks in it and fights in it. Nothing switches the renderer, the grade,
the palette, the lens or the type. A fight changes the framing and adds a small paper strip of
notches; it never opens another screen. What changes the look is the night itself (the hour, the
weather, a blackout, a lamp put out), and it changes it the same way in every mode.

Before this page the game had three looks: painted plates when exploring, a separate 640 x 360
dithered arena with placeholder figures for fights (game/engine/combat/arena/draw.mjs), and the
talk panel over an upscaled plate. Stills of the same place in each mode, before and after:
render/stills/modes/.

## Rules

### R1. One frame, one camera

- The view is always the plate view (ui/platecam.mjs, world/camera.mjs) at the plate's `near`
  scale from `place.json` (zoom 1: one plate pixel per screen pixel at 1080p).
- Fights play on the plate at the arena's stage position (`place.json` `arenas[].stage`, the
  `arena:` line). The camera frames the fighters with `frame({ bounds })`; it may pull back past
  `near` to keep everyone in view, never closer than `near`, and it eases in whole plate pixels.
- Talking slides the subject to a third of the width (CAMERA.md). A fight that starts from talk
  keeps that frame until the first exchange, then eases to the fighters.
- Pull-backs (`camera: wide`) show the whole plate; the three painted wide views
  (content/wide_*) may cross-fade in for the arrival, the blackouts and the dawn minute.

### R2. One lighting model

- **The plate is the light.** Each place's variant (hour and weather) was painted from the place's
  own light list. That list ships in `place.json` `lights[variant]` (position, kind, intensity,
  reach, group), so figures, sight, stealth and effects are lit by the same lamps that lit the
  paint. Fight ground carries the same light as a grid (`content/<plate>/arena-<id>.json`
  `light[variant]`, 0 to 1 per cell, shadows included); the fight's sight rule and the stealth
  layer read it instead of a per-place constant.
- **Kinds.** Sodium (low-pressure, orange, kills colour: figures go to the sodium value ramp),
  paraffin (2700 K, true colour), white (4100 K arcs and the lamp room's arc), sky (day). A light
  added at run time (a carried lantern, Mother's beam, a struck match) uses one of these kinds and
  the same falloff (intensity over distance squared, cut at reach).
- **Direct against ambient.** Every place is a balance of a few direct sources against a cold
  ambient lift (the grade's violet `lift` per slot, render/grade.mjs). Run-time light adds to the
  direct side only; nothing at run time raises the ambient.
- **Time slots and weather.** Eight slots key the grade (midnight, predawn, dawn, morning, noon,
  golden, dusk, night). A place changes variant when the night crosses a boundary (rain at 01:30,
  frost at 04:10, dawn at 06:00): the two plates cross-fade over 20 game seconds. A fight in progress
  does not hold the change back; the light changes under the fighters as it would under walkers.
- **Fog, rain, tide** stay the run-time passes they are (game/look.mjs) and are applied after the
  plate and the figures, the same in every mode. Water stands at the tide's height on the plate
  (harbour plates: `y = -3.2 + (tide + 0.3) / 1.72`, see the arena files).
- **Blackout.** The plate cross-fades to its dither plate (`dark.png`) through the Bayer 8
  thresholds (a pixel switches when the fade passes its threshold), and at the same instant the
  figures and effects switch to dither shading (R3). Back on, the reverse, with the sodium waking
  pink then orange as the script says.
- **The Gut** is palette-locked: figures, effects and HUD tints in the Gut are mapped to the
  palette's ramps (web/shaders/palettelight/palette.mjs); nothing outside it appears there.

### R3. Figures in the plate's style

- Path A of characters/PIPELINE.md, lit by `place.json` `lights[variant]` (the nearest four or so by
  contribution, with the dominant lamp casting the self-shadow and the lamps behind giving the
  rim).
- Under sodium: the sodium value ramp. Under paraffin and white: true colour, banded into the
  painted value steps. In a blackout: the dither (four tones, ink violet-black to paper, Bayer 8,
  screen-anchored, at the plate's half-size pixel). In the Gut: the palette's ramps.
- Ink: the plates' ink colour (26, 17, 24 in display values, a dark violet-brown, never black),
  about 2.2 px on the silhouette at 1080p and lighter on folds, as render/v2/post2.mjs inks the
  plates.
- Size: from `pxPerMetre`; a person is about 132 px on the quay and about 300 px in rooms.
- Contact shadow under every figure, multiplied into the plate, its softness from the dominant
  light's distance. Figures are hidden behind painted geometry through the world buffer
  (`geo-pos.f32`, half size).

### R4. Values

- The darkest value on screen is the grade's ink violet (about 6 % lightness), never pure black.
- A lit pool and the dark pocket beside it differ by at least three stops; a place must have both
  inside any 1920 x 1080 window (this is what makes stealth readable).
- Figures live in the middle values: no figure's lit side brighter than the lamp pool it stands in,
  no figure's shadow side darker than the pocket around it. The player is never outlined, glowed or
  tinted to stand out; Lamb reads by the rim from the nearest lamp and by value design (CAST-SHEETS).
- Lamp heads, windows and flames are the only clipped whites.

### R5. Effects are painted light

- **Hit flash.** One brush dab at the contact point, 3 frames at 60 Hz, in the colour of the light
  the fighters stand in (orange under sodium, gold under paraffin, white on the hill, paper in a
  blackout), with an ink rim on its first frame. No full-screen flash, no colour the place does not
  already have.
- **Catch (parry) star.** The engine's lens starburst (web/shaders/lens: the star table at the
  plan's f-number), placed at the catch point as a bright source and mixed with the player's lens
  settings exactly as the plate's `flare` layer is (flash-safe halves it). Streak and halo follow the
  plate's layers too.
- **Knockdown.** Three or four strokes of the ground's own value thrown from the body (mud dark,
  stone mid, frost pale), plus a splash in the water's reflection colour when wet. No dust clouds,
  no blood (grotesque, never gory).
- **Lamps cut, sluices, snares** change the plate's light: a cut lamp's head goes dark and its pool
  is multiplied down by the lamp's share of the light grid; a flood raises the water pass; a sprung
  snare is a painted rope prop that moves.
- **Camera shake** at most 2 plate pixels, snapped; no slow motion, no zoom punch, no grade change
  on a hit.

### R6. What changes in a fight, and what must not

| Changes | Must not change |
|---|---|
| Framing (fight bounds, R1) | The plate, its variant, the grade, the palette |
| A paper strip of Standing and Breath notches at the bottom left, in the talk panel's style | The type (the talk panel's faces and sizes), the paper and ink colours |
| The talk-exit offer slides in where the talk panel opens | The lens settings and layers |
| The clock runs at combat rate | Fog, rain, tide and wind keep running |
| Props in reach show a small paper tag on hover | Figure shading model, ink, sizes |
| Barks appear as talk lines in the panel's voice style | Light: only props and the night change it |

### R7. UI on paper

- Every panel (talk, offers, the fight strip, the daybook) uses the talk panel's paper, ink and
  type. Panels never cover the fighters: in a fight the strip sits at the bottom left, below the
  camera's fight bounds.
- No HUD floats over figures except the hover tag of a prop in reach.

## What the plates now carry for this (content/<plate>/)

- `place.json`: `near`, `pxPerMetre`, `camera` (orthographic), `variants` with hour and weather,
  `lights[variant]`, `marks` (spots, hides, exits, lamps, paths), `walk`, `footing`, `arenas`.
- `arena-<id>.json`: fight ground sampled from the painted world on a 1 m grid in the combat
  engineer's format (rows, legend with surface and height, solid cells under walls, benches and
  barrels), lights and anchors from the place's lamps and rig spots, spawns on open ground, exits,
  the stage line, and the light grid per variant. Made by render/tools/arena_from_plate.mjs.
- Act 2 plates were built on the combat arenas (world x, z = arena x, z), so their arenas and the
  paint agree by construction; Act 1 arenas are re-derived from the plates (quay, floor, gully,
  brine, weigh, lamp, gut, dogs, mole).

## Owners

Systems engineer: R1, R2 (cross-fades, blackout dissolve, the light grid read by sight and stealth),
R6 and R7 in the shells. Combat engineer: R5 and the light grid in the fight's sight rule; adopt or
reject the derived arenas. Character lead: R3 and R4 for the figures. Look work: the plates, the
light lists and grids, the effect stills (render/stills/modes/), and checking each against these
rules.
