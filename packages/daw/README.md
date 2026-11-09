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
- **Voice modulation** (`voicefx.py`, `spectral.py`, `voice_read.py`): pitch and formants moved independently (phase vocoder, varispeed, and the true spectral envelope), a harmoniser, a channel vocoder, breath at a set harmonics-to-noise ratio, varispeed for slowed tape and turntable sounds, and a sampler that chops a voice to a beat grid, pitched, reversed and gated, with a sha256 per slice. Works on any voice: the vocal tract here or a recording. Each move is read back by `voice_read.py` (pitch, pitch track, vibrato, LPC formants, HNR) in `tests/test_voicefx.py`.
- **Singing tract** (`sing.py`): an expressive voice from the measured tract shapes. A pitch line with vibrato (rate, depth, onset), jitter and shimmer, effort that changes the glottal pulse (soft to pressed, read as H1 - H2), aspiration, and vowels that glide between the Dresden MRI area functions section by section. Sung vowels meet the measured formants within 10 percent (`tests/test_sing.py`).
- **Choir** (`choir.py`): parts of several singers, each a whole voice from `sing.py` with their own pitch offset, vibrato rate and depth, entry time, tract length, jitter and shimmer seeds and stereo place, all drawn from the seed and listed in the receipt. Stems sum to the mix. Every singer's vibrato and pitch read back from their own stem; a section's vowel meets the measured formants within 10 percent (`tests/test_choir.py`).
- **Sustain**: a bowed string that settles into Helmholtz motion and a reed on an air column with its blowing threshold (`sustain.py`).
- **Waveguides and effects**: waveguide strings and a three-string piano (`waveguide.py`); volume swell, tremolo and delay with an analyser that reads their settings back (`effects.py`).
- **Tape echo and electric piano**: a tape loop with erase, record and three playback heads, wow and flutter from the transport, gap loss, saturation and a three-spring tank (`tape_echo.py`), read back by the analyser in `effects.py`; a tine and tone bar fork with a neoprene hammer and a magnetic pickup (`rhodes.py`). Plate and audio: `python -I packages/daw/page/echo_plate.py out/echo` (needs matplotlib).
- **Harmony**: dissonance curves from an instrument's own partials (just intervals for a string, its own ratios for a bar), voice-leading distance, tension as pitch.
- **Nature**: aeolian tones (f = St U / d) and bubbles (Minnaert).
- **Scenes that sound**: one physics record read by the renderer and the DAW (`scene.py`, `ARCHITECTURE.md`); rain from Marshall and Palmer drop sizes, landing speeds and the bubbles they leave, peaking near 15 kHz under water.
- **Workstation**: notes in beats on exact samples, automation, equal-power pan, a room send, a limiter, WAV 16, 24 and 32-bit float, FLAC, and a superstack receipt.
- **Stems that add up** (`stems.py`): every track is written as its own file with its own room return, one static loudness gain and the master limiter's gain curve, so the stem files sum to the master file bit for bit (32-bit float by a fixed summing rule, 24-bit as an integer sum); `check_sum` proves it and fails when a stem is left out.
- **Patch library** (`patches.py`, `voices.py`): an instrument as a JSON record (engine, parameters, insert chain, mixer defaults) with a content hash; save, recall by name and version, list. Engines: modal objects, the waveguide piano, the electric piano, a plucked string, a bowed string, a noise floor. A recalled patch renders the same bytes as the same instrument built inline.
- **Stiff strings** (`dispersion.py`): piano inharmonicity, f_n = n f0 sqrt(1 + B n^2), from a cascade of allpasses in the waveguide loop, fitted to B per note and read back from the rendered partials; `piano(..., b=B)` and the patch value `"inharmonicity": "register"`. B per note is measured from recordings of a Steinway model B (University of Iowa MIS piano, `packages/measured/data/piano_b_iowa.json`), and the rendered string meets it within 10 percent on 87 of 88 keys (B7, extrapolated, reads 11.8 percent low).
- **Subtractive voice** (`subtractive.py`): polyBLEP saw and pulse, a trapezoidal state-variable filter (-3 dB at the cutoff, lossless self-oscillation at k = 0), envelopes, unison pads; the `pad` engine.
- **Generated spaces** (`space.py`): stereo impulse responses with Eyring T60 per octave band from a room's size and surfaces, or a set T60, early reflections from image sources, and a decorrelated tail; read back by Schroeder integration. Any number of spaces per piece (`Arrangement.spaces`, `Track.sends`), and `Track.width` for a side signal that leaves the mono sum unchanged.
- **Texture and sampler** (`granular.py`, `sampler.py`): grain clouds (density, size, scan, jitter, pitch spread, stereo pan) and a spectral freeze that holds partials at their true frequencies; a sampler over our own renders that refuses a file whose sha256 does not match, and carries the source hash and place on every slice (chop to a grid, pitch with or without keeping time, stretch, reverse, gate, loop). Engines `sampler`, `grains`, `freeze`.
- **Electronic kit** (`kit.py`): an 808-style bass drum with a pitch glide and set decay, hats from brass plate modes and band-passed noise, and rolls from 1/8 to 1/32 with a velocity ramp. Engines `kick`, `hat`.
- **Saturation and crush** (`saturate.py`): tanh, diode and biased-tube curves run 4x oversampled (aliases measured over 20 dB lower than without), bit reduction and sample-and-hold, each as a `Track.inserts` entry; harmonic levels match the curve's Fourier coefficients and a crush's step and a hold's rate read back from the output.
- **Prepared piano** (`prepared.py`): a mass or a damping wedge at a point of the string; partials from the loaded-string equation, held to a finite-difference eigen-solve within 0.5 percent; a mass on a mode's node leaves that mode where it was.
- **Pipe organ** (`organ.py`): flue pipes cut from the air column with end corrections (an 8' low C comes out within 5 percent of 8 feet), stopped pipes with odd partials, stops by footage (nazard at 3x, tierce at 5x), and a shared wind supply that sags as more pipes speak.
- **Tempo map and metre** (`tempo.py`): held and ramped tempo in closed form, bars of any metre, free time; `Arrangement(tempo=map)` starts every note on the map's sample and holds it for the map's time (`retime` remains for a constant-tempo arrangement).
- **Loudness** (`loudness.py`): BS.1770 integrated, short-term, momentary, loudness range and 4x true peak from `packages/remastering`, a static gain to a target loudness, and the numbers in every stems receipt.
- **Real-time engine** in BuildLang: kernels in `bld/dsp.bld` (modal bank, voice bank, moving-source path), checked against the Python reference; the host in `bld/main.bld` opens the audio device through BuildLang's own binding (`bld/audio.bld`, `bld/bl_audio.c` from buildlang's `runtime/audio`) and counts deadline misses.

## Play it inside another DAW (CLAP)

```
python -m daw.clap_build out/clap         # from packages/daw: out/clap/superframe.clap and a test host
```

Copy `superframe.clap` into your CLAP folder (Windows `C:\Program Files\Common Files\CLAP`, macOS `~/Library/Audio/Plug-Ins/CLAP`, Linux `~/.clap`) and load "superframe bars" or "superframe piano" in a CLAP host such as Bitwig, REAPER or FL Studio. "superframe bars" is the BuildLang modal bank with measured aluminium loss. "superframe piano" is the stiff waveguide string with inharmonicity measured on a Steinway model B, at 44.1 or 48 kHz; its per-key loop table (`clap/piano_table.h`) is written from the offline code by `daw/clap_tables.py`. Both strike on the note's own sample with no added latency, and both equal the offline render bit for bit at any host block size (`tests/test_clap.py`). Built and tested here on Windows and in Linux CI; not yet tried in a commercial host.

## Run the BuildLang engine

```
buildc run packages/daw/bld/main.bld              # null device: timing only, no sound
buildc run packages/daw/bld/main.bld -- wasapi    # the Windows default output, fed silence
node packages/daw/engine/impacts.mjs | buildc run packages/daw/bld/main.bld -- wasapi live   # engine impacts, live
```

Needs a buildc with `slice::from_raw_parts_mut` and extern `source` clauses (BuildLang main after 1.10.0). The tests in `tests/test_native.py` build the kernels themselves when `BUILDC` or `buildc` is found, and skip with the reason otherwise.

## Limits

Loss factors for aluminium and steel are measured from recorded bars (upper bounds, since a mounted bar also loses energy to its supports); the other materials' are still from memory and marked so. Arrangement, mixer and export run offline in Python. Full design, measurements and roadmap: `DESIGN.md`.

Code: FSL-1.1-MIT. `daw/superstack.py` is superstack v0.2.0, vendored unchanged and pinned by sha256.
