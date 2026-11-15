<!-- writing-profile: research -->
# The Quota: the instruments

Audio lead, 2026-10-22 (second round). Part of [SCORE.md](SCORE.md). Every sound is synthesised in plain
JavaScript with no dependency and no sample. Author ruling, 2026-10-22, verbatim: "The engine can support
all of this. The music can be made using our own instrument tools."

## Where they live

The instruments are a shared library in studio-libs, `render-sound/instruments/` (render-sound 0.3.0,
FSL-1.1-MIT, merged as studio-libs PR #3 at `51cb70d`, CI green on Ubuntu and Windows). The game keeps a
byte-for-byte copy in `game/engine/audio/lib/`, pinned by commit and per-file SHA-256 in `lib/VENDOR.json`;
`node tools/audio-vendor.mjs --check` fails on any drift and a test runs it. The game's build stays free of
dependencies. Game-specific sound (the train, the press, the chute, the lamps, the people, the house) stays
in the game, in `audio/sfx/`.

## Targets for the weakest three

The first round called the piano, the upright bass and the ride the weakest. Each is rebuilt against
measured targets, and each target has a test with a control that must fail (`render-sound/test/
instruments-targets.test.mjs`, mirrored in the game as `tests/audio-targets.test.mjs`).

| Instrument | Target | Result | Basis, confidence |
|---|---|---|---|
| Piano | Inharmonicity B within 30% of the register table (C2 0.00015, C4 0.0005, C6 0.004) | Pass | Published stiff-string data for concert grands, moderate |
| Piano | Double decay: the first half-second falls at least twice as fast as the tail | Pass | Coupled unison strings, high on the effect |
| Piano | Aftersound t60 at middle C between 12 and 20 s (table value 16 s) | Pass | Estimate, moderate |
| Piano | Hammer noise lifts the attack's highs above 4 kHz by 3 dB or more, gone by 100 ms | Pass | Design target |
| Piano | Sympathetic strings answer the octave of a struck C3 10 dB over the semitone beside it | Pass | Design target |
| Piano | A soundboard: a generated burst of 140 wood modes convolved with the whole stem | Built, not separately measured | Design |
| Upright bass | Body modes raise 58 and 98 Hz by 6 dB or more and leave 500 Hz within 2 dB | Pass | Air and top-plate modes, moderate on the frequencies |
| Upright bass | Finger slip lifts 4 kHz in the first 12 ms of a soft pluck by 3 dB | Pass | Design target |
| Upright bass | Fingerboard rattle lifts the highs above 1.5 kHz by 3 dB on a soft pluck; pitch within 5 cents | Pass | Design target |
| Ride | t60 between 4 and 7 s | Pass (about 5.7 s) | Cymbal measurements, moderate |
| Ride | The highs peak 40 to 200 ms after the strike; the lows peak at once | Pass (highs at about 100 ms) | The energy cascade of a struck plate, moderate |

What I learned building them: the first bass "buzz" clipped the string and took energy out of the highs;
the rattle that works adds a contact noise and leaves the string alone. And the bass's excitation had to be
made much darker (a fingertip, not a pick) before the finger noise could be heard at all.

## The new instruments of this round

| Instrument | Method | Quality, predicted |
|---|---|---|
| Electric piano | FM, tine kind: a body pair that barks on a hard strike and rounds off, a 14:1 tine pair for the metal ding, the pickup's second-harmonic asymmetry; tremolo and auto-pan as stem effects | Strong: FM electric pianos are among synthesis's most convincing sounds |
| Pad | Three detuned band-limited saws a side through a lowpass that opens as it swells | Strong for a pad |
| String section | Four saws a side, slow vibrato, a violin-family body | Convincing as a pad-like section, weak as soloists |
| Choir | Three glottal voices a side through vowel formants (ah, oh, oo), each with its own pitch and vibrato | Usable deep in a room, as Yamaoka and the Captain's cue use it; thin up close; no words |
| Finger snap, low tom | Noise bands; membrane modes | Good |

## The rest, carried over

| Instrument | Method | Quality, predicted |
|---|---|---|
| Harp, guitar, doubled-course guitar | Extended Karplus-Strong | Good in a room; the guitar is thin exposed |
| Flute, breathy flute, reed | Waveguides tuned by a probe render | Flute good above C4; the reed is clarinet-like, not an oboe |
| Organ | Nine additive drawbars, rotary effect | Good |
| Bells, bowls, glass, iron | Modal tables | Strong |
| Drones, breath, the wordless hum | Additive and formant | Good for drones; the hum is not a singer |
| Rooms, tape | Generated impulse responses; wow, flutter, saturation | Good |

None of these predictions comes from listening. I cannot hear the renders; the author's ears overrule
every row.

## What would improve them further, with our own tools

1. The piano: a hammer-string contact model (the felt's nonlinear stiffness) in place of the spectral
   hammer, and longitudinal "phantom" partials in the bass. Both are known methods and need only time.
2. The bass: a slide between notes and the left hand's string noise.
3. The choir: a vocal-tract waveguide in place of fixed formants, which would allow vowels to move.
4. Words for a sung voice: out of reach of formant synthesis at a quality worth shipping.

## Render cost, and what the game should ship

A cue takes from seconds (the read-back) to several minutes (the road's tremolo across three harmonies);
in a browser worker the read-back alone took 10.8 s. So the game cannot render a cue when it is needed.
Two ways: render in the worker at load and cache it (no new tooling; minutes on first run), or bake the
stems at build time and ship them compressed (the browser decodes them natively; the build needs an
encoder, a build-machine tool the coordinator would approve). I recommend baking for the score and live
synthesis for the sound effects, which render in milliseconds.
