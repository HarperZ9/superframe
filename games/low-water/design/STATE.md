<!-- writing-profile: research -->
# Low Water: state

Kept current by the director. Last updated 2026-10-17 (Act 1 fix pass and Act 2 edit pass complete).

## Written

| What | Where | State |
|---|---|---|
| World and story bible | bible/WORLD-BIBLE.md | Done (draft 1) |
| Production plan: references, targets, acts, cast, quests, endings, calendar, pacing, combat across the game, art and animation targets | design/PRODUCTION.md | Done; sections 8a, 10 and 11 added on 2026-10-16 |
| Full systems design and the crossover map, including the Fray (combat) | design/SYSTEMS-FULL.md | Done; section 18 added on the author's direction |
| Writer's format reference (the engine's LWD/1) | design/LWD1-FORMAT.md | Draft 2 |
| Engineer coordination | design/NOTES-FOR-ENGINEER.md | R1 to R16 built; combat requests C1 to C5 with the combat engineer |
| Act 1 plan, writer's brief, edit brief | design/ACT1-PLAN.md, WRITER-BRIEF.md, EDIT-BRIEF.md | Done |
| Act 1 content | content/act1/ (13 files) | **Written and edited.** 1,262 nodes, about 95,000 words |
| Act 2 proposal | design/ACT2-PROPOSAL.md | Approved by the author 2026-10-17 |
| Act 2 plan, briefs | design/ACT2-PLAN.md, ACT2-WRITER-BRIEF.md, ACT2-RETURNING.md, ACT2-EDIT-BRIEF.md | Done |
| Act 2 content | content/act2/ (21 files) | **Written and edited**: the interlude, ten districts, dawn2; 723 nodes |
| Camera, cast | design/CAMERA.md, design/CAST-SHEETS.md | Decided; cast sheets for every speaking part |
| Tools | content/tools/lwd1_lint.mjs, crossrefs.mjs | Working |

### Act 1 by file (lint word counts)

| File | Words | Nodes | Contents |
|---|---|---|---|
| quay.lwd | 15,004 | 225 | Prologue on the ferry, berth, Keel, Gorm's book, Crake's three calls, Fennick's blessing, the second blackout on the quay, high water, two fights |
| brine.lwd | 13,940 | 200 | Sabine, Wenna, the slate, the slow clock and Jory, the yard quarrel, the oven, Merrow at the stove, the room, the bench and wall, the Damp's hair, the Wet Hour and its brawl |
| weigh.lwd | 13,790 | 221 | The after-vote, the switch box, the office, the Pollard file, the midnight tube and provisional cause, the squall and the fight in the dark, the hammer |
| floor.lwd | 12,788 | 150 | The floor at low water, the prints, the fish, the drowned lamp and Merrow's five minutes, salvage, two runs, four fights |
| mole.lwd | 11,240 | 171 | The mole and stairs, the lamp room, the restrike, the green lens, the frost run, Keel and the hammer, the frost prints |
| gut.lwd | 12,627 | 159 | The Gut opening, the procession, the vote's older fish, Spratt, Shadwell, the twins, the loft, Marrow before dawn, the dogs |
| margin.lwd | 8,118 | 85 | Fourteen nodding pages, six small things, six chilled scenes |
| dawn.lwd | 3,373 | 29 | The verdict (six cause shapes), endings, the one colour, the town at first light, the Shelf's reply |
| rules, world, facts, combat | 4,172 | | The ruleset, places, night events, runs, facts, tools, opponents, encounters |

Checks, final pass: engine validator 0 errors, 0 warnings, 1,262 of 1,262 nodes reachable;
director lint 0 errors, 0 warnings; every cross-file dependency kept through the edit
(CROSSREFS.txt before and after). Twelve pages, each granted once whatever the route. Every
Margin note is offered somewhere; every quest stage can be set; every run, encounter and lamp is
used.

## Rework (author, 2026-10-17)

Plan: design/REWORK-PLAN.md. Act 1 rework done (all districts: five styles on every path-matrix row, the town's appointment at 02:50, Pip's tin at the midpoint, the editor's 34 notes applied). Validator 0/0 over 1,565 nodes, all reachable; lint 0/0. The interlude is written (content/act2/day.lwd). Act 2 in writing: four new districts by new writers, six returning districts by the Act 1 writers, dawn2 by the director.

Articulate, Act 1 before the rework (local `check`, mode literary-fiction/narrate, on the spoken
and narrated lines only):

| District | Words | High | Medium | High+Medium per 1,000 words |
|---|---|---|---|---|
| brine | 12,522 | 4 | 6 | 0.80 |
| dawn | 3,247 | 1 | 1 | 0.62 |
| floor | 11,745 | 3 | 6 | 0.77 |
| gut | 11,784 | 7 | 9 | 1.36 |
| margin | 7,880 | 3 | 5 | 1.02 |
| mole | 10,569 | 4 | 7 | 1.04 |
| quay | 14,019 | 8 | 7 | 1.07 |
| weigh | 12,761 | 7 | 1 | 0.63 |

79 high and medium findings; by rule: contrast pair 19, substitution 18, corrective negation 13,
cliché 11, cadence 6, antithesis 5, other 7. After-numbers will sit beside these.

After the rework, 2026-10-17 (all eight files reworked and the story editor's notes applied):

| District (Act 1 after rework) | Words | High | Medium | Low | High+Medium per 1,000 words | Texture | Verdict |
|---|---|---|---|---|---|---|---|
| brine | 13819 | 0 | 3 | 24 | 0.22 | 10 | flagged |
| dawn | 1883 | 0 | 0 | 5 | 0.0 | 0 | clean |
| floor | 12341 | 0 | 2 | 16 | 0.16 | 10 | flagged |
| gut | 13427 | 2 | 4 | 16 | 0.45 | 10 | flagged |
| margin | 7553 | 0 | 2 | 9 | 0.26 | 10 | flagged |
| mole | 13032 | 0 | 0 | 12 | 0.0 | 10 | clean |
| quay | 15766 | 1 | 3 | 20 | 0.25 | 10 | flagged |
| weigh | 15558 | 0 | 1 | 24 | 0.06 | 10 | flagged |

High and medium findings by rule: contrast-pair 8, corrective-negation 3, cadence 3, cliche 2, closer 1, register-jargon 1

From 79 to 21 high and medium findings. The extracted text grew from about 78,800 to 93,400 words because every obstacle gained routes (word count is not a target). Articulate names patterns; the editor's structural notes are tracked in design/EDITOR-NOTES.md.

### After the fix pass for the story editor's second read (2026-10-17)

Articulate, Act 1:

| District (Act 1 after fix pass) | Words | High | Medium | Low | High+Medium per 1,000 words | Texture | Verdict |
|---|---|---|---|---|---|---|---|
| brine | 11460 | 0 | 3 | 20 | 0.26 | 10 | flagged |
| dawn | 1870 | 0 | 0 | 5 | 0.0 | 0 | clean |
| encounters1 | 341 | 0 | 0 | 0 | 0.0 | 0 | clean |
| floor | 8878 | 0 | 2 | 11 | 0.23 | 10 | flagged |
| gut | 11639 | 2 | 4 | 15 | 0.52 | 10 | flagged |
| margin | 7371 | 0 | 2 | 9 | 0.27 | 10 | flagged |
| mole | 9857 | 0 | 0 | 12 | 0.0 | 10 | clean |
| quay | 13466 | 1 | 4 | 19 | 0.37 | 10 | flagged |
| weigh | 11760 | 0 | 2 | 23 | 0.17 | 10 | flagged |

High and medium findings by rule: contrast-pair 9, corrective-negation 3, cadence 3, register-jargon 2, cliche 2, closer 1

Brevity (narration share and similes; editor notes L6 and L4), Act 1. Before this pass narration
ran 46 to 72 percent and similes 3.6 to 6.3 per 1,000 words:

| File | Words in lines | Narration share | Similes | Similes per 1,000 |
|---|---|---|---|---|
| quay.lwd | 12017 | 48% | 23 | 1.91 |
| brine.lwd | 10085 | 33% | 22 | 2.18 |
| weigh.lwd | 10420 | 54% | 23 | 2.21 |
| floor.lwd | 7479 | 58% | 21 | 2.81 |
| mole.lwd | 8905 | 54% | 21 | 2.36 |
| gut.lwd | 10590 | 45% | 29 | 2.74 |
| margin.lwd | 7255 | 65% | 17 | 2.34 |
| dawn.lwd | 1760 | 74% | 4 | 2.27 |

### Act 2 first drafts (all ten districts, the interlude and dawn2)

| District (Act 2 first drafts) | Words | High | Medium | Low | High+Medium per 1,000 words | Texture | Verdict |
|---|---|---|---|---|---|---|---|
| brine2 | 2355 | 0 | 0 | 5 | 0.0 | 0 | clean |
| dawn2 | 1015 | 0 | 0 | 2 | 0.0 | 0 | clean |
| day | 1289 | 0 | 0 | 1 | 0.0 | 0 | clean |
| floor2 | 1428 | 0 | 0 | 2 | 0.0 | 0 | clean |
| gasholder | 4708 | 0 | 0 | 3 | 0.0 | 10 | clean |
| gut2 | 2877 | 0 | 0 | 4 | 0.0 | 10 | clean |
| hill | 5629 | 0 | 1 | 5 | 0.18 | 10 | flagged |
| mole2 | 3901 | 0 | 0 | 4 | 0.0 | 10 | clean |
| quay2 | 2418 | 0 | 1 | 3 | 0.41 | 10 | flagged |
| ropewalk | 5016 | 0 | 1 | 4 | 0.2 | 10 | flagged |
| rules2 | 179 | 0 | 0 | 0 | 0.0 | 0 | clean |
| spit | 4012 | 0 | 0 | 7 | 0.0 | 10 | clean |
| weigh2 | 2418 | 0 | 1 | 6 | 0.41 | 10 | flagged |
| world2 | 32 | 0 | 0 | 0 | 0.0 | 0 | clean |

High and medium findings by rule: register-jargon 2, cliche 1, contrast-pair 1

| File | Words in lines | Narration share | Similes | Similes per 1,000 |
|---|---|---|---|---|
| brine2.lwd | 2082 | 59% | 7 | 3.36 |
| dawn2.lwd | 954 | 62% | 3 | 3.14 |
| day.lwd | 1111 | 70% | 3 | 2.7 |
| floor2.lwd | 1217 | 86% | 4 | 3.29 |
| gasholder.lwd | 4282 | 68% | 3 | 0.7 |
| gut2.lwd | 2615 | 63% | 10 | 3.82 |
| hill.lwd | 4852 | 62% | 10 | 2.06 |
| mole2.lwd | 3507 | 78% | 11 | 3.14 |
| quay2.lwd | 2140 | 80% | 6 | 2.8 |
| ropewalk.lwd | 4420 | 73% | 6 | 1.36 |
| rules2.lwd | 179 | 68% | 0 | 0.0 |
| spit.lwd | 3583 | 74% | 10 | 2.79 |
| weigh2.lwd | 2127 | 85% | 5 | 2.35 |
| world2.lwd | 32 | 100% | 0 | 0.0 |

### Act 2 after its edit pass (2026-10-17)

| District (Act 2 after edit pass) | Words | High | Medium | Low | High+Medium per 1,000 words | Texture | Verdict |
|---|---|---|---|---|---|---|---|
| brine2 | 1826 | 0 | 0 | 3 | 0.0 | 0 | clean |
| dawn2 | 1072 | 0 | 0 | 2 | 0.0 | 0 | clean |
| day | 1289 | 0 | 0 | 1 | 0.0 | 0 | clean |
| floor2 | 838 | 0 | 0 | 2 | 0.0 | 0 | clean |
| gasholder | 3441 | 0 | 0 | 2 | 0.0 | 10 | clean |
| gut2 | 2115 | 0 | 0 | 2 | 0.0 | 10 | clean |
| hill | 4773 | 0 | 1 | 4 | 0.21 | 10 | flagged |
| mole2 | 2680 | 0 | 0 | 6 | 0.0 | 10 | clean |
| quay2 | 1550 | 0 | 0 | 2 | 0.0 | 10 | clean |
| ropewalk | 3336 | 0 | 0 | 2 | 0.0 | 10 | clean |
| rules2 | 179 | 0 | 0 | 0 | 0.0 | 0 | clean |
| spit | 2918 | 0 | 0 | 2 | 0.0 | 10 | clean |
| weigh2 | 1734 | 0 | 1 | 3 | 0.58 | 10 | flagged |
| world2 | 32 | 0 | 0 | 0 | 0.0 | 0 | clean |

High and medium findings by rule: register-jargon 1, contrast-pair 1

| File | Words in lines | Narration share | Similes | Similes per 1,000 |
|---|---|---|---|---|
| day.lwd | 1111 | 70% | 3 | 2.7 |
| quay2.lwd | 1261 | 44% | 1 | 0.79 |
| brine2.lwd | 1553 | 42% | 1 | 0.64 |
| weigh2.lwd | 1436 | 54% | 3 | 2.09 |
| mole2.lwd | 2284 | 55% | 3 | 1.31 |
| gut2.lwd | 1853 | 47% | 4 | 2.16 |
| floor2.lwd | 627 | 60% | 1 | 1.59 |
| hill.lwd | 3996 | 54% | 10 | 2.5 |
| gasholder.lwd | 3015 | 45% | 2 | 0.66 |
| ropewalk.lwd | 2740 | 55% | 0 | 0.0 |
| spit.lwd | 2489 | 55% | 3 | 1.21 |
| dawn2.lwd | 1011 | 63% | 3 | 2.97 |

Every Act 2 district is at or under its narration target and under 3.0 similes per 1,000 words.
The interlude (70 percent) and dawn2 (63 percent) are narration by design: one is a walk through a
town in colour, the other a meeting described from the floor. Act 2 validates with 0 errors over
723 nodes, all reachable, and 0 warnings when run with the carried Act 1 state
(`node game/engine/tools/validate.mjs content/act2/act2.lwd --carry content/act1/act1.lwd`: 488
flags and 69 variables carried); the director's lint with the same --carry shows 0 and 0.

### Act 3, The Gale (2026-10-17, first drafts complete)

Plan: design/ACT3-PLAN.md (draft 2, on the story editor's structural read). Written: the second
daylight page (day2), nine districts (quay3, brine3, weigh3, mole3, gut3, hill3, gasholder3,
ropewalk3, the Old Light) and dawn3; joins in design/ACT3-JOINS.md. World events settle the
wreckers' target (03:55) and the collier (04:05) wherever Lamb is. Validator with Act 1 carried:
568 nodes, all reachable, 0 errors; its 29 warnings are flags set in Act 2 (the validator carries one
act at a time). About 24,000 words of spoken and narrated text.

| District (Act 3 first drafts) | Words | High | Medium | Low | High+Medium per 1,000 words | Texture | Verdict |
|---|---|---|---|---|---|---|---|
| brine3 | 2179 | 0 | 0 | 2 | 0.0 | 10 | clean |
| dawn3 | 1353 | 0 | 1 | 3 | 0.74 | 11 | flagged |
| day2 | 766 | 0 | 0 | 2 | 0.0 | 0 | clean |
| gasholder3 | 3889 | 0 | 0 | 3 | 0.0 | 10 | clean |
| gut3 | 2438 | 0 | 0 | 4 | 0.0 | 0 | clean |
| hill3 | 3022 | 0 | 1 | 7 | 0.33 | 10 | flagged |
| mole3 | 2868 | 0 | 0 | 4 | 0.0 | 10 | clean |
| oldlight | 1390 | 0 | 0 | 3 | 0.0 | 0 | clean |
| quay3 | 1483 | 0 | 1 | 5 | 0.67 | 1 | flagged |
| ropewalk3 | 2462 | 0 | 0 | 4 | 0.0 | 0 | clean |
| rules3 | 85 | 1 | 1 | 0 | 23.53 | 19 | flagged |
| weigh3 | 1907 | 0 | 0 | 1 | 0.0 | 0 | clean |
| world3 | 295 | 0 | 0 | 0 | 0.0 | 0 | clean |

High and medium findings by rule: contrast-pair 2, register-jargon 1, cliche 1, corrective-negation 1

| File | Words in lines | Narration share | Similes | Similes per 1,000 |
|---|---|---|---|---|
| day2.lwd | 650 | 69% | 3 | 4.62 |
| quay3.lwd | 1193 | 55% | 3 | 2.51 |
| brine3.lwd | 1931 | 50% | 4 | 2.07 |
| weigh3.lwd | 1623 | 54% | 4 | 2.46 |
| mole3.lwd | 2425 | 55% | 6 | 2.47 |
| gut3.lwd | 2141 | 53% | 4 | 1.87 |
| hill3.lwd | 2629 | 55% | 7 | 2.66 |
| gasholder3.lwd | 3485 | 51% | 8 | 2.3 |
| ropewalk3.lwd | 2147 | 51% | 6 | 2.79 |
| oldlight.lwd | 1200 | 55% | 0 | 0.0 |
| dawn3.lwd | 1190 | 85% | 0 | 0.0 |

The daylight page and dawn3 are narration by design, as in Acts 1 and 2.

## Playable

- The one-hour slice (LWD/0) in the Phase 3 prototype: `node game/serve.mjs`, http://127.0.0.1:8731/.
- Act 1 validates on the engine's LWD/1 runtime and can be played path by path in the terminal
  (`node game/engine/tools/quick.mjs`) and in the graph viewer. **Not yet done:** a full play from
  the ferry to the dawn cause in the game shell, with the Fray's set fights, the walkable areas
  wired to the plates, and the character art. Those belong to the engineer, the combat engineer
  and the character lead.

## Open: presentation notes for whoever owns the prototype next

From the polish agent's Phase 3 handoff and the coordinator, 2026-10-16.

1. On the quay, figures standing together merge into one shape. Decided 2026-10-17: the camera comes closer (design/CAMERA.md).
2. Deacon Fennick's black and white does not read at quay distance. Answered by the closer camera.
3. The talk panel covers the right third of every room. Decided: the camera slides left by a third while talking (design/CAMERA.md).
4. The interiors' baked crowds (the Guild in the weigh-house) are dark blocks behind the people.
5. Pacing: answered in design (PRODUCTION.md 8a).

## Playthrough status (2026-10-17)
All five builds and 20 random seeds (intent-driven, shuffled menus) finish all three acts after pass 4. Lamb always chooses dry (boat, launch or road) or wet (the Brine, plus keeper, typist or post when earned). The collier needs a leading mark and is usually lost by players who ignore Keel. Waiting on the editor's fifth read. Events that need Act 1 lamp projects stay unfired until the harness drives projects.

## Decision: the collier's leading-mark rule (2026-10-17, decided by testing)
Target (coordinator): an attentive player who acts on Keel's line saves the Ellen Varty most of the time; a random player mostly does not.

Round 1. The rule was Mother, or steps post plus balance, or hill plus Old Bulb. Engineer's attentive policy saved the collier in 2 of 25 runs, no better than plain play. My scratch attentive driver (in the scratchpad, not shipped) saved it 1 time in 12 when defending Mother. The causes were upstream: the balance was never lit in Act 1, so that pair was never offered; the bulb needs a narrow Act 2 ending; and Mother was usually lost at the mole.

Changes:
1. Old Light: a lantern hung in the Old Light during the eye marks the Spit by itself. It is planted by Act 1's 22:20 ferry, and Keel's second-dawn line now names it.
2. Act 1 balance: two easier routes. Hang your own storm lantern from the beam, or a CONDOLENCE check (DC 5) to get Hobb to bring the weigh-house lamp up. The wick-and-paraffin project stays.
3. Act 2 dawn: the steps post and the balance can be chosen whatever Act 1 did, on the Board's oil (Keel: "oil for three lamps"). Act 1 work still shows in Fennick's and Hobb's lines. One leading-mark pair is therefore always on offer.
4. B6 at the mole: lamp-room actions now pass through the arrival check, so the wreckers come while Lamb is in the room (a bug). There is a "Sit by the panel" wait, and a new Shadow route: THE DARK, DC 5, stand behind the lens so the beam blinds the door. Defence routes per style: Fist, the gallery fight; Tongue, FORM LETTER or HEARSAY; Shadow, the lens; Hands, the key, jumper or bar; Eye, the Glass wait.

Round 2, harness of record (systems engineer, NOTES 04:54Z, game/engine/tools/out/collier-summary.txt; content as of 04:48Z):
| Players | Collier through |
|---|---|
| Random, attentive (seeds 1 to 20) | 20 of 20 |
| Random, plain (seeds 1 to 20) | 9 of 20 |
| Builds, attentive | 4 of 5 |
| Builds, plain | 4 of 5 |
In the attentive saves, what held at 04:05 was mostly the steps-and-balance pair (17), then Mother (5) and hill-and-bulb (2). These numbers replace my scratch-driver figures.

Decision: the rule stands as loosened (Mother, or either pair, or the Old Light lantern; steps and balance always on offer at the second dawn).

Limits:
- No run measured the Old Light lantern on its own. The attentive player always had a pair or Mother already, or missed the eye's window.
- Plain random saves 9 of 20, nearer half than "rarely". Accepted: the steps-and-balance pair is now always on offer, and the town often picks it.
- The one attentive loss, the Eye build, checked 2026-10-17. It kept Mother, hill and bulb. Hill and bulb went out at the 03:30 band because they were never tended; the Eye spent the evening on the mole. At 03:30 it had failed the Glass wait (DC 4), held no Spit names, failed FORM LETTER (DC 6), and the harness then chose "Stand aside" over the gallery fight. Verdict: mostly a fair loss. The upper pair needs tending in an earlier band if Lamb means to be on the mole at 03:30, and the Eye's checks failed. Two follow-ups: (1) a second Eye route was added, a claim "Open the Daybook at their names, and read them out" when the Spit names are held, which ends as wreck.waited; (2) an attentive player should not stand aside when a loss3.mother scene is one choice away (reported to the engineer as a policy point).

## Decision: the strippers are the town's own (2026-10-17)
The author handed the decision over ("1. You decide."). The coordinator's decision: the Act 2 strippers, and so Night 3's real wreckers, are Gullet's own people. That means Sallis and the Board's wardens with Pruett, Boddy, Hask and the Penroses, plus Lugg where Act 2 breaks him on screen (he leads when Lamb blamed the Low Company in Act 1). Why: whatever Lamb writes becomes a fact the town must live under. The Board invented wreckers on Night 1, and the claim turning neighbours into wreckers pays off that spine. Strangers from Hesk would make the climax outside villainy (the editor's A5).
Done in content: `act2_strippers` is fixed to `town`. 58 Hesk-only lines were removed and 77 conditions simplified across 11 files. The Hesk captain's character record is removed, and `spit_lead` defaults to sallis. Hesk stays as a place, the gale warnings, the paper's crossword and the Hesk run. The turn is earned on screen in a new scene, `quay2.muster`: at the mole steps Sallis reads the claim from the Courier to six neighbours, "So whoever's out on the Spit tonight is the persons. And the Shelf pays for what the persons take." Young Penrose picks up a crowbar because his father has. Lamb can speak (FORM LETTER) and changes nothing but the words. Backups are in content/.pre-strippers/. Validator 0/0 on all acts.

## Build layer (2026-10-17)
Section 19 of SYSTEMS-FULL is approved and placed: one sheet with four combat pillars, 21 tools each with its own moveset, special and fittings, four benches, 14 teachers across the acts, min-maxing support, and a placement table in 19.13. Engine work is with the combat and systems engineers (NOTES-FOR-ENGINEER). Gate pages are waiting on the systems engineer: either the engine pays them, or content adds page(1) at each gate.

## Decision: the page economy (2026-10-17)
The pace is set by what builds need. A committed build reaches a compartment at 8 by mid Act 2 and at 10 by late Act 3, which with a chapter raise every fourth page (archetypes start the main compartment at 5) means 12 and 20 pages; every third brought 10 by the end of Act 2, too early. Measured with the corrected gates, the five builds end the acts at 10 to 15, 17 to 22 and 23 to 34 pages, so every build meets both targets. Why this mechanism and not two-page wins, a cheaper rank or a 44-page target: SYSTEMS-FULL 19.4.

## Decision: talkers earn the talk exit with words and held ground (2026-10-17)
Problem (combat engineer's measure): a talk exit in a fight needed a landed blow, Standing 4 and 2 Composure, and Composure filled only from catches and landed blows. Tongue was offered the strippers' exit in 4 of 6 fights and could pay in 2; Hands paid in none. A talker had to earn the right to talk by hitting people, which cuts against the play styles the author asked for.
Decision:
1. **Content.** No talk exit requires a landed blow alone. Each exit that read `fight_struck >= 1` now reads `fight_struck >= 1 | fight_seconds >= 10` (11 exits across the three acts): ten seconds of holding ground earns the word. Exits written as "only if no blow was struck" (the warrant, the station's tea, Rook's witness, Brine word) are unchanged, as is Keel's sit, which needs the struggle.
2. **Engine (combat engineer to build and measure).** Composure also fills from words and held ground: each blow blocked, caught or sidestepped without striking back fills it, and so does a HAT voice's bark. A talk exit costs 2 Composure, or 1 when HAT is 4 or more.
Why words and held ground rather than only a cheaper cost: a cheaper cost still leaves Hands and Tongue unable to earn the first point without striking. Filling from held ground lets every style that stands its ground talk, and HAT makes it cheaper, so the charisma build is the best at it.
Measured after the build (combat engineer, b9df09c; e.strippers, 6 seeds): Tongue talks out in 6 of 6 fights (it was 2, with 4 down), and Hands can pay in 5 of 6. The manner voices' fight lines are written (words.condolence, formletter, chit, hearsay in content/act1/barks.lwd). Ropewalk strand: fair play still wins 37 of 40; the strongest kiter falls from 20 to 17 wins and stumbles 18 times.

## Ropewalk hazards (2026-10-17)
The strand down the walk (rope, rect 6.5 2.7 18.5 3.1) and the coil of telegraph wire under the Vane's post (net, at 10.4 0 1.2, r 0.8) are authored in content/ropewalk/place.json under terrain.hazards. The Act 2 Ropewalk sets them down in one line: "a strand lies between the old rope posts, laid out for twisting and never twisted, and under the post by the telegraph office a coil of dead wire". Measured before authoring (combat engineer): a kiter trips, fair play rarely does. The quay pieces stay out.

## Resume point (director, 2026-10-17, wrap-up)
Branch: dev (shared). Last director commit: 9c18121. All three acts validate 0/0 (Act 1 1,652 nodes, Act 2 758, Act 3 592).
Done this session: editor passes 4 and 5 answered; build layer (SYSTEMS-FULL 19, 21 tools, gear.lwd); gates corrected and insights1/2/3 (chapter page every fourth); interrogations (section 20, interrog1/2.lwd, a press for every style, lies catchable by one fact per route, signposts so every style reaches 4 or more of 6); Act 1 area wiring with marks restaged; fight barks and sneak cues (barks.lwd, variants per key); held-ground talk exits; Ropewalk strand and coil.
Open, in order:
1. Wenna's and Hobb's lies are not caught on the attentive routes: give those routes an earlier catch fact.
2. Editor: a read of section 20's interrogations, and of the gear and teacher scenes for voice.
3. Areas for Acts 2 and 3 are not yet wired.
4. Author still to read: strippers decision (made by the coordinator), collier rule, page economy.

## Next

1. A first full play of Act 1 in the shell when the areas, combat and art land; time Movement I
   against PRODUCTION 8a and adjust node costs before cutting content.
2. Read-through by someone who has not read the script.
3. The author's decisions on ACT2-PROPOSAL.md, then the Act 2 plan.
