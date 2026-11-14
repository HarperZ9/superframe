# superframe/lib/formats

File writers the exporter uses. Each takes plain arrays and returns bytes.

| Module | What it writes | Tests |
|---|---|---|
| `midi-writer.js` | a Standard MIDI File, format 0: `writeMIDI`, with `vlq` for variable-length quantities | `superframe/tests/formats-midi-writer.test.mjs`, 7 tests |
| `relief-stl.js` | a watertight binary STL from a height map, in millimetres: `heightmapToSTL`, `stlTriangleCount`, `boundaryLoop`, `buildGrid` | `superframe/tests/formats-relief-stl.test.mjs`, 6 tests |

`superframe/lib/export.mjs` calls both.

## Origin

`midi-writer.js` and `relief-stl.js` began under `system/` on HarperZ9.github.io at commit 3ca6529, with the same file names. They sat in the engine as a vendored snapshot until 2026-11-14 and are maintained here from that date. The tests came from the site's `system/midi-writer.test.mjs` and `system/relief-stl.test.mjs`.

## Other implementations in this repo

`visualizer/lib/midi.mjs` is a second MIDI module. It has not been merged with `midi-writer.js`.

## BuildLang port candidates

These files are JavaScript that moved; the folder holds no new feature code. Both are byte writers with no browser API, so both can move to BuildLang today, with the tests above as the known answers.

| Module | Exports |
|---|---|
| `midi-writer.js` | `vlq`, `writeMIDI` |
| `relief-stl.js` | `stlTriangleCount`, `buildGrid`, `boundaryLoop`, `heightmapToSTL` |

`superframe/lib/seed-streams.mjs` moved in the same change, from the site's `system/media-engine/seed.mjs`, with its tests in `superframe/tests/seed-streams.test.mjs`. It is a port candidate too: `mulberry32`, `fnv1a32`, `fnv1a32Hex`, `rngFrom`, `xmur3`, `makeRng`, `seedScalar`.
