# The renderer in BuildLang

The renderer is moving from C++ to BuildLang one module at a time. A module counts as moved when
its BuildLang program reproduces a number the C++ already pins, byte for byte. The C++ stays in
place as the reference until every caller of that module has moved.

## Moved so far

| Module | C++ source | BuildLang | Proof |
|---|---|---|---|
| Art scene: ray caster, sun shadow, sky and ambient shading, four samples a pixel | `src/renderer/art_scene.cpp`, `art_scene_trace.cpp`, `art_scene_prims.hpp` | `bld/art_scene/main.bld` | Frame 0 of the orbit at 256 x 144 in daylight. The hash of the lit buffer is `0x8e70a9159d2007bf`, the value `tests/test_art_strokes.cpp` pins for GCC and MSVC. All 110,592 colour floats were also compared one by one against the C++ and are equal. |

Run it:

```bash
buildc build --release native/bld/art_scene
```

```bash
native/bld/art_scene/target/release/main
```

The program prints `byte-identical to the C++ lit buffer: 1 of 1` on a match and `0 of 1` on any
difference. CI runs it on every change.

## What the port needed from the language

Each item is compiler work for BuildLang. The port works around all three today.

1. **Wrapping 64-bit multiply.** Integer arithmetic stops the program on overflow, and FNV-1a needs
   a multiply that wraps. The port keeps the hash as four 16-bit limbs. A `wrapping_mul` or a `u64`
   with defined wraparound would remove about twenty lines and most of the hashing time.
2. **The bits of a float.** No cast from `f32` or `f64` to its bit pattern was found in buildc
   1.10.0. The port rebuilds the 32-bit pattern by arithmetic, with round-half-to-even. A `to_bits`
   on both float types is needed for every hash, file format and network format the engine has.
3. **`tan` and the rest of the maths library.** `sin`, `cos`, `sqrt`, `floor`, `exp` and `pow` are
   built in. `tan` is declared through the C header, and that puts a `Foreign` effect on every
   function above it.

Two more are about speed and are next to measure: a three-number vector is a heap `Vec<f64>` here,
where a struct or a fixed array would stay on the stack, and the frame is rendered on one thread
where the C++ uses a row-parallel loop.

## Next modules

In order: the town scene (`art_scene_town.cpp`), the lamp term and night lighting, the 8-bit
encoder and the metrics in `art_metrics.cpp`, then the stroke and paint passes, whose pinned
hashes are in the same test file.
