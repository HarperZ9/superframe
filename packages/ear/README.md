# ear

Measurement that stands in for listening. The ear is a set of pure functions over PCM samples: give it rendered audio and it reports loudness (ITU-R BS.1770), spectral balance, pitch and chords, tempo and swing, roughness, stereo field, dropouts, masking between layers, repetition, and how near a single note sits to recordings of real instruments. Each number outside its target becomes a flag. It runs in Node and in a browser with no install step.

It can say that a render is clean, in key, in time and balanced. It cannot say that the music is beautiful, that a melody is worth hearing twice, or that a mix feels warm. A person decides those by listening.

## Run it now

From a clone of this repo, with Node 24 or later:

```
node --test packages/ear/tests/*.test.mjs                 # 26 tests, about 20 seconds
node packages/ear/tools/listen.mjs FILE.wav --bpm 92      # the report for any 16-bit PCM WAV file
npm run test:slow                                         # includes the eighteen planted defects (19 minutes on one thread, less on four)
```

## What the ear reports on the engine's own sound

Measured on 2026-11-14. Input: `renderReference(seedScene("aurora"))` from `sound/reference/sound.mjs`, 7.76 seconds, one channel, 48 kHz.

| Reading | Value |
|---|---|
| Integrated loudness | -14.0 LUFS (the engine's own meter reads -14.00 on the same samples) |
| True peak | -2.3 dBTP |
| Loudness range | 1.0 LU |
| Clipped runs, DC offset | 0, 2.4e-5 |
| Tempo | 68.0 BPM, beat spread 1.3 ms |
| Octave bands | -5 dB at 125 Hz, -2 dB at 250 Hz, -18 dB at 2 kHz, -86 dB at 4 kHz, lower above that |

Four flags were raised on the clean render: `balance` (the 8 kHz band is 68 dB under the target curve), `dull` (the 2, 4 and 8 kHz bands average 46 dB under it), `harshness` (the third-octave band at 2 kHz stands 27 dB over its neighbours an octave away, because the band above it is empty) and `dropout` (one gap inside the programme). The targets were set for the site's music over sea and wind. What the flags state as fact is that this render holds almost no energy above 2 kHz and has one silent gap.

The planted defects that work on finished audio were then applied to the same render, placed in two channels because the controls expect stereo. The two-channel copy reads -10.99 LUFS, 3.01 LU louder, so `loudness` was raised before any defect was planted. Seven of the eighteen could run:

| Planted | Result |
|---|---|
| clipping | caught by `clipping`, a flag the unchanged render did not raise |
| right channel upside down | caught by `correlation` (-1.00) and `mono` |
| DC offset of 0.02 | caught by `dc-offset` |
| right channel upside down below 200 Hz | caught by `low-mono` |
| 8 dB peak at 3 kHz | no evidence: `harshness` was raised before the defect (27.1 dB) and after it (28.0 dB) |
| 8 dB under the target | no evidence: `loudness` was raised before and after (-10.99 to -18.99 LUFS) |
| top turned down 6 dB | no evidence: `dull` was raised before and after (-45.8 to -51.9 dB) |

The other eleven did not run: nine change the performance of a site-music piece, one needs separate layers, and the dropout is planted at 30 seconds in a render 7.8 seconds long. In the three rows marked no evidence, the unchanged render had already raised the flag, so the flag cannot show that the defect was heard. To judge engine renders that are dark by design, pass targets that fit them: `listen(audio, { targets })`.

## Use


```js
import { listen, summary } from './packages/ear/src/index.js';
const report = listen({ channels: [left, right], sr: 48000 }, { score, stems });
console.log(summary(report));      // a few lines of text
report.flags;                      // one entry for each number outside its target
```

`score` is optional: `{ bpm, swing, chords: [{ t0, t1, bar, sym, root, pcs }], lead: [{ t0, t1, m }] }`, with times in
seconds and pitch classes as numbers 0 to 11 (C is 0). `stems` is optional: `{ music, ambience, drums, keys, bass, pad,
lead }`, each a pair of channels the same length as the mix.

## What it measures

| Area | Measure | Method |
| --- | --- | --- |
| Level | integrated loudness in LUFS (loudness units relative to full scale) | ITU-R BS.1770-4, through `studio/lib/loudness.mjs` |
| | loudness range in LU | EBU Tech 3342: gated short-term loudness, 10th to 95th percentile |
| | true peak in dBTP (the peak between samples) | 4x oversampling |
| | clipping, DC offset, crest factor | sample counts, channel mean, peak over RMS |
| Balance | level per octave band against a stated target curve | long-term average spectrum (Welch) |
| | harshness | 2 to 5 kHz against the 250 Hz to 2 kHz body, and the tallest third-octave peak from 2 to 5 kHz over its neighbours |
| Pitch | chroma (energy per pitch class) for each written chord | partials found per 340 ms frame, assigned to the nearest semitone |
| | chord estimate, and the share of energy on the written chord | chord templates over the chroma; the bass decides the root |
| | tuning of the lead line in cents | distance of each partial from equal temperament |
| Time | tempo, tempo drift, beat spread, swing, onset density | spectral-flux onsets, autocorrelation, a beat grid |
| Harmonics | sensory roughness over time | Sethares (1993), after Plomp and Levelt (1965); citations in `rough.js` |
| Stereo | correlation, width, level change in mono | sums and differences of the channels |
| Gaps | dropouts and silence | 5 ms level frames against the two seconds around them |
| Layers | how far the music and the lead sit over the ambience, per octave band | band energy of signal over masker |
| | loudness of each layer, and the kit against the harmony layers | BS.1770 per layer |
| Shape | repetition: how alike successive eight-bar phrases are | correlation of band-energy patterns, eight steps to the bar |
| | entries: the largest rise in 3 second loudness, and layers that first sound together | loudness curve; first sounding time per layer |
| Low end | level change under 120 Hz when summed to mono; two bass layers in the same band | low-pass, then sums; band energy per frame |
| Presence | mean of the 2, 4 and 8 kHz bands against the target, flagged as dull or bright past 3 dB | the same octave bands |
| Notes | attack time and its spread, spectral flux inside a note, brightness against level, likeness of repeated notes, inharmonicity | per note of a lead or bass layer, from the score's note list (`note.js`) |
| Identity | which instrument a single note is nearest to, among real instruments | 25 timbre features per note (`timbre.js`), nearest class over a book of notes recorded from real instruments (`identity.js`, `identity-refs.json`) |
| | how far a note is from a real note of the same pitch, moment by moment, over the whole note and per segment (attack, first 150 ms, sustain, tail) | mel-spectrogram distance in dB (`likeness.js`); a second reading with each picture's fixed colour per band removed (`flattened`) |
| Pluck | the finger or hammer burst above each band's decay, two decay speeds per harmonic, the pitch just after a pluck | short frames per octave band; early and late decay lines; instantaneous frequency of harmonics 3 to 8 (`pluck.js`) |
| Pictures | log-frequency spectrogram, chromagram, loudness curve | our own PNG writer in `png.js` |

The targets are in `TARGETS` in `src/index.js`. Loudness (-14 LUFS integrated) and true peak (at most -1 dBTP) are the
site's master target. The balance curve is a house choice for quiet music over sea and wind; it is a statement of
intent and can be replaced per call.

## How we know it hears

Two kinds of control, both run as tests.

**Known signals** (`tests/ear.test.mjs`): a 997 Hz sine at -23 dBFS reads -23 LUFS; a 440 Hz sine is found at 440 Hz on pitch
class A, and the same sine 30 cents sharp reads 30 cents sharp; written chords are named by root and family; pink noise
reads a flat octave slope and white noise 3 dB per octave; click tracks at set tempos and swing ratios are read back;
the roughness curve peaks where the published curve peaks; identical, inverted and unrelated channels read +1, -1 and
0; a 40 ms hole is found where it was cut. Round two (`tests/shape.test.mjs`): a phrase played four times reads as one
performance and four different phrases do not; a 12 dB step reads 12 dB and a slow ramp reads little; layers that
start together are counted; noise shaped to the target curve reads 0 dB presence and 6 dB down at the top reads dull;
bass out of phase between the channels is caught when the whole mix still sums well; two bass layers in one band
clash and an octave apart they do not; a 168 BPM syncopated break reads 168 with the score and 168 or 84 without it.

**Planted defects** (`controls/controls.slow.mjs`, run by `npm run test:slow`): clean excerpts of two pieces (the slow ballad and the drum
and bass piece) raise no flag. The same excerpt with one defect planted must raise the flag that names it. Eighteen
are planted: clipping, the bass a semitone high, the electric piano a semitone high, a wrong chord in one bar, tempo
drift, an 8 dB peak at 3 kHz, an 8 dB loudness error, an inverted channel, a 60 ms dropout, a DC offset, ambience
raised over the lead, one lead note 45 cents sharp, the first statement repeated as a loop, the band starting all at
once, the top of the mix turned down 6 dB, the right channel inverted below 200 Hz only, a bass guitar moved into
the sub's band, and (round three, the eighteenth) a lead whose every note is the same wave. The controls found two holes while the ear was being built (a wrong chord passed a loose limit, and a 3 kHz
peak passed an absolute harshness measure on a dark mix); both are closed and the controls keep them closed.

## Instrument identity (round four)

The measures above say a render is clean. None of them says whether a voice labelled saxophone resembles a saxophone.
Round four gives the ear ground truth: 332 single notes recorded from real instruments, from six public sets whose
licences allow this use (University of Iowa Musical Instrument Samples, free for any project without restrictions;
Karoryfer Black And Blue Basses, Weresax and Meatbass, CC0; Versilian Community Sample Library tenor saxophone, CC0;
Discord SFZ GM Bank electric piano, CC0). The recordings stay outside the repository. `identity-refs.json` holds numbers
measured from them, with each source named.

Two measures, and what each is for:

- **The judge** (`identity.js`) names the nearest instrument class for one note, or "none". It is tested on its own book
  first (`tests/identity.test.mjs`): with each note held out in turn, 286 of 332 are named as their own instrument (86 percent);
  saxophone and clarinet are confused in 3 of 68 and 3 of 34 notes; bass guitar and upright bass never; 16 of 16 sines
  and sawtooths are rejected as every instrument; a reference moved 2 or 3 semitones keeps its class in 237 of 267 cases.
- **Likeness** (`likeness.js`) is the stricter one: the distance in dB between our note and a real note of the same pitch,
  beside the distance between two real recordings of that instrument from different sources. A voice passes only when
  it is nearer to real notes from sources held back from its fitting than real sources are to each other.

What the judge cannot do, stated from its own failed controls:

- It does not stand for "convincing". It named the round three saxophone a saxophone in 90 to 100 percent of notes, and
  a listener did not find that voice convincing. The listener's ear overrides the judge.
- It knows sources as much as instruments. With a whole source held back, 93 of 144 notes are still named correctly
  (65 percent; saxophone 82 percent, bass guitar 28 percent). Notes cut from a played saxophone phrase of a source it had
  never seen were named saxophone in 1 of 10 cases. It reads isolated single notes, and reads them best from rooms and
  microphones like the ones in its book.
- A sawtooth sits close to a saxophone on the averaged features. It is rejected only by the range test on noise and
  movement, which a synthetic voice can satisfy by adding noise and movement.
- The electric piano has one instrument behind it, flute and clarinet one source each, so those three have no
  held-out source and get no pass or fail from likeness.

Build and report: `node packages/ear/tools/identity.mjs build NOTES_DIR`, then `report NOTES_DIR`. Judge our voices:
`node packages/site-music/tools/voicejudge.mjs --notes NOTES_DIR`.

## Placing a fault in time (round five)

A single distance says a voice differs; it does not say where. `segmentDistances` in `likeness.js` splits the distance
into four parts of the note, in seconds from its onset: the attack (-0.02 to 0.03), the early part (0.03 to 0.15, where a
plucked string sheds its upper harmonics fastest), the sustain (0.15 to 0.6) and the tail (0.6 to 1.5; reference notes
ring until they die, so this is the decay). The yardstick is the same split between two real recordings. Bass voices
are drawn from 30 Hz, so the fundamental of a low string is in the picture (from 60 Hz it was not).
`packages/site-music/tools/segcheck.mjs` runs it for one voice; `voicetable.mjs` for all of them.

Per-source normalisation: each recording carries its microphone and room as a fixed colour across the bands.
`flattened` removes from a picture its own mean level per band over the note. When the plain distance is large and the
flattened one small, the difference is mostly fixed colour (a microphone or a body), and not the shape of the note in time.

The harmonic-sum bass reader (`pitch.js`): a partial below four times 135 Hz lends its energy, divided by k, to the
fundamental it would be harmonic k of. A bass whose second or third harmonic is stronger than its fundamental is still
read at its fundamental; round four read a strong third harmonic as a fifth in the bass.

## Limits

- Roughness does not catch a layer played a semitone off in this idiom, and round two did not close that hole. Ninth
  and thirteenth chords already hold seconds and sevenths. Round one read the whole mix: 0.081 clean against 0.086 (bass
  transposed) and 0.097 (piano transposed). Round two added roughness between layers only (each pair takes one partial
  from each of two layers), which removes the roughness inside a chord voicing: 0.066 clean against 0.071 and 0.076.
  The separation is 8 and 15 percent, too small to set a limit on. The chord fit of each layer catches the defect
  (0.03 and 0.21 against a limit of 0.72). Roughness stays in the report as a description of the harmony, with flags
  only for gross readings.
- The note measures say whether a line is stamped out, and they are weaker at saying whether an instrument convinces.
  Likeness of repeated notes is the firm one: copies read 1.00 and a played line reads well under 0.9. Brightness
  against level is firm only on a designed ladder (one pitch, one length, several strengths); inside a piece it is
  mixed up with note length and register and is reported without a limit. The targets used for the saxophone and bass
  guitar (brightness rising about 0.15 to 0.25 octave per 10 dB, a string inharmonicity near 1e-4, a reed attack of
  some tens of milliseconds) are from memory of the acoustics literature, not checked against a source in this work.
- Tempo has an octave: without the score a 168 BPM break reads as 168 or as 84, and both are right ways to feel it.
- Entry abruptness by level alone is weak: a staged entry and a sudden one read 6 to 8 dB against each other in these
  pieces. The count of layers that first sound together is the measure that separates them, and it needs the layers.
- Repetition compares phrases of a set length on a bar grid. It needs the tempo, and it reads a strict loop; a loop
  with small changes in timbre still reads as one performance, and two performances of the same chords do not.
- The chord estimate needs a bass to name a root. A rootless piano voicing alone is read as the chord its upper notes
  spell (for example E-flat minor ninth without its root reads as G-flat major seventh).
- Masking is a band-energy comparison. It leaves out the inner ear's excitation pattern, so it misses masking that
  spreads upward from a loud low band.
- Tempo is read from onsets. On music with no clear attacks the reading is weak, and windows without a pulse are left
  out of the drift measure.
- Timing is read from the drum layer when it is given on its own, and from the whole music otherwise; rolled chords and
  slow attacks blur the second reading.
- The limits for flags were set from this site's own renders: each sits between the clean reading and the reading with
  the defect planted. Other music needs its own limits.

## Origin

`src/`, `tools/` and `tests/` began as `system/ear/` on HarperZ9.github.io and were carried from commit c8866cc4 on 2026-11-14 with import paths repointed; this copy is maintained here from that date. `controls/` began as `system/site-music/controls.mjs`, `controls.worker.mjs` and `controls.test.mjs`. The FFT comes from `sound/sound/dsp.js` and the BS.1770 meter from `studio/lib/loudness.mjs`. The controls render their excerpts with `packages/site-music`.

`src/identity-refs.json` holds numbers measured from 332 single notes in the six public sets named above and in the file's `sources` field, each with its licence. No recording is in this repository.

## BuildLang port candidates

This package is JavaScript that moved; it holds no new feature code. Each module below is queued for a BuildLang port, with the known-signal tests and the planted defects as the answers the port must reproduce.

| Module | Exports | Notes for the port |
|---|---|---|
| `src/spectrum.js` | `powerFrames`, `peaks`, `averageSpectrum`, `octaveBands`, `bandPower`, `slopePerOctave`, `decimate`, `hann`, `mono`, `db`, `mtof`, `ftom` | arithmetic over an FFT; first candidate, every other module reads it |
| `src/level.js` | `level`, `loudnessCurve`, `loudnessRange`, `sampleStats` | needs the BS.1770 meter ported with it |
| `src/pitch.js` | `harmony`, `tuning`, `estimateChord`, `chordFit`, `chromaSpans`, `partialFrames`, `framesOf`, `narrow` | chroma and chord templates |
| `src/time.js` | `timing`, `onsets`, `onsetCurve`, `tempo`, `drift`, `grid` | spectral flux and autocorrelation |
| `src/rough.js` | `roughness`, `crossRoughness`, `pairRoughness`, `frameRoughness` | Sethares roughness over partial pairs |
| `src/stereo.js`, `src/mask.js`, `src/low.js`, `src/shape.js` | `stereo`, `gaps`, `masking`, `lowMono`, `lowClash`, `lowpass`, `repetition`, `entries`, `layerEntries`, `barGrids` | sums, band energies and correlations |
| `src/note.js`, `src/pluck.js` | `noteStats`, `inharmonicity`, `excess`, `twoStage`, `onsetOf`, `settle` | per-note measures |
| `src/timbre.js`, `src/identity.js`, `src/likeness.js` | `analyse`, `features`, `melCepstrum`, `pitchOf`, `judge`, `identify`, `scoreAs`, `build`, `leaveOut`, `melgram`, `distance`, `likeness`, `segmentDistances`, `flattened` | the 25 features, the nearest-class judge and the mel-spectrogram distance; the book stays JSON |
| `src/index.js` | `listen`, `summary`, `balance`, `presencePeak`, `TARGETS` | the report and its flags |
| `src/png.js`, `src/pictures.js` | `encodePng`, `Canvas`, `ramp`, `spectrogram`, `chromagram`, `loudnessPicture` | a PNG writer and three pictures; needs a deflate |
| `tools/listen.mjs`, `tools/identity.mjs` | `readWav`, `barGrid`, `tone`, `shift`, `readNote`, `loadIndex` | command-line tools; these fit the offline BuildLang route now |
| `controls/controls.mjs` | `DEFECTS`, `EXCERPTS`, `runControls` | ports after `packages/site-music` |
