<!-- writing-profile: procedure -->
# Edit brief: cutting one district of Act 1 to length, in one voice

From the director, 2026-10-16. Private. Working folder `C:/dev/mission-control/2026-10-16-low-water/`.

Act 1 came in at about 133,600 words against a target of 60,000 to 80,000. With the fights the
author added after the target was set, the revised Act 1 target is **85,000 to 95,000 words**. Each
district file is cut to its own target below. The writing is good; the job is to make every line
earn its place, so the best of it is easier to find.

| File | Now (lint words) | Target |
|---|---|---|
| quay.lwd | 22,600 | 14,000 |
| brine.lwd | 20,800 | 14,000 |
| weigh.lwd | 21,400 | 13,500 |
| floor.lwd | 18,000 | 12,500 |
| mole.lwd | 16,800 | 11,000 |
| gut.lwd | 18,400 | 12,500 |

## Read first

1. `design/WRITER-BRIEF.md` (the quality bar and rules still apply in full, including the
   clean-room rule and "write only your one file").
2. `bible/WORLD-BIBLE.md` section 2 (house voice) and section 7 (registers).
3. `design/ACT1-PLAN.md`: your district's beats (section 6), fights (11), conventions (12).
4. `content/act1/CROSSREFS.txt`: your file's section lists every flag, var and node other files
   depend on. **Every one of them must survive**: keep the node, keep the `set(...)` or assignment
   reachable on at least one route.
5. Your district file, all of it, before cutting anything.

## What to cut, in this order

1. **Voice lines that restate** what a line or narration just gave, or that another voice in the
   same beat already said. Target: no more than two voices in a beat as a rule, three at a peak
   moment. Keep both a high (`dc`) and a low (`below`) line only where the low one is a different,
   funnier or sadder scene; otherwise keep one.
2. **Return-visit greetings and near-duplicate `.again` nodes.** One short `.again` per person,
   changed by what has happened, is enough.
3. **Alternates that differ only in wording.** Where three openings or reactions exist for
   conditions that rarely differ in play, keep the best one or two.
4. **Narration that explains a joke or a feeling** after the image already carried it. The house
   voice notices; it does not explain.
5. **Whole optional scenes that change nothing** (what the player knows, what someone thinks of
   Lamb, what the town looks like, what Lamb can do next). The writers' own suggestions:
   - quay: the walk-on Lamplighter chatter beyond one line each, repeated Keel menu returns
   - brine: the six brawl openings (keep two), a third of the voice lines, the return greetings
   - weigh: the Hobb, roof and quiet-reaction nodes
   - floor: the Low Night walkers (keep the best two), the second fish rulings
   - mole: the six provisional-cause-reaches-the-mole nodes (keep one), the beam-sweep nodes
     (keep one), the lantern copy of the lens reading
   - gut: the overrun beyond the combat addendum: thin lane encounters, repeated SMELL ecstasies
     (keep the best), duplicate hall reactions

## What never to cut

- Any beat ACT1-PLAN section 6 or 11 gives your district; any quest stage, Margin offer, page
  (`xp`) or lamp project your district owns; any shared entry node (WRITER-BRIEF table); any
  item in your CROSSREFS section.
- Every check's failure node (failure stays interesting).
- The provisional-cause reactions in your hub (keep at least a short one per cause).
- The best lines. When in doubt, cut the line around a good line, not the good line.

## One voice

- `nar:` is the assessor's report: third person, itemised, exact, fond. One grotesque image per
  beat. Unpatterned sentence lengths. Nothing built to land.
- Registers stay as they are (they are already consistent across files: Keel as the Board, Gorm
  only in questions, Merrow never asks, Lugg whispers, Sabine prices, Marrow's fish).
- No em dashes; no "genuinely", "really", "truly", "actually".

## Check your work

```
node content/tools/lwd1_lint.mjs content/act1/act1.lwd --file <district>.lwd
node game/engine/tools/validate.mjs content/act1/act1.lwd
```

The lint must show 0 errors for your file. The engine validator may show only the known
`unknown function fight()` errors and fight-related dead ends and unreachable nodes; no new error
or warning may come from your edit. Re-run `node content/tools/crossrefs.mjs content/act1/act1.lwd`
and confirm your section has not lost an entry (compare with CROSSREFS.txt). Edit in place in
several passes; keep a copy of the original as `content/act1/.orig/<district>.lwd` before you
start (create the folder if needed; use your district name in any scratch file).

## Report back

Words before and after, nodes before and after, what you cut by category, anything you could not
cut without losing a beat, and any line you restored because cutting it hurt.
