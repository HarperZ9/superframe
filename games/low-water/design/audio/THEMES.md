<!-- writing-profile: research -->
# The Quota: the themes

Audio lead, 2026-10-22. Part of [SCORE.md](SCORE.md). Author feedback, verbatim: "The songs need
improvement as well." The first round leaned on drones and short motifs; this round gives every cue one
line a person could hum, a bass that moves, and chords voiced so the inner parts move by step. The themes
are written here and as data in `game/engine/audio/themes.mjs`, which the pieces arrange; a test checks
that every bar adds up and that the melody sits on its chords on the downbeats (`tests/audio-themes.test.mjs`,
with a control a semitone off that must fail).

Notation: one bar per cell, note and length in beats; `_` is a rest; the chord row gives one chord per bar
unless split. All original; none quotes a reference.

## 1. The Haldane table (the coda, the narrow lens at the Haldane kitchen, the suite)

3/4, 63 bpm, D minor. Form a a' b a'', 16 bars. The head of a, a' and a'' is the five bowls (D F A for Ilo,
Bet, Tomas, then G E for Aaron and Anni). An empty bowl is a rest, so with Tomas gone the line climbs to a
note that is not there; the chord under the rest still sounds.

| | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| a | D F A (1 1 1) | G2 E1 | F2 D1 | E3 |
| | Dm | C/E | Bbmaj7 | A7sus4 2, A7 1 |
| a' | D F A | C5 2, Bb 1 | A2 G1 | A3 |
| | Dm | F/C | Gm7/Bb | A7 |
| b | D5 2, C5 1 | Bb2 A1 | G2 Bb1 | A3 |
| | Bbmaj7 | Gm7 | Em7b5 | A7b9 |
| a'' | D F A | G2 E1 | F2 E1 | D3 |
| | Dm | C/E | Gm7 2, A7 1 | Dm |

Why: the bowls figure is the family; a and a' answer each other (an open E, then the dominant's A); b
reaches the top D once and sighs down over a falling bass (B flat, G, E, A); a'' closes home, the only
full cadence the family gets.

## 2. The Upper Town (the dawn tower, the suite)

4/4, 60 bpm, D minor, 8 bars. A rising sixth (A to F) and a stepwise fall: the town looking up, then down.

| | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| 1-4 | A3 2, F4 2 | E D E F | G3 A1 | E4 |
| | Dm | Bb | C | A7sus4 2, A7 2 |
| 5-8 | A3 2, F4 2 | E D C Bb | Bb C E2 | D4 |
| | Dm | Gm | Gm6 2, A7 2 | Dm |

## 3. The kitchen at night (the Furrowe and Brack kitchens, the town's ordinary life going sour)

4/4, 66 bpm, swung, F major leaning to D minor, AABA, 32 bars. Colour: the cool-jazz small band (Twin
Peaks, below). Tenderness and dread in the same chord: D minor with a major seventh (bar 3), and the minor
four under the home key (B flat minor six, bar 6, where the tune's D flat sours it).

| A | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| tune | C5 2, A G | A4 | C#5 2, D E | F5 4 | E5 2, D A | Db5 4 | C5 2, A 2 | G3, _ |
| chords | Fmaj7 | Em7b5, A7b9 | Dm(maj7) | Dm7 | Bbmaj7 | Bbm6 | Fmaj7/A | Gm7, C7sus4 |

A2 and A3 end `Bb 2, G E | F 3` over `Gm7, C7 | F`, the home chord. B: `D5 2, F5 2 | E5 3, C5 | D5 2, Bb 2 |
A 4 | G A Bb D | C5 4 | Bb 2, G 2 | _ 2, E 2` over `Bbmaj7 | Am7 | Gm7 | Fmaj7 | Ebmaj7#11 | Dm7 | Gm7 |
C7sus4, C7b9`. After an inflated or blamed report, the home chord becomes D flat major seven.

## 4. The requisition road (the road post)

4/4, 76 bpm, half-time, D minor, 16 bars in two halves. The tune falls from the top D and climbs back;
the second half starts high on F and walks down to the D below.

| | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| A | D5 2, C A | Bb3 A1 | G2 F G | A4 | D5 2, C A | Bb2 D5 2 | E5 2, C#5 2 | D5 4 |
| | Dm | Gm | Ebmaj7 | A7sus4, A7 | Dm | Gm | A7 | Dm |
| B | F5 2, E D | C5 3, Bb | A2 G A | Bb4 | A2 F2 | G2 E2 | F E D C# | D4 |
| | Bb | F/A | Gm7 | Ebmaj7 | Dm/F | C/E | A7 | Dm |

E flat major seven is the dread chord: a semitone above the D the tune returns to.

## 5. The Requisition Captain (the granary door; later the Clearance Sergeant)

4/4, 92 bpm, 16 bars. A chant for a choir in octaves with a fifth under it, as at a service. The A half is
on D; the B half goes up a minor third to F minor, whose A flat sits a tritone from the D the cue returns to.

| | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| A | D 2, D E | F2 E2 | D C D2 | A3 4 | D D E F | G2 F2 | E F E D | D4 |
| | Dm | Bb | Gm | A | Dm | Bb | Gm6, A | Dm |
| B | F 2, F G | Ab2 G2 | F Eb F2 | C4 | F F G Ab | Bb2 Ab2 | G Ab G F | D4 |
| | Fm | Db | Bbm | C | Fm | Db | Bbm6, A | Dm |

## The new references, as colour

Author's references of 2026-10-22, with the coordinator's reading and mine. Yamaoka stays the model; these
are colour, techniques only.

| Reference | What I take | Confidence | Where |
|---|---|---|---|
| *Unbreakable* (James Newton Howard) | A quiet broken-chord ostinato that keeps going under the theme; a slow build over long stretches; sorrow held back until one release | moderate | The coda: the ostinato runs through all 50 bars, the strings and pads open in S2, the bridge is the one loud moment, then the electric piano alone |
| *Soundtrack from Twin Peaks* (Angelo Badalamenti) | Slow lush pads; an electric piano; a cool-jazz upright bass walking under finger snaps; a slow tremolo on a clean guitar; tender and ominous in the same chord | high on the idiom | The kitchen: guitar with a slow amplitude tremolo, electric piano comping with auto-pan, walking bass, snaps on two and four, a pad; the minor-major seventh and the minor four |
| "Godskin Apostles" (Tai Tomisawa, *Elden Ring*) | Choir, organ and orchestral weight with a liturgical, unholy feel | moderate on the cue, high on the score's general approach | The Captain: choir in organum, full organ, driving strings, procession drums, the church bell |
