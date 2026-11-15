<!-- writing-profile: research -->
# Blind distinctness test for the sculpted heads

Written 2026-10-21, before any new head was sculpted and before any viewer saw anything. Committed
on its own so the commit date shows it came first. Nothing here changes after the first viewer
result arrives; a change would need a new dated section that says what changed and why.

## The claim under test

Every face used to come from one parametric head with a narrow range, so the cast read as one
person. The claim is that the sculpted heads (ART-DIRECTION 7.1) make each person a different
person by the face itself, and that each face fits what the cast sheets say about it.

## Stimuli

Made by `characters/heads-test/stimuli.mjs` from the cast records through the portrait path
(gbuffer, the painter, relight), camera as the portraits (yaw 34, elevation 6, view height 0.8 m).

- **Face image.** Only the mesh part named `head` is drawn: the sculpted face, its hair and beard,
  and the neck. Hats, collars, mufflers, costume and props are hidden. Cropped to the head part's
  screen box padded by 8 percent, placed on a flat grey ground, 256 x 320. Four expressions
  (neutral, wary, startled, set) in two lights (paraffin, sodium).
- **Full portrait.** The baked portrait as the talk panel shows it (neutral, paraffin), 256 x 320.

Files go to a folder outside the repository under random hex names. Nothing in a name, a path or
the image says who it is.

## Viewers

A viewer is a fresh agent started for one round with no context from this work: it receives only
its instructions, the list of image paths and, for tasks B and C, the descriptions. It is told to
open the images with the Read tool and to use no other tool. Each viewer gets its own random draw
(seeded). Viewers are never reused across rounds.

## Tasks

- **A, same or different.** 24 pairs per viewer: 12 of the same person, 12 of two different
  people, in random order and random sides. Every pair is one paraffin image and one sodium image,
  and a same-person pair always shows two different expressions, so a match by light, colour cast
  or expression does not answer it. People: everyone with a body and a portrait (36). The Whelk
  twins, Mab and Noll, are never paired as different people (they are written as twins).
  Answer per pair: SAME or DIFFERENT, with confidence 1 to 3.
- **B, face to description.** 12 items per viewer. One face image (neutral, paraffin) and five
  descriptions labelled A to E: the person's own `face` line from `descriptions.json` and four
  others drawn at random from the rest of that file. Answer: one letter. Chance is 0.2.
- **C, full portrait to description.** 8 items per viewer, as B but with the full portrait and the
  `full` lines. Chance is 0.2.

`descriptions.json` was frozen with this protocol, from the cast sheets' own words, before any
head existed. People without a head description in the sheets are not in tasks B and C.

## Rounds

- **R0, control.** The heads as they were at commit 63a61b5 (the one parametric head), rendered
  with the same stimulus script before any code changed. Three viewers, seeds 301 to 303. This
  checks the check: if the control passes task A, the test is measuring something other than the
  face, and the result means nothing.
- **R1, development.** The new heads, three viewers, seeds 101 to 103. The heads may be changed
  after this round. R1 is not reported as the result.
- **R2, confirmation.** Before R2 the head records are frozen: the commit hash and the SHA-256 of
  each head record file are written into `results/R2-freeze.json`. Three new viewers, seeds 201 to
  203, new draws. Nothing is changed after R2 to improve its numbers. R2 is the reported result,
  pass or fail.

## Scoring and pass lines (R2, pooled over its three viewers)

- Task A: accuracy with its Wilson 95 percent interval. Pass when the interval's lower bound is at
  least 0.70 and the point estimates for same-person pairs and for different-person pairs are each
  at least 0.70 (a viewer who always answers DIFFERENT scores 0.5 overall and fails).
- Task B: top-1 accuracy with its Wilson interval. Pass when the lower bound is above 0.20.
- Task C: as B.
- Per-item scores are published for every pair and item: the people in it (unblinded after
  scoring), each viewer's answer and confidence.

Results go to `characters/heads-test/results/` as JSON with the viewer's raw reply, and a summary
in `characters/PROGRESS.md`.

## What this does not prove

The viewers are models reading images, not players; they share a model family with the builder,
so they are independent of this work's context but not of its training. Three viewers per round is
small, and each sees a different draw. The faces are seen from one camera angle only. Passing says
the faces differ and fit their descriptions at portrait size; it does not say they are good, or
that they read at play size, where the head is about 20 pixels tall and silhouette and costume
carry the person. The contact sheets in `game/capture/heads-2026-10-21/` are there for the author's
own eye.

## Amendment 1, 2026-10-21, after R0 and before any result on the new heads

**What happened.** R0, the control on the old one-parametric head, passed every pass line: task A
67 of 72 (0.93, Wilson 95 percent 0.85 to 0.97; same pairs 34 of 36, different pairs 33 of 36),
task B 25 of 36 (0.69), task C 22 of 24 (0.92). The viewers said what they used: neck length and
thickness, the hair blob, beards and moustaches, skin colour, and in C the costume. By the rule
above, tasks A to C as written measure something other than the face, so a pass on the new heads
would mean nothing. They are still run and reported in R1 and R2 as written, as the brief asked.

**What is added.** Two tasks on the face itself, with R0 rerun on them as the control (R0b, three
new viewers, seeds 311 to 313) before R1 is scored:

- **Face core image.** From the same head-only renders, a crop centred between the eyes and the
  mouth, sized to the person's own eye spacing (width 3.4 times the distance between the eye
  centres, height 1.25 times the width), so head size, neck, crown, hair line and ears fall
  outside it; converted to grey and stretched to the same contrast, so skin colour and the light's
  colour do not answer it. Eye and mouth centres are read from the G-buffer of the same render
  (the pixels of the eye and lip materials), by `heads-test/landmarks.mjs`.
- **A2, same or different on the face core.** As task A (24 pairs, 12 same, every pair across
  the two lights, same pairs across two expressions), face core images.
- **D, how many people.** Four grids per viewer, each six face cores of six different people
  (random, neutral expression, the light chosen at random per image). The viewer answers how
  many different people it believes the grid shows, 1 to 6. The truth is always 6. Score: the
  mean answer divided by 6.

Pass lines for the new heads (R2, pooled): A2 as task A (Wilson lower bound at least 0.70, same
and different each at least 0.70). D: R2's mean count above R0b's, with the two 95 percent
intervals (a t interval over the twelve grids of each round) not overlapping. If R0b itself passes
A2, A2 is reported as non-discriminating and D carries the claim.

## Amendment 2, 2026-10-21, after the coordinator's review of R2 and before any rework

**Why.** R2 measured telling people apart, not whether the faces are good. Looking at the 512 px
sheet, the coordinator found several new heads worse than the old: eyes lost in dark sockets, long
thin necks, Wenna skull-like, Marrow lumpy, Keel grey, mouths as blobs. An appeal test is added
and distinctness is rerun, in a new confirmation round R3 on reworked and frozen heads.

**Appeal task E (pairwise, old against new).** Panel size as the player sees it at 720p: the baked
portrait resized to 161 x 201 on the panel's ground, the old portrait (commit 63a61b5, as shipped,
`game/capture/heads-2026-10-21/before/portraits`) against the new one of the same person, sides at
random. Per viewer, 12 people drawn at random from the 36, and for each person three questions:
- E1, neutral portraits in paraffin: which reads more like a real person?
- E2, the same pair: which would you rather talk to in a game?
- E3, a second pair of the same person, both in one expression drawn at random from wary, startled
  and set, in paraffin: which shows the emotion more clearly?
The viewer is not told which is old or new, nor that one is a revision. Answer per question: LEFT or
RIGHT. Score: the share of choices for the new portrait, per question, pooled over three viewers
(36 choices each), with its Wilson 95 percent interval.

**R3.** Heads reworked, then frozen with file hashes in `results/R3-freeze.json` before any viewer
sees them. New stimuli. Three fresh viewers for E (seeds 401 to 403) and three for A2 and D (seeds
421 to 423). No R3 result feeds back into the heads; if R3 fails, a later round is a new round with
new viewers, and R3 stays reported.

**Pass lines for R3.** E1, E2 and E3 each: the Wilson lower bound of the new portrait's share above
0.5. A2 as before (lower bound at least 0.70, same and different each at least 0.70). D: the mean
fraction's interval above the control's (R0b: 0.726 to 0.830). All three must hold.

**Known confound.** The old portraits were lit with the old paraffin rig and the new with the new
one; the comparison is of the portraits as each was shipped, which is what a player sees.

**Rules added to the validator before the rework (not a test result, a gate).** Proportions inside
human ranges unless the sheet names the exaggeration and its reason: neck radius against jaw width,
the eye line near mid-head, the visible neck against head height; and a render check of each face at
portrait and panel size: eye white and iris area per eye, brow pixels, and an open eye (not a black
socket). The thresholds are written in `forge/headkeys.mjs` and `proto/heads_check.mjs` before any
R3 stimulus is made.

## Amendment 3, 2026-10-21, after R3

R3 failed the appeal task: the new portrait was chosen 8 of 36 times on E1 and E2 and 10 of 36 on
E3 (Wilson 95 percent upper bounds 0.38, 0.38 and 0.44); distinctness held (A2 69 of 72, D 0.97 of
six). The viewers named stretched or mushroom-shaped heads, bulging or glowing eyes, long necks, and
small features that do not read at panel size; the old heads' bold brow bars and big noses read.
Penhallow, Marrow and Orme won every pair; Lugg, Noll and Spratt lost all nine. R3 stays reported as
a failure. R4 is a new round on reworked and frozen heads, same tasks and pass lines, fresh viewers,
seeds 501 to 503 (E) and 521 to 523 (A2 and D), freeze in `results/R4-freeze.json`. Nothing from R3
is rerun or rescored.
