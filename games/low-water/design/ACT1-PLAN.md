<!-- writing-profile: research -->
# Act 1, Low Night: the plan

Draft 1, 2026-10-16. Private. The beat sheet, the shared ids and the schedules for Act 1. It is the
brief every writer of a district reads after the bible (`bible/WORLD-BIBLE.md`), the systems
(`design/SYSTEMS-FULL.md`) and the format (`design/LWD1-FORMAT.md`). The common records it names
are already written in `content/act1/rules.lwd`, `world.lwd` and `facts.lwd`; use their ids and do
not redefine them. If a district needs a new fact, flag, item or var, define it in the district's
own file under a `# ---- new ids` heading, prefixed with the district.

## 1. The question and the shape

Act 1 asks **whose fault is the dark?** Lamb arrives at 22:41 on the ferry that nearly struck the
Spit and has until 06:10 to send a cause up the Shelf's tube. Three movements:

| Movement | Clock | Weather | What it is for |
|---|---|---|---|
| I. The Floor Is Open | 22:41 to 00:00 | Clear, then fog 23:20, light rain 23:35, SW wind | The slice, deepened: the six principals, the floor and the drowned lamp while the tide allows, the fish, the first evidence. Ends with the tube: a provisional cause |
| II. Weather | 00:00 to 03:30 | Rain, heavy 01:30 to 02:40; fog thickest 03:00; blackout 02:50 to 03:20 | The provisional cause travels as rumour and people act on it. The Gut opens at 00:40. The room above the Brine. The Wet Hour. Crake rings again. The second blackout |
| III. Frost | 03:30 to 06:10 | Rain clears 04:10, 1 °C, frost; high water 05:10; dawn 06:00 | Keel climbs to Mother with a hammer. The frost keeps his prints. Dawn and the cause |

Target length: 6 to 8 hours of first play; 60,000 to 80,000 words in all.

## 2. Files and owners

| File | District | Places | Owner |
|---|---|---|---|
| `act1.lwd` | root | `@meta`, includes | director |
| `rules.lwd` | all | ruleset: compartments, voices, Kit, modifiers, meters, Margin notes, precedents, items, fits, lamps, factions, vars, quests, characters | director |
| `world.lwd` | all | places, districts, areas, night events, hazards, runs | director |
| `facts.lwd` | all | every evidence fact and shared flag | director |
| `quay.lwd` | Lamp Quay | `quay`, `steps`, `harbour`, `mole_steps` (the ferry), `ferry` | writer |
| `brine.lwd` | The Brine | `brine`, `yard`, `oven`, `room` | writer |
| `weigh.lwd` | The Weigh-house | `weigh_out`, `weigh_in`, `office`, `tube`, `roof` | writer |
| `floor.lwd` | The Floor | `floor`, `gully`, `drowned`, `fish` | writer |
| `mole.lwd` | The Mole and Mother | `mole`, `stairs`, `lamproom`, `gallery` | writer |
| `gut.lwd` | The Gut | `gut`, `hall`, `smokehouse`, `loft`, `gutter` | writer |
| `margin.lwd` | everywhere | nodding pages, small things, chilled scenes | writer |
| `dawn.lwd` | Weigh-house and quay at dawn | the verdict, six endings, the Shelf's reply | director |

Hubs: every district has a hub node `<district>.hub` with `hub: yes`. Travel options in each hub:

| From | To | Condition | Minutes |
|---|---|---|---|
| quay.hub | brine.hub, weigh.hub, mole.hub | always | 1 |
| quay.hub | floor.hub | `tide < -0.27` (the steps) | 3 |
| quay.hub | gut.hub | `has(gut.open)` (from 00:40) or a GRIP 7 ink check over the Guild's back wall before it | 2 |
| brine.hub | gut.hub | `has(gut.open)` (the yard lane) | 2 |
| weigh.hub | gut.hub | `has(gut.open)` | 2 |
| any hub | quay.hub | always | 1 |
| floor.hub | quay.hub | always; after 23:30 from the drowned lamp it is `run(r.gully)` | 3 |
| mole.hub | quay.hub | always | 2 |

Each hub opens with an `alt:` list for scheduled scenes (section 6) before its menu.

## 3. The cast in Act 1, with schedules

Speakers in capitals are the `speaker:` names. A person is at a place in their schedule unless a
flag moves them (flags in brackets). Writers write a person's full dialogue for every place and
time they are in their district, and a short `.again` node for return visits.

| Speaker | Who | Schedule |
|---|---|---|
| WENNA | Wenna Tallow, keeper | brine 22:41 to 06:00 (by the stove); with Lamb to Mother if `wenna.climbs`; quay at dawn |
| KEEL | Absalom Keel, harbourmaster | steps 22:41 to 23:58; weigh tube 23:58 to 00:10; harbour 00:10 to 04:15; weigh_out (takes the hammer) 04:15 to 04:25; mole and stairs 04:25 to 04:50; lamproom 04:50 to 05:05; quay 05:10 to 06:10 |
| CRAKE | Ottilie Crake, by telephone | harbour office telephone: rings when Lamb first enters, again 02:00 to 02:30, again 05:30 to 05:50 |
| MARROW | Marrow Dunlin | weigh_in (the after-vote) 22:41 to 00:40; gut hall 00:40 to 03:30; smokehouse 03:30 to 05:30; weigh_out 05:30 to 06:10 |
| FENNICK | Ambrose Fennick | steps 22:41 to 23:50; brine 23:50 to 01:20; steps (vigil under a bell jar) 01:20 to 06:10, except brine during the heavy rain 01:30 to 02:40 |
| SABINE | Sabine Brine | brine all night; yard 23:20 to 23:30 (the quarrel with Wenna) and 03:40 to 03:50 (the oven) |
| MERROW | Tub Merrow | drowned 22:41 to 23:40; gully 23:40 to 23:45; brine (drying at the stove) 23:50 to 00:40; gut loft 00:40 to 04:00; mole_steps (his boat) 04:00 to 06:10. In the Lamplighters' cells from 00:30 if the provisional cause is wreckers |
| PIP | Pip Gannet | brine 22:41 to 23:55; tube 23:55 to 00:15; brine 00:15 to 05:50; tube 05:50 to 06:10 |
| GORM | Sgt Ida Gorm, Lamplighters | quay 22:41 to 01:30; harbour 01:30 to 02:40; weigh_out 02:50 to 03:20; quay 03:20 to 06:10. Follows Lamb from 00:30 if `prov.trust` |
| HOBB | Constant Hobb, youngest Lamplighter, two lanterns | weigh_out 22:41 to 00:40; quay 00:40 to 04:15; weigh_out 04:15 to 06:10 (sees Keel take the hammer) |
| SPRATT | Agnes Spratt, eel-wife | weigh_in 22:41 to 00:40; gut (her stall) 00:40 to 06:10 |
| MAB, NOLL | The Whelk twins, gutters | gutter all night |
| SHADWELL | Ned Shadwell, smokehouse master | smokehouse all night |
| GAUZE | Sister Gauze, bell jar for eleven years | steps 22:41 to 23:50; brine 23:50 to 06:10 |
| TOBIT | Tobit Quill, choirboy, nine | steps 22:41 to 23:50; brine 23:50 to 01:00 (asleep under a table after) |
| LUGG | Ferris Lugg, Merrow's partner, whispers | floor 22:41 to 23:40; gut loft 23:50 to 06:10 |
| COCKLE | Nan Cockle, eighty-one, salvor | fish 22:41 to 23:48; brine 23:55 to 06:10 |
| PENHALLOW | Ysolde Penhallow, master of the Saint Cuthwin | ferry (at mole_steps) 22:41 to 23:30; brine 23:30 to 06:10 |
| TEAGUE | Orrin Teague, waits for the morning boat | brine all night |
| DILLY | Dilly Rudd, floor child, runs a book on the fish | fish 22:41 to 23:48; steps 23:48 to 00:30; brine (asleep) after |
| THE FISH | The fish (no speech; Lamb's voices speak for it, and so does SMELL) | fish until 23:48 |
| FEWELL, BRIGHT, STRAND, COE | Lamplighters, one line each, written down by Gorm | quay patrol |
| HALE | Captain Hale Dunlin, Marrow's dead father | in the gutter's glow only, as a small thing (margin.lwd) |

Lamb is LAMB. Voices are written `voice: <id>:`; instruments `inst: THE DAMP:`.

## 4. Quests (all in rules.lwd as `@quest`; stage ids below)

| Id | Title | Stages (id: Daybook text in Lamb's hand) |
|---|---|---|
| a1.claim | Claim 4471/G | open, mechanism, wiring, restrike, foreknown, glass, light, provisional, cause |
| a1.lowlight | The Low Light | seen, merrow, gap |
| a1.stairs | A Hundred and Twelve Stairs | asked, refused, climbing, burning, alone, dark |
| a1.nose | Lights Out for the Nose | heard, scales, admitted, kept |
| a1.splinters | Splinters of the Eye | relic, numbered, bought |
| a1.slate | The Slate | tab, oven, wiped |
| a1.copper | Copper Doesn't Care | sack, hidden, returned, reported |
| a1.tube | Tube Minded | tube, e, typed |
| a1.fish | Claim on a Fish | met, claims, turned, gulls, eaten |
| a1.hair | The Damp's Hair | asked, rehaired |
| a1.book | Gorm's Book | noticed, page |
| a1.minutes | Eleven Minutes | slow, jory, set, left |
| a1.vote | The Fish of the Year | pans, older, soot, spratt |
| a1.frost | Frost | hammer, prints, met, saved, broken |
| a1.room | The Room Above the Brine | let, wall |
| a1.lamps | The Lamps of Gullet | first, three |

## 5. Facts (in facts.lwd)

The bible's clues C1 to C16 keep their LWD/0 ids: `prints.read` (C1), `scales.switch` (C2),
`works.order` (C3), `panel.restrike` (C4), `log.ahead` (C5), `coat.wenna_dry` (C6), `tab.wenna`
(C7), `prism.green_oven` (C8), `lens.green` (C9), `prism.numbered` (C10), `overheard.last_three`
(C11), `merrow.wet_thigh` (C12), `memory.low_light` (C13), `claim.time` (C14), `lamps.pink` (C15),
`soot.east` (C16). Plus: `marrow.switch`, `merrow.light`, `spray.mole`, `key.office`,
`wenna.heard_motor` (she admits she heard Mother stop), `sabine.oven` (Sabine admits the oven),
`fennick.bought` (Fennick admits he paid), `clause.struck` (the struck restrike clause, in yellow
ink, readable only out of sodium), `frost.keel` (frozen drips on the 112 stairs: Keel climbed at
04:30), `hammer.keel` (Hobb saw Keel take the store hammer), `vote.older` (one vote fish a day
older), `ship.clock` (the ship's clock is four minutes fast: Penhallow), `brine.clock` (the Brine's
clock is eleven minutes slow).

## 6. The beat sheet

Each beat names its district file, its place and time, the systems it uses, and any Margin offer
(`offer`), page (`xp`) or run. "Must" beats are the spine; the rest are optional and many are
mutually exclusive.

### Movement I: The Floor Is Open (22:41 to 00:00)

| # | Beat | File | When | Systems |
|---|---|---|---|---|
| 1 | **Prologue on the deck** (memory, no clock): 22:18 to 22:24 on the Saint Cuthwin; the dark where Mother should be; Penhallow at the helm; the low light in the drowned lamp; the helm over; the ship's clock says 22:24. Lamb reads the claim twice. Sets `memory.low_light`, `a1.lowlight seen`, `a1.claim open`. Character creation (precedent, trusted instrument) is framed here: the three claims Lamb remembers while the ship heels | quay | prologue | page 1 (`xp: 1` on reading the claim a third time) |
| 2 | **Berth at the mole steps**, 22:41: spray, the Vane shouting west, Penhallow refusing to leave the ship till she has "had words with the light". First instrument readings (tutorial by temperament, not instruction) | quay | 22:41 | spray: `wet(0.2)` unless the coat sheds; `spray.mole` |
| 3 | **Keel at the top of the steps** (slice Keel, deepened): wreckers, the claim, the key. Claim on Keel needs `works.order` & `claim.time` | quay | to 23:58 | the Record (`said.wreckers` if Lamb repeats Keel's word to anyone), Gorm's warning |
| 4 | **Gorm's book**: the first time Lamb talks to anyone under sodium with Gorm on the quay, Gorm writes. `a1.book noticed`. Offer m.watched | quay | any | seen rule; `book.*` flags |
| 5 | **The harbour office telephone**: Crake (slice, deepened; the restrike lie; the click on the line). Read the bay chart: the Old Light's bearing. The Gullet harbour table is here (`give(i.harbour_table)` for the Almanac fit) | quay | first visit | SMALL PRINT, PRECEDENT |
| 6 | **Fennick's blessing on the steps**: the Congregation in bell jars; Tobit sings the sodium restart as a hymn (C15 "pink"); the relic shown only in the dark (`prism.numbered`, a1.splinters). Offer m.pink, m.grace. Sister Gauze lends a bell jar if asked kindly (`give(c.belljar)`) | quay | to 23:50 | light gate, Candlemas |
| 7 | **The Brine** (slice, deepened): Sabine's prices; Wenna by the stove (her dry coat C6, "she's got her eye shut"); the tab C7; the slow clock (a1.minutes slow; offer m.clocks); Orrin Teague; Pip and the tide in her knees; the porthole lamp broken (lamp l.brine_porthole). Offer m.owed from the slate | brine | any | the Damp, SUM, HEARSAY |
| 8 | **The yard quarrel**, 23:20 to 23:30: Sabine and Wenna, "the last three" (C11), heard from the yard if Lamb is there or from the steps if the Vane says the wind carries | brine (yard) | 23:20 | overhearing, fog |
| 9 | **The oven**: a green prism still warm (C8), only colour-readable out of the sodium (Candlemas in paraffin) | brine (oven) | any; Sabine distracted or 23:20 to 23:30 | Candlemas, GRIP (it is hot), a1.slate oven |
| 10 | **The after-vote**: Marrow and the Guild drinking to the strike in the weigh-house; blindfolds round necks; the voting pans; Spratt sour; Lamb offered a blindfold and a fish to smell (the Guild's welcome: c.blindfold). Marrow's admission comes only in the dark or blindfolded (`marrow.switch`, a1.nose admitted). Offer m.flatfish | weigh | to 00:40 | SMELL, blindfold rules, the Read (`seenas_guild`) |
| 11 | **The switch box** outside under the eave: fish scales on the handle (C2), until the SW rain gets under the eave at 23:50. Soot streaked east on the east face (C16), until 01:30 | weigh | to 23:50 / 01:30 | light gate, the Vane, the Damp |
| 12 | **The office** (key from Keel or the window in fog after 23:20): the works order (C3), the Shelf's past file on Mother's conversion signed Assessor Pollard (PRECEDENT; link to the Damp's hair) | weigh | any | SMALL PRINT (yellow ink unreadable under sodium), r.shadow if Hobb or Gorm is outside in a blackout |
| 13 | **Down the steps to the floor**: lanterns, Low Night walkers, Merrow's prints (C1) until the rain blurs them at 23:45 | floor | while `tide < -0.27` | erosion, the Almanac |
| 14 | **The fish**: a fish the size of a cart, stranded, claimed by the Guild (Spratt's runner), the Low Company (Cockle) and the Congregation (a sign); Dilly's book on whether it lives. Lamb can adjudicate the claim (a little claim inside the big one, played straight). Turning it into the channel is `run(r.fish)` 23:40 to 23:48; otherwise the gulls, or the Guild's knives. a1.fish | floor | to 23:48 | THE CHIT, CONDOLENCE, SALT; the Tab (Dilly) |
| 15 | **The drowned lamp**: Merrow inside, stripping copper, the lantern in the hole (`merrow.light`), his story of the five minutes (a1.lowlight merrow, gap: page). Lugg whispers. Salvage: copper wire, brass, crown glass from the Old Light's broken gear. Leaving after 23:30 is `run(r.gully)`. Leave a lantern in the hole before 23:52 (`l.drowned`) | floor | to 23:52 | salvage, the Damp on Merrow (C12), offer m.copper, m.level |
| 16 | **The mole and the 112 stairs**: spray, counting (offer m.stairs), the lamp room: the panel card (C4), the log (C5), the lens green (C9) by lantern; the restrike button (`cmd: restrike mother` if `power.quay == on`: a1.stairs burning or alone). Getting Wenna up instead is a Brine thread (`wenna.climbs`) | mole | any | KNEES, Cold, Candlemas, Wear |
| 17 | **Crake's second line** if Lamb restruck Mother: the telephone in the harbour office rings when Lamb next passes, at once | quay | after restrike | |
| 18 | **Merrow at the stove**, 23:50 to 00:40: trousers wet to the thigh (C12) until he dries; the sack under the settle (a1.copper sack). Hide, return or report | brine | 23:50 to 00:40 | the Damp; FORM LETTER; favour |
| 19 | **Midnight: the tube.** Event at 00:00 sends Pip to fetch Lamb from anywhere ("It's thumping for you"). The Shelf's message (typed, a sticking e). Lamb writes a provisional cause: wreckers, guild, trust, keeper, sea, or "insufficient light" (a refusal the Shelf answers with one word). Sets `prov.<cause>` and `rumour(prov.<cause>, quay, 0.6)`. a1.claim provisional; a1.tube tube | weigh | 00:00 | the Record (said in front of whoever is in the weigh-house) |

### Movement II: Weather (00:00 to 03:30)

| # | Beat | File | When | Systems |
|---|---|---|---|---|
| 20 | **The room above the Brine**: Sabine lets it (a chit, or free if Lamb wiped her slate). The stove, the bench, the wall (a1.room let). The bench introduces fitting the Kit; the wall introduces pinning. Constant Hobb leaves a dark coat here if he is on the Tab | brine | from 00:05 | bench, wall, Cold |
| 21 | **The provisional cause travels.** Each `prov.*` changes the hubs from 00:20: wreckers puts Merrow in the cells at 00:30 and the Low Company hostile; guild turns the after-vote on Lamb (beat 22); trust sends Gorm after Lamb; keeper sets the Brine against Lamb (Sabine's prices double, Wenna will not speak until Lamb takes it back or proves it); sea makes everyone suspicious and polite; refusal makes the Shelf's chits worth less (rumour `shelf.failed`) | all | 00:20 | rumour, the Read, favour |
| 22 | **Squall: the after-vote turns**, 00:30 (if `prov.guild` and Lamb is in or near the weigh-house): the Guild blindfolds Lamb and asks Lamb to smell the truth. Every option moves the room (someone pulls the switch; the scales tip; the door shuts). Outcomes: Lamb is "one of us" (`seenas_guild = nose`), an informer, or put out in the rain | weigh | 00:30 | squall, SMELL, PRIDE |
| 23 | **The Gut opens**, 00:40 (`gut.open`): the Guild processes from the weigh-house to its hall with the voting pans. The Whelk twins at the gutter; Shadwell reading time by soot; Spratt's stall; the Low Company's net loft (Lugg, then Merrow). The vote's second fish (a1.vote: one fish a day older; Shadwell's soot dates its smoking; Spratt swapped it to lose the strike and it carried anyway). The wire lamps half out (l.gut_wires) | gut | from 00:40 | SMELL (+2 downwind), palette light, favour |
| 24 | **The Damp's hair**: the Damp asks, in its melancholy, to be someone else. Taking a hair from Wenna, Pip, Merrow, Keel or Lamb is a scene with that person. a1.hair | any (offered at the bench) | after 00:05 | fit f.damp_hair |
| 25 | **The Wet Hour**, 01:30 to 02:40, the Brine full: Penhallow (the ship's clock four minutes fast: `ship.clock`; she will not sail until Mother burns true), Orrin Teague's letter (on the Tab if Lamb carries it), Nan Cockle remembering the Old Light with a door, Sister Gauze under her jar, Fennick dripping, Tobit asleep. Sabine's husband Jory and the slow clock (a1.minutes jory) | brine | 01:30 to 02:40 | CONDOLENCE, HEARSAY, the Tab |
| 26 | **Crake rings again**, 02:00 to 02:30: she has heard the provisional cause from Gorm. Her offer depends on it (a new post for Lamb; a review; a threat put as a kindness). The yellow ink: she admits the clause was "edited" if Lamb has `clause.struck` | quay | 02:00 | FORM LETTER, THE CHIT, the Record |
| 27 | **The second blackout**, 02:50 to 03:20: rain gets into the quay board. Sodium off; Mother off again if she was burning. Hobb goes to reset it at 03:20. In the dark: the Lamplighters cannot see; Fennick will speak; the town is honest (m.dark). If Mother was restruck, someone must climb again: Wenna, if Lamb asks now (a1.stairs dark) | all | 02:50 | blackout, r.shadow, THE DARK |
| 28 | **Fog thickest**, 03:00: the floor is under water; the quay's far end is gone; THE DARK and Dread. The small thing is most likely here | all | 03:00 | Dread |

### Movement III: Frost (03:30 to 06:10)

| # | Beat | File | When | Systems |
|---|---|---|---|---|
| 29 | **The oven again**, 03:40 to 03:50: Sabine fires it for bread, and Lamb can watch what goes in. Her admission (`sabine.oven`) if Lamb has C8 and C11 | brine | 03:40 | CONDOLENCE, THE CHIT |
| 30 | **Rain clears**, 04:10; 1 °C; frost on the mole and the rails | all | 04:10 | frost modifiers |
| 31 | **Hobb sees Keel take the hammer** from the weigh-house store, 04:15 to 04:25 (`hammer.keel`), and tells Lamb if on the Tab, or if Lamb is at the weigh-house | weigh | 04:15 | the Tab |
| 32 | **Frost on the mole**: `run(r.frost)` 04:30 to 04:50 to reach the lamp room before the hammer. Win: the squall. Lose: the lens is broken (`lens.broken`) and Lamb arrives to Keel in the glass | mole | 04:30 | run; BALLAST on frost tiles |
| 33 | **Squall: Keel and the hammer**, 04:50: in the lamp room, frost on the inside of the glass, Keel dripping and the drips freezing. He means to break the lens so the Shelf pays for a whole one and nobody counts the green rings. Every option moves the world (the hammer, the drips freezing on the floor so footing goes, Mother's arc if lit). Outcomes: the lens saved (`lens.saved`), broken (`lens.broken`), or Keel breaks only the green rings at Lamb's suggestion (`lens.green_broken`: the evidence gone, the light honest). With Wenna present it is three-way | mole | 04:50 | squall, BALLAST, FORM LETTER, CONDOLENCE |
| 34 | **The frost keeps the prints**: if Lamb was not there, from 05:00 the stairs hold a staircase of frozen drips, one per step, going up and coming down (`frost.keel`). a1.frost prints | mole | 05:00 | the Damp, SUM (count them) |
| 35 | **High water**, 05:10: the quay's edge awash; the fish's fate shows (the gulls, the channel, the Guild's knives); Keel on the quay, dripping, as if nothing | quay | 05:10 | |
| 36 | **Crake's third call**, 05:30: a deal for a cause | quay | 05:30 | |
| 37 | **Penhallow at the window**, 05:40: whether the morning boat will sail | brine | 05:40 | |
| 38 | **Dawn**, 06:00 (event): the Daybook verdict. Lamb chooses one or more parties and must have the facts for each. 06:10 the tube takes it | dawn | 06:00 | the verdict |

### The Act 1 ending (dawn.lwd)

The cause sets `cause.<id>` flags (one or several) and plays its ending: who falls at dawn, who is
lit, one image of the town at first light in colour for a single line (the only colour the night
gives), then the Shelf's typed answer: the assessor will remain while the spring tides run, and the
master of the Saint Cuthwin will not sail until Mother burns true. Lamb climbs to the room above
the Brine. End `act1.end`.

## 7. Margin offers in Act 1

| Note | Offered in | Moment |
|---|---|---|
| m.clocks | brine | the slow clock, or the ship's clock |
| m.level | floor | wading the gully |
| m.owed | brine | Sabine's slate |
| m.flatfish | weigh | Marrow names Lamb a flatfish |
| m.dark | quay or weigh | the second blackout, or Fennick in the dark |
| m.colour | brine | Candlemas in the Brine's doorway between paraffin and sodium |
| m.wet | quay | Keel, the third time Lamb looks at his cuffs |
| m.stairs | mole | climbing the 112 |
| m.copper | floor | Merrow |
| m.watched | quay | Gorm's book |
| m.pink | quay | Fennick or Tobit's hymn |
| m.grace | quay or brine | Fennick's relic accounts |
| m.pollard | weigh | the Pollard file in the office (only if the Damp still has his hair) |
| m.small | margin | a full Dread meter |

## 8. Pages (twelve in Act 1)

1 the claim read a third time (quay prologue); 2 the pink lamps understood (quay or brine); 3 the
works order (weigh); 4 the restrike card (mole); 5 the green lens (mole); 6 the relic numbered
(quay); 7 the five minutes no lantern burned (floor); 8 the slow clock and Jory (brine); 9 the
vote's older fish (gut); 10 the frost prints counted, or the squall survived (mole); 11 the sticking
e on the Shelf's machine (weigh, at the tube, SMALL PRINT 6); 12 the provisional cause written,
whatever it is (weigh).

## 9. Lamps of Gullet in Act 1

| Project | Where | Stages and needs | Changes |
|---|---|---|---|
| l.steps_post | quay (steps) | Leave from Fennick; then s.wick 1 and i.paraffin 1 | steps light 0.4, sodium 0.3: colour reads at the top of the steps |
| l.brine_porthole | brine | s.bottle_glass 1 (or s.crown_glass 1) and s.brass 1 | yard light 0.35: no overhearing in the yard except in fog |
| l.gut_wires | gut | s.copper_wire 2; Marrow's or Spratt's word | the Gut's palette full; rep(guild, 1) |
| l.balance | weigh (roof) | s.wick 1, i.paraffin 1; GRIP 6 ink to climb | a light on the town balance the whole quay sees; rep(board, -1); rep(guild, 1) |
| l.drowned | floor | i.lantern left in the hole before 23:52 | Act 1 ending line; rep(lowco, 2) |
| l.mother | mole | restrike (power on) | Mother burning (green) |

## 10. Voice and style, for every writer

- The bible's section 2 governs: the report in the third person, itemised, exact, fond of the
  town; one grotesque image per beat; no sarcasm about people; short and long sentences unpatterned.
- Original writing only. No names, lines, skill names or mechanics from any other game.
- Every line earns its place: it changes what the player knows, what someone thinks of Lamb, what
  the town looks like, or what Lamb can do next.
- Humour from exactness. Horror from social pressure and weather. No jump scares, no gore, no
  monsters. The small thing stays small and unexplained.
- No em dashes. Plain punctuation.
- Characters keep their registers (bible section 7; supporting cast in section 3 above).
- Voices argue with each other and with Lamb. Low levels speak too (`{below: n}`): failure is a
  different scene, never a closed door.
- The instruments are exact and vain. Their numbers are true numbers from the night (use
  `{{tide}}` and friends sparingly, and only from an instrument).

## 11. Fights in Act 1 (added 2026-10-16)

The author settled real-time combat as a full system (SYSTEMS-FULL.md section 18, the Fray).
Encounters are records in `content/act1/combat.lwd` (director). A district starts one with
`do: fight(e.<name>)` and writes four outcome nodes, `<district>.fight.<name>.win`, `.yield`,
`.fled` and `.down`. Every fight has a talk or run alternative written beside it, voices argue
about it afterwards, and its consequences go in the Record (18.10).

| Encounter | File | Kind |
|---|---|---|
| e.lamplighters, e.wardens | quay | Optional |
| e.brawl | brine | Optional (join, stop, keep out) |
| e.afterdark | weigh | Set fight if the 00:30 squall turns |
| e.salvors | floor | Set fight if Lamb takes the copper |
| e.conger, e.gulls, e.eels | floor | Optional |
| e.dogs | gut | Optional |
| e.hammer | mole | Set fight at 04:50 (a struggle on ice; talk changes its shape) |

Moves taught by people (18.5): Merrow's hook-pull and Nan Cockle's mud-step (floor), Marrow's feint
(gut), Sabine's stool rule (brine), Gorm's pole sweep (Act 2). Fight Margin notes: m.body, m.poles,
m.downwind (rules.lwd).

## 12. Conventions settled during writing

- `trait(id)` returns a status word: `none`, `found`, `researching`, `done`, `forgotten`. Test
  `trait(m.body) == none`, never `!trait(m.body)` (a word is always true).
- Record flags `struck.<char>`, `down.<where>`, `fought.<encounter>` are unprefixed by design
  (SYSTEMS-FULL 18.7, 18.10) and are never declared in facts.lwd; the lint exempts them.
- Cross-district state the edit pass must honour: `floor.copper_taken` (the sack came off the floor
  with Lamb, so the Brine's beat 18 sack is not under the settle); `floor.hat_lost` (the Shelf
  bowler went in the gully); `mole.wenna_home` (cleared by brine to send Wenna up again after the
  second blackout); `quay.bearing` (set by the harbour office chart, read by the floor).
