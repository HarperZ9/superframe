<!-- writing-profile: research -->
# Quota drafts: dialogue audit (first pass, drafts in progress)

Voice director, 2026-10-21. Articulate 0.12.0 (latest release, source from tag v0.12.0; the plugin zip's
SHA-256 matched the published sum), run as
`articulate dialogue content/quota --voices design/voice-sheets/quota --min-lines 5 --gate`. The drafts were
being written while this ran; content hash of `content/quota/**/*.lwd` at the run: 0c7a9418e1ab811d.
Re-run on each new draft; the table below is Articulate's own output.

Reading, mine: 195 spoken lines, **0 epigram shapes**, gate passed. 54 lines are flagged only as "could
belong to anyone", 4 for sentence length. Pooled attribution over the 11 speakers with 5 or more lines:
51 of 177 lines, 0.29 (Wilson 95% interval about 0.23 to 0.36, treating lines as independent, which they
are not), against chance 0.09. The player characters are the least distinct: Ned 0.18 (0.08 to 0.36) and
Will 0.24 (0.12 to 0.42); Abel 0.07 (0.01 to 0.32) is near chance despite the strongest voice in the 4.1
sample. Two knowledge flags on the first run were my sheets' errors, not the lines', and the sheets are
corrected (Will's squad searched the hill in the draft; Edie knowing Bet from school is not knowing the
cells). Region markers are almost unused: the drafts carry people through words and stakes, not dialect.
Does not prove: a low epigram rate is not evidence the lines read as written by a person, and attribution
on 3 to 29 lines a speaker is thin.
## Articulate's report

195 spoken lines from 16 speakers. 56 lines carry at least one finding; 0 carry an epigram shape.

## Worst lines by score

Score is the sum of finding weights (epigram shapes and antithesis 2 to 3, knowledge leaks and never-words 3, register and length 1).

| # | Score | Speaker | Where | Line | Reasons |
|-:|-:|:-|:-|:-|:-|
| 1 | 2 | MARY | content/quota/q_dinner.lwd:51 | She said you stood up in front of the Commissioner and said two hundred and five. She said they're putting Krall's End under review, and it's you that's done... | sentence length outside 1 to 18 words (21); could belong to anyone: the true speaker ranks 11 of 11 (top guess HOLT) |
| 2 | 2 | MOTT | content/quota/q_ned.lwd:37 | Everyone's writing three hundred. Moor Holt wrote three-twenty. If I send in a hundred and ninety, they'll have me in that office in front of the Commissione... | sentence length outside 1 to 26 words (32); could belong to anyone: the true speaker ranks 7 of 11 (top guess TOMAS) |
| 3 | 1 | MARY | content/quota/q_dinner.lwd:19 | You're shovelling. Pass your grandad the salt, he can't reach. | could belong to anyone: the true speaker ranks 5 of 11 (top guess WILL) |
| 4 | 1 | ABEL | content/quota/q_dinner.lwd:39 | Your figure was low, I heard. | could belong to anyone: the true speaker ranks 4 of 11 (top guess HOLT) |
| 5 | 1 | NED | content/quota/q_dinner.lwd:40 | My figure was what the villages sent in. | could belong to anyone: the true speaker ranks 7 of 11 (top guess PASK) |
| 6 | 1 | ABEL | content/quota/q_dinner.lwd:41 | Krall's district sent in three hundred and forty. You sent in two-ninety. That's a man standing in the office with his hat in his hands next spring. | could belong to anyone: the true speaker ranks 5 of 11 (top guess TOMAS) |
| 7 | 1 | ABEL | content/quota/q_dinner.lwd:56 | It's what the Hesh left you. | could belong to anyone: the true speaker ranks 4 of 11 (top guess NED) |
| 8 | 1 | ABEL | content/quota/q_dinner.lwd:66 | You told him about the hill. | could belong to anyone: the true speaker ranks 4 of 11 (top guess MARY) |
| 9 | 1 | ABEL | content/quota/q_dinner.lwd:68 | Well, it's about time somebody in that room did. Now they'll go up and look. | could belong to anyone: the true speaker ranks 9 of 11 (top guess TOMAS) |
| 10 | 1 | ABEL | content/quota/q_dinner.lwd:75 | You know where the rest is. Up the hill in a hole under some old woman's goats. They've done it since my father's time. They don't think of it as stealing. T... | could belong to anyone: the true speaker ranks 10 of 11 (top guess TOMAS) |
| 11 | 1 | ABEL | content/quota/q_dinner.lwd:79 | I'm only saying. I'm fond of them. I had a Hesh lad worked for me two summers, Ilo, lovely lad, sang all day. I'd have trusted him with my life. Not with my ... | could belong to anyone: the true speaker ranks 7 of 11 (top guess ANNI) |
| 12 | 1 | MARY | content/quota/q_dinner.lwd:80 | They took Ilo's boy at the post this afternoon. Iris said. For carrying for the hill. | could belong to anyone: the true speaker ranks 5 of 11 (top guess PASK) |
| 13 | 1 | ABEL | content/quota/q_dinner.lwd:81 | Ilo's boy. Well. There you are, then. | could belong to anyone: the true speaker ranks 6 of 11 (top guess EDIE) |
| 14 | 1 | MARY | content/quota/q_dinner.lwd:94 | Then give it to Pell, he's growing. Go on, love. Somebody's got to eat it. There's people up that hill would kill for that plate. | could belong to anyone: the true speaker ranks 5 of 11 (top guess PASK) |
| 15 | 1 | NED | content/quota/q_dinner.lwd:102 | There was a cart at the post. The Haldanes. Ilo's. | could belong to anyone: the true speaker ranks 9 of 11 (top guess WILL) |
| 16 | 1 | NED | content/quota/q_dinner.lwd:104 | The girl was stood in the back counting the sacks off. Out loud. Four, she said. You've had four. Like she was keeping score for somebody. | could belong to anyone: the true speaker ranks 10 of 11 (top guess ANNI) |
| 17 | 1 | NED | content/quota/q_dinner.lwd:106 | And I'm stood there in my coat with the good pen. I signed for it, Dad. I sign everything. I'm very good at it. Ask anyone in the building, they'll tell you,... | could belong to anyone: the true speaker ranks 8 of 11 (top guess MARY) |
| 18 | 1 | NED | content/quota/q_dinner.lwd:108 | She's fourteen. Pell's age, near enough. | could belong to anyone: the true speaker ranks 8 of 11 (top guess MOTT) |
| 19 | 1 | WILL | content/quota/q_dinner.lwd:141 | Haldanes came down to the post today. From the barns. | could belong to anyone: the true speaker ranks 9 of 11 (top guess MARY) |
| 20 | 1 | EDIE | content/quota/q_dinner.lwd:142 | Bet Haldane? She sat next to me at the dame school. She had lovely writing. | could belong to anyone: the true speaker ranks 7 of 11 (top guess NED) |
| 21 | 1 | WILL | content/quota/q_dinner.lwd:153 | We had one today. Off the hill road. Captain says he's been carrying for them up there. | could belong to anyone: the true speaker ranks 4 of 11 (top guess HOLT) |
| 22 | 1 | WILL | content/quota/q_dinner.lwd:158 | He's nineteen. And he's half of them, whatever Bet is. You should have seen his wrist. They wear a thread. | could belong to anyone: the true speaker ranks 9 of 11 (top guess EDIE) |
| 23 | 1 | EDIE | content/quota/q_dinner.lwd:171 | Then that's good. Isn't that good? | could belong to anyone: the true speaker ranks 4 of 11 (top guess ABEL) |
| 24 | 1 | WILL | content/quota/q_dinner.lwd:172 | You don't know what Holt's like. You don't know anything about it. | could belong to anyone: the true speaker ranks 11 of 11 (top guess ABEL) |
| 25 | 1 | DAVEY | content/quota/q_dinner.lwd:180 | Sefa Tesk's not allowed to sit by the stove at school now. Mr Tamm moved him. Kenny says it's because he stinks. | sentence length outside 1 to 10 words (12) |
| 26 | 1 | WILL | content/quota/q_dinner.lwd:183 | Let him say it. It's only what they are. | could belong to anyone: the true speaker ranks 8 of 11 (top guess ABEL) |
| 27 | 1 | HOLT | content/quota/q_granary.lwd:19 | Krall's End. They've walked it. Eleven mile in that. | could belong to anyone: the true speaker ranks 10 of 11 (top guess NED) |
| 28 | 1 | WILL | content/quota/q_granary.lwd:66 | Militia. Sergeant Brack. Shut up a minute. Listen. The squad went through Krall's End on Saturday. Forty sacks. That's all there was. Forty. | could belong to anyone: the true speaker ranks 11 of 11 (top guess PASK) |
| 29 | 1 | WILL | content/quota/q_granary.lwd:67 | And Tuesday, up Tesk's hill. One and a half sacks of oats for the goats. There's no hole. There's no hole anywhere. I've had my arm in every bin on that hill. | could belong to anyone: the true speaker ranks 8 of 11 (top guess TOMAS) |
| 30 | 1 | HOLT | content/quota/q_granary.lwd:79 | One sack a family. Krall's End only. Against the review. Your names on it, not mine. | could belong to anyone: the true speaker ranks 8 of 11 (top guess PASK) |

## Distinctiveness per character

Blind attribution: a complement naive Bayes classifier trained on the other 4 of 5 folds names the speaker of each held-out line, among 11 speakers with 5 or more lines. Chance is 0.091. Intervals are Wilson 95%. The 5-line column scores blocks of 5 held-out lines at once. A score near chance means the voice is generic.

| Speaker | Lines | Per line | 95% interval | x chance | 5-line | Epigram lines |
|:-|-:|-:|:-|-:|-:|-:|
| HOLT | 16 | 0.56 | 0.33 to 0.77 | 6.2 | 1.00 | 0 |
| ANNI | 8 | 0.50 | 0.21 to 0.79 | 5.5 | 1.00 | 0 |
| MARY | 15 | 0.47 | 0.25 to 0.70 | 5.1 | 0.67 | 0 |
| GEDGE | 11 | 0.46 | 0.21 to 0.72 | 5.0 | 1.00 | 0 |
| MOTT | 10 | 0.30 | 0.11 to 0.60 | 3.3 | 0.00 | 0 |
| TOMAS | 17 | 0.29 | 0.13 to 0.53 | 3.2 | 0.33 | 0 |
| WILL | 29 | 0.24 | 0.12 to 0.42 | 2.6 | 0.20 | 0 |
| EDIE | 11 | 0.18 | 0.05 to 0.48 | 2.0 | 0.50 | 0 |
| NED | 28 | 0.18 | 0.08 to 0.36 | 2.0 | 0.40 | 0 |
| PASK | 18 | 0.17 | 0.06 to 0.39 | 1.8 | 0.33 | 0 |
| ABEL | 14 | 0.07 | 0.01 to 0.32 | 0.8 | 0.50 | 0 |

## Epigram-flagged lines per group

| Group | Lines | Epigram lines | Share | Any finding |
|:-|-:|-:|-:|-:|
| quota | 195 | 0 | 0.0% | 56 |

## Findings by check

| Check | Lines |
|:-|-:|
| generic | 54 |
| sentence-length | 4 |

## What this does not prove

Pattern hits and attribution scores locate lines to read. They do not prove a line is bad or a voice is good: a deliberate epigram is still flagged, and a character can be distinctive through one repeated tic.
