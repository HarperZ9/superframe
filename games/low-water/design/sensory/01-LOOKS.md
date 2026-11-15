<!-- writing-profile: research -->
# Sensory 1: the looks

Part of [SENSORY.md](../SENSORY.md). Each look below says what it means in the story, its palette,
line and stroke, light, texture, camera and motion, then how it is made: the raw-native pass and its
parameters where a pass exists (`rn:`), the game shell's code where the shell already does it, or the
engine gap. Parameter values are first guesses to tune, not measurements.

## How the looks are made today, honestly

Two renderers exist and they are not yet one.

- **The game shell** (browser, JavaScript) draws baked painted plates with figures painted at run time
  on top. The plates are baked paintings, and live light is laid over them rather than relit from albedo
  (design/RENDER-TARGET.md:55). The figure painter's stroke levels are fixed at 11, 7, 4.5 and 3 px
  (game/engine/paint/painter.mjs:24). Glyph is a second full pipeline that shares only scene, simulation
  and camera (design/GLYPH-PIPELINE.md:4-8, 24-28).
- **raw-native** has the painterly core on the GPU with a CPU reference: Kubelka-Munk pigment latents,
  structure tensor, anisotropic Kuwahara, relief, compose and an advected canvas
  (rn:raw/renderer/style_paint.hpp:2-11). Its parameters are one global `PaintParams`
  (rn:raw/renderer/style_paint.hpp:18-25) and `runPaint` takes no mask, style id or material id
  (rn:raw/renderer/style_paint.hpp:52). The stylised passes P16 to P21 (oil strokes, pen and glaze,
  glyph, halftone and mezzotint, multiplane, era window) are proposed, not built
  (rn:docs/architecture/ROADMAP.md:248-253).

So every look has two columns of work: what the shell can do now (mostly baked plate variants plus
run-time figures and effects) and what raw-native must do for the Steam build. The style-state field in
[02-MORPHS.md](02-MORPHS.md) is the piece that lets both do per-region looks.

## L0. Oil and Ink, the base

| | |
|---|---|
| Means | The present, seen plainly by the player's own character. Every other look is measured against it |
| Palette | Violet and teal shadow planes against the warm key, olive halftones on skin, the plates' violet-brown ink (26, 17, 24), never black (design/ART-DIRECTION.md:112-121; design/LOOK-UNIFIED.md:73-75, 83) |
| Line | Ink from depth, normal and identity breaks, about 2.2 px on silhouettes at 1080p, lighter on folds (design/LOOK-UNIFIED.md:73-75) |
| Stroke | The paint vocabulary: dry broken, loaded wet, scumble, glaze, palette knife, rigger line, lost and found edges (design/art/PAINT-LANGUAGE.md:27-35); stroke light radiating from the ruling source (design/art/PAINT-LANGUAGE.md:47-63) |
| Light | The one light model (design/art/LIGHT.md:15-23): light costs something, the state's light never goes out, nobody lit for drama |
| Texture | Canvas weave and bristle; impasto lit by the key |
| Camera | The plate camera; figures about 130 to 190 px at play size (design/RENDER-TARGET.md:28-29) |
| Motion | Strokes ride the body (T2: kept 98.5%, flicker 0.67%, design/RENDER-TARGET.md:71) |
| Passes | rn `oil` preset (the `PaintParams` defaults, rn:src/renderer/style_paint_canvas.cpp:46-52); P16 for strokes oriented by the structure tensor and stroke light from the light buffer (rn:docs/architecture/ROADMAP.md:248) |
| Gap | P16 unbuilt. P5's world-anchored canvas was dropped by its own kill criterion (oil reduction -0.139, interval [-0.288, +0.004], rn:evidence/p5-world-strokes-runs.json:16 [p5]), so the advected canvas stays the base until a footprint-filtered anchor is tried |

## L1 to L5. The five eras

One rule from the light: the light tells the year before anyone speaks (design/art/LIGHT.md:12-14).
One rule from the paint: era 1 full and loaded, era 2 dry and scraped, era 3 patched, era 4
machine-flat, era 5 thin under sodium (design/art/PAINT-LANGUAGE.md:90-92). The palettes below take the
glyph style's era duotones as the shared anchors (game/engine/paint/glyph/eras.mjs:13-22), so both
styles agree on each era's ground, ink and hot mark.

| | Era 1, The Exchange | Era 2, The Quota | Era 3, Allocation | Era 4, The Closure | Era 5, The Clearance |
|---|---|---|---|---|---|
| Means | Money sure of itself; the hinge is a rule written in a warm room | The famine winter; the figure on paper against the bowls on the table | Rebuilding by allocation; the ration book's grey | The mill sold; the photograph replaces the painting | The ghetto under sodium; the screen replaces the photograph |
| Ground, ink, hot | #100b08, #ecdaba, #e2683a | #070a11, #c4d8ee, #e85638 | #0b0d0b, #ccd4c0, #e26040 | #0f0c09, #decca8, #5ac4d6 | #090603, #ffb24a, #609cff |
| Light (design/art/LIGHT.md:35-39) | Gas mantles, paraffin, wax and tallow | Tallow, rushlight, carbide 3100 K, the train's headlamp, moon on snow | Bare bulbs, brownouts | First sodium, fluorescent with mercury lines | Sodium with the 589 nm line, phone glow, police blue |
| Stroke | Loaded wet, long, gilt glazes on frames | Dry broken over everything warm; scraped knife on stone | Repainted patches: a newer, flatter stroke over an older one at a hard edge | Knife and roller flats; halftone dots in the shadow family | Thin flat paint; strokes short and few; glyph on screens |
| Line | Warm brown ink, soft | Cold ink, thin, broken where frost lies | Misregistered: the ink plate offset 1 to 3 px from the colour, as a lithograph out of register (design/quota/08-WORLD-MEDIA.md:19-22) | Hard machine line, even weight | Barely any; edges carried by value |
| Texture | Varnish sheen, canvas | Exposed canvas in streaks; frost as scumble | Paper grain under paint | Halftone dot, nicotine film | Sodium haze, compression blocks on screens |
| Camera | Wide from the bell tower at harvest | Wide at dawn, narrow at the table | Wide over washing lines | Wide at shift's end | Wide over the ring road's pegs |
| Motion | Crowd busy, carts steady | Few walkers, breath, snow | Many people indoors, few out | The mill wheel slowing | Patrol lights, phones lit in hands |
| rn start values | `oil`, radius 6, strokeLen 14, impasto 0.9, gloss 0.6, broken 0.10 | `oil`, radius 5, strokeLen 8, impasto 0.35, gloss 0.15, broken 0.45, granulation 0.2 | `gouache`, radius 6, q 10, strokeLen 8, broken 0.25, canvasOffset nudged for the ink plate | `gouache`, valueBands 4, impasto 0.2, gloss 0.1, plus P19 halftone in shadows | `watercolour` base with dilution 0.6, exposure 1.9; P18 glyph on screens |
| Gap | None beyond P16 | None beyond P16 | A misregistration term (ink offset per region) is not in `PaintParams` | P19 halftone unbuilt | P18 glyph unbuilt in rn; the shell's glyph exists |

The rn presets named exist (rn:src/renderer/style_paint_canvas.cpp:46-52); the per-era values are new.

## L6. Dream

| | |
|---|---|
| Means | Night, the dreamer's fear run forward a week (content/quota/q_dreams.lwd:8-19); both readings kept open (design/THEMES.md:260-265) |
| Palette | Off the hour's palette by a slow hue drift, saturation down to 55% at full dream |
| Stroke | Looser and broader; broken colour stronger (game/engine/paint/painter.mjs:57) |
| Light | The light model's terms kept, so a lamp in the dream is where it is in the room |
| Texture, camera, motion | A soft blurred ring at the edges; the plate camera held still; nothing in the room moves except what the `see:` line names |
| Shell now | game/engine/paint/dream.mjs:1-11, 22: CSS filters on the painted layers, a vignette veil, the paper UI kept sharp; glyph drops half its type by world-anchored blue noise |
| rn | Per region: radius x1.5, strokeLen x1.8, broken +0.3, push +0.1, exposure -0.2; palette drift in OKLab hue by up to 30 degrees |
| Gap | The shell's filter is screen-space (blur, hue rotate) and not a paint parameter; raw-native needs the style-state field |

## L7. Premonition

| | |
|---|---|
| Means | A later era arriving early, the visual twin of the score's premonition rule (design/audio/SCORE.md:97-99) |
| Look | A patch of a later era's look inside the present one: era 5's thin sodium flat lying on era 2's snow like a pool of light with no lamp over it. One patch, world-anchored, never more than 12% of the frame |
| Light | The patch carries its own era's light (sodium 2050 K with the line, design/art/LIGHT.md:39); the patch casts no light outside itself |
| Passes | A region in the style-state field holding the later era's preset (02-MORPHS.md) |
| Gap | The field; the later era's plate geometry where buildings differ (design/art/PAINT-LANGUAGE.md:72-74) |

## L8. Memory and the era window

| | |
|---|---|
| Means | What a person keeps of the past: a photograph, a window, a mirror, the Haldane five (design/quota/08-WORLD-MEDIA.md:55) |
| Look | Inside the opening, the other era through its own look; outside, the present drained toward ink on paper when the window carries all the colour (design/art/PAINT-LANGUAGE.md:65-75) |
| Held still | A remembered scene is a held frame with one thing moving (a hand, steam from a bowl). Sound comes before picture (04-SENSES.md) |
| Shell now | render/v2/erawindow.mjs:1-6: a bake-time composite of two era renders through a rectangle or arch, drain 0.85, a timber frame |
| rn | P21, the era window through a world-anchored mask with a stated soft edge (rn:docs/architecture/ROADMAP.md:253) |
| Gap | Runtime in the shell (the bake output cannot follow a moving camera); P21 unbuilt |

## L9. Perspective chapter

| | |
|---|---|
| Means | Whose eyes this is: the chapter's own person (game/engine/world/perspective.mjs; content/quota/q_perspective.lwd:8-13) |
| Rule | The world is the same place with the same light. The chapter changes what the eye weighs: the chapter's strongest skill sets which sense-images grow. Bet's sheet has NOSE 4 (content/quota/q_perspective.lwd:21), so smoke, tallow and breath effects run denser and warmer, and the SMELL voice speaks sooner |
| Palette | The run's own era palette, shifted 8 degrees toward the chapter person's own colour (Bet: the blue thread of the Hesh, design/quota/01-WORLD.md:47) in the shadow family only |
| Line | The chapter person's lettering hand on every note card (game/engine/ui/lettering/hands.json) |
| Camera | Same plate camera; the follow is a little closer (0.9 of the run's framing), because the person is smaller in the world |
| Gap | A per-chapter look record; events `perspective.start` and `.end` exist to hang it on (design/state/gameplay.md:167-169) |

## L10. States of mind

| State, its source | Look |
|---|---|
| Hunger (the household's `food`, `hunger` stocks) | More dry broken strokes on warm things only: bread, faces, the stove; value range narrows by up to 20% |
| Cold (era 2, frost) | Ears, nose and fingers redden (design/art/LIGHT.md:84-85); the shadow family glazes bluer |
| Drink (the rum and thirst thread, design/THEMES.md:221-227) | Edges lose their found sharpness except on the glass in hand; the lamp's halo widens; time between lines stretches |
| Dread (the meter, and threat near) | Contrast between pool and pocket rises toward four stops (design/LOOK-UNIFIED.md:84-85); the requisition lamps' hard white holds while the houses dim |
| Lying (a line tagged `lie`) | Never in the world's look, because the mix and the picture must not give a lie away (design/audio/SCORE.md:142-143). The portrait alone paints tighter (design/art/PAINT-LANGUAGE.md:44-45) |

Gap: one state-of-mind record per look term, driven by the existing stocks and meters.

## L11. Places with their own character

| Place | Look on top of the era | rn route |
|---|---|---|
| The exchange and its scale | Palette knife on stone and iron: the institution (design/art/PAINT-LANGUAGE.md:33) | P16 with a per-material knife stroke |
| The district office | Pen and glaze: ruled hatching in shadow, rigger lines on ledgers and maps | P17 (rn:docs/architecture/ROADMAP.md:249) |
| The cells | Two-ink dither light: darkness as a Bayer threshold, the lamp a quantised pool | rn `ink` preset, levels 2 (rn:src/renderer/style_ditherlight.cpp:24-25; rn:raw/renderer/style_ditherlight.hpp:26-38) |
| The Well House | Watercolour: granulation and edge darkening, water as the faith's own medium | rn `watercolour`, granulation 0.4, edge 0.5 |
| The Furrow Church | Glazes deepen toward the altarpiece; the covered altarpiece is a flat cloth with no stroke | P16 glazes |
| The Crown | Loaded wet, smoke scumbled, the radio's corner lit by its dial | P16 plus effects smoke |
| The mill yard and boxing club (eras 4, 5) | Machine flats, halftone in shadow, the crowd as dark masses | P19 |

## L12. Propaganda and the record

- **Print processes by era**: woodcut, lithograph out of register, halftone collage, compressed meme
  (design/state/ui.md:210-212; game/engine/ui/propaganda/print.mjs). Caricature only from the myth,
  props and dress, under the guard (game/engine/ui/propaganda/guard.mjs; design/quota/08-WORLD-MEDIA.md:30-33).
- **Mezzotint for the loudest rhetoric**: the district meeting's record yields, the pulpit, the rally
  (design/art/PAINT-LANGUAGE.md:77-84; render/v2/mezzotint.mjs:1-7, bake-time). rn: P19
  (rn:docs/architecture/ROADMAP.md:251).
- **The notice beside the person**: the compare view, no verdict written (game/engine/ui/compare.mjs).

## L13. The read-back

| | |
|---|---|
| Means | The record, flat. Nothing is dramatised (design/quota/04-SYSTEMS.md:128-130) |
| Look | The world leaves. The plate dissolves to paper by the ink-blot drawing back (game/engine/paint/inkblot.mjs:1-6); the typed document in both styles (design/art/STYLE-PARITY.md:31) |
| Palette | Paper and ink tokens only (design/UI-SYSTEM.md:59-75). One hot mark: the hinge being read |
| Motion | Scrolled at the voice's pace; no slide, no fade on rows |
| Gap | None for the look; the sound rule is in 04-SENSES.md |

## L14. Glyph, the second pipeline

Glyph is a full alternative renderer on F7 (design/GLYPH-PIPELINE.md:24-28) with era palettes
(game/engine/paint/glyph/eras.mjs:13-22). As a look inside the story it has one fixed use: era 5's
screens (phones, CCTV) are drawn in glyph inside the painted frame (design/quota/08-WORLD-MEDIA.md:135).
That is a region of one style inside another, and needs the style-state field. rn: P18
(rn:docs/architecture/ROADMAP.md:250).
