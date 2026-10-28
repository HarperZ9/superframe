<!-- writing-profile: readme -->
# Artifact: one seeded recipe, every medium

You describe an artifact in words. The engine compiles the words into a recipe of elements, each one a law with its weights, and renders that recipe from a seed into paint, type, lines, material, sound and touch. It also writes a study of the artifact's own elements for every kind of reader. The same recipe and seed give the same bytes. An edit to one element changes only the part of each medium where that element acts.

Built 2026-10-26 as part of the superframe.

## Run it

```
node cli/superframe.mjs make "heavy rust coral upper left, faint teal frost on the right, \"words to set\"" out/a --seed s
node cli/superframe.mjs artifact out/a/recipe.json out/b --isomer permute
node cli/superframe.mjs artifact out/a/recipe.json out/c --metamer coral
node cli/superframe.mjs artifact out/a/recipe.json out/d --route coral:sound:0
node cli/superframe.mjs artifact out/a/recipe.json out/e --edit elements.coral.weights.F=0.03
node --test tests/artifact.test.mjs
```

`--size 3840x2160` is the default. The sim grid is half the output on each side.

## The recipe

`superframe.artifact/1`, defined in `ir.mjs`:

| Field | Meaning |
|---|---|
| `seed` | Every element draws from its own substream (`seed/element/<id>`) under the superstack rule `xmur3-mulberry32/1`. The site's `system/media-engine/contracts.mjs` and the substrate's `superstack.mjs` are the same file (SHA-256 `b972095e...`), so the site, the superframe and the creation engine already share this rule. |
| `elements[]` | `law` (one of 15 creation-engine generators), `weights` passed straight to the law, `ink`, `region` (a feathered ellipse), `scale` (cells across the law's own grid), `strength`, `detail`, `roughness`, optional `spectrum`. |
| `transparency` | A weight per element per medium: how much of the element passes into type, paint, lines, material and sound. No medium has a fixed rule about which element it shows. |
| `media`, `detail` | Sheet-wide weights per medium, and the full-resolution grain. |
| `text` | What the type sets. |

`recipeHash` covers only what the media read. The intent prose and the parse report sit outside the hash.

## Front end: intent to recipe

`intent.mjs` splits the prose into clauses. Each clause that names a law becomes one element, and the words around the law set its weights:
- strength: faint, soft, heavy
- colour
- place: upper left, centre, across the whole sheet
- scale: fine, broad
- detail: smooth, rough
- media: silent, carved, undrawn

Text in quotes becomes the type. Every word the lexicon doesn't read is listed in `report.unused`, so you can see what the engine ignored.

## Back ends

Each one reads the per-element layers with weight `transparency[m] x media[m]`.

| Medium | File | Law of the readout | Keeps | Loses |
|---|---|---|---|---|
| Paint | `paint.mjs` | 16-band Kubelka-Munk through the creation engine's `combineSpectral`, read under D65 and under illuminant A, lit by the material's normals | hue, tone, spectrum | height except as shade |
| Material | `material.mjs` | height, roughness and normals; neutral clay under a raking light, Blinn-Phong sheen falling with roughness | height, roughness | hue |
| Type | `type.mjs` | Accession Mono from the house forge, three masters (300, 550, 800); the field picks the weight at every pixel; ink tinted by the paint | tone as letter weight | hue except as tint |
| Lines | `lines.mjs`, `hatch.mjs` | marching squares at evenly spaced levels, plus tone hatching that runs along the least-curvature direction of the field (Hessian, after the Krbn comparison save); `lines.hatch: 'flat'` is the control; SVG through `lib/export.mjs`, raster as order-independent max coverage | level sets, tone as hatch density, form as stroke direction | hue |
| Sound | `sound.mjs` | x is time, y is pitch over 72 log bands from 70 Hz to 7 kHz, additive partials with seeded phases, fixed gain, tanh limiter | position as time and pitch, tone as loudness | hue, detail below one band |
| Touch | `sound.mjs` `tactile()` | on and off milliseconds per 100 ms step from the loudness | loudness over time | everything spatial |

## The study: perceptible to any perceiver

`study.mjs` writes three things:
- `study.json` for agents and models;
- `study.md` for readers and screen readers, with alt text for each medium;
- `tactile.json` for touch.

The recipients are the superframe's own (`lib/recipient.mjs`), plus touch. For every element the study records:
- its properties;
- the weights its law read and the ones it ignored;
- whether its law had settled;
- the transparency record: for each medium, the Pearson correlation between the element's own ticks and what that medium shows inside the element's region. In other words, how much of the element survived the crossing.
- the metamer reading: the mean ΔE between the paint under daylight and under tungsten.

Every number in the study is measured from the rendered outputs.

## Recombination

`ops.mjs` has these operators. Each one returns a recipe, so its result renders, hashes and studies like any other.

| Operator | What it does |
|---|---|
| `edit` | one weight or property, by dotted path |
| `reseed` | a new draw of the same laws |
| `isomer` | the same weights in a new structure: regions permuted or mirrored |
| `route` | an element moved into or out of a medium |
| `cross` | two recipes aligned by law, then joined |
| `metamer` | an ink spectrum that matches in daylight and splits under tungsten, using the superframe's `metamericBlack` |

## Ground

`tests/artifact.test.mjs` has 7 tests, all passing on 2026-10-26. They run at 384 by 216 with a 2-second sound.

| Claim | Test | Control that can fail |
|---|---|---|
| Same recipe and seed, same bytes | 3 runs, SHA-256 of paint, type, lines, material, both sound channels | a seed change alters all of them |
| An edit stays where its element acts | one marble weight changed: 0 pixels changed outside its bbox plus a margin (2 sim px for the bilinear reach, 4 px for normals and strokes, 6 px for the unsharp mask), in every image medium; 0 sound samples changed outside its time window | the same diff after a global step (paint normalised by its mean; sound peak-normalised) flags 186,861 paint pixels and 56,250 samples outside |
| Unused words change nothing | two intents that differ in one unread word give the same hash and the same bytes | the reports differ, so the word was seen and ignored |
| Isomer | same weights, permuted regions, different paint | the weight multisets are asserted equal |
| Metamer | a spectrum swapped on one element: its tungsten difference exceeds 1.5 times its daylight difference | the plain ink pair, used as the base |

## The first render

The intent was drawn from the site's readoption map. Each surface is written as the law that shares its property:

| Site surface | Law in the render |
|---|---|
| the gallery's seeded plates | a symmetry tiling across the sheet |
| the Studio's timeline | poured ink |
| Night School's paths | a mycelium network |
| the explainers | contour elevation |
| the fractal and shader suite | Turing coral |
| transparency | frost |
| the splats | spray |

The type sets the site's core line. The render is 3840 by 2160, with a contact sheet, 200% crops and the study; the frames are not in this repository. It renders in about 12 seconds, and the recipe hash is `73fca92e...`.

The measured transparency record, as correlations by medium:

| Medium | Correlation |
|---|---|
| material | 0.26 to 0.91 |
| sound | 0.23 to 0.91 |
| paint | 0.25 to 0.87 |
| lines | -0.07 to 0.66 |
| type | 0.06 to 0.34 |

## Curvature hatching (2026-10-26)

`orient.mjs` measures whether the hatching follows the form. It compares the dominant stroke direction in the rendered hatch pixels, block by block, with the field's contour tangent, which it computes separately. A score of 1 means the strokes run along the contours, and 0.5 means their direction is unrelated to the form.

The readoption intent at 1920 by 1080 has 19,662 strokes. Curvature and flat hatching use the same seeds, density, lengths and widths:

| Hatching | Orientation agreement | Lines correlation, mean |
|---|---|---|
| none | not applicable | 0.197 |
| flat (control) | 0.481 | 0.465 |
| curvature | 0.631 | 0.507 |

Hatching of either kind raises the lines readout's correlation, because it carries tone. The direction adds a little more, and the agreement score shows the strokes now follow the form.

The test `curvature hatching follows the form` requires the flat control to sit between 0.4 and 0.6, and curvature to beat it by 0.08. Locality still holds: the edit test's margin grows by the strokes' reach (`hatch.mjs` `reach()`), and nothing changes outside it.

## Limits

- Type is the weakest crossing. A text sheet's darkness is set mostly by where the letters fall, so a law carried as letter weight and tone survives at 0.06 to 0.34 on this render. With weight alone it was 0.01 to 0.13.
- No law reached its settle threshold in its default step budget, so the study reports every element as still moving.

- The sim grid is half the output size. Fine texture at 4K comes from the seeded detail grain, weighted by each element's detail and ticks. It doesn't come from the law itself.
- A law runs alone in its own region. Two elements don't act on each other's ticks yet, so one element can't drive another. Locality holds partly because of that. Coupled elements would need a stated reach, and the locality test would have to grow by that reach.
- Where elements overlap, material roughness is blended in element order. The other media don't depend on order.
- The lexicon is small and English only. An unknown law word is reported, never guessed.
- The transparency record is a correlation inside each element's region, so it only measures linear survival. A medium that encodes a property nonlinearly, as lines do with level sets, scores lower than what a viewer can read from it.
- The creation engine's `superframe-nodes.mjs` adapter now passes the node's seed. Frost takes no seed: it is deterministic from its seed points.
