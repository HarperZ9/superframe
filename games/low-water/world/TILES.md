<!-- writing-profile: readme -->
# Native world tiles: lw-tile-native-1

The generator writes the island as 48 binary tiles beside its PGM rasters. The native engine reads
these; the web walk still reads `lw-tiles-1` (gzip, delta-coded, made by `tools/pack.mjs`, described
in `tiles.mjs`).

## Files

| File | Holds |
|---|---|
| `t_<col>_<row>.lwt` | one tile, `col` 0 to 7 west to east, `row` 0 to 5 north to south |
| `tiles.json` | `format`, `seed`, `width`, `height`, `tile`, `cols`, `rows`, `all`, and each tile's payload hash |

A tile covers 256 x 256 cells and stores the 257 x 257 vertices of those cells, so two neighbouring
tiles hold the same values along their shared edge, and terrain built from each tile alone meets
without a gap. Past the island's east or south edge the last column or row repeats. Vertex `(i, j)`
of tile `(col, row)` is cell `(col x 256 + i, row x 256 + j)`.

## Layout

Little-endian throughout. A tile is a 64-byte header followed by six layers, each row-major
(`i` fastest), 257 x 257 = 66,049 values per layer. A tile is 528,456 bytes.

| Offset | Type | Field |
|---|---|---|
| 0 | 4 bytes | magic `LWTN` (0x4C 0x57 0x54 0x4E) |
| 4 | u16 | version, 1 |
| 6 | u16 | header size, 64 |
| 8 | u32 | island width in cells, 2048 |
| 12 | u32 | island height in cells, 1536 |
| 16 | u32 | x of vertex (0, 0), in cells |
| 20 | u32 | y of vertex (0, 0), in cells |
| 24 | u16 | vertices across, 257 |
| 26 | u16 | vertices down, 257 |
| 28 | u16 | metres per cell, 64 |
| 30 | u16 | height codes per metre, 16 |
| 32 | u32 | height code bias in metres, 512 |
| 36 | u32 | seed |
| 40 | u32 | layer count, 6 |
| 44 | u32 | payload bytes, 528,392 |
| 48 | u64 | FNV-1a 64 of the payload (bytes 64 to the end) |
| 56 | u64 | FNV-1a 64 of header bytes 0 to 55 |

| Layer | Type | Value |
|---|---|---|
| height | u16 | ground height code: metres = code / 16 - 512, a step of 6.25 cm |
| water | u16 | water surface in the same code, 0 where the ground is dry |
| moist | u8 | rain share, 0 to 255 |
| river | u8 | river class, 8 x sqrt(drainage in km2), 0 off the river lines |
| biome | u8 | ground cover, 0 to 13 (`gen/climate.bld`) |
| region | u8 | region, 1 to 11 |

Every value is the number the matching PGM holds, so a tile and the rasters decode to the same
world. The writer refuses a tile whose value does not fit its layer instead of wrapping it.

FNV-1a 64 starts at 14695981039346656037 and, for each byte, XORs the byte in and multiplies by
1099511628211 modulo 2^64. `tiles.json` gives each tile's payload hash as a decimal string, and `all`
folds those 48 hashes, in row order, the same way. `world.json` repeats `all` as `hash.tiles`.

## Make and check

```bash
games/low-water/world/gen/target/release/main 20261118 <dir>   # writes PGMs and tiles
games/low-water/world/gen/target/release/main tiles <dir> 20261118   # tiles from existing PGMs
games/low-water/world/gen/target/release/main tiles-check <dir>      # decode every tile, compare
```

`tests/world.test.mjs` runs all three: the converter's tiles must be byte-identical to the
generator's, `tiles-check` must pass, and two controls must fail it (one tile byte flipped, one PGM
height code raised by one).

## Not yet

- The web walk reads `lw-tiles-1`. Moving it to this format would mean decoding 25 MB of
  uncompressed tiles in the browser, so it stays on the packed form for now.
- The native shell in `native/src/tools/lwshell/` reads `tilecut`'s PGM tile. Reading `.lwt` there is
  part of the native terrain work.
- No compression and no mip levels. CDLOD can build its levels from the vertices at load.
