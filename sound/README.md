# sound

The sound engine. `sound/sound/` is dependency-free Web Audio plus offline instrument models: one master bus with a limiter, a sequencer with swing, synthesized drum, bass, bell and pad voices, effects, a sampler, a WAV encoder, the sonic motifs, and the v3 physical instruments (reed and flute bores, electric pianos, pads, a funk kit, breaks, an 808). `sound/reference/` is the reference renderer with receipts; it has its own README.

## Run it now

From a clone of this repo, with Node 24 or later and no install step:

```
node --test sound/tests/*.test.mjs       # 51 tests: the sequencer clock and every v3 instrument preset
```

```js
import { calls } from './sound/sound/v3/calls.js';                                  // in Node: two bars of drums as samples
import { INSTRUMENTS, preset } from './sound/sound/v3/instruments/index.js';
const { L, R } = calls.groove(preset(INSTRUMENTS.funkkit.meta, 'deep-pocket'), { bars: 2, bpm: 96, sr: 48000, seed: 3 });
```

```js
import { Engine, Sequencer, hum } from './sound/sound/index.js';   // in a browser, after a user gesture
const engine = await Engine.live();
new Sequencer(engine, hum).start();
```

The v3 instruments and `calls` render samples in Node. `Engine`, `Sequencer.start`, the voices, effects, `sample.js`, `soundbar.js`, `v2/player.js`, `v3/generative.js`, `v3/render-worker.js` and `renderOffline` in `wav.js` need Web Audio or a worker, so they run in a browser. `Sequencer.renderAll` and `swingPos` are plain arithmetic and are tested in Node.

## What came from where

The engine held the core of this folder (`dsp.js`, `engine.js`, `fx.js`, `limiter.js`, `util.js`, `voices.js`, `motifs/`, `v3/instruments/`). On 2026-11-14 the browser half was carried in from HarperZ9.github.io `world/sound/sound/` at commit c8866cc4, unchanged:

| File | What it is |
|---|---|
| `index.js` | one import for the engine, sequencer, voices, effects, sampler, WAV and motifs |
| `sequencer.js` | bars of 16th steps with swing; live scheduling 0.35 s ahead of the clock, or `renderAll` for an offline render |
| `sample.js` | load a sound file, cut it into equal slices or at onsets, play a slice forward or reversed |
| `soundbar.js` | the visible on, mute and volume controls; nothing plays until the first press |
| `wav.js` | 16-bit WAV encoding, an offline render through `OfflineAudioContext`, peak and RMS of a buffer |
| `reveal.js` | a live and an offline spectrogram drawn to a canvas |
| `songs/hum.js` | "Hum", a 36-bar beat written as a score for the sequencer |
| `v2/player.js` | plays a finished master and feeds the hit queue from an events file |
| `v3/calls.js` | the render calls the worker and the offline tools share: same inputs, same samples |
| `v3/generative.js` | an endless piece composed bar by bar and rendered in the worker |
| `v3/render-worker.js` | a module worker that renders instrument notes and phrases off the main thread |

Where both sides had a file: the six core files and the motifs were equal on both sides. `v3/instruments/reed.js` differed, and the engine's copy is kept: it is the newer one, with a 30 Hz high-pass that removes the DC offset of a held note.

Not carried: the two demo pages and their stylesheets (they load font files and site addresses this repository does not hold), the font files, and the theme page with its three recorded masters and their event lists. `sample.js` names five archive recordings by file name; the recordings are not in this repository, so `loadArchive` needs a `base` address that holds them.

`tests/instruments.test.mjs` came from the author's sound workspace. `tests/sequencer.test.mjs` was written with this move, because the site had no sequencer test.

## BuildLang port candidates

These files are JavaScript that moved; the move adds no feature code. Each module below is queued for a BuildLang port.

| Module | Exports | Notes for the port |
|---|---|---|
| `sound/sequencer.js` | `Sequencer`, `swingPos` | `swingPos`, `timeOf` and `renderAll` are arithmetic and port now, with `tests/sequencer.test.mjs` as the known answers; live scheduling waits for a BuildLang browser target |
| `sound/v3/calls.js`, `sound/v3/instruments/` | `calls`, `INSTRUMENTS`, `preset` | offline sample renders; `tests/instruments.test.mjs` holds the pitch and level answers |
| `sound/wav.js` | `encodeWav`, `renderOffline`, `bufferStats` | the encoder ports now; `renderOffline` needs Web Audio |
| `sound/songs/hum.js` | `song`, `sectionOf` | a score as data plus calls into the voices |
| `sound/v3/generative.js` | `Generative` | the composer is arithmetic; playback needs a worker and Web Audio |
| `sound/sample.js`, `sound/reveal.js`, `sound/soundbar.js`, `sound/v2/player.js`, `sound/v3/render-worker.js`, `sound/index.js` | `ARCHIVE`, `loadArchive`, `chop`, `playSlice`, `liveSpectrogram`, `bufferSpectrogram`, `mountSoundBar`, `MasterPlayer` | browser only; wait for a BuildLang browser target |
