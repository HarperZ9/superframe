<!-- writing-profile: research -->
# Sensory 4: every sense

Part of [SENSORY.md](../SENSORY.md). What exists is cited and kept; what is new is marked as proposed.
The audio lead's score, mixer and synthesis are the base (design/audio/SCORE.md, PIECES.md,
INSTRUMENTS.md; game/engine/audio/). design/quota/06-KEEP-CUT.md:41 still says no audio layer exists;
that line is stale since 2026-10-21.

## 1. Sound design

- **Machinery is the instrument.** The export train, the notice press, the grain chute, the mill's
  stones, the Captain's chain, the cart's axle and the requisition lamps are score material, not effects
  laid over it (design/audio/SCORE.md:49-57). The one-shots exist as synthesis (game/engine/audio/sfx/index.mjs:7).
- **Footing and shelter (proposed, the immersion take T3, design/INSPIRATION-2026-10-21.md:34).** Each
  plate sample has a surface kind in its geo buffer and the light model knows wet, frost and shelter per
  sample (design/state/light.md:12-16). A footstep reads the kind under the foot: snow crunch under
  frost, a wet slap where `wet` is high, a hollow board in the barn, flagstone ring in the exchange. A
  step under shelter loses the sky's slap echoes and takes the room's.
- **The attention rule (proposed, after Walter Murch's "two and a half").** At most two distinct sounds
  a listener can follow at once, plus a bed. A scene's designer names which two; anything else drops
  into the bed or under it by 12 dB. The harness logs the count of foreground layers per second and flags
  a scene that holds three or more for more than 4 s.
- **Diegetic threat signal.** The requisition lamps hum at 100 Hz, a third of a semitone off the
  harmony, and never resolve while the squad is near (design/audio/SCORE.md:32). Deaf and hard-of-hearing
  players get it as a caption (05-CARE.md).

## 2. Score and leitmotifs, tied to the motifs

The audio lead's motifs stand (design/audio/SCORE.md:69-102). This table ties each to the object or
symbol on screen, so the picture and the music speak of the same thing, and adds four.

| Motif | Symbol in the world | Musical form | New here |
|---|---|---|---|
| The Haldane table | The bowls (content/quota/q_props.lwd:19-31) | Five notes, an empty bowl a rest (SCORE.md:73-77) | The visual bowl and the note are cut together: when a bowl goes to the shelf, its note becomes a rest on the next bar |
| The ledger | Figures on paper, boards, chalk | The reported figure spelled in D dorian (SCORE.md:78-81) | Under the written-over-figure break (03-SURREAL.md), the ledger plays the written figure while the true one sits in the bass |
| The good hat | Abel's hat (q.good_hat) | A rising fourth, proud in era 1, flat by era 2 (SCORE.md:82-83) | |
| The drag | The Brack line | A late heavy root (SCORE.md:84-85) | |
| The Hesh water idiom | The blue thread, the shared cup | Falling grace notes, heterophony, the drone on the fifth (SCORE.md:86-90) | Who still wears the thread (design/quota/08-WORLD-MEDIA.md:70) sets the heterophony's second voice: thread off, the second voice goes silent |
| The Vell idiom | Scarves, script, the tea glass | Narrow chant, raised fourth, tea glass (SCORE.md:91-93) | |
| The record | The read-back | Silence (SCORE.md:94-96) | Kept |
| Dreams and premonition | The dream look, a later era's look | Bowls backwards at half speed; a later era's sound early (SCORE.md:97-99) | The picture now follows the same rule (L7) |
| **The scale (new)** | The exchange scale across five eras (q_props.lwd:43) | A two-note see-saw on the iron's own pitch, level in era 1, never level after | Proposed |
| **The bell tower (new)** | The wide lens's tower | One bell at the hour; era 5 it is gone, and the hour is a phone chime | Proposed |
| **Decay of a loop (new)** | Decay layer of the model | Each era reuses the previous era's cue as a tape loop that loses highs and drops samples with the street's decay, after William Basinski's method | Proposed |
| **The stone (new)** | The Haldane stone (design/quota/08-WORLD-MEDIA.md:80) | Blank stone: the five notes with the summit missing; named stone: the summit sounded once | Proposed |

The harmony of the record (an inflated figure hollows every fifth a semitone, SCORE.md:104-117) is the
deepest sensory rule in the game and stays exactly as written.

## 3. Voice direction and processing

Existing and kept: people in the room with the place's room; the narrator almost dry; inner voices with
no room at all, placed in the head by time and level difference (design/VOICE-BIBLE.md:59-74); the
read-back's one flat voice, 3.4 syllables a second, no room, no music (design/voice/QUOTA-VOICES.md:63-79).
New, per look:

| Look | People | Inner voices | Note |
|---|---|---|---|
| Dream | Through the long "space" room at 40% wet, high shelf cut 3 dB | Unchanged, dry | The head stays the one dry place, so the player knows who is dreaming |
| Memory | Band 180 Hz to 6 kHz, tape wow 0.3%, a little hiss | Unchanged | Sound arrives 0.8 s before the picture |
| Radio, era 2 (the Crown) | Band 300 Hz to 3.4 kHz, AM hiss, the room around the set | n/a | The Directorate's figures read aloud (design/quota/08-WORLD-MEDIA.md:99) |
| Phone, era 5 | Band 300 Hz to 3.4 kHz, codec smear, a phone speaker's resonance at 2 to 4 kHz | n/a | The clip and the channel |
| Loudspeaker, rally | Horn resonance, slap echoes off facades from the square's room | n/a | |
| Perspective chapter | Unchanged | The chapter person's own voice, from their sheet's voice record | The same sixteen voices in another mouth |
| Surreal break | People keep their own room; a second room ("space") is heard at once | Unchanged | Two rooms at once is the signature (03-SURREAL.md rule 4) |

Slurs are spoken under the slur rule's voice limits (design/voice/QUOTA-VOICES.md, 11.5). No
processing marks a lie; the duck never reads `lie` (design/audio/SCORE.md:142-143).

## 4. Room acoustics per place

Existing rooms (game/engine/audio/ir.mjs:8-15): kitchen 4.2 x 3.6 x 2.6 m, t60 0.55 to 0.18 s; office
0.9 to 0.45; granary 2.2 to 0.8; square slaps; tower slaps; road; mill yard; the long space. Proposed
additions, in the same four-band t60 form (low to high, seconds):

| Place | Size (m) | t60 | Character |
|---|---|---|---|
| The Crown | 9 x 6 x 3 | 0.7, 0.6, 0.45, 0.3 | Bodies, wood, low ceiling |
| The Furrow Church | 28 x 12 x 14 | 3.4, 3.0, 2.2, 1.2 | Stone; a long tail that empties with the congregation |
| The Well House (era 1 barn, era 5 built) | 8 x 6 x 4 | 0.9, 0.7, 0.5, 0.3 | Water in a basin as a constant small sound |
| The cells | 3 x 2 x 2.8 | 0.5, 0.45, 0.4, 0.3 | Hard, small, a flutter echo between close walls |
| District office corridor | 20 x 2 x 3.2 | 1.2, 1.0, 0.8, 0.5 | Footsteps carry; the press through the wall |
| The burial ground | Open | Slaps only, few | Wind dominant; no echo off any wall |
| The station | 40 x 15 x 9 | 2.0, 1.7, 1.2, 0.7 | Iron roof; the train fills it |
| An era 3 shared house | 4 x 4 x 2.8 | 0.45, 0.35, 0.25, 0.15 | Ten families: soft furnishings, many bodies, little reverb, many sources |
| The mill floor (era 4) | 50 x 20 x 8 | 2.6, 2.2, 1.6, 0.9 | Emptying as machines stop: the tail grows longer each shift |
| An era 5 flat | 4 x 3.5 x 2.5 | 0.35, 0.3, 0.25, 0.15 | Plasterboard; the neighbour's television through the wall |
| The council chamber | 15 x 10 x 5 | 1.1, 0.95, 0.8, 0.55 | Microphones on the desks: speech close, applause far |
| The archive | 12 x 6 x 3 | 0.5, 0.4, 0.3, 0.2 | Paper eats the highs |

## 5. The silence budget

Silence is a resource with a budget, measured by the harness from the mixer's bus gains.

| Era | Share of play with the music bus silent | Near-silences (every bus under -60 dBFS momentary, 1 to 8 s, only at authored beats) |
|---|---|---|
| 1 | 20% | 2 |
| 2 | 45% | 5 |
| 3 | 30% | 3 |
| 4 | 25% | 3 |
| 5 | 40% | 4 |
| Read-back | 100% (music and room silent, SCORE.md:139-143) | The whole record |

Failure: a scene's measured share outside its era's target by 10 points, or a near-silence nobody
authored (a loading gap is a defect, not a silence).

## 6. Haptics and rumble

Exists: in a fight, blows that touch the player's character play a dual-rumble effect with the
combat's low and high motor strengths, on or off (game/engine/ui/fightlayer.mjs:110-115;
game/engine/ui/settings.mjs:28). Proposed vocabulary, all under one intensity setting (05-CARE.md), all
through the Gamepad API's `dual-rumble` (strong and weak motor, duration) until the native shell has
Steam Input:

| Event | Motors | Pattern | Carries |
|---|---|---|---|
| The export train arriving | Strong 0.15 rising to 0.35 | Pulses at the wheel-joint rhythm, slowing as it brakes | Weight through the ground |
| The notice press | Weak 0.2 | One click a bar | The office's pulse |
| The grain chute | Weak 0.1 to 0.25 | Fine random grains, 30 a second | Grain as rain |
| Cold, era 2 outdoors | Weak 0.05 | A tremor 2 s on, 6 s off, only after 60 s outside | The body cold |
| The granary door struck | Strong 0.6 | One hit, 120 ms | The door's mass |
| The heart under dread | None | Never | The game does not fake the player's body |
| Reading, examining, the read-back | None | Never | Stillness |

## 7. UI motion and typography

Kept as built: two faces, Hanken Grotesk for every sentence and number, Conso for names
(design/UI-SYSTEM.md:30-37); entering 220 ms, leaving 150 ms, reduced motion as 80 ms opacity
(design/UI-SYSTEM.md:101-127; game/engine/ui/tokens.css:41); one hot mark (design/UI-SYSTEM.md:70);
lettering hands per character (game/engine/ui/lettering/). New: the UI's paper follows the era (era 1
rag paper, era 2 grey ration stock, era 3 cheap pulp, era 4 photocopy, era 5 a phone's white) while
tokens, sizes and contrast stay fixed; the read-back is the only typed sheet; no look ever warps text.

## 8. Text pacing

- A conversation line waits for the player. Narration at "Pace of scenes" full advances only on input.
- Note cards stay 4 s plus 0.3 s a word (game/engine/ui/examinecam.mjs:19).
- The close look holds 6 s at most and any input skips it (game/engine/ui/examinecam.mjs:1-12).
- The read-back: 0.6 s between rows, 1.4 s before each hinge (design/voice/QUOTA-VOICES.md:70-71).
- Proposed: a line that follows a hinge decision appears after a 0.8 s beat of the room's own sound,
  so a decision lands before it is answered.

## 9. Smell, taste and touch through the other senses

| Sense | What | Image | Sound | Haptic | Voice |
|---|---|---|---|---|---|
| Smell | Tallow smoke, sheep's fat, sour milk (design/quota/01-WORLD.md:45) | Smoke kind `soot` and `smoke`, yellowed (design/state/light.md:106) | The fat spitting in the pan | | SMELL speaks first in a chapter with a strong nose (L9) |
| Smell | The grain store | Dust in the lamp's shaft | The chute | Weak grains | |
| Taste | Gruel thin enough to see the glaze through (q_props.lwd:28) | The close look on the bowl | The spoon scraping the bottom | | |
| Taste | Sweet tea, era 4 and 5 (the Vell) | Steam over a glass | The tea glass in the Vell idiom | | |
| Touch | Cold | Breath, reddened ears and fingers | Snow underfoot, wind | The cold tremor | |
| Touch | Weight | Sacks, a body leaning | Grain shifting in the sack | The door, the train | |
| Touch | Wet | Wet sheen, a drip | Drips by the room's size | | |

## 10. Per scene type

| Scene type | Look | Sound bed and room | Music | Voice | Haptic | Silence |
|---|---|---|---|---|---|---|
| Wide lens at the tower | Era look, aerial haze | The district from 25 m (game/engine/audio/place.mjs:9-12) | District cue | Few lines | None | Long gaps |
| Narrow lens, a kitchen | Era look, single source | Kitchen room, close and dry | One instrument (SCORE.md:126-128) | Close | None | Between courses |
| Dinner | Era look, the table lit | Spoons, the stove | Usually none | People overlap at writers' cuts | None | After the worst line |
| Office, bureaucracy | Pen and glaze | Press through the wall, the pen | Office cue | Clipped | Press click | Before signing |
| Cells, interrogation | Dither light | Small hard room, flutter echo | None | Close, no music | None | Long |
| Fight (granary door) | Base, never morphed | Granary room | Four layers by intensity (SCORE.md:131-133) | Barks one at a time | Blows, the door | When the true figure is read |
| Dream | Dream look | Long room, the bed dry | Bowls reversed | People in the long room | None | Before the cue |
| Premonition | A patch of a later era | A later era's sound early | Crushed sampler | | None | |
| Memory, era window | Held frame, drained present | Sound first | None or one instrument | Band-limited | None | |
| Perspective chapter | L9 | Same place | Same cue, the person's motif | The chapter's own head | Same | |
| Propaganda, rally | Mezzotint | Loudspeaker, crowd | Rhythmic industrial | Loudspeaker | Crowd stamps | Cut to silence at the hinge |
| Close look, examine | Shallow focus (gap) | The object's own small sound | Ducks under | None | None | The room only |
| Read-back | Paper | None | None | The flat READBACK voice | None | All |
| Transition between lenses | Ink-blot | Paper and ink sound | Crossfade on the bar | None | None | |
| Arena | Base | Yard or club | The yard is the band (SCORE.md:100-102) | Barks | Blows | Between bouts |
| Era 5 screens | Glyph inside paint | Phone speaker | | Codec voice | None | |

## 11. The fever (plague direction, 2026-10-22)

Sound and smell carry the sickness; the camera does not linger (05-CARE.md). Rows for the sound lead:

| Where | Sound | Smell, carried in the words | Never |
|---|---|---|---|
| The cells, nights 42 to 44 | A boy's voice through a door saying four lines over and over, low; keys; a chair; the stove ticking down. The voice stops between one line and the next | SMELL: the bucket, then "the flux", sweet and wet | The cell opened by the camera |
| Mill Street pump | Buckets on stone, a wet cough two doors down, a ribbon knocking on a knocker in the wind | Sweet wet straw from the chalked door | A sick face in close-up |
| The relief queue, day 48 | The wet cough, and people stepping half a pace off and back | | |
| The gate on Tilney Road | A cart at the side door with a sheet on it; the sexton's lad's boots on frost | | Lifting the sheet |
| The burial ground, Tuesday night | A spade in clay; lime hissing in the long trench | Lime | The body |

The thumb dent that stays in Aaron's shin is touch carried by the eye: one held shot, no music.
