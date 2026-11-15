<!-- writing-profile: research -->
# Paint language: the strokes the game uses and what they mean

Rendering lead, 2026-10-21, after the author's direction: "Continue expanding deeply on the painting
techniques and brush expressions an the lighting on the characters and in the world; also improve the ASCII
version in tandem. Perhaps two rendering techniques of the same story, so the game is played in multiple
styles." This file owns the painted style. The glyph lead owns the ASCII style; the light lead owns the one
light model both styles read. Nothing here is taken from a reference game; the vocabulary is a painter's
ordinary one, chosen for this story.

## The rule

A stroke is chosen by what is being painted, how it is lit and what the story says about it, never by noise
alone. Three inputs decide it:

1. **Material**: the surface's id (plates: the kit id; figures: the rig material).
2. **Light**: from the light model, per pixel: which light rules it, its value, whether the pixel is in the
   light family or the shadow family, and the terminator.
3. **Narrative state**: per place and variant, `era` (1 to 5), `decay` (0 sound to 1 broken, from the street's
   stock in the community model), and per figure the line's mood tags (the voice bible's emotion and the lie
   flag).

Noise only varies a stroke inside its kind (where its edge wanders, where a bristle skips).

## The vocabulary

| Stroke | Looks like | Means | Used on | Driven by |
|---|---|---|---|---|
| Dry broken | a stiff brush dragged with little paint: the canvas shows through in streaks along the stroke | cold, want, hunger | frost on tops, the famine's walls and bread, a starving face's planes | frost, era 2, decay, the hunger tag |
| Loaded wet | a full brush, soft rounded ends, the colour pooling at the end of the stroke | warmth, lamp and fire light | the pool round a lamp or a hearth, lit faces at a table | light family under a warm emitter |
| Scumble | thin opaque light paint rubbed over a dark, broken, no direction | air between us and the thing: fog, smoke, distance | the wide lens's far planes, steam, breath | depth, mist, smoke marks |
| Glaze | a transparent dark laid over a dried layer: the hue deepens, the value drops, the texture beneath stays | shadow, depth, what is hidden | the shadow family, cavities, under tables and stairs | shadow family, cavity |
| Palette knife | flat planes with hard straight edges, a ridge where the knife lifts | hard stone, iron, the exchange's surfaces: the institution | slab, steps, brick, iron, the scale | material |
| Rigger line | a long fine line of even weight | writing and what is counted: ledgers, maps, ration cards, the chalked figures | paper, chalk, the district map | material |
| Lost and found edges | an edge kept sharp where the eye should go, softened into the ground where it should not | where to look | everywhere; the found edge on the speaker, the lost edge on the far side | light (value contrast), the focus mark of the scene |

Figures add four rules:
- Stroke direction follows the form (the structure tensor of the study's value; the portrait painter and the
  in-world painter both do this).
- Skin carries warm and cool zones: cool where it turns away, warm and a little red at the terminator, red at
  ears, nose and knuckles in the cold.
- Hair, felt and wool each have their own stroke: hair long and tapered along the fall, felt a short square
  dab, wool a short curl that breaks on its own texture.
- The mood shows in the brushwork: a lie paints tighter and harder (shorter strokes, less jitter, harder
  edges); grief paints looser (longer, softer, more broken); anger heavier (more paint, more relief).

## Stroke light

The author, 2026-10-21, on the portrait painter: "I like the lighting that the paint strokes introduce as well,
though. I think like a cool combination of both. Could really improve the lighting, especially with the
environment." The light is laid in paint (render/v2/strokelight.mjs):
- Every surface's light family takes loaded strokes that run along its plane and catch the key, one stroke
  per material: stone long and level, brick short level dabs, timber along the grain, plaster loose diagonals,
  roof along the slope, cloth and iron their own.
- The shadow family is glazed and unified: one cool transparent dark over a calmed copy, its texture kept.
- The edge where light meets shadow is broken: the light family's threshold is jittered per stroke, so light
  strokes reach into the dark and some fall short.
- Near a light source the strokes turn to radiate from it, warmer and more loaded the nearer they are: a lamp's
  pool, a stove's glow, the frost sun on the snow are strokes, not gradients.
- Figures in the world take the same rule (the in-world painter's strokes already follow form and catch the
  key through rim.mjs; the light lead's terms will make the two read the same light).
The light family and its temperature come from the light model when it hands them over (terms.family,
terms.warm); until then they are read from the plate's value against its neighbourhood.

## The era window

From one era, a window, a mirror or a photograph shows the same place in another era, painted in that era's
palette (render/v2/erawindow.mjs; after the inspiration batch's old town in black and white with one window in
colour, another century; technique only). Outside the window the world is held in its own era, drained toward
ink on paper when the window must carry all the colour; inside, the other era through the paint language; the
frame painted as timber, a cold highlight down the glass, a soft shadow inside the opening. It carries the
120-year span and the cross-run record (the Haldane table seen through the antique shop's glass in era 5). Today
the window shows the same geometry in another palette; a place whose buildings change between eras needs that
era's own plate behind the glass. Proof: game/capture/paint/erawindow/sheet.png (the famine square with era 1 in
the window; era 5 with era 2 in it).

## Mezzotint mode

For the loudest rhetoric (the district meeting where every chairman reports a record yield, the pulpit and the
rally) and for dreams (render/v2/mezzotint.mjs; after John Martin's mezzotints for Paradise Lost, public domain).
The plate starts as a full black ground and light is scraped and burnished out of it: burnished lights smooth,
midtones in stipple and roulette, darks velvety with the grain closed, printed in a warm black on paper, a
fire's light keeping a little warmth. A vast tiered crowd costs little in it: mostly dark, its tops lit. Proof:
game/capture/paint/mezzotint/sheet.png (the granary at night, before and after; the exchange; a close crop).

## The world

- **Atmospheric perspective** in the wide lens: value and saturation drift toward the sky with depth, edges
  soften, and the far planes are scumbled.
- **The eras in the paint.** Era 1 full and saturated, loaded strokes; era 2 (the famine) dry and scraped,
  the palette drained toward earth; era 3 patched and repainted; era 4 machine-flat in places; era 5 thin and
  flat under sodium light.
- **Decay as paint.** As a street's stock falls, its surfaces break down in the brushwork: more dry
  strokes, the knife's planes chipped, glazes muddied, colour drained.

## Measures (each technique ships with a before and after sheet and one number)

- **Edge coherence**: the share of strong-gradient pixels whose orientation agrees with their neighbours'
  (a painted edge is one stroke; noise is many).
- **Value range**: p95 minus p5 of luminance over the subject.
- **Palette entropy**: Shannon entropy of the image's colours in a 4-bit-per-channel histogram, per era.
- **Broken share**: the share of a region's pixels where the canvas tone shows through (dry stroke).

## The interface with the light model (proposed to the light lead in design/STATE.md)

Per pixel, for plates and figures alike: `lightValue` (0..1 after exposure), `family` (0 shadow .. 1 light, a
soft split), `terminator` (0..1, peaked at the split), `warm` (the ruling light's temperature, -1 cool .. 1
warm), `ruling` (the id of the light that dominates, for the loaded wet stroke near emitters), `ao` (cavity).
Per figure: key direction and colour, fill, rim, the hour, the era. The painter reads these instead of
deriving them from the lit colour, so both styles agree about where the light is.
