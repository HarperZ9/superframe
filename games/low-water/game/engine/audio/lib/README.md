<!-- writing-profile: readme -->
# render-sound instruments

Synthesised instruments in plain JavaScript, with no dependencies and no samples. Each one is a function
of pitch, length, velocity, seed and options, and returns samples: a mono `Float32Array`, or a `[left,
right]` pair for the ensemble instruments. The same seed gives the same samples in Node and in a browser
worker.

```js
import { piano, ep, pluck, strings, choir, makeIR, convolve } from "./instruments/index.mjs";

const note = piano(60, 2, 0.7, 1, { pedal: true });       // middle C, 2 s held, velocity 0.7, seed 1
const room = makeIR("kitchen");                            // a generated impulse response, [L, R]
const wet = convolve(note, room[0]);
```

Run the checks from `render-sound/`: `node --test`.

## What is here

| Instrument | Method |
|---|---|
| `piano` | Modal: stiff-string partials with inharmonicity by register, a felt hammer whose spectrum brightens with velocity, a strike-point notch, two or three unison strings for beating and the double decay, hammer and keybed noise, a damper thump. `soundboardIR` and `sympathetic` give the instrument a body and undamped strings |
| `ep` | An electric piano of the tine kind, by FM: a body pair that barks and rounds, a high-ratio tine pair for the metal attack, the pickup's second-harmonic asymmetry |
| `pluck` | Extended Karplus-Strong: harp, guitar, doubled-course mandolin, and an upright bass with a body of wood modes, a finger slip and fingerboard rattle |
| `wind` | Waveguides: a flute (jet and bore), a breathier flute, a single reed coloured toward a double reed; each tuned by a probe render |
| `organ` | Nine additive drawbars, wheel mistuning, key click, percussion; `leslie` in the effects |
| `pad`, `strings`, `choir` | Detuned band-limited saws through a swelling filter; a string section with vibrato and a violin-family body; several glottal voices through vowel formants. All stereo, each side its own players |
| `kick`, `tap`, `sweep`, `ride`, `hat`, `snap`, `tom`, `crate` | Membrane modes, noise sweeps for brushes, a ride of about 150 modes with a delayed high swell |
| `drone`, `metal`, `breath`, `hum`, `vessel` | Additive drones, rubbed iron, breath through formants, a wordless voice, bells, bowls and glass |
| `makeIR`, `tape`, `echo`, `width`, `autopan` | Generated rooms, tape wow and flutter with saturation, a tape echo, stereo width, auto-pan |

## Targets

The weakest instruments carry measured targets, each checked by a test with a control that must fail it
(`test/instruments-targets.test.mjs`).

| Instrument | Target | Basis |
|---|---|---|
| Piano | Inharmonicity B within 30% of the register table at C2, C4 and C6 (0.00015, 0.0005, 0.004) | Published stiff-string measurements of concert grands, moderate confidence on the exact values |
| Piano | Two-stage decay: the first half-second falls at least twice as fast as the tail; the aftersound t60 at C4 between 12 and 20 s | Coupled unison strings; the 16 s middle-C aftersound is an estimate, moderate confidence |
| Piano | Hammer noise lifts the attack's highs above 4 kHz by 3 dB or more and is gone 100 ms later | Design target |
| Piano | Sympathetic strings answer the octave of a struck note 10 dB over the semitone beside it | Design target |
| Upright bass | Body modes raise the bands at 58 and 98 Hz by 6 dB or more and leave 500 Hz within 2 dB | Air and top-plate modes of a double bass, moderate confidence on the frequencies |
| Upright bass | The finger's slip lifts 4 kHz in the first 12 ms of a soft pluck by 3 dB; fingerboard rattle lifts the highs above 1.5 kHz by 3 dB; pitch stays within 5 cents | Design target |
| Ride | t60 between 4 and 7 s; the highs peak 40 to 200 ms after the strike while the lows peak at once | Measured cymbal behaviour, moderate confidence |

Every pitched instrument is tested for tuning (plucked strings within 3 cents, winds within 5 cents from
C4 up, the piano's first partial within 1.5 cents on one string), headroom at full velocity, and
determinism by seed.

## What it does not prove

Passing these targets does not make an instrument sound real. They are measured against design numbers
and published ranges, not against recordings, and no listening test stands behind them. The piano has no
hammer-string interaction model, no phantom partials and no pedal noise; the bass has no slides; the
choir cannot sing words.
