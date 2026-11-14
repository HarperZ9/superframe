# superframe/lib/seattle

Three Seattle night scenes as pixel art, each built from stated physics: the back seat of a car in the rain, a back porch in moonlit snow, and wind and rain in three Pacific Northwest trees. Lamp colours come from spectra, and the palette for each scene is reduced from the lamp that lights it.

```
node superframe/tools/seattle-render.mjs car --size 200x112 --T 2
node superframe/tools/seattle-render.mjs porch --mode loop
node superframe/tools/seattle-render.mjs trees --mode video
```

The contact sheet goes to `out/seattle-probe`; loops, stills and video go to `out/seattle-rain` or the folder given with `--out`. The 200 by 112 sheet over 2 seconds took 22 seconds on the author's machine. Video needs ffmpeg on PATH or its path in `SEATTLE_FFMPEG`.

Six nodes in `superframe/adapters/seattle.mjs` wrap single steps so they combine with every other node: `seattle.droplens`, `seattle.bokeh`, `seattle.lash`, `seattle.floaters`, `seattle.lamppalette`, `seattle.pixelart`.

| Module | What it models |
|---|---|
| `scenes.mjs` | the three scenes behind one interface: `create`, `step`, `render`, `palette`, `exposure` |
| `carscene.mjs`, `carworld.mjs`, `carframe.mjs` | the car scene: the view up through the rear side window, the street as a 3D world the camera moves through, and the window opening |
| `drops.mjs`, `droplens.mjs` | rain on glass: drops land, bead, merge and run; each drop is a spherical-cap lens showing the street inverted |
| `bokeh.mjs`, `lash.mjs`, `floaters.mjs` | the eye: defocus through a squinting pupil, eyelash diffraction streaks, vitreous floaters |
| `porch.mjs`, `sprites.mjs` | the porch scene with its three light sources; a person, a raccoon and a crow drawn from proportions in metres |
| `trees.mjs`, `pnwtrees.mjs`, `treedraw.mjs`, `wind.mjs` | Douglas fir, western redcedar and bigleaf maple as skeletons, driven by a gust field |
| `outdoor.mjs`, `street.mjs`, `precip.mjs` | camera, lamps, night-eye colour loss, twilight and moon; wet road with Fresnel reflection; rain and snow particles |
| `spd.mjs`, `lights.mjs`, `palette.mjs` | lamp spectra at 1 nm (high-pressure sodium, blackbody, moon), lights as linear RGB, and the palette reduced from a lamp |
| `pixq.mjs`, `film.mjs`, `gif.mjs`, `raster.mjs` | tone curve and ordered dither to the palette, frames and loops, a GIF89a writer, the HDR frame type |

Tests: `superframe/tests/seattle-motion.test.mjs` (8), `seattle-optics.test.mjs` (8), `seattle-spd.test.mjs` (6), and six node goldens. The light levels are of the right order and the scenes are not photometric renders; `outdoor.mjs` says which figures are from memory.

## Origin

Written in the author's workspace on 2026-10-28 and brought here on 2026-11-14. The code is unchanged apart from import paths and the default output folder of the render tool.

## BuildLang port candidates

Every module here is JavaScript carried from the workspace; the folder holds no new feature code. `spd.mjs`, `droplens.mjs`, `wind.mjs`, `gif.mjs` and `pixq.mjs` are closed-form or byte-level and have tests, so they are the first to move.

| Module | Exports |
|---|---|
| `bokeh.mjs` | `blurAngle`, `aperture`, `defocus` |
| `carframe.mjs` | `aperture` |
| `carscene.mjs` | `CAR`, `route`, `createCar`, `stepCar`, `renderCar` |
| `carworld.mjs` | `EYE_HEIGHT`, `project`, `renderWorld`, `interiorLight` |
| `droplens.mjs` | `WATER`, `K_RET`, `cap`, `capShape`, `baseFromVolume`, `waterIndex`, `exitRay`, `retention`, `slideRadius`, `rainSpeed`, `marshallPalmer` |
| `drops.mjs` | `GLASS_DEFAULT`, `createGlass`, `addDrop`, `rainOn`, `force`, `step`, `merge`, `seed`, `totalVolume` |
| `film.mjs` | `shoot`, `rgbaOf`, `upscaleRGBA`, `sheet` |
| `floaters.mjs` | `createFloaters`, `stepFloaters`, `applyFloaters` |
| `gif.mjs` | `encodeGIF`, `lzw` |
| `lash.mjs` | `LAMBDA_RGB`, `arms`, `armFalloff`, `streaks` |
| `lights.mjs` | `ADAPT`, `STREET`, `MATERIALS`, `carLights`, `carPaletteSpec` |
| `outdoor.mjs` | `camera`, `proj`, `ray`, `ground`, `lampE`, `nightEye`, `twilightRGB`, `moonRGB`, `corona`, `cloudCover`, `incandescentRGB`, `haze` |
| `palette.mjs` | `candidates`, `reduce`, `lampPalette` |
| `pixq.mjs` | `toneRGB`, `tone`, `pairTable`, `dither`, `measureDE` |
| `pnwtrees.mjs` | `douglasFir`, `westernRedcedar`, `bigleafMaple`, `SPECIES` |
| `porch.mjs` | `porchScene` |
| `precip.mjs` | `createPrecip`, `stepPrecip`, `drawPrecip` |
| `raster.mjs` | `frame`, `clone`, `fill`, `add`, `set`, `get`, `sample`, `disc`, `rect`, `line`, `poly`, `scale`, `mulRGB`, `boxBlur`, `toRaster`, `fromRaster` |
| `scenes.mjs` | `scene` |
| `spd.mjs` | `NM`, `LINES`, `HPS_DEFAULT`, `hps`, `planckSPD`, `moonSPD`, `bands`, `xyzOf`, `xy`, `cctMcCamy`, `litRGB`, `lightRGB`, `colourSpread` |
| `sprites.mjs` | `person`, `raccoon`, `crow` |
| `street.mjs` | `wetRoad`, `wire`, `wireY` |
| `treedraw.mjs` | `rig`, `pose`, `stepTree`, `drawTree` |
| `trees.mjs` | `treesScene` |
| `wind.mjs` | `gusts`, `limbFreq`, `dragLoad`, `oscillator`, `drive` |
