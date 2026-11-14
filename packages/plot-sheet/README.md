# plot-sheet

Turns any line drawing from the engine into files a pen plotter can draw: an SVG in millimetres with one layer for each pen, an HPGL file for vintage HP and Roland machines, and G-code for modern ones. Every sheet comes with its measures: how much line each pen lays, how far the pen travels lifted, how many times it lifts, and how long the plot should take.

The core is BuildLang (`bld/`). The engine's make command calls it, and so can any program that writes a text file.

## Run it

From the make command, beside the usual artifact files:

```bash
npm run make -- "heavy rust coral upper left, fine teal frost on the right" out/first --seed first --plot a4
```

```
out/first/plot.svg     297 x 210 mm, one group for each pen, stroke width = pen tip, no fills
out/first/plot.hpgl    IN, SP, VS, PU, PD in plotter units
out/first/plot.gcode   G21 G90, pen up and down as M3 S40 and M3 S90, a feed rate for each pen
out/first/plot.json    the measures, and a description of the sheet in plain words
out/first/plot.plot    the input Plot Sheet was given, so the sheet can be made again
```

and one line on the terminal:

```
plot sheet: 23701 paths, 2 pens | drawn hatch 79.005 m in 100.8 min, contour 16.508 m in 5.6 min | pen-up 10.621 m, was 105.285 m | lifts 23701 | about 106.4 min | box 14.331,28.29 to 258.5,127.73 mm | 2-opt: evaluation limit
```

`--plot` takes `a4`, `a3`, `letter`, or the path of a specification file. Without `--plot` the make command writes exactly what it wrote before.

On its own, with BuildLang installed (`buildc` 1.10 or newer):

```bash
buildc build --release packages/plot-sheet/bld
packages/plot-sheet/bld/target/release/main piece.plot out/piece --verify
```

`--verify` reads the three plotter files back and exits 1 unless each one draws the sheet it was written from.

The demonstration sheet, ridgelines of a terrain from the engine's own nodes on A3 with two pens:

```bash
node superframe/tools/plot-strata.mjs out/plot-sheet/strata
```

## The input file

One statement a line. A specification file is the same statements without the paths.

```
plotsheet 1
title Strata sheet
seed strata-1
paper 420 297
margin 18
marks on
legend on
pen 0.5 #33261d 60 - near umber
pen 0.3 #6f8fa6 60 - far blue grey
path 1 #000000 0 12.5 40 13.1 39.2 14 38.7
loop 2 #000000 0 100 100 140 100 140 140 100 140
```

| Statement | Meaning | Default |
|---|---|---|
| `paper <w> <h>` | sheet size in mm | required |
| `margin <all>` or `margin <top> <right> <bottom> <left>` | mm kept clear | 0 |
| `source <w> <h>` | extent of the path coordinates | bounding box of the paths |
| `scale fit` or `scale <mm>` | mm for one source unit; the drawing is centred in the printable area | fit |
| `pen <tip mm> <#rrggbb> <mm/s> <registry id or -> <name>` | one pen; list them in stall order | at least one |
| `order light-first` or `order listed` | which pen layer is drawn first | light-first |
| `join <mm>` | ends of one pen's paths closer than this are joined | 0.1 |
| `minlen auto` or `minlen <mm>` | shorter paths are dropped and counted | auto: half the pen tip |
| `simplify <mm>` | points within this distance of the line through their neighbours are removed | 0.02 |
| `optimise <ms> <evaluations> [window]` | limits of the 2-opt pass | 400, 20000000, 400 |
| `hatch <mm> [degrees]` | hatch filled regions at this spacing | off, 45 |
| `marks on`, `legend on` | registration crosses in the corner margins; a tally and a 10 mm test line for each pen | off |
| `travel <mm/s>`, `lift <s>` | pen-up speed and the time of one lift, for the time estimate | 200, 0.2 |
| `hpgl-units <per mm>`, `hpgl-offset <x> <y>` | plotter units in a millimetre; a shift in mm | 40, 0 0 |
| `gcode-up`, `gcode-down`, `gcode-change <text>` | the lines written to lift the pen, drop it, and pause for a pen change | `M3 S40`, `M3 S90`, `M0` |
| `path <pen> <#rrggbb> <fill> <x y> ...` | an open path | |
| `loop <pen> <#rrggbb> <fill> <x y> ...` | a closed path | |

`<pen>` counts from one. `0` leaves the choice to the colour clustering: strokes are grouped by colour into as many groups as there are pens, and the darkest group goes to the darkest pen. `<fill>` is a hatch group: `0` for none; closed paths with the same number are hatched together, so a loop inside another is a hole.

A pen's colour is sRGB. The registry id is carried into `plot.json` as given. The registry has no ink table yet, so the id is not looked up.

## What it does to the paths

In this order: source units to millimetres, hatch lines for filled regions, clipping to the printable area, rounding to whole micrometres and simplifying, a pen for every path, joining, dropping paths too short to draw, marks and legend, then draw order.

Draw order is chosen for each pen to cut the distance travelled with the pen lifted, counted from the bottom left corner of the sheet and back. It starts with the nearest path end, drawing each path from whichever end is closer, then improves the tour by reversing runs of paths (2-opt). The result never has more pen-up travel than the order the paths arrived in: when it would, the arriving order is kept, and `plot.json` counts those layers.

## Measures

`plot.json` holds, for each pen: paths, metres drawn, pen-up travel before and after ordering, pen lifts, and estimated seconds at the stated speeds. For the sheet: the totals, the bounding box in mm, how many paths were joined, clipped away or dropped, how many points simplifying removed, and why the 2-opt pass stopped. The `description` field says the same in sentences, and the SVG carries it as `<desc>`, so a screen reader can say what the sheet holds.

The time estimate is drawn length over pen speed, plus pen-up travel over travel speed, plus a fixed time for each lift. It does not model acceleration, so a real plot of many short paths takes longer.

## Same input, same bytes

The same input file gives the same four files, byte for byte. `fixtures/mixed.plot` is a small sheet that uses every stage, and `fixtures/mixed.sha256` pins its four files: the hashes were made on Windows with buildc 1.10, 1.11 and 1.14, and CI checks them on Linux. Coordinates are rounded to whole micrometres before anything is ordered or written, and every number in a file is printed by integer arithmetic.

One case is outside that promise. The 2-opt pass has two limits, a count of evaluated moves and a wall-clock time. The count gives the same answer everywhere and is the one meant to bind. If a slow machine reaches the time limit first, the order depends on the machine, and the summary line and `plot.json` say `time limit`.

## Speed

Measured on the development machine on 2026-11-14, release build, one core: a sheet of 20,000 ten-point paths is read in 0.12 s, built in 0.30 s and written in 0.52 s, 0.95 s in all, and pen-up travel falls from 3520 m to 41.7 m. The test budget is 2 s for build and write, and the test runs unoptimised, where the same work takes 1.3 s. The make command's own lines at 3840 x 2160, 23,701 paths after joining, take 1.5 s.

On that sheet nearly all of the gain is the nearest-end pass (3520 m to 43.3 m). The 2-opt pass takes it to 41.7 m at the default limits and to 39.2 m when left to finish, which takes 1.2 s. On a shuffled grid of 1000 strokes the two together cut travel 25 times.

## HPGL

The instructions and the unit come from Hewlett-Packard's "HP 7475A Graphics Plotter Interfacing and Programming Manual", read on 2026-11-14 from the Internet Archive text at `archive.org/stream/HP7475AInterfacingandProgrammingManual/HP7475AInterfacingandProgrammingManual_djvu.txt`.

- The file is `IN;PA;` then, for each pen, `SPn;VSv;` and one `PUx,y;PDx,y,...;` for each path, then `SP0;`. It holds no line ends, because the manual allows a line feed as a terminator only over HP-IB.
- Coordinates are whole plotter units from the bottom left corner of the sheet. Where a machine puts its origin depends on the model and its paper setting; `hpgl-offset` shifts the file.
- The manual gives the unit twice: 0.025 mm in its introduction and under the OF instruction, and 0.02488 mm (about 40.2 to the millimetre) in the section "The Plotter Unit". The default is 40 to the millimetre. For a 7475A set `hpgl-units 40.2`, and measure a plotted 100 mm line before trusting either figure.
- `VS` is in cm/s. `SP` takes 1 to 6 on a 7475A.
- The manual limits coordinates to 32767 units, 819 mm at the default. The program prints a note for a larger sheet.

No real plotter has drawn these files. The tests prove that each file says what the sheet says, in the stated units.

## Tests

```bash
buildc run packages/plot-sheet/bld/selftest.bld
node --test superframe/tests/plotsheet.test.mjs
packages/plot-sheet/bld/target/release/main packages/plot-sheet/fixtures/mixed.plot out/mixed --verify
(cd out && sha256sum -c ../packages/plot-sheet/fixtures/mixed.sha256)
```

The first prints one line for each of 57 checks and exits 1 on any failure. Among them:

- A 100 mm square lands on the sheet at the stated millimetres, and its HPGL and G-code are compared character for character with files worked out by hand, at 40 and at 40.2 units a millimetre.
- Clipping, simplifying, joining, dropping, hatching with a hole, and pen assignment each meet a hand-computed answer.
- Ordering: on 41 sheets the written order never has more pen-up travel than the arriving order, and a shuffled grid loses at least nine tenths of it.
- Round trips: each of the three files is read back by a reader that shares no code with its writer, and must give the sheet's paths in order, within 0.015 mm for HPGL and 0.0006 mm for the others.
- Controls that must fail: a file with one path dropped, a file that draws nothing, HPGL read at the wrong unit size, and another sheet's file.
- Two builds of one input give the same bytes; a different seed does not.
- The speed budget, and a 2-opt pass given 100 ms stops on it.

## Where the parts come from

Path ordering by nearest end, one layer for each pen, and drawing light inks before dark ones are common practice among people who plot. Nothing here is taken from any artist's files or images. The feature list was shaped by how these people describe their work:

- Paul Rickards drives restored HP and Roland plotters with HPGL from his own code. That is why HPGL is written here beside SVG and G-code.
- Daniela Kröhnert publishes the line counts and metres of ink of her sheets, and plots light inks first. The measures in `plot.json` and the default layer order follow that practice.
- Pavlovpulus (Pablo Azócar) and Paul Rickards draw stacked, hidden-line landscapes and traces. The demonstration sheet belongs to that family and is drawn from the engine's own terrain.
- vpype set the working conventions for plotter SVG: single-stroke paths, real units, layers numbered by pen.

Inside the engine: the nearest-end ordering, the colour clustering and the G-code form are ported from the site plotter (`superframe/upstream/site-3ca6529/system/plotter.js`), and the hatch law from `substrate/lib/vector.mjs`. The methods are textbook ones: Liang and Barsky's line clipping (1984), the Ramer-Douglas-Peucker simplification (1972, 1973), and Croes' 2-opt (1958).

## Not done

- No file has been drawn by a real plotter. HPGL and G-code are checked by round trip only.
- The BuildLang ports of the clustering and the hatch law are tested against hand-computed answers. They are not yet held bit for bit to the JavaScript they came from.
- Pass counts for heavier lines, a per-segment feed rate, process-colour separation and an ink preview are other candidates that write through this package.
- The caller side in the engine is still JavaScript. `BUILDLANG-PORT.md` lists what that needs and the compiler faults met on the way.
