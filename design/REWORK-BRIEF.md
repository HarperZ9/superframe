<!-- writing-profile: procedure -->
# Rework brief: one district of Act 1

From the director, 2026-10-17. Private. Working folder `C:/dev/mission-control/2026-10-16-low-water/`.
The author asked for more ways through the game, more impact and more brevity (quoted in full at
the top of `design/REWORK-PLAN.md`). Word count is no longer a target. The measure is what a line
does; of two lines that do the same thing, the shorter wins.

## Read first

1. `design/REWORK-PLAN.md`, all of it. Your district's rows of the path matrix (section 3.1), the
   protected moments in your district (1.4), the town's appointment (1.3, item 1), the verbs (4),
   the equivalent facts (3.3) and fights that matter (7).
2. `design/WRITER-BRIEF.md` (house voice, registers, rules, clean-room) and `design/LWD1-FORMAT.md`.
3. `design/EDITOR-NOTES.md` if it exists: the independent story editor's notes. Apply any that
   name your district and that the director has accepted there.
4. Your district file as it stands, and its section of `content/act1/CROSSREFS.txt`.

## What to do

1. **Routes.** For each of your rows in the path matrix, make every listed route real in your file:
   a different thing to do in the world, with its own scene, its own price and its own interesting
   failure. Set the equivalent fact (3.3) the route earns. Keep the routes that exist.
2. **Verbs.** Write each world action as an option tagged with its verb so the engine can attach
   it to a spot later: `opt: "Throw the oilskin over the switch handle." -> weigh.scales.cover
   ? !has(ev.eave_wet) {verb: rig, noise: 0.2}`. Verbs: climb, wade, hide, douse, light, cutpower,
   pry, rig, salvage, read, eavesdrop, throw, carry, weigh, mark, wait. Noise is 0 to 1.
3. **The appointment.** From 01:00 your hub hints, briefly, at what the town has planned for the
   next dark (`var.appt`: cells, vote, search, oven, keel; `has(appt.known)`); at 02:50 your district
   plays its part if `appt` concerns it, and Lamb can stop it (`set(appt.stopped)`), join it
   (`appt.joined`) or watch it (`appt.watched`), by more than one style.
4. **Sags.** Fix the ones REWORK-PLAN 1.3 lists that touch your district: an instrument or voice
   that states the conclusion before the player makes it (let it give the reading; let Lamb
   conclude); the thesis said aloud; narration that explains its own image; endings that report.
5. **Protected moments.** Your district's moments from 1.4 must land at their peak in two lines or
   fewer. Read each aloud in context when you finish.
6. **Brevity pass** over the whole file: cut what explains, repeats or decorates. Keep the best
   lines.
7. **Articulate** (local only). Extract and check your district before and after:
   ```
   python content/tools/extract_prose.py content/act1 content/act1/.prose_<district>
   articulate check --mode literary-fiction/narrate --verbose content/act1/.prose_<district>/<district>.txt
   ```
   Read each high and medium finding and fix the line where the finding points at a real weakness
   (a contrast pair or corrective negation that explains, a cliché). Leave it where the pattern is
   the character's voice. Articulate names patterns; whether a line is good is your call.

## Keep

- Every beat, quest stage, Margin offer, page, lamp project, fight, run and shared entry node your
  district owns; every item in your CROSSREFS section; every check's failure node.
- Guards on traits compare words: `trait(m.body) == none`, never `!trait(...)` (the lint errors).
- The strippers setting is Act 2's; nothing in Act 1 reads it.

## Check

```
node content/tools/lwd1_lint.mjs content/act1/act1.lwd --file <district>.lwd
node game/engine/tools/validate.mjs content/act1/act1.lwd
node content/tools/crossrefs.mjs content/act1/act1.lwd
```
Lint and validator at 0 errors and no new warnings from your file; your CROSSREFS section keeps
every entry (new entries are fine). Back up your file first to
`content/act1/.orig2/<district>.lwd`. Use only district-prefixed scratch files. Write only your
one file.

## Report back

For each of your path-matrix rows: the routes now in the file, by style, with node ids. The
appointment beat. Each protected moment's peak, quoted (two lines or fewer). Articulate high and
medium counts before and after. New ids. Anything you could not do.
