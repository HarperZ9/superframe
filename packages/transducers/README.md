<!-- writing-profile: readme -->
# transducers

Every kernel takes a field, returns a field and states what it lost in measured bits. A lens, a mirror, a photosite, a retina, a neuron and a sequence aligner read on one ledger.

```
node --test tests/*.test.js     # known answers, planted errors, shuffled controls
node demos/run.js               # the four chains and the budget sweep
node page/build.js              # the live page, written to TRANSDUCERS_OUT
```

## The interface

`T.kernel({ id, group, axes, from, to, claims, forward, inverse?, targets?, keeps?, loss?, physics? })` builds a kernel. `T.run(kernel, field)` runs one and returns the output with a row of what it cost. `T.chain(field, kernels, opt)` composes them and names the step that lost most.

| Declared | Checked by |
|---|---|
| `from`, `to`: domain, unit, analog or digital | refused on entry and exit |
| `claims`: isomorphism, embedding or homomorphism | measured on the data by the field type |
| `keeps`: a structure the kernel promises | run every time; failure refuses even a lossless map |
| `axes`: light, noise, time, space | required |
| bits lost | round trip, `H(X|Y)`, mode capacity, Gaussian channel or entropy budget, named in the row; unmeasured is refused |
| `physics`: constants with their status | a from-memory value marks everything downstream |

Randomness follows superframe's `xmur3-mulberry32/1`, tested against `substrate/lib/vendor/superstack.mjs`.

## Kernels

| Group | Kernels |
|---|---|
| Lens and mirror | `thinLens`, `convolvePsf`, `mirror`, `metalMirror`, `metamerLens`: two ends of one transfer function |
| Transparency | `beerLambert`, `indexMatch`, `porterDuff`, `densityStack`, `transparencyMap` |
| Pixels and bits | `sample`, `quantise`, `ditherTPDF`, `diffuse`, `bayer`, `demosaic`, `entropyCode`, `bitplanes` |
| Digital and analog | `adc`, `dac`, `rcFilter`, `butterworth`; checked against the in-house circuit simulator |
| Noise | `shot`, `johnson`, `flicker`, `filmGrain`, `resonance` |
| Time | `shutter`, `phosphor`, `filmIntegrate`, `delay`, `spectrogram` with the Gabor check |
| Organic and biologic | `hill`, `michaelisMenten`, `filmCurve`, `photonCatch`, `cascade`, `lif`, `cable`, `hh`, `turing`, `phyllotaxis` |
| Machine | `neuronLayer`, `probeKernel` on a tiny network trained here |
| Bioinformatic | `alignKernel` and `lineBreak` on one solver (`dpSolve`), `kmer`, `pwm`, `felsenstein` |
| Space | `modal`, `modalFilter` (heat, fog, sound), `varadhan`, `sdf`, `lattice`, `shIrradiance` |
| Structure | `invariantKernel`, `persistKernel`, `contactMap`, `motifKernel`, `hollow` |

## The shared budget

Each chain row reports signal, noise floor, time and space resolution, and `I = (space modes)(time modes) log2(1 + SNR)`, with modes counted above the floor on the data. Bits kept are measured separately from coherence with the source. This `I` is not a bound on what a chain keeps: it fails where one averaged SNR reads near zero while low modes still carry bits. The per-mode form `budget.tight` holds there and fails by under a third at bright shot noise.

## Binding

The package reads its neighbours through `src/adapter.js`. `TRANSDUCERS_ROOT` points at the folder holding `field`, `perceive`, `measured`, `materials`, `diagram` and `kernels`, and defaults to the sibling packages. Tests that need measured tables skip and say why when those tables are absent. `TRANSDUCERS_TYPESET` adds the agreement check against the BuildLang line breaker. See `RECONCILE.md`.

## Limits

CPU reference only. Every kernel is a small-data reference, not a production path. Bits lost are estimates on the sample in hand, and each row names its method; methods differ, so losses do not sum to a true total. The built page inlines measured rows and stays internal until their terms are settled.

Licence: FSL-1.1-MIT, as the rest of superframe.
