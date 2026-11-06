<!-- writing-profile: readme -->
# daw

Instruments you build from matter. Pick a material and a shape (a steel string, an aluminium bar, a brass disc, a glass plate cut like a leaf, a column of air, a vocal tract), strike, pluck or blow it, and hear it from a place in a room. The pitches, the overtones and the decay come from the physics, and every material value says where it came from.

## Run it now

```
python -m pip install -r packages/requirements.txt
cd packages/daw
python -I -m daw.demo out/demo                 # 20 s piece, seven objects, one room: demo.wav, demo.flac, receipt.json
python -m pytest -q -p no:cacheprovider --import-mode=importlib tests
```

The demo prints the sha256 of its PCM. Run it again with the same `--seed` and you get the same bytes.

## Make an instrument

```python
from daw import materials as M
from daw.shapes_1d import Bar
from daw.modes import tune
from daw.synth import render

bar = tune(Bar(M.material("aluminium"), 0.3, 0.012), 440.0)   # size it so it rings at A4
print(bar.modes(4).ratios())                                  # 1, 2.7565, 5.4039, 8.9330
y = render(bar.modes(), 48000, 3.0, (0.5,), (0.02,), "strike", tau=1e-3)
```

Swap `"aluminium"` for `"steel_mild"` and every mode moves by sqrt(E / rho), the ratio of the two materials' bar speeds. Shapes: `String`, `Bar`, `Tube` (`shapes_1d`), `CircularMembrane`, `RectPlate`, `CircularPlate` (`shapes_2d`), and `Outline` for a plate or membrane of any outline drawn as a polygon.

## What is in it

- **Materials** with provenance from `packages/measured` (`mechanical.json`): Kaye and Laby's elastic constants, densities and sound speeds, Leissa's plate table, and the ISO 9613-1 air absorption table. Loss factors are from memory and marked so.
- **Resonators** with known answers: harmonic and stiff strings, free bars (1 : 2.756 : 5.404 : 8.933), Bessel membranes, Navier and clamped plates against Leissa 1969, air columns open and closed.
- **Space**: delay of r / c to the sample, 1 / r spreading, ISO 9613-1 air absorption, Doppler from the geometry, rooms of normal modes with a diffuse tail, rooms of water.
- **Voice**: a vocal tract from its area function with lip radiation and yielding walls (`tract.py`), a Rosenberg source, and self-oscillating two-mass vocal folds (`folds.py`) whose pressure, tension and adduction set pitch, loudness and breathy or pressed quality. Measured resonances of 44 printed MRI vocal tracts (Dresden Vocal Tract Dataset) are in `packages/measured`.
- **Sustain**: a bowed string that settles into Helmholtz motion and a reed on an air column with its blowing threshold (`sustain.py`).
- **Waveguides and effects**: waveguide strings and a three-string piano (`waveguide.py`); volume swell, tremolo and delay with an analyser that reads their settings back (`effects.py`).
- **Harmony**: dissonance curves from an instrument's own partials (just intervals for a string, its own ratios for a bar), voice-leading distance, tension as pitch.
- **Nature**: aeolian tones (f = St U / d) and bubbles (Minnaert).
- **Scenes that sound**: one physics record read by the renderer and the DAW (`scene.py`, `ARCHITECTURE.md`); rain from Marshall and Palmer drop sizes, landing speeds and the bubbles they leave, peaking near 15 kHz under water.
- **Workstation**: notes in beats on exact samples, automation, equal-power pan, a room send, a limiter, WAV 16, 24 and 32-bit float, FLAC, and a superstack receipt.
- **Real-time engine** in BuildLang: kernels in `bld/dsp.bld` (modal bank, voice bank, moving-source path), checked against the Python reference; the host in `bld/main.bld` opens the audio device through BuildLang's own binding (`bld/audio.bld`, `bld/bl_audio.c` from buildlang's `runtime/audio`) and counts deadline misses.

## Run the BuildLang engine

```
buildc run packages/daw/bld/main.bld              # null device: timing only, no sound
buildc run packages/daw/bld/main.bld -- wasapi    # the Windows default output, fed silence
```

Needs a buildc with `slice::from_raw_parts_mut` and extern `source` clauses (BuildLang main after 1.10.0). The tests in `tests/test_native.py` build the kernels themselves when `BUILDC` or `buildc` is found, and skip with the reason otherwise.

## Limits

Loss factors for aluminium and steel are measured from recorded bars (upper bounds, since a mounted bar also loses energy to its supports); the other materials' are still from memory and marked so. Arrangement, mixer and export run offline in Python. Full design, measurements and roadmap: `DESIGN.md`.

Code: FSL-1.1-MIT. `daw/superstack.py` is superstack v0.2.0, vendored unchanged and pinned by sha256.
