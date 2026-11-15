<!-- writing-profile: research -->
# Painted portrait appeal test (P1)

Written 2026-10-21 by the rendering lead, before any viewer saw a stimulus. Committed on its own so the
commit date shows it came first. Nothing here changes after the first viewer result; a change needs a
new dated section that says what changed and why. Method as characters/heads-test/PROTOCOL.md
(amendments 2 and 3): pairwise choices by fresh viewers, Wilson 95 percent intervals, pass lines first.

## The decisions it informs

1. Which heads go into the painted dialogue box: the old parametric heads or the sculpted heads (R3
   frozen set, selected by `LW_SCULPTED_HEADS=1`), both painted by the second-pass portrait painter
   (`game/engine/paint/portrait/`). Owner: rendering lead, with the coordinator.
2. Whether the second-pass painter replaces the first pass (commit 2b92356). Owner: rendering lead.

Baseline: the box uses the old heads (the in-world default since R3). Change trigger: task S below.

## Stimuli

`render/appeal/draw.py` from portraits baked by `game/engine/paint/tools/portraits.mjs` at 640 x 800,
moods neutral, warm, angry and grieving (the voice bible's portraitCue at intensity 3), resized to
161 x 201 (the talk panel at 720p) and set side by side on the panel's dark ground, sides at random.
Files go to a folder outside the repository under random hex names; nothing in a name, path or image
says which is which.

- **Task S (sculpted against old, same painter).** Per viewer 12 people drawn at random from the 36
  with bodies. Per person three questions: S1, neutral pair: which reads more like a real person?
  S2, the same pair: which would you rather talk to in a game? S3, a second pair in one mood drawn at
  random from warm, angry and grieving: which shows the emotion more clearly?
- **Task P (painter control: second pass against first pass, old heads, neutral).** Per viewer 8
  people drawn at random: which looks more like a painting a person made? This checks the check: a
  viewer pool that cannot tell the two painters apart cannot be trusted to judge heads under paint.

## Viewers

Fresh agents, one round each, no context from this work: they receive only their instructions and the
list of image paths, open the images with the Read tool and use no other tool. Seeds 601 to 603. They
are not told which is old or new, or that either is a revision. Answer per item: LEFT or RIGHT.

## Scoring and pass lines (pooled over three viewers)

- S1, S2, S3: the share of choices for the sculpted portrait (36 each), Wilson 95 percent interval.
- P: the share for the second-pass painter (24), Wilson 95 percent interval.
- **P passes** when its lower bound is above 0.5. If P fails, task S is reported but decides nothing.
- **Sculpted heads go into the box** when P passes and the lower bounds of S1 and S2 are both above
  0.5. **Old heads stay** when P passes and the upper bounds of S1 and S2 are both below 0.5. Any
  other result keeps the baseline (old heads) and is reported as undecided. S3 is reported; it does
  not decide.
- Per-item answers are published with the people in each pair (unblinded after scoring), in
  `render/appeal/results/`.

## What this does not prove

Viewers are models reading images, not players; they share a model family with the builder. Three
viewers is small. One camera angle, one light. A win says the portraits read better at panel size to
this pool; it does not say they are good enough, or how either head reads at play size.

## Amendment 1, 2026-10-21, after P1 and before any P2 stimulus

**What happened.** P1 failed its control: the second-pass painter was chosen 6 of 24 times (0.25, Wilson
0.12 to 0.45) as "more like a painting a person made" against the first pass. The viewers named the first
pass's looser, more varied brushwork. P1 stays reported as a failure; nothing in it is rescored.

**What changed before P2.** The painter keeps the second pass's eyes, neck correction and value design and
gives back the brushwork: the finest layer dropped, the remaining layers placed only where the error is
larger, more broken colour, stronger relief, a lighter ground, and an iris that cannot glow (a defect seen in
P1's stimuli on a few old heads).

**P2.** A new round with three fresh viewers, seeds 611 to 613, new draws, stimuli rebaked with the changed
painter. Tasks P, S1 and S2 as written above (S3 is dropped: it never decides, and P1 measured it). Pass
lines and the decision rule unchanged. No P2 result feeds back into the painter; a failure stays reported.
