# world

One field, many properties. Refraction, flow, measurement, shape, voice, territory and circuitry are capabilities
that any element can carry at a weight from 0 to 1, in one shared space. An element carries them over a soft region
whose rim is a gradient, so where a lens meets moving water the light bends by both at once, at the weights they hold.
Nothing here is a room: each property is the core of a package that already exists, used as it stands.

```
node --test packages/world/tests/*.test.mjs   # kernel, continuity, the scene's known answers, parity, the bundle
node packages/world/bench.mjs                 # the frame budget of a step and a trace, without drawing
node packages/world/bundle.mjs                # dist/world-field.mjs, the one file a page loads
node packages/world/parity.mjs                # every feature of every touched package still resolves
```

```js
import { createScene } from "./packages/world/scene.mjs";

const s = createScene();                    // glass, water, a probe, a voice and a ground
s.set("probe", { carries: { circuit: 1 } }); // any element can carry any property
s.step();                                   // flow, dye and sound move; the field is worked out again
s.trace();                                  // 17 rays bent by n^2, each with its turn in degrees
s.read().label;                             // "potential. Bench verdict: pass on every reading is a finite number."
s.dims().major.text;                        // "73 mm ± 3.0"
```

| Property | Core it runs on | What it gives |
|---|---|---|
| lens | `rooms/core/trace.js` `rk4`, `rooms/core/fields.js` (Luneburg, Eaton), `rooms/core/constants.js` (indices) | n^2 over the plane, rays |
| flow | `superframe/lib/medium/grid.mjs` (Stam's stable fluids, as `creation/lib/gen/advect.mjs` runs it) | velocity, carried dye |
| measure | `rooms/properties/model.js` `instrument`, `plainLabel` | weighted readings with spread, state potential |
| shape | `diagram/cad/src/param.js` `hasTol` (the tolerance rule) | toleranced dimensions by second moments |
| sound | `rooms/solvers/sound/fdtd.js` `WaveField` | a pressure wave, which bends light |
| map | `rooms/maps/map.js` `statusFrom` | the graticule as the light carries it |
| circuit | `rooms/solvers/pcb/formulas.js` `hammerstad`, the two-layer stack | a trace's impedance on the medium |

## The kernel

`src/field_kernel.bld` is the source of record for the blend: the soft rim, a carrier's share, the union of two
strengths, their mixture and the index blend. `field.mjs` mirrors it function for function and the test holds the
mirror to `src/field_kernel.expected`, the program's output. With `BUILDC` set to a BuildLang compiler the test runs
the program again. A page needs the mirror today: the compiler's WebAssembly target writes text (WAT), and no
assembler is in the toolchain yet to turn it into a module a browser loads.

## Checks

- Continuity: each output the page shows is sampled at 40 and 80 weights from 0 to 1. A smooth output's largest step
  halves when the sampling doubles; a jump's does not. The control, a property switched on at half weight and a rim
  with no gradient, fails the same check.
- Parity: `parity.json` lists 512 features of 13 packages (every export of each touched module, the CAD members,
  the lenspipe and instrument Python definitions, the room page builders, records, schemas and shader folders). The
  field reaches 19 of them; the rest stay where they were. The test fails when any row stops resolving.
- The bundle the site carries is rebuilt in the test and must match byte for byte.

## Limits

The scene is two dimensional and runs on the CPU on a 100 by 60 grid. Dye raises water's index by a chosen 0.2 of
n^2, and sound's coupling to the index is exaggerated, both so the effects can be seen; the forms are physical and
the sizes are not measured. Readings are simulated and stay potential until a physical part is measured. The map
from object to image has no held-out test yet, so its status is analogy.

Licence: MIT.
