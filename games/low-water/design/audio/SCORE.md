<!-- writing-profile: research -->
# The Quota: the score

Audio lead, 2026-10-21. The musical language of The Quota, per era and per place, its leitmotifs,
how the music follows the game, and what each reference is used for. Companion files:
[PIECES.md](PIECES.md) (the slice's pieces, with a note on each and its measurements) and
[INSTRUMENTS.md](INSTRUMENTS.md) (the synthesis, its targets and its honest quality) and
[THEMES.md](THEMES.md) (the themes, as melody, harmony and form). Code: `game/engine/audio/`; the
instruments live in studio-libs (`render-sound/instruments`) and the game keeps a pinned copy. Listening renders: `game/capture/audio-2026-10-21/` (git-ignored).

Author rulings of 2026-10-22, verbatim: "The songs need improvement as well." And: "The engine can support
all of this. The music can be made using our own instrument tools." So every sound is made with our own
instruments; no sample library and no hired players.

Author direction, 2026-10-21, verbatim: "Here is the music score inspiration. We should make some
thoughtful, ambient tunes, some jazz, and a little experimental score." Ruling the same day, verbatim:
"Akira Yamaoka is our primary inspiration, and ideally we will score it very closely to his technique and
approach."

I could not listen to any reference. Everything below about a reference comes from what I know of the
artist, and each claim carries a confidence label. Clean room: no melody, chord sequence, rhythm pattern,
sample, lyric or recording from any reference; no reference is named in the game.

## 1. Yamaoka's approach, and how the Quota follows it

Yamaoka is the model for the whole score; the other references are colour inside his method. What I take
from him, point by point:

| His technique (my reading) | Confidence | In the Quota |
|---|---|---|
| Music and sound design are one material: industrial noise, metal, machinery inside the cue | high | The machinery of the Upper Town is the percussion and the drones: the export train, the notice press, the grain chute, the mill's stones, the Captain's chain. They are instruments in the score files, not effects laid over it |
| Heavy reverb and distance; long silences | high | Most cues sit in a long generated room ("space", 6.5 s at the low end) and leave bars empty. The road cue stops for four bars where the cart is turned back |
| Sub-bass drones under dread | high | Every famine cue has a sub drone on D, and every lie hollows its fifth (section 6) |
| Trip-hop and breakbeat grooves with melancholy guitar, often tremolo or mandolin-like picking, and plain piano | moderate | The road and the granary door run on slow broken beats with iron in them, a doubled-course guitar played in tremolo carrying the tune, and a driven bass |
| Tender, sad piano set against the noise (the author's added reference, "Promise (Reprise)", which the coordinator recalls as a melancholy piano piece) | moderate on the piece, high on the strategy | The coda at the Haldane table is solo piano in a small room. It is the only cue with no machinery in it |
| Songs with vocals at key moments | high that he does it | A wordless choir of synthesised voices carries the Captain's chant and the coda's release. Sung words are out of reach of our instruments |
| A diegetic sound in the world that signals threat | high that he does it | Our own signal: the requisition lamps hum at 100 Hz, a third of a semitone above the G the harmony wants. When the squad is near, the hum is in the music and never resolves. There is no radio and no static: that mechanic belongs to another game |
| Lo-fi processing: tape, degradation, crushed samples | moderate | Tape wow, flutter and saturation on most stems; a crushed sampler for era 5's premonitions |

The other references, as colour inside that method:

| Reference | What I take | Confidence | Where |
|---|---|---|---|
| Alice Coltrane, "Turiya & Ramakrishna" | A slow, devotional, blues-coloured piano over a held bass, with room around every phrase; from her wider work, the modal drone and harp washes | moderate on the piece (I recall it as piano-led, from *Ptah, the El Daoud*); high on her idiom | The dawn tower's harp over the D drone; era 1's church |
| Yusef Lateef, "Like It Is" | A breathy flute or oboe lead over a soul-jazz vamp, blues inflection, a modal ground | low on the track, high on his flute and oboe and his soul-jazz period | The bread fights' reed; era 4's club |
| Idris Muhammad, "Piece of Mind" | A deep jazz-funk pocket, ghost notes, a New Orleans lilt | unknown on the track, high on his drumming | Era 4's boxing club; the granary's ghost notes |
| Ryuichi Sakamoto, "20210310" | Late-period space: a few piano notes and their decay as the material; silence as a part | high (*12*, 2023, pieces titled by date) | The dawn tower's piano; the coda; the read-back's option B |
| Bill Frisell, "Coffaro's Theme" | Open Americana voicings (root and fifth low, colour tones spread), a clean warm guitar, volume swells, a little echo | moderate on the album (I think *Good Dog, Happy Man*), high on the idiom | The Furrowe kitchen at night |
| BLU-SWING, "REALIZE" | Polished club jazz: extended chords, a tight groove, keys forward | moderate on the band, unknown on the track | Era 4 and 5's boxing club |
| Akira Yamaoka, "Forest" | Ambient dread: low drones, distant metal, sparse melody deep in a room | low on which game it comes from | The dawn tower's section C; the office |
| Akira Yamaoka, "A World Of Madness" | Rhythmic industrial noise built from machine loops | moderate (*Silent Hill 2*) | The granary door; era 5 |
| Akira Yamaoka, "Promise (Reprise)" | Tender solo piano against the noise | moderate | The coda; the read-back's few notes |

## 2. The industrial palette

The Quota's machines, as instruments (`audio/sfx/machine.mjs`): the **export train** (steam hiss, sacks
thrown in, couplings taking up slack, chuffs quickening, wheels counting the rail joints); the **notice
press** (ratchet, platen, release: one cycle a bar is the office's pulse); the **grain chute** (thousands of
small impacts and the chute's boom: grain falls like rain, which the Hesh have nine words for); the **mill's
stones** (a low grind with a slow catch); the **Captain's chain**; the **requisition cart** (an ungreased
axle's stick-slip squeal, iron tyres on frozen ruts); the **requisition lamps** (the diegetic signal). Era
4 adds the hoist and the mill winding down; era 5 the sodium lamps' buzz.

## 3. The language per era

| Era | Place in the story | Language | Instruments |
|---|---|---|---|
| 1, The Exchange | A merchant town sure of itself | Confident small-band jazz: swing, a walking bass, brushes, piano comping on extended chords; the weighbridge's clank sits in the groove. Major keys; the Hesh barns heard as open guitar and harp at the edges | Piano, upright bass, brushed kit, guitar, organ in the church |
| 2, The Quota | The famine winter | Sparse piano, harp-like plucked tones, drones and breath, on D. No beat except under threat. The machinery takes the place of the band. The requisition lamps' hum | Piano, harp, breathy flute, drones, iron, the train, the press, the chute |
| 3, Allocation | Rebuilding, ten families to a house | Plain diatonic tunes with something held back: a schoolroom song on an upright piano a little out of tune; construction in time (hammers, the hoist); the Hesh idiom forced into unison (no heterophony, since Heshen is banned in school) | Upright piano, guitar, flute, hammers |
| 4, The Closure | The mill shuts; the boxing club opens | Jazz and groove: a tonewheel organ over a funk pocket, a flute or oboe over a modal vamp; the mill's drone falls a whole tone across the era as it winds down; the Vell idiom arrives | Organ, kit, bass, reed, flute |
| 5, The Clearance | A ghetto under sodium light | Thin experimental dread: the sodium buzz, sub drones, broken loops, the piano through a crushed sampler, long silences; the club's groove gone dark | Sodium hum, sub, crushed piano, breakbeat, metal |

## 4. Leitmotifs

All motifs live in `audio/theory.mjs`; the motif sheet (`motifs.wav`) plays each once.

1. **The Haldane table: five bowls.** Five notes, one per bowl, in the order the family sits (Ilo, Bet,
   Tomas, Aaron, Anni): D F A G E, up to the summit and down, ending open on the second. The community
   model's table decides which bowls are empty, and an empty bowl is a rest. Tomas's bowl is the summit,
   so the coda's line climbs to a note that is not there. Under that rest the left hand still plays the
   chord that carried it, with A in the bass.
2. **The ledger.** The reported figure spelled as notes, digit by digit: each digit a degree of D dorian,
   0 a rest. Three eighths to a figure against four beats, so the figure never sits on the bar. The
   inspector's true 205 is E, rest, A; the written 290 is E, high E, rest: a leap that hangs where the true
   figure came to rest. Wherever the ledger plays afterwards, it spells what the player reported.
3. **The Furrowes: the good hat.** A rising fourth, dotted and in major in era 1 (A, D. E F sharp), even
   and in minor by era 2 (A D E F): the hat still on, the pride gone.
4. **The Bracks: the drag.** A low root on one, then the same root again late and heavier on the "and" of
   three, then nothing: a step that comes down after it should.
5. **The Hesh (invented).** A water idiom: three quick falling grace notes into a held note (the rain); a
   phrase that ends a step up, like the Hesh statement that rises at its end (QUOTA-VOICES 11.2); two
   voices in heterophony, the second a beat late with its own small variants (the shared cup); the drone on
   the fifth, never the root; a rung water glass for a bell; a mode that keeps dorian's raised sixth and
   leaves out the seventh.
6. **The Vell (invented, era 4 on).** A narrow chant inside a fifth whose colour is the raised fourth; an
   upper-neighbour turn on every long note; a long-short-short-long rhythm (the script); parallel fourths
   on a soft organ; a tea glass. I avoided the scales and meters a listener would hear as "eastern".
7. **The read-back: silence.** The music stops at the threshold and nothing plays under the record
   (QUOTA-VOICES 11.4). Option B for the author: one low piano note in the 1.4 s gap before each hinge,
   never under a line, the five bowls once each across the whole record.
8. **Dreams and premonition.** Dreams: the bowls on piano played backwards at half speed in the long room.
   Premonition: a later era's sound arriving early, so era 2 hears era 5's sodium buzz and the bowls through
   a crushed sampler, with two bowls already missing.
9. **The arena.** The yard is the band: a hand on a crate, the crowd's stamps and claps, iron from the
   hoist, the mill's stones, an upright bass vamp, a reed calling and answering. Era 4's club takes the
   organ and the kit.

## 5. The harmony of the record

The figure the player reports at the district office sets the harmony of every later cue, and it never
comes back. There is no sting and no jingle: the change starts on a bar line and crossfades over two bars
between versions of the same stems (`pieces/kit.mjs`).

| Report | Harmony from then on |
|---|---|
| True | As written |
| Inflated | Every chord's fifth and every drone's fifth a semitone low: the open interval hollowed. Where a cue cadences home, the home chord does not come (the kitchen's F becomes D flat) |
| Blamed on the Hesh | Everything the inflated report does (it is the same false figure), and the Hesh colour, B natural over D, flattened to B flat everywhere; the Hesh layer of a cue goes silent |

The truth costs too (Decay constraint 2), but in the world, not in the harmony: the ledger keeps spelling
the true figure, and the village's requisition doubles.

## 6. Adaptive music (`audio/mixer.mjs`, `audio/state.mjs`, `audio/web/player.mjs`)

- **Stems and layers.** Each cue renders its stems (per harmony where they differ). Each cue's `adapt(state)`
  maps the snapshot to a level per stem in dB, or silent.
- **The community model.** Hunger thins the district's music (a harp layer and the piano drop), deaths
  bring the church bell, the export brings the train and the iron, a street's queue rises with hunger, and
  the Hesh layer goes when the street treats the Hesh badly (standing below -0.35) or after the blamed report.
- **The lens.** Wide is the district's cue from the tower. Narrow is the room's own sound and one instrument
  (the guitar in the Furrowe kitchen, the piano at the Haldane table), with the district's drone through
  the wall at -16 dB. Near is the scene's cue.
- **Time and weather.** From the shared light model: snow and wind set the wind bed and how much the air
  takes off distant sounds; the hour sets which beds play (`place.mjs` `beds`).
- **Combat intensity.** The granary door and the bread fights have four layers each, entered at 0.25,
  0.45 (or 0.3), 0.55 and 0.7 (or 0.75). Phase 2 of the Captain brings the chain. Between bouts only the
  yard plays. No layer marks a hit, a win or a loss.
- **The talk-out.** When the true figure is read aloud at the door, every layer falls away on the bar and
  the ledger plays the true figure alone over the drone.
- **The mixer's rules.** Level and harmony changes start on the next bar line and last whole bars; harmony
  changes are equal-power and persist; ducking follows the voice line with a look-ahead and ignores the
  bar grid; the mixer only moves gains of stems already playing, so it cannot add a sting.
- **Ducking** (`audio/duck.mjs`, from the voice director's tags): a person speaking ducks music 9 dB and
  the room 4 dB; a whisper 6 dB more, low or an aside 3 dB more, a held throat 2 dB more, intensity 3 dB
  2 more; narration ducks music 6 dB; an inner voice ducks music 6 dB and the room 3 dB (VOICE-BIBLE
  4.3.4); READBACK silences music and room. Lines under 0.8 s apart share one duck. The duck never reads
  `lie`, so the mix cannot give a lie away.

## 7. Sound placement (`audio/place.mjs`)

Every placed sound gets a gain, a pan, a lowpass, a reverb share and a delay from the camera and the shared
light. Wide: references from 25 m, so the queue at 50 m and the train at 150 m are small, dark and mostly
room. Narrow: references from 1.5 m, dry, the stove at arm's length. Snow takes more highs and shortens the
room; fog a little more. The pan comes from the sound's screen position when the camera gives one.

## 8. Loudness

Listening renders are normalised to -18 LUFS integrated (-16 for the fights, -20 for the quiet rooms),
limited to -1 dBTP, and written through superstack v0.2.0 (pinned): its s16le quantiser and WAV writer,
its BS.1770 meter, and a sealed receipt per file (`audio/receipt.mjs`). Superstack's music target is -14
LUFS. I keep the score below it on purpose and record the choice in every receipt: a game score plays under
speech, which superstack itself puts at -16 LUFS, so music at -14 would sit on top of the dialogue. The
receipts therefore read "refuted" against superstack's music target, which is the intended result. In the
game each cue also carries a gain offset (`game` in its file). Measured numbers are in PIECES.md.

## 9. Open questions for the author

In PIECES.md, with what to listen for first.
