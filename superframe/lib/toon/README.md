<!-- writing-profile: research -->
# lib/toon: cartoon cast and animation pipeline

A 2.5D puppet system, a cel renderer, a clay stop-motion mode, a comic print pass and the cast's own sound. Everything is first-party code. No image models, no third-party characters, no 3D package.

## Pieces

| File | What it does |
|---|---|
| `geom.mjs` | Contours, Catmull-Rom curves, mirrored half profiles, tubes, affine maps, arc-length resampling for blending. |
| `raster.mjs` | Bounding-box coverage under nonzero winding (4 sub-rows, exact spans), clip and cut of coverage, linear-light paint, box blur, 8-bit export with a TPDF dither. |
| `ink.mjs` | The ink line: ribbons with round joints, silhouette weight (heavier away from the key light), brush pressure tapers, the boil (smooth noise redraw), holds on twos. |
| `puppet.mjs` | Parts in model space (morph, tube, flat, stroke) turned about the vertical axis; morph shapes blend a front and a side drawing by cos^2 and sin^2. Painter's order by depth, clip-to-parent, deferred parent ink, `depthOf` and `stick` ordering. |
| `rig.mjs` | Skeleton from `lib/body`: the contrapposto `buildPose` (centre of mass over the standing ankle) and the two-phase jaw; a two-bone reach. |
| `face.mjs` | Eyes with lids, brows, mouths driven by the jaw, noses, ears, placed on the head ellipsoid by front-view x. |
| `stopmo.mjs` | Replacement jitter (children ride their parent), exposure flicker, the clay surface (chamfer distance dome, thumb ridges, lumps, Lambert plus Blinn-Phong), cloth backdrop. |
| `layer.mjs` | A puppet as a premultiplied `lib/stack` layer, its silhouette, its thrown shadow. |
| `print.mjs` | Comic print on the era quantizer's two-ink separation and area-true screen, plus a solid key plate and per-frame plate misregistration. |
| `letter.mjs` | The house face from the typeface forge as contours, with per-glyph wobble. |
| `voice.mjs` | Source-filter mumble with lip-sync timing, clay thump, shredder grind, fluorescent hum, FM bell. |
| `sheet.mjs` | The 4K model sheet. `scene.mjs`: captions, set helpers, the on-twos render loop. `out.mjs`: PNG and the ffmpeg pipe. |
| `cast/` | Six characters and their sheet data (`index.mjs`). |

Nodes (`superframe/adapters/toon.mjs`): `toon.cel`, `toon.stopmo`, `sound.mumble`, `sound.foley`.
Tools: `superframe/tools/toon-sheets.mjs`, `toon-dialogue.mjs`, `toon-stopmo.mjs`, `toon-psa.mjs` (set `TOON_FFMPEG` to an ffmpeg binary; `TOON_PEEK=f1,f2` renders single frames).
Tests: `superframe/tests/toon.test.mjs`.

## Authored, labelled

The key light direction, ink spread and floor, boil amplitude and cell, jitter and flicker depths, clay ridge and lump sizes, print cell, angles and misregistration, and every colour are authored. The formant targets in `voice.mjs` are adult averages from memory (moderate confidence). The stance and the jaw come from `lib/body` and carry its preregistered checks.

## Known limits

- Morph blending is a 2D cross-fade of two drawings, so a shape that changes topology between front and side (a nose bridge, a tuft) can pinch at 3/4. The ink is drawn per part, so overlapping parts of one colour show an inner line.
- Depth is per part, not per pixel. A limb that passes through the body sorts as a whole; `depthOf` and `stick` patch the common cases.
- The clay surface is a height field from the 2D silhouette, so it reads as relief, not as a turned 3D form. Its stepping is smoothed, not removed.
- The print pass costs about 25 s a frame at 4K in Node.

## Run it

```
node superframe/cli/superframe.mjs try toon.cel out/toon-cel --size 640
node superframe/cli/superframe.mjs try toon.stopmo out/toon-stopmo --size 640
node superframe/tools/toon-sheets.mjs
```

The two `try` commands took 2 seconds together on the author's machine. The four tools write under `out/toon/` unless a folder is given, and the three animation tests need ffmpeg.

## Origin

Written in the author's workspace on 2026-10-28 and brought here on 2026-11-14. The code is unchanged apart from import paths and the tools' default output folders. The six cast members are invented characters; no file references a real face.

## BuildLang port candidates

Every module here is JavaScript carried from the workspace; the folder holds no new feature code. `geom.mjs`, `raster.mjs`, `ink.mjs` and `voice.mjs` are array arithmetic with tests in `superframe/tests/toon.test.mjs` (15 tests), so they are the first to move.

| Module | Exports |
|---|---|
| `face.mjs` | `surfX`, `eye`, `brow`, `mouth`, `nose`, `ear` |
| `geom.mjs` | `lerp`, `clamp`, `smooth`, `ellipse`, `curve`, `mirrored`, `area`, `orient`, `bbox`, `I`, `mul`, `translate`, `scale`, `rotate`, `chain`, `apply`, `applyAll`, `resample`, `blend`, `flipX`, `tube`, `roundRect`, `star` |
| `ink.mjs` | `KEY_LIGHT`, `ribbon`, `normals`, `inkClosed`, `pressure`, `inkOpen`, `noise2`, `boilStep`, `heldFrame`, `boil` |
| `layer.mjs` | `silhouette`, `puppetLayer`, `castShadow`, `over` |
| `letter.mjs` | `measure`, `setLine` |
| `out.mjs` | `FFMPEG`, `writePng`, `movie` |
| `print.mjs` | `comicPrint` |
| `puppet.mjs` | `turn`, `morphOutline`, `place`, `drawPuppet`, `stage` |
| `raster.mjs` | `toLin`, `toSrgb`, `lin`, `mix`, `canvas`, `coverage`, `clip`, `cut`, `covArea`, `paint`, `fill`, `blurCov`, `shiftCov`, `paintSafe`, `bytes` |
| `rig.mjs` | `standing`, `jaw`, `ik2`, `add3`, `mid3` |
| `scene.mjs` | `W`, `rect`, `box`, `disc`, `inked`, `caption`, `lineAt`, `ramp`, `ease`, `pulse`, `renderClip`, `canvas` |
| `sheet.mjs` | `SHEET`, `text`, `blit`, `modelSheet`, `paint`, `coverage`, `lin` |
| `stopmo.mjs` | `jitterParts`, `flicker`, `expose`, `insideDistance`, `clay`, `backdrop`, `lin` |
| `voice.mjs` | `RATE`, `syllables`, `mumble`, `mouthAt`, `thump`, `grind`, `hum`, `bell`, `mixInto`, `limit` |
| `cast/darlene.mjs` | `DARLENE`, `buildDarlene` |
| `cast/gladhand.mjs` | `GLADHAND`, `buildGladhand` |
| `cast/gulp.mjs` | `GULP`, `buildGulp` |
| `cast/human.mjs` | `MITTEN`, `MITTEN_SIDE`, `limbs`, `neck`, `sym` |
| `cast/index.mjs` | `CAST`, `castById` |
| `cast/mulch.mjs` | `MULCH`, `buildMulch` |
| `cast/patterns.mjs` | `stripes`, `dots` |
| `cast/peep.mjs` | `PEEP`, `buildPeep` |
| `cast/ray.mjs` | `RAY`, `buildRay` |
