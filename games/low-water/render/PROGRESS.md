<!-- writing-profile: research -->
# Plates for the closer camera: progress

Environment art, from 2026-10-17. Brief: re-frame and re-bake every plate for the orthographic
camera of design/CAMERA.md, raise detail and light composition, then build the Act 1 and Act 2
districts, the daylight interlude and the three pull-backs, with before and after stills.

Density (CAMERA.md correction, 2026-10-17): the quay at 2.25 times, about 132 px a person at 1080p,
so 80 px a metre at the plate camera (elevation 30 degrees); rooms at 1.75 times their old framing,
about 190 px a metre. One plate pixel is one screen pixel at 1920 x 1080, so the camera never
magnifies paint. Every plate is at least 1920 x 1080.

## Steps
1. DONE Read PROGRESS, the camera decision, the look bible, PRODUCTION, STATE, the character
   pipeline, the two memory notes, the old bake code and plates; set lists of every place from the
   scripts (render/SETLIST.md).
2. DONE Engine root for render/ moved to the Low Water worktree (render/rn.mjs).
3. DONE Plate kit: kit/world.mjs (props bucketed on a floor grid so a place can hold hundreds of
   props), kit/ids.mjs (shared surface kinds: spectral material, dither tone, palette class, how
   rain and frost change each), kit/props.mjs (set dressing).
4. DONE Bake v2: bake2.mjs, v2/shade.mjs (trace once, shade every weather and time variant from the
   same hit; any number of lights, ten chosen per pixel), v2/post2.mjs (painter, our ink, grade, lens
   layers without screen-centred ghosts), v2/dark.mjs (blackout dither, four lights per pixel).
5. DONE The harbour as one world (worlds/harbour.mjs, worlds/town.mjs): quay, floor, mole, Mother,
   the Saint Cuthwin, the Gut's mouth, the hill and the gasholder on the skyline. Quay re-framed at
   4800 x 2560 (night, rain, frost, dawn, blackout). Crops judged at full size before the bake: the
   first pass was flat-lit (every facade the same orange); sodium cut from 85 to 48, gain and
   ambient lowered, the post by the steps removed so the steps sit in a dark pocket, the Brine's
   door set ajar with paraffin behind it.
6. DONE Rooms re-framed and dressed: the Brine (worlds/brine_in.mjs), the weigh-house after-vote
   (weigh_in.mjs: no baked crowd, aprons on pegs, tallies, weighbridge and its book, the store, the
   quay board, the tube terminus), the lamp room (lamp_in.mjs, lit, dark and frost).
7. DONE Act 1 districts that had no plate: the floor (camera on the harbour world; night, rain,
   a fog dither in the Flats look, blackout), the mole (night, frost), the 112 stairs (stairs.mjs,
   a tall plate), the harbour office and the cells as one section (office_in.mjs), the Gut
   (gut.mjs, palette-locked through the engine's palettelight: night, rigged, frozen, blackout).
8. DONE (scenes; bakes in 12) Act 2 districts, laid on the combat engineer's arenas (world x, z = arena x, z): Chancel Hill
   (hill.mjs: lit, frost, switch thrown), the Lamplighters' station (station.mjs, arena HILL),
   the Gasholder (gasholder.mjs, arena GASHOLDER), the Ropewalk (ropewalk.mjs, arena ROPEWALK),
   the Spit and the Old Light (spit.mjs, arena SPIT).
9. DONE (scenes; bakes in 12) Daylight for the interlude: quay_day (day, 16:00), mole_day, brine_day, room and room_day,
   weigh_day, gut_day (painted by day; the palette is the Gut's night).
10. DONE (scenes; bakes in 12) The three pull-backs: wide_arrival (22:41), wide_blackout (dither), wide_dawn.
11. DONE Coordination: design/NOTES-FOR-ENGINEER.md "plates v2" (density and `near`, orthographic
    camera, half-size world buffers, lens layers, marks for spots, hides, exits, lamps and paths,
    the plate table, arena matches and a QUAY proposal).
12. IN PROGRESS Bakes in two Idle lanes (render/queue.sh, render/chain.sh), then fix-ups found by
    looking: the floor too dark to read (moon and lanterns raised, more dressing), the station's
    floor a mirror (indoor floors made matte), white arcs too green (now the 4100 K type).
13. TODO Before and after stills (render/stills_all.sh), figures in the quay, Brine and weigh-house
    stills (render/v2/figs.mjs with the character lead's cast), and the honest read.
14. DONE One look (author, 2026-10-17): design/LOOK-UNIFIED.md, rules R1 to R7 (one frame and
    camera, one lighting model read from the plate's own light list, figures and effects in the
    plate's style, values, painted effects, what a fight changes and what it must not, paper UI).
15. DONE Fight ground from the plates: render/tools/arena_from_plate.mjs samples each place's world
    on a 1 m grid into the combat arena format (solid cells under painted walls and furniture,
    lights and anchors from the place's lamps and rig spots, spawns, exits, the light each cell
    stands in per variant, the stage line). content/<plate>/arena-<id>.json for quay, floor,
    gully, mole, brine, weigh, lamp, gut, dogs, hill (station), gasholder, ropewalk, spit.
16. DONE `place.json` now carries `lights[variant]`, `arenas`, and `marks.fight` / `marks.fights`
    (world spawns, anchors, the ground radius) for the combat converter (combat/sim/plate.mjs).
    Committed 02df6a8 and 6a5c93c.
17. DONE (mock-ups) Mode stills: render/modes.mjs renders one place walking, talking and fighting
    by the rules (render/stills/modes/), with the old modes copied beside them as before-*.png.
    The talk panel and the fight strip are mock-ups of the paper style (bars for text).
Own slip, recorded: two short jobs (a 40 s room re-bake and the first mode stills) ran while both
bake lanes were busy, three heavy jobs for under a minute. The chained scripts (render/after.sh,
finish.sh, final.sh, extra.sh) keep to two from here.
18. DONE Fight placement fixes (coordinator): the quay arena moved to open stone east of the office
    with hand-placed spawns; the Gut's dogs ground widened to the midden yard and the lane, with
    distinct spawns; harbour arena heights on the shells' datum; place.json keeps others' keys (the
    quay's `datum`). Plates declared settled in NOTES-FOR-ENGINEER.
19. DONE Final pass baked: the Spit (organic shoreline, readable barges) and the Ropewalk (near
    side cut low), the finer frost film on the quay, gasholder and mole frost, calmer daylight on
    quay_day and gut_day; stills for all plates (render/stills/, 76 files) and the mode stills.
20. HELD (author, 2026-10-17: "the art style is somewhat lacking"; an art director is choosing a
    direction): re-bakes written but not run: Chancel Hill with its near side cut to garden walls
    (the baked plate still hides the path behind house backs), the Gut's near side opened, the
    stairs and the arrival pull-back brighter, the rooms' matte floors (brine, weigh, station still
    show lamp reflections on the floor), the room's light stripes. Run render/last.sh and
    render/more.sh (and extra.sh) when a direction is chosen.
