# studio

The design studio: one material rendered four ways. Pick a material (raked concrete, spray, glass, a CRT signal) or blend two, and the studio sets a word in it, paints a picture of it, times its motion and scores its sound, all from one set of numbers and one seed. It also mints the house typeface as an installable font, static or variable, and reads any picture it makes back as numbers you can recompute.

## Run it now

From a clone of this repo, with Node 24 or later and no install step:

```
node packages/studio/bin/studio.mjs list                                  # the 14 materials, 4 lanes and 22 nodes
node packages/studio/bin/studio.mjs image spray --seed 4 --size 1280x800  # spray-s4.png
node packages/studio/bin/studio.mjs font --weight 0.112 --style Medium    # zain-mint-medium.ttf, installable
node packages/studio/bin/studio.mjs variable                              # zain-mint-variable.ttf, one font with a weight axis
node packages/studio/bin/studio.mjs eye glass --seed 4 --vs 5             # fingerprint two renders and compare them
node --test packages/studio/tests/*.test.mjs                              # 32 tests, about 2 s
```

Each command prints the sha256 of what it wrote. Run it twice and the hash repeats.

In code:

```js
import { byId, blend, renderImage, toRGBA, score, typeSpec, mintVariableFamily, eyeOf } from './packages/studio/src/index.mjs';

const m = blend([byId('glass'), byId('rope')], [0.6, 0.4]);    // a real interpolation of two materials
const rgba = toRGBA(renderImage(m, { w: 1280, h: 800, seed: 4 }), m);
const { phash, features } = eyeOf(rgba, 1280, 800);           // 64-bit fingerprint and five readings
const sc = score(m, { seed: 4 });                             // onsets, voices and timing for the sound lane
const { ttf } = mintVariableFamily({}, { seed: 58 });         // Uint8Array, a TrueType variable font
```

## Materials

A material is one parameter set, schema `studio.material/1`. It has two parts.

- **Core**: 25 physical and perceptual numbers that every lane reads, each with a range and a unit: relief depth, lamp angle, grain, particle density, order, sheen, thin-film thickness, flow, fibre, line work and angle, tension, frame rate and holds, build duration, tempo, pitch, body resonance, decay, transient, noise and brightness. `STUDIO.core` lists them with their ranges.
- **Hints**: which generator each lane starts from: a lettering technique or face, a stack of compositor plates, a timing curve, and engine voices.

The library holds 14 materials (`studio/lib/materials.mjs`). `blend` lerps the core where a quantity is shared and stacks the hints where they are categorical, so a blend of glass and rope is a new material with numbers of its own. `validate` names every out-of-range number.

## Outputs

| Lane or port | Gives you | Code |
|---|---|---|
| image | an RGBA picture (8-bit, or a 16-bit master), plates stacked in linear light, grain and dither once at export | `studio/lib/lanes/image.mjs` |
| type | a lettering spec: technique, face, tunings and colours; `mountType` sets the word in a browser | `studio/lib/lanes/type.mjs` |
| motion | a timing curve with holds on ones, twos or threes, a stagger for letters, and a speed the sound lane can follow | `studio/lib/lanes/motion.mjs` |
| sound | a score (onsets, voices, roles) and a loudness-levelled render through the sound engine | `studio/lib/lanes/sound.mjs`, `loudness.mjs`, `wav.mjs` |
| recipients | the same material for an eye, an ear, a reader and an agent, every field computed from the numbers | `studio/lib/recipients.mjs` |
| fonts | a minted face as a static TrueType font, or a family of weights as one variable font with a `wght` axis | `src/font/ttf.mjs`, `src/font/variable.mjs` |
| eye | a 64-bit difference hash, Hamming distance, a MATCH, DRIFT or UNVERIFIABLE verdict, and five readings | `src/eye.mjs` |

A difference hash (dHash) shrinks the picture to 9 by 8 cells of brightness and keeps one bit per pair of neighbours. Pictures that look alike share most of the 64 bits, so the count of differing bits says how far a render moved.

A variable font carries one set of outlines plus per-point offsets (`gvar`) along a named axis (`fvar`), so a single file gives every weight between Light and Bold.

## Determinism

The seed is the only randomness. The tests check these claims:

- The image lane gives the same bytes for the same material, seed and size, and different bytes for another seed (`tests/studio.test.mjs`).
- The sound lane gives the same score hash for the same material and seed.
- The font writers give the same bytes on every run, and the same bytes Flywheel's Python writers gave at the source commit (`tests/font.test.mjs`).
- The eye gives the same hash and readings as studio-engine's eye at the source commit (`tests/eye.test.mjs`).

Limits, in plain words. Byte equality was checked with one Node version per machine (the CI's Node 24 and Node 25 locally); the image lane uses `Math.sin` and `Math.exp`, so a Node release that changes them could move pixels. The type lane's `mountType` and the sound engine's live playback run in a browser and are not byte-checked. A dHash records only which neighbour is brighter, so a change that keeps every neighbour order leaves the hash unchanged; the identity hash still catches it, and the verdict says DRIFT at distance 0 (`tests/eye.test.mjs`, the "limit" test).

## Ported in

Each port is held to goldens: outputs made by the source code at a pinned commit, before the port ran, so the port cannot pass by comparing against itself. Each also has a byte-identical repeat test and a seeded planted change the check must reject.

| Feature | Source | Parity result | Planted change |
|---|---|---|---|
| Static TrueType writer | HarperZ9/flywheel@681810fe `harness/typeface_ttf.py` | 3 of 3 fonts byte-identical (55,316 to 55,900 bytes) | a one-unit move of one seeded point, 3 seeds, all caught |
| Variable font writer and variable family | HarperZ9/flywheel@681810fe `harness/typeface_variable.py`, `typeface_family.py` | 3 of 3 fonts byte-identical (54,476 to 83,836 bytes); refusals and refused styles equal in 4 of 4 cases | the same move in one master, caught; a topology mismatch refused by name |
| The eye | HarperZ9/studio-engine@328a0ddf `showcase/eye.js` | 10 of 10 hashes and every reading equal; 6 of 6 drift verdicts equal | a seeded neighbour-pair reversal, 3 seeds, all caught; a luma-rounding mutant caught |

The check works in whole font units: a move far under half a unit rounds away and the font still matches, which the tests also state. Regenerate the goldens from the sources with the commands at the top of `goldens/font_from_flywheel.py` and `goldens/eye_from_studio_engine.mjs`. Every older feature still to move, with where it lives, its licence and the check that would prove its port, is in `docs/STUDIO-MATRIX.md`.

## The site Studio as the front end

The site's Studio page is one shell with 28 sources (Atelier, the fractals, Gallery, Loom, Retro Engine, Type forge, Seed sound and the rest), each drawing to one shared stage with a shared action bar. Its media engine already mounts a plugin per source: `create({ canvas, params, seed, backend })` returns `frame`, `setParams`, `readPixels` and `dispose`, and each export carries a receipt.

To make the page the studio's front end:

1. **Controls from data.** The page builds each panel from `STUDIO`: the materials, every core number with its range, unit and default, and each node's ports and parameters. A slider is a core number; a menu is a material or a hint.
2. **One plugin per lane.** A thin media-engine plugin wraps a lane: the image plugin calls `renderImage` and `toRGBA` inside `frame`; the type plugin calls `mountType`; the sound plugin schedules `score`. The seed rule is the studio's: one integer, no clock.
3. **Receipts from the eye.** Each export records the material hash (`hashMaterial`), the seed, the sha256 of the bytes and the eye's `phash`. Reloading the page and re-rendering gives MATCH; a code change shows as DRIFT with a distance.
4. **Fonts on the page.** Type forge calls `toTtf` or `mintVariableFamily` and offers the file for download.
5. **Order of moves.** Sources whose engine is already in superframe go first (Seed sound, Loom, Type forge, RAW, Dimensions); the matrix rows marked partial follow as their engines land.

## Where the code lives

`studio/` at the repo root is published from the studio's working tree, and each publish replaces that folder whole. This package sits in `packages/`, which is edited in this repo only, so the documentation, the ports and the tests live here and import `studio/lib` by relative path.

## Licence

FSL-1.1-MIT, like the rest of the repo. The ported code came from FSL-1.1-MIT sources by the same author; `PROVENANCE.json` in `packages/` lists each file with both sha256 values.
