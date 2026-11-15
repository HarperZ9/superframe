<!-- writing-profile: research -->
# Character sheets: the schema

Story lead, 2026-10-21. One YAML file per speaking character, named for the speaker in
lower case (`crake.yaml` for CRAKE). These sheets are the writing half of one source of truth. The
voice director's `design/voice/profiles.json` holds the spoken half (people, age, timbre, pace, synth,
face) and the regex `never` rules the direction lint enforces; a sheet never repeats those, it points
at them by `speaker`. The Articulate engineer's dialogue checks (design/VOICE-AUDIT.md, when it lands)
read the fields below. If their schema differs, theirs wins and these files are converted; the field
names here are a proposal sent through design/STATE.md.

Format `lw-character/1`:

| Field | Type | Meaning |
|---|---|---|
| `format` | string | `lw-character/1` |
| `speaker` | string | The `speaker:` name in the .lwd files and the key in profiles.json |
| `name` | string | Full name as the town says it |
| `background.born` | string | Where, and into what |
| `background.trade` | string | What they do with their hands all day |
| `background.family` | string | Who they live with, who they lost |
| `background.schooling` | string | Where they learned to read, if they did |
| `background.money` | string | What they earn, owe and are owed |
| `wants`, `fears`, `hides` | list | In their own terms, not the plot's |
| `sees` | map | How they see the town and each faction, from where they stand. Keys: `town`, `board`, `trust`, `guild`, `congregation`, `lowco`, `brine`, `shelf`, `kell`, `lamplighters`, `lamb` (only the ones they have a view on) |
| `knows` | list | Facts they hold on the nights the game covers |
| `does_not_know` | list | Facts they must never be written as knowing (the knowledge-leak check) |
| `register` | string | How they sound, in one or two sentences |
| `vocabulary` | list | Words that are theirs |
| `idioms` | list | Phrases they reach for |
| `sentence_habits` | list | How their sentences are built and broken |
| `never_says` | list | Words and constructions they would never use (prose rules; the regex rules live in profiles.json) |
| `tics` | list | Habits of speech and body that show in lines |
| `good_lines` | list | Lines already in the game that are right for them, as tuning forks |

House rule for every sheet: the person talks about their own stakes (wages, rent, debts, prices, a
sick child, last Tuesday), not about the town's ideas. Nobody names a theme. See
design/DIALOGUE-STANDARD.md.
