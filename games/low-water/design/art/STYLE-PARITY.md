<!-- writing-profile: research -->
# Style parity: painted and glyph

Glyph lead, 2026-10-21. The game is played in two styles of the same story (the author,
2026-10-21). This table lists every feature with its painted form, its glyph form and its state. It is
kept in step with game/engine/paint/glyph/parity.mjs: paint/tests/parity.test.mjs fails when a feature in
the registry is missing here, when a module or export the table names is gone, when a panel the painted
style shows is not drawn in the glyph grid, or when a plate the painted style can show has no glyph inputs
(or the other way round). Each of those checks has a control that plants the defect and must fail.

States: **both** (each style has its form), **partial** (both exist, one is incomplete, the note says how),
**glyph only** or **painted only** (the other style has nothing yet).

| Id | Feature | Painted | Glyph | State | Note |
|---|---|---|---|---|---|
| `lens-wide` | Wide lens: the district plate from the bell tower | ui/platecam.mjs plateCam | glyph/cells.mjs sceneCells | both | one camera; glyph reads the plate's geo buffers |
| `lens-narrow` | Narrow lens: a household interior at the close camera | world/lens.mjs installLens | glyph/cells.mjs sceneCells | both | the lens is a mechanic shared by both styles |
| `inkblot` | Ink-blot transition between lenses and places, and fainting | paint/inkblot.mjs inkBlots | glyph/blot.mjs drawBlot | both | glyph reads the blot's mask only |
| `crowd` | Crowd tier in the wide lens | characters/runtime/crowd.mjs makeCrowd | glyph/crowd.mjs drawCrowd | both | wired in the bench only, in both styles; glyph near people are material cards (glyph/matcard.mjs) |
| `figures` | People: posed figures lit by the scene | ui/peoplelayer.mjs peopleLayer | glyph/figures.mjs drawFigures | both | |
| `faces-play` | Faces at play size | characters/render/figure.mjs gbuffer | glyph/face.mjs faceCells | both | glyph: a face block where the head spans 3 x 2 cells |
| `figure-light` | Key, fill and rim on characters | paint/rim.mjs | glyph/figlight.mjs screenLights | both | glyph reads the light model's rig when it is ready |
| `contact-shadow` | Contact shadows | ui/peoplelayer.mjs peopleLayer | glyph/figcover.mjs contactShadow | both | |
| `fight-body-tells` | Fight tells on the body (swing, throw, grab) | paint/decals.mjs installDecals | glyph/figures.mjs drawFigures | both | |
| `arena-tells` | Arena ground telegraphs (sweep, slam, pounce, shout, grab) | ui/fightways.mjs drawTells | glyph/tells.mjs drawArenaTells | both | new 2026-10-21: glyph hid the fight canvas these were drawn on |
| `ways-out` | A fight's ways out | ui/fightways.mjs drawWays | glyph/marks.mjs drawMarks | both | on plates with an arena; arena-less preview plates show no outline in glyph |
| `hud` | The HUD (clock, weather, place) | ui/hudtab.mjs hudTab | glyph/ui.mjs drawUi | both | |
| `daybook` | The Daybook | ui/daybook.mjs openDaybook | glyph/ui.mjs drawUi | partial | glyph sets its text; the riso map's drawing is not yet set in type |
| `dialogue` | The dialogue box | ui/talk.mjs renderOptions | glyph/ui.mjs drawUi | both | |
| `portraits` | Dialogue portraits per speaker and mood | ui/portrait.mjs portraitSlot | glyph/portrait.mjs portraitCells | partial | glyph baked for the Quota cast (22 sitters, 4 expressions, 2 lights); Low Water's cast not yet; the painted panel reads the Low Water index for the slice (a wiring gap, reported in design/state/glyph.md) |
| `readback` | The read-back as a typed document | ui/talk.mjs lineEl | glyph/uiextra.mjs drawExtras | both | the UI art lead's typed record (ui/typed.mjs) in both styles where a story opts in (the Quota does); glyph's plain typed sheet otherwise |
| `dream` | The dream look | paint/dream.mjs installDream | glyph/compose.mjs makeComposer | both | |
| `decay` | Decay (letters drop out, lighter steps, smudged rows) | none | glyph/compose.mjs makeComposer | glyph only | painted decay is the plates' per-state variants (painted lead) |
| `era-palette` | A base palette per era | none | glyph/eras.mjs eraLook | glyph only | the painted grade per era belongs to the light lead's model |
| `snow` | Snow and frost on the ground (era 2) | ui/platecam.mjs plateCam | glyph/compose.mjs makeComposer | both | painted: in the plate; glyph: snow's language on up-facing outdoor cells |
| `water` | Water and reflections | ui/weatherlayer.mjs weatherLayer | glyph/water.mjs reflect | both | |
| `smoke` | Smoke and steam | paint/smoke.mjs smokeField | glyph/smoke.mjs makeSmoke | both | |
| `rain` | Rain | ui/weatherlayer.mjs weatherLayer | glyph/effects.mjs makeEffects | both | |
| `props-eras` | Props that change across eras | ui/platecam.mjs plateCam | glyph/cells.mjs sceneCells | both | a variant plate per era; glyph reads its geo buffers, so it follows |
| `arena-mode` | The arena mode page | combat/arena/main.mjs | none | painted only | the arena page has its own placeholder figures and no glyph renderer |
| `style-switch` | Switching style mid-scene (F7) | paint/renderer.mjs createRenderers | paint/renderer.mjs createRenderers | both | tested by glyph/tools/switch.mjs |

## Panels

Every panel selector the painted UI lays out as paper (ui/notify.mjs) is drawn by the glyph grid
(glyph/ui.mjs PANELS) or exempted with its reason in parity.mjs PANEL_EXEMPT. `.fightstrip` is exempt
because no element carries that class; the fight strip is a `.strip` and is drawn.

## The switch mid-scene

game/engine/paint/glyph/tools/switch.mjs boots each proof scene (the square at dawn, a kitchen, the
granary-door fight, a conversation, the read-back), pauses the game, reads the game state, the clock, the
open beat and its options, the area and the fight's clock and result, switches painted to glyph to painted
as F7 does, and reads them again after each switch. 2026-10-21: 5 of 5 scenes unchanged; the control (the
clock moved a minute on the switch) is seen. The first run's control passed blind because the snapshot left
out the clock, which lives outside the game state; the snapshot now carries it. What this does not test:
switching while the loop runs (the game is paused for an exact comparison).

## Known gaps, with owners

- Fighters on a plate without an arena: the figure drawer hands glyph a skeleton shifted by height only,
  so on the Quota's arena-less preview plates the fighters stand where the fight's own frame puts them
  (characters/runtime/fightdrawer.mjs; one-line fix proposed in design/state/glyph.md for its owner).
- The painted talk panel reads characters/portraits/index.json for every story, so the slice's speakers
  show no painted face (ui/portrait.mjs; reported in design/state/glyph.md for the UI lead).
- The arena page has no glyph mode.
