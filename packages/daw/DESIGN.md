<!-- writing-profile: research -->
# daw: design

A workstation whose instruments are physical objects. A bar of aluminium, a string of steel, a leaf-shaped plate of glass, a column of air, a vocal tract: each is a real material in a real shape, struck, plucked, bowed or blown, and heard from a position in a room or a medium. The sound comes from the physics. Every material value carries its source, every resonator has a known answer it must reproduce, and every render can be repeated byte for byte from a seed, with a receipt.

This file covers the architecture, the physical core, the workstation layers, the plugin boundary, and the road to the most capable workstation we can build, with a measured target for each feature.

## 1. Architecture

### 1.1 Language: BuildLang for the engine, Python as the reference

The real-time engine is written in BuildLang (`bld/main.bld`). buildc compiles it to C, and the host calls its `extern "C"` exports once per audio period. The Python package beside it (`daw/`) is the reference: it holds the closed forms, the published tables and the offline renderer, and the tests hold the BuildLang exports to it.

The choice was measured on one machine (Intel i7-13700KF, Windows 11, 48 kHz). The kernel is the inner loop of modal synthesis: N two-pole resonators driven by one input and summed, run over 2 s of audio. The figure is how many modes one core sustains in real time.

| Path | Precision | Modes per core in real time | Notes |
|---|---|---|---|
| C++, g++ -O2 -march=native | f32 | 41,000 | benchmark run at below-normal priority |
| Rust, rustc -O | f32 | 36,000 | same |
| BuildLang through buildc 1.10 to C, gcc -O2 | f64 | 15,800 to 17,500 | output equal to a plain C f64 loop to the last bit |
| plain C, gcc -O2 | f64 | 14,500 to 19,000 | same loop, same run |
| JavaScript, V8 (the engine an AudioWorklet runs on) | f32 | 12,400 | 128-frame quanta |
| numpy, per-sample recursion | f64 | 2,100 to 6,400 | |
| numpy, closed form in blocks (the offline path) | f64 | 2,400 | |

Reading: BuildLang matched hand-written C in this loop: it is C after buildc, and its bounds checks cost no measurable time here. The f32 rows are faster mostly from width; an f32 path in BuildLang is a roadmap item. The pure web path is about a third of native on the same loop. The benchmark processes ran at below-normal priority, where Windows may place them on efficiency cores; the real-time host below ran under the Pro Audio scheduling class and sustained about 41,700 f64 modes per core, so the table understates every native row by a similar factor (inferred, not separately measured).

Why BuildLang and not Rust or C++: the author's direction (2026-11-05) puts the workstation in BuildLang, and the measurement shows no performance reason against it. BuildLang adds what the workstation needs from a language: effects and capabilities on every boundary, receipts for computed results, deterministic maths builtins (buildc emits DETMATH `exp` and `cos`), and the C ABI for hosts. What it lacked, it gets through BuildLang pull requests: the first, `slice::from_raw_parts_mut`, lets an export write into a host's buffer; without it a BuildLang function could read an audio buffer and never fill one.

Why Python stays: the known answers (Bessel zeros, Leissa's tables, the ISO 9613-1 table, Fletcher's stiff string) are easiest to state and check with numpy and scipy, and the offline renderer there is the oracle the BuildLang core must equal. The existing JavaScript sound engine in this repository is reference material only.

### 1.2 Real-time thread model

- One audio thread per device, registered with the operating system's pro-audio scheduling class. It waits on the device's period event, calls the BuildLang exports for every active voice, mixes, and writes the device buffer. No allocation, lock or file access happens on this thread: voices, coefficient tables and state are allocated before the stream starts.
- A control thread takes MIDI, MPE and automation and passes events to the audio thread through a single-producer single-consumer ring of time-stamped events. Each event carries its target sample, so a note placed at sample 24,000 sounds at sample 24,000.
- A worker pool (one per core, below the audio thread's priority) solves modes for new shapes (the finite-difference eigenproblems take tens of milliseconds) and hands finished coefficient tables to the audio thread by pointer swap at a period boundary.
- Deadline accounting is built in: every period records its render time against the period length, and a miss is counted, never hidden.

Measured on the reference machine with the interim host `host/rt_host.c` (WASAPI shared mode, event driven, 48 kHz, 10 ms period, 1,056-frame device buffer, the device fed silence so the run makes no noise):

| Load | Run | Render per 10 ms period: median, p99, max | Deadline misses |
|---|---|---|---|
| 8 voices x 200 modes | 10 s | 0.40, 0.53, 0.76 ms | 0 of 1,000 |
| 32 x 200 | 10 s | 1.56, 1.87, 2.38 ms | 0 of 1,000 |
| 48 x 400 (19,200 modes) | 60 s | 4.60, 5.04, 8.66 ms | 0 of 6,000 |
| 64 x 400 (25,600 modes) | 10 s | 6.14, 6.53, 9.92 ms | 0 of 1,000 |
| 128 x 400 (51,200 modes) | 10 s | 12.05, 12.70, 15.66 ms | 1,000 of 1,000 |

Headroom per instrument: a 200-mode bar costs about 0.05 ms per 10 ms period, so one core holds about 200 such voices with half its time spare. Latency: the shared-mode stream adds one 10 ms period plus the 22 ms device buffer on output, about 32 ms; the driver reported no stream latency of its own. Acoustic round trip (output to input through a cable or the air) is not measured yet; it needs a loopback recording, listed in the roadmap. Shared mode on this device allows a 3 ms period (IAudioClient3), and exclusive mode lower still.

The host is C for now, and that is a gap against the direction: the device binding belongs in BuildLang's standard library. BuildLang today cannot compile a C source file alongside a program, and WASAPI is a COM interface, so the binding needs either a `source "..."` clause on extern blocks or a runtime module in buildc. That is roadmap step 1.

### 1.3 Time, offline and real-time

- Physical time is the sample clock. Notes are kept in beats and placed at `round(beat x 60 x fs / bpm)`, an exact sample. The flick clock of the superstack contract (705,600,000 per second) carries time in receipts.
- The real-time path runs the two-pole recursion per sample in BuildLang. The offline path in Python sums closed forms in blocks; both give the same modes, and the tests hold the recursion to the closed form within 1e-9.
- An offline render is deterministic: the seed passes through the superstack seed rule (xmur3 then a seeded generator), the eigensolvers start from a fixed vector, and the output PCM hash is the receipt's content hash. Two renders of the demo on one machine give the same bytes. Across machines, the last bits of `exp` and `sin` may differ, which the superstack PCM tolerance (2 LSB, 60 dB SNR) judges.

## 2. The physical core

### 2.1 Materials and media

Material rows live in `packages/measured/data/mechanical.json`, built by `packages/measured/build/b_mechanical.py` from saved sources, each row with source, file, sha256, the quoted text it was read from, and a status:

- Young's modulus and Poisson's ratio: Kaye and Laby 2.2.2 (steel, aluminium, copper, brass, crown glass). Measured.
- Density: Kaye and Laby 2.2.1 (steel, brass, glass, oak, pine, ash, water at 20 C). Measured. Aluminium and copper densities are derived as E / c_E^2 from 2.2.2 and the rod-wave speeds in 2.4.1, and agree with Wikidata within 0.2 percent.
- Wood stiffness along the grain: derived as rho c_E^2 from Kaye and Laby's rod speeds.
- Speed of sound: dry air at 0 C (331.46 m/s, scaled by sqrt(T / T0)), distilled water at 20 C (1482.36 m/s), helium at 0 C (972.5 m/s).
- Air absorption: the Kaye and Laby table computed from ISO 9613-1, 108 values over 1 to 12.5 kHz and 10 to 90 percent humidity.
- Loss factors: from memory, low confidence, marked from_memory. They are the weakest numbers in the system and the first to replace with measured decay rates.
- Wikidata values for the same materials are kept as a cross-check only. They disagree with Kaye and Laby on brass's modulus by 13 percent; the test keeps that disagreement visible.

### 2.2 Shapes to modes

| Family | Method | Known answer in the tests |
|---|---|---|
| String, ideal and stiff | closed form, Fletcher's inharmonicity B = pi^3 E d^4 / (64 T L^2) | harmonic to 1e-12; stiff partials follow n sqrt(1 + B n^2) |
| Bar, free, pinned, cantilever | Euler-Bernoulli roots | 1 : 2.756 : 5.404 : 8.933; roots 4.7300, 7.8532, 10.9956; cantilever 1.8751, 4.6941 |
| Circular membrane | Bessel zeros | 1 : 1.594 : 2.136 : 2.296 |
| Rectangular plate, simply supported | Navier closed form | exact to 1e-12 |
| Circular plate, clamped | roots of J_n I_{n+1} + I_n J_{n+1} | Leissa 1969 Table 2.1 to its last printed digit |
| Plate or membrane of any outline | five-point Laplacian on a mask, shift-invert eigensolver; Navier plates as the Laplacian squared | square plate within 0.2 percent of Navier at 60 x 60; disc membrane ratio within 2 percent |
| Air column, open and closed | closed form with the Levine and Schwinger end correction | 1 : 2 : 3 and 1 : 3 : 5; c / 2L and c / 4L |
| Material swap | any of the above | pitch scales by sqrt(E / rho) exactly; the planted E / rho fails |

Every test has a planted wrong case that must fail: a harmonic drum, a pinned bar passed off as free, the OCR misreading of Leissa's 10.2158 as 10.2168, an open-open tube for a closed one.

Where modal synthesis fails (strong nonlinearity, contact, a bowed string's stick and slip, a reed), the plan is a finite-difference or waveguide solver for that part, coupled to the modal rest at a junction.

### 2.3 Excitation

Strike: a half-sine contact force whose duration sets the mallet's hardness. Pluck: a released displacement, modal amplitude phi_in / omega. Breath: seeded noise as the force on an air column. Bowing (Friedlander's friction curve on a modal string) and a reed or jet with its nonlinearity are next.

### 2.4 Space and media

Objects and listeners have positions in metres. A path delays by r / c to the sample, spreads as 1 / r, and loses alpha(f) r dB to the air by the ISO 9613-1 formula, which the tests hold to the published table (largest error 4.9 percent against a stated uncertainty of 10 percent; median 0.7 percent; dropping the nitrogen term fails). A moving source is heard from its retarded position, so the Doppler shift comes from the geometry: at 20 m/s toward the listener the measured shift equals c / (c - v) within 2e-4, and the moving-listener formula is rejected. The BuildLang export `daw_path_linear` equals the Python reference to 1e-12. Water carries sound 4.32 times faster than air at 20 C and that ratio appears in the delays.

Rooms come from `packages/instruments/room/modes.py`: a shoebox of damped normal modes below 400 Hz, where modes are distinct, and a diffuse decaying tail above, level-matched across the boundary (the room's Schroeder frequency is about 200 Hz). A room filled with another medium reuses the same model by scaling its dimensions by 343 / c.

Radiation: a mode with net volume velocity radiates as a monopole at low frequency; one without radiates through its first nonzero moment. The tests check the volume velocity of plate modes against (1 - (-1)^m)(1 - (-1)^n) / (m n pi^2). Full directivity from the mode shapes (a Rayleigh integral per mode) is next.

## 3. Instrument families beyond objects

### 3.1 A voice from the shape of a body

The vocal tract is an area function, glottis to lips, solved as a chain of transmission-line sections; the glottis is a Rosenberg pulse train with explicit pitch, open quotient, pulse skew and breath noise. Known answers in the tests: a uniform 17.5 cm tube closed at the glottis rings at (2n - 1) c / 4L (503.6, 1511, 2518 Hz at 37 C); formants scale as 1 / L; narrowing the back and widening the front raises F1 and lowers F2 as for an open vowel; helium raises every formant by c_He / c_air exactly in this lossless model.

Next, in order: lip radiation and wall loss; published MRI area functions with provenance (Story's vowel sets, from open copies); a self-oscillating two-mass vocal-fold model so modal, breathy, pressed and creaky voice come from fold physics; nasal coupling; subglottal tract and lungs; the oesophagus as a source for oesophageal speech; then a 3D tract.

Voice quality controls (pitch, open quotient, skew, breath, tract length and shape) are explicit numbers. A physical model can generate speech-like sound whose articulation is known exactly, which suits probing and training speech models: every sample comes with its true formants, area function and source settings. The workspace already holds a speech-model fine-tuning setup for the author's own consented voice; the physical model would add labelled synthetic data beside it, never a copy of any real person's voice.

### 3.2 Geometry to sound

A shape's Laplacian eigenvalues are its pitches. Square and circle are in the tests now. Next: the Gordon, Webb and Wolpert isospectral pair, two different drums with one spectrum, which the research sweep already reproduced to 4.8e-15 and which should sound identical here; meshes and curves as shells and plates; tilings and lattices as coupled resonators; an image as a plate outline or as an excitation map; and the reverse, shape from sound, as a check.

### 3.3 Birdsong

A syrinx with two independent sources (one per bronchus), each a labium oscillating like a vocal fold, after the normal-form model of Mindlin and Laje driven by air-sac pressure and labial tension, filtered by trachea and beak. Known answers to meet: a published synthetic syllable's frequency sweep and two-voice structure, and the trachea's quarter-wave resonance from its length. Not started.

### 3.4 Nature

Now: the aeolian tone f = St U / d with St about 0.2 (a 2 cm wire in a 19 m/s wind sings at 190 Hz, the howl measured in the saved gale recording, which fits a wire or twig near that size), and the Minnaert bubble f = sqrt(3 gamma p0 / rho) / (2 pi a), the source of rain on water and running water. Next: rain as drop impacts plus bubble populations from the Marshall-Palmer drop sizes already in `measured`; surf; thunder from shock to acoustic; insects (stridulation, wing beat); leaves and trees by species, with crown sway modes and leaf flutter; and a check of each against the measured spectral slopes of the saved field recordings (1/f^1.8 to 1/f^2.5).

### 3.5 One wave core across media

The same mode and interference machinery serves sound in air, water and solids, elastic vibration, and light. A spectrum from elsewhere (auroral lines at 557.7 and 630.0 nm, solar p-modes, the CMB acoustic peaks, a gravitational-wave chirp) is heard by multiplying every frequency by one stated factor, which keeps every ratio exactly; the test does this for the auroral oxygen lines with the speed of light from CODATA. Thin-film interference colours should match the colour lab's thin-film result when the wave core computes them; that check is next.

Colour, shape, sound and instrument are one subject here, and so are property and medium. The plan is one module of spectra, interference and filters shared by three users: an instrument's timbre (its mode spectrum times the radiation and room transfer), a thin film's colour (the interference of two reflections over the visible band, weighted by the CIE observer already in `packages/perceive`), and a lens's transfer function (the modulation transfer of `packages/lenspipe`, a spatial filter). With one stated scaling (a factor that maps a band of one medium onto a band of another and keeps every ratio), an instrument can be shown as the colour of its spectrum and a lens or a material can be heard as the filter it is. Known answers for that step: a soap film's colour sequence with thickness (first-order white, then yellow, magenta, blue) from the shared interference code, equal to the colour lab's thin-film result; a lens's MTF heard as a filter whose response, scaled back, equals the MTF to the stated tolerance; and the round trip from spectrum to sound to spectrum keeping every line's ratio exactly. This is on the roadmap after the three steps below.

### 3.6 Harmony, tension and progression from the physics

Harmony here starts from each instrument's own partials. `daw/harmony.py` computes Plomp and Levelt roughness in Sethares' parametric form and the dissonance curve of a timbre against itself; its minima are the intervals that suit that instrument. Known answers in the tests: a harmonic timbre gives 6/5, 5/4, 4/3, 3/2, 5/3 and 2/1 within 1 cent; a free aluminium bar gives its own ratios (2.7565, 1.9604, 1.6531) and no minimum at the harmonic fifth, and a harmonic timbre gives no minimum at 2.7565. Progressions are paths between chords, measured by the smallest total voice motion over every voice pairing; physical tension is a live control, with string pitch going as sqrt(T / mu) (four times the tension, one octave).

Next: scales generated from each instrument's curve and used by the arrangement (a bar's scale for a bar ensemble); chord tension as total roughness, so a progression can be drawn as a tension path; voice leading in pitch-class space with octave equivalence; tension and pressure as MPE targets that move the physics.

## 4. The workstation layers

- Timeline: tracks of notes in beats at one tempo; automation as piecewise-linear envelopes in seconds, sampled per sample. Next: tempo maps, clips and takes, comping, markers, time signature changes, groove.
- Mixer: per-track gain and equal-power pan (left^2 + right^2 = 1 at every position), a room send and return, and a master peak limiter that no sample passes. Next: buses, sends, sidechains, groups, VCA faders, metering by BS.1770 with true peak.
- Input: MIDI note numbers, fractional for microtones; MPE next, mapping per-note pressure to mallet force or breath, slide to strike position, and pitch bend to tension or length, so expression changes the physics rather than a filter.
- Export: WAV at 16 bits by the superstack quantiser with its canonical header; WAV 24-bit and 32-bit float; FLAC 16 and 24 bits. A 16-bit FLAC decodes to the same samples as the 16-bit WAV.
- Receipt: superstack.receipt/1 with the scene hash, seed, seed rule, flick clock, PCM hash, the FLAC hash, and what the receipt does not prove.

## 5. Plugin boundary

An effect or instrument is a BuildLang module that exports a fixed C ABI: `init(rate, max_frames)`, `process(in, out, frames, events)`, `state_save`, `state_load`, and a parameter table with units. Plugins see only buffers and events, never the device, so the same module runs offline and in real time. Third-party formats (CLAP first, being open; VST3 and AU after) are wrappers that map their calls onto this ABI. Every plugin call is timed against the period, so a slow plugin is named in the deadline report.

## 6. Road to the most capable workstation

Competitive table. Rows marked "memory" are from general knowledge of these products and were not checked against current documentation in this slice; each needs a sourced check before any claim is published.

| Feature | Leaders offer (source) | Here now | Measured target |
|---|---|---|---|
| Physical-model instruments | Modartt Pianoteq (modal piano), AAS Chromaphone and String Studio, Ableton Collision and Tension, Arturia and Madrona Labs models (memory) | modal objects of measured materials, any plate outline, a vocal tract | every family with a published known answer reproduced; a listening panel cannot tell a measured real object from its model at matched pitch more than 60 percent of the time |
| Material and shape as controls | swap a material preset (memory) | sourced E, rho, nu; pitch moves by sqrt(E / rho) exactly | every material row measured, loss factors included |
| Real-time voice count | hundreds of sampled voices per core (memory) | 19,200 f64 modes per core with no deadline miss in 60 s | 50,000 modes per core in f32 SIMD BuildLang; zero misses over 1 hour |
| Latency | 2 to 5 ms output buffers on ASIO and Core Audio (memory) | 32 ms shared mode, round trip not measured | under 5 ms output, round trip measured by loopback |
| Space and media | binaural panners, convolution reverbs (memory) | delay, 1/r, ISO 9613-1, Doppler, modal rooms, water | head-related transfer, wall materials with measured absorption, solid media |
| Determinism and receipts | none offered as far as known (memory) | same seed, same bytes, sealed receipt | cross-machine PCM within superstack tolerance on three machines |
| Arrangement and editing | full clip, take and comping workflows (memory) | notes in beats, automation, sample-accurate placement | full editing with undo, every edit a replayable event |
| Mixing and routing | unlimited buses, sidechain, groups (memory) | gain, pan, room send, limiter | buses, sends, sidechain, groups, BS.1770 meters |
| MIDI and MPE | full MIDI 2.0 and MPE in leading hosts (memory) | MIDI note numbers | MPE driving physical parameters; MIDI 2.0 |
| Plugins | VST3, AU, CLAP hosting (memory) | none | a BuildLang plugin ABI, then CLAP |
| Export | WAV, FLAC, MP3, stems (memory) | WAV 16, 24, 32f; FLAC 16, 24 | stems, rates to 192 kHz, each with a receipt |

Next three steps:

1. Move the device binding into BuildLang: a buildlang change that lets an extern block carry a C source (or a runtime audio module), with WASAPI, a null device for CI and a deadline counter, tested in buildlang's CI. Then the host here becomes BuildLang, and the loopback round-trip measurement runs.
2. Replace the from-memory loss factors with measured decay: ring sourced bars and plates (or published decay data), fit eta(f) per material, and add bowing and a reed so sustained instruments exist.
3. Voice: lip radiation, wall loss, sourced MRI area functions with their published formants as known answers, and a two-mass fold model, so voice quality comes from physics.

## 7. Limits stated plainly

- Damping uses loss factors from memory.
- The BuildLang core covers the modal bank and the moving-source path; the arrangement, mixer and export are Python, offline only.
- The real-time host is C, an interim gap against the BuildLang direction.
- Round-trip latency is not measured; only render time against the period is.
- Arbitrary-outline plates are Navier plates, which equal simple support only on straight edges; free and clamped outlines need the full biharmonic stencil.
- The CI here does not build BuildLang; the BuildLang tests skip there with the reason until a buildc with `slice::from_raw_parts_mut` is released.
