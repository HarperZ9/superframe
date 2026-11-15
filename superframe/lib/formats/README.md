# superframe/lib/formats

File writers and readers with no browser API. Each takes plain arrays, text or bytes and returns text, bytes or plain data.

## Writers

| Module | What it writes | Tests |
|---|---|---|
| `midi-writer.js` | a Standard MIDI File, format 0: `writeMIDI`, with `vlq` for variable-length quantities | `superframe/tests/formats-midi-writer.test.mjs`, 7 tests |
| `relief-stl.js` | a watertight binary STL from a height map, in millimetres: `heightmapToSTL`, `stlTriangleCount`, `boundaryLoop`, `buildGrid` | `superframe/tests/formats-relief-stl.test.mjs`, 6 tests |
| `disciplines.js` | a palette as a GIMP `.gpl` file, as CSS custom properties or as JSON (`toGplPalette`, `toCssPalette`, `toJsonPalette`); a cross-stitch legend that reduces a grid of colours to at most twelve floss colours with a symbol each (`stitchLegend`); a relief OBJ from a luminance grid (`heightGridToObj`); a text file with the ASCII and braille reads of a frame (`toTextArt`); and `EXPORT_KINDS`, the list of every kind with its extension and MIME type | `superframe/tests/formats-disciplines.test.mjs`, 7 tests |
| `mesh-io.js` | a mesh as Wavefront OBJ text or as glTF 2.0 JSON with one embedded buffer: `meshToOBJ`, `meshToGLTF` | `superframe/tests/formats-mesh-writers.test.mjs`, 44 tests with `structure-checks.js` |
| `pdf-page.js` | a one-page PDF that holds one JPEG, fitted to A4, A3 or Letter: `jpegToPdf(jpegBytes, width, height, { paper })`. No font is embedded | `superframe/tests/formats-readers.test.mjs` |

The voxel writers (an OBJ of exposed faces, a JSON schematic, a MagicaVoxel `.vox` file) are in `packages/voxel`.

The palette, stitch and text writers take a perception packet: an object with `dominantSwatches` (each `{ hex, frac }`) and, for the text file, `ascii` and `braille` strings. The names inside the written files ("Telos plate", "Telos generative engine") are the site's and were kept so the site's tests carry over unchanged.

## Readers

| Function in `mesh-io.js` | What it reads | Limits |
|---|---|---|
| `parseOBJ(text)` | vertices, normals and faces; polygons become triangle fans; negative indices resolve | texture coordinates, materials and groups are ignored |
| `parsePLY(text)` | ASCII PLY vertices, in the property order the header gives | binary PLY and face lists are not read |
| `parseGLTF(arrayBuffer, isGLB)` | `.gltf` with data URIs and binary `.glb`: positions and indices of the first primitive | external buffer files, materials and skins are not read |
| `parseTable(text, "csv" or "json")` | column names and rows; number pairs when the first two columns are numeric | the CSV split is on commas only |
| `svgSize(text)` | the declared width, height and viewBox of an SVG document | path data is not parsed |

`formats-readers.test.mjs` (11 tests) holds the known answers from the site's self test and the round trips: a mesh written by `meshToOBJ` or `meshToGLTF` reads back equal, and the relief OBJ and the voxel OBJ read back with every face index in range.

`mesh-transform.js` works on what the readers return: `meshBounds`, `normalizeMesh` (centre the mesh and scale it to radius 1), `transformMesh` (scale, rotate, translate), `meshStats`, `cloneMesh` and `drawMeshPreview`, which draws a wireframe, solid or point preview through a 2D canvas context. `superframe/tests/formats-mesh-transform.test.mjs`, 5 tests.

`structure-checks.js` holds yes-or-no checks of a written file: `discriminateOBJText` and `discriminateGLTF` read the text back and confirm that every face index names a vertex, `discriminateSVG` checks the root element and path commands, `discriminateJSON` parses, `discriminateMesh` checks an index list.

`superframe/lib/export.mjs` calls `midi-writer.js` and `relief-stl.js`. No engine node calls the other modules yet.

## What stayed on the site

`system/exporters.js` and `system/importers.js` each hold a registry that takes a browser canvas or a `File`. These parts need a browser and were left: PNG, JPEG and WebP through `canvas.toBlob`, WebM through `MediaRecorder`, the SVG rasteriser, image and video decoding, compressed audio through `AudioContext.decodeAudioData`, the drawn cross-stitch chart (its legend is here) and the canvas previews. The export and import receipts were left too: they depend on the site's `shared-frame` hashing and sealing modules, and the engine has its own receipt contracts in `substrate/`.

## Origin

`midi-writer.js` and `relief-stl.js` began under `system/` on HarperZ9.github.io at commit 3ca6529, with the same file names. They sat in the engine as a vendored snapshot until 2026-11-14 and are maintained here from that date. The tests came from the site's `system/midi-writer.test.mjs` and `system/relief-stl.test.mjs`.

The rest was carried from the site at commit c8866cc4 on 2026-11-14:

| File here | From | What changed |
|---|---|---|
| `disciplines.js` | `system/exporters-disciplines.js` | nothing; test from `system/exporters-disciplines.test.mjs` |
| `mesh-transform.js` | `system/mesh-transform.js` | nothing; test from `system/mesh-transform.test.mjs` |
| `structure-checks.js` | the discriminators in `system/exporters.js` | exported by name; tests from `system/exporters.test.mjs` |
| `mesh-io.js` | the mesh branches of `exportOBJ` and `exportGLTF` in `system/exporters.js`; `importOBJ`, `importPLY`, `importGLTF`, `importData` and `importSVG` in `system/importers.js` | each function takes text or bytes in place of a `File` or a canvas, and the preview drawing is gone. `parseGLTF` is synchronous. `svgSize` finds the root tag with a regular expression where the site used `DOMParser`, and it falls back to the viewBox when width or height is missing, which the site's comment describes and its code never reached |
| `pdf-page.js` | `exportPDF` in `system/exporters.js` | takes JPEG bytes and the pixel size in place of a canvas; returns a `Uint8Array` |

## Other implementations in this repo

`visualizer/lib/midi.mjs` is a second MIDI module. It has not been merged with `midi-writer.js`. The native renderer writes OBJ and glTF in C++ (`native/tools/asset`) and reads glTF in `native/src/assets/gltf.cpp`; those are separate from the JavaScript here.

## BuildLang port candidates

These files are JavaScript that moved; the folder holds no new feature code. All are text or byte code with no browser API apart from `drawMeshPreview`, so they can move to BuildLang today, with the tests above as the known answers.

| Module | Exports |
|---|---|
| `midi-writer.js` | `vlq`, `writeMIDI` |
| `relief-stl.js` | `stlTriangleCount`, `buildGrid`, `boundaryLoop`, `heightmapToSTL` |
| `disciplines.js` | `EXPORT_KINDS`, `toGplPalette`, `toCssPalette`, `toJsonPalette`, `stitchLegend`, `heightGridToObj`, `toTextArt` |
| `mesh-io.js` | `meshToOBJ`, `meshToGLTF`, `parseOBJ`, `parsePLY`, `parseGLTF`, `parseTable`, `svgSize` |
| `mesh-transform.js` | `cloneMesh`, `meshBounds`, `normalizeMesh`, `transformMesh`, `meshStats`, `drawMeshPreview` |
| `structure-checks.js` | `discriminateMesh`, `discriminateOBJText`, `discriminateSVG`, `discriminateJSON`, `discriminateGLTF`, `discriminatePNG` |
| `pdf-page.js` | `jpegToPdf` |

`superframe/lib/seed-streams.mjs` moved in the earlier change, from the site's `system/media-engine/seed.mjs`, with its tests in `superframe/tests/seed-streams.test.mjs`. It is a port candidate too: `mulberry32`, `fnv1a32`, `fnv1a32Hex`, `rngFrom`, `xmur3`, `makeRng`, `seedScalar`.
