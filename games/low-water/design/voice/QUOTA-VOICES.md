<!-- writing-profile: research -->
# Voice bible: The Quota's slice cast, the read-back, the slur rule

Part of [VOICE-BIBLE.md](../VOICE-BIBLE.md), split out on 2026-10-21 so no file passes 300 lines.  Section numbers are the bible's, kept across its files so references stay valid.

## 11. The Quota (2026-10-21): the slice cast, the read-back, the slur rule

The author chose The Quota ("yes", QUOTA-DESIGN.md). Gullet, Lamb and the harbour are cut as setting and
protagonist (decision 3). Sections 4.2 and 4.3 (space, inner voices, overlap), 5 (the tags), 6 (faces) and
8 (tracks and obligations) carry over unchanged; the inner voices now belong to each class's protagonist
(PITCHES "What they tell themselves"), and their self-lies are performed in the same voice as their true
lines, so a tag never gives the lie away (`lie` is for a lie told to someone in the room, not for a
self-lie). Sections 2 and 3 are Gullet's and stay for the archived acts; every Gullet profile and voice
sheet is marked `"setting": "gullet"`.

### 11.1 One cast file, two tools

`design/voice/quota-cast.json` holds each slice speaker once: trade, wound and lie from
`design/quota/02-HOUSEHOLDS.md`, timbre, pace, tics, what the performance never does, the four-way range,
the register and knowledge for Articulate, the synth and the resting face. `node tools/voice/sheets.mjs`
writes Articulate's sheets (`design/voice-sheets/quota/`, with its own `_project.json` of Quota theme
words) and the speakers in `profiles.json` (setting `quota`); `--check` fails if either drifted. Edit the
cast file, never the outputs. Where the design gives no wound or lie (Mary, Pell, Abel, the Brack family,
the Captain), the cast file says "derived" and the story lead corrects it.

Speaker keys are first names in capitals (NED, MARY, PELL, ABEL, WILL, TOMAS, AARON, ANNI, KRALL), plus
THE CAPTAIN and READBACK. The 4.1 sample's MOTHER, FATHER and GRANDAD are not aliases, because the Brack
table has a mother and a father too. **Will Brack's wife and son have no names in the design; NELL and
DAVY are proposals for the story lead to keep or replace.**

### 11.2 The speech of the plain

| People | Speech features | Slice speakers |
|---|---|---|
| Tarn, Upper Town | Finished consonants, a level tune, sentences that close on the verb; Directorate words at work, plain words at home | Ned, Mary, Pell |
| Tarn, the plain | Dropped final g, "you've not", "I'll not", short sentences that fall at the end | Abel, Will, Nell, Davy, Krall |
| Hesh | Heshen first: a rise at the end of a statement that a Tarn ear hears as a question; full forms in Tarnish; Heshen words for water, rain, the Well and kin when moved | (era 1 Ilo; era 2 Dorrah Tesk) |
| Half-Hesh | Tarnish first; the Hesh rise only under stress; Heshen only at home | Tomas, Aaron, Anni |
| The Directorate | Written Arlen said aloud: passives, figures, titles, "comrade" as a full stop | The Captain |

As before, no real accent is mapped onto any people; an actor builds from the features.

### 11.3 The slice cast in brief

| Speaker | Wound / lie | Timbre and pace | Never (performance) | Range: angry / lying |
|---|---|---|---|---|
| NED Furrowe, inspector | the hill / "We only reported what the villages sent." | tired middle voice that says less than it knows; 3.8 | says the false number aloud at home | quiet, each word separate / flat, a beat quicker |
| MARY Furrowe | the plate (derived) / "Somebody's got to eat it." | warm, quick, running the table; 4.6 | asks what Ned saw | short words, warmth kept / warmest of all |
| PELL Furrowe, 11 | the second plate (derived) / "Mr Tamm says." | a boy with a teacher's words; 5.0 | the slurs (not learned yet) | sulks / "I'm not hungry" |
| ABEL Furrowe, 72 | Ilo (derived) / "I'm fond of them." | big old voice gone thin, fond and certain; 3.6 | admits he was wrong | wounded pride / fondest of all |
| WILL Brack, sergeant | the cell / "Somebody had to keep order." | parade voice; drunk, soft and generous, which is the dangerous voice; 4.2 | says he hit anyone | very quiet, then not / "She bruises easy" in his reasonable voice |
| NELL Brack (proposed) | the stairs (derived) / "He's tired, that's all." | low, pitched not to carry through a wall; 4.0 | raises her voice | a whisper to the children / bright, for the neighbour |
| DAVY Brack, 9 (proposed) | under the stairs / "I fell." | a small voice that has learned to whisper; 4.2 | speaks above low in the house | none / "I fell" |
| TOMAS Haldane, 11 | the family's wound / none of his own | a boy's voice, even and polite, trying to sound older; the Hesh rise when he asks; 4.4 | begs, or uses a slur back | very still / badly: "We have enough" |
| AARON Haldane, 9 | Tomas / "He went to the hills." | a small boy's voice, fast and hot; 5.0 | cries where anyone can see | shouts, the rise breaking through / the same words every time |
| ANNI Haldane, 14 | Tomas, carried longest / "He went to the hills." | level, numbers said carefully; 4.0 | says Tomas is dead | a wrong number on purpose / flat and exact |
| THE CAPTAIN | none named (derived) / "The quota is the harvest." | a reading voice, never loud, a hook in his hand; 3.7 | shouts; only a figure read aloud moves him | a figure said twice / identical to the truth |
| KRALL, Jonah | 340 / "The plain fed the country." | a meeting voice, big and glad; 4.4 | says what Krall's End ate | a hurt joke / proud |

Full records, knowledge bounds and synth starting points: `quota-cast.json`. Faces: the head sculptor's
brief names each person's exaggerated feature; the `face` values here are only resting expressions.

### 11.4 The read-back's flat voice

The read-back (pillar 5; 03-STORY era 5 beat 10; the slice's short version in the coda) is a typed record,
scrolled, unskippable. Its voice:

- One voice, the speaker READBACK, always `[flat 1 steady]`. No other emotion, no delivery, no flags, no
  `*stress*`, no breath, laugh or sigh; only `<beat>` and `<pause>`. The dirlint fails anything else.
- Pace 3.4 syllables a second, slower than any character. A fixed 0.6 s between rows and 1.4 s before each
  hinge, so the rhythm is the document's, never the scene's.
- No room, no music, no ambience under it, centred, dry. Every other voice in the game sits in a place;
  this one sits nowhere.
- The player's own words are read in the same flat voice, never imitated: the line the character said in
  a warm voice at the dinner comes back flat beside what happened. The flatness is the point.
- Cast: a human reader with no other part in the game, or (track B) a designed voice with no likeness;
  never the protagonist's voice, never a character's.

### 11.5 The slur rule in voice

The invented slurs ("mud-hands", "tallowmen", "chaffers", "goat-Hesh") are spoken in full by a character
with a history, and someone hears them (QUOTA-DESIGN handling rules). In voice:

- The character says the slur in the same voice as the rest of the line: Abel's contempt is spoken with
  love, so his slur is warm, and that is worse. Never stressed as a punchline (dirlint warns on a stressed
  slur), never bleeped, never a cue for a laugh.
- Never in the narrator's or the read-back's own voice (dirlint error). The read-back quotes the player's
  own chosen words, slurs included, on screen and aloud (section 11.8 has the lead's ruling).
- The person who hears it gets a performed reaction in the next line or a portrait cue (a held face), so
  the hearing is audible.
- Real slurs for groups that exist as themselves wait on the author's decision 2 (07-PRODUCTION).

### 11.6 Checks and the hold

- `node tools/voice/sheets.mjs --check`: the two formats agree.
- `node game/engine/tools/dirlint.mjs`: tags, the read-back, the slur rule.
- Articulate 0.12.0 (latest release, verified by its published SHA-256):
  `articulate dialogue <drafts> --voices design/voice-sheets/quota --gate`. A smoke run on the 4.1 dinner
  sample (20 lines, speakers renamed to the sheet keys) loaded every sheet, found 0 epigram shapes and 0
  sheet findings and passed the gate; attribution there is near chance with wide intervals (Mary 0.43,
  0.16 to 0.75; Ned 0.20, 0.04 to 0.62; Abel 0.17, 0.03 to 0.56; chance 0.33), which 20 lines cannot
  settle.
- **Hold:** no synthesis of the author's voice for Quota content until the author answers decision 1 in
  section 9. The cast's synth values are starting points for that day or for a designed voice.

### 11.7 First audit of the drafts (2026-10-21)

`design/voice/QUOTA-AUDIT.md`: 195 lines, 0 epigram shapes, gate passed; pooled attribution 0.29 against
chance 0.09; Ned (0.18) and Will (0.24), the two player characters, are the least distinct. The story lead
named Will's wife and son Edie and Davey, the Commissioner Pask and the Requisition Captain Holt; the cast
file follows their keys (EDIE, DAVEY, PASK, HOLT, with THE CAPTAIN as an alias) and adds MOTT, BET, TESK and
GEDGE, who speak in the drafts. A bracket of unknown words such as the engineer's `[scaffold]` marker is
now kept as text, not read as a direction block. The read-back scaffold (`content/quota/slice/scenes.lwd`,
`quota.readback`) uses `nar:`; for the flat-voice lint to hold it, its lines should be `line: READBACK:`.

### 11.8 Ruling: the read-back quotes the player's slur (lead, 2026-10-21)

The coordinator, as lead, ruled on the open call in 11.5. In substance: the read-back quotes the player's
own chosen words word for word, slurs included, both on screen and aloud in the flat READBACK voice. The
handling rule "never from the narrator or interface" forbids the game originating a slur; quoting what the
player chose to say is the accountability pillar working, and hearing your own word read back flatly is
the point. Two limits:

1. The read-back quotes only lines the player chose. An NPC's slur is cited by speaker and scene ("Abel
   Furrowe, at the Furrowe table"), never re-read.
2. Never stressed, never repeated.

How the writing marks it, and what `dirlint` enforces:

```
opt: "The tallowmen have it in holes." -> q.office.blamed {id: q.office.blame}
line: READBACK: [flat] You said: "The tallowmen have it in holes." {said: q.office.blame}
```

- A READBACK line that contains a slur needs `{said: <option id>}`, the `id:` of the player's choice it
  quotes. Without it, dirlint errors and says to cite the speaker and scene instead.
- The id must name a real option (dirlint collects every `{id:}` across the files it reads), and each
  quoted span holding a slur must appear in that option's words.
- The slur must sit inside the quotation marks; outside them it is the read-back's own voice (error).
- One slur per line, and one re-read per choice per node (errors). Stress on it in a READBACK line is an
  error; in a character's line it stays a warning.
- The flat-voice rules of 11.4 still apply: no `<laugh>`, no emotion, no delivery.
- Tests: `game/engine/tests/direction.test.mjs`, "the read-back reads flat; it re-reads a slur only from
  the player's own choice, once, unstressed".

### 11.9 Fixes after the slice landed (8911e70)

- TESK is now Old Tesk, the Hesh herder in Will's cells (`q_world.lwd` q.tesk): slow, even, full forms, no
  anger in the voice. Dorrah Tesk keeps her own record as DORRAH (wound: the children she sent back down;
  lie: "The Well looks after its own") for when she speaks.
- ILO, Tomas's father, has a profile: a quiet Hesh voice that sang all day once, full forms, passes on
  what Bet or Dorrah says, still talks about old Mr Furrowe's hat. Articulate flags one contraction in his
  lines ("they've", `q_coda.lwd:56`, inside what Dorrah says): the story lead's call.
- HOLT agrees with the slice: a Tilney cottar's son schooled in Arlen, whose mother was a "mud-hand"; the
  Arlen reading voice sits over the cottar's vowels, which come back when he talks about the hungry.
- "tallow-brats" (Gedge, `q_will.lwd`) joins the slur list, so the narrator and read-back rules cover it.

### 11.10 Lil and Mr Sallow (from ba43c27)

- LIL, Mary's widowed sister from Tarn Hollow, at the blacklisted Furrowe table with her boy on her knee:
  Mary's family warmth gone dry, every fact said as small talk; she praises the man who did it ("Lovely
  manners") because praise is safe, and never asks for the bread. One line in the slice; no findings.
- SALLOW, the replacement inspector who wrote 320 for the Hollow from his car: written ahead of his first
  line. Lovely manners: a light, pleasant, unhurried town voice with every courtesy finished and nothing
  behind it; he thanks people for what he takes and says a figure as if it were good news. His danger is
  how agreeable he is, so no performance should play him sinister.
