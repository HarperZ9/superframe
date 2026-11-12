<!-- writing-profile: procedure -->
# Act 2 edit pass

From the director, 2026-10-17. Act 2 is complete in first draft and validates with 0 errors over
728 nodes. Articulate finds almost nothing. What the story editor's second read found in Act 1 is
true of Act 2 too: the routes are written as narration. This pass applies the Act 1 lessons to your
Act 2 file. Same rules and checks as `design/ACT2-WRITER-BRIEF.md`; back up to
`content/act2/.orig/<file>` first; district-prefixed scratch files; write only your file.

## Measure yourself

```
python content/tools/brevity.py content/act2 <file>.lwd
node content/tools/lwd1_lint.mjs content/act2/act2.lwd --carry content/act1/act1.lwd --file <file>.lwd
node game/engine/tools/validate.mjs content/act2/act2.lwd
```

| File | Narration now | Target | Similes per 1,000 now | Target |
|---|---|---|---|---|
| quay2 | 80% | 55% or less | 2.8 | 3.0 or less |
| brine2 | 59% | 45% or less | 3.4 | 3.0 or less |
| weigh2 | 85% | 55% or less | 2.4 | 3.0 or less |
| mole2 | 78% | 55% or less | 3.1 | 3.0 or less |
| gut2 | 63% | 50% or less | 3.8 | 3.0 or less |
| floor2 | 86% | 60% or less | 3.3 | 3.0 or less |
| hill | 62% | 55% or less | 2.1 | 3.0 or less |
| gasholder | 68% | 55% or less | 0.7 | 3.0 or less |
| ropewalk | 73% | 55% or less | 1.4 | 3.0 or less |
| spit | 74% | 60% or less | 2.8 | 3.0 or less |

## The lessons (from `design/EDITOR-NOTES.md`, passes 1 and 2)

- Route narration becomes what the player does and what people say, or goes. A short route node
  does not describe the room or the weather again.
- One image per node; in a node of three lines or fewer the image is the beat or it goes.
- One voice per fight outcome; never the set of CARBON replay, CONDOLENCE moral and PRIDE tag; no
  "Fled. From X." shape.
- Voices tempt, argue and notice; they never translate the scene. No deduction stated twice (an
  instrument gives the reading; Lamb, or a check, concludes).
- No thesis spoken. No evidence free. Failure stays interesting. Lamb has no gender.
- Any encounter you defined in your file gets a `talk:` exit and, where a Shadow route leads into it,
  a sneak variant (the brief's section "Fights: the four ways through").

## Joins between files (do these in your file)

- **quay2:** the procession passing along the quay reads `gasholder_carries` (bulb, bulb_eye, lit,
  lit_eye), `gasholder_walked` (none, shelf, pilgrim) and `gasholder.carrying` (Lamb holds the
  crown of prisms in the line); a relit Old Bulb's gas bag lasts about forty minutes from the gate,
  so it goes out somewhere on the quay. If the procession was stopped (`gasholder.procession_stopped`),
  the quay is quiet at one o'clock. Give `quay2.wardens` a talk exit.
- **brine2:** give `brine2.brawl` a talk exit (Sabine's fork, as in Act 1).
- **weigh2:** give `e.switchroom` a talk exit.
- **mole2:** say where the crown of prisms (the Eye) ends up if it reaches the foot of the mole
  (`gasholder_carries == bulb_eye` or `lit_eye`). Agree with the hill's mechanism (its file header:
  the hill arcs are Mother's pattern, Mother's lockout, and a standing order to restrike by hand
  within six minutes; Fisk's lockout is ninety seconds at full arc temperature).
- **hill, gasholder, ropewalk, spit, gut2, floor2:** brevity and the lessons above.

## Report back

Narration share and similes before and after, the joins with node ids, Articulate high and medium,
anything you could not do. Then the director tells the story editor.
