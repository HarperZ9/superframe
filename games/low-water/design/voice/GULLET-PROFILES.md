<!-- writing-profile: research -->
# Voice bible: Gullet's peoples and profiles (archived setting)

Part of [VOICE-BIBLE.md](../VOICE-BIBLE.md), split out on 2026-10-21 so no file passes 300 lines. Gullet, Lamb and the harbour are cut as setting and protagonist (QUOTA-DESIGN.md decision 3); these sections serve the archived acts. Section numbers are the bible's, kept across its files so references stay valid.

## 2. The town's peoples (speech, not accent)

No real accent is mapped onto any people (THEMES.md section 10). Each community is a set of features a
performer can learn and a renderer can approximate. Casting asks an actor to build from these features,
never to "do" a named region.

| People | Who | Rhythm and melody | Sounds | Words |
|---|---|---|---|---|
| **Gullet, the old families** | Quay, Gut, floor, the Brine: Marrow, Wenna, Sabine, Merrow, Pip, Spratt, Cockle, Lugg, Sallis, Penhallow | Short phrases that fall flat at the end; statements, not questions | Final g dropped ("nothin'"), h kept, short clipped vowels, a hard t | Prices, tides and fish; "the floor", "the Board", "her" for any lamp or boat |
| **Kell, the far shore** | Sorle Ammet, the stokers, the colliers' crews | A sung rise on statements that a Gullet ear hears as a question | Long, open vowels; every consonant finished, the careful speech of a second dialect | Full forms (it is, I do not); kin words ("cousin", "slack") |
| **Hesk, up the line** | The Board's paper, the Shelf, Fisk, Rook, Teague, Lamb | Even and quick, the rhythm of a letter read aloud | No dialect sounds; the t in "water" fully said | Latinate and official ("anticipated", "pending") |
| **The hill** | Crake, Gorm, Pellow, the Lamplighters | Hesk's rhythm over Gullet's vowels | Gullet vowels sanded off; they come back when the speaker is tired or angry | Polite, procedural; questions as orders |
| **The Congregation** | Fennick, Ash, Gauze, Tobit | Held vowels, soft onsets, a cadence like a litany | Breathy, quiet, long "o" and "l" | Wiring said as prayer ("circuit", "earth", "opened") |

Class sits on top of people. The hill and Hesk finish their consonants; the floor does not. A Gullet
voice that goes up the hill (Wenna in front of Crake) finishes its consonants, and a good performance
lets the effort show.

## 3. Profiles

Each profile: age, people and class, timbre, pace (syllables per second, against the author's own
reading pace of 3.9), tics the performer does (sound, not words), what the performance never does, how
stress changes the voice, and a range of four: calm, angry, grieving, lying. The synth and face values for
every speaker, principals and walk-ons alike, are in `profiles.json`; status there says which voices were
heard in the prototype and which are starting points nobody has listened to.

### 3.1 The listener and the report

**Lamb** (sheet: `lamb.yaml`). Late thirties to forties, unstated; Hesk, a clerk's class. Mid voice, neither
high nor low, gender left open: cast and render to keep it open. Pace 4.2. Tics: a small intake before
a number; reads a time off a clock out loud. Never: performs warmth Lamb has not decided on; every warm
line is a choice. Under stress: faster, flatter, the breath higher in the chest. Calm: even, a little
dry. Angry: quieter and slower, every word separate. Grieving: the voice drops and the sentence stops
early. Lying: the same as calm, a fraction quicker; Lamb is a good liar and the voices notice it.

**The narrator, the report** (no sheet; WORLD-BIBLE section 2). The house voice is a claims report
written as the night happens. Dry, close, unhurried, a clerk reading back. Pace 3.9. Never: acts the
characters' voices, sells a joke or leans on a sad line; the feeling leaks through the precision. Sits
centred and close in every mix, with a trace of the room so it belongs to the scene. Range is narrow by
design: `dry` at intensity 1 or 2 almost everywhere, `tender` for the dawn.

### 3.2 Principals

**Absalom Keel** (sheet: `keel.yaml`). 58; Hesk by office, Gullet by birth. Low, long and wet; a bass
that drips at the commas (the renderer adds 0.32 s at commas and a drop of water on `<drip>`). Pace 3.3.
Tics: a swallow before "the Board"; breath through the nose. Never: says "I" (the lint checks this), and
never raises his voice; menace comes from slowness. Under stress: the long sentences break into pieces
(the blackout scene is written that way). Calm: a committee minute. Angry: colder, slower, softer.
Grieving: the cuffs scene; the voice holds level and the breath gives. Lying: warm and grateful.

**Wenna Tallow**. 64; Gullet, a keeper's trade. Small and dry, a smoker's top with a hard edge. Pace
4.4. Tics: counts under her breath (stairs, prisms). Never: says "I" about her own feelings; she answers
with facts about the lamp. Under stress: shorter, then silent. Angry: sharp and fast. Grieving: talks
about Mother in the present tense with the voice catching. Lying: tells it to the lamp, not to Lamb;
the performer looks away (the portrait's lids drop).

**Ottilie Crake**. 60; the hill. Even, warm by rehearsal, every consonant finished. Pace 4.6. Tics:
numbers spoken with pleasure. Never: hurries. Under stress: the warmth stays and the vowels go back to
Gullet. Angry: more polite. Grieving: none shown; the performer plays one held breath. Lying: identical
to the truth, which is the point of her.

**Marrow Dunlin**. 45; Gullet, the Guild. A big chest and a preacher's swell, then near a whisper for the
true parts (WORLD-BIBLE 7.4). Pace 4.0. Tics: sniffs before judging a person. Never: shouts a true thing;
the loud parts are sermon, the quiet ones confession. Under stress: quieter. Angry: the swell without
the warmth. Grieving: the father's song, half sung. Lying: loud.

**Ambrose Fennick**. 50; the Congregation. Soft, high in the chest, vowels held like a hymn. Pace 3.6.
Tics: a held "mm" before scripture. Never: snaps; his anger is sorrow. Under stress: faster and higher,
the technical words tumbling. Lying: more technical, less holy.

**Sabine Brine**. 52; Gullet, the Brine. Quick and warm, laughing under the price. Pace 5.2. Tics: a click
of the tongue before a sum. Never: drops the smile while lying ("a smile that invites you to admire the
lie"). Under stress: louder and funnier. Angry: the jokes stop and the pace stays. Grieving: about Wenna,
low and slow, the only slow Sabine.

**Tub Merrow**. 40; Gullet, the floor. Low, short, outdoor; every line falls at the end. Pace 3.6. Tics:
talks to the stove, the sea, the pipe; never to the person. Never: asks a question (the lint checks
this). Under stress: fewer words. Angry: a short hard "No." Grieving: the line about the rope. Lying:
the flattest he has ("Asleep on my boat"), which is the tell.

**Pip Gannet**. 19; Gullet, the Brine. Bright and quick, breath in odd places. Pace 5.4. Never: sounds
older than she is. Under stress: runs her sentences together.

### 3.3 Supporting cast

| Part | People | Timbre | Pace | Never | Under stress |
|---|---|---|---|---|---|
| Ida Gorm | hill | level and quiet; every line rises at the end | 4.0 | ends on a statement (lint) | slower and more polite |
| Sorle Ammet | Kell | warm baritone, a sung lift on statements | 3.8 | contracts in Gullet speech (lint) | slips into Kellish words |
| Orrin Teague | Hesk | a good voice gone soft, rum at the edges | 3.7 | finishes a sentence about himself | sober and precise |
| Agnes Spratt | Gullet | hard and carrying, a market caller | 4.8 | lowers her voice for a secret | louder |
| Hester | Hesk | precise, tired, kind; the keys' rhythm | 4.0 | rushes | very even |
| Sister Gauze | Congregation | heard through glass: hollow, close, calm | 3.4 | raises her voice (the jar is processing: a 1.4 kHz resonance and a short glass reflection) | quieter |
| Ferris Lugg | Gullet | a whisper from a tall man | 3.5 | speaks above `low` | stops |
| Nan Cockle | Gullet | toothless, wavering, sharp | 3.2 | forgets a number | sharper |
| Sallis | Gullet | tight, held anger, short breaths | 4.6 | shouts before the gallery | breath only |
| Ysolde Penhallow | Gullet | a helm voice, every bearing exact | 3.9 | hesitates over a bearing | slower |
| Hobb, Fewell, Strand, Bright, Coe | hill | young and anxious; heavy; rhythmic; clear; muffled | 3.8 to 4.8 | (one tic each: Strand counts) | per profile |
| Mab, Noll Whelk | Gullet | one family, Mab high and quick, Noll lower | 5.4, 4.6 | finish their own sentence | speak together |
| Shadwell | Gullet | smoked, rasping, coughs mid-word | 3.6 | | coughs |
| Dilly, Gill, Tobit | Gullet, Congregation | children: small and certain; breathless; sung | 4.6 to 5.6 | | |
| Fisk, Rook, Ash, Pellow, Captain Dunlin, the masters | per profiles.json | | | | |

Walk-ons (GUARD, BODDY, the Ruddles, THE GIRL) are crowd voices: `"crowd": true` in profiles.json picks a
seeded variation per line, so a crowd never repeats one voice.
