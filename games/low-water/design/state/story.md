<!-- writing-profile: research -->
# Story lead: state

The story lead's notes for the other leads. Newest first.

## 2026-10-22: Anni's father is Ned Furrowe

Asked who Anni's father is, the author answered, verbatim: "You decide, and expand upon it deeply." The
coordinator decided Ned Furrowe; the soft options, unnamed or Ilo, were rejected. Canon: Ned at about 27,
promised to Mary; Bet at about 20, working at the Furrowe farm; both adults; whether she could refuse him
stays contested and the narration never rules. Abel covered it with the match to Ilo and the Haldane barns
tenancy; Edwin Mott ruled the father column; Ilo knew, took the bargain and loves her. Anni is Tarn by
blood, raised Hesh, and wears the thread. Full design: `design/spine-plan/09-ANNI.md`.

- **Every writer:** no line, caption, prop or read-back row says it, and no character says "father" or
  "dad" with Ned's name. The player reads it from objects and faces. No narration or interface string
  may say "really Tarn", "Tarn blood", "by blood", "real father" or "true father".
- **Character lead:** ANNI and ANNI_ADULT now `inherit(S_BET, S_NED, "anni", 0.55)`, people "tarn",
  label "Tarn, raised Hesh", Hesh dress with the thread, a face override toward Ned's long face. Please
  rebake Anni with the others. ABEL_ERA1 is 50 in the cast; Abel at 75 in era 2 makes him about 63 at the
  census.
- **Arena designer:** two self-lies in 09-ANNI.md "For the arena"; Bet's conflicts with 08-ARENA.md rule
  6, and I recommend the rule stand unless you and the author decide otherwise.
- **Coordinator:** the canon names "Pell and Davey" as her half-brothers. Davey is Will and Edie Brack's
  son in the slice. I treated Pell as the only one and need a ruling.
- **No content line contradicted the canon; none changed.**

## 2026-10-22: Anni, born out of wedlock

The author, verbatim: "Out of wedlock." Anni stays fourteen in era 2, and era 2 stays twelve years after
era 1's wedding, so Bet had her about two years before she married Ilo. The register's father column is
blank. Ilo raised her as his own and she carries the Haldane name. Who her father is stays open; write
no line, prop, record or read-back row that settles it. Full record, the persecution items and proposed
beats: `design/spine-plan/09-ANNI.md`.

- **Character lead:** ANNI and ANNI_ADULT in `characters/cast/quota.mjs` no longer inherit from Ilo. The
  face is Bet's and an unnamed parent's drawn halfway between the Hesh and Tarn ranges. Portraits are
  not rebaked; please rebake Anni when the material fault in `render/shade.mjs` is fixed.
- **Art lead:** an era 1 photograph can hold one child, Anni, about two
  (`design/quota/08-WORLD-MEDIA.md`, "The Haldane five", is yours and was not edited).
- **Systems:** H1's notes call Anni "the youngest" (`content/quota/q_coda.lwd:6`, `design/STATE.md:749`).
  She is the eldest. Not changed here.

## 2026-10-22: the words over the gameplay engineer's seven mechanics

**Agreed: the engineer's edits in my files.** The five `{self: ...}` tags on inner lines (q_ned, q_office,
q_will, q_dinner), the granary's endings going to `q.night` (q_granary), and the route in `q.coda.own` to
`q.coda.corner`. All three stand as they are.

**My edits in the engineer's files, text only; records, conditions and mechanics unchanged:**
- `q_props.lwd`: the era 2 states of all twelve props, rewritten to the dialogue standard and the slice's
  facts. Second person is gone ("in your hand" now reads "in Will's pencil"; the corner says what Will told
  Ned). The ledger state keeps the words "sevens without a bar", which `tests/props.test.mjs` matches. Eras
  1, 3, 4 and 5 are left as the engineer drafted them, until those eras are written.
- `q_lore.lwd`: `q.coda.corner`, Will drunk on the Crown's steps, rewritten under DIALOGUE-STANDARD 3a. He
  circles and runs himself down, and the small details come out sideways: the feet end, the thread left on
  the wrist, the clay on his boots, "Doctor said intestinal. I don't know what that is." He never names the
  cell as the place Tomas died (his voice sheet), and the scene doesn't end on a summary.
- `q_dreams.lwd`: the three `see:` lines, the night's narration and the two voices. The engineer's new
  `fear: shift(owed, ...)` line in the working copy is theirs and was not in my commit.
- `q_perspective.lwd`: Bet's chapter, written as hers: what she sees for each door outcome, what she can't
  say (no thanks for the sack; the name she won't say), and the bowls she lays for the morning (four with
  the fifth held against her coat, or five). The disagreement with the read-back is now in the fiction. When
  the door held, the read-back says the guards took a man to show for the night. Bet saw the Orme lad's
  brown coat and tells herself it was the Orme lad, but Tomas was wearing that coat. The `@perspective` and
  `@archetype` records, `bet_door`, and the start, return and endperspective lines are unchanged.
- `q_readback.lwd`: three of the engineer's `@said` lines. Anni's tally is in Ned's inside pocket, as the
  scene has it, not his drawer. The sergeant's eighty is the sweep in the Commissioner's book, not a
  district return. The hill line is "day 41".

**For the engineer:** `tests/dreams.test.mjs` doesn't parse in the working copy (a string broken at line
58). That's your edit in progress, not mine.
