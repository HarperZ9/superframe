# rooms

Experimental rendering and bench physics you can look through and measure: lens shapes, optical trains, curved-light worlds, wave optics and sourced material data, with known-answer tests and a CPU reference.

```
node --test "packages/rooms/tests/*.test.mjs"
```

```js
import { shapes, lensFS, trainEFL, PRESETS, CONSTANTS } from "./packages/rooms/core/index.js";

trainEFL(PRESETS.cooke);          // 50.02: the Cooke triplet's focal length, from rays
CONSTANTS.bk7Nd;                  // value, unit, source, and what it was checked against
CONSTANTS["mat.amber.V"].flag;    // "from memory, unverified"
```

The design and the reasoning are in `project-docs/DESIGN.md`. Licence: FSL-1.1-MIT; `core/data/cie.js` is CC BY-SA 4.0.
