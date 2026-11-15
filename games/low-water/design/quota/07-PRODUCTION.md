<!-- writing-profile: research -->
# The Quota, 7: production

Part of [QUOTA-DESIGN.md](../QUOTA-DESIGN.md). The vertical slice first, then the milestones to Steam.
No dates (proposals are hand-off kits, not timers).

## The vertical slice: one famine day in the Upper Town (era 2)

**What it is.** Day 41 of the famine winter, about 30 minutes, with a coda a week later. Two classes
playable, to prove class gating: the Inspector line (Ned Furrowe) and the Militia line (Will Brack).

| Piece | In the slice |
|---|---|
| Wide lens | Exchange Square from the bell tower at dawn: the relief queue, the export train with Halvard's sacks under guard, the burial ground's new rows |
| Narrow lens | The Haldane table, morning and the coda (five bowls, then four) |
| The community model, small | Three streets (Exchange Square, Mill Street, Haldane Yard), three households (Haldane, Furrowe, Brack), eight rules (R2 requisition, R3 export, R4 price, R5 entitlement, R8 theft, R9 policing, R11 school, R17 rhetoric) |
| The record entering | The figure the player reports at the district office (true, inflated, or blamed on Hesh hoarding) |
| One dinner | The Furrowe table (the 4.1 sample) for the Inspector; the Brack table for the Militia |
| One perspective pair | "The requisition": the road post turning back the Haldane cart (Militia plays it from the post; the Inspector meets it from the cart's side) |
| One story fight | The granary door, against the Requisition Captain, with the talk-out on the true figure |
| Portrait dialogue boxes | For Ned, Mary, Pell, Abel Furrowe, Will Brack, Tomas, Anni Haldane, the Captain |
| The coda | A week later, the Haldane table, and the read-back of the day (a short version of pillar 5) |

**Success criteria** (set before building, so the result can change a decision):
1. Both classes play start to end with validator 0 errors, `eventcheck` 0 unfired, `exitcheck` clean,
   `clocklint` 0, tests green.
2. The reported figure changes the coda's table, and `communitycheck` prints the chain from the report
   to the bowl with each delay.
3. Every spoken line passes `articulate dialogue` with 0 epigram shapes and the gate passed.
4. The square in the wide lens holds 16.7 ms frames with its crowd, on a quiet machine.
5. A seat test with one or two people who haven't read the design: at the coda, can they say why the
   bowl is missing, without being told?

## Milestones to Steam

| Milestone | Done when |
|---|---|
| M1 the slice | The criteria above pass |
| M2 era 2 complete | All six classes, the district meeting, both perspective pairs of era 2, the granary door, the lore fragments of era 2 |
| M3 eras 1 and 3 | The census hinge, the harvest supper, allocation, the shift table, the schoolbook |
| M4 eras 4 and 5 | The closure, the clip, the clearance fight, the read-back, the world record across runs, the arena reskin |
| M5 content complete | Playtest rounds 1 and 2 of STEAM-READINESS.md section 1; audio in; the sensitivity read done and acted on |
| M6 release | The native shell and the Deck spike; saves on disk; the rating (design/RATING.md); achievements; the store assets; the author's Steam steps |

## Who owns what

| Owner | Owns |
|---|---|
| Story lead | The words: every scene, dinner, perspective pair, lore fragment and the read-back's prose; the dialogue standard |
| Voice director | Voice sheets for the new cast; voice tags; the read-back's flat voice; the slur rule in voice |
| Gameplay engineer | The community model, record events, the world record, `communitycheck`, `lorecheck`, the run ledger, class routes, the arena reskin's data |
| Rendering lead | Region and interior plates per era and state; impostor crowds; the lens transition; prop states; the arena's two venues |
| Performance engineer | The crowd budget in the wide lens; figure cost with portraits; the 16.7 ms gate |
| Head sculptor | Faces for the new cast on the old heads; child and old-age variants; era dress with the costume lead |
| Game director | Structure and payoff, the model's rules, the budget, this design |

## The content list (internal: for the rating survey and the sensitivity read)

Not shown to players. The author, 2026-10-22: "the big warning is too much. Let people come to their own conclusions." The rating comes from the rating process in design/RATING.md, and the store page carries what that process produces. This list is the source for the survey answers and the sensitivity read's brief.

Famine and starvation; epidemic disease (typhus, dysentery, hunger oedema), and the death of children from disease; the persecution of a people, forced removal and ethnic cleansing, mass death by famine used as a weapon, genocide and its denial; the accusation that a people poisoned the wells; violence against civilians, including children (shown on screen, author direction 2026-10-22); the death of a child in custody; a parent made to sign against his own people;
domestic violence and abuse, shown on screen; torture; sexual violence (coercion, the act's violence and aftermath; no sexual content or nudity); racism, xenophobia and religious hatred, spoken in
full; slurs, both invented and real; homophobia and transphobia; police violence; drug addiction and
overdose; alcoholism; mental illness; suicide and self-harm if any scene carries them; grief.

## The sensitivity read

As the author decides. Recommended scope: trans, Muslim, Jewish, Black, immigrant and rural-poor readers
(the author's list); descendants of the famines the anchors draw on (Ukrainian, Kazakh, Bengali and
Chinese readers); readers with lived experience of addiction and of domestic violence. Before M2.

## Decisions only the author can make

1. Final names: the country, the peoples, the faiths, the town.
2. Whether real slurs for groups that exist as themselves appear in the slice, or wait until the
   sensitivity read.
3. The sensitivity read: scope and who arranges it.
4. The foreign grain buyer (Halvard), decided yes in QUOTA-DESIGN.md; confirm or overrule.
5. Archiving the Gullet content in place (`content/.gullet/`).
6. Who makes the sound: there is no audio role yet.
7. The Steam steps in STEAM-READINESS.md section 9.

## The slice briefs (one per agent, to forward)

**Story lead.** Write the slice: day 41 of the famine winter in Edrin's Upper Town, era 2, about 30
minutes plus a coda a week later. Two classes: the Inspector line (Ned Furrowe) and the Militia line
(Will Brack). Scenes: the morning in each trade; the district office where the player reports a figure
(true, inflated, or blamed on Hesh hoarding); the Furrowe dinner (start from the 4.1 sample) and a Brack
dinner; the perspective pair "the requisition" (the road post and the Haldane cart); Tomas Haldane at the
inspector's door; the granary door's talk-out on the true figure; the coda at the Haldane table; a short
read-back of the day. Bars: DIALOGUE-STANDARD (3a confession), VOICE-CALIBRATION v2, the slur rule, the
handling rules; every spoken line through `articulate dialogue` with the gate passed. Design:
design/QUOTA-DESIGN.md and design/quota/.

**Voice director.** Voice sheets and tags for the slice's cast: Ned, Mary, Pell and Abel Furrowe; Will
Brack and his family; Tomas, Aaron and Anni Haldane; the Requisition Captain; the district chairman Jonah
Krall. Each sheet from design/quota/02-HOUSEHOLDS.md (wound, lie, trade). Set the read-back's flat voice.
Run `articulate dialogue --voices` on the story lead's drafts and report attribution and epigram
findings.

**Gameplay engineer.** Build the community model at slice scale (design/quota/04-SYSTEMS.md): three
streets, three households, rules R2, R3, R4, R5, R8, R9, R11 and R17, new LWD records `@street`,
`@household`, `@rule`, `@carrier`, a daily tick, record events from the reported figure, and
`communitycheck` printing each chain with its delays. Extend the reckoning with a victim and a street.
Wire class gating for two classes and the granary door as a story fight using the arena's warden boss
pattern. Gates: validator, eventcheck, exitcheck, clocklint, tests, and a test that the reported figure
changes the coda's table.

**Rendering lead.** Plates for the slice: Exchange Square as a wide region plate from the bell tower
(dawn, with states for queue length and the export train), the Haldane Yard interior (morning and coda
states, five bowls and four), the Furrowe kitchen, the Brack kitchen, the district office, the road post,
and the granary door at night. Impostor crowds driven by the street stocks (painted per state, or glyph
crowds). The ink-blot transition as the move between lenses. Consider re-dressing the weigh-house
interior as the exchange if it fits.

**Performance engineer.** Hold 16.7 ms on the wide square with its crowd and the export train, on a quiet
machine, and on the granary-door fight with the Captain, two guards and a crowd of villagers. Set the
crowd budget for the wide lens (how many full figures, how many impostors) and report it. Measure the
cost of portraits in the talk panel.

**Head sculptor.** Faces on the old heads for the slice's cast, with each person's exaggerated feature:
Ned Furrowe (the good hat's line on the forehead), Abel, Mary, Pell; Will Brack; Tomas, Aaron and Anni
Haldane (half-Hesh, the braid), the Requisition Captain. Start a child variant (Anni at fourteen, Pell)
and an old-age variant (Abel). Era 2 dress with the costume lead: dark wool for the Tarn, felt and the
blue wrist thread for the Hesh.
