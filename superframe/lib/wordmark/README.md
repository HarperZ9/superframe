# superframe/lib/wordmark

Six display directions for the CMMNS wordmark, spoken "commons". Each direction renders a 4K still, a loop and icons from 16 to 128 px, from one seed. The author picks between them; nothing here changes an icon or a repository.

| Module | Direction or role |
|---|---|
| `smalti.mjs` | 1, many hands: letters laid in glass tesserae, one contributor hash for each tessera |
| `apertures.mjs` | 2, the missing O's return as apertures, with crystal rods |
| `strata.mjs` | 3, shared ground: the word cut down through dated layers, coloured from measured plates |
| `intaglio.mjs` | 4, the record that only grows: banknote line engraving where each revision adds cuts |
| `marbling.mjs` | 5, many inks on one bath, with exact provenance for every point |
| `stencil.mjs` | 6, the posted notice: the Accession stencil cut as a two-ink overprint |
| `word.mjs` | the word as geometry, and the contributor hashes the directions seed from |
| `icon.mjs` | the letters at icon sizes, with a pixel alphabet at 16 px |
| `palette.mjs` | colour for the mark: the open spectrum, kept clear of the three verdict colours |
| `looks.mjs` | the two finishes, corrected and bold, through `superframe/lib/look` |
| `sheet.mjs` | inspection pictures: the 200% crop and the icon enlargements |
| `strata-plates.mjs` | generated palette data for direction 3, with each source's SHA-256 |
| `index.mjs` | the list of directions, `renderDirection` and `renderIcon` |

Tests: `superframe/tests/wordmark.test.mjs`, 11 tests.

## Tools

```
node superframe/tools/effects-render.mjs smalti out/smalti.png --w 1280 --h 720
node superframe/tools/wordmark.mjs assets all
node superframe/tools/wordmark.mjs loop smalti
node superframe/tools/wordmark-metamer.mjs
node superframe/tools/wordmark-plates.mjs
```

`wordmark.mjs` writes under `out/wordmark` (or `WORDMARK_OUT`) and puts loop frames under `out/wordmark-renders` (or `CMMNS_RENDERS`); the loop needs ffmpeg. `wordmark-metamer.mjs` reads the 4K smalti still that `wordmark.mjs assets smalti` writes. `wordmark-plates.mjs` measures four Poly Haven CC0 textures that are not in this repository: save each as `<id>.jpg` in the folder named by `WORDMARK_PLATES`. The strata render needs only the generated `strata-plates.mjs`.

## Origin

Written in the author's workspace on 2026-10-28 and brought here on 2026-11-14. The code is unchanged apart from import paths and three output locations in the tools, which named folders on the author's machine.

## BuildLang port candidates

Every module here is JavaScript carried from the workspace; the folder holds no new feature code. The directions depend on `name-art/lib`, `superframe/lib/look`, `lib/marble`, `lib/quantize`, `lib/stack` and the type forge, so those move first.

| Module | Exports |
|---|---|
| `smalti.mjs` | `meta`, `tileColour`, `render`, `icon` |
| `apertures.mjs` | `meta`, `LIGHT`, `LIGHT_B`, `openness`, `apertureCentres`, `ground`, `rodsOf`, `glassGlow`, `render`, `icon` |
| `strata.mjs` | `meta`, `strataOf`, `section`, `swayOf`, `SURFACE`, `render`, `icon` |
| `intaglio.mjs` | `REVISIONS`, `meta`, `INK`, `vdc`, `ledger`, `geometry`, `plate`, `revisionLayer`, `render`, `icon`, `renderSettled` |
| `marbling.mjs` | `meta`, `PAPER`, `INKS`, `inkOf`, `bathOf`, `bathImage`, `render`, `icon` |
| `stencil.mjs` | `meta`, `PRINT`, `weightAt`, `registerAt`, `plates`, `print`, `render`, `icon` |
| `word.mjs` | `TEXT`, `SPOKEN`, `setWord`, `contributors`, `hashUnit`, `inkBox` |
| `icon.mjs` | `PIXEL`, `pixelWord`, `outlineWord`, `iconWord`, `ICON_SIZES` |
| `palette.mjs` | `VERDICT`, `hexLin`, `linHex`, `oklabLin`, `linOklab`, `hueOf`, `oklch`, `VERDICT_HUES`, `HUE_WINDOW`, `openHue`, `verdictClearance` |
| `looks.mjs` | `BOLD_BOX`, `boxFor`, `FINISH`, `finish`, `ssFor` |
| `sheet.mjs` | `crop`, `nearest`, `crop200`, `paste`, `label`, `INK`, `stillsPanel`, `iconsPanel`, `stack` |
| `index.mjs` | `DIRECTIONS`, `SEED`, `byId`, `renderDirection`, `renderIcon` |
