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

## Paint and light, from 2026-10-21 (rendering lead)

Author, 2026-10-21 (verbatim): "Make it more like No Rest for the Wicked", then "The art style, and
rendering is really cool. We can do much better." Worktree the paint worktree, branch feat/paint. Target:
design/RENDER-TARGET.md; reference read only through cleanroom/spec/RENDER-NRFTW.md (study role).

21. DONE Clean-room study of the reference's look (study role, data only; GPU held by training, no
    capture): cleanroom/spec/RENDER-NRFTW.md. Render target with eleven measured targets:
    design/RENDER-TARGET.md.
22. DONE Object-anchored brush painter, game/engine/paint/ (ART-DIRECTION 7.2): strokes in each
    figure's bind space (strokes.mjs), four levels set in screen pixels (11, 7, 4.5, 3 px) with region
    budgets (boots and hats one coarse coat; coats coarse and middle; collars and props middle and fine;
    faces fine and finest), direction from the form fixed at birth with the image's flow (flow.mjs),
    value planes and glazes from per-place, per-hour palettes on the eight look slots (planes.mjs,
    palette.mjs), Kubelka-Munk mixing (km.mjs), broken colour, bristles and a dry tail, light and dark
    massing and a found edge (rim.mjs), a painted rim on the silhouette toward the ruling lamp
    (edge.mjs), a ceiling at 1.7 times the ground. One hook in the one figure drawer
    (characters/runtime/fightdrawer.mjs), so walking, talking and fighting are painted alike.
    ?paint=0 is the old drawer, ?paint=screen the screen-anchored control, ?paint=trace the measure's baseline.
23. DONE Lens streaks tied to their lamps (coordinator review): render/tools/restreak.py rebuilds every
    <variant>-streak.png from the place's own light list, 30 to 100 plate px each way, none from
    windows, candles or lit walls. Quay night: 6 sodium heads streak, against full-width lines before.
24. DONE Tools: game/engine/paint/tools/serve.mjs (worktree server with the main folder's bakes as
    fallback), capture.mjs (mode stills and figure masks), stability.mjs (T2, deterministic walk and
    turn), readability.py (T10). Tests: node --test game/engine/paint/tests/paint.test.mjs (8 pass).
25. DONE Light that moves with the night, game/engine/paint/lightlayer.mjs and lightfield.mjs, three
    canvases between the plate and the weather: Lamb's storm lantern pool (4.5 m, (1 - d/r)^2 with
    the last quarter faded, turned by the surface's normal from the geo buffer, three painted bands
    with world-anchored edges, mostly dark below the edge Lamb stands on); a glossy reflection lobe
    about the camera's reflected ray on wet ground (wet by footing kind, puddled by world noise, all
    up-facing ground in rain), baked per plate and variant for the place's lamps and per frame for
    the lantern; figures mirrored at their feet through the wet mask. The lantern also lights Lamb
    (peoplelayer passes globalThis.__lwCarriedLights to the drawer). ?light=0 turns the layer off.
26. DONE Glyph mode, a second look beside Oil and Ink (coordinator, 2026-10-21, from the x-research
    GAME.md items 4 and 5 and its notes; the author confirmed the ASCII MMORPG as inspiration):
    game/engine/paint/glyph.mjs (glyph shape vectors in six staggered circles, normalised per
    component, nearest glyph through a 2^18 cache; a four-direction edge vote that sets line glyphs)
    and glyphlayer.mjs (the scene read back at two by three samples a cell, a fixed tone curve, type
    in each cell's colour on an ink ground; people set heavier and brighter from their own canvases'
    alpha). It shares the painter's rule: the grid is anchored to the plate's pan, so a still camera
    never changes a glyph. ?look=glyph, or globalThis.__lwLook = "glyph" at run time. Not built yet:
    Harri's outer contrast circles, a key binding, and the blind A/B the research note asks for.
27. DONE Measured (design/RENDER-TARGET.md section 5): stability passes against a failing control;
    the figure-to-ground band is now met by all eleven captured figures; silhouette contrast is level
    overall (up in talk and the Brine, down in the rain); painter 2.7 ms a quay figure, light layer
    1 ms, glyph layer 21 ms on the CPU. Fixes found by looking at stills: a lift toward the figure's
    mean turned black hats grey (massing is now relative to each stroke's own value); lone dark
    pixels painted over unless they belong to a line; the lantern lights the ground only by default.
    Tools: timing.mjs, glyphstill.mjs, readability peak metric.
28. DONE Rebased onto dev after the gameplay lead's readability commit (carried figure light, cool back
    rim, brightness guard, hidden-body silhouettes): the painter runs before their brightness guard, so
    the guard caps the painted figure; the drawer's carried figure light is not taken as a scene lamp
    for the painted rim; the lantern pool is a quarter strength indoors (a full pool washed the Brine's
    wood pale). Visual check on this build: 6 of 7 pass; brine-bar fails on shadows off the floor, as
    it does on dev without this work (550 pixels here, 876 on dev). Before and after stills on the
    rebased build: game/capture/paint/before-dev, after-dev, after-dev2 (pairs inside).
30. DONE Rims together (author, 2026-10-21: "Keep both"): the warm painted rim is laid only on edges
    that face the ruling lamp; the far side belongs to the drawer's cool back rim, which the painter
    now keeps on the silhouette instead of averaging it into the coat; and where that cool rim already
    lifts an edge pixel the warm rim gives way. Captured over seventeen figures in six views: about
    400 to 1,700 warm rim pixels a figure, 0 to 96 yielded to the cool rim, none carrying both.
31. DONE Faces under the brim (author: "Ground only, like NRFTW"; Lamb is not lit by the lantern): a
    catch-light from the world on face strokes that face the eye and the ground (normals level or
    down, not grazing), lifted toward 2.2 times the ground's value with the place's light glazed in,
    then the face push and dark eye and brow accents. The lamplighters' faces now read as a lit plane
    over a dark eye band at play size (game/capture/paint/face1/pair-face-talk.png, before above);
    the value spread over face pixels rose in every one of seventeen figures (for example 0.82 to 0.94
    for Lamb talking), a measure the eye accents dominate, so the stills are the judge.
32. DONE Regressions the gameplay lead found after 024aeaa (coordinator, 2026-10-21):
    (a) Figure-to-room ratios up 0.1 to 0.2. Measured with the visual check's own ratios and a new
        --query option (tools/visual-check.mjs): the light layer moves no ratio (light=0 and full
        builds equal to 0.02); the rise came from the painter (massing, rim, catch-light). The painter
        is now value-neutral: a painted figure's mean never exceeds the drawer's own, and is held to
        1.45 times the ground when the drawer's is higher. Ratios now 0.36 to 1.38 over all views
        (unpainted drawer 0.43 to 1.61, Sabine at the bar over the band's 1.6 there).
    (b) brine-stove-chair shadows off the floor. With the check as it was at 024aeaa it is flaky on
        both builds: painted 4, 37, 39, 180, 265, 265 off-floor pixels in six runs (two over the 3%
        limit); unpainted 1 to 21 in six runs; unpainted with 30 ms of busy work added to each frame
        2, 4, 4, 180. The count follows frame time, not paint: the painted build draws slower, so the
        follow camera is further from rest when the check reads the plate (step 29). With the settled
        check: 0 off-floor pixels in brine-stove-chair in five runs, painted and unpainted.
    Visual check, this build: 6 of 6 pass, the control fails as it must.
33. DONE Glyph mode toward a full second style (author, 2026-10-21: "Develop it further"):
    - stable in motion: cells are patches of the plate, numbered from its corner and sampled in the
      plate's own pixels, so a pan carries each patch's glyph with it. Measured with
      tools/glyphmotion.mjs (Lamb walking back and forth, the camera following, 59 frame pairs, every
      one a camera move, about 530,000 ground-cell comparisons): 0.47% of ground cells change glyph
      against 13.1% for the screen-anchored control (?glyph=screen);
    - glyph-aware light: each lamp the place declares is set as a star in its own light with eight
      rays (glyphset.mjs); brightness sets ink through the fixed tone curve, so pools read as denser type;
    - readable figures: a figure cell puts down 2.9 times the ink of the ground cells two cells round it
      (same measure, mean over frames);
    - the UI in the same style (glyph.css): ink ground, paper text, the canon's Conso for every face,
      square ruled sheets, narration readable on the dark ground;
    - switch anywhere: F7, ?look=glyph, or globalThis.__lwLook.
    Cost: 25 ms a frame on the CPU at 1280 x 720 (the research note's 1.5 ms target is for the
    reference machine's GPU path, not built). Stills: game/capture/paint/glyph7, glyph8.
34. DONE Frame time per scene (author: "Keep full quality"; the painter keeps full resolution in rooms).
    tools/timing.mjs, headless Chromium, GPU off, 1280 x 720, mean ms between frames over four seconds
    (so these compare builds on this machine; they are not the game's rate on a GPU):

    | Scene | Before (drawer) | Painter | Painter + light | Glyph mode | Painter ms a figure |
    |---|---|---|---|---|---|
    | quay-walk | 63 | 71 | 78 | 97 | 2.9 |
    | quay-talk | 69 | 73 | 76 | 106 | 2.9 |
    | quay-fight | 61 | 67 | 70 | 87 | 2.3 |
    | quay-rain | 92 | 100 | 112 | 139 | 2.8 |
    | floor-dark | 34 | 37 | 43 | 63 | 4.0 |
    | brine-bar | 206 | 242 | 261 | 282 | 15.3 |

    The Brine's figures are about 2.5 times larger on screen; its 206 ms before any painting is the
    drawer's own software raster of three large figures. Rerun after any change that touches cost.
35. DONE The Brine's blown white "window" (coordinator review): it is the stove's fire opening
    (geo material stovefire), clipped to white by the bake. render/tools/softpanes.py repaints each
    clipped pane-sized region whose plate samples are mostly glass, window or stovefire: value
    brightest in the middle and held under 250, warm colour, structure (a sash's bars for a window, a
    grate of five uprights parallel to the far edge for a firebox, fitted to the region's slant), and
    a painter's horizontal lay-in; lit white walls, lamp heads, blackout and fog plates are left alone.
    Applied to brine/night and brine/wethour (originals in content/.pre-panes/). In game: no pixel of
    the opening is white; the halo round it stays (game/capture/paint/pane-game/pair-window.png).
36. DONE Glyph mode, structure first and cheap (coordinator review of glyph8/quay-talk: figures not
    findable, floor, wall and water not separated, 25 ms):
    - structure: each cell's kind comes from the plate's geo buffer, once per plate, variant, zoom and
      tide (glyphplate.mjs): floor, wall, slope, water, void; each kind has its own glyph family with
      few mid-tones (floor dots, wall uprights, slope slants, water tildes); a line glyph runs along
      every real break (a height step of 0.45 m across a cell, a floor's border with a wall or water),
      on its upper side; people are set in dense bright letters (o 0 O @ #) with the ground one cell
      round them dropped two steps and darkened; fighters are set in type too, and the lens's
      streaks are hidden in this mode (the lamps carry their own rays).
    - findability (tools/readability.py "region": the figure's mask against the ring 4 to 14 px out,
      Michelson of mean values), twelve figures in six views, glyph against painted:
      0.57 to 0.90 against 0.03 to 0.47; every figure higher in glyph mode than in paint.
    - stability in motion (tools/glyphmotion.mjs, 59 panning frame pairs): 0.24% of ground cells change
      glyph, against 15.8% for the screen-anchored control.
    - cost: the baked painting's part of every cell is read once per plate; a frame draws only what
      moves (light, weather, people, fight) at the sample size, shifts the last frame's pixels with the
      pan and rasterises only changed cells; the painter is skipped while the mode is on (the paint
      would never be seen). The glyph layer's own work on quay-talk: about 5 ms a frame (index 0.1,
      painting 0.6, moving layers 1.0 to 1.4, figures 0.3, setting 1.6, putting 0.9), from 25 ms;
      a further 4 ms the pass measures is the other layers' own drawing, flushed when it reads them.
      The quay-talk frame is 70 ms in glyph mode against 86 before (CPU, no GPU). Not met: the
      research note's 1.5 ms, a GPU-path figure.
    Stills (before above, after below): game/capture/paint/glyph13/pair-*.png.
37. DONE Glyph still-camera check (tools/glyphstill.mjs now waits for the follow camera to rest and
    reports the camera at both grabs): quay-talk, camera still, world clock held, five seconds: 22 of
    9,432 ground cells changed (0.23%; animated water mirrors and the lamps' glints), figures change as
    they breathe. On floor-dark the follow camera was still drifting 2 plate px after 300 frames, so a
    screen-cell comparison there is not a still test; the plate-cell motion measure (step 36) covers it.
    Visual check on this build (painted, the default): 8 of 8, controls failing as they must.
38. DONE Glyph as its own rendering pipeline (author, 2026-10-21: "It should not be a post-process shader
    either, it should be a full alternative rendering pipeline"). Design: design/GLYPH-PIPELINE.md.
    Built (game/engine/paint/glyph/, CPU reference path), replacing the earlier glyph layers that read
    the painted frame:
    - renderer interface (paint/renderer.mjs): Oil and Ink (the existing layers) and Glyph behind one
      switch; Glyph's renderFrame(scene, camera, lights, ui) reads only the scene: the place's geo
      buffers, its lights, the hour, the terms, the posed skeletons and the UI's DOM;
    - scene to cells (cells.mjs): per world cell the two main surface kinds, the cell's world point,
      normal and depth, thin things (a minority kind along a line) and height breaks;
    - materials (materials.mjs, kinds.json from the bake's kit): each surface family its own ramp,
      edge glyphs, world-tied motif and colour; emitters as light glyphs;
    - lighting (light.mjs): sky by the hour, every lamp with (1 - d/r)^2 and n.l, shadows marched
      through the cells' world points; the lantern per frame; light sets glyph density;
    - effects (effects.mjs, raster.mjs): glyph-shaped bloom and halation, wet-ground mirrored lamp
      streaks, rain as glyph particles, depth fog, an optional phosphor stage;
    - figures (figures.mjs): from each posed skeleton (the shared simulation; the figure drawer hands
      the skeleton over instead of rasterising in Glyph mode), capsules into cells, line glyphs along
      bones at the edges, a face glyph by facing, hat and tool glyphs, a lantern emitter, fight tells;
      a quiet ring round each figure; a figure is a lit mass of type on dark ground and a dark mass on
      bright ground;
    - UI (ui.mjs, glyph-ui.css): every panel drawn natively in the grid with box-drawing frames, its
      text at each character's laid-out place, meters as block bars, stacked as the page stacks them;
      the DOM stays for input, invisible; F7 switch, F8 presets (full colour, phosphor green, amber,
      ink on paper), F9 phosphor, a hint set in the grid.
    Measured (CPU): flicker while the camera follows a walk, world cells compared frame to frame,
    figures and panels left out: 0.03% of cells change glyph with hysteresis, 0.10% without.
    Findability (figure mask region against its ring, Michelson of mean value): in five still views
    glyph is above painted for 7 of 10 figures, near for one, below for two (Lamb at the bar, a grey
    figure on orange: it reads by hue, which the measure does not count; Lamb talking, 0.17 against 0.20).
    Glyph renderer CPU time about 6 to 15 ms a frame after a per-place bake of about 1 s.
    Stills: game/capture/paint/gpG/ (glyph), gpP/ (painted, same views).
39. DONE GPU path and GPU timings (coordinator, 2026-10-21: the GPU free after MMBU FT8; take
    the workstation GPU lock per job, under 45 minutes). Glyph's raster on the GPU (glyph/gpu.mjs, WebGL2): the
    cells go up as small textures, one fragment pass draws glyphs from an atlas texture with bloom and
    halation from a soft-atlas texture and the phosphor stage; the CPU raster stays the reference
    (?glyph=cpu); the two agree to a mean of 0.3 to 0.6 of 255 on still views. CPU side made cheaper:
    composed cells cached per world cell (recomposed only where the lantern's light changed), the
    shadow march's projection inlined, the display curve as a table, measure-only copies behind a flag.
    tools/gpu-timing.mjs (takes and returns the lock; ANGLE on D3D11, RTX 4090), 1920 x 1080:

    | Scene | Painted frame ms | Painter ms a figure | Glyph (GPU raster) frame ms | Glyph raster GPU ms | Glyph CPU ms | Glyph (CPU raster) frame ms |
    |---|---|---|---|---|---|---|
    | quay-walk | 90 | 6.2 | 16.7 | 0.30 | 2.2 | 16.7 |
    | quay-talk | 89 | 6.0 | 16.7 | 0.29 | 2.3 | 18.2 |
    | quay-fight | 89 | 6.4 | 16.7 | 0.29 | 2.5 | 17.5 |
    | quay-rain | 143 | 6.1 | 19.2 | 0.32 | 2.5 | 19.3 |
    | floor-dark | 36 | 8.1 | 16.7 | 0.29 | 2.2 | 16.7 |
    | brine-bar | 502 | 32.3 | 16.7 | 0.29 | 5.0 | 16.7 |

    Glyph holds 60 fps in every scene; its GPU work is 0.3 ms (the 1.5 ms target met for the GPU part);
    its CPU work, 2.2 to 5 ms, is not. Painted mode is far from smooth: the figure drawer's software
    raster of each figure on the CPU dominates (the painter is 6 to 8 ms of a quay figure, 32 in the
    Brine where figures are 2.5 times larger); its GPU path needs the figure raster itself on the GPU,
    which is the character pipeline's, not built. The Brine painted on the GPU-enabled browser ran
    slower than on the CPU-only one (502 against 261 ms), not yet explained. Glyph motion after the
    cache: 0.04% of world cells change per frame with hysteresis, 0.17% without.
40. DONE Regressions the gameplay lead found (coordinator, 2026-10-21):
    - Lamb pale and partly see-through at 1080p: the painter glazed every shadow stroke toward the
      plates' violet at the plates' strength, so a dark coat took the ground's own hue and read as the
      ground showing through. Figures now glaze shadows at 0.4 of the plates' strength (planes.mjs
      FIG_SHADOW) and keep their local colour. Before and after: game/capture/paint/r2/lamb3-*.png
      (unpainted, the merged painter, now).
    - stove-chair shadows off the floor: not reproduced on dev a571338 here (eleven runs, worktree and
      main-folder servers, 0 off-floor pixels each). Made exact rather than settled: the people layer
      records the camera it drew its figures with (canvas.dataset.view) and the check reads the plate
      through that camera, so no camera easing between drawing and checking can shift a shadow.
41. DONE Glyph UI and readability (coordinator reviews of gpG/quay-fight.png, 2026-10-21):
    - panels laid out in the grid by the painted UI's rules (glyph/ui.mjs layoutPanels): whole on screen;
      larger panels keep their places and a panel over an earlier one moves the least distance that
      clears every placed panel; the fight strip now sits above the place list, the chips beside each
      other, the talk page inside the screen; text past a frame wraps to the row under its line. The
      visual check judges glyph mode's UI (--query look=glyph): no two placed panels overlap, with a
      control that turns the layout off and must fail (it does).
    - every character has a glyph or a defined substitute (glyph/charset.mjs: arrows, minus, dashes,
      quotes, accents, a middle dot as the last resort, never "?"); tests/charset.test.mjs reads every
      string in the engine's sources and every .lwd file. The clock reads "↓ falling −0.53 m".
    - figures beat the ground on value and texture, not hue alone: the ground two cells round a figure
      is set no denser than sparse type, the cell next to it cleared, and the figure held at twice the
      ring's shown brightness (at least 60 of 255). Figure region against its ring, glyph against
      painted, five still views: glyph higher for 10 of 10 figures (Lamb at the bar 0.56 against 0.38,
      Lamb talking 0.62 against 0.22). Phosphor presets tint figures to their one colour.
    - fight tells in the view's hot colour, emissive, a doubled ring for blows that cannot be caught.
    Stills, all four presets, walking, talking, fighting and the Brine: game/capture/paint/gp7-*/
    (sheets in gp7-full/sheet-*.png).
42. DONE The ferry deck plate (design/PLACES-NEW.md section 1): render/worlds/ferry.mjs and
    render/places/ferry.mjs (after deck of the Saint Cuthwin seen from astern looking forward to the
    town, heeled 0.05 rad, rail, wheelhouse with the binnacle and its door ajar, funnel, masthead light,
    hatch, the bench by the starboard rail; spots rail, case, kit, wheelhouse_door, hatch; exit gangway;
    hide behind_wheelhouse). Baked at 2400 x 1520 into the main folder's content/ferry (night, dark, lens
    layers, geo buffers, place.json with marks and lights; 4 minutes at Idle on the CPU, no GPU).
    Glyph needs no bake of its own: it reads the same geo buffers and lights. Both pipelines checked in
    the game with an area made on the spot (tools/views.mjs PLATE, view ferry-deck):
    game/capture/paint/ferry-p/pair.png (painted above, glyph below).
    Also: the glyph UI skips panels the page has hidden (a talk page slid away was being drawn).
43. DONE The Guild hall plate (design/PLACES-NEW.md section 2): render/worlds/hall.mjs and
    render/places/hall.mjs on a shared cutaway room, render/worlds/_room.mjs (floor, the two far walls,
    low near sills, beams; wall and floor cuts). Long table, benches, the head chair, the brass plate,
    the two pans on chains, two hanging lamps. Variants early, vote and dark (a struck light). Baked
    into the main folder's content/hall; checked in both pipelines with view hall-vote:
    game/capture/paint/hall-p/pair.png.
44. DONE The smokehouse plate (section 3): racks of herring over the back half, the pit of oak chips
    glowing (coal with ember emitters, no flame), chimney, the soot board on the back wall, the fish of
    the year over its box, the corner sacks. Variants night and late (fire at 0.45). Baked into
    content/smokehouse; view smoke-night: game/capture/paint/sl-p/smoke-night-pair.png.
45. DONE The net loft plate (section 4): nets in swags from low rafters, the sack with the copper
    loop, waders, the coil, a shuttered lantern, the hatch cut in the floor with the ladder and the
    lane's light coming up through it (the lane itself is not modelled). One night variant, very dark
    by design. Baked into content/loft; view loft-night: game/capture/paint/sl-p/loft-night-pair.png.
    The plate areas copy the first area's zoom; the gameplay lead sets the scale when wiring.
46. DONE The "F7 type" hint no longer sits on every painted screen (gameplay lead's UX walk): Oil and
    Ink shows "F7 switches to type" once per viewer for 6 s, and any key or click dismisses it
    (?tips=0 hides it). Glyph mode keeps its key row in the grid.
47. DONE The camera frames a fight (gameplay lead's UX walk, first quay fight: the fighters small at
    the top right, the empty quay in the middle). Cause: world/camera.mjs frame() never came in past the
    area's walking closeness, and ui/worldlayer.mjs clearOfPaper grew the fight bounds by the strip's
    size, which moved their centre down and left. Now a fight's bounds carry close (1.6: the view may
    come in to 1.6 times the walking closeness) and free (the view clear of the strip, the keys, the
    HUD tab and the chips, from ui/worldlayer.mjs freeOfPaper), and frame() centres the fighters in
    the clear part. Runs and sneaks are unchanged. Before, after, and after in glyph:
    game/capture/paint/fightcam-after/before-after.png.
    Visual check: painted 8 of 8 and glyph 8 of 8, controls failing. The glyph control
    (control-glyph-panels-overlap) no longer relied on the page overlapping by itself (dev's UX pass
    moved the place list away, so the control had passed): it plants two panels one over the other.
    Its first plant used position: fixed and showed the glyph UI skipped every fixed panel
    (offsetParent is null for them); fixed panels are now drawn.
48. DONE The weigh-house roof (section 5): wet lead behind a coped parapet, the drainpipe at the +x
    corner, the town balance (oak beam on a mast-thick post, falling 0.16 rad toward the harbour, iron
    pans on chains, the hook on top), the quay 7 m below with its sodium. Variants night and frost.
    Content/roof; view roof-night: game/capture/paint/rw-p/roof-night-pair.png.
49. DONE The weigh-house office (section 6), plate id weighoffice: desk under the window with the green
    blotter and the BOARD, WORKS drawer, the chair with its drain hole over a tin basin, the shelf of red
    ledgers, the yard's sodium through the window, the tube room's door. One night variant.
    Content/weighoffice; view weighoffice-night: game/capture/paint/rw-p/weighoffice-night-pair.png.
    design/STATE.md has the six plates with their marks, and the interface changes.
50. DONE Glyph night legibility (coordinator: the ferry's glyph frame almost all black). A measure,
    game/engine/paint/glyph/legibility.mjs (renderer.measure()): over the world cells on screen,
    figures and panels left out, the share of structural cells (a change of surface kind, a depth
    jump of 0.6 m, a break, a thin thing, the edge of the void) that read: the neighbour across
    differs by 6 display levels, or one side shows type and the other none, or both show different
    glyphs. Also coverage (cells showing type), the median and 90th percentile cell value, and the
    rank correlation of value with light. Tool: paint/tools/legibility.mjs runs every wired area at
    night and the six new plates' variants (19 plate-variants).
    Two treatments, tested apart and together (arms by ?glyph=nofloor / noglow / glow):
    - the night floor (compose.mjs FLOOR): a cell the light leaves empty draws its contour (on a change
      of kind or depth, the nearer side, | / - \ by the neighbours that differ) or its material's
      faintest glyph, at a low value in its own hue;
    - layered glow (glyph/glow.mjs, after the author's Trace ASCII note: three blurred layers round
      emitters and lit type, warm core, rose skirt, cold breath, added to type and ground).
    Mean over the 19 (structure / coverage / median / p90 in display levels):
      neither 0.727 / 0.619 / 22.0 / 73.3;  glow only 0.733 / 0.624 / 24.0 / 81.6;
      floor only 0.885 / 0.707 / 23.4 / 73.7;  both 0.886 / 0.710 / 25.3 / 82.1.
    The floor carries the legibility (every plate up, worst 0.477 to 0.763, the loft) with the median
    up 1.3 levels and the 90th percentile unchanged, so the darks stay dark. Glow adds 0.006 structure
    for 8 to 9 levels more light in the lit tenth: it brightens what already reads. Default: floor on,
    glow off (kept as ?glyph=glow, a style choice for later). Rank correlation with light falls
    (mean 0.86 to 0.75) where the floor lifts the darkest cells to one value; ferry 0.79 to 0.50 and
    the weigh-house office 0.45 to 0.38 are the lowest.
    Stills: game/capture/paint/legible-noglow/before-after-sheet.png (before left, after right:
    ferry, hall dark, loft, smokehouse, Gut, harbour office); per arm in legible-<arm>/.
51. DONE Visual check gate for dark plates (glyph mode): tools/visualcheck/analyse.js reads what the
    glyph raster drew (the frame's cells and the atlas's ink) against the plate's own geo buffers, with
    its own copy of the rule, and fails a view under 0.75. Glyph views now score 0.80 to 0.93; without
    the floor the harbour office scores 0.725 and would fail. New control control-glyph-dark-plate
    (floor off, exposure 0.05): 0.649, fails as it must. Captures pass ?tips=0 so the F7 tip stays out
    of stills; tools/tipcheck.mjs confirms the tip shows at 3 s on a first visit, has faded by 7.5 s,
    and does not show on the second visit (the ferry still with the tip was taken at 09:02, before the
    tip change).
52. DONE Act 2 night interiors (design/STATE.md has their marks): crakehall (lit, switched), crakestudy
    (lit, switched), substation (test, unlit), vestry (candles), telegraph (open, shut), gannet (night).
    Views crakehall-lit and the rest in tools/views.mjs; stills game/capture/paint/a2-p/.
53. DONE The hill's lane had no walkable ground from x -7 to 19: content/hill's geo buffers were stale
    (153 000 samples with no hit in the middle). A fresh bake has the lane end to end; the station door
    mark (3.2, -1.9) is walkable at h -0.36.
54. DONE Variants named dark were overwritten by the blackout plate at every bake. bake2 refuses the
    name; renamed (hill switched, station cut, ropewalk doused, lamp unlit, stairs unlit, gut blackout,
    hall struck); the wiring's `variant: dark` lines need the new names (STATE.md).
55. DONE The Spit's camouflage: frost rime was laid where a 9-per-metre noise crossed a threshold,
    which made 10 to 30 cm white blotches tinted by each lamp. Now a fine hoar grain (a hash per 2.5 cm,
    densest on flat tops) under a lifted film. Visual check: painted views fail when compact blotches
    cover over 2 percent of the surfaces' interiors in view (old Spit frost 2.56; clean views 0.07 to
    1.02); control-camouflage plants them and fails. Frost variants of every plate are baked again.
    Before and after: game/capture/paint/spit-a2-old.png, game/capture/paint/spit-frost-after.png.
56. DONE The quay's dark.png "cannot be decoded": the file is valid (8-bit RGBA, 4800 x 2560, no
    interlace, one IDAT, CRCs good) and decodes headless alone and after 42 other plates. Chrome says
    the same for a 404 or a half-written file; bake2, restreak and softpanes now write beside the name
    and rename over it.
57. DONE Ways out in glyph mode (gameplay lead: the chalked outline sat on the fight canvas under the type).
    The glyph renderer reads the fight's exits itself (paint/renderer.mjs waysOut: the outline on the
    fight's ground and the arrow, as ui/fightways.mjs chalks them); paint/glyph/marks.mjs draws them in type over world and figures, under the
    panels: a dashed border of slope glyphs (- | / \), the arrow as a line ending in an arrow glyph, chalk,
    hot while Lamb stands in the exit. Visual check (glyph, in a fight): each exit's outline walked on the
    fight's own ground, mapped to cells; under 60 percent showing a light line or arrow glyph fails (cells
    under a panel left out). fight-against-a-wall 0.88; control-glyph-ways-hidden (layer off) 0.38, fails
    as it must. Still: game/capture/paint/ways-g/quay-fight.png.
58. DONE The painter's determinism (performance engineer's finds, design/STATE.md 1 and 2):
    - painter.mjs keeps a copy of each birth direction: birthDir hands back the shared form array on a flat
      patch, so any later birth on any figure rewrote it. paint/tests/determinism.test.mjs paints figure X
      on two painters, one with another figure between X's frames and X's size changing each frame: 0
      differing bytes with the fix, failing without it.
    - palette.mjs blends at the minute it caches (it stored the first exact hour asked): the same test
      imports two copies of the module, as two threads, and asks different seconds of one minute first.
    - In the game, ?figs=verify (worker against main thread): 0 differing bytes over 121 fight frames, 313
      Brine frames and 194 talk frames.
59. DONE Exact painter speedups (offered by the performance engineer; written here, not copied): strokes.mjs
    keeps the eight frames of the last 256 base cells, direct-mapped, emptied by any cache change; births
    look a cell and group up once per run of pixels sharing it. paint/tools/painthash.mjs (three figures,
    24 frames, sizes and poses changing): hash e8176b65996a4395 before and after; best of 7 runs 2302 to
    2087 ms and 2426 to 2089 ms (9 and 14 percent), on a loaded machine.
60. DONE The visual gate made deterministic (performance engineer: crowd-of-four failed 1 of 4 runs and
    fight-against-a-wall 2 of 4 on an unchanged build). Two sources of run-to-run difference: the walk's
    end (frame-timed: under load Lamb stopped 0.02 to 0.1 m off, which moved shadows and overlaps), and
    figure images from workers arriving a frame late or not at all. The check now draws figures in the
    frame it judges (?figs=sync; worker images are proven identical by ?figs=verify, step 58), and every
    walking view puts Lamb where its walk ends on a quiet machine (tools/visualcheck/views.mjs PUT).
    Three runs of the five walking views under full load (Idle bakes running): 15 of 15 pass, and the
    measured numbers agree run to run (luminance ratios within 0.03, shadow pixels within 3 percent).
61. DONE The Gut in Oil and Ink (Act 3's gale fight showed flat palette blocks under a dither screen, which
    read as a failed plate): it was the Gut's palette-locked first take, never painted. render/places/gut.mjs
    now traces, shades and paints it like every plate (night, rigged, frozen, blackout; wire lamps, door
    light, the gutter's glow, the moon); the palette take is places/gut_palette.mjs, and palette plates
    are brushed and inked by default if ever baked again. Still: game/capture/paint/gut-a3-after.png.
    Gate: painted views fail on a dither screen (mean |L - median3| / (L + 8) over surfaces: painted plates
    0.001 to 0.019, the palette Gut 0.08 to 0.11; views 0.002 to 0.008; limit 0.04) or an empty plate;
    control-unpainted lays a 4 x 4 ordered-dither screen over the plate (0.127) and fails as it must.
62. DONE The quay-rain hitch (performance engineer: one frame of about 550 ms every four seconds with
    figures off). Cause: ui/weatherlayer.mjs rebuilt its whole water and fog field (the geo buffers' size,
    3 million samples on the quay, each looping over the sodium lamps for the fog's glow) every time the
    tide moved a centimetre. Now the per-sample fog weight and glow are worked out once per plate, and a
    new field is built a band of rows at a time inside 4 ms a frame while the last one stays on screen.
    tools/bench.mjs, GPU on, quay-rain, figures=plain: before mean 18.87 ms, worst frame 483 ms; after
    mean 16.67, worst 16.8.
63. DONE The tone map as the glyph pipeline's explicit intermediate (after the author's Trace ASCII note):
    compose.mjs quantises every world cell's lit value to 16 levels (glyph/tonemap.mjs TONES), held by
    hysteresis, stored per frame (state.buf.T, 255 where no surface); the glyph and colour after it are
    the style's. Styles are data: glyph/styles/*.json (full, trace, green, amber, paper), F8 cycles them,
    ?glyphstyle= picks one; a test per style (paint/tests/styles.test.mjs). The trace style takes one
    16-glyph ramp for every surface from measured ink coverage in the game's own font
    (paint/tools/density.mjs -> glyph/styles/density.json: " -`_,=!cz}]uKdN&", coverage 0 to 0.345)
    with the layered glow on. Full colour looks as before (materials' own ramps read from the tone map).
    Stills: game/capture/paint/style-trace/pair.png (full colour left, trace right).
    Two corrections found by the dark-plate control (it passed after the change): hysteresis is one tone
    level wide (scaled to the old ramp's width it held level 1 forever), and a material's step is taken
    from the tone biased dark (tone 1 stays empty, as the old first step did). Glyph gate 8 of 8 with every
    control failing (dark plate 0.435); glyph motion flicker 0.0004 (no hysteresis 0.0007).
64. DONE The ferry's sea (gameplay lead: flat navy, no surface): a swell and a chop as ripple normals that
    the lamps' highlights also break on (render/v2/shade.mjs: a place's rippleLight lights wet ground with
    the rippled normal), and the moon low ahead. Frost variants of every plate baked again with the
    hoar grain (spit, hill, quay, mole, gasholder, ropewalk, roof, lamp, stairs); none shows the blotches
    (compact blotch share 0.0003 to 0.0067 of surfaces, whole plate).
65. DONE The plate lock (coordinator's decision: plate binaries stay out of git). content/PLATES.lock lists
    every file of the 36 plates (509 files: path, sha256, size) and each plate's recipe: its place source
    and world files with their hash, the paint seed, the variants, the bake and restreak steps, the
    pipeline's hash (bake2, v2, kit, places/_common) and the raw-native revision. render/tools/plates.mjs
    lock | verify | rebake: verify checks a copied set (all 36 match today); rebake bakes from the recipe
    any plate with a missing or differing file (a rebake is new art, not the locked bytes: lock again
    after). paint/tests/plates.test.mjs fails when a tracked place.json or a wired plate is not in the
    lock, or the lock lacks a variant's plate, the blackout plate or a wired plate's geo buffers.
    After every bake: node render/tools/plates.mjs lock --content <main folder>/content.
66. NULL The GPU painter, first stage: membership on the GPU (paint/gpu.mjs, WebGL2: each pixel's stroke from
    the same 32-bit hashes, birth directions as an open-addressed table), read back for the CPU's per-stroke
    means and laying. Off by default; installPainter({ gpu: true }) turns it on.
    - Agreement: under SwiftShader the GPU path's images equal the CPU's byte for byte (72 frames). On the
      real GPU (ANGLE on D3D11) membership differs on up to 0.9 percent of a figure's pixels (edge pixels
      falling to a neighbour stroke, float32 against float64), and from one shared state per frame the
      worst frame reads off 2.1 percent, SSIM 0.915: outside the budget (2 percent, 0.97). The stroke-order
      control (paint order reversed) reads 3.9 percent, SSIM 0.903: it fails, but not by much more than
      the honest path, so the budget would need a better discriminator before it could pass a GPU path.
      paint/tools/gpuverify.mjs measures all of this.
    - Speed: slower. Per figure (three figures, sizes 87 to 230 px a metre): CPU 22.7 to 28.6 ms, GPU path
      30.2 to 31.6 ms. The membership pass costs 9.3 ms a figure, almost all of it four synchronous
      readbacks (one per layer); the CPU's strokeAt and frame building are about 29 percent of the
      painter's time, so even a free pass would save under a third.
    - In the game (tools/bench.mjs, GPU on, three runs' worth of frames each; ?paintgpu=1 turns the stage on):
      painter ms per figure quay-fight 28.8 to 22.0, quay-brawl (nine figures) 26.0 to 22.5, brine-bar 6.8
      to 5.1 (13 to 24 percent less, the figures painting in workers); frame mean and p95 unchanged:
      quay-fight 16.74 / 16.8 both, quay-brawl 29.1 / 33.4 against 29.2 / 33.5, brine-bar 16.81 / 16.7
      against 16.74 / 16.7. The brawl's 29 ms is not the painter's.
    - So the gain needs the whole painter on the GPU with one readback a figure (or one frame late): stroke
      sums by scatter into a bind-space cell grid (float blending), the per-stroke paint (value planes, rim
      mass, broken colour, the pigment glazes, catch-light, face push, settle history) ported to shaders,
      and the laying pass ping-ponged between layers. Days, not hours, and the D3D11 precision difference
      above would stay. Recorded as a null for the first stage; the full port is a decision for the
      coordinator.
    Decision (coordinator, 2026-10-21): the full GPU port is deferred; frame times do not move (quay-fight
    and brine-bar already hold 16.7 ms; the brawl's 29 ms is the main thread). Stage 1 stays off. The
    verify's discriminator is weak: the reversed stroke order reads 3.9 percent off against the honest
    path's 2.1. If revisited: membership in fixed point with a deterministic tie-break, so float32 and
    float64 agree by construction; and a sharper verify first (per-stroke assignment agreement, not pixel
    SSIM).
67. DONE Shape-aware glyphs (the author's reference videos; coordinator's queue item 2). Each glyph's ink is
    measured in a 3 x 4 grid of its cell (atlas.desc); under each world cell the plate gives the same grid
    (glyph/cells.mjs occ: is the sample at each part's centre the cell's own surface), and a figure gives
    its cover from its capsules. glyph/shape.mjs picks, among marks with a clear side or slope and the
    dense glyphs (no letters), the one whose ink pattern correlates best with the cover, less 2.5 per
    unit its ink is off the tone's. ?glyph=noshape is the before.
    Tested three ways on the night plates, judged by eye and by the measure: (a) every partly covered
    cell shaped, outlines included: outlines broke into faint marks (dots, ticks, letters matching a
    corner) and read worse than before; (b) outlines matched to the cover's boundary among line marks
    only: still broken into ticks and corners; (c) outlines keep their slope glyphs, and only a lit
    surface's partly covered cells and a figure's edge cells take a shape. (c) is kept.
    Measure (glyph/legibility.mjs outline: the correlation of a cell's glyph ink with the cover under it,
    over partly covered fill cells and figure edge cells; 7 night plate-areas), before -> after:
    world fills 0.013 to 0.181 -> 0.219 to 0.352; figure edges -0.128 to 0.097 -> 0.032 to 0.295;
    structure (step 50's) mean 0.906 -> 0.919. Glyph gate 8 of 8 with every control failing; motion
    flicker unchanged (0.0004). Stills: game/capture/paint/shape-before/, shape-after/ (hall-ab.png
    side by side). A figure now shows its coat's edge as [ ( / on the side it covers, and a cell its
    centre misses but its edge crosses is drawn too.
68. DONE Per-part charsets for figures (queue item 3, after the 1-bit object-ID reference). The world already
    speaks by material id (glyph/materials.mjs: a language per family, with motifs: brick courses, plank
    grain, cobbles, slates, ripples, weed). Figures now key on the part (coat, trousers, boots, hands, hat,
    head, tool): each part its own glyphs, the step chosen by the part's form (a pseudo-normal from the
    cell's place across the limb or body, lit from above, front and left on screen), and the part's value
    turned by the same shading. ?glyph=noparts is the before.
    Tested two ways: (a) ramps from light to dense type ("+xX#M" for a coat): parts told apart, but the
    figures read as noise rather than masses; (b) dense steps only ("&MW", "HH#", "mm@", "oO0", "==#"): kept.
    Measure (glyph/legibility.mjs, four night plate-areas with their people): parts read (where two parts of
    one figure meet, the type differs in glyph or by 16 levels) 0.917 to 1 -> 0.983 to 1 (quay 0.917 ->
    0.983, brine 0.966 -> 1); figure against ground (__lwGlyphSep, held at 2 or more by step 41's rule)
    2.32 to 5.07 -> 2.38 to 4.93; outline (step 67) unchanged within 0.05. Glyph gate 8 of 8 with every
    control failing. Stills: game/capture/paint/parts-before/, parts-after/ (quay-ab.png; the people's
    poses differ between runs, they walk).
69. DONE Glyph water and wet Gullet (queue item 4).
    - Glyph water (glyph/water.mjs): the harbour's tide now shows in glyph mode (it was only the painted
      weather layer's): every cell under the water level (the plate's datum and the tide, as the weather
      layer reads them) is dark water with slow ripple marks, as is the plate's own water. Over it the scene
      is mirrored: in this orthographic view a vertical line stays a screen column, so each water cell shows
      the cell as far above its column's shoreline as it lies below; ripples shift the source a cell sideways
      by the water's world position and the time, a far reflection breaks to "~" every third row, slopes flip,
      the type is dimmed and cooled with depth, lamps and windows less so. Figures reflect (it runs after them).
      ?glyph=noreflect is the before. Stills: game/capture/paint/water-before/, water-after/ (quay-rain at
      +1.57 m: the harbour dark water with the quay wall and the people mirrored, rain-crop.png).
    - Wet plates (render/v2/shade.mjs rippleAniso): wet ground's ripple stretched along the view (3 times) with
      a fine cross ripple, so a lamp's or a window's reflection draws out into a broken streak instead of a
      round puddle mirror. The quay's rain variant is baked again with it. Before and after (preview scale):
      game/capture/paint/wet-ab.png.
70. DONE World-anchored blue-noise dither (queue item b). glyph/bluenoise.mjs: void and cluster written from
    the method's description (a 64 x 64 tile; paint/tests/bluenoise.test.mjs: every rank once, the darkest
    tenth no two closer than 2 cells, a fifth or less of white noise's low-frequency power). compose.mjs adds
    its offset to the tone before rounding, by WORLD cell, so a gradient breaks into an even scatter of steps
    that stays on its surface. A style parameter (dither, in tone levels): the trace style takes 1.0; full
    colour none. Glyph motion (Lamb walking, camera following, 80 frames, trace style): flicker 0.0133 without
    dither, 0.0138 world-anchored, 0.0258 screen-anchored (?glyph=screendither, the control): the anchored
    dither costs almost nothing in motion, the screen one nearly doubles the flicker. Stills:
    game/capture/paint/dither-on/ab.png (off left, on right).
71. DONE The Daybook map as a riso print (queue item d; paint/riso.mjs, called by ui/map.mjs, ?riso=0 the
    before): the chart in two inks on the Daybook's paper. The town's lines stay in line ink; a second drum
    in oxblood carries the ways Lamb has walked and a halftone disc under each district Lamb knows (larger
    and denser where Lamb stands), off register by 0.5 to 1.5 px; the sea a teal halftone screen (dots on a
    45-degree grid); the sheet a faint fibre (turbulence, multiplied) and the light of two folds. Pure SVG:
    it scales with the page. Stills: game/capture/paint/map-ab.png (before left).
72. DONE Fake shadows and fog in glyph space (queue item 4 of the second list). Fog already thins type and
    lifts it toward the fog's colour with depth (compose.mjs). Figures now cast a contact shadow in type: an
    ellipse under the feet, cast a little away from the light, where the ground's glyph thins to a sparse
    mark and its ink drops to half (?glyph=noshadow the before). Still: game/capture/paint/gshadow-after/zoom.png.
73. DONE A/B: glyph world with painted figures against all-glyph (queue item 5; ?glyph=paintfigs is the
    hybrid). Four views (quay-talk, quay-rain, brine-bar, floor-dark), 11 figures, tools/readability.py:
      painted                          outline found 0.795 (min 0.662)  region contrast 0.306 (min 0.059)
      all-glyph                        outline found 0.612 (min 0.392)  region contrast 0.475 (min 0.145)
      glyph world + painted figures    outline found 0.845 (min 0.529)  region contrast 0.223 (min 0.040)
    The hybrid's painted outlines read best against type, but the figures' value sits close to the busy
    ground (region contrast the lowest of the three, one figure at 0.040), and by eye the two languages
    clash. All-glyph keeps the strongest figure-ground separation (step 41's rule). Default stays all-glyph;
    the hybrid is kept as an option. Stills: game/capture/paint/ab-hybrid/abc.png (painted, glyph, hybrid).
74. DONE The Old Light plate (Act 3: the eye scene played over Lamp Quay's picture). render/worlds/oldlight.mjs
    and places/oldlight.mjs: the drowned lighthouse cut open on its rock in flat black water; the old doorway
    with its hinge-pins and green paint, the flooded passage with the green door fallen across under a foot of
    water, the middle room with the bronze turning gear, the broken stair round the back wall, the low room a
    step down with fresh soot, the boat at the base. One plate for oldlight_door, oldlight_mid, oldlight_low,
    oldlight_stair and eye_water. Variants eye (starlight) and strippers (their two lanterns by the gear).
    Marks: spots door, doorway, gear, stair, low_room, low_corner, boat; exits water, stair_up; hides
    behind_gear, under_water. Baked into content/oldlight and locked; view oldlight-strippers in both
    pipelines: game/capture/paint/ol-p/pair.png (the test area copies the quay's zoom: set the area's scale
    when wiring).
75. DONE Dithered smoke and steam (queue item 6). paint/smoke.mjs: puffs in world space rise from every fire
    light of a plate (stoves, pits) and from smoke marks (place.json marks.smoke; the ferry's funnel), drift with
    the wind, swell and thin. Painted mode (ui/weatherlayer.mjs) draws them dithered: the puffs' density summed on
    a 2-plate-pixel grid and thresholded by the blue-noise tile at world-fixed plate pixels, in two inks. Glyph mode
    sets sparse marks (. : ; ~) where the density beats the blue noise at the world cell. ?smoke=0 is off, and the
    visual check runs with it off (puffs move with frame timing). Stills: game/capture/paint/smoke/pair.png.
76. DONE The Gut's gutter violet (it came out cream: an emitter in the shader takes its light type's spectrum, not
    its paint). The gutter is now a pale violet paint lit from just above by a row of small lamps, violet by
    reflecting them. Gut rebaked.
77. DONE The dream look (the story lead's precognitive dreams; paint/dream.mjs). Hook: globalThis.__lwDream.set(k)
    (0..1, ease as you like), .cue() for the recognition cue (the dream look for one frame, then straight back),
    ?dream=0.8 for stills. Painted: the brush painter loosens (strokes 1.9 times longer at full dream, broken
    colour 3.5 times stronger), the colour drifts off the hour's palette (a slow hue drift, less saturation,
    a little brighter), the edges go soft (a blurred vignette ring under the paper); the paper UI stays sharp.
    Glyph: the tone map washes toward its middle, about half the type goes missing by world-anchored blue
    noise, the rest drops a step or two lighter; the grid's panels stay sharp. Stills:
    game/capture/paint/dream-0.85/sheet.png (awake and dreaming, both modes).
78. DONE 4K proof (coordinator: one or two act-1 places, settle the pipeline and the cost, then stop).
    - render/bake2.mjs --preview 2 --hires bakes the colour plates only (variants, lens layers, blackout) at twice
      the size into content4k/<plate>/; the 1x place.json and geo buffers serve both. ui/platecam.mjs loads
      content4k when the window is over 2600 CSS px wide (?hires=1 forces, ?hires=0 never) and falls back per
      plate; its plate-colour reads stay at plate pixels. The game's servers mount /content4k/.
    - Cost: the Alderman's study, 4000 x 3000, 654 s (its 1x bake took 526 s on a loaded machine): the shade
      dominates, so 4K costs a few times 1x, not sixteen. The quay at 4K (9600 x 5120, night) runs through the
      queue below. Still: game/capture/paint/k4-hires=1/ab.png (a 4K screen, 1x plate left, 4K plate right).
    - Glyph at 4K: cellScale (cells twice the size over 2600 CSS px, ?glyphcell= to choose), and the grid's
      panel text now keeps one character a cell in order when the page's type is narrower than a cell (it
      dropped every other letter at 4K). Still: game/capture/paint/k4-glyph/.
79. DONE Long bakes in pieces (coordinator: under 10 minutes each, checkpoint and resume, so a bench gets a
    window). render/tools/bakequeue.mjs runs a bake as short heavy-cpu lock jobs: the shade in bands of rows
    (bake2 --band a:b, written into the kept tmp files at their offsets), then the geo buffers (--only assemble),
    each variant's paint and lens layers, the blackout, then streaks and the plate lock; finished pieces are in
    render/.tmp/<place>/queue.json and a rerun resumes. Checked on the vestry: geo ids and the plate equal the
    single-run bake byte for byte. The two quay jobs running outside the lock were stopped by PID; the rain
    variant had finished (its streaks and the lock done), the 4K quay restarted through the queue.
80. DONE Ink-blot transitions (paint/inkblot.mjs): between places an ink blot spreads over the view from a
    point, its coast ragged by a fixed value-noise field (the ink runs ahead along low ground), covers, the new
    plate loads under it, the ink draws back; globalThis.__lwInkBlot.faint() for fainting (cover, hold, reveal
    slowly). Captures and ?blot=0 cut straight. Stills: game/capture/paint/blot-sheet.png.
81. DONE Night crowd readability (the night-crowd reference; the nine-figure quay brawl). Painted (its own canvas, paint/decals.mjs installDecals, so the fight layer is untouched): every
    opponent's wind-up is written on the ground (paint/decals.mjs): a ring in the hot colour that tightens and
    brightens as the blow comes, dashed for a grab, doubled when unstoppable, and a wedge along the facing;
    ?decals=0 is the before. Glyph: figures are drawn far to near, and where two overlap the farther one's cells
    along the nearer one's edge drop to a dark line, so a press stays separate shapes. Stills:
    game/capture/paint/crowd/sheet.png (painted without and with decals, glyph).
82. DONE The 60 s camera path tool (game/engine/paint/tools/trailer.mjs): three 20 s segments (quay, the Brine,
    the ferry deck), Lamb carried along a spline with the game's follow camera held and advanced 1/30 s a frame,
    one still a frame, H.264 by ffmpeg, each segment of each mode its own heavy-cpu job, finished ones kept,
    then the 60 s cut per mode. Lamb glides (no walk cycle is driven); recorded in the background.
83. DONE Painted dialogue portraits, second pass (new rendering lead from here; the first sheet,
    game/capture/paint/portraits/t.png, read as painted puppets: blank eyes, Fennick's stalk neck, cloth smeared
    flat, skin one waxy ramp). paint/portrait/: sit.mjs frames a sitter (eyes at 40 percent, the view 0.66 m) and
    measures the visible neck in the picture, shortening it past 0.32 of the head's length by compressing the
    rows between jaw and collar (Fennick: 318 px to 97); study.mjs is the value design (one key, a flat cool
    shadow family with warm reflected light, three planes in the light, the forehead yellow, the middle of the
    face red, the jaw cool, a warm terminator, cloth folds bent into the normal from a fold field deepened by
    cavity, the ground counterchanged); brush.mjs lays curved strokes along the structure tensor, coarse to fine,
    each finer layer only where the canvas is still wrong, with bristles, a dry tail and a paint height lit at
    the end; eyes.mjs opens a hidden eye into an almond (the old heads' eyes sit under the brow) and paints the
    white, iris, pupil, lash line, lower lid and catch-light; mouth.mjs turns the corners by mood. Moods from
    the voice bible's portraitCue at intensity 3 (moods.mjs: neutral, warm, anxious, angry, grieving, afraid,
    contempt, lying). The sculpted heads through LW_SCULPTED_HEADS=1. Sheets: game/capture/paint/portraits2/
    sheet-neutral-0..2.png (first pass, second pass on the old heads, second pass on the sculpted heads, all 36).
    Tests: paint/tests/portrait.test.mjs (eyes found and opened, a modelled open eye kept as the control, mood
    mapping, R4 below).
84. NULL Appeal test P1 at panel size (render/appeal/PROTOCOL.md, committed before any stimulus at e681d3f;
    three fresh viewers, seeds 601 to 603). The painter control failed: the second pass was chosen as "more
    like a painting a person made" 6 of 24 (0.25, Wilson 0.12 to 0.45) against the first pass. The viewers
    named the first pass's looser, more varied brushwork and the second pass's smoother rendered look. By the
    pass lines task S then decides nothing and the dialogue box keeps the old heads. Reported anyway:
    sculpted against old, same painter, S1 real person 21 of 36 (0.42 to 0.73), S2 rather talk to 17 of 36
    (0.32 to 0.63), S3 emotion 27 of 36 (0.59 to 0.86): the sculpted heads carry emotion better; the viewers
    marked down the old heads' red bulb noses and the painted "goggle" eyes. Defect seen before the run and
    left in for both sets: on a few old heads the opened eye's iris paints too bright (Crake, Gorm). What it
    changes: the painter's next pass keeps the eyes, necks and value design and gives back the loose
    brushwork (fewer fine layers, larger strokes); P2 is a new round. Results: render/appeal/results/.
85. DONE The painted dialogue box (paint/portrait/box.mjs, box.html, tools/boxshots.mjs): a dark board in broad
    strokes with a ragged painted edge, the portrait in an arched window, the name on an ochre stroke, the
    line in Hanken. Glyph look: the box in box drawing, the portrait set in half-size cells; it does not read
    yet (a dark portrait spans too little of the ramp) and is handed to the glyph lead. Stills:
    game/capture/paint/box/sheet.png, sheet2.png, sheet3.png.
86. DONE The Quota slice plates (render/worlds and places, ids as game/engine/wiring/quota-areas.lwd names them):
    q_square_wide and q_square_wide_quiet (the bell tower at dawn, the export train and the empty siding; the
    relief queue is the crowd tier's cards on marks.queue.path inside marks.crowdMask, counted by the street
    stocks), q_haldane (dawn, five bowls) and q_haldane_coda (a week later, four, the fifth turned over on the
    Well shelf), q_furrowe_kitchen, q_brack_kitchen (the cupboard under the stair), q_returns (the counter, the
    ledger, the district map), q_post (the barrier, the hut, the Haldane cart), q_granary (the door at night,
    the yard open for the fight) and q_exchange (the weigh-house re-dressed; its night plate unchanged).
    Previews at half size baked (render/preview/v2/q_*); full bakes through render/tools/bakequeue.mjs are next.
    Known: the dawn square still reads flat (cast shadows faint under the frost), the coda and Furrowe windows
    were fixed after their first previews.
87. STARTED The paint language (author, 2026-10-21: brush expression as a vocabulary): design/art/PAINT-LANGUAGE.md;
    render/v2/language.mjs applies knife, rigger, glaze, loaded wet, dry broken and scumble by material, light
    and state, the era's palette and decay, in the bake (place.language) or on a baked plate
    (render/tools/paintlang.mjs). Square at dawn, before and the eras (game/capture/paint/lang/square/sheet.png):
    palette entropy before 3.74 bits, era 1 4.33, era 2 3.81, era 5 2.66; value range before 0.50, then 0.54 / 0.51 / 0.36;
    broken share era 2 0.05, era 2 with decay 0.85 0.25. A first knife pass drew Voronoi seams that read as
    crazy paving; the seams are gone and the planes are laid long. Portraits: the mood in the brushwork
    (paintPortrait opts.dir: a lie tighter, grief looser, anger heavier), behind --brushmood until P2.
88. STARTED R4, the map-aware in-world painter: painter.mjs sums G.curv and G.cav per stroke when present and
    rim.mjs formAccent darkens enclosed strokes and lifts lit convex ones; without the maps the frame is byte
    for byte what it was (test). Waiting on the rasteriser (performance engineer's, design/STATE.md).
89. NULL Appeal test P2 (amendment 1, written before its stimuli; the painter loosened: the finest layer dropped,
    larger thresholds, more broken colour, stronger relief, a lighter ground, no glowing iris or spectacle lens).
    Painter control 14 of 24 for the new painter against the first pass (0.58, Wilson 0.39 to 0.76): no longer
    behind it (P1 was 0.25), not shown ahead, so the control fails its line and the box keeps the old heads.
    Sculpted against old: S1 20 of 36 (0.40 to 0.71), S2 21 of 36 (0.42 to 0.73), undecided. Viewers again
    named oversized noses and skull-like faces against, loose varied brushwork for. Stimuli:
    game/capture/paint/portraits3/; results render/appeal/results/P2-*.
90. DONE Stroke light (the author on the Studio's Ned: "I like the lighting that the paint strokes introduce";
    design/art/PAINT-LANGUAGE.md "Stroke light"). render/v2/strokelight.mjs: loaded strokes along each surface's
    plane on its lit side, one stroke per material (stone level, brick dabs, timber grain, plaster diagonals, roof
    slope, and from the inspiration batch hairlines for wool and hair, a square dab for felt, the wind's white
    streaks over frost and snow on the tops), the shadow side glazed and unified, the terminator broken, strokes
    radiating from the ruling lamp. With the light lead's model (render/v2/lightterms.mjs reads rec.side, term,
    key, keyE, K, dir for a baked plate in node) the glaze sits on the true shadow side and the radiating lamp is
    the key's own source. In the bake (place.strokeLight) on the Quota plates. Proof, before and after:
    game/capture/paint/strokelight/sheet3.png (Exchange Square at dawn: 542 strokes with the raw key strength,
    16,008 once the key is normalised to the plate's own 95th percentile; the Brack kitchen at night).
    Figures take the same rule (paint/rim.mjs strokeLit; fixture lit to shade 2.00 to 2.16;
    game/capture/paint/figlight-fixture.png, before left). Painted gate 8 of 8 after it.
91. DONE The specimen sheet (render/tools/specimen.mjs, specimen_sheet.py; the regression image for the paint
    language, to regenerate after every painter change): each stroke alone, each material under stroke light
    (stone, timber, plaster, brick, wool, felt, skin, frost, bread, frost on brick), the five eras and decay on
    one corner with a lit window, with a title block. game/capture/paint/specimen/specimen-sheet.png.
92. DONE (candidate) The surveyor's drawing (render/v2/pen.mjs, render/tools/surveyor.mjs): construction lead past
    the ends, technical-pen contours, 45-degree hatching on the shadow side crossed in cast shadow, material
    washes with wet edges and a bistre shadow glaze on aged paper, day and nocturne. On Exchange Square it reads
    as an architect's drawing (game/capture/paint/surveyor/square/sheet.png: painted, stroke light, surveyor day
    and night). Verdict: it earns a place for drawn documents and for the wide lens as a map-like view; it is not
    yet a third play style (figures are not drawn in it; the cobbles stay blank paper; the glyph comparison on
    this plate waits for the plate to be wired in the game).
93. DONE Exchange Square gains a row on the north side facing the tower (the light lead: window decay must read
    from the tower); the full bake of q_square_wide restarts with it.
94. DONE The full Quota plates: ten baked at full size through the queue, with stroke light on the light model's
    terms and the paint language, and locked (content/PLATES.lock; q_furrowe_door, q_office, q_cells and q_hill
    declared pending in content/PLATES.pending.json, which the plates test checks). Sheet:
    game/capture/paint/quota-plates-sheet.png. Seen there: the night square nearly black (lifted and rebaking);
    decay's chipped planes show as speckle on some interior shadow walls (the knife's chip is too loud at 0.3 to 0.65).
95. DONE The era window (render/v2/erawindow.mjs): a window shows the same place in another era's palette, the
    world outside drained toward ink. game/capture/paint/erawindow/sheet.png. A wet night variant for the square.
96. DONE Mezzotint mode (render/v2/mezzotint.mjs): black ground, light scraped and burnished out, stipple and
    roulette midtones, velvety darks. game/capture/paint/mezzotint/sheet.png.
97. DONE The Quota heads' eyes: their lid shelf hides the eyeball from the portrait camera (Ned's mesh has 5 eye
    vertices, no white), so the painter finds the eyes under the brows (a single brow bar halved) and paints them
    open. The Quota cast's procedural set rebaked with it (game/capture/paint/quota-box/).

98. DONE The Quota slice's ten missing places (Anni's kitchen at year 38, the Sheaf, the pump, the meeting room, the
    cells morning and night, the Furrowes' step, Tilney Road, Haldane Yard, the post road, the hill) and the town map
    (q_town), baked and locked; figureLights in place.json; era 3's misregistration (v2/misregister.mjs). One exterior
    angle, yaw 38 and elevation 40, chosen by the Lamp Quay test (design/CAMERA.md) and applied to the Quota's
    exteriors. Details and what remains: PROGRESS.md 183 and 184.

NOTE from the effects lead, 2026-10-22 (a request, not an edit to render/): the tilt-shift lens and dynamic
light want the bake's full-size geometry. bake2.mjs already computes depth.f32, nrm.f32 and pid.u8 in
render/.tmp; please also write them beside geo-id.u8 for the first variant only, as geo-depth.f16 (view
distance), geo-nrm.oct16 (octahedral world normals, two snorm8) and geo-pid.u8, and list them in place.json
under "gbuffer". Colour plates and content/PLATES.lock do not change. Spec and reasons:
design/sensory/08-FOCUS.md section 3. Until then the browser lens uses geo-pos.f32 (half size), which works.
