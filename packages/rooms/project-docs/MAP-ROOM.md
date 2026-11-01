<!-- writing-profile: docs -->
# Map Room

Turn a likeness between two fields into an object that can be wrong. Each map names its domains, corresponding quantities with units, dimensionless groups, what it preserves, its claimed range, the bits a round trip loses, one held-out prediction, the condition that shows it failed, and a status given by a rule.

```
node packages/rooms/views/map-room/build.mjs out/rooms/map-room.html
node --test packages/rooms/tests/maps.test.mjs
```

Add `?still=1` for a 3840 by 2160 still, and `&tab=reg` for the registry.

## Status

- **Homology:** passed held out across the claimed range.
- **Broken:** passed somewhere and failed inside the claimed range, with the point named.
- **Analogy:** failed everywhere tried, or untested.

A pass doesn't set `shared_mechanism`. Two systems can share an equation with no shared carrier. Nine words run as checks: cross-applicable, renderable, interpretable, perceptible, applicable, testable, measurable, fallible, disprovable. They carry no total, so none can turn into a target.

## The one view

`maps/bond.js` is a one-junction bond graph: effort, inertance, resistance, compliance. Mass on a spring, an RLC loop and a pipe into a tank run on it with one disturbance. They trace one line in the dimensionless store. Raise the drive, and the pipe leaves near Re 2300 when its wall friction turns turbulent, which is where that map's range ends.

## Prior work

Bond graphs are Paynter's (1961). Baez and Fong (2015) treat passive circuits as morphisms, with a black-box functor that keeps external behaviour and forgets the inside, and Coya (2017) does the same for bond graphs. Those give composition and a proof. This registry adds a different thing: a held-out numeric test per map, a failure point, and a place to keep maps that fail. Each map lists its own prior work. Most of the exact maps here are textbook.

## Verified

Checked by `tests/maps.test.mjs` and the rooms test run: units of each group, the status rule, three systems' omega0 and zeta, one line under Re 2300, a turbulent pipe leaving it, power balance. Registry statuses come from studies run outside this package with numpy and public data; `registry.json` is their output. Its notes mark values from memory in `memory_values`, including Murray exponents, the spin-glass capacity, and the code table.

Renderable and perceptible did not fail on any map here, so they have yet to show they can. Interpretable and applicable are not run for most maps.

The site kit and dynamic type port is pending here, as in the other rooms.
