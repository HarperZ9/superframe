# The renderer in BuildLang

The renderer is moving from C++ to BuildLang one module at a time. A module counts as moved when
its BuildLang code reproduces a hash the C++ tests already pin, bit for bit. The C++ stays in
place as the reference until every caller of that module has moved.

## Run it

```bash
buildc build --release native/bld
```

```bash
native/bld/target/release/main
```

The runner prints one line a module, `same` or `DIFF`, then a control line and a count. CI fails
unless the count reads `1 of 1` today, and the number grows with each module.

## Moved so far

| Module | C++ source | BuildLang | Pinned in |
|---|---|---|---|
| Art scene: ray caster, sun shadow, sky and ambient shading, four samples a pixel | `src/renderer/art_scene.cpp`, `art_scene_trace.cpp`, `art_scene_prims.hpp` | `art_scene.bld` | `tests/test_art_strokes.cpp`, lit buffer of frame 0 at 256 x 144, `0x8e70a9159d2007bf` on GCC and MSVC |

During the first port all 110,592 colour floats of that frame were also compared one by one
against a C++ build and were equal.

## The parity kit

`kit.bld` holds what every port shares, so the next module starts from working parts:

- `V3` and its arithmetic, written in the C++'s order of operations.
- The renderer's FNV-1a over 32-bit floats and over bytes. It starts at 1469598103934665603, one
  digit short of the usual offset, because every pinned hash depends on that value.
- `report`, which compares a module's hash with the pin and prints the line.

`main.bld` is the runner. Adding a module is three steps: write `<module>.bld`, add `mod <module>;`
and add one `report` line with the hash copied from the C++ test.

Each module also gets a control: an input that must produce a different hash. A check that cannot
fail proves nothing.

## Method notes

- Keep every floating-point expression in the C++'s order. `a + b + c` and `a + (b + c)` differ in
  the last bit, and the hash sees it.
- A term the C++ multiplies by zero stays in the expression as a zero.
- Narrow to 32 bits only where the C++ does: `(v as f32).to_bits()` at the buffer write.
- When a hash differs, compare the two programs float by float before reading code. On the first
  port the floats were equal and the fault was the hash's starting value.

## Speed

The first draft kept each vector in a heap `Vec<f64>` and took 0.42 s for one frame. With `V3` as
a struct, the same frame and the control frame together take 0.08 s on the same machine, single
threaded. The C++ uses a row-parallel loop; a parallel loop here is the next measurement.

## Next modules

In order: the town scene (`art_scene_town.cpp`), the lamp term and night lighting, the 8-bit
encoder and the metrics in `art_metrics.cpp`, then the stroke and paint passes, whose pinned
hashes are in the same test file.
