<!-- writing-profile: research -->
# Light in The Quota

Light lead, 2026-10-21. The one light model that both styles read, the painted (oil) and the glyph (type).
Code: `game/engine/light/`. Interface agreed with the style leads: design/state/light.md, "Light lead's interface".
Author direction (2026-10-21, verbatim): "Continue expanding deeply on the painting techniques and brush
expressions an the lighting on the characters and in the world; also improve the ASCII version in tandem.
Perhaps two rendering techniques of the same story, so the game is played in multiple styles."

## 1. What the light says

The Quota follows one district for about 120 years. The light tells the player the year before anyone
speaks, and it tells them who has means. Three rules carry the story:

- **Light costs something.** Every flame in eras 1 to 3 burns fuel somebody paid for. A full table sits under
  the era's table light, a poorer one under a weaker one, and a table with nothing left sits by the embers or
  by the window alone (`eras.mjs tableLight`). Nobody is lit for drama's sake.
- **The state's light never goes out.** The requisition's carbide lamps, the militia's brazier, the export
  train's headlamp and, in era 5, the police blue do not decay with the street's stock. They are the hardest,
  whitest light on screen while the houses round them go dark.
- **Who sits in the light, who sits in the dark.** At a table the key is the table's one source. Whoever
  sits with their back to it is lit from behind (a rim) and by the room's bounce, never by a light that is
  not there. A figure in the dark stays dark and stays legible (section 4).

## 2. The eras and the hours

The clock is continuous: the sun and moon over the Tarn (latitude 50.5 north) at the era's season, with
the named hours as weights that fade into each other (`clock.mjs`). Golden hour is the sun between -1 and
6 degrees, the blue hour between -4 and -9, night below -12. Each source's colour comes from physics:
a black body at its temperature or a spectral line, through the CIE 1931 matching functions
(`kelvin.mjs`, Wyman, Sloan and Shirley 2013 fit, high confidence on the formula).

| Era | Season (day of year) | Air | Street | Table | Rich | Poor | Authority | The night |
|---|---|---|---|---|---|---|---|---|
| 1, The Exchange | Harvest, 240 | Chaff haze 1.5 | Gas mantles, white with a green cast | Paraffin 1950 K | Wax candles 1850 K | Tallow 1700 K in the barns | Gas | Dark between the mantles |
| 2, The Quota | Late February, 58 | Clear and cold 0.7, snow 0.8 | None lit | Tallow | Paraffin (the Directorate pays) | Rushlight 1750 K | Carbide 3100 K; the train's headlamp 2900 K | Moon on snow; the requisition's lamps |
| 3, Allocation | October, 290 | Coal smoke 1.3 | Bare bulbs 2600 K | Bulb | Bulb | Candle (the mains fail at dusk) | Bulb | Brownouts |
| 4, The Closure | November, 315 | Overcast 0.6 | The first sodium | Bulb | Bulb | Bulb | Fluorescent 4100 K plus mercury lines | Dark by five |
| 5, The Clearance | March, 75 | 1.0 | Sodium (a 2050 K body with the 589 nm line) | Bulb | Bulb | Phone glow 6500 K | Police blue, 465 nm, strobing in pairs | Never black: sodium sky glow |

What each hour means in era 2, the slice's era:

- **Dawn, 07:50** (the square from the bell tower): the sun about 10 degrees up in the south-east, long blue
  shadows on the snow, the relief kitchen's lamp still lit. The queue is lit from one side only.
- **Day, 10:00 to 15:00**: a low frost sun, never above 32 degrees in late February. Hard shadows, cold fill
  off the snow (the ground bounce rises with snow: `clock.mjs skyAt`).
- **The blue hour, about 17:00 to 17:40**: the sky lighter than the night by more than twice; the first
  windows lit; the carbide lamps already hard white against it.
- **Night**: the moon on snow, a few windows, the carbide and the brazier. The square is mostly unlit,
  by design: no street lamp burns in the famine winter.

## 3. Interiors by a single source

Each kitchen has one ruling source, named per plate in `places.mjs` (the bake calls most of them paraffin):

| Plate | Source | What it says |
|---|---|---|
| q_haldane (dawn) | The embers, kept in; the grey window | Nothing to burn. The family is lit by the window and the last of the fire |
| q_haldane_coda (dusk, a week later) | Embers lower, one tallow dip | One less bowl; the room darker than the first |
| q_furrowe_kitchen (evening) | The range and the paraffin lamp | A table that can still pay for oil |
| q_brack_kitchen (evening) | The stove and a tallow candle | Will's house: enough, just |
| q_granary (night) | The carbide lamp over the door, the militia's brazier, the gate lantern | The state's hard white light on the door; the villagers come in from the dark |

Fires breathe and candles gutter (`flicker.mjs`); a fire's size follows its household's portion and food
(`decay.mjs`). Frost on the snow melts in a ring round a fire and leaves the ground wet there.

## 4. Character light

A three-point model adapted per scene (`figure.mjs figureRig`), in the shape the character renderer already
takes (`characters/render/shade.mjs light()`), so the drawer and the portrait painter can use it as is:

- **Key**: the scene's real strongest source at the head: a lamp, a fire, the sun or the moon, after decay,
  flicker and the sun's shadow at the feet. With nothing stronger than the sky, the sky is the key.
- **Fill**: the room's bounce, in the colour of the light on the ground at the feet, from the viewer's side.
  It is held to at least a quarter of the key (4:1, a portrait painter's limit for a face that reads). With
  the key behind the figure the fill comes three-quarters on from the key's side at half the key, so the
  face keeps a turn of light.
- **Rim**: the strongest light behind the figure as the camera sees it. With none, a thin cool edge from the
  sky's colour at a floor strength (`RIM_FLOOR`), only to part figure from ground.
- **The face-light terminator**, handed to both styles: the direction across the face from dark side to lit
  side in screen space, its softness (the source's size: the sun 0.12, a candle 0.35, a window 0.65), and
  the key-to-fill ratio.
- **Catch-light**: a point in each eye offset toward the key, strength by the key, none when the key is behind.
- **Cold**: ears, nose and fingers redden in the cold (era 2 and any frost), and glow through when a light
  stands behind them (`sss`).
- **Adaptation**: the eye takes half of the ruling light's colour as white (von Kries, half way), so a face at
  golden hour is warm, not orange, and sodium still reads as sodium.
- **Exposure nudge**: the drawer and the portrait each may set a figure's exposure one stop either way
  (`NUDGE`, `scaleRig`), as the drawer already does against the painting round a figure.

## 5. World light

- **The clock**: section 2. Windows light from dusk to bed and again before dawn (`windows.mjs windowHours`).
- **Lamp pools and the crowd**: bodies standing in a pool take its light off the ground in proportion to the
  shadow they lay over its light-weighted area (`crowd.mjs`); each body gets a shadow away from its ruling lamp.
- **Wet and frost**: per sample, by footing, rain, the thaw round fires, and shelter (no hoar under a roof).
  Each style draws them its own way; the model says where and how much.
- **Atmospheric depth**: fog depth from the camera, by the era's haze, the fog term and the place's mist. The
  wide lens is where it shows.
- **Flicker**: per kind (section 3); the police strobe; a failing fluorescent tube; a dying sodium head cycles.
- **The export train**: a cone light on the siding that runs in from the south, brakes into the dock, stands
  while the sacks go on, and leaves (`train.mjs`; the line is in `places.mjs` for q_square_wide_quiet).
- **Windows found, not listed**: every lit or dark pane in a plate's geo buffers becomes a window light the
  model can light, dim or put out (`windows.mjs`).

## 6. Decay in light

As a street's stock falls, its lamps go out one at a time in a fixed order (each has its own threshold) and
come back in reverse, its windows darken, and its fires shrink. The street's light index is
0.45 food + 0.25 work + 0.15 (1 - hunger) + 0.15 (1 - theft); a street with its own `light` stock uses that.
At the slice's start the square reads about 0.57. The state's lights do not decay. The service rebuilds when
any street's index moves by a twentieth.

## 7. Measures, with controls (2026-10-21)

Proof plates: the painted lead's preview bakes of the Quota plates (render/preview/v2, 19:20 to 19:28 on
2026-10-21), copied read-only into game/capture/light/plates. Every number below is from those bakes, CPU only,
on a machine carrying other heavy jobs.

- **Faces** (tools/faces.mjs): 13 speakers over 5 scenes, play and portrait size. Pass lines set first: play
  range 8 L* and separation 8 L*, portrait range 15 and separation 10. Each rig may move one stop either way.
  The model's rig passes 13 of 13 (5 needed a nudge; Will in the Brack kitchen and Ned in the Furrowe kitchen sit
  with their backs to the light). The fixed rigs it replaces also pass 13 of 13 (6 needed a nudge). The flat control
  fails 13 of 13. Medians, model against fixed: play range 33.6 against 46.7, separation 16.9 against 17.3;
  portrait range 31.4 against 53.4, separation 20.4 against 14.3. Read: legibility is held, not raised. The fixed
  rigs throw more range because they light every face from the same bright front key whatever the scene; the
  model's faces are lit by the scene's own source and sit further from their ground in portraits.
- **Temporal stability** (tools/stability.mjs, 120 frames, still camera): the frame-to-frame change of the painted
  relight's lit pixels (99th percentile) is 0.006 to 0.29 L*, 7.5 to 31 times smaller than a control with the same
  per-light swing drawn fresh each frame, while the flicker still moves a lit pixel 3 to 8 L* over two seconds in the
  fire and lamp scenes. Glyph cells changing tone level per frame: 0 to 0.18%, control 0 to 0.54%. The first pass
  lines (3 L*, 1%) did not separate the model from the control; the criterion was tightened to "a third of the
  control or less" after that first run, and that is stated as a change, not a pre-registered line.
- **Glyph legibility** (the glyph lead's own measure, through tools/harness.mjs): with the model's light cells the
  kitchens and the granary keep structure 0.90 to 0.97 (own light 0.96 to 0.98). The glyph renderer's own light
  ignores the clock, so the square reads the same at dawn and at night; with the model the dawn square rises from
  0.65 to 0.78 and the night square falls to 0.53, under the 0.75 gate. The night square is dark by design (no
  street lamp burns in era 2); the glyph style needs an exposure for the clock before it takes the model at night.
- **Cost**: in the game (headless, CPU) a Quota place's light builds in 130 to 190 ms in an idle callback, once per
  place and street state; a figure's rig is 0.03 ms; the per-light gains 0.002 ms; a full-plate compose 38 to 50 ms,
  which no style should call per frame. tools/bench.mjs, quay brawl, GPU off, not quiet (load 20 to 29%): 51.3 ms a
  frame with the service off, 50.4 ms with it forced on for the quay (`lightmodel=all`); forcing it delays Lamb's first
  showing from 53 to 304 ms (the build on the main thread). The service builds only for Quota plates by default. The
  bench's crowd-300 view failed to load its crowd cards in this worktree, so the wide crowd has no number.
- **Visual checks** (merged build of this branch): painted 8 of 8 and glyph 8 of 8, every control failing.

## 7a. Stroke light (the author, 2026-10-21: "a cool combination of both")

The painted lead lays strokes that follow the planes and catch the key. Per pixel the record carries the ruling
light's source id (`rec.key`), its direction and colour, its strength, the lit and shadow side (`rec.side`) and the
terminator band (`rec.term`), so strokes radiate from the lamp, the stove, the frost sun or the train's headlamp.
Sheet: game/capture/light/strokelight/sheet.png (the exchange, the tower, the tower with the train, the granary and
the three kitchens).

## 7b. Changes, 2026-10-22

- **The frost sun** is no longer orange: per-channel optical depths thinned (about 3350 K at 5 degrees, 4100 K at 10;
  a test holds it near direct-sun readings, from memory, moderate confidence).
- **The eye's adaptation to the hour:** outdoors a flame or a bulb counts full at night and a fifth by day, so the relief
  kitchen's lamp at dawn is a warm point, not the key on a face; indoors the eye adapts to the room. The sun counts at
  normal incidence on a face. Outdoors the fill takes the sky's colour. Ned at the relief queue, face CIE a*/b*: 53/54
  before, 18/17 after. Faces: 13 of 13 pass with the model's rig (6 nudged), 13 of 13 with the old fixed rigs (6
  nudged), flat control 0 of 13.
- **The build** runs in bands inside idle callbacks (light/steps.mjs, the same output as the one-piece build); a page
  that never idles still gets 5 ms a turn. Lit windows are no longer counted as fires in the frost pass (that bug made a
  large plate's build take minutes).
- **Glyph clock exposure** (adapters.mjs `glyphCells`): the light at the scene's brighter samples is brought toward the
  level the type's tone curve expects, 1 to 8 times.

## 8. Open

- The styles draw from the record once their leads wire it (design/state/light.md lists each seam). The glyph style needs an
  exposure for the clock before it takes the model's night. Until then the proofs
  use reference consumers: a painted relight and the real glyph renderer with its light cells replaced.
- q_square_wide's house fronts face away from the bell tower: five panes show, so window decay barely reads in
  the wide lens. A plate question for the painted lead.
- The build runs on the main thread; a worker would remove the one-off 130 to 190 ms hitch on entering a place.
- Eras 1, 3, 4 and 5 have sources and sky but no plates yet.
