<!-- writing-profile: research -->
# Light lead's notes

The light lead's notes for the other leads (coordinator's rule, 2026-10-21: each lead writes only its own file under
design/state/). The light model: game/engine/light/; what the light means: design/art/LIGHT.md.

## Light lead's interface (2026-10-21): what the one light model hands the painted and glyph leads
The model lives in game/engine/light/ (design/art/LIGHT.md says what the light means). It draws nothing; both
styles read it. In the game: `globalThis.__lwLightModel`, built per Quota plate and street state in an idle
callback (ui/play.mjs installs it; `?lightmodel=0` leaves it out, `?lightmodel=all` builds it for every plate).
Proposed to the painted-style lead and the glyph-style lead; say here if you want a different shape and I follow.
- **Per pixel** (plate geo samples, `F = __lwLightModel.scene.F`, index `y * F.w + x`, the geo buffers' grid):
  `F.E` irradiance (Float32 rgb, linear, about 1 for a lit surface; `__lwLightModel.compose(t)` refreshes it for
  the clock and the gains); `F.rec.dir` toward the ruling light (Int8 x3, /127); `F.rec.K` its colour temperature
  (Uint16 kelvin); `F.rec.shadow` (share of lamp light blocked), `F.rec.rim` (light from behind at grazing),
  `F.rec.occ` (occlusion), `F.rec.wet`, `F.rec.frost`, `F.rec.fog` (fog depth), `F.rec.up` (all Uint8 0..255).
  Glyph cells: `cellsFromField(C, F, E)` gives the renderer's own light-cell array (Float32 rgb per world cell,
  the shape `bakeLight` returns), `cellRecord(C, F)` the other terms per cell. Painted: `relightRatio` and
  `relightRgba` (consume.mjs) are the reference relight; wet and frost are yours to draw your own way.
- **Per light, per frame**: `__lwLightModel.gains(t)` (flicker, decay, the crowd, windows by the hour) in the order
  of `scene.M.lights` (each `{ at, reach, rgb, K, kind, role, decay: { on, gain, dying } }`); the moving lights
  (the export train) from `scene.M.dynamic(t)`. A style that redraws per frame recomposes only the cells of lights
  whose gain changed (each sample's two strongest lights are `F.id0/e0`, `F.id1/e1`, the rest summed).
- **Per figure**: `__lwLightModel.rig(at, t, cam)` returns `rig` in characters/render/shade.mjs's shape
  (`amb, ground, key, fill, rim, fresnel`), so the drawer's `rigAt` can return it as is, plus `key`, `fill`,
  `rim` (direction, rgb, strength, kind), `terminator { dir2 (screen, dark side to lit side), soft, ratio }`,
  `catch { offset2, rgb, k }` for the eye, `sss { k, rgb, through }` for ears, nose and fingers in the cold, and
  the exposure allowance `NUDGE` (one stop either way, `scaleRig`).
- **Seams I did not touch, yours to wire**: the drawer's `rigAt` (characters/runtime/fightdrawer.mjs, the
  performance engineer's) and the painter's ruling-lamp direction (paint/install.mjs) can take `rig(at)`; the glyph
  renderer's `prepare` can take `cellsFromField` instead of `bakeLight`, and figures.mjs its fixed `LIGHT` from
  `terminator.dir2`; the portrait painter's `keyDir` from `key.dir`.
- **Places**: game/engine/light/places.mjs annotates each Quota plate (era, street per part, household, each plate
  light's real source, the train's line, added lights). Painted lead: name a light's `source` in place.json if
  you prefer it there (carbide, brazier, stove, tallow, rush, embers, window); places.mjs gives way to it. Finding
  for you: q_square_wide's house fronts face away from the bell tower, so five panes show and window decay barely
  reads in the wide lens.
- **Systems**: the model reads `G.community.stock(name, street)`; a street with its own `light` stock uses that
  directly. Fires read their household's `portion` and `food`. No change to q_community.lwd is needed; adding
  "the lit windows" to the wide lens's `shows:` would name what decay shows.

## For the painted lead (2026-10-21, light lead): the stroke-light terms, per pixel
Answering the author's note on stroke light (environment first: the exchange, the granary, the tower, the kitchens).
Each plate sample of `F = __lwLightModel.scene.F` now also carries, refreshed by `compose(t)`:
- `F.rec.key` the ruling light's **source id** (Uint8): an index into `scene.M.lights` (each with `at`, `kind`, `rgb`),
  or `KEY_SUN` 250, `KEY_MOON` 251, `KEY_SKY` 252, `KEY_DYN` 253+ (a moving light: the train's headlamp, from
  `scene.M.dynamic(t)`), so strokes can radiate from the lamp, the stove, the frost sun or the headlamp;
- `F.rec.dir` the **key direction** (toward the source, Int8 x3 /127) and `keyRgb(F, M, i)` its **colour** (field.mjs);
  `F.rec.keyE` its strength (Uint8, 255 = 1);
- `F.rec.side` the **light-side and shadow-side split**, n.l toward the key (Int8, -127 shadow side .. 127 lit side);
- `F.rec.term` the **terminator mask** (Uint8, 255 where n.l = 0, fading out over the source's softness: the sun
  0.12, a carbide lamp 0.2, a candle or lamp 0.35, a window 0.6, the sky 0.8).
The same terms for every Quota plate are drawn in game/capture/light/strokelight/sheet.png (light tool
game/engine/light/tools/strokelight.mjs). If you want them in another shape (a packed RGBA texture, plate
resolution instead of the geo grid's half), say so here and I follow.

## For the performance engineer (2026-10-21, light lead)
Answering design/state/perf.md: I am not replacing paint/lightfield.mjs or paint/lightlayer.mjs; move them as planned.
A candidate for your worker when you want it: game/engine/light/scene.mjs `buildScene()` (pure: typed arrays in and out,
no DOM) runs once per Quota place in an idle callback on the main thread, 130 to 190 ms (game/engine/light/install.mjs).
Forced onto the quay (`?lightmodel=all`) it delays Lamb's first showing in the brawl bench from 53 to 304 ms; by default
it builds only for Quota plates, so the Low Water views are untouched.

## 2026-10-22 (light lead): adapters for each seam, the dawn faces, the build off the frame; asks to confirm
**Adapters** (game/engine/light/adapters.mjs), each in the shape the owner's code already uses, so the seam is one line:
- **Figure drawer** (characters/runtime/fightdrawer.mjs `rigAt`, figure lead / performance engineer): `drawerRig(at, cam)`
  returns `{ rig, tone }` like `rigAt` (tone `"sodium"` or null; map it to your `RIGS.quay.tone`), or null until the model
  is ready, so the fallback stays yours: `const L = drawerRig(at, cam); if (L) return L;` at the top of `rigAt`.
- **Painter, ruling lamp** (paint/install.mjs): `rulingLight(at)` returns the key's direction toward the light, or null.
- **Painter, stroke light** (design/art/PAINT-LANGUAGE.md's names): `paintTerms(F, M, i)` gives `lightValue`, `family` (0 shadow
  .. 1 light, soft over the terminator, dropped where the key is blocked), `terminator`, `warm` (-1 cool .. 1 warm, by the
  light's temperature against 4000 K), `ruling` (the source id, -1 the sky), `ao`; `paintTermsMap(F, M)` gives them for
  every sample as typed arrays. Per figure the rig gives key, fill, rim; hour and era are `scene.M.hour` and `scene.M.era`.
- **Glyph, world cells** (glyph/renderer.mjs `prepare`): `glyphCells(C, F, E)` returns `bakeLight`'s shape with the clock
  exposure applied (`out.exposure`): the eye's adaptation, which lifts the light at the scene's brighter samples toward the
  level your tone curve was tuned for (1 to 8 times), so the night stays dark relative to its lit tenth and still reads.
**Please confirm or correct here (your own state files are where I read):** painted lead, the six paint terms; glyph lead,
`glyphCells` with the clock exposure; figure lead or performance engineer, the `rigAt` line. Glyph already reads `rig()` for
figures (design/state/glyph.md); thank you.
**Dawn faces** (the coordinator: the orange at dawn): three causes, three fixes. The frost sun was too warm: its colour now
comes from thinner per-channel optical depths (about 3350 K at 5 degrees and 4100 K at 10, against direct-sun readings of
about 3200 and 4000 K, from memory, moderate confidence; a test holds it there). A lamp still lit at dawn was the key on
Ned's face: flames and bulbs are now weighed by the eye's adaptation to the hour outdoors (full at night, a fifth by day;
indoors the eye adapts to the room), and the sun counts at normal incidence on a face. Outdoors the fill is the sky's
colour. Ned's face at the relief queue, CIE a*/b*: 53/54 before, 18/17 after (the old fixed rig 24/32).
**The delay behind Lamb's first showing** with the model forced onto the quay: two causes. Every lit window the model finds
was also taken for a fire in the frost pass (277 windows, 3 million samples: minutes of work), a bug, fixed; and the build
ran as one long task. It now runs in bands inside idle callbacks (game/engine/light/steps.mjs, the same output as the
one-piece build, tested): on the quay the longest step is about 20 to 55 ms on a loaded machine and the whole build about
25 s of idle time, so the quay stays opt-in (`?lightmodel=all`). The granary builds in 91 slices, the longest 22 ms.
Performance engineer: buildSteps is pure and would move to a worker as it is; that remains the real fix for large plates.
**Queued after the fixes** (author's section 11 references): a 2D probe GI for bounce in kitchens and down the street,
volumetric shafts through lattice windows, and halftone falloff for glyph's night (the irradiance term is continuous
and unclamped, so a halftone can quantise it directly).

## Effects interface (2026-10-22, light lead, who now also owns effects)
Author direction (2026-10-22, verbatim): "I think we should continue work on our shaders and effects techniques, and
implement tons of new rendering and visual features." The layer is game/engine/fx/. **One description, two forms.**
Each effect is a function of the scene's state and the time that returns primitives on the plate:
`{ k, x, y (plate px), d (depth, m), r (px), a, rgb (linear), ang, len, glow }`, or a plate-anchored image `{ k: "layer",
w, h, scale, rgba }` (lying snow). The painted form draws them as brush marks (fx/paint.mjs: `paintCanvas`, `paintRgba`),
the glyph form as one mark a cell (fx/glyph.mjs: `glyphMarks(prims, grid)` -> `{ c, r, ch, rgb, a }`, ASCII only).
In the game, fx/install.mjs runs them each frame from `__lwLightModel.scene` (so only where the model is built) and draws
on its own two canvases; `globalThis.__lwFx.stats` has ms a frame, primitives, marks and each effect's ms.
- **Painted lead:** to give the marks your brush, read the primitives from `runEffects(fxContext(...), settings).prims`
  (or wrap `paintCanvas`); the kinds are flake, puff, print, frost, mote, haze, flame, ember, spark, smoke, steam, soot,
  and the lying-snow layer. **Glyph lead:** `glyphMarks` gives marks in your grid; write them into `out.G` and `out.FG`
  after the world compose instead of my overlay canvas, and choose your own glyphs per kind (the table is `CH` in glyph.mjs).
- **Settings:** `?fx=off|low|high`, `?fxflicker=full|reduced|off` (also sets `M.flickerK`, so the light's own flicker
  follows), `?fxmotion=full|reduced`, `?fxonly=snowfall,fire,...`; saved per viewer under `lw.fx`.
- **Done (queue items 1 and 2):** snowfall (terms.snowfall), lying snow on raised surfaces under frost (terms.snow),
  footprints that fill in as it snows, breath in the cold, frost creeping over panes through the night, dust in a
  window's shaft by day, heat haze over fires; flames and embers that follow each fire's gain (flicker and decay),
  sparks off the brazier and the stove, tallow smoke, the train's steam and soot. Per frame in the game (headless,
  CPU): 0.2 ms in the granary, 0.4 to 0.7 ms on the wide square. Tests: game/engine/fx/tests/fx.test.mjs.
- **Queued, in the coordinator's order:** ground (ruts, drying wet, grain spill, notices torn and pasted over by the
  carriers), decay staged as effects, camera (painterly depth of field, the wide lens's haze ramp, ink-blot variants),
  era post, dreams, combat; and from the author's section 11: 2D probe GI, volumetric shafts, halftone falloff.

## 2026-10-22, later (light lead): snow gated by the light, frame time on Quota plates, a bench view asked for
- **Falling snow is lit only by the light it falls through** (the author's section 12 reference): each flake's
  brightness is the irradiance in the air where it is (fx/core.mjs `airLight`: every lamp and fire, the headlamp
  inside its cone, the sun and moon, a little sky), so at night the snow shows in the lamp pools, the windows' spill and
  the train's beam, and not in the dark between; a lit flake twinkles (steady with flicker off). Flakes are also sampled
  inside each light's reach and along the headlamp's beam at the fall's own density, so the pools carry the snow.
  Glyph lead: the flakes come to you as marks with that brightness; dithered night snow is yours to draw from them.
- **Frame time on Quota plates** (fx/tools/frametime.mjs; the square's preview plate copied into my worktree's content,
  1920 x 1080, headless, GPU off; the machine at 70 to 100 % load, so these are not quiet numbers): mean ms between
  frames, two runs each: light model and effects off 44.8 / 44.4; light model on, effects off 45.1 / 45.3; effects low
  50.3 / 41.9; effects high 47.8 / 42.1. The effects' own work is 0.9 to 3.2 ms a frame. A first version cost 12 to 14 ms a
  frame more than off: it cleared and composited three full-screen canvases every frame; now the lying snow redraws only
  when the view moves and an unused canvas is hidden.
- **Performance engineer:** asked (message) for a Quota view in tools/bench-views.mjs ("quota-square", "quota-granary").
  It needs the Quota plates baked into content/ first (painted lead).

## 2026-10-22, effects round two (light lead): groups 3 to 8, the section 11, 13 and 14 items
All in game/engine/fx/ and game/engine/light/, each with a painted form and a glyph form unless noted, tied to state, with
quality and the accessibility settings. Proof sheets (looked at): game/capture/fx/oil/sheet.png, game/capture/fx/glyph/sheet.png,
game/capture/fx/post/sheet.png, game/capture/light/gi/sheet.png, game/capture/light/halftone/sheet.png.
- **3, ground** (ground.mjs): the district notices, as thick as each street's `notices` and the carrier's `volume.notices`, aging,
  torn and pasted over; cart ruts along the brigade's road (places.mjs `ruts`), cut by `export` and `owed`, filled by snowfall;
  grain spilled at the loading plank (`spill`), scavenged by the street's `hunger`; wet that dries over `terms.thawHours`.
- **4, decay staged** (decay.mjs): peeling plaster, soot creep, weeds, boarded windows and broken lamps, each coming in at its own
  point as the street's light index falls. Honest limit: on the wide square's preview the house fronts face away, so these read
  weakly there; they are made for street and narrow views (no Quota street plate yet).
- **5, camera** (post.mjs, transitions.mjs, air.mjs): painterly depth of field for the narrow lens (a smear along a slow field, not
  a round blur), the wide lens's haze ramp and haze in planes of warm and cold air, valley fog at dawn, rays from a low sun, and
  three ink-blot variants (bleed, burn, page-turn) as coverage masks either style can use. Painted lead: the variants sit beside
  your paint/inkblot.mjs, not in it.
- **6, era post** (post.mjs, air.mjs): 1 varnish over a crazed ground; 2 frost-bleached and scraped; 3 print registration and a dot
  screen; 4 tube flicker and grain; 5 sodium mono and, for filmed clips, compression blocks; luminance grain by era (heaviest in
  4 and 5; `?fxflicker=off` removes it, `reduced` thins it). The blue-hour sky with peach-lit cloud draws only where a plate shows
  sky; the slice's plates look down and show almost none, so it is unproven on them.
- **7, dreams** (dream.mjs): the frame coming loose in stroke-sized pieces, the future as a ghost underpainting (the painted form),
  marks printed ahead of the figures (the glyph form); the bleached one-hue look for memory (air.mjs `bleach`), kept rare.
- **8, combat** (combat.mjs), from events the fight hands over (`ctx.events`: hit, fall, exert, windup): an impact smear, dust from
  the feet, effort breath in the cold, two or three drops of blood on a heavy hit and no spray, the telegraph ring (doubled when
  the blow cannot be caught). Gameplay or performance: the fight would push these events; nothing sends them yet.
- **Section 11:** bounce light by radiance cascades on the floor plan (light/gi.mjs; 4 cascades, 4 to 256 rays; 25 to 40 ms a
  kitchen, 70 ms the wide square; offline per plate state, not yet in the game), with a debug view of the field; window shafts
  with the glazing bars' lattice and the lamps' air in snow (fx/shafts.mjs; a layer rebuilt each quarter hour, 40 to 80 ms);
  dust now shows only in a shaft; halftone falloff (light/halftone.mjs) straight from the irradiance term.
- **Sections 13 and 14:** sun glints on wet and flooded ground (fx/water.mjs, by a facet lobe that widens with the wind), the sky
  mirrored in standing water, and the air items above.
- **Frame time** (fx/tools/frametime.mjs, Quota previews copied into my worktree, headless, GPU off, machine 30 to 80 % loaded):
  the square and the granary run within noise of effects off in every arm; the effects' own work is 0.8 to 2.9 ms a frame.
