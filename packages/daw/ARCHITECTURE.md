<!-- writing-profile: research -->
# daw and the engine: scenes that make their own sound

The author asked for the workstation and the game engine to be one thing (2026-11-06, "DAW and game engine"). Here a scene in the engine makes its own sound: rain, ocean, wind, thunder, bubbles, impacts and materials drive the workstation's physical sources. The picture and the sound read the same physics, so they cannot drift apart.

## 1. One record, two readers

A scene carries a physics record (`superframe.scene-physics/1`): its medium, a listener, and its sources in SI units. Each source names a kind and the physical quantities that kind needs: a rain rate in mm/h and an area, a wind speed and the diameters it blows across, a material id and a shape for an object that is struck. Values that are measured (drop size laws, sound speeds, densities, moduli, loss factors, bubble physics) are never copied into the record or into either reader. Both readers fetch them from `packages/measured` and `packages/wavelab`.

- The renderer derives what it draws. For rain that is the number of drops per cubic metre and their mean diameter, which set the streak density and size (`scene.visual_params`).
- The workstation derives what it plays. For rain that is the drops landing per square metre per second, their sizes and speeds, the bubbles they leave and where they land (`scene.rain_events`, `scene.render`).

Change the rain rate in the record and both move together: at 50 mm/h there are 2.3 times as many drops in the air as at 2 mm/h, they are larger, and 4.1 times as many land per second. The tests check that coupling.

## 2. Clock and events

The engine's clock is the flick (705,600,000 per second, the superstack contract). At 48 kHz one sample is exactly 14,700 flicks, so an engine event (a ball hits a steel plate at frame time t) maps to one exact audio sample (`scene.sample_of_flicks`), and a render from a seed is repeatable in both media. Random choices draw from named substreams of the scene seed (`superstack.substream(seed, "rain")`), the same rule the visual generators use.

Two paths:

- **Offline.** The record goes to the Python workstation, which renders a WAV and a receipt. The receipt holds the record's sha256 and the visual parameters the renderer reads from the record, so one receipt binds the picture's inputs to the sound. Proof: `scene.render_to_wav(scene.RAIN_SCENE, ...)`.
- **Real time.** The engine writes one line per event to the BuildLang host's standard input: engine time, kind, the physical parameters, and the moment it made the event on the shared monotonic clock. A thread in BuildLang's audio binding (`bl_events.c`) parses each line into a lock-free single-producer single-consumer ring, and the audio thread pops every waiting event at the start of each period, gives it the next voice of the pool, and strikes it (`daw_voice_set`, `daw_bank_live`). Proof: `engine/impacts.mjs` drops balls onto steel and aluminium bars and sends each impact as it happens, at 60 frames a second, to `buildc run packages/daw/bld/main.bld -- wasapi live`. The bar's fundamental comes from the same free-bar physics and the same measured E, rho and loss factor as the workstation's, and a test holds the engine's value to the modal core's to 1e-9.

## 3. Sources by kind

| Kind | Picture reads | Sound reads | Physics, source | Status |
|---|---|---|---|---|
| Rain | drops per m^3, mean size (the forest-in-rain scene's streak threshold is now exp(-n V) from the record) | drops landing per m^2 s, size, speed, bubbles | Marshall and Palmer 1948 (measured rows), Atlas 1973 speeds, Pumphrey and Crum 1989 entrainment, Minnaert through wavelab | built, offline; the scene reads the record |
| Impact | contact point, material, shape | modes of the struck object, strike strength from impact speed | modal core, measured materials and loss factors | built, live from the engine |
| Bubbles, surf | foam and bubble fields | Minnaert rings with damping | wavelab bubble | rain bubbles built |
| Wind | swaying geometry | aeolian tones f = St U / d, turbulent noise | Strouhal | tone built; noise spectra against the saved storm recordings next |
| Thunder | flash, channel geometry | shock to acoustic, channel tortuosity | wavelab Burgers | next |
| Ocean | surface spectrum | breaking-wave bubble populations | wavelab | next |
| Rooms and media | the scene's geometry | room modes, path delay, air absorption | room modes, ISO 9613-1 | built |

## 4. Measured cost and latency

CPU per voice, BuildLang bank (`daw_bank_process`), one core of the i7-13700KF, f64, 48 kHz:

| Voice | Cost per second of audio | Per mode-sample |
|---|---|---|
| A bubble (one mode), 256 to 1,024 of them | 0.22 ms | 4.5 ns |
| An impact on a 20-mode object, 64 of them | 1.15 ms | 1.2 ns |
| A 400-mode bar, 32 of them | 22 ms | 1.15 ns |

Those figures are from before the bank found each strike once per period; it now costs 1.48 ns per mode-sample for one-mode voices and 0.78 ns for larger ones (0.071 ms and 0.75 ms per second of audio for a bubble and a 20-mode impact), so half a core holds about 7,000 bubble voices or 660 twenty-mode impacts at once. Light rain over 4 m^2 lands about 8,600 drops a second. About one in seven is in the bubble window, so about 1,300 bubbles start each second, and each rings for about 3 ms. That keeps about 4 bubble voices sounding at once, plus a click per drop. The offline Python renderer is slower than real time for rain (6.3 s to render 5 s, about 43,000 drops). The real-time path renders rain in BuildLang, not Python.

Latency from an engine event to sound, measured over 26 live impacts on the shared clock with the device fed silence: an event waited 6.1 ms on average and 10.1 ms at most from the moment the engine made it to the start of the period that strikes it, with no missed deadline. The 22 ms device buffer follows, so an event sounds 28 to 32 ms after it happens; the buffer part is derived, not measured. A 60 frame-per-second picture shows about two frames in that time. This driver's shared-mode period cannot go below 10 ms (the binding asks for 3 ms through IAudioClient3 and is refused), so less than a frame needs another device or exclusive mode.

## 5. Proof and checks

`daw/scene.py` and `tests/test_scene.py`:

- The drop count over 20 s equals the flux times area times time within 4 sigma, and the mean size of landing drops matches the flux-weighted distribution within 2 percent.
- The Marshall and Palmer size and count follow the exponential cut at 0.1 mm to 1 percent. The planted case, which forgets the cut, fails.
- Picture and sound move together with the rain rate.
- Light rain on water heard under water peaks between the Minnaert frequencies of 0.25 and 0.19 mm bubbles, inside 13 to 17 kHz. Without bubble entrainment the peak leaves that band (planted). The published light-rain peak under water is near 14 to 15 kHz (Medwin et al. 1992, from memory, moderate).
- The render is seeded, its receipt verifies, and flick times land on exact samples.

The 20 s rain render's PCM sha256 is `59fef510...`, with the scene-physics record hash in its receipt.

## 6. Next

1. Impacts from the rooms' own collision geometry, and rain drops as live events whose bubbles ring in the same bank.
2. Wind, thunder and surf, each held to the measured slopes of the saved field recordings (1/f^1.8 to 1/f^2.5).
3. A WebAssembly build of the BuildLang kernels for the browser rooms, if buildc's wasm target can be made to carry them, so a page can sound without the native host.
