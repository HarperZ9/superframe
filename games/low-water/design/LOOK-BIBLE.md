<!-- writing-profile: research -->
# Low Water: look bible

Draft 1, 2026-10-16. Private. Every frame named here was rendered from original block-out geometry
(signed-distance scenes in `render/scenes/`) through raw-native's own web passes, read from
`origin/main` at 92934a8 by `git archive`. No outside art, no test models, no third-party shaders.
All renders ran on the CPU at Idle priority, at most two jobs at once; the GPU was not touched.

## 1. The look in one paragraph

Illustrations you can walk through, lit like a cinematographer would light a night exterior. Each
district has one kind of light, and the kind of light is the district's identity and its rules:
sodium orange that eats colour on the quay, honest paraffin yellow indoors, a palette that cycles
in the Gut, candle and cold white on the hill, and four-tone dither with fog to paper white on the
Flats and in every blackout. Shadows are deep and violet, never grey; lamps bloom and streak
through a lens that has a body. The people are grotesque in proportion (heavy heads, long necks,
hands to the knees) and drawn with the same ink line as the buildings, so they belong to the
painting.

## 2. Principles

1. **Light composition first.** Every frame is designed as a balance of direct light (lamp pools,
   the beam, the arc) against ambient (a cold, violet lift in the shadows). The grade states the
   balance as data: a toe, a shadow lift colour, a shadow range and saturation, each keyed to the
   eight time-of-day slots (`render/grade.mjs`, on the engine's look keys).
2. **One hot colour per frame.** Sodium orange on the quay; bottle green in the lamp room; cycling
   violet in the Gut; candle gold in the chapel; white beam on the Flats.
3. **Colour is evidence.** Where sodium is the light, colour is absent by physics (the engine's
   spectral sodium pass), and the game uses that (systems section 6). The look never cheats it.
4. **Painted, not filtered.** Places are painted over their block-out and the painting is the
   surface (paint-over projection). The ink line follows object and normal edges.
5. **Granular, engine-side.** Every term has a per-slot curve. The player sees a small set of lens
   settings only (the engine's `settings.mjs`).
6. **Grotesque warmly.** Figures are pushed (head 1.2 to 1.5 times natural, necks long, stoops
   deep), never gory. A fish the size of a cart, a lens like a beehive, a god in a light bulb.

## 3. District palettes and light regimes

| District | Light | Engine pass | Hot colour | Shadow | Notes |
|---|---|---|---|---|---|
| Lamp Quay | Low-pressure sodium, paraffin doorways | Sodium spectral shading, paint-over painter, lens suite, LW grade | Sodium orange | Violet lift | Keep sky fill low where sodium should erase colour (the engine study's rule) |
| The Brine | Paraffin, 2700 K | Same chain, window light type | Lamp yellow | Warm brown | The only place on the quay where colours read |
| The Gut | Lamps on wires, fire-doors | Palette-locked lighting with cycling void ramp | Cycling violet and cyan | Teal night ramp | The palette is fixed; nothing outside it can appear |
| Chancel Hill | Candles, white trial lamps | Sodium pass (window and LED types), painter, lens | Candle gold | Deep blue-violet | The gasholder frame in teal against it |
| Mother's lamp room | The arc (white LED type), green prisms | Same chain | Bottle green | Olive grey | Strong lens ghosts and a short streak |
| The Flats, blackouts | Lanterns, Mother's beam | Dither-quantised lighting, four tones outdoors, two indoors; fog to paper white; beam haze | Paper white | Ink violet-black | Screen-anchored Bayer 8 x 8, as the engine's study chose for stills |
| Daylight and dawn | Sun and sky | Paint-over projection (two keyframes), engine paint-over grade with LW look keys | Oxblood, mustard, teal houses; yellow oilskins | Dusty brown | The town's true colours, seen only by day |

## 4. Key frames

All frames are 1280 x 720 in `frames/`. Each has a `.json` beside it with its recipe.

| # | File | What it shows | Pipeline | My verdict |
|---|---|---|---|---|
| 1 | `kf1-lamp-quay-2307.png` | Lamp Quay at 23:07 on Low Night: the crooked row, the Brine's hull, the weigh-house balance, three sodium posts, walkers with lanterns on the floor, the stranded fish, Mother dark and swollen on the right | Sodium spectral pass, painter, lens (24 sources), LW grade, grain | Good. Reads as a place and a time at once. The violet lift is a little milky at full size; Mother is too ghostly for the frame's subject |
| 2 | `kf2-colour-comes-back.png` | The mechanic: a prism, a rag and a cap on a crate under the sodium lamp (olive, brown, grey) and the same three in the Brine's doorway (green, red, blue) | Same chain | Works as a mechanic test; weak as a picture (flat composition, the quay wall is a dark band) |
| 3 | `kf3-weigh-house-vote.png` | 21:38, the Guild voting blindfold round the town balance by one candle; white blindfolds; fish on the pans | Dither-quantised lighting, two tones, Bayer, haze from the louvre beam | Atmospheric and strange; the figures are hard to read. Needs a stronger backlight to make silhouettes |
| 4 | `kf4-flats-low-water.png` | The Flats in fog: the drowned lamp leaning, the lantern in its hole, Mother's head as a round silhouette, her beam a white wedge across the fog, the assessor in a wide hat in the foreground | Dither, four tones, fog to paper white, beam haze | Strong. The most graphic frame; reads at thumbnail size |
| 5 | `kf5-mothers-lamp-room.png` | Mother relit: the beehive lens with a third of its rings bottle green, the keeper in oxblood holding up a green prism, the log on its desk | Sodium pass (LED arc), painter, lens | Strongest. Grotesque, funny and the mystery in one image |
| 6 | `kf6-the-gut.png` | The fish lane from above: the cycling violet gutter, brine vats, stalls, the lamp on its wire | Palette-locked lighting, cycle at t = 1.7 s | Strong and the funkiest; eel strings read poorly (green on green) |
| 7 | `kf7-chancel-hill.png` | The Congregation of the Filament inside the gasholder frame: the Old Bulb hung over the altar, the deacon, the faithful in bell jars, candles | Sodium pass (window and LED types), painter, lens | Strong. Clear silhouette, clear hot colour, clear joke |
| 8 | `kf8-dawn-daybook.png` | Lamp Quay at 06:09 seen from a camera swung 9 degrees off the painted keyframe: the town's real colours | Paint-over: daylight export, painter, projection from two keyframes, engine grade with LW terms | Good; the violet-grey patches behind Mother are gaps a third keyframe would fill |
| 8b | `kf8-slots-strip.png` | The same projected painting graded at all eight slots (midnight to night) | Engine paint-over grade with LW look keys | The look keys hold: night, dawn, noon, golden, dusk read as different places |

Supporting: `paintover-export.png` (the daylight block-out a painter starts from) and
`paintover-painting.png` (the engine painter's paint-over of it).

**Strongest, by my own look:** 5 (the lamp room), 7 (Chancel Hill), 4 (the Flats), then 6 (the
Gut). These four carry the pitch. 1 is the establishing frame. 2 and 3 are working frames.

## 5. Practical notes from making the frames

- Two painted keyframes are not enough for a place with posts and a tower: when the camera swings,
  the back of every thin thing shows as a gap. Paint three per place.
- A spectral frame takes three to four minutes on the CPU; the paintings are cheap, the lens is
  the slow part. Plates for the prototype are baked once.

## 6. Revisions made, frame by frame

Each frame was looked at after every render and changed until it read. The main changes, in order:

- **Lamp Quay**: Mother moved from the foreground (she blocked the quay) to the right of the mole;
  the hill town added behind the row (the frame had empty mud at the top); the hill houses given a
  cell-boundary bound (they rendered torn); Mother's tower given a goitred neck and a cracked,
  swollen head (the striped tower read as a seaside cliché); a cart-sized fish added to the empty
  floor; mist cut from 0.012 to 0.003 (everything was brown haze); sodium raised from 26 to 85 and
  ambient cut so pools of light have edges; streaks cut to a third (they crossed the whole frame);
  the grade given a toe and then an additive violet lift, because a multiplicative tint cannot make
  blue out of sodium light with no blue in it.
- **Colour test**: the second crate moved onto the Brine's threshold and the doorway light raised,
  because three metres from a sodium lamp the doorway did not win.
- **Weigh-house vote**: the candle intensity raised five times (the first render was black with a
  haze stripe); the beam re-aimed twice; the camera lowered and tightened; the haze cut back when it
  made round blobs.
- **Flats**: the camera brought from 60 m to 21 m, because fog is computed from camera distance and
  a far camera fogged the subject as much as the horizon; Mother's head made emissive; the beam
  widened, then its haze reduced so the wedge has an edge.
- **Gut**: houses narrowed and lowered (they hid the lane); the gutter trench fixed (the cut was
  inverted); the void phase kept in [0, 1) (a negative phase crashed the palette lookup).
- **Lamp room**: the lens's bounding volume fixed (it rendered as a solid cylinder); the camera
  moved inside the lantern; the keeper moved beside the lens.
- **Chancel**: the near houses moved behind the frame (they blocked it); the bulb given a light on
  its near side so the glass reads; the frame's members thinned.

## 7. Rules for painters and modellers

- Block-outs stay simple: boxes, gables, cylinders. The painting carries the detail.
- Leave three keyframes per place: the main view and one each side at about 15 degrees.
- Paint lamps as the brightest strokes; the lens suite reads them as sources only above its
  threshold.
- Colours on the quay are authored as spectral materials (the sodium pass's form: a sigmoid of a
  quadratic in wavelength, times a peak), never as RGB, so the sodium rule holds.
- Figures: head 1.2 to 1.5 times natural; neck long; one exaggerated feature per character (Keel's
  height and water, Wenna's head, Marrow's girth, Fennick's neck, Merrow's width).
- Ink: dark violet-brown, never black; thicker on silhouettes than on folds.

## 8. Not done yet

- No frame is from a game runtime. They are offline CPU renders of the passes the runtime will use.
- The painter is the engine's procedural one. Hand paintings by an artist would replace it; the
  pipeline does not change.
- The blackout cross-fade (painted to dither) is not built; the frames show each mode separately.
- Wet reflections are the sodium pass's one reflection ray, not the traced painted-reflection layer
  the effects program lists as a candidate.

## 9. Plates for the closer camera (2026-10-17)

The game's places are now painted plates at 1080p density (80 px a metre outdoors, 190 in rooms;
orthographic; render/bake2.mjs, render/PROGRESS.md). The light composition per place, as built:

| Place | Key (direct) | Ambient | Dark pockets that the stealth layer uses | Variants |
|---|---|---|---|---|
| Lamp Quay | Six sodium heads, 7 m apart; paraffin at the Brine's door, the office window, the mole steps' cage | Moon behind the town as a cool rim; violet lift in the grade | The steps (no lamp; candles only), the eave by the switch, the crates by the mole root, the dark west end | night, rain, frost, dawn; dither blackout |
| The floor | Walkers' lanterns standing in pools, the quay's sodium along the top | The moon low over the town | Everything past a lantern's reach; the lee of the fish and the boat | night, rain; fog dither; blackout |
| The Brine | Three paraffin lamps, the stove, the oven | A warm fill from the ceiling; sodium through the portholes | Behind the stove, behind the bar | night, wet hour; the stove alone in a blackout |
| Weigh-house | Four lamps on hooks | Sodium in bars through the louvre | The store corner, under the trestles | night; lights-out dither |
| Lamp room | The arc inside green and clear rings | Cold sky through the bars | The far side of the lens | lit, dark, frost |
| The Gut | Wire lamps (palette-locked), fire-doors | The palette's moon ramp | Shadwell's smoke, the overhang, the lookouts' boxes | night, rigged, frozen, blackout |
| Chancel Hill | White arcs (4100 K) both sides of the path: no shadow by design | Stars | Only the foot-wide strip under the study sill | lit, frost, switch thrown |
| Gasholder | Forty candles in jars; the Old Bulb when lit | Stars through the lattice | The kneelers | candles, Opening, bulb, frost |
| Ropewalk, Spit | One paraffin lamp a street; strippers' lanterns | Stars, the frost | Doorways, the passage; the Ann Tull's lee, the tarpaulin | night, frost, doused; stars, lanterns, frost |

Rules carried forward: the hot colour is still one per place; sodium still erases colour on the
quay; colour belongs to paraffin rooms and to day. New: rain wets everything outdoors and pools in
noise-shaped puddles that mirror the lamps; frost lays rime on cold tops (thin on drained stone,
thick on wood and rails); the ink is ours (heavier on silhouettes than on folds); lens ghosts are
not baked (they belong to a screen, not to a scrolling plate).
