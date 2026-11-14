# sound/reference

The reference sound renderer: a scene in, the same PCM out every time, with a receipt. `seedScene` writes a short piece from a seed, `figureScene` an oscilloscope figure, `scanScene` a sound read off a grid, and `musicScene` a built-in chord. `renderReference` renders any of them to 16-bit samples, `measure` reads integrated loudness and peak, and `soundReceipt` binds the scene and the samples under the superstack contract so another renderer can be held to the same bytes.

## Run it now

From a clone of this repo, with Node 24 or later and no install step:

```
node --test sound/reference/tests/*.test.mjs     # 11 tests
```

```js
import { seedScene, renderReference, soundReceipt, wavOf } from './sound/reference/sound.mjs';
import { seedComposition, renderAudioBuffer, audioToWav } from './sound/reference/audio.js';
```

The engine's sound nodes (`superframe/adapters/sound.mjs`) and the grid-to-sound converter (`superframe/lib/convert.mjs`) render through this folder. `liveContext`, `playReference` and `reconcileLive` play through Web Audio and need a browser.

The contract functions come from `packages/superstack/superstack.mjs`, and the seed helpers from `superframe/lib/seed-streams.mjs`.

## Origin

`sound.mjs` began as `system/media-engine/sound.mjs` and `audio.js` as `system/audio.js` on HarperZ9.github.io at commit 3ca6529. They sat in the engine as a vendored snapshot until 2026-11-14 and are maintained here from that date. The tests came from the site's `system/media-engine/sound.test.mjs` and `system/audio.test.mjs`.

## BuildLang port candidates

These files are JavaScript that moved; the folder holds no new feature code. Each module below is queued for a BuildLang port, with the pinned PCM hashes in the tests as the known answers the port must reproduce.

| Module | Exports | Notes for the port |
|---|---|---|
| `audio.js` | `audioSeed`, `seedComposition`, `renderAudioBuffer`, `seedSoundSamples`, `audioToWav` | pure arithmetic; first candidate |
| `sound.mjs` | `seedScene`, `musicScene`, `scanScene`, `figureScene`, `renderReference`, `measure`, `soundReceipt`, `wavOf` | offline render and receipt; the three live playback functions wait for a BuildLang browser target |
