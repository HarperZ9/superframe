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

Why BuildLang and not Rust or C++: the author's direction (2026-11-05) puts the workstation in BuildLang, and the measurement shows no performance reason against it. BuildLang adds what the workstation needs from a language: effects and capabilities on every boundary, receipts for computed results, deterministic maths builtins (buildc emits DETMATH `exp` and `cos`), and the C ABI for hosts. What it lacked, it got through BuildLang pull requests. `slice::from_raw_parts_mut` lets an export write into a host's buffer; without it a BuildLang function could read an audio buffer and never fill one. An extern block's `source "file.c"` clause compiles a small C binding into the program's own translation unit, which carries BuildLang's audio device binding (`runtime/audio` in buildlang at 3698fcb, vendored here as `bld/bl_audio.c` and pinned by sha256). Two bugs found on the way were fixed: an unannotated `exp(x)` typed as i32 (it truncated silently), and writes through a read-only slice that passed the check.

Why Python stays: the known answers (Bessel zeros, Leissa's tables, the ISO 9613-1 table, Fletcher's stiff string) are easiest to state and check with numpy and scipy, and the offline renderer there is the oracle the BuildLang core must equal. The existing JavaScript sound engine in this repository is reference material only.

### 1.2 Real-time thread model

- One audio thread per device, registered with the operating system's pro-audio scheduling class. It waits on the device's period event, calls the BuildLang exports for every active voice, mixes, and writes the device buffer. No allocation, lock or file access happens on this thread: voices, coefficient tables and state are allocated before the stream starts.
- A control thread takes MIDI, MPE and automation and passes events to the audio thread through a single-producer single-consumer ring of time-stamped events. Each event carries its target sample, so a note placed at sample 24,000 sounds at sample 24,000.
- A worker pool (one per core, below the audio thread's priority) solves modes for new shapes (the finite-difference eigenproblems take tens of milliseconds) and hands finished coefficient tables to the audio thread by pointer swap at a period boundary.
- Deadline accounting is built in: every period records its render time against the period length, and a miss is counted, never hidden.

The host is BuildLang (`bld/main.bld`): it pins its audio thread to the performance cores (the binding reads each core's efficiency class), opens the device through the binding, renders a bank of modal voices per period with `daw_bank_process`, and counts deadline misses. The bank finds each voice's strike sample once per period and runs two modes at a time over the whole period, so the inner loop is the two-pole recursion alone: 0.78 ns per mode-sample for large voices and 1.48 ns for one-mode voices, against 1.15 and 4.5 ns before. Measured on the reference machine (WASAPI shared mode, 48 kHz, 10 ms period, 22 ms device buffer, the device fed silence by the binding's silent flag, so no sound), render mean and maximum reported cumulatively:

| Load | Periods | Missed deadlines, two runs | Render mean so far, max so far (first run) |
|---|---|---|---|
| 8 voices x 200 modes | 300 | 0, 0 | 0.61, 1.01 ms |
| 32 x 400 (12,800 modes) | 6,000 (60 s) | 0, 0 | 3.97, 6.33 ms |
| 48 x 400 (19,200 modes) | 6,000 | 0, 0 | 5.03, 7.24 ms |
| 64 x 400 (25,600 modes) | 6,000 | 0, 139 (2.3 percent) | 6.08, 9.78 ms |
| 80 x 400 (32,000 modes) | 3,000 | 3,000 (first run) | 6.67, 12.3 ms |

So one core holds 19,200 modes (96 two-hundred-mode bars) with no miss in either 60 s run, which matches the earlier C host, and 25,600 modes in one run of two. Before pinning and the loop change the same host held 12,800. The period cannot go below 10 ms in shared mode on this machine: the binding asks for 3 ms through IAudioClient3, and the audio engine reports 480 frames as its default, fundamental, minimum and maximum period alike, so the request falls back. Exclusive mode would allow 3 ms but takes the device from every other program, and was not tried.

The f32 bank (`daw_bank_f32`) is laid out for the vector unit: every mode advances one sample in one branch-free loop, the strikes are added after it, and the outputs are summed in eight fixed partial sums. BuildLang got what it needed: `get_unchecked` and `set_unchecked` on slices inside `unsafe` (each loop checks its range once, by hand, before it starts), and release builds that let gcc vectorise loops behind a runtime alias check, with DETMATH kept so no result changes. The f32 bank runs 0.41 ns per mode-sample for 400-mode voices (f64: 0.67) and 0.30 for 20-mode voices (f64: 0.69). In f32 the phase drifts from the f64 recursion (about -46 dB after 80 ms), so it serves short voices; sustains stay f64.

Latency: an engine event (see ARCHITECTURE.md) waited 6.1 ms on average and 10.1 ms at most from the moment the engine made it to the start of the period that strikes it, measured on the shared clock over 26 live impacts with the device fed silence. The 22 ms device buffer follows, so an event sounds about 28 to 32 ms after it happens; the buffer part is derived from the device's sizes, not measured. Loopback timing and a round trip both need audible output (a click through the speakers) or an input device, and this machine has no input device; under the current no-sound rule neither was run.

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
- Loss factors: measured for aluminium and steel from the decay of recorded bars (University of Iowa Musical Instrument Samples, free for any use): vibraphone bars give eta = 2.26e-4 (interquartile 1.41e-4 to 2.83e-4, 29 partials) and orchestral bells 8.66e-5 (5.3e-5 to 9.9e-5, 16 partials). A mounted bar also loses energy to its cords, resonator and the air, so these are upper bounds on the materials' own loss. The earlier from-memory values were off by a factor of about 2, in opposite directions (aluminium 1e-4, steel 2e-4). `packages/measured/build/b_decay.py` makes the table; a planted decay of 0.8 /s is recovered within 2 percent. Brass, copper, glass and the woods are still from memory, marked so.
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

Strike: a half-sine contact force whose duration sets the mallet's hardness. Pluck: a released displacement, modal amplitude phi_in / omega. Breath: seeded noise as the force on an air column. Bow: a waveguide string meeting a friction junction at the bow (McIntyre, Schumacher and Woodhouse 1983); above threshold it settles into Helmholtz motion at the string's own period (within 0.5 percent) and sticks for 1 - beta of each period (0.853 against 0.873 at beta = 0.127); with too much force it jumps to the octave, as bowed strings do. Reed: a closed-open bore with a pressure-controlled reed; it sounds c / 4L within 1 percent with odd harmonics over 10 dB above the even ones, and below a threshold breath no tone forms. A jet (flute) is next.

Waveguides: a string as a delay loop with a fractional allpass sounds within 0.01 cent of its target at 110 and 262 Hz, decays with the requested T60 within 5 percent, and three detuned strings struck by one hammer make a piano note whose unison beats at the detuning. Piano string dispersion is next.

### 2.4 Space and media

Objects and listeners have positions in metres. A path delays by r / c to the sample, spreads as 1 / r, and loses alpha(f) r dB to the air by the ISO 9613-1 formula, which the tests hold to the published table (largest error 4.9 percent against a stated uncertainty of 10 percent; median 0.7 percent; dropping the nitrogen term fails). A moving source is heard from its retarded position, so the Doppler shift comes from the geometry: at 20 m/s toward the listener the measured shift equals c / (c - v) within 2e-4, and the moving-listener formula is rejected. The BuildLang export `daw_path_linear` equals the Python reference to 1e-12. Water carries sound 4.32 times faster than air at 20 C and that ratio appears in the delays.

Rooms come from `packages/instruments/room/modes.py`: a shoebox of damped normal modes below 400 Hz, where modes are distinct, and a diffuse decaying tail above, level-matched across the boundary (the room's Schroeder frequency is about 200 Hz). A room filled with another medium reuses the same model by scaling its dimensions by 343 / c.

Radiation: a mode with net volume velocity radiates as a monopole at low frequency; one without radiates through its first nonzero moment. The tests check the volume velocity of plate modes against (1 - (-1)^m)(1 - (-1)^n) / (m n pi^2). Full directivity from the mode shapes (a Rayleigh integral per mode) is next.

## 3. Instrument families beyond objects

### 3.1 A voice from the shape of a body

The vocal tract is an area function, glottis to lips, solved as a chain of transmission-line sections; the glottis is a Rosenberg pulse train with explicit pitch, open quotient, pulse skew and breath noise. Known answers in the tests: a uniform 17.5 cm tube closed at the glottis rings at (2n - 1) c / 4L (503.6, 1511, 2518 Hz at 37 C); formants scale as 1 / L; narrowing the back and widening the front raises F1 and lowers F2 as for an open vowel; helium raises every formant by c_He / c_air exactly in this lossless model.

Now also (`tract.py`, `folds.py`): lip radiation as a baffled piston, which lowers F1 to c / 4(L + 0.85 a) within 0.5 percent and widens the higher formants more than the lower; yielding walls (Sondhi and Schroeter's mass and resistance), which raise F1 by over 2 percent and widen it by over 20 Hz while leaving F3 within 1 percent; and two-mass vocal folds (Steinecke and Herzel's form of Ishizaka and Flanagan), which oscillate at 125 Hz against a linear mode of 120 Hz above the phonation threshold and stay still below it, become breathier (open quotient up by over 0.2) as the folds open, and get louder with lung pressure. The measured resonances of 44 MRI vocal tracts printed in 3D (the Dresden Vocal Tract Dataset, CC0) are in `packages/measured` as known answers; their published finite-element resonances agree with the measured ones within 5 percent for at least 36 of the 44.

The 1D tract is now held to those 44 tracts. `packages/measured/build/b_dvtd_area.py` fills each closed surface mesh into 0.7 mm voxels and measures the geodesic distance of every voxel from the glottis on the 26-connected voxel graph; the area at each distance is the volume of a 3 mm shell over its thickness. The first attempt used a 6-connected graph, which measures city-block distance: it stretched the schwa tract from 192 to 237 mm and put F1 at 109 Hz against a measured 337 Hz. With the true distance the schwa's F1 is 336 Hz. The last shells, slivers of the cap that closes the mesh at the lips, are trimmed (`tract.trim_lip_cap`); left in, they close the mouth. With lip radiation, F1 is within 10 percent of the measured resonance for 41 of 44 tracts (median error 4.7 percent) and F2 for 32 of 44 (median 6.4 percent); without the trim the median F1 error more than doubles (planted). Side cavities fall into the shells at their distance, a known limit of distance-shell area functions, and the worst cases are rounded front vowels and the lateral.

Now coupled (`kl_tract.py`): the folds drive a Kelly-Lochbaum waveguide tract, whose formants match the chain matrix on the same sections within 2 percent, and the tract pushes back: the flow peak lags the glottal opening by about 6 percent of the period, where the unloaded source has no lag. A nasal tract joins at the velum as a side branch and puts an antiresonance at c / 2L_n, within 1 percent for a uniform branch. The oesophageal voice: the pharyngo-oesophageal segment (three times the folds' mass, half their stiffness, from memory) vibrates at 51 Hz against its linear mode of 49 Hz, and the voice stops when its air charge is spent, twice the air lasting about twice as long.

Next: a nasal tract from MRI with its sinuses, the subglottal tract and lungs, then a 3D tract.

Expressive voice (`sing.py`, 2026-11-09): the lossy chain is vectorised across frequency (equal to `tract.transfer` within 1e-9), so every 11 ms frame gets its own transfer, and a vowel glide is a straight line between two measured area functions resampled to 44 sections. Sung back at 110 Hz, six measured vowels of both DVTD speakers land within 7 percent of their measured F1 and F2 (rigid walls and room air, as the printed models were measured); a glide from /a/ to /e/ ends on /e/ within 10 percent with F2 rising through it. The source is laid cycle by cycle: jitter and shimmer read back from the flow within 25 and 15 percent, vibrato from the audio within 5 percent in rate and 10 percent in depth, and effort from 0.1 to 0.9 drops H1 - H2 by more than 5 dB. Yielding walls are on by default when singing: without wall loss the first formant is so sharp that a harmonic sitting on it outweighs the fundamental, and pitch trackers read the octave. A choir (`choir.py`) draws each singer from the seed: pitch offset (sd 12 cents by default), vibrato near 5.5 Hz and 45 cents, an entry up to about 25 ms late, a tract 2 percent longer or shorter, and a stereo place; the tests read every singer's vibrato within 5 and 10 percent and their offset within 3 cents back from their own stem, and a planted choir of identical singers collapses to one voice. Next: the two-mass folds as the source under the same pitch line, consonants as moving constrictions, and a nasal branch that opens with the velum.

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

### 3.7 Tape echo and electric piano, from the service documents

**Tape echo** (`tape_echo.py`). An endless loop passes an erase head, a record head and three playback heads. The tape position is the integral of the tape speed, and a sample written at time t_w reaches head k when the tape has moved that head's spacing past the record head, so every delay, wow and flutter included, comes from the transport. The capstan and the pinch roller each add a speed term at their rotation rate v / (pi d) with depth e / r from their eccentricity; a slow wow term covers the rest. The record path is the input plus the intensity times the selected heads, through a tanh anhysteretic curve; the read path applies the playback gap loss sinc(pi g f / v) and the head-to-tape spacing loss exp(-2 pi d f / v) once per pass, so slower tape gives darker repeats. Hiss sits at the documented 60 dB signal-to-noise ratio, and a tank of three dispersive springs (allpass chains in delay loops) follows. The twelve mode selector positions are the documented table: heads 1, 2, 3 and 2 + 3 alone; heads 1, 2, 3, 1 + 2, 2 + 3, 1 + 3 and 1 + 2 + 3 with the springs; the springs alone. The tape speed is held to the documented 0.12 to 0.40 m/s. Head spacing, roller diameters, eccentricities, gap length and spacing loss are not in the documents read; they are free parameters with labelled defaults.

One finding comes from the physics: the same speed writes and reads, so a speed wobble at rate f reaches the read pitch scaled by 2 |sin(pi f D)|, where D is the head delay. A wobble whose period divides the delay cancels; reading the pitch depth as the speed depth is off by 17.6 percent at 0.8 Hz and 250 ms.

The H180 analyser was extended to read a tape echo back from the sound alone: echo spacing from the signal's autocorrelation, the intensity from successive echo amplitudes, and flutter from the instantaneous frequency of a steady tone. On planted synthetic signals (an echo train at 375 ms and gain 0.62; a tone with 0.8 Hz, 0.3 percent pitch modulation) it recovers 375.0 ms, 0.620 and 0.8000 Hz at 0.2997 percent, and reads a steady tone as below 1e-6. On the model's own output: head delays 125, 250 and 375 ms within 1e-12 relative, intensity 0.6199 against 0.62, wow 0.80000 Hz against 0.8, the speed depth 0.29998 percent against 0.3 after the 2 |sin| term is divided out, and the capstan rate 15.9155 Hz against v / (pi d). Repeat times scale as 1 / speed within 0.2 percent across the documented range.

**Electric piano** (`rhodes.py`). The tine is a steel cantilever of the documented 1.905 mm wire, its modes on the cantilever roots (first overtone 6.267 times the fundamental), with the tuning spring as a point mass that lowers each mode by the Rayleigh ratio, more the nearer it sits to the tip. The documented 111.1 mm replacement tine rings at 111.8 Hz bare, near A2. The fork: the tine and a heavier tone bar stand on one block held by a lossy mount; the decay of the tine mode comes from the eigenvalues of the three-mass system. The hammer is a neoprene tip in Hertz contact, its modulus from the documented Shore A grades (30, 50, 70, 90) by Gent's relation; the integrator matches the Hertz closed-form contact time within 1 percent for every grade, and harder tips make shorter contacts and stronger upper modes. The pickup flux is an even function of the tine tip's offset from the pole centre (point-dipole falloff, a model assumption), and the voltage is its time derivative.

Results against the queue's planted truths (H186):

- Sustain falls smoothly with detuning on both sides of the tuned point (checked in half-semitone steps over plus or minus 4). At the default free parameters (bar 12 times the tine's tip mass, mount Q 2) the T60 ratio is 0.48 at 2 semitones flat and 0.17 at 2 semitones sharp: the loss is asymmetric, faster when the tine is sharp. The manual's qualitative claim (F to A around G with no appreciable loss) holds in this model only for a bar about 40 or more times the tine's mass on a mount of Q 8 or more (ratios 0.95 to 1.09 flat, 0.49 to 0.66 sharp). Those are free parameters, so this is a constraint to measure, not a result.
- Pickup: the queue's wording, a second harmonic of zero at dead centre, is wrong for this geometry. An even flux curve gives no fundamental at dead centre (below 1e-9 of the second harmonic): a centred tine sounds the octave. The fundamental-to-second ratio then rises monotonically with offset up to half the gap, where the second harmonic vanishes at the flux curve's inflection (found at 0.50 of the gap within 0.01). The manual's factory setting, slightly above centre, sits on the rising side. A smaller gap is louder, as the manual says.

Limits: no measured electric piano recordings are used. The University of Iowa Musical Instrument Samples have no electric piano, and no openly licensed measured set was obtained, so partial frequencies and decay times are not checked against a real instrument. The tone bar, block, mount, hammer mass, tip radius and spring mass are free. The tine's coupling to its bar is left out during the few milliseconds of contact.

## 4. The workstation layers

- Timeline: tracks of notes in beats at one tempo; automation as piecewise-linear envelopes in seconds, sampled per sample. Next: tempo maps, clips and takes, comping, markers, time signature changes, groove.
- Mixer: per-track gain and equal-power pan (left^2 + right^2 = 1 at every position), a room send and return, and a master peak limiter that no sample passes. Next: buses, sends, sidechains, groups, VCA faders, metering by BS.1770 with true peak.
- Input: MIDI note numbers, fractional for microtones; MPE next, mapping per-note pressure to mallet force or breath, slide to strike position, and pitch bend to tension or length, so expression changes the physics rather than a filter.
- Effects with an analyser that reads them back: volume swell, tremolo and feedback delay. From a piano phrase with planted settings the analyser recovers a 12 Hz tremolo within 0.5 percent, a 400 ms attack within 3 percent and a 375 ms delay within 1 ms, and reports no tremolo or echo on the dry take.
- Export: WAV at 16 bits by the superstack quantiser with its canonical header; WAV 24-bit and 32-bit float; FLAC 16 and 24 bits. A 16-bit FLAC decodes to the same samples as the 16-bit WAV.
- Receipt: superstack.receipt/1 with the scene hash, seed, seed rule, flick clock, PCM hash, the FLAC hash, and what the receipt does not prove.

## 5. Plugin boundary

An effect or instrument is a BuildLang module that exports a fixed C ABI: `init(rate, max_frames)`, `process(in, out, frames, events)`, `state_save`, `state_load`, and a parameter table with units. Plugins see only buffers and events, never the device, so the same module runs offline and in real time. Third-party formats (CLAP first, being open; VST3 and AU after) are wrappers that map their calls onto this ABI. Every plugin call is timed against the period, so a slow plugin is named in the deadline report.

Built (2026-11-09): `clap/bars.c`, a CLAP instrument over the BuildLang kernels (`daw_voice_set`, `daw_bank_live`), linked by `daw/clap_build.py`, with the MIT CLAP 1.2.10 headers vendored in `clap/include`. A block is split at every note, so the output equals the offline kernels bit for bit at host blocks of 64, 256, 1000 and 4096 frames, and a note sounds on its own sample (latency 0). `clap/host_check.c` is a minimal CLAP host the tests drive. Measured on the reference machine (Windows 11, i7-13700KF, mingw gcc, 256-frame blocks): 16 voices of 12 modes ringing for 10 s took 0.079 to 0.087 s of process time over three runs, about 10 ns per voice-sample (0.86 ns per mode-sample), so one core would carry on the order of 1,900 such voices; that ceiling is extrapolated, not run. The bundle (`superframe.clap`) also holds "superframe piano" (`clap/piano.c`, 2026-11-09): the stiff waveguide string of `dispersion.py`, one per voice, with B per key measured on a Steinway model B. Its per-key loop (n, t, g, a, m) and hammer come from `clap/piano_table.h`, which `daw/clap_tables.py` writes from the offline code for 44.1 and 48 kHz; the loop runs as second-order sections in scipy's sosfilt order, so its output equals `dispersion.stiff_string` bit for bit at both rates and at any block size. Sixteen keys from E2 to C sharp 6 ringing for 10 s took 0.219 to 0.221 s over three runs, about 29 ns per voice-sample (the target was under 50). This kernel is C; porting it to BuildLang is next. Not yet loaded in a commercial host; VST3 and AU wrappers are not built.

## 6. Road to the most capable workstation

Competitive table. Rows marked "memory" are from general knowledge of these products and were not checked against current documentation in this slice; each needs a sourced check before any claim is published.

| Feature | Leaders offer (source) | Here now | Measured target |
|---|---|---|---|
| Physical-model instruments | Modartt Pianoteq (modal piano), AAS Chromaphone and String Studio, Ableton Collision and Tension, Arturia and Madrona Labs models (memory) | modal objects of measured materials, any plate outline, a vocal tract, a tape loop echo, an electric piano tine and tone bar | every family with a published known answer reproduced; a listening panel cannot tell a measured real object from its model at matched pitch more than 60 percent of the time |
| Material and shape as controls | swap a material preset (memory) | sourced E, rho, nu; pitch moves by sqrt(E / rho) exactly | every material row measured, loss factors included |
| Real-time voice count | hundreds of sampled voices per core (memory) | 19,200 f64 modes per core with no deadline miss in 60 s | 50,000 modes per core in f32 SIMD BuildLang; zero misses over 1 hour |
| Latency | 2 to 5 ms output buffers on ASIO and Core Audio (memory) | 32 ms shared mode, round trip not measured | under 5 ms output, round trip measured by loopback |
| Space and media | binaural panners, convolution reverbs (memory) | delay, 1/r, ISO 9613-1, Doppler, modal rooms, water | head-related transfer, wall materials with measured absorption, solid media |
| Determinism and receipts | none offered as far as known (memory) | same seed, same bytes, sealed receipt | cross-machine PCM within superstack tolerance on three machines |
| Arrangement and editing | full clip, take and comping workflows (memory) | notes in beats, automation, sample-accurate placement | full editing with undo, every edit a replayable event |
| Mixing and routing | unlimited buses, sidechain, groups (memory) | gain, pan, room send, limiter | buses, sends, sidechain, groups, BS.1770 meters |
| MIDI and MPE | full MIDI 2.0 and MPE in leading hosts (memory) | MIDI note numbers | MPE driving physical parameters; MIDI 2.0 |
| Plugins | VST3, AU, AAX everywhere; CLAP in Bitwig, FL Studio, REAPER (sourced in mission-control MAP 2026-11-09) | a CLAP instrument from the BuildLang kernels, equal to the offline render bit for bit | VST3 and AU wrappers; hosting third-party CLAP plugins |
| Export | WAV, FLAC, MP3, stems (memory) | WAV 16, 24, 32f; FLAC 16, 24 | stems, rates to 192 kHz, each with a receipt |

Done from the previous three steps: the device binding is in BuildLang and the host is BuildLang; aluminium and steel damping are measured; bowing and a reed exist; the voice has lip radiation, wall loss and two-mass folds, with measured MRI tract resonances on file.

Done this round: unchecked slice access and vectorised release builds in BuildLang, and an f32 vector bank (0.41 ns per mode-sample); impacts from the rooms' collision geometry with the landing point setting the modes; live raindrop bubbles (about 1,300 a second for light rain, no missed deadline); wind held to three measured storm recordings; folds coupled to a waveguide tract, a nasal branch and the oesophageal voice.

Next three steps:

1. The f32 bank in the live host with voices allocated per kind, and the wasm build of the kernels for the browser rooms.
2. Plates and spheres from the rooms' geometry as strike targets; thunder and surf held to the storm recordings.
3. A nasal tract and sinuses from MRI, the subglottal tract and lungs, and a 3D tract.

Folded in from manufacturer manuals read as local research copies (no text from them ships here). The first two are built (section 3.7):

- Tape echo as a physical tape loop (`tape_echo.py`): built.
- Electric piano tine and tone bar as an asymmetric tuning fork (`rhodes.py`): built.
- A classic five-voice analogue synthesizer's voice architecture as a reference for the workstation's own subtractive voice, built from the same filter and envelope physics as everything else.

## 7. Limits stated plainly

- Loss factors for brass, copper, glass and the woods are from memory; aluminium and steel are measured upper bounds from mounted bars.
- The BuildLang host holds 19,200 modes without a miss in two 60 s runs; 25,600 passed one run and missed 2.3 percent of periods in the next.
- Round-trip latency is not measured: this machine has no input device, and no test may play sound for now.
- The 1D vocal tract meets 41 of 44 measured MRI tracts on F1 within 10 percent; area functions from distance shells fold side cavities into the main tube.
- Arbitrary-outline plates are Navier plates, which equal simple support only on straight edges; free and clamped outlines need the full biharmonic stencil.
- CI builds buildc at a pinned buildlang commit in its own job and runs the BuildLang tests there with no skipping; the main test job still skips them, with the reason.
