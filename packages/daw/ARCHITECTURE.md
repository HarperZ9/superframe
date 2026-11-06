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
- **Real time.** The engine sends time-stamped events (a source starts, a parameter changes, an impact happens, with material and position) through a single-producer single-consumer ring to the BuildLang host. The host turns each event into a voice in its bank at the event's sample, and the voice runs the same modal or bubble physics as offline. The ring and the event decoder are the next build. Today the BuildLang bank runs a fixed load, and the per-voice cost below is measured on it.

## 3. Sources by kind

| Kind | Picture reads | Sound reads | Physics, source | Status |
|---|---|---|---|---|
| Rain | drops per m^3, mean size | drops landing per m^2 s, size, speed, bubbles | Marshall and Palmer 1948 (measured rows), Atlas 1973 speeds, Pumphrey and Crum 1989 entrainment, Minnaert through wavelab | built, offline |
| Impact | contact point, material, shape | modes of the struck object, contact time | modal core, measured materials | modal core built; event path next |
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

A one-mode voice pays its overhead (the per-sample strike test) on one mode, so it costs four times as much per mode as a large one. At half a core, the bank holds about 2,200 bubble voices or 430 twenty-mode impacts at once. Light rain over 4 m^2 lands about 8,600 drops a second. About one in seven is in the bubble window, so about 1,300 bubbles start each second, and each rings for about 3 ms. That keeps about 4 bubble voices sounding at once, plus a click per drop. The offline Python renderer is slower than real time for rain (6.3 s to render 5 s, about 43,000 drops). The real-time path renders rain in BuildLang, not Python.

Latency from an engine event to sound, on the reference machine's shared-mode output: the event waits for the next period (up to 10 ms), then passes through the 22 ms device buffer, so 22 to 32 ms. A 60 frame-per-second picture shows about two frames in that time. This figure is derived from the period and buffer sizes, not measured end to end. The round trip still needs an input device (DESIGN.md, section 1.2). A 3 ms period (IAudioClient3) would bring the event-to-sound delay under one frame.

## 5. Proof and checks

`daw/scene.py` and `tests/test_scene.py`:

- The drop count over 20 s equals the flux times area times time within 4 sigma, and the mean size of landing drops matches the flux-weighted distribution within 2 percent.
- The Marshall and Palmer size and count follow the exponential cut at 0.1 mm to 1 percent. The planted case, which forgets the cut, fails.
- Picture and sound move together with the rain rate.
- Light rain on water heard under water peaks between the Minnaert frequencies of 0.25 and 0.19 mm bubbles, inside 13 to 17 kHz. Without bubble entrainment the peak leaves that band (planted). The published light-rain peak under water is near 14 to 15 kHz (Medwin et al. 1992, from memory, moderate).
- The render is seeded, its receipt verifies, and flick times land on exact samples.

The 20 s rain render's PCM sha256 is `59fef510...`, with the scene-physics record hash in its receipt.

## 6. Next

1. The event ring and decoder in the BuildLang host. Engine scenes in `packages/rooms` (the forest-in-rain and underwater scenes) then read their streak and bubble densities from the record, not from constants in the shader.
2. Impacts with material and contact from engine collisions, through the modal core, in real time.
3. Wind noise, thunder and surf, each held to the measured slopes of the saved field recordings (1/f^1.8 to 1/f^2.5).
