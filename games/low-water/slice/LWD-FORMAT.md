<!-- writing-profile: research -->
# LWD/0: the Low Water dialogue format (draft for the BuildLang track)

Draft, 2026-10-16. This is a proposal for the BuildLang integration track (RELEASE-PLAN.md section
4), not a decision. It is the plain data format the vertical-slice script is written in
(`lamp_quay_2300.lwd`), so that a BuildLang gameplay module can load it later without a parser for
a general language. Nothing in the BuildLang repository is written or assumed by this draft.

## 1. Why this shape

- **Flat records, no nesting.** BuildLang has no `Box<T>` yet (issue #83, open on 2026-10-15), so
  recursive trees are awkward. Every node, fact, event and place is a top-level record with a
  string id. References are by id; a loader can intern ids to indices in one pass and keep all
  records in arrays (arenas).
- **One line, one key.** Every content line is `key: value`. Keys may repeat (a node has many text
  lines and options). Order within a record is the order of play.
- **No dice.** No random choice. Conditions read the weather, the tide, the light, what Lamb has
  noticed and where Lamb is.
- **Readable in a text editor and diffable.** Writers edit it directly.

## 2. Lexical rules

- UTF-8. Lines end with LF. A line starting with `#` is a comment.
- A record starts with a header line `@kind id` (kinds below) and runs to the next header.
- Blank lines are ignored.
- `key: value` splits at the first `: `. The value runs to the end of the line; there is no
  escaping. Text values may contain any character except a line break.
- Ids are lowercase ASCII words joined by `.` or `_` (`brine.wenna.coat`).
- Times are `hh:mm` on the night's clock. Times from `00:00` to `11:59` are read as after midnight
  (24:00 and later) when the record's meta clock starts in the evening.

## 3. Records

| Kind | Purpose | Keys |
|---|---|---|
| `@meta` | One per file | `title`, `format`, `start` (node id), `clock` (start time), `end-clock`, `at-end` (node the runtime jumps to when the clock reaches the end) |
| `@place id` | A place on the district map | `name`, `light` (0 to 1 with power on), `sodium` (fraction 0 to 1 with power on), `dark-light` (light with the zone's power off), `zone` |
| `@fact id` | A note for the Daybook, or a state flag | `about` (the line Lamb writes in the Daybook), `against` (who it points at, repeatable: `against: keel 30`; the number is how hard), `by` (the instrument or sense that finds it) |
| `@event id` | Something the night does at a time | `at` (time), then node content keys; the runtime plays it once, at the first node boundary after the time |
| `@node id` | A beat of play | content keys below |

### Node content keys

| Key | Meaning |
|---|---|
| `place: id` | The player is at this place from this node on |
| `when: cond` | Guard. If false when the node is entered, the runtime follows `else:` |
| `else: id` | Where to go when `when:` is false |
| `cost: n` | Minutes this beat takes (advances the clock) |
| `nar: text` | Narration in the house voice (the assessor's report) |
| `line: SPEAKER: text` | A spoken line |
| `inst: INSTRUMENT: text` | An instrument's voice |
| `read: instrument target` | Perform a reading (systems section 3); the engine's reading rules may set facts |
| `set: id` / `clear: id` | Set or clear a fact |
| `cmd: command args` | An environment command, logged with this node as its source (`setPower quay off`, `restrike mother`, `addRumour keel_knew quay 0.3`) |
| `opt: "label" -> target [? cond] [+n]` | A choice. Hidden when its condition is false. `+n` adds minutes |
| `claim: "label" -> ok / fail [? cond] [+n]` | A claim. Always shown when the node is shown. Goes to `ok` when the condition holds, else `fail`; the two scenes carry the reaction, so nothing else is shown |
| `go: target` | Continue without a choice |
| `alt: target ? cond` | Conditional continue, evaluated where it stands: if the condition holds, the rest of the node is skipped and play continues at the target. Lines before it have already played |
| `end: id` | Ends the slice with an outcome id |

## 4. Conditions

```
cond   := or
or     := and ( "|" and )*
and    := unary ( "&" unary )*
unary  := "!" unary | atom
atom   := "(" cond ")"
        | "has(" id ")"                    # fact held
        | "at(" place ")"                  # current place
        | term cmp value
term   := "hour" | "tide" | "fog" | "rain" | "wind.dir" | "wind.speed"
        | "light" | "sodium"               # at the current place, from the snapshot
        | "power.quay" | "mother"          # zone states: on / off; burning / dark
        | "chits" | "paraffin" | "wet"     # player resources and condition
cmp    := "<" | "<=" | ">" | ">=" | "==" | "!="
value  := number | hh:mm | word
```

Thresholds that drive play (light, fog, tide) are evaluated through the engine's hysteresis
(ADR 0017), so a condition does not flicker between two nodes.

## 5. What a BuildLang loader needs

1. A line reader and a split at `: `, ` -> `, ` / `, ` ? ` and ` +`.
2. A small recursive-descent parser for conditions. Recursion here is in the parser's call stack,
   not in data; the parsed condition can be stored as a postfix array of tokens, which needs no
   boxed tree.
3. Interning of ids to indices, and a lint pass (every target exists, every note used is
   declared). `tools/lwd_check.mjs` is a JavaScript lint for writers, with a random
   walker that looks for dead ends. The prototype's loader is `game/lwd.mjs`.
4. Access to the engine's environment queries for the terms above, through the embedding contract
   in RELEASE-PLAN.md section 4.2.

## 6. Open questions for the BuildLang track

- Whether conditions should compile to BuildLang functions at build time (fast, checked) or be
  interpreted from the postfix form (hot-reloadable text). The draft assumes the second for
  writers, with an optional build step.
- Localisation: text values become string-table keys at build time; the draft keeps English in
  place for the slice.
- Voice and timing data (audio cue ids, line durations) are not in the draft.
