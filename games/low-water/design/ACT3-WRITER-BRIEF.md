<!-- writing-profile: procedure -->
# Writer's brief: one district of Act 3

From the director, 2026-10-17. Private. Working folder `games/low-water/`.

## Read, in this order

1. `design/ACT3-PLAN.md` (draft 2): the question and turns, the night, the beats, **section 4 (the
   Shelf, Lamb's wages, the bent e, Pip, the letter that asked for the claim kept open)**, the
   districts, the path matrix (section 6), the endings (section 7), fights (section 8), the wreckers
   setting (section 9), protected moments.
2. `design/EDITOR-NOTES.md`, Part 5 (the structural read of the plan, all accepted) and pass 3's T1
   and T2: **brevity is a ceiling, not a goal; keep the second clause where a plain observation turns
   strange; keep the joke, the character detail, the consequence; no note-form fragments.**
3. `bible/WORLD-BIBLE.md` sections 2 and 7; `design/LWD1-FORMAT.md`; `design/ACT2-WRITER-BRIEF.md`
   (its "Write" and "Fights: the four ways through" sections apply in full).
4. `content/act3/rules3.lwd`, `world3.lwd`, `facts3.lwd`, `day2.lwd`, and the shared records they
   include (Act 1 and Act 2 rules, places, facts; `carried3.lwd` declares every Act 1 and Act 2
   district id, so read the Act 1 and Act 2 files of your district for what Lamb has done).

## Write

- One file: `content/act3/<district>.lwd` (replace the stub). New ids at the top under
  `# ---- new ids`, prefixed with your district. Hub `<district>.hub` with `hub: yes`; travel to the
  other Act 3 hubs (`quay3.hub`, `brine3.hub`, `weigh3.hub`, `mole3.hub`, `gut3.hub`, `hill3.hub`,
  `gasholder3.hub`, `ropewalk3.hub`, `oldlight.hub`).
- Your gates in the path matrix get all five routes, each a different thing to do in the gale, with
  its own price and an interesting failure; Eye routes turn knowledge into a cheaper or decisive act;
  Fist wins set the fact; no evidence is free; guises open scenes; verbs tagged `{verb: x, noise: n}`.
- **The gale** is in every outdoor scene: gusts, rain bands on the night's schedule (world3.lwd),
  spray, Cold, lanterns doused. Shelter matters. The eye (00:15 to 01:00) is calm and starlit.
- **The Record**: three nights of `said.*`, `struck.*`, `book.*`, `cause.*`, the Read, favour, lamp
  states, `light_*` (the three gale lamps chosen at Act 2's dawn), `var.lens`, `mole2_eye`,
  `gasholder_carries`, `gut2_steward`, `spit_way`, `spit_cargo`, `typist.heard`, `ink.crake` and the
  rest: react where it changes what Lamb can do or who will speak to Lamb.
- **The wreckers setting** (`act2_strippers`, hesk or town): write shared scenes once and differing
  lines with `{when: act2_strippers == hesk}` / `== town`.
- **Fights**: the Act 3 encounters in rules3.lwd; write their four outcome nodes in your file; talk
  exits and sneak variants exist for the set fights; add your own for any encounter you define.
- **Brevity ceilings** (not goals): narration share 55 percent or less, similes under 3.0 per 1,000
  words, one image per node, one voice per fight outcome, voices that tempt, argue and notice and
  never translate, no thesis spoken, no deduction stated twice. The peak of a protected moment in
  two lines or fewer.
- Lamb has no gender. No em dashes. Original writing only (clean team: never open the reference
  games or quarantine folders).

## Check

```
node content/tools/lwd1_lint.mjs content/act3/act3.lwd --file <district>.lwd
node game/engine/tools/validate.mjs content/act3/act3.lwd
python content/tools/brevity.py content/act3 <district>.lwd
python content/tools/extract_prose.py content/act3 content/act3/.prose_<district>
articulate check --mode literary-fiction/narrate --verbose content/act3/.prose_<district>/<district>.txt
```

Lint and validator at 0 errors apart from targets in Act 3 files not yet written. District-prefixed
scratch files only. Write only your file.

## Report back

Node and word counts, brevity numbers, each of your gates' five routes with node ids, each protected
moment's peak quoted, Articulate high and medium, new ids, and anything you need from another
district.

> Decided 2026-10-17 (author: "You decide"; coordinator decision): the strippers, and so the real wreckers on Night 3, are the town's own people. `act2_strippers` is fixed to `town` and the Hesk branch is removed from content. Read every Hesk-strippers passage above as superseded.
