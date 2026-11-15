<!-- writing-profile: research -->
# The glyph language

Glyph lead, 2026-10-21. Author, verbatim, 2026-10-21: "Continue expanding deeply on the painting
techniques and brush expressions an the lighting on the characters and in the world; also improve the ASCII
version in tandem. Perhaps two rendering techniques of the same story, so the game is played in multiple
styles."

Glyph is the second way to play the whole game. It shares the scene, the simulation, the camera and the
light model with the painted style and reads none of the painted style's pictures. This file says what type
does as a medium in it. The pipeline is in design/GLYPH-PIPELINE.md; the feature-by-feature state of both
styles is in design/art/STYLE-PARITY.md. Code: game/engine/paint/glyph/.

Each claim below is marked **built** (in code and seen in a still), **designed** (decided here, not built)
or **open**.

## 1. Material: a density ramp per stuff

A material speaks its own run of glyphs from unlit to fully lit. The light picks the step; the material
picks the letters. A ramp is ordered by measured ink coverage in the house face, not by eye
(glyph/styles/density.json, re-measured in LW Conso on 2026-10-21).

| Material | Ramp (shadow to light) | Make (a mark laid by world position) | Status |
|---|---|---|---|
| Stone, cobble | ` .,:;=+*#` | `o` cobbles on up-facing ground | built |
| Brick | ` .:;=+#%@` | `_` courses | built |
| Wood, timber | ` .-~=+#%@` | `=` grain | built |
| Slate, roof | ` .,/^^AM#` | `^` slates | built |
| Water | `  .-~~=≈≈` | `~` ripples; the scene mirrored in it | built |
| Snow and frost (era 2) | `  ..,,:'` on a pale ground | none: snow reads by its ground, and goes blue and empty in shadow | built |
| Smoke and steam | `. : ; ~` by density, kept where the density beats world-anchored blue noise | none | built |
| Skin (figures) | `.oO00`; faces see section 2 | none | built |
| Wool (Tarn coats) | `%&&MW`, tangled marks | none | built (figures); portraits use `%&&#` |
| Felt (Hesh) | `=HH#`, flat pressed strokes | none | built in portraits; figures key on the part, not the cloth (open: the skeleton record carries no cloth id) |
| Bread | `.oO@` with a crust of `#` on the lit side | `:` crumb | designed: the kit has no bread surface kind yet |

Why a pale ground for snow: tested two ways on the bell-tower plate at 07:50. Dense letters for lit snow
(`+*`) made the square a field of noise brighter than the houses; sparse marks on a ground tinted by the lit
colour read as a white field with long blue shadows. The second is kept (game/capture/glyph/pairs-1 against
pairs-2).

## 2. Characters in type

**Play size (built).** A head that covers three cells across and two down is set as a face, not one letter
(glyph/face.mjs). The head is a block of lit skin carried in the cells' ground; its edge cells take `(` and
`)` so the block reads round; the features are dark ink struck over it at their places on the head: eyes
(`o` open, `O` wide, `-` lidded, `_` shut, moved toward the gaze), a brow over each eye (`\ /` angry, `/ \`
worried, `^` raised, `-` level), a mouth (`-` set, `=` held, `~` uneasy, `o` startled, `u` warm, `^`
grieving, to one side for contempt). A side view keeps one eye on the near side and the nose (`>` or `<`) on
the leading edge; the back of the head is hair. Smaller heads keep one face letter by facing (`o`, `<`, `>`,
`@` for the back of the head). The mood is the speaker's face in the talk panel, else neutral.

**Portrait size (built).** Glyph portraits come from the same head reference as the painted ones: the actor,
pose, portrait camera and PORTRAIT_RIG of characters/proto/portraits.mjs, lit by the same light function
(characters/render/shade.mjs). The bake (glyph/tools/portraits.mjs) stores the pipeline's intermediate per
cell of a 60 x 50 grid: lit tone, part (skin, eye, eye white, brow, lip, hair, hat, wool, felt, thread,
light and dark cloth, Ned's hat line, a painted mark), the part's 3 x 4 cover, rim and albedo. The style
sets type from it at run time (glyph/portrait.mjs) at the frame's own size: 30 x 25 cells in the talk panel
at 1080p, 60 x 50 for a close-up. Skin is set in its own ramp in its lit colour over a darker ground; eyes,
brows, lips and the old heads' painted marks are shape-matched: the glyph whose ink lies where the feature's
cover lies is chosen, so lids and gaze come from the geometry, not from a lookup. The Hesh blue thread stays
blue under any era grade. Eight moods ride on the four sculpted expressions (warm on neutral, anxious and
grieving and lying on wary, angry and contempt on set, afraid on startled); brows and mouth take the mood's
marks where the bake found a brow or a lip.

**Limits.** The old heads paint eyes and brows into the skin colour, so on most of the slice cast the bake
finds marks, not brows: the mood's brow slant then does not apply (open: the head sculptor's eye and brow
materials would fix it). Mary's small eyes fall below one cell at 30 x 25 and read as a shadow band.

**Letters as materials (built for the crowd tier).** After the author's typed-sprite reference (2026-10-22,
technique only): a small figure or prop is written as rows where each letter names a material, not a colour
(glyph/matcard.mjs): `W` wool, `F` felt, `s` skin, `h` hair, `c` cap, `t` the blue thread, `b` boots, `S`
scarf, `B` bread. The era and the people dye each material (Tarn dark wool; Hesh felt with the thread at the
wrist; era 5's scarves), and the light is done from the neighbours: a cell whose neighbour toward the light
model's key is empty is an edge facing the key and takes the material's light glyph and value, a cell whose
neighbour away from the key is empty takes its dark end. The crowd tier's near people (five cells tall and
more) are these cards; a loaf carried in the arms is a `B` in the coat's row. Seen on the square
(game/capture/glyph/crowd/). Open: props on plates (they are the plate's geometry, not cards).

**The read-back (built).** When the talk panel shows a read-back node, or speaks as READBACK, the grid sets
the panel as a typed sheet: paper ground, ribbon-black type, a ruled edge, line numbers in the small cut in
the margin where the margin is empty (glyph/uiextra.mjs).

## 3. Weight and size for depth

The atlas holds every character in three cuts (glyph/atlas.mjs): **regular**; **bold**, the letter struck
twice a little apart; **small**, the letter at three quarters size. A lit cell near the camera takes the
bold cut, a cell deep in the fog the small one (glyph/compose.mjs weathered); a figure's lit side and its
rim take bold (glyph/figlight.mjs). Built.

The face is the house mono, LW Conso, from game/fonts. It is a proportional face, so a letter wider than the
cell is narrowed to fit it and every character keeps one cell. Tested against Hanken Grotesk and the old
Consolas in the same cells (scratch probe, viewed): Conso fitted reads as a condensed typewriter and gives
the type its own look. The panels' hidden DOM layout still uses a monospace for positions only; nothing in
that face is shown.

## 4. Light in type

Both styles read one light model (glyph/lightmodel.mjs; the interface is proposed in design/state/glyph.md). Until
the light lead's model lands, glyph derives the same shape: sun or moon by the hour tinted by the era's sky,
the place's lamps, the carried lantern.

- **World (built).** The static light is baked per cell with shadows marched through the cells' depth, the
  lantern added per frame. Light sets the step in the material's ramp (density), the cut (weight) and the
  colour.
- **Characters (built).** Per figure, the strongest light reaching it is the key, the strongest from the far
  side the rim, the sky the fill. Per covered cell, a pseudo-normal from its place across the limb gives
  each light's share: the key picks density and weight, the fill is the shadow side's floor, and an edge
  cell facing the rim takes a bright line along the bone in the rim's colour, bold. The figure is then held
  apart from its ground by value toward whichever side it already leans: a lit mass at twice the ground
  round it on a cleared ring, or a dark mass under half of it on ground thinned to sparse marks, its rim
  kept. The contact shadow is cast away from the key.
- **The shared model and the clock (built, 2026-10-22).** When the light lead's model is ready for the place,
  glyph takes its field for the clock (light/consume.mjs cellsFromField, refreshed when the clock moves a
  minute) and its figure rigs. An exposure follows the clock (glyph/modellight.mjs): the eye adapts to the
  frame's bright end (the 95th percentile of lit cells) and lands it lower at night than by day, so a lamp pool
  reaches the top of the ramp while the rest stays low; at night the floor that carries form in faint type is
  raised (x2.2) and the light spreads into the dark as a **halftone falloff**: a cell below the ramp's first
  steps takes a dot sized by its light (`. · • o`), dithered by world-anchored blue noise, in the lamp's
  colour. Measured: the night square's legibility rose from 0.53 (the model's light under the old fixed
  exposure, the light lead's figure) to 0.72 (stable over three runs), still under the 0.75 gate; the dawn
  square 0.98, the kitchens 0.90 and 0.91, the granary 0.98.
- **Lamp pools and the famine winter (built).** In eras 1 and 2 the era grade spares lamp-warm cells, so a
  lamp's pool stays the one warm thing in a frost-blue frame.
- **Era 5 sodium (built as a palette, not yet seen on a plate).** A single amber ink at grade 0.85.
- **Time of day.** The hour sets the sky (light.mjs skyOf); the plate's variant hour wins where the plate
  has one. Seen: dawn on the square (long shadows, pale snow), evening in the kitchens, night at the
  granary.

## 5. Colour: ink on ground, one hot mark

Verdict-only colour: type is ink on a ground; the one hot mark per view is the telegraph (a tell's ring,
an arena telegraph, the way out Lamb stands in, the ink blot). The grade (glyph/eras.mjs) pulls each cell's
ink and ground toward the era's duotone at its value; hot cells are never graded.

| Era | Ground | Ink | Hot mark | Grade | Status |
|---|---|---|---|---|---|
| 0, Low Water (the Gullet acts) | the old night | bone | rust | none | unchanged look |
| 1, The Exchange | warm umber | bone | red | 0.35, lamps spared | built, not seen |
| 2, The Quota | blue-black | frost blue | red | 0.55, lamps spared, snow on | built, seen |
| 3, Allocation | grey-green | ration-book grey | red | 0.5 | built, not seen |
| 4, The Closure | nicotine | paper | tube cyan | 0.5 | built, not seen |
| 5, The Clearance | black-amber | sodium amber | patrol blue | 0.85 | built, not seen |

The era comes from the content's `@meta era`, else 2 for the Quota slice (its meta carries community-day).

## 6. Letterforms that carry meaning

- **The ledger's numerals (designed).** Figures that are the state's (a quota, a district's grain, a
  ration) are set in the bold cut with tabular spacing and a rule under the line, wherever the world shows
  them as a document (04-SYSTEMS.md: the official figure per street is an in-world ledger line). Not built:
  the slice has no in-world ledger surface yet.
- **The notices' capitals (designed).** The Directorate's notices are set in capitals in the regular cut,
  letter-spaced one cell, one notice a frame in the hot colour only when it names the player.
- **A people's own script (designed, open).** Vellish has its own script (01-WORLD.md). In glyph mode it is
  an invented set of marks drawn into the atlas from strokes (no font): a hooked stem, a dot over or under,
  a bar; the town's signs and the Vell's own shopfronts in era 5 carry it. Nothing is built; the slice is
  era 2 and the Vell arrive in era 4.

## 7. Motion as typed text

- **Rain (built).** Letters falling and slanting with the wind, hidden behind nearer cells.
- **Snow at night (built, after the author's snowy-road and lamp-cone references, 2026-10-22).** Flakes (`.`
  `'` `*`) drift slower than rain and show only where the frame's light is above a threshold, so snow is seen
  inside lamp pools and nowhere else (glyph/snowfall.mjs). Footprints: people's feet leave world-anchored prints
  on the place, set as darker `,` strokes inside the pools and invisible outside them. Not seen in the proof:
  the Quota preview plates have no walking ground, so Lamb did not walk. Cart ruts are open (no cart path on
  the plates).
- **Crowds (built).** The crowd tier in type (glyph/crowd.mjs): a far person is one letter that steps
  (`i ! l j` by the walk phase), a nearer one a head over a body, a near one head, shoulders and legs by
  facing. Wired in the bench in both styles; the slice does not yet place a crowd.
- **The ink blot (built).** The blot's mask set as solid ink with a bright wet coast in shade glyphs.

## 8. Decay

Decay is a level 0 to 1 per frame (the era's default, a place's own, or a state's), applied per world cell
with world-anchored blue noise so it stays on its surface (glyph/compose.mjs weathered):
letters drop out (`0.2 x decay` of the type), others fall one step lighter (`0.55 x decay`), and a smudged row
(`0.1 x decay` of the rows) drags its type to `~` and `=`. Built; era 2 runs at 0.15. Open: decay keyed to
the community model's stocks per street.

## 9. What this does not do yet

- The night square stays under the legibility gate (0.72 against 0.75): the snow hides the square's kind
  boundaries, and at night they have nothing left to read by. Silhouettes against a bright sky with lit eyes
  (the second half of the author's halftone reference) are not built.
- Fighters on a plate without an arena (the Quota preview plates) are drawn where the fight's own frame
  puts them, not where the painted layer puts them: the figure drawer shifts the glyph skeleton by height
  only (characters/runtime/fightdrawer.mjs). A one-line fix is proposed in design/state/glyph.md.
- The arena mode page has no glyph renderer.
- Felt and wool on figures key on the part (coat), not the cloth.
