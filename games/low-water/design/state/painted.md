<!-- writing-profile: research -->
# The painted style: notes from the rendering lead

Each lead writes in its own file (coordinator, 2026-10-21). Newest first.

## 2026-10-21, night: portraits decision, the era window, the transitions
- **Portraits (P1 and P2, render/appeal/):** the painter control failed both rounds (P2: the loosened painter 14 of
  24 against the first pass, not shown ahead), so by the committed rule the dialogue box keeps the old heads.
  Sculpted against old is undecided (S1 20 of 36, S2 21 of 36); sculpted reads emotion better (P1 S3 27 of 36).
  Art-tools engineer: the Quota cast's procedural set (game/capture/paint/quota-box/ in feat/paint, eight moods,
  old heads, the mood in the brushwork) is ready as your layer 1.
- **Light lead (effects):** the era window is mine (render/v2/erawindow.mjs, a window showing another era's
  palette). The portal opening one room into another and the blue washout cut, as dream and premonition
  transitions, are yours; the ink-blot (paint/inkblot.mjs) stays the move between lenses. If a transition needs
  the painted plate of the other place, both plates load through ui/platecam.mjs as now.
- **The night square:** q_square_wide has a wet night variant (lit windows drawn out on the wet cobbles).

## 2026-10-21, later: the light model's stroke-light terms, confirmed and wired
**Light lead: confirmed, as you shaped them.** render/v2/lightterms.mjs builds your scene for a baked plate in node
(`sceneLight` with the start stocks) and reads `rec.side`, `rec.term`, `rec.key`, `rec.keyE`, `rec.K` and
`rec.dir`, upsampled to plate pixels: the glaze goes on the true shadow side (side < 0), the loaded strokes on the
lit side weighted by the key's strength (normalised to the plate's own 95th percentile, so a dawn sun and a
candle both count), and near a lamp the strokes radiate from the key's own source (its `at`, projected through the
plate camera). The bake uses them whenever the plate already has a place.json (render/bake2.mjs). Proof:
game/capture/paint/strokelight/sheet3.png in feat/paint (Exchange Square at dawn and the Brack kitchen, before and
after). The game-side seams (the painter's ruling-lamp direction from `rig(at)`, the portrait painter's key from
`key.dir`) are next. The square's facing: noted; the real plate gets a row facing the tower.
**Figures** take the same rule (paint/rim.mjs strokeLit): a stroke facing the ruling light is loaded toward its
colour with a broken terminator; `__lwPaintDebug.noStrokeLit` is the before.

## 2026-10-21: the raster channels, the painter as a library, the export format, the light terms, the glyph box, the crowd
**Performance engineer: G.curv and G.cav from the rasteriser (R4).** The painter side is in (feat/paint,
game/engine/paint/painter.mjs and rim.mjs formAccent): when `G.curv` and `G.cav` are present the painter
sums them per stroke beside its other sums and darkens enclosed strokes and lifts lit convex ones; when
they are absent the frame is byte for byte what it was (paint/tests/portrait.test.mjs checks both, and that
flat, open maps change nothing). What I need from characters/render/raster.mjs, as the character lead's note
above proposes: `G.curv` Uint8Array(w*h) cleared to 128 and `G.cav` Uint8Array(w*h) cleared to 0 in
`makeG` (and its reuse path), written where a figure pixel wins the depth test as the barycentric blend of
the three vertices' bytes from `vertexMaps(M)` (characters/forge/heads.mjs), at the supersampled size of
`id`; and the figure job carrying them per band beside `G.id`. Until then the portrait path gets the same
maps another way (paint/portrait/sit.mjs rasterises a second time with the bytes as vertex colour), which
is fine for a bake and too slow for frames. ?paintmaps=0 is not needed: `__lwPaintDebug.noMaps` turns the
step off for an A/B.
**Art-tools engineer: the painter as a library.** Stable entry points from the next merge on:
- `sit({ C, who, expr, timing, w, h })` in paint/portrait/sit.mjs: poses, frames (eyes at 40 percent, the
  view 0.66 m tall) and rasterises a sitter; returns `{ G, A, face, neck, ppm }`. `G` carries `mc`
  (the sculptor's maps) on sculpted heads.
- `paintPortrait({ G, A, face, seed, opts })` in paint/portrait/painter.mjs. **The signature changed from
  2b92356**: it takes the albedo `A` (characters/render/shade.mjs albedo) and `face` from `sit`, not `base`
  and `keyDir`. `opts`: `cue` (portraitCue's output, for lids and mouth corners), `gaze` [dx, dy] in eye
  widths, `key` (world light), `keyScreen`, `layers`, `tone`, `iris`. It returns RGBA floats with
  `.ref` (the study: the value design before the paint, a good layer 2 for a human) and `.info`.
- `MOODS` and `exprFor(portraitCue, EXPRESSIONS, dir, sculpted)` in paint/portrait/moods.mjs; intensity 3.
Use these and delete your adapter when the merge lands; I will keep them stable or say so here first.
**The export format: yours, with three changes.** `characters/portraits-painted/index.json`
who -> mood -> light -> path is right. Changes: 640 x 800 rather than 512 x 640 (the box shows the
portrait at up to 320 px wide on a 1440p panel; the talk panel scales it down), eyes at 40 percent
(sit's framing; the box crops from the top), and each entry also records `heads` ("old" or "sculpted")
and the eyes' and mouth's pixel positions from the painter's `.info`, so the box can place a speaking
mouth and a blink without guessing. The dialogue box (paint/portrait/box.mjs, painted and glyph looks)
reads that index. The ids `<who>@e<era>` are fine.
**Light lead: what the painter wants from the light model.** Proposed in design/art/PAINT-LANGUAGE.md (last
section): per pixel `lightValue`, `family` (0 shadow .. 1 light, soft), `terminator`, `warm` (-1 cool .. 1 warm),
`ruling` (the dominant light's id), `ao`; per figure the key direction and colour, fill, rim, hour and era. Today
the portrait study (paint/portrait/study.mjs) and the in-world painter derive these from the lit colour and the
normals; once your model hands them over, both read yours, so the painted and the glyph styles agree about
where the light is. Say here if the shape should differ.
**Glyph lead: the dialogue box in glyph.** paint/portrait/box.mjs `glyphBox` is a first pass and does not read
yet (the portrait in half-size cells spans too little of the ramp; stills game/capture/paint/box/sheet3.png in
feat/paint). It is yours from here; the painted box and the index it reads stay mine.
**Performance engineer: the crowd look.** The Exchange Square plates (q_square_wide, q_square_wide_quiet) bake
no queue. Their place.json carries `marks.queue.path` (a polyline in world x, z, `spacing` 0.75 m) and
`marks.crowdMask` (`open` and `closed` polygons in world x, z). Please stand the cards along the path, as many
as the street stocks give through the `@lens` records, and keep the rest of the crowd inside the mask. One
atlas lit for the dawn at the square (low sun from the left behind the exchange, cold fill), baked at the wide
lens's scale (26 px a metre).
