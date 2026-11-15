<!-- writing-profile: research -->
# Voice audit

Audit of 2671 spoken lines from 38 files under `content/act1` to `content/act3`, run
2026-10-21 with Articulate 0.11.0 (release v0.11.0, commit ad368ed), the first release
with `articulate dialogue`. Read-only: no file under `content/` was
changed. The content was read at Low Water commit b3aa67b with 18 content files carrying
uncommitted edits at the time; SHA-256 of the files read, in path order: `33d81d15ce4ef969`.
Hidden folders such as `content/.pre-pass5` were skipped.

Voice sheets are drafts in `design/voice-sheets/`, one per speaker in `design/voice/profiles.json`,
built from `bible/WORLD-BIBLE.md` sections 7 and 8 and the `never` rules in `profiles.json`. The
voice director owns them; every knowledge, register and length finding below is only as right as
those sheets. Re-run with:

```
articulate dialogue content --voices design/voice-sheets --markdown design/VOICE-AUDIT.md
```

## Headline

- Epigram shapes are rare: 12 of 2671 lines (0.45%). The public-domain calibration set
  runs 0.10 to 0.48 percent for Shaw, Chekhov, Twain and Dickens and 1.60 percent for Wilde, who
  writes epigrams on purpose. Low Water sits in the naturalistic band. The line the author
  rejected on 2026-10-21 is still in the script and is the top-scoring line
  (`content/act3/hill3.lwd:321`, Crake).
- 191 lines (7.2%) carry a pattern or voice-sheet finding. The largest groups are
  sentence length against the sheets (97, mostly Wenna, whose bible
  entry says short sentences), Gorm statements where the bible says she speaks only in questions
  (29), closing zingers (25) and contrast
  pairs (17).
- Distinctiveness is the weak point for the player and the minor cast. Mean per-line attribution is
  0.42 against chance 0.032 over 31 speakers. Keel
  (0.96) is the easiest to pick, almost entirely
  through "the Board". The lowest: LAMB 0.01, MAB 0.08, PELLOW 0.12, LUGG 0.14, NOLL 0.19, HESTER 0.22.
  Lamb, the player's mouth, is at chance: Lamb's lines carry no voice of their own.
- Region markers are thin. The Gullet sheets list "I'll not", "you'd not", "'em", "slack" and a few
  idioms; Wenna uses one in 5% of her lines, Marrow
  14%, Sabine 14%. The
  bible's people sections describe accents the lines do not yet show.
- 4 keyword knowledge leaks: three Keel lines name "bottle glass"
  (the bible says he suspects the green lens; whether he should say the words is the story lead's
  call), and Shadwell names the Brine's bread oven and the bottles, which bible 7.6 makes Sabine's
  secret. Keel also says "I" in 3 lines; check whether each break
  from "the Board" is deliberate.

Scores and flags say where to look. They do not say a line must change: the writer and the voice
director decide. The profile's recall on model-written dialogue has not been measured (there is no
labelled set of model-written game dialogue yet), so a low epigram rate does not show the script
reads as written by a person. It shows only that these named shapes are rare. Lamb's player
options (`opt:` labels) are not read; only Lamb's `line:` entries are.

2671 spoken lines from 42 speakers. 561 lines carry at least one finding; 12 carry an epigram shape.

## Worst lines by score

Score is the sum of finding weights (epigram shapes and antithesis 2 to 3, knowledge leaks and never-words 3, register and length 1).

| # | Score | Speaker | Where | Line | Reasons |
|-:|-:|:-|:-|:-|:-|
| 1 | 6 | CRAKE | content/act3/hill3.lwd:321 | You want me wicked. Wicked is cheap; you could hang it. I am arithmetic. Hang the arithmetic, and see who climbs those stairs for nothing. | two short clauses balanced on a semicolon (Wicked is cheap; you could hang it.); an abstraction defined in a few words (I am arithmetic.) |
| 2 | 5 | CRAKE | content/act2/hill.lwd:425 | A lamp that has been moved once should not be moved twice in a week. That is not a confession, assessor. That is maintenance. | an abstraction defined in a few words (That is maintenance.); ends on a short aphoristic sentence (That is maintenance.) |
| 3 | 4 | SHADWELL | content/act1/gut.lwd:863 | The Brine fired her bread oven at eight tonight. I smelled it go east over the weigh-house, wind still in the west. She burns bottles in it, I think. Smells ... | mentions what the character should not know: the prism casting is Wenna's, Sabine's and Fennick's secret (bible 7.1, 7.6) (bread oven); could belong to anyone: the true speaker ranks 12 of 31 (top guess MARROW) |
| 4 | 4 | KEEL | content/act1/mole.lwd:1003 | Because if anybody counts them, there is no claim, and no lens, and no light, and there is a woman of sixty-four in the dock at Hesk for six years of bottle ... | sentence length outside 1 to 40 words (45); mentions what the character should not know: Keel suspects the green lens but does not know the oven (bible 7.2) (bottle glass) |
| 5 | 4 | FENNICK | content/act1/quay.lwd:850 | I did not say the sea made it. I said the sea returned it. | contrast pair (one affirms, the next negates) (I did not say the sea made it. I said the sea returned it.); could belong to anyone: the true speaker ranks 9 of 31 (top guess GORM) |
| 6 | 4 | CRAKE | content/act3/hill3.lwd:329 | Yes. It is wrong. I can mend arithmetic, assessor. I cannot mend a character, not at sixty. Which would you rather I had? | contrast pair (one affirms, the next negates) (I can mend arithmetic, assessor. I cannot mend a character, not at sixty.); sentence length outside 2 to 28 words (1) |
| 7 | 4 | HESTER | content/act3/ropewalk3.lwd:459 | They don't want the truth, assessor. They want somebody to have it. Up the line somewhere, in a room, with a lamp. I'm the room. | contrast pair (one affirms, the next negates) (They don't want the truth, assessor. They want somebody to have it.); could belong to anyone: the true speaker ranks 13 of 31 (top guess HOBB) |
| 8 | 3 | WENNA | content/act1/brine.lwd:425 | You've not seen any slate. You've seen Sabine's back. | contrast pair (one affirms, the next negates) (You've not seen any slate. You've seen Sabine's back.) |
| 9 | 3 | COCKLE | content/act1/brine.lwd:1007 | The gully had shut eleven minutes before. I was on the steps with a lantern, shouting. You can't shout eleven minutes. | ends on a short aphoristic sentence (You can't shout eleven minutes.); could belong to anyone: the true speaker ranks 10 of 31 (top guess MERROW) |
| 10 | 3 | SORLE | content/act1/brine.lwd:2362 | In Kell a man can be poor among kin. Here a man can be free among creditors. I have seen both. I go home poorer and I sleep. | 'In A ... here ...' comparison (In Kell a man can be poor among kin. Here a man can be free among creditors. I have see...) |
| 11 | 3 | SORLE | content/act1/brine.lwd:2372 | Thank you. In Kell that would be a debt. Here, I suppose, it is a transaction. | 'In A ... here ...' comparison (Thank you. In Kell that would be a debt. Here, I suppose, it is a transaction.) |
| 12 | 3 | GORM | content/act1/dawn.lwd:289 | Name: H. Lamb. Just H, it says. | ends on a statement; this character speaks only in questions (Name: H. Lamb. Just H, it says.); could belong to anyone: the true speaker ranks 11 of 31 (top guess HOBB) |
| 13 | 3 | GORM | content/act1/dawn.lwd:294 | The Shelf proved Mrs Tallow never left the Brine. | ends on a statement; this character speaks only in questions ( proved Mrs Tallow never left the Brine.); could belong to anyone: the true speaker ranks 23 of 31 (top guess SPRATT) |
| 14 | 3 | GORM | content/act1/dawn.lwd:296 | The Shelf talked its way past the guard on the mole. | ends on a statement; this character speaks only in questions (lked its way past the guard on the mole.); could belong to anyone: the true speaker ranks 17 of 31 (top guess KEEL) |
| 15 | 3 | GORM | content/act1/dawn.lwd:301 | The Shelf warned the Low Company about the cells. | ends on a statement; this character speaks only in questions ( warned the Low Company about the cells.); could belong to anyone: the true speaker ranks 8 of 31 (top guess KEEL) |
| 16 | 3 | GORM | content/act1/dawn.lwd:304 | A light in the Board's office after hours. | ends on a statement; this character speaks only in questions (light in the Board's office after hours.); could belong to anyone: the true speaker ranks 31 of 31 (top guess KEEL) |
| 17 | 3 | GORM | content/act1/dawn.lwd:309 | The Shelf watched the search from a doorway. Badly. | ends on a statement; this character speaks only in questions (atched the search from a doorway. Badly.); could belong to anyone: the true speaker ranks 26 of 31 (top guess SABINE) |
| 18 | 3 | GORM | content/act1/dawn.lwd:310 | The Shelf watched the cells. Badly. | ends on a statement; this character speaks only in questions (The Shelf watched the cells. Badly.); could belong to anyone: the true speaker ranks 9 of 31 (top guess HOBB) |
| 19 | 3 | GORM | content/act1/dawn.lwd:313 | The Shelf came off the weigh-house drainpipe. | ends on a statement; this character speaks only in questions (helf came off the weigh-house drainpipe.); could belong to anyone: the true speaker ranks 23 of 31 (top guess SPRATT) |
| 20 | 3 | GORM | content/act1/dawn.lwd:315 | The Shelf tried the Board's office latch. | ends on a statement; this character speaks only in questions (he Shelf tried the Board's office latch.); could belong to anyone: the true speaker ranks 17 of 31 (top guess KEEL) |
| 21 | 3 | GORM | content/act1/dawn.lwd:317 | The Shelf tried to slip past the guard on the mole. | ends on a statement; this character speaks only in questions (ried to slip past the guard on the mole.); could belong to anyone: the true speaker ranks 17 of 31 (top guess KEEL) |
| 22 | 3 | DILLY | content/act1/floor.lwd:1726 | You went down. Gulls did that. I'll not tell anyone. I'll tell everyone. | contrast pair (one affirms, the next negates) (I'll not tell anyone. I'll tell everyone.) |
| 23 | 3 | LUGG | content/act1/gut.lwd:1391 | I was looking at the ship. Not at the hole. You look at forty people about to drown, Shelf. You don't look at a lantern. | contrast pair (one affirms, the next negates) (You look at forty people about to drown, Shelf. You don't look at a lantern.) |
| 24 | 3 | TOBIT | content/act1/interrog1.lwd:429 | Mrs Sabine says Mr Merrow's at her stove, wet to his middle, and he's not saying where from. She says you'd want to know. She says don't say she said. | contrast pair (one affirms, the next negates) (She says you'd want to know. She says don't say she said.) |
| 25 | 3 | WENNA | content/act1/mole.lwd:742 | He's got her eye in a box on the hill, a bit at a time, and forty people in jars saying their prayers to it. She'd laugh, if she knew. She doesn't know. That... | ends on a short aphoristic sentence (That's the whole mercy of a lamp.); sentence length outside 1 to 12 words (25) |
| 26 | 3 | KEEL | content/act1/mole.lwd:1069 | The Board is doing it for the town, Mrs Tallow, of which you are, the Board would remind you, a part. A part that will be in the dock at Hesk by Lady Day, fo... | mentions what the character should not know: Keel suspects the green lens but does not know the oven (bible 7.2) (bottle glass) |
| 27 | 3 | KEEL | content/act1/mole.lwd:2005 | The Board has been counted. The Board had not expected to be counted tonight. The Board had expected to do the counting. | contrast pair (one affirms, the next negates) (The Board has been counted. The Board had not expected to be counted tonight.) |
| 28 | 3 | KEEL | content/act1/quay.lwd:770 | Bottle glass. In the Gullet Head Light. Has the Shelf been inside the lens? With a light? No? Then the Shelf has a story, and the Board has a lamp. | mentions what the character should not know: Keel suspects the green lens but does not know the oven (bible 7.2) (bottle glass) |
| 29 | 3 | FENNICK | content/act1/quay.lwd:782 | Ambrose Fennick. Deacon. You will have heard that we pray to a broken bulb. We do not say it broke. We say it was opened. | contrast pair (one affirms, the next negates) (We do not say it broke. We say it was opened.) |
| 30 | 3 | FEWELL | content/act1/quay.lwd:1610 | Twenty years, and nobody's once asked what I write. I write the weather, mostly. Nobody reads the weather. | ends on a short aphoristic sentence (Nobody reads the weather.); could belong to anyone: the true speaker ranks 10 of 31 (top guess GORM) |

## Distinctiveness per character

Blind attribution: a complement naive Bayes classifier trained on the other 4 of 5 folds names the speaker of each held-out line, among 31 speakers with 20 or more lines. Chance is 0.032. Intervals are Wilson 95%. The 5-line column scores blocks of 5 held-out lines at once. A score near chance means the voice is generic.

| Speaker | Lines | Per line | 95% interval | x chance | 5-line | Epigram lines |
|:-|-:|-:|:-|-:|-:|-:|
| KEEL | 162 | 0.96 | 0.92 to 0.98 | 30.1 | 1.00 | 0 |
| GORM | 144 | 0.81 | 0.73 to 0.86 | 25.2 | 0.82 | 0 |
| FENNICK | 146 | 0.71 | 0.63 to 0.78 | 22.2 | 1.00 | 1 |
| MARROW | 231 | 0.69 | 0.63 to 0.75 | 21.7 | 0.89 | 0 |
| PENHALLOW | 41 | 0.68 | 0.53 to 0.80 | 21.3 | 1.00 | 0 |
| SABINE | 164 | 0.65 | 0.58 to 0.72 | 20.4 | 0.94 | 0 |
| FISK | 73 | 0.60 | 0.49 to 0.71 | 18.8 | 1.00 | 0 |
| SHADWELL | 30 | 0.60 | 0.42 to 0.75 | 18.8 | 0.67 | 0 |
| HOBB | 100 | 0.58 | 0.48 to 0.67 | 18.1 | 0.90 | 1 |
| ROOK | 59 | 0.54 | 0.42 to 0.66 | 16.9 | 0.91 | 0 |
| CRAKE | 118 | 0.48 | 0.40 to 0.57 | 15.1 | 0.78 | 5 |
| GAUZE | 44 | 0.48 | 0.34 to 0.62 | 14.9 | 0.75 | 0 |
| WENNA | 174 | 0.46 | 0.39 to 0.53 | 14.4 | 0.88 | 1 |
| DILLY | 31 | 0.45 | 0.29 to 0.62 | 14.1 | 0.67 | 0 |
| SALLIS | 109 | 0.43 | 0.34 to 0.53 | 13.5 | 0.71 | 0 |
| COCKLE | 90 | 0.38 | 0.28 to 0.48 | 11.8 | 0.67 | 0 |
| MERROW | 141 | 0.35 | 0.28 to 0.44 | 11.1 | 0.68 | 0 |
| ASH | 29 | 0.34 | 0.20 to 0.53 | 10.8 | 0.60 | 0 |
| STRAND | 32 | 0.34 | 0.20 to 0.52 | 10.7 | 0.67 | 0 |
| PIP | 89 | 0.34 | 0.25 to 0.44 | 10.5 | 0.88 | 0 |
| SPRATT | 135 | 0.31 | 0.24 to 0.39 | 9.7 | 0.37 | 0 |
| BRIGHT | 42 | 0.31 | 0.19 to 0.46 | 9.7 | 0.88 | 0 |
| TEAGUE | 28 | 0.29 | 0.15 to 0.47 | 8.9 | 0.40 | 0 |
| COE | 21 | 0.24 | 0.11 to 0.45 | 7.4 | 0.50 | 0 |
| FEWELL | 26 | 0.23 | 0.11 to 0.42 | 7.2 | 0.60 | 1 |
| HESTER | 67 | 0.22 | 0.14 to 0.34 | 7.0 | 0.77 | 0 |
| NOLL | 36 | 0.19 | 0.10 to 0.35 | 6.1 | 0.43 | 0 |
| LUGG | 74 | 0.14 | 0.07 to 0.23 | 4.2 | 0.29 | 0 |
| PELLOW | 25 | 0.12 | 0.04 to 0.30 | 3.8 | 0.60 | 0 |
| MAB | 38 | 0.08 | 0.03 to 0.21 | 2.5 | 0.29 | 0 |
| LAMB | 103 | 0.01 | 0.00 to 0.05 | 0.3 | 0.00 | 1 |

## Epigram-flagged lines per group

| Group | Lines | Epigram lines | Share | Any finding |
|:-|-:|-:|-:|-:|
| act1 | 1369 | 7 | 0.5% | 304 |
| act2 | 728 | 2 | 0.3% | 118 |
| act3 | 574 | 3 | 0.5% | 139 |

## Findings by check

| Check | Lines |
|:-|-:|
| generic | 404 |
| sentence-length | 97 |
| questions | 29 |
| closing-zinger | 25 |
| contrast-pair | 17 |
| epigram-maxim | 8 |
| register | 5 |
| knowledge-leak | 4 |
| contractions | 3 |
| never-pattern | 3 |
| epigram-here | 2 |
| epigram-definition | 2 |
| theme-statement | 1 |
| epigram-semicolon | 1 |

## What this does not prove

Pattern hits and attribution scores locate lines to read. They do not prove a line is bad or a voice is good: a deliberate epigram is still flagged, and a character can be distinctive through one repeated tic.

## Calibration reference

| Source | Lines | Epigram shape |
|:-|-:|:-|
| Shaw, Pygmalion | 998 | 0.10% |
| Shaw, Arms and the Man | 747 | 0.13% |
| Chekhov, The Sea-Gull (tr. Fell) | 621 | 0.32% |
| Chekhov, Plays, Second Series (tr. West) | 2282 | 0.48% |
| Twain, Huckleberry Finn | 1393 | 0.29% |
| Dickens, Great Expectations | 2578 | 0.23% |
| Wilde, The Importance of Being Earnest | 876 | 1.60% |

All public domain in the United States, read from Project Gutenberg. Method and intervals are in
Articulate's `docs/dialogue.md`. Attribution scores fall as the cast grows, so compare a character
with chance and with this cast; do not compare these numbers with the plays' casts.
