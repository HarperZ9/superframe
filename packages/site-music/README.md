# site-music

Music written and played by code. A composer writes each piece one bar at a time from a seed: chords, a piano or vibraphone part, a bass line, drums, and a lead that states a theme and develops it. The voices that play it are fitted to measurements of real instruments: saxophones, flutes, a clarinet, a trumpet, upright and electric basses, a grand piano, a Rhodes, a Wurlitzer and a vibraphone. Sea and wind run under the band and duck when the lead plays. A whole piece renders offline to samples at -14 LUFS, or plays without end in a browser from a worker, with no audio file downloaded.

Five pieces ship: Low Tide (a ballad), Night School (modal), Glass Hour (bossa), Deep Current (drum and bass) and Clear Line (fusion), each with a second arrangement.

## Run it now

From a clone of this repo, with Node 24 or later and no install step:

```
node --test packages/site-music/tests/*.test.mjs                                         # 8 voice tests, about 10 seconds
node --test packages/site-music/tests/music.slow.mjs                                     # 13 composer and render tests, about 80 seconds
node packages/site-music/tools/render.mjs --out out/music --piece low-tide --bars 8      # a WAV, the ear's report and three pictures
```

```js
import { renderPiece } from './packages/site-music/src/piece.js';
const { channels, sr, stems, score, master } = renderPiece('low-tide', { seed: 1, bars: 16 });

import { createSiteMusic } from './packages/site-music/src/index.js';     // in a browser
const music = createSiteMusic(); await music.start('glass-hour');          // call from a click or a key press
```

`npm run test:slow` runs `tests/music.slow.mjs` and the ear's eighteen planted defects, which render excerpts of two of these pieces (`packages/ear/controls/`).

## How it is built

| Layer | Files | What it does |
|---|---|---|
| Score | `src/chords.js`, `src/pieces.js`, `src/score.js`, `src/parts.js`, `src/lead.js` | chord symbols to voicings; the five pieces as harmony, tempo, feel and band; the composer that writes bars as data, with no audio and no clock |
| Measured layer | `src/measured-data.js`, `src/measured.js` | per reference note: the level of each harmonic, how fast each dies away, how much it wanders, and the noise between them; read at any pitch and strength |
| Voices | `src/blown.js`, `src/sax.js`, `src/plucked.js`, `src/upright.js`, `src/bassguitar.js`, `src/struck.js`, `src/voices.js`, `src/synths.js`, `src/variants.js` | a sum of harmonics at the measured levels plus noise at the measured levels; the performance (breath, slurs, scoops, vibrato, plucks, slides) is the voice's own. `synths.js` holds the synthesizer voices, built from oscillators and filters with no measured table |
| Render | `src/render.js`, `src/ambience.js`, `src/piece.js` | bars to stems, the sea and wind, the mix, a look-ahead limiter and the master to -14 LUFS |
| Browser | `src/index.js`, `src/worker.js` | `createSiteMusic`: start, stop, level, mood; two bars rendered at a time in a worker, about ten seconds ahead of the playhead, stepping down on slow devices |
| Tools | `tools/` | `render.mjs` renders and lets the ear report; `fit.mjs` fits the measured tables from a folder of reference notes; `voicejudge.mjs`, `voicetable.mjs`, `segcheck.mjs`, `voicebench.mjs`, `synthbench.mjs` and `voicesheet.mjs` judge each voice against real notes; `mp3.py` writes listening copies |

## The measured data

`src/measured-data.js` holds numbers measured from recordings of real instruments, written by `tools/fit.mjs`. It holds no audio, and no recording is in this repository. Each table names its source and licence:

| Tables | Source | Licence |
|---|---|---|
| `sax`, `saxsoprano`, `flute`, `altoflute`, `clarinet`, `trumpet`, `uprightarco`, `piano`, part of `upright` | University of Iowa Musical Instrument Samples | free for any projects, without restrictions (the page's own words) |
| `saxtenor`, `vibraphone`, `epianofm` | Versilian Community Sample Library | CC0 1.0 |
| `saxbaritone`, `bassguitar`, `bassmuted`, `basspicked`, part of `upright` | Karoryfer Samples: Bear Sax, Black And Blue Basses, Pastabass, Meatbass | CC0 1.0 |
| `epiano` | Discord SFZ GM Bank, Electric Piano 1 (a 1977 Rhodes Mark I, recorded by Jeff Learman) | CC0, stated in the instrument file by its author |
| `epianoreed` | Greg Sullivan's E-Pianos, Wurlitzer EP200 (samples by Greg Sullivan) | CC BY 3.0 |

To refit the tables, fetch the sets, cut single notes into a folder with an `index.json`, and run `node packages/site-music/tools/fit.mjs NOTES_DIR`.

## Limits

- The ear's judge and likeness measures say how near a voice sits to recorded notes. They do not say a voice convinces a listener; `packages/ear/README.md` records a saxophone the judge accepted and a listener did not.
- The electric piano, flute and clarinet tables each rest on one source, so they have no held-out source to be judged against.
- The browser player needs Web Audio and a module worker. In Node, `renderPiece` and the tools cover the same code.
- `tools/mp3.py` needs the Python `soundfile` library; nothing else here has a dependency.

## Origin

`src/`, `tools/` and `tests/` began as `system/site-music/` on HarperZ9.github.io and were carried from commit c8866cc4 on 2026-11-14 with import paths repointed; this copy is maintained here from that date. The instruments' shared parts come from `sound/sound/v3/instruments/`, the loudness meter from `studio/lib/loudness.mjs`, and the tests and tools read `packages/ear`. The site's page for the music (`index.html`, `page.js`, `music.css`) stayed behind: it loads the site's stylesheet and fonts.

## BuildLang port candidates

This package is JavaScript, with one Python tool, that moved; it holds no new feature code. Each module below is queued for a BuildLang port, with the tests here and the ear's planted defects as the answers the port must reproduce.

| Module | Exports | Notes for the port |
|---|---|---|
| `src/chords.js`, `src/pieces.js` | `parse`, `voice`, `transpose`, `bassNote`, `TYPES`, `PIECES`, `PIECE_IDS`, `ALT`, `arranged` | data and integer arithmetic; first candidates |
| `src/score.js`, `src/parts.js`, `src/lead.js` | `compose`, `composer`, `shapeOf`, `writeKeys`, `writeBass`, `writeSub`, `writeDrums`, `HUMAN`, `newLead`, `phrase` | the composer is pure data from a seed, so a port is checked bar for bar |
| `src/measured.js`, `src/measured-data.js` | `around`, `harmonicsAt`, `valueAt`, `bandsAt`, `NoiseBank`, `TABLES` | table lookup and interpolation; the tables stay data |
| `src/blown.js`, `src/sax.js`, `src/plucked.js`, `src/upright.js`, `src/bassguitar.js`, `src/struck.js`, `src/voices.js`, `src/synths.js`, `src/variants.js` | `blown`, `blownPhrase`, `sax`, `plucked`, `upright`, `bassGuitar`, `sub`, `piano`, `vibraphone`, `wurlitzer`, `tx81z`, `tine`, `brush`, `analogBass`, `fmBass`, `acid`, `synthLead`, `LEADS`, `KEYS`, `BASSES` | sample loops over Float32 arrays; they port with `sound/sound/v3/instruments/core.js` |
| `src/render.js`, `src/ambience.js`, `src/piece.js` | `renderBars`, `mixStems`, `timeline`, `createAmbience`, `limit`, `master`, `renderPiece` | the offline render fits the BuildLang offline route now |
| `src/index.js`, `src/worker.js` | `createSiteMusic`, `begin`, `chunk`, `setLevel` | browser playback; waits for a BuildLang browser target |
| `tools/*.mjs` | `renderAndListen`, `fitTable`, `judgeVoice`, `segcheck`, `bench`, `VOICES` | command-line tools; these fit the offline route |
| `tools/mp3.py` | `main` | Python; replace with an encoder call from BuildLang |
