<!-- writing-profile: research -->
# Low Water: voice bible

Voice and character director, 2026-10-21. Author direction, verbatim: "The voice acting and
character approach is going to have to be probably redone from scratch, and perhaps we may need to
introduce a somewhat upgraded voice acting technique or methodology / approach."

Companions: `design/voice/profiles.json` (the machine form of sections 3 and 4), `design/voice/merrow-stove.lwd`
(the tagged prototype scene), `game/engine/dialogue/direction.mjs` (the tags), `game/engine/tools/dirlint.mjs`
(the lint), `tools/voice/` (the prototype renderer and `sheets.mjs`). **The author chose The Quota on
2026-10-21:** the current cast is in section 11 (`voice/QUOTA-VOICES.md`) and `design/voice/quota-cast.json`;
Gullet's sections 2 and 3 are archived. Sections 1, 4, 5 and 6 are cast-independent and carry over; in
The Quota "Lamb" in section 4 reads as each class's protagonist.

**One source of truth per character.** The story lead's sheets in `design/characters/<name>.yaml` own who
a person is and what they would say: background, wants, fears, knowledge, vocabulary, idioms, verbal tics
and words they never use (`never_says`, in prose). This bible owns how they sound: timbre, pace, the
performance range, the processing, the face. Both halves key on the same `speaker` name (sheet
`keel.yaml`, profile `KEEL`), and neither restates the other. The machine-checkable "never" rules
(regular expressions the direction lint runs) live in `profiles.json`, as the sheets' README
(2026-10-21) agreed; a sheet's `never_says` and `register` point at them.

## 1. The approach

The old approach was a line of text with a speaker name. Nothing told a performer, a synthesiser or a
portrait how the line is said, so every consumer guessed, and the guesses disagreed. The new approach has
four parts.

1. **Direction is data.** Every spoken line can carry a short performance tag (`[cold 2 slow lie]`) and
   inline cues (`<beat>`, `<breath>`, `<cut>`, `*stress*`). One tag set drives the recording session, the
   synthesis renderer and the talking portrait. A writer directs once.
2. **The town has its own speech.** Five speech communities, built from invented features (section 2),
   so casting and synthesis aim at Gullet, not at a real region.
3. **Lamb's head is one voice in many moods.** The sixteen inner voices are derived from Lamb's own
   timbre, sit inside the head (dry, close, panned by compartment) and never share the acoustic of the
   room. A player always knows a voice is internal before reading the name (section 4).
4. **Performance is checked.** A lint catches broken tags and broken voice rules; the renderer measures
   intelligibility and how far apart the voices sit; a human listens to every line before it ships.

## 4. Lamb's inner voices: a choir in one head

### 4.1 Construction

Every inner voice is Lamb's voice. In synthesis each is Lamb's setting plus a compartment offset plus a
voice offset (`profiles.json` "voices"); with a human, each is the same actor who plays Lamb (or one
consented source, section 8), directed per voice. The four compartments share a colour:

| Compartment | Offset from Lamb | Texture | Voices |
|---|---|---|---|
| The Pen | +0.5 semitone, formants a touch up | dry paper: crisp consonants | SUM, PRECEDENT, SMALL PRINT, CARBON |
| The Coat | -1.5 semitones, formants down | cloth: warmer, more chest | KNEES, BALLAST, PRIDE, GRIP |
| The Hat | +1 semitone | felt: smooth, social | CONDOLENCE, FORM LETTER, THE CHIT, HEARSAY |
| The Nose | -0.5 semitone | breath: airy, intimate | SMELL, THE DARK, UNDERTOW, SALT |

Each voice then has its own pace and contour from its temperament (SYSTEMS-FULL 2.1): SUM fast and flat,
PRECEDENT slow and anecdotal, PRIDE wide and quick, BALLAST slow and low, THE DARK a whisper, UNDERTOW low
and slow, SALT low with creak. Related by construction, distinct by performance.

### 4.2 Space and processing

| Source | Where | Processing | Why |
|---|---|---|---|
| People in the scene | In the room, at their place | Pan by position, distance roll-off above 6 to 9 kHz, the place's room (the Brine: 0.45 s) | They are outside Lamb |
| The narrator | Centred, close | Almost dry, a trace of the room | It is the report being written |
| Inner voices | Inside the head | **No room at all.** Near-field pan by interaural time (up to 0.6 ms) and level (up to 9 dB), proximity bass (+3 dB under 150 Hz), a slight top cut. Depth moves a voice from the ear (UNDERTOW, HEARSAY) to the middle of the head (THE DARK, BALLAST, SALT) | The ear hears a dry close voice with no room as "in my head" before it reads a name |
| The Kit | At Lamb's hip, outside the head | A designed resonator per object (the Damp: a taut hair, a short comb and a flutter; Candlemas: brass; the Glass: glass; the Almanac: paper; the Vane: tin), a little of the room | They are objects; no person's likeness is involved |

The head map, left to right: UNDERTOW, PRECEDENT, SUM, SMALL PRINT, CARBON (the Pen on the left, the
past); SMELL, THE DARK, SALT, BALLAST (the Nose and the body in the middle); CONDOLENCE, KNEES, PRIDE,
THE CHIT, GRIP, FORM LETTER, HEARSAY (the Coat and the Hat on the right, toward other people).

Accessibility: the inner voices must read as internal in mono and for one-eared players, so the dry,
close, room-free treatment carries the cue and the pan only adds to it. A setting turns the pan off. The
voice name is always on screen (SYSTEMS-FULL 17.1).

### 4.3 Overlap and interruption rules

1. A voice may cut into a person only at a writer's `<cut>`; the person ducks 7 dB and keeps going under
   it. A voice never cuts a person who is confessing (Merrow's light, Keel's cuffs) unless the scene is
   about Lamb not listening.
2. Two voices may overlap only as an argument (PRIDE then SALT then PRIDE), at most two at once, the later
   one tagged `over`. Three or more at once is a set piece the director signs off.
3. Voices never shout (the lint checks it). Loudness inside the head is intensity 3, closer and faster,
   never louder than the room.
4. A voice that speaks while a person speaks ducks the room by 3 dB, not the person's words.
5. In a fight, voices bark one line at a time at the screen edge (SYSTEMS-FULL 18.9): intensity 2, no
   overlap, no `<pause>`.
6. A passive that fires below its threshold (`{below: n}`) is performed weaker: one step lower intensity,
   a little slower, as if the voice is tired.

## 5. DIRECTION/1: the tags

### 5.1 Where they go

```
nar: [dry 1] Merrow is steaming at the stove, wet to the thigh. <beat> Under the settle a sack.
line: MERROW: [ashamed 2 slow held] I'm not saying I saved anybody. <breath> I'm saying I was there with a light that was *out*.
voice: condolence: [over low 1 slow] He is afraid, and it has gone into his hands. {dc: 6}
dir: MERROW: flat 1 slow
opt: "Where were you tonight?" -> brine.merrow.where {dir: flat 1}
```

- The block sits right after `NAME: ` (or at the start of a `nar:`). The screen never shows it.
- `dir: NAME: tokens` sets a default for that speaker until the node ends; a line's own block wins key
  by key.
- An option takes `{dir: ...}` among its attributes (an option label already starts with `[VOICE]` for
  checks, so the block form is not used there).
- Tokens may be bare words or `key: value` (`emo: cold, int: 2, pace: 0.9`).

### 5.2 Vocabulary

| Kind | Tokens | Default |
|---|---|---|
| Emotion (one) | flat, calm, dry, warm, tender, wry, amused, ecstatic, proud, cold, stern, angry, contempt, afraid, anxious, pleading, grieving, tired, ashamed, drunk | flat |
| Intensity (one) | 1, 2, 3 | 1 |
| Pace (one) | slow (0.82), steady, fast (1.18), or `pace: 0.5` to `1.6` | steady |
| Delivery (one) | whisper, low, raised, shout, sung | normal |
| Flags (any) | `lie` (performed as a lie under the emotion), `aside` (to self), `over` (starts over the previous line at its `<cut>`), `cut` (marks an interrupted line), `held` (said through a clamped throat or tears) | |

| Inline cue | Meaning | Default length |
|---|---|---|
| `<beat>` | a short stop | 0.4 s |
| `<pause>` or `<pause 1.2>` | a longer stop, 0.1 to 4 s | 0.9 s |
| `<breath>` | an audible intake | 0.35 s |
| `<sigh>`, `<laugh>`, `<swallow>` | non-verbal sounds | 0.35 to 0.7 s |
| `<drip>` | Keel's water, a sound effect timed to the line | 0.3 s |
| `<cut>` | the next line starts here, over this one | 0 |
| `*word*` | stress this word | |

Each emotion carries a valence (-1 to 1) and an arousal (0 to 1) in `direction.mjs`; the renderer and the
portrait both read those two numbers, so a tag means the same thing to the sound and the face.

### 5.3 What each consumer does with a tag

| Consumer | Uses |
|---|---|
| Human session | The script export prints the tag in plain words beside each line ("cold, medium, slow; a lie") with the cues as stage directions. The director reads it as a starting point; the actor may offer something better and the take is logged against the line id |
| Synthesis | `renderParams(dir)`: pitch offset, contour range, rate, spectral tilt, breath, whisper blend; cues become silence, breath, a sound or an overlap point |
| Portrait | `portraitCue(dir, face)`: the head sculptor's sliders (section 6) |
| Subtitles | Nothing; a tag never reaches the screen |

### 5.4 Writing with tags

- Tag where the performance is not obvious from the words, or where it goes against them. A line that
  reads cold and is cold needs no tag. `lie` is the most valuable flag in this game: it lets a performer
  and a portrait play the tell the voices comment on.
- One block per line. More than four cues in a line is a warning: split the line or trust the actor.
- Keep the story lead's words; a voice pass adds tags only. A tag that needs a word changed goes to the
  story lead as a note.

### 5.5 Engine support (built 2026-10-21)

- `game/engine/dialogue/direction.mjs`: the vocabulary, `parseDirection`, `splitDirected`, `portraitCue`,
  `renderParams`.
- `parse.mjs`: `line`, `inst`, `voice` and `nar` strip the block and the cues from the shown text and keep
  `dir` and `cues` on the step; options read `{dir: ...}`; a new `dir:` step sets a node default.
- `runner.mjs`: every line in a beat carries `dir` (the node default merged under its own) and `cues`;
  Lamb's chosen option line carries the option's `dir`. Untagged content plays exactly as before (the
  Act 1 validator: 1,694 nodes, 0 errors, 0 warnings after the change).
- Tests: `game/engine/tests/direction.test.mjs` (6 tests).

### 5.6 The lint

`node game/engine/tools/dirlint.mjs [paths]` (default: the three acts and `design/voice`).

- Errors (exit 1): a block or `{dir:}` that does not parse (unknown word, two emotions, intensity outside
  1 to 3, pace outside 0.5 to 1.6); an unknown `<cue>`; an unpaired `*`; whisper at intensity 3; an inner
  voice told to shout; `over` on the first spoken line of a node.
- Warnings: `<cut>` with nothing spoken after it; more than four cues in a line; a speaker or voice with
  no profile; a line that breaks its speaker's "never" rule (quoted speech is ignored, so Keel quoting the
  Shelf's "I saw a light" is not Keel saying I).
- Summary: spoken lines, how many carry direction, per speaker.

First run on the acts as they stand (2026-10-21, 62 files, backups skipped): 6,807 spoken lines, 0
directed in the acts, 0 errors, 34 warnings. The warnings are for the story lead to judge, not to fix
blind: 29 Gorm lines end on a statement (all in `dawn.lwd`'s `dawn.town`, where she reads her book aloud:
quote marks would mark them as the book's words and clear them), 3 Keel lines use I, me or my in his own
voice (`mole.lwd` 1898 and 1908, `weigh.lwd` 1880), 2 Sorle lines use contractions (`brine.lwd` 2337,
2378). A later run picked up the story lead's new `opening.lwd` and its speaker PROTHERO, who needs a
profile.

## 6. Faces: the portrait reads the same tags

The head sculptor's expression sliders (`characters/forge/headshapes.mjs` EXPR_SLIDERS, 2026-10-21) are
`brow`, `browInner`, `lids`, `corners` (each -1 to 1) and `jaw` (0 to 1), over the presets `neutral`, `wary`,
`startled` and `set` (`characters/cast/parts.mjs`). `portraitCue(dir, face)` maps a line's direction onto
them on top of the character's resting face (`face` in profiles.json):

| Tag | brow | browInner | lids | corners | preset |
|---|---|---|---|---|---|
| calm 1 | slightly down | level | slightly heavy | slightly up | neutral |
| angry 3 | up (tension) | pinched down | wide | down | neutral |
| grieving 2 | level | lifted (the grief brow) | heavy | down | neutral |
| afraid 2 | up | pinched | wide | down | startled |
| cold, stern, contempt | down | | | down | set |
| anxious, ashamed | | | | | wary |
| any + `lie` | | | steadier (+0.15) | the smile held to 30% | |
| whisper, aside | | | +0.2 | | |

`jaw` is driven by the audio, never by the tag: the renderer writes a 30 fps envelope per line
(`timeline.json` "jaw30"), so the mouth moves with the take that is actually played, human or synthetic.
Resting faces carry the character: Keel's lids heavy (0.45) and corners down, Fennick's inner brows lifted,
Sallis's pinched. The face of a lie is the tell a good reader sees: the eyes settle and the smile does not
reach full.

## Where the rest is

| Section | File |
|---|---|
| 2, 3: Gullet's peoples and profiles (archived setting) | [voice/GULLET-PROFILES.md](voice/GULLET-PROFILES.md) |
| 7 to 10: the prototype, the three tracks and their costs, Steam and consent obligations, the author's decisions, next | [voice/METHODS.md](voice/METHODS.md) |
| 11: The Quota's slice cast, the plain's speech, the read-back's flat voice, the slur rule in voice | [voice/QUOTA-VOICES.md](voice/QUOTA-VOICES.md) |
