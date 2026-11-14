# Plot Sheet and BuildLang

## The decision

The core is BuildLang: geometry, pen layers, joining, ordering, the three writers, the measures, the readers used for checking, and the tests. It follows the route the registry checker and the renderer already use. BuildLang source compiles through the C backend to one program, `buildc build --release packages/plot-sheet/bld`, and CI builds and runs it with the compiler the repository pins.

It was written and run on 2026-11-14 with three compiler builds: 1.10.0, 1.11.0 and 1.14.0. All three give the same output bytes and pass the same 57 checks. The compiler was not rebuilt for this work.

## What is still JavaScript, and why

The make command, the graph and the nodes that produce line drawings are JavaScript today, so the caller side is too:

| File | Lines on 2026-11-14 | What it does | What moves it to BuildLang |
|---|---|---|---|
| `superframe/lib/artifact/plotsheet.mjs` | 56 | turns the engine's vector shape into the plot input text, finds or builds the program, runs it | the make command in BuildLang; this file then goes away unchanged |
| `superframe/lib/artifact/render.mjs`, `superframe/cli/superframe.mjs` | 11 added, 5 removed | the `--plot` option | same |
| `superframe/tools/plot-strata.mjs` | 44 | the demonstration: evaluates two engine nodes and assigns pens by height | the terrain and ridgeline nodes in BuildLang |
| `superframe/tests/plotsheet.test.mjs` | 66 | tests of the hand-off only | same |

None of these holds geometry, ordering or a file format. The boundary is the plot input file (`bld/input.bld` states it), so a BuildLang caller writes the same text, or calls `build::build` with a `Spec` and `Paths` directly, and nothing in the core changes.

## Module boundaries

| File | Holds | Depends on |
|---|---|---|
| `sheet.bld` | the three records: `Paths`, `Spec`, `Plot` | |
| `num.bld` | rounding, integer printing of numbers, text joining | |
| `grid.bld` | nearest-point search with removal | num |
| `geom.bld` | millimetres, clipping, simplifying | num, sheet |
| `pens.bld` | colour clustering and layer order | num, sheet |
| `join.bld` | joining and dropping | grid, sheet |
| `hatch.bld` | hatch fill, registration marks, legend | num, sheet |
| `order.bld` | nearest-end tour and 2-opt | num, grid, sheet |
| `build.bld` | the pipeline: `build(spec, paths) -> Plot` | all of the above |
| `stats.bld` | measures as JSON, as a sentence, as one line | num, sheet |
| `write.bld` | SVG, HPGL and G-code from a `Plot` | num, sheet, stats |
| `input.bld` | the plot input file | num, sheet |
| `read.bld` | readers for the three files, and the comparison | num, sheet |
| `main.bld` | the command line | all |
| `selftest.bld`, `tkit.bld`, `t_*.bld` | the tests | all |

## Compiler and tooling gaps met

Each was seen on the versions named. Each is work for the BuildLang compiler.

### 1. `clear()` then `push` corrupts the heap (1.10.0, 1.11.0; gone in 1.14.0)

```
fn main() ~ Console {
    let v: Vec<f64> = Vec::new();
    let mut row: i32 = 0;
    while row < 200 {
        v.clear();
        v.push(1.0);
        v.push(2.0);
        row = row + 1;
    }
    println("rows {} len {}", row, v.len());
}
```

On Windows, `buildc run` of this program ends with exit code 0xC0000374 (heap corruption) on 1.10.0 and 1.11.0 and prints `rows 200 len 2` on 1.14.0. CI pins a 1.10.0 commit, so the package never calls `clear()`: `num.bld` has `empty_f` and `empty_i`, which pop until the vector is empty. Once the pin moves past the fix, those two functions can become `clear()`. A regression test for this in the compiler's own suite would keep it fixed.

### 2. A module declared in two files defines its structs twice (1.10.0, 1.14.0)

With `mod geom;` in both `main.bld` and `use2.bld`, and a `pub struct` in `geom.bld`, the C compiler stops with `redefinition of 'struct Sheet'`. Functions survive the double declaration (the registry checker relies on that); structs do not. Here every module is declared once, in the entry file, and other files only `use` it. The cost: a module file cannot be compiled or tested on its own.

### 3. `buildc build` builds only `main.bld`, and `buildc run` has no release mode

`buildc build --release <dir>` looks for `<dir>/main.bld` and refuses a file path. `buildc run <file>` takes a file and has no `--release`. So a second program in the same directory, here `selftest.bld`, can only run unoptimised. The speed test therefore times an unoptimised build (1.3 s where the release build takes 0.8 s). Wanted: `buildc build --release <file.bld>` or `buildc run --release`.

### 4. `Vec<String>.join` is missing from the C backend (1.10.0, 1.11.0; present in 1.14.0)

`num.bld cat` joins by halves. It also keeps the writers fast: 400,000 pieces join in about 0.26 s.

### 5. No byte or character-code access to a string (1.10.0 to 1.14.0)

`byte_at` is not a method on a string, and `char_at` returns a one-character string. Reading a format one character at a time allocates a string for each character. The input file was designed around `lines()`, `split_whitespace()` and `split()` so that no reader walks characters, and it parses 400,000 numbers in 0.08 s. A JSON or SVG reader for general input would need byte access to be fast.

### 6. No SHA-256 on the C backend in 1.10.0

`"abc".sha256()` is a type error on 1.10.0 and works on 1.14.0. The pinned bytes of the fixture are therefore checked by `sha256sum` in CI and not by the BuildLang tests.

### Behaviour to know, working as designed

- `substring(a, n)` takes a start and a length.
- An effect such as `Clock` or `Console` must be named on every function between `main` and the call that needs it.
- Struct fields that are vectors are shared when the struct is passed to a function, which this code relies on. Scalar fields were kept in vectors (`Spec.opt`, `Plot.note`) so that a stage can change one without the question of whether a struct is copied.

## Not tried

- Formatted float printing (`{:.3}`). The writers print integer micrometres by choice, so that no file depends on a C library's float formatting.
- The LLVM and other backends. Everything here ran through the C backend with gcc.
- Calling the core as a static library from the JavaScript engine. A process and a text file were fast enough: 0.13 s for the demonstration sheet, 1.5 s for 23,701 paths.

## Parity still owed

`pens.bld` ports the site plotter's colour clustering and `hatch.bld` ports the engine's flat hatch. Both are tested against answers worked out by hand. Neither is yet held bit for bit to the JavaScript it came from, which is what the repository asks before old code is removed. The JavaScript originals stay in place for their existing callers.
