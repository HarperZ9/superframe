<!-- writing-profile: research -->
# Rooms: one engine layer with the pages as views over it

Date: 2026-10-31.

## The problem

Each room started as a single dense page: its shapes, its shaders, its physics, its checks and its interface in one file. A new page copied what it needed, so the same FFT, the same units and the same constants drifted apart across pages. The author asked for the framework behind the pages to live in the engine. This package holds that framework, and each page becomes a thin view generated from it.

## Why it lives here

`packages/rooms` is in superframe, because superframe is the rendering engine under THE PLAYGROUND and the placement ruling sends new tools there. raw-native gets no package under that ruling and is itself due to migrate here. The code is browser JavaScript and GLSL, which matches superframe's language and its "JavaScript engine has no dependencies" line. No new repo was made.

## Layout

```
core/            importable from Node and the browser; no DOM, no GL, no view state
  shapes.js      surface functions: one GLSL body per shape, with menu groups and index fields
  scenes.js      far-side worlds, each one vec3 shade(ro,rd)
  materials.js   the material table, built from rows in constants.js
  constants.js   every physical constant, with unit, source and check
  provenance.js  the record type and its "from memory, unverified" flag
  units.js       scale plus dimension vector
  formula.js     the strict grammar: parse, rebuild as GLSL, evaluate on the CPU
  train.js       prescriptions and paraxial maths; train-trace.js is the CPU ray trace
  wave.js        FFT; propagate.js adds the focal field and angular spectrum
  film.js        Fresnel, thin-film transfer matrix, Jones matrices
  trace.js       CPU reference for the known answers
  sampler.js     the shaders' integer random number, on the CPU
  shaders/       program generators; one small program per shape
  registry.js    one way in for any view or tool
  adapters/      read the virtual bench and lens pipeline file formats
  families.js    spherical-harmonic globes as a registered shape family
solvers/         sound (wave field) and pcb (place, route, rules, fields, Gerber), importable with no browser
tools/steer.js   choose between candidates to steer any registered parameter space, with a replayable record
properties/      a property as a physical object: state space, operations, elements, instrument, route
views/           pages generated from core (stage 2 onward)
tests/           known answers, golden hashes from the source page, planted bad values
```

## The rules that make it hold

**One small program per shape and a flat trace loop.** A large nested shader hung ANGLE on D3D11. The program generator receives only the selected body, so the program's size does not grow with the shape table. `golden.test.mjs` fails if a program contains another shape's body or if the spread of program sizes grows past 3000 characters.

**Core has no view state.** One leak existed when the page was split: `worldFS` read the page's global `S.scatOn`. It now takes `c.St`.

**Provenance is a type.** `constant(value, unit, { source, verified })` refuses a row with no source, and a check must name what it ran against and its result. Anything else carries the flag `from memory, unverified`. A citation does not clear the flag. The numbers now flow from those rows: `MAT`, `G`, the electrowetting terms and the illuminant A constant all read `constants.js`, and the golden test holds them to the page's values.

**Two reference tiers for known answers.** The page's checks trace on the GPU, which CI does not have. `core/trace.js` and `core/train-trace.js` rerun the same answers on the CPU in double precision, so CI can catch a physics regression. The page's GPU versions stay in the view and run in a browser. The CPU tier checks the physics and constants; it does not check the shader, and the golden hashes cover the shader by holding its text to the source page.

**False-accept controls.** Each family has a planted case that must fail: a wrong index for the Snell window, a uniform ball for the Luneburg check, a bent Cooke radius, half the Airy radius, a scaled metamer, an unknown glass, one changed character in a shape body.

## Findings from the split

- The page's `fCompile` rejected `g = 0` written with a space before the equals sign, because the left side kept its trailing space and the tokenizer refuses a bare space. The core trims it. It is the one intended behaviour change, and it only turns an error into a working formula.
- `firstDark` places the ring by bin index, and one bin is about a tenth of the Airy radius at the page's grid. It reads 2.3 percent low on an ideal stop. The test states that resolution and allows 3 percent. The page's rule is kept so its readout does not change.
- With mu 0.1 and b 4 the weak-field index gives 4.0 percent more deflection than 4GM/(b c^2), which is the second-order term and not a fault. The test uses mu 0.01, where the first-order form holds to 0.4 percent.

## Room left for the render and diagram layers

Three directions came in while this was being built, and this layout keeps a place for each. Each is read for technique and rebuilt, with no figure or code copied.

- **Probe-based global illumination.** Ideas from public WebGPU path-tracing work: probes storing irradiance, screen-space fallback, temporal accumulation with hysteresis, sky light. In this package it would be a new shader family under `core/shaders/` that a program opts into, like `pol` or `scat`, with its probe volume as data. It must honour the flat-loop rule, and its known answer is a furnace test against the path tracer.
- **A shared diagram layer.** Sections, exploded views, block diagrams of processor, bus and memory, and a table by generation (a row per seed, a column per step, the form of a substitution tile table). `packages/diagram` on the open pull request is its likely home, reading registered records here. Lens Room's section and the PCB room's drawings are the first clients. None of it is built yet.
- **Spherical harmonic shapes.** Built: `core/families.js` registers Y(l,m) deformed globes on request, with flat generated GLSL and orthonormality tests.

## Properties as physical objects

The author's direction, 2026-10-31: "each property has a shape and a form and a function and a structure and a geometry too. So these are like potential instruments in potential space in this hypothetical calculation space."

A record in `properties/model.js` holds:

| Field | Meaning |
|---|---|
| state space and shape | a real mathematical object, marked as drawn in chosen coordinates |
| operations | what can move a state |
| elements | the physical part that performs each operation |
| instrument | the parts assembled for one compiled path |
| fabrication route | how it would be made, and that route's limits |
| verdict | what the bench checked, with the result |
| state | `potential` until a physical part is measured |

The plain label is a separate function from anything drawn. A passing verdict never changes the state; only `recordMeasurement`, which requires a part, an instrument, a reading, a person and a date, can do that.

Two cases exist. Polarisation on the Poincare sphere: a waveplate is a rotation of the sphere, and a path compiles to quartz plates whose Jones product is checked against the path's end. Impedance on the Smith chart: a line is a rotation and a stub moves along a conductance circle, and a matched path compiles to microstrip on the PCB engine's stackup, with reflection checked by a transfer matrix and by the engine's time-domain line solver.

## Steering

`tools/steer.js` is Mind's Eye's proposal rule on any parameter space. Over its 26 genes it reproduces the source page's candidates exactly, by hash over 40 draws. `lensSpace()` is the first registered space. The test simulates a person with a planted target, and a random picker and a decoy target are the controls. Those figures describe a simulated chooser; how well a person steers is measured by the study behind Mind's Eye. Its renderer, perceptual distance and page have not moved.

A program compiled cold on the view took 2.7 s (a harmonic shape new to the driver cache), within the few seconds the rule asks.

## Which size rules bend, and why

The standing limits are 300 lines per file and 50 per function. The page's code came across as moved statements, so a formatter could show each one and an AST check could prove it unchanged. That proof is worth more than short functions during the move.

- Files over 300 lines: `core/train.js` (378, mostly the prescription table), `solvers/pcb/router.js` (500), `solvers/pcb/checks.js` (356), and three view files of wiring and drawing: `lens-room/src/20-boot-extras.js` (375), `lens-room/src/43-tabs.js` (366), `pcb-room/src/11-2d-drawings-a.js` (393).
- Functions over 50 lines: 66. The largest are `bootExtras` (374), `bindInput` (299), `checksGen` (292), `drawDiagram` (193), `dcSolve` (183), `schematic` (183) and `runWave` (172). Generators like `lensFS` are mostly template text.
- GLSL bodies stay dense strings. Their bytes are what the golden hashes hold, and reformatting them changes the hash.

Now that parity is recorded, each long function can be split in its own change and rechecked with the same comparison.

## Licences

Package code is FSL-1.1-MIT with the repo. `core/data/cie.js` is CC BY-SA 4.0, as the CIE publishes those tables, and stays in its own file. Hat and spectre tile rules from the lens-geometry bench are not in this package yet; when they come, their BSD and MIT notices come with them. Nothing here comes from an AGPL source.

## Duplicates this leaves for later

`packages/perceive` and `packages/field` hold an FFT, CIE tables, and units on an open pull request. They are not on main, so this package cannot import them yet. `tests/units-field.test.mjs` compares the unit tables as soon as `packages/field` is present. The merge into one FFT is the placement plan's item and stays there.
