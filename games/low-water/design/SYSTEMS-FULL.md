<!-- writing-profile: research -->
# Low Water: full systems design

Draft 1, 2026-10-16. Private. Supersedes nothing in `design/SYSTEMS.md`; it builds on it. The
environment state, the tide clock, the sodium colour rule, blackouts, rumour pressure and erosion
stay exactly as SYSTEMS.md sections 2 to 8 define them. This document adds Lamb: the voices, the
checks, the Margin, the meters, clothing and the Kit, salvage and fitting, the Lamps of Gullet, the
Tide Runs, reputation, cover and memory. The data format that carries all of it is
`design/LWD1-FORMAT.md`. The engineer builds in `game/engine/` and reads this file; questions go in
`design/NOTES-FOR-ENGINEER.md`.

## 0. The crossover map

The author asked for a crossover of Disco Elysium, Zero Parades: For Dead Spies and No Rest for the
Wicked, feature-wise, with original mechanics. The left columns say what each game does, from the
dated sources in `design/PRODUCTION.md` section 1. The right column is Low Water's own form. No names,
skill names, lines or rules are copied.

| What the reference does | From | Low Water's form | Section |
|---|---|---|---|
| Skills are inner voices that interrupt dialogue | Disco Elysium | Sixteen voices in Lamb's head, in four compartments of the claims case, plus the five instruments of the Kit, who are outside Lamb and answer back | 2, 3 |
| Passive checks: a high skill quietly adds a line | Disco Elysium | Passive voices: a voice speaks when its effective level meets the line's threshold, and some speak only when Lamb falls short, which is how failure stays interesting | 4.1 |
| White (retryable) and red (one-time) dice checks | Disco Elysium | No dice. Pencil checks can be tried again once anything in the sum has changed (the tide, the light, a coat, a drink); ink checks are tried once. The weather is the second chance | 4.2 |
| Exertion: push a check by filling a pressure meter | Zero Parades | Strain: add up to +3 to a check by paying into the meter tied to that compartment; a social push is paid in the other person's goodwill | 4.3 |
| Fatigue, Anxiety and Delirium meters replace health | Zero Parades | Cold, Wear and Dread. A full meter is a scene, never a loss of skill: Lamb shelters, or nods off and wakes to a page in a hand Lamb does not remember, or sees the small thing | 5 |
| Thought Cabinet; Conditioning with rules that cost their bonus when broken | Disco Elysium, Zero Parades | The Margin: notes Lamb pencils beside the Daybook's text and inks in over hours of the night. Inked notes are tidal: each works only in certain light, tide or company, so a belief is something the town turns on and off | 6 |
| Archetypes or a custom build | Zero Parades | Precedents: Lamb's three formative claims set the compartments and a first Margin note | 7 |
| Clothing that changes skills | Disco Elysium | Clothing that changes skills and also sheds water, keeps warmth and tells the town what Lamb is | 8 |
| Gear durability, repair and tools | No Rest for the Wicked | The Kit wears: the Damp saturates, Candlemas's wick gutters, the Vane bends in a gale. Instruments are fitted and mended at a bench with salvage; a fitting changes both an instrument's level and its voice | 9 |
| Gathering and crafting | No Rest for the Wicked | Salvage on the harbour floor at low water and in the wrecks: brass, copper wire, crown glass, bottle glass, tin, wick, hair. No grinding: every piece is placed by hand and the tide takes back what is not picked up | 9 |
| Rebuilding a settlement through projects | No Rest for the Wicked | The Lamps of Gullet: Lamb can rekindle, mend, convert or leave dark the town's lights across the three nights. Each lamp changes the rules where it stands (who can see, what colour reads) and how the epilogue looks | 10 |
| A house to own and decorate | No Rest for the Wicked | The room above the Brine: a stove to dry at, a bench to fit the Kit, a wall where Lamb pins what matters; the wall is the case board | 11 |
| Real-time traversal and physical tension | No Rest for the Wicked | Tide Runs: short real-time movement under the tide, the frost and the dark | 12 |
| Weighty real-time melee: stamina-gated attacks, dodges, parries, committed animations, gear that wears | No Rest for the Wicked (clean-room: cleanroom/spec/ and public sources only) | The Fray: close, heavy, improvised fighting with harbour tools, where tide, frost, light and wind fight on both sides and every blow goes in the Record | 18 |
| Dramatic Encounters: tense set pieces with lasting consequences | Zero Parades | Squalls: set-piece scenes where every choice also moves the weather or the water, and the next check is made in the world that choice left | 12.4 |
| Cover: a persona that sincerity can blow; blending into crowds | Zero Parades | Guises and the Read: each faction believes Lamb is something, and Lamb's clothes, words and company keep or break it. In fog and blackout Lamb blends; under sodium Lamb is a shop window | 13 |
| A network of assets the player builds and runs | Zero Parades (GamingTrend review, read 2026-10-16) | The Tab: people who owe Lamb a favour bring news, carry rumour or keep watch, and the night can call the debt in | 13.4 |
| A reactive world that remembers | Disco Elysium | The Record: everything Lamb says that matters is kept with where, when and who heard; rumour carries it by the wind; people quote it back | 14 |

**Does real-time action belong?** Yes, in two forms. The author settled it on 2026-10-16 (relayed by
the coordinator): real-time combat in the manner of No Rest for the Wicked, its dodges and attacks,
is a full system beside the dialogue spine, not an optional layer. Draft 1's limit ("no combat")
is withdrawn.

1. **Tide Runs** (section 12): movement under a hazard, with no opponent.
2. **The Fray** (section 18): close, weighty, real-time melee against people and animals, with
   stamina, dodges, parries and tools that wear.

How it keeps the spine: dialogue and investigation decide most fights before they start (who
fights, on what ground, with whom beside Lamb, in what light), and most fights can be talked down
or run from. Each act has a few set fights that cannot be skipped; talk changes their shape rather
than removing them. Violence is evidence: every blow goes in the Record, and the town, the factions
and Lamb's own voices answer it. The tone holds: tense and physical, no gore, no monsters. Going
down is never death; it is a scene that costs something.

## 1. What stays from SYSTEMS.md

- No dice, anywhere. A check's outcome depends on Lamb's levels and the world at that minute.
- The night moves only when Lamb acts (talking, reading, walking, waiting), except inside a Tide Run.
- When something lands or fails, the person shows why in the scene. The check line shows the sum
  before the choice; nothing afterwards prints a tally.
- Colour in the interface never carries meaning alone.

## 2. Lamb's compartments and voices

The Shelf issues every assessor a claims case with four compartments. Eleven years have filled each
with habits that talk. A compartment is an attribute (1 to 5); its four voices are skills.

| Compartment | What it holds | Voices |
|---|---|---|
| **THE PEN** | Reckoning: sums, papers, memory, reconstruction | SUM, PRECEDENT, SMALL PRINT, CARBON |
| **THE COAT** | Bearing: the body in weather, stairs, footing, dignity | KNEES, BALLAST, PRIDE, GRIP |
| **THE HAT** | Manner: what Lamb does with people | CONDOLENCE, FORM LETTER, THE CHIT, HEARSAY |
| **THE NOSE** | Instinct: smell, the dark, the hidden, the sea in the body | SMELL, THE DARK, UNDERTOW, SALT |

### 2.1 The sixteen voices

| Voice | Does | Temperament (how it talks) | Environment and condition modifiers |
|---|---|---|---|
| SUM | Times, distances, clocks, money, counting | Clipped; distrusts every clock; enjoys a remainder | -1 at Wear 6+; +1 at a lit desk |
| PRECEDENT | Memory of past claims, salvage law, the Shelf's practice | Elderly, anecdotal, always has a case number | +1 among papers (offices) |
| SMALL PRINT | Documents, signatures, clauses, ink | Fussy, delighted by crossings-out | -3 when light < 0.15; cannot see yellow ink under sodium |
| CARBON | Reconstructs a scene as it happened, from what is left | Speaks in the present tense about the past | +2 at the place of the event; -2 once tide or rain has changed it |
| KNEES | Stamina: stairs, wading, distance | Complains, then does it | -1 at Cold 4+; -1 for an hour after the 112 stairs |
| BALLAST | Footing, balance, steadiness under physical threat | Low, slow, nautical | -2 on frost; -1 on wet stone; -2 in the dark without a lantern |
| PRIDE | Composure, the dry coat, being taken seriously by officials | Vain and fragile; counts the years dry | +1 dry; -1 wet; -2 soaked |
| GRIP | Hands: climbing, forcing, carrying, switches | Practical; talks about what the hands feel | -2 at Cold 6+; -1 in rain |
| CONDOLENCE | Reading grief and pain; letting people say what they lost | Gentle, a little too sure it understands | +1 by a fire; -1 under sodium (faces will not read) |
| FORM LETTER | Official manner, bluffing authority, keeping a guise | Speaks in the passive voice, as letters do | +1 when PRIDE's modifier is positive |
| THE CHIT | Bargains, bribes, debts, value | A shopkeeper in the head | Falls with the Shelf's standing: -1 when rumour "shelf.failed" passes 0.5 in the district |
| HEARSAY | Planting, reading and steering rumour | Leans in; always just heard | +1 in the Brine; +1 downwind of a crowd |
| SMELL | Literal smell; the Gut's language; the vote | Ecstatic and disgusting in equal measure | +2 downwind; -2 in rain; -3 under a bell jar; +2 blindfolded |
| THE DARK | Sight and hearing without light; what fear knows | Quiet; speaks more as Dread rises | +2 in blackout; -1 under any lamp |
| UNDERTOW | What people hide; the pull toward it; temptation | Persuasive; never quite says what it wants | +1 within an hour of low water; -1 within an hour of high |
| SALT | The body's sense of tide and weather | Speaks as joints and skin | +1 soaked; +1 on the floor |

### 2.2 The Kit

The five instruments of the bible (section 9) are the fifth set of voices. They are not trained; they
are fitted. Each has a **condition** from 0 (broken) to 5, set by its fittings and wear (section 9).
An instrument's reading is automatic when used. Its interjections use the condition as their level.

| Instrument | Starts at | Wears by | Fitted with |
|---|---|---|---|
| Candlemas | 3 | Wick gutters in wind (no colour reading in wind over 12 m/s unshuttered) | Smoked shutter, spirit wick, crown glass eyepiece |
| The Glass | 3 | Knocks (a fall: -1) | Re-silvered tube, a new needle |
| The Almanac | 4 | None; it is a book with a dial | A Gullet harbour table (exact heights for the gates) |
| The Damp | 2 | Saturates in rain or wading (reads nothing until dried) | A new hair (whose hair is a choice: section 9.3) |
| The Vane | 3 | Bends in gusts over 20 m/s (-1) | Re-tinned tail, a bearing |

## 3. Effective level

```
level(voice) = compartment + trained + clothing + margin + kit_bonus
             + meter_mods + condition_mods + environment_mods + temporary
```

- `compartment`: 1 to 5. `trained`: 0 to 4, bought with pages; trained may not exceed the
  compartment's value plus any cap raise from an inked Margin note.
- `clothing`, `margin`, `temporary` (drinks, snuff): from item and note records.
- `meter_mods`, `condition_mods`, `environment_mods`: the table in 2.1, evaluated with the
  hysteresis of SYSTEMS.md so a modifier does not flicker.
- For an instrument: `level = condition + fittings_bonus + environment_mods`.

Typical ranges: a fresh Lamb has voices at 2 to 6. Thresholds in the script run from 4 (anyone
notices) to 12 (only a Lamb built for it, in the right weather).

## 4. Checks

### 4.1 Passive voices

A passive voice is a line gated by a voice and a threshold. It plays in the node's flow when the
condition holds. There is no notice that a check happened; the voice just speaks, with its name.

```
voice: SMELL 6: Paraffin, and under it the sweet, burnt smell of a fuse that has worked too hard.
voice: PRIDE <4: The coat is wet. It is going to stay wet. The coat has stopped speaking to you.
```

The second form speaks only when Lamb is below the threshold. Low levels are a different game, never
a silent one: a low PRIDE gets mocked by the Board and trusted by the Low Company.

### 4.2 Visible checks

A visible check is an option with a voice and a target. The option shows the sum before the player
chooses it:

```
[SUM 7, pencil]  you 6: compartment 3, trained 2, desk +1, Wear 6 -1, ...
```

- **Pencil** checks can be tried again only after the effective level has changed since the last
  attempt. The change can be anything in the sum: dry the coat, wait for the fog, drink, fit the
  Damp, walk into a lit room. This makes the weather the second chance.
- **Ink** checks are tried once. Failing an ink check always opens a scene of its own; it never just
  closes a door.
- The outcome is deterministic: success when `level >= target`.
- A check's target can carry its own environment terms in the script (`+2 if fog > 0.05`), so a
  check can be harder or easier in particular weather without new voice modifiers.

### 4.3 Strain

Before choosing a visible check, the player may strain for +1, +2 or +3.

| Compartment | Strain is paid in | Cost |
|---|---|---|
| THE PEN | Wear | 2 per +1 |
| THE COAT | Cold | 2 per +1 |
| THE NOSE | Dread | 2 per +1 |
| THE HAT | The other person's goodwill | 1 favour with their faction per +1 |

A strain that would fill its meter is refused. Instruments cannot be strained; they read what they
read.

## 5. Meters: Cold, Wear and Dread

Three meters from 0 to 10, shown as marks along the Daybook's edge, never as bars over the world.

| Meter | Rises with | Falls with | Full (10) |
|---|---|---|---|
| Cold | Wetness over time (1 per 20 minutes wet, 1 per 10 soaked), wind over 9 m/s, frost, wading | A stove (2 per 10 minutes), dry clothes, hot drink, pickled egg | **Chilled**: Lamb must shelter. The script jumps to the nearest stove scene for that district. COAT voices -2 until Cold is below 5 |
| Wear | Every hour of the night (1), reading in bad light, the 112 stairs, strain | Strong tea, a sit by a fire (1 per 20 minutes), the day pages (reset) | **Nodding**: 30 minutes pass. The Daybook gains a page in a hand Lamb does not remember, written by the highest inked Margin note (each note has its own nodding page). Wear falls to 4 |
| Dread | Blackout, being followed, the Lamplighters' book, the floor in fog, the small thing | Company, light, rum | **The Small Thing**: a short, quiet, never-explained scene authored per district. The Margin note "The Small Thing" is offered. Dread falls to 4 |

## 6. The Margin

The Daybook has a wide margin. Notes come to Lamb from what happens: a phrase someone said, a sum that
will not come out. Taking a note **pencils** it into a free slot. A pencilled note costs something for
as long as it takes to ink (game minutes, so the night must move), and then it is **inked**: a
permanent effect with a **tide**, the condition under which it works.

- Slots: 3 at the start. A page buys a slot (6 at most).
- A note can be rubbed out for one page; it frees the slot and the note is gone for the game.
- Each inked note has a nodding page (section 5) and may raise one voice's training cap by 1.

Act 1 notes (ids are the data ids):

| Id | Note | Offered by | Pencil (minutes, cost) | Inked effect | Tide (when it works) |
|---|---|---|---|---|---|
| m.clocks | Every Clock in Gullet Is Lying | The Brine's slow clock or the ship's clock | 60, SUM -1 | SUM +2; Lamb's voice corrects every witness's time | Always |
| m.level | Water Finds Its Level | Wading the gully, or the Wader precedent | 45, PRIDE -1 | KNEES +1, SALT +1; PRIDE -1 permanently | When wet |
| m.owed | Everyone in Gullet Owes Somebody | Sabine's slate, or the Condoler precedent | 60, HEARSAY -1 | THE CHIT +2; options that name a debt | In the Brine and the Gut |
| m.flatfish | The Flatfish Position | Marrow's name for Lamb | 30, FORM LETTER -1 | UNDERTOW +2 for the scene after Lamb chooses silence | Lying low: no claim made in the scene |
| m.dark | The Town Is Honest in the Dark | Fennick's relic, or a blackout | 90, Dread +1 per 30 minutes | HAT voices +2 | Light below 0.1 |
| m.colour | The Colour of a Thing | Candlemas in the Brine's doorway | 45, CONDOLENCE -1 | Colours read in honest light count as evidence under sodium | Away from the thing, any light |
| m.wet | Why Is He Wet | Keel | 180, nothing | THE DARK +1; Keel's one question in Act 3 | Always |
| m.stairs | A Hundred and Twelve | Climbing to Mother | 30, KNEES -1 | KNEES +2 on stairs; SUM +1 when counting | On stairs and at Mother |
| m.copper | Copper Is a Better Citizen | Merrow | 60, FORM LETTER -1 | One more piece from each salvage; FORM LETTER -1 | On the floor and in wrecks |
| m.watched | Somebody Is Always Writing It Down | Gorm's book | 60, Dread +1 per 30 minutes | Lamb always knows when seen (the interface shows it); HEARSAY +1 | Always |
| m.pink | Pink Like a Cut | Fennick or the restart | 30, nothing | CARBON +2 about the blackout; THE DARK +1 | Always |
| m.grace | Grace Is a Receipt | Fennick's relic accounts | 60, CONDOLENCE -1 | PRECEDENT +1; Congregation lines that read faith as bookkeeping | With the Congregation |
| m.pollard | Assessor Pollard's Hair | The Damp | 120, nothing | The Damp +1; PRECEDENT +1 on Pollard's old claims (he assessed Mother's conversion) | While the Damp keeps Pollard's hair |
| m.small | The Small Thing | A full Dread meter | 60, Dread +1 per 30 minutes | THE DARK +2, UNDERTOW +1; Dread rises double in blackout | Always |

## 7. Character creation

Lamb's first name is never chosen and never given. The player chooses:

1. **A Precedent**: three formative claims from Lamb's eleven years, which set the compartments and
   the first inked note. Or a custom spread: 11 points across the four compartments, each 1 to 5,
   and one Precedent claim chosen alone for its note.

| Precedent | PEN | COAT | HAT | NOSE | First note | The claims |
|---|---|---|---|---|---|---|
| The Ledger Hand | 4 | 2 | 3 | 2 | m.clocks | 1180/P, the granary at Pell (fire, a clock stopped at the hour); 0441/R, the Rendle bank (a ledger that balanced too well); 2003/S, the Sallow ferry (a timetable) |
| The Wader | 2 | 4 | 2 | 3 | m.level | 0907/M, the drowned choir at Mudlow (flood); 1312/K, the Kettle Reach dyke; 1766/T, the tannery at Tull (the smell) |
| The Condoler | 3 | 2 | 4 | 2 | m.owed | 2216/H, the glasshouses on Orrery Lane (hail); 0519/W, the Widow Arbery's roof (she paid for it twice); 1655/B, the bell at Brack (it fell on the man who rang it) |

2. **A trusted instrument**: one instrument starts one condition higher.
3. **Ink mode** (from SYSTEMS.md section 10): one save, written on every action.

Precedent claims are not flavour. PRECEDENT lines can quote them, and some checks in the script
are gated on a Precedent (`precedent == wader`).

## 8. Clothing and items

### 8.1 Clothing

Slots: HAT, COAT, NECK, HANDS, FEET, and one POCKET thing carried in hand (the lantern is a pocket
thing). Each piece has voice modifiers, and three weather properties:

- `shed` (0 to 1): how much rain and spray it keeps off. Lamb's wetness gains are multiplied by
  `1 - shed` of the coat and hat.
- `warm` (0 to 3): Cold rises one step slower per point; a wet piece loses its warmth.
- `guise`: what the piece tells the town (section 13).

Act 1 clothing:

| Id | Piece | Slot | Effects | Guise | Where |
|---|---|---|---|---|---|
| c.shelf_coat | The Shelf greatcoat | COAT | shed 0.5, warm 2; PRIDE +1 while dry | shelf | Worn at the start |
| c.shelf_hat | The Shelf bowler | HAT | shed 0.3; FORM LETTER +1 | shelf | Worn at the start |
| c.oilskin | A borrowed oilskin | COAT | shed 0.9, warm 1; PRIDE -1 | floor | The Brine's peg |
| c.keeper_coat | Wenna's oxblood keeper's coat | COAT | shed 0.6, warm 2; KNEES +1 on stairs; CONDOLENCE +1 with Wenna | keeper | Wenna, if she trusts Lamb |
| c.waders | Merrow's spare waders | FEET | Wading does not wet Lamb below the waist; BALLAST -1 on stone | floor | Merrow, as a favour |
| c.blindfold | A Guild blindfold | NECK (worn on the eyes by choice) | Worn over the eyes: SMELL +3, THE DARK +2, Lamb sees nothing (sight-based lines are replaced) | guild | The weigh-house |
| c.belljar | A Congregation bell jar | HAT | SMELL -3, Dread -2 while worn, overhearing -1 | pilgrim | Sister Gauze |
| c.lamplighter_coat | A Lamplighter's dark coat | COAT | shed 0.6, warm 2; FORM LETTER +2 with the Municipal | lamplighter (a cover) | Constant Hobb leaves it at the Brine |
| c.mittens | Sabine's fingerless mittens | HANDS | GRIP +1 at Cold 4+ | none | Sabine, for a chit |
| c.socks | Dry socks | FEET (consumed) | Resets wet feet; Cold -2 | none | The room above the Brine |
| c.keel_hat | The harbourmaster's hat | HAT | Funnels water; PRIDE -2, FORM LETTER +2 with the Board | board | Act 1 Frost, if Keel drops it |

### 8.2 Things carried and used

| Id | Thing | Use |
|---|---|---|
| i.lantern | A storm lantern | Light 0.35 within its radius; reads colour; makes Lamb seen. Burns 30 minutes a fill |
| i.paraffin | A fill of paraffin | One lantern fill |
| i.egg | A pickled egg | Cold -1 |
| i.rum | Brine rum | Dread -3; THE PEN -1 for 30 minutes |
| i.tea | Strong tea | Wear -2 |
| i.snuff | Shadwell's snuff | SMELL +2 for 30 minutes |
| i.chits | Shelf chits | Money. Value falls with the Shelf's standing |
| i.key_office | Keel's key | The weigh-house office |
| i.prism_green | A green prism | Evidence; also salvage (bottle glass) |
| i.prism_113 | Relic 113 | Evidence; a crown glass prism; Fennick wants it back |
| i.copper | Merrow's sack | Act 1 quest object (a1.copper) |

## 9. Salvage, wear and fitting

### 9.1 Salvage

On the floor at low water, in the drowned lamp's base, the stranded boats and the Gut's middens there
are **salvage points**, each placed by hand and each taken by the tide when its zone floods. A point
gives named pieces: `s.brass`, `s.copper_wire`, `s.crown_glass`, `s.bottle_glass`, `s.tin`, `s.wick`,
`s.cork`, `s.hair` (named: whose), `s.mercury`. No respawns. The Margin note m.copper adds one piece
per point.

### 9.2 Wear

Instruments lose condition by the rules in 2.2. Wear is shown in the instrument's voice, never as a
number on screen ("My wick is a rumour of a wick.").

### 9.3 Fitting

At a bench (the room above the Brine; Merrow's boat in Act 2) the player can fit an instrument or
mend a lamp from a **fit** record: what it needs, what it does, how long it takes.

| Fit | Needs | Gives | Minutes |
|---|---|---|---|
| f.candlemas_shutter | s.tin, s.cork | Candlemas reads colour in wind; condition +1 | 15 |
| f.candlemas_eye | s.crown_glass | Candlemas condition +1; reads prism numbers by touch of light | 20 |
| f.glass_needle | s.brass | The Glass condition +1 | 15 |
| f.almanac_table | The Gullet harbour table (from the harbour office) | The Almanac condition +1 and exact gate times in the Daybook | 10 |
| f.vane_tail | s.tin | The Vane condition +1; no bending | 10 |
| f.damp_hair | A hair (one of: Wenna, Pip, Merrow, Keel, Lamb) | The Damp is reborn with that hair's temperament | 20 |

The Damp's hair is a character choice. The Damp starts with Assessor Pollard's hair (melancholy,
condition 2). Rehaired:
- **Wenna's**: exact and short; reads stone and stairs well (+2 on the mole and at Mother).
- **Pip's**: young, restless, feels the tide (+1, and SALT +1 while fitted).
- **Merrow's**: laconic; never asks; reads mud (+2 on the floor).
- **Keel's**: always reads saturated. Useless, and it is funny, and it is the only way to learn one
  thing about Keel's water in Act 3.
- **Lamb's own**: condition 4; it talks in Lamb's own voice, which nobody has heard before.
Taking a hair is a scene with the person. Pollard's hair, once removed, goes in an envelope; the note
m.pollard is lost if it was pencilled.

## 10. The Lamps of Gullet

Gullet's lamps are the town Lamb can rebuild. Each **lamp** has states, needs and effects. Changing a
lamp is a choice about who can see whom, which colour reads, who works and who pays. The town
remembers every lamp at the epilogue.

| Id | Lamp | States | Needs to change | Effect |
|---|---|---|---|---|
| l.steps_post | The old paraffin post at the top of the steps | dark, paraffin | s.wick, i.paraffin; Fennick's leave (it is on the Congregation's steps) | The steps' light rises to 0.4 paraffin: colour reads at the top of the steps; the Lamplighters see the steps |
| l.brine_porthole | The Brine's broken porthole lamp | broken, mended | s.bottle_glass or s.crown_glass, s.brass | The yard is lit: no more overhearing in the yard unless fog |
| l.gut_wires | The Gut's wire lamps, half out | half, full, dark | s.copper_wire x2; Marrow's or Spratt's word | The Gut's palette cycles full; the gutter's colour shows; the Guild favour +1 |
| l.balance | The lamp on the town balance, weigh-house roof | dark, lit | s.wick, i.paraffin; a climb (GRIP 6) | A light the whole quay can see that is not the Trust's; the Board favour -1, Guild +1 |
| l.drowned | A lantern in the drowned lamp | out, lit | i.lantern left there before 23:52 | Act 1 epilogue line; a ship sees it; the Low Company favour +2 |
| l.mother | Mother | dark, burning (green), burning (true) | Restrike (Act 1); true glass (Acts 2 and 3) | Section 7 of SYSTEMS.md; the beam in fog |
| l.quay_sodium | The three sodium lamps | on, off | The quay switch | Blackout rules |

Acts 2 and 3 add the hill's white lamps, the Gasholder's candles, the Ropewalk's paraffin and the Old
Light itself.

## 11. The room above the Brine

Sabine lets Lamb the room above the bar from 00:00 on Act 1 (a chit a night, or free if the slate
is wiped). It has a stove (dry, warm, Cold -2 per 10 minutes), a bench (fitting), a bed (sleep only at
dawn), and a wall. The **wall** is the case board: every evidence fact Lamb holds can be pinned, and
the wall's arrangement is shown as a picture, not a graph: papers, the green prism on a nail, a chalk
line from the steps to the drowned lamp. Pinning two facts side by side can offer a CARBON or SUM
line written for that pair (a `pair` record in the data). The room changes over the three nights:
things people send up, things that go missing.

## 12. Tide Runs and Squalls

### 12.1 Tide Runs

A run is real-time movement on a walkable place under one hazard, with a game clock that runs at a
fixed rate (default 1 game minute per 4 real seconds) and a goal. Lamb moves with the walk controls;
`run` (hold) spends Cold. KNEES, BALLAST and GRIP, at their effective levels when the run starts, set
speed, slip chance windows and climbing time. There is no randomness: slips happen on marked frost
or weed tiles when BALLAST is below the tile's number, and the player can see the tiles.

| Hazard | How it moves | What it does |
|---|---|---|
| water | The tide line advances on the tide curve | Wading slows by depth; above the knee costs Cold; above the waist ends the run (lose) |
| frost | Frost tiles marked white | Below BALLAST n, Lamb slides one tile toward the edge |
| dark | Light radius only from carried lights | Edges are invisible outside the radius; walking off an edge ends the run (lose: in the harbour) |
| pursuer | A follower moves on a path and has a sight cone (the seen rule) | Seen for 3 seconds: lose (written down) |
| climb | Stairs or a ladder; climbing speed from GRIP and KNEES | Cold and Wear rise per flight |

Every run has a `win` node and a `lose` node. Losing is never death: it costs time, dryness, an item,
or a witness, and plays a scene.

Act 1 runs:

| Id | Run | Hazard | When | Goal | Lose |
|---|---|---|---|---|---|
| r.gully | The gully back | water | Leaving the drowned lamp after 23:30 | Reach the steps before the water passes the waist | Swept, soaked, the Damp saturated, an item lost, 20 minutes |
| r.fish | Turning the fish | water | 23:40 to 23:48, if Lamb sides with the fish | Lever the fish into the channel with the children | The fish is stranded for the gulls; the children's book pays out against Lamb |
| r.shadow | The Lamplighter's shadow | pursuer, dark | Any blackout with Hobb or Gorm on the quay | Reach the weigh-house office window unseen | Lamb is in Gorm's book (m.watched offered; guise blown) |
| r.frost | Frost on the mole | frost, climb | 04:30 to 04:50, Movement III | Reach the lamp room before the hammer | The lens is broken (an Act 1 fact that changes the dawn cause and Act 2) |

### 12.2 Accessibility

Settings: runs at full speed; runs at half speed; stepped runs (the world waits between moves). The
outcome rules are the same in each mode.

### 12.3 Where runs live in the script

A node starts a run with `run: id`. The engine plays it and jumps to its win or lose node. The
script never contains real-time logic.

### 12.4 Squalls

A squall is a dialogue set piece in a dangerous place. Its options are ordinary and untimed, but every
option also moves the world: the water rises a step, the frost cracks, the wind gusts. Checks in the
next node are made in the world the last choice left. In Act 1: Keel and the hammer in the lamp room
at 04:50 (Movement III), and the after-vote turning on Lamb at 01:00 if the Guild was named at
midnight.

## 13. Reputation, cover and the Read

### 13.1 Favour

Seven factions hold **favour** toward Lamb, from -3 to +3: `board`, `trust` (the Trust, the
Municipal and the Lamplighters), `guild`, `congregation`, `lowco`, `brine`, `shelf`. Favour opens
documents, doors and silence, and pays for HAT strain.

### 13.2 The Read

Each faction also holds a **read**: what it believes Lamb is. The read changes how people speak to
Lamb and which options exist.

| Faction | Reads |
|---|---|
| board | cheque (start), nuisance, threat, ally |
| trust | auditor (start), useful, enemy |
| guild | flatfish (start), nose (one of us), informer |
| congregation | pilgrim (start), seer, thief |
| lowco | hangman (start), witness, one of us |
| brine | customer (start), regular, trouble |
| shelf | diligent (start), delayed, insubordinate |

### 13.3 Guises

Lamb's **guise** is what a stranger takes Lamb for, from the clothes and company: `shelf` (the
default), `floor` (muddy, wet, oilskinned), `pilgrim` (a bell jar), `lamplighter` (the dark coat),
`keeper` (the oxblood coat), `guild` (a blindfold round the neck). Guises open and shut doors and
lines. A guise is **blown** when someone who knows Lamb sees through it in light, or when Gorm's book
has Lamb's name and the guise is lamplighter. Blending: in fog over 0.05 or blackout, a Lamb in any
guise other than shelf is not picked out of a crowd (the seen rule treats Lamb as one of the walkers).

### 13.4 The Tab

Sabine keeps a slate of who owes whom; Lamb keeps one too. When Lamb does someone a real favour
(Dilly's bet, Orrin's letter, Hobb's second lantern, Pip's shilling), that person goes on the Tab
(`v.tab_<char> = 1`). A person on the Tab works for Lamb once per movement, chosen from the Daybook:
**watch** a place (an event reports who came and went), **carry** a rumour to a district (the
rumour's pressure there rises without Lamb being heard saying it) or **fetch** a thing Lamb cannot
be seen fetching. Each use can cost them: a watcher seen by the Lamplighters goes in Gorm's book,
and the Tab entry is spent. The Tab is Low Water's asset network: small, local, run on debts the
town already understands.

## 14. The Record: memory of everything said

- `say: id` records a statement Lamb made: the node, the place, the hour, who was present (by
  character schedule), and whether a Lamplighter could see or hear (the seen and overhear rules).
- `lie: id` records the same and marks it a lie.
- Present characters remember it (`heard(char, id)`). Factions of those present learn it.
  Lamplighters who heard it write it in Gorm's book (`book(id)`).
- What is said also adds rumour pressure (SYSTEMS.md section 8) for the facts it names.
- People quote Lamb back. A character's lines can test `said(id)`, `heard(who, id)` or `lied(id)`.
- Contradictions: when Lamb says something that contradicts a recorded statement in the hearing of
  someone who heard the first, the script can catch it (`said(a) & say b`), and the person enjoys it.

## 15. Progression: pages

Lamb does not level up by doing; Lamb understands. Authored moments of understanding grant a
**page** (`page: 1`). Act 1 holds 12 pages. A page buys one trained rank in a voice (up to the cap) or
one Margin slot, or rubs out a Margin note. Section 19.4 adds gate pages (one per gate resolved, by any route) and chapter pages (every fourth page raises a compartment).

## 16. Hooks the world-state needs

For the engineer: everything a condition or command can touch. Full syntax in LWD1-FORMAT.md.

| Hook | Kind | Read by | Written by |
|---|---|---|---|
| clock, night, tide, fog, rain, wind.dir, wind.speed, temp, frost | Environment terms | Conditions, voice modifiers | The night schedule |
| light, sodium (at the current place) | Environment terms | Conditions, modifiers | Lamps, power, carried light |
| power.quay, mother, lamp.<id> | Zone and lamp states | Conditions | `cmd: setPower`, `cmd: restrike`, `lamp:` |
| skill.<voice>, comp.<pen/coat/hat/nose>, kit.<instrument> | Effective levels | Conditions, checks, voices | Training, items, notes, environment |
| meter.cold, meter.wear, meter.dread | Meters | Conditions, modifiers | `meter:` and the rules in section 5 |
| wet (0 to 1), soaked, drunk | Conditions | Modifiers, conditions | `cmd: wet`, drinks, the rules |
| favour.<faction>, seenas.<faction>, guise | Reputation | Conditions | `favour:`, `seenas:`, clothing |
| has(fact), item(id), worn(id) | Possession | Conditions | `set:`, `give:`, `take:`, `wear:` |
| margin.<id> (none, pencil, ink) | The Margin | Conditions | `offer:` and the player |
| quest.<id> (stage number) | Quests | Conditions, Daybook | `quest:` |
| said(id), lied(id), heard(char, id), book(id) | The Record | Conditions | `say:`, `lie:` |
| here(char) | Presence | Conditions | Character schedules and `move:` |
| v.<name> | Script variables | Conditions | `var:` |
| precedent | Character creation | Conditions | Creation |
| seen | Whether Lamb is seen now | Conditions, interface | The seen rule |
| rumour.<fact> (in the current district) | Rumour pressure | Conditions, the Glass | `cmd: addRumour`, `say:` |

## 17. Interface notes

- A voice line shows the voice's name in small capitals, then the line. No colour code per voice; the
  type face and the name carry it.
- A visible check shows `[VOICE target, pencil|ink]` and Lamb's level, with the terms of the sum on
  hover or a held key. A strain control appears beside it.
- The Daybook has tabs: Notes (evidence and what people said), Claims (quests, by stage), Margin,
  Kit (instruments and fittings), Clothes, Lamps, Town (favour and reads, as sentences: "The Guild
  thinks you are a flatfish").
- The three meters are marks on the Daybook's edge, visible when the Daybook is open and as a small
  edge mark in play when a meter is at 7 or more.

### 17.1 What the talk screen must do for the writing (for the UI and UX lead, 2026-10-17)

The author: "a seamless and intuitive UI and UX experience ... coupled with a powerful, deep, and
moving story." The talk screen carries most of the game's words, so it is built around them.

- **Line types are distinct at a glance, without colour alone.** The screen must tell apart narration
  (no speaker, the report voice), a person's line (name in small capitals), a voice (one of sixteen,
  name in small capitals in the voice face, never coloured per voice), and an instrument (CANDLEMAS,
  THE GLASS, THE DAMP, THE ALMANAC, THE VANE: a different face or indent, because they are objects
  talking). Voices often argue in pairs (PRIDE, then SALT, then PRIDE); a run of consecutive voices must
  read as an argument, stacked close.
- **Pacing.** Lines arrive one at a time on input, never as a wall. A quiet beat after a moment is
  part of the writing: a scene that ends on narration with no options holds until the player moves on,
  with no prompt competing. Long scenes (the ledger, the low room, Keel's question) are two to six
  lines, so pace matters more than volume.
- **Choices.** Options read as the player's words. Kinds:
  - plain options;
  - visible checks, shown as `[VOICE target, pencil or ink]` with Lamb's level and the sum on hover or
    a held key, plus a strain control (+1 to +3 and what it costs);
  - claims, which name the evidence held;
  - talk exits mid-fight.
  A failed pencil check stays in the list, greyed with its reason ("the weather has not changed"), so
  the player knows it can come back. Ink checks are marked as one try.
- **Passive voices** speak in the flow with no "check passed" notice. The player learns their sheet by
  who speaks.
- **Ownership of the screen.** The camera slides to the speaker (CAMERA.md). Portraits are optional;
  the painted world stays visible behind the text, because the world is lit and the lighting is
  story. In a fight, voices bark one line at a time at the screen edge and never stop the action
  (18.9).
- **Memory.** The Daybook (Notes, Claims, Margin, Kit, Clothes, Lamps, Town, and now the sheet and
  tools) is one key away, and every line spoken can be re-read in a scroll-back. What someone said is
  evidence, and the player must be able to find it.
- **Never shown:** tallies after a check, numbers over heads, a meter bar over the world, or a "you
  failed" banner. The person shows why in the scene.

## 18. The Fray: real-time combat

Added 2026-10-16 on the author's direction. Clean-room rule: behaviour is learned from
`cleanroom/spec/` (written by the clean-room study role from public sources and play sessions)
and from public sources; the games' files are never opened; every name, number and animation here
is original. Where a cleanroom spec lands that changes the feel targets below, the spec wins on
feel and this section is updated; the fiction and the consequences stay ours.

### 18.1 The feel

Close, heavy and deliberate. Every action commits Lamb for its full animation; nothing cancels into
anything except a dodge, and only after the action's committed part. Breath (stamina) pays for
attacks, dodges and blocks, and runs out in a few exchanges, so a fight is a matter of spacing,
reading the other person and choosing the moment. Opponents telegraph. Fights happen on the
walkable plates (the floor, the quay, the weigh-house, the lamp room, the Gut's lanes) at the scale
of the place. Two or three opponents is a lot.

### 18.2 Lamb's numbers

Superseded by section 19.2 (one sheet, four combat pillars). The table below is the first form.

| Number | From | Notes |
|---|---|---|
| Standing (health) | 6 + 2 x COAT | At 0 Lamb is **Down** (18.7). Recovered by rest, food, a stove |
| Breath (stamina) | 4 + KNEES | Recovers when Lamb is not acting; max falls by 1 per 3 Cold |
| Poise | BALLAST | Hits taken before a stagger; frost and wet stone lower it (the 2.1 modifiers apply) |
| Weapon reach and weight | GRIP | A tool heavier than GRIP allows swings slow and costs double Breath |
| Recovery | Wear | Breath recovers a step slower at Wear 6 or more |
| Field of view | Dread | Dread 7+ narrows the view; THE DARK speaks more |

### 18.3 Actions

| Action | Breath | What it does |
|---|---|---|
| Light strike | 1 | Fast, short; chains up to three in the tool's rhythm |
| Heavy strike | 2 (charged 3) | Slow; breaks guard and poise; charged, it knocks down |
| Sidestep | 1 | A short quick step with a brief window in which a blow does not land |
| Roll | 2 | Longer; in water or mud it becomes a lurch and the window shrinks |
| Block | 1 per blow held | With the case, a lid, a pole; heavy blows drain it |
| Catch (parry) | 1 | A timed block that opens the opponent for a riposte; the claims case is the best catching tool in Gullet |
| Shove | 1 | Pushes an opponent a step: into water, off a step, onto frost |
| Grapple | 2 | Seize the opponent's tool or arm; a contest of GRIP |
| Use | 0 | The pocket thing: the lantern thrown, snuff in a face, a rum bottle |

### 18.4 Tools: the harbour's weapons

No swords. Lamb fights with what Gullet leaves lying about, and each tool says something about Lamb
to whoever sees it carried (it sets the guise, like clothing).

| Tool | Class | Character | Where in Act 1 |
|---|---|---|---|
| The claims case | Shield and blunt | Slow, catches everything; papers spill on a heavy hit | Starts with Lamb |
| The Vane's folding stick | Light | Quick, weak; the Vane complains at every blow | Starts with Lamb |
| A boathook | Long, pulls | Reach; a heavy pulls an opponent off their feet | The mole steps; Merrow's boat |
| A Lamplighter's brass pole | Long, sweeps | Sweeps the legs; Municipal property, and the Trust notices | Hobb, or taken |
| A gutting knife | Short, fast | Quick and cruel; carrying it changes how every faction reads Lamb | The Gut |
| A lump hammer | Heavy | Slow; breaks guards, doors and lenses | The weigh-house store, until Keel takes it at 04:15 |
| A storm lantern | Use | Thrown, it lights the ground and can set oil burning; then it is gone | Starts with Lamb |
| A coil of rope | Use | Thrown at the legs; ties a downed opponent | The Low Company |

Tools have **condition** and wear like the Kit: a pole bends, a knife dulls, the case splits. They
are mended and improved at the bench with salvage (`s.brass` binds a haft, `s.tin` caps a pole,
`s.copper_wire` wraps a grip). An improved tool takes one **fitting** (a weighted head, a hooked
tip) that changes its moves.

### 18.5 Moves learned from people

Lamb does not level up by fighting. Lamb learns a move from someone who knows it, in a scene:
Merrow's hook-pull (the boathook's heavy drags), Marrow's gutter's feint (a light strike that reads
as a heavy), Gorm's pole sweep (only if the Trust thinks Lamb useful), Nan Cockle's mud-step (no
penalty to the sidestep in water), Sabine's stool rule (any chair is a shield, once). Each costs
favour, a chit or a confession.

### 18.6 Opponents: who fights in Gullet

People are never monsters. Every opponent wants something and can be talked to before, and often
during, a fight. A beaten opponent yields, flees or goes down, and remembers.

| Faction | Who fights | How they fight | When they fight Lamb |
|---|---|---|---|
| The Lamplighters | Gorm's crews (Fewell, Bright, Strand, Coe) and Hobb | In pairs with brass poles: one sweeps, one pins. They mean to arrest, not to hurt. Strong under sodium, lost in blackout | Trust favour -2 or worse, a guise blown, Lamb caught in the office |
| The Board's tide-wardens | Keel's two bailiffs from Hesk, with boathooks and a chain | Slow, heavy; they pull Lamb toward the water | Board favour -2 or worse, Movement II on |
| The Guild's knives | Gutters, and the Pan-Bearer who carries the voting pans | Blindfolded in the dark, by smell; quick knives, eel-strings like whips. Downwind of them Lamb is found; upwind Lamb is not | The after-vote squall if Lamb is read as an informer; the Gut at Guild favour -3 |
| The Low Company | Salvors with crowbars and rope; Lugg, very tall | Dirty: mud thrown, rope at the legs, the tide used on purpose | Taking their copper; the floor, if Lamb wrote "wreckers" at midnight |
| The Congregation | Zealots under bell jars | Slow; heads armoured by the jars. A heavy breaks a jar, and the zealot is suddenly a frightened person in the rain | Taking a relic; relic 113 shown to the Lamplighters |
| The town's own strippers | Sallis and the Board's wardens with Pruett, Boddy, Hask and the Penroses; Lugg where Act 2 breaks him (Acts 2 and 3) | Crowbars, hooks and rope; neighbours who have read the claim as a licence | Act 2: the stranded ships at Second Water. Act 3: the Old Light, the balance and Mother in the gale (decided 2026-10-17: no Hesk crew) |
| Animals | The Gut's dogs, the gulls at the fish, eels in the gully, the conger in the drowned lamp | A pack, a swarm, a single great thing in a hole | Act 1, optional |

Principals (bible section 7) never die in a fight. They yield, go down or win.

### 18.7 Going down

At Standing 0 Lamb is **Down**. The fight ends and a written scene plays by where and against whom:
the Lamplighters' cells; the floor with the water at the chin and Merrow hauling; the Brine, with
Sabine adding it to the slate; the gutter. Down costs time (20 to 60 minutes), an item or a tool,
Cold or Dread, and a Record entry (`down.<where>`). It never ends the game.

### 18.8 The environment fights too

- **Water**: wading slows everyone by depth; a shove at the tide line puts a person under for a
  moment; the rising tide ends floor fights on its own schedule.
- **Frost**: frost tiles cost poise for both sides; a heavy on frost can slide the striker.
- **Light**: under sodium the Lamplighters see and Lamb is seen; in blackout only carried light
  shows, a lantern makes its holder the target, and THE DARK hears footsteps. Rain douses a thrown
  lantern.
- **Wind**: on the mole a gust over 20 m/s staggers anyone mid-swing; smell carries downwind, so the
  Guild's knives find Lamb by it.
- **Smoke and fog**: the smokehouse and the 03:00 fog shorten sight; voices and SMELL replace it.

### 18.9 Voices in a fight

Voices bark one line at a time and never stop the action: BALLAST on footing ("Frost under the left
boot."), GRIP on the tool ("The haft is cracked. The next heavy splits it."), UNDERTOW on a feint
("He wants you to block."), SMELL downwind ("Eel-oil and fear, on your right."), SALT on the tide
("Water at the ankle in twenty seconds."), THE DARK in blackout, KNEES when Breath is low, PRIDE
when Lamb is wet and losing. After a fight the voices argue about it in the next node: violence is
talked about, never only scored. Passive levels give readable edges: SMELL warns of an opponent
behind Lamb downwind; UNDERTOW lengthens the window for reading a telegraph; THE DARK outlines
opponents in blackout; CARBON replays the blow that just landed.

### 18.10 Consequences: violence in the Record

- Every fight records `fought.<encounter>`, and `struck.<char>` for each named person Lamb hit,
  with place, hour and witnesses by the seen and overhear rules (section 14). A Lamplighter
  witness writes `book.violence`.
- Favour: striking a member of a faction costs 1 favour with it (2 if they were yielding); being
  seen to defend one earns 1.
- The Read: the Guild reads a Lamb who fights well in the dark as "nose"; the Trust reads any
  violence as "enemy"; the Low Company reads a Lamb who fought beside them as "one of us".
- People remember: lines test `struck.<char>`; bruises show in later scenes.
- Margin notes earned by fighting in Act 1: **A Body Is Also Evidence** (CARBON +2 about a fight
  Lamb was in; offered after the first fight), **The Pole Has Two Ends** (a wider Catch window with
  long tools; offered by Gorm's crews), **Downwind** (SMELL warns earlier in the Gut; offered by the
  Guild's knives).
- A Down scene is Record too: the town knows where the assessor was found, and how wet.

### 18.11 Encounters in Act 1

| Id | District | When | Against | Kind | Talk or run instead |
|---|---|---|---|---|---|
| e.dogs | Gut | the middens, any time | The Gut's dogs, three | Optional | Shadwell's snuff; a fish given |
| e.gulls | Floor | 23:40 to 23:48, at the fish | A gull swarm | Optional, inside r.fish | Dilly's children with lanterns |
| e.eels | Floor | the gully after 23:30 | Eels in the water | Optional, inside r.gully | Keep to the ribs of the wreck |
| e.salvors | Floor | the drowned lamp | Lugg and two salvors | **Set fight** if Lamb takes the copper; else optional | Merrow's word; give the copper back |
| e.conger | Floor | inside the drowned lamp | The conger | Optional | Leave it its hole |
| e.afterdark | Weigh-house | the 00:30 squall, if Lamb is read as an informer | The Pan-Bearer and two gutters, blindfolded, lights out | **Set fight** if the squall turns | Blindfold on: fight on their terms with SMELL +3 |
| e.brawl | Brine | the Wet Hour | A brawl over the provisional cause | Optional: join, stop or watch | Sabine's fork; HEARSAY turns it |
| e.lamplighters | Quay or weigh-house | caught in the office, a guise blown, Trust -2 | Two Lamplighters with poles | Optional until begun | FORM LETTER; the run r.shadow |
| e.wardens | Quay | Movement II on, Board -2 | Keel's tide-wardens | Optional | The harbour office door; Crake's name |
| e.hammer | Mole | 04:50, the lamp room on frost | Keel with the hammer | **Set fight**: a struggle, not a duel. Keel is frightened, the floor is ice, the lens is behind him | Talk changes its shape: he breaks only the green rings, or Wenna takes his arm |

Three set fights in Act 1 (e.salvors when the copper is taken, e.afterdark when the squall turns,
e.hammer always). The night decides most of the rest.

### 18.12 Data hooks (for the combat engineer in game/engine/combat/)

Content will write, in the engine's LWD/1 dialect:

```
@foe f.lamplighter        name, faction, standing, breath, poise, tool, moves, sight, yields (condition)
@weapon w.pole            name, class, weight, reach, condition, moves, guise
@encounter e.lamplighters name, area, foe (repeatable: id n), when, win, yield, fled, down (nodes), param lines
do: fight(e.lamplighters)
```

`fight(id)` hands control to the combat layer, which returns to `win`, `yield` (opponents gave
in), `fled` (Lamb ran) or `down` (Lamb went down). It sets `fought.<id>`, `struck.<char>`,
`book.violence` when a Lamplighter could see, and reports which tools broke. Tuning numbers are the
combat engineer's; the fiction, the opponents and the consequences are the director's.

## 19. Character building: one sheet

Added 2026-10-17 on the author's direction (verbatim): "leaning heavily into the No Rest for the
Wicked/Elden Ring style combat and character building, on top of the story and RPG elements similar
to Disco Elysium and Zero Parades: For Dead Spies". This section puts an action-RPG build on top
of the dialogue RPG. Clean-room rule as in section 18. The study role's CHARACTER-BUILDING.md,
written from the reference's data, sets the feel targets for load, scaling curves and upgrade
pacing; where it lands, it wins on feel and the numbers below are updated. Every name and number
here is ours. Combat mechanics are the combat engineer's; the look is design/LOOK-UNIFIED.md.
Fights happen in place, in the painted world, at the place's own scale.

### 19.1 The decision, and how it was tested

The question: should the combat attributes be the existing sheet, or sit beside it?

I tested three alternatives in a small model (director's scratchpad, `build/model.py`). It grows
each play style over 30 pages and scores a toy combat power plus how many of its own checks it can
pass. It is a model, not a playtest. The combat engineer's arena and the harness replace it once
the mechanics exist.

| Alternative | What it is | Weakest style's combat power as a share of the strongest | How different the builds are (min distance, 0 = identical) | Does a page change combat? |
|---|---|---|---|---|
| B. A second sheet | Strength, agility and so on, earned by fighting, beside the compartments | 1.00 | 0.00 | No |
| C. Voices only | Tools scale with voices; compartments do nothing in a fight | 0.55 | 0.30 | Through voices only |
| A. One sheet, first form | Compartments and voices drive both; COAT carries the body | 0.18 to 0.55 | 0.29 to 0.35 | Yes |
| A, with a pillar per compartment and soft caps | Each compartment owns one way of winning a fight; returns halve past 6 | 0.55 | 0.15 to 0.51 | Yes |

What the test showed:
- **B is rejected.** Every build fights alike. The dialogue sheet and the fighting sheet never touch,
  so a Tongue Lamb and a Fist Lamb differ only in conversation. That is the "beside" the author asked
  us to avoid, and it would pay Lamb for fighting, which section 18.5 refuses.
- **C is rejected.** It couples the two, but raising a compartment does nothing in a fight, and builds
  differ only in which tool they hold.
- **A is taken.** In its first form, with COAT as the only body attribute, a pure PEN or pure NOSE
  Lamb had about a fifth of a COAT Lamb's power, so the Eye and Shadow styles were not real in a fight.
  The fix was a **combat pillar per compartment** (19.2) and **soft caps**, so hybrids do not run away.
  With both, all five styles land within about half of the strongest. The weakest is Tongue: its pillar
  ends fights sooner rather than surviving them. That is intended. Tongue's protection is the claims
  case (PRIDE scales the catch) and the talk exits, which end a fight outright, and the model does not
  count either.

Does not prove: the model's numbers are toys; balance is set in the arena. What the test settles is
the structure: one sheet, four pillars, soft caps.

### 19.2 One sheet: the four compartments are the four attributes

The compartments stay 1 to 5 at creation (section 7). Pages raise them to 10 over the game (19.4).
Returns halve above 6 (the soft cap). Every compartment drives checks as before and one combat pillar.

| Compartment | In conversation (unchanged) | Combat pillar | What it buys in a fight |
|---|---|---|---|
| THE COAT | Bearing, footing, dignity | **Endure** | Standing (health) 10 + 2 x COAT; Poise from BALLAST; the load limit (19.6); heavy tools' requirements |
| THE NOSE | Instinct, smell, the dark | **Evade** | The sidestep and roll windows lengthen with THE DARK and SALT; footing on wet and frost; downwind warnings (SMELL); sneak openings |
| THE PEN | Reckoning, papers, reconstruction | **Read** | Telegraphs read earlier (UNDERTOW and CARBON lengthen the read window); a blow read in time opens a weak point (CARBON, PRECEDENT); Breath costs fall with SUM ("knows where to stand"); the Kit reads in a fight (19.8) |
| THE HAT | Manner, people | **End** | Opponents yield sooner (CONDOLENCE, FORM LETTER, HEARSAY); Composure, the pool that pays for learned moves and talk exits mid-fight, is 4 + 2 x HAT; PRIDE scales the claims case's catch |

Derived numbers. These replace the table in 18.2; the combat engineer tunes the constants.

| Number | From |
|---|---|
| Standing | 10 + 2 x COAT (soft-capped) + clothing protection |
| Breath | 6 + KNEES + NOSE / 2; each swing costs less by SUM (to 40 percent off at most) |
| Poise | BALLAST + clothing; frost and wet stone lower it (2.1) |
| Composure | 4 + 2 x HAT; filled by landing blows, catching, and voices that read the fight right; spent on learned moves and on talk exits |
| Read window | base + UNDERTOW + CARBON; the opponent's telegraph shows this much earlier |
| Weak point | a hit in the read window deals extra by CARBON and PRECEDENT, capped |
| Evasion window | base + THE DARK + SALT; shrinks with load (19.6) |
| Yield threshold | the opponent's own yield rule (18.6), raised by the sum of HAT voices, so a well-spoken Lamb ends fights while the other person still has standing |

Meters and weather still apply on top. Cold lowers Breath, Wear slows recovery, Dread narrows the
view, and wet lowers PRIDE and so the case.

### 19.3 Tools scale with voices

A tool has a **requirement**, the compartment value needed to wield it properly, and **scaling**,
the two voices whose levels raise its damage or effect. Below the requirement a tool swings slow and
costs double Breath (18.2's GRIP rule, generalised). Scaling grades are words: *strongly*, *fairly*,
*slightly*. Training a voice with pages pays in both places at once. GRIP opens a door in conversation
and drives the hammer; PRIDE keeps a clerk honest and makes the claims case catch.

### 19.4 How Lamb levels: pages, earned by understanding and by resolving

Lamb does not level by killing. A night's investigation has two kinds of progress, and both pay a
**page**:
- **Understanding** (section 15, unchanged): authored moments when Lamb sees what something means.
- **Resolving a gate**: every gate (a fight, a locked door, a crowd, a squall) pays one page the
  first time it is resolved, by whichever route: fought, talked down, slipped past, rigged or read.
  The route-neutral page keeps all five styles levelling at the same rate. Losing does not pay, and
  going down never pays; the town remembers it instead.

Spending:
- One page buys one trained rank in a voice (cap: the compartment's value, plus 1 per inked Margin
  note that raises it).
- Every **fourth** page is also a **chapter page**, which raises one compartment by 1 (to 10, soft cap
  above 6), on top of the page's rank. (Set to every third on 2026-10-17, back to every fourth the same
  day once chapter raises ran in the engine; see the decision below.) Builds stay distinct because compartments rise slowly.
- One page buys a Margin slot or rubs out a note (section 6).

Pace, set 2026-10-17 by what the builds need, not by a page total. A committed build should
reach a compartment at 8 by mid Act 2 and at 10 by late Act 3. From a primary of 4 that is 4 chapter
raises by mid Act 2 and 6 by late Act 3, so 12 and 18 pages at one chapter per three pages. Measured
with the corrected gates (harness, one shuffle per build):

| Build | End of Act 1 | End of Act 2 | End of Act 3 |
|---|---|---|---|
| Fist | 10 | 17 | 25 |
| Tongue | 10 | 17 | 30 |
| Shadow | 13 | 17 | 28 |
| Hands | 15 | 22 | 34 |
| Eye | 12 | 17 | 23 |
| Random, 10 seeds | 6 to 11 | 7 to 16 | 9 to 21 |

Every build passes 12 pages early in Act 2 and 18 early in Act 3, so the targets hold for all five.

**Decision, 2026-10-17 (chapter raises running in the engine): every fourth page.** The archetypes
start their main compartment at 5, not 4, so every third page brought 10 by the end of Act 2 for all
five builds (Hands by the end of Act 1). Against the measured page counts:

| Interval | Main compartment at mid Act 2 | At the end of Act 2 | Pages to reach 10 |
|---|---|---|---|
| Every third page | 9 or 10 | 10 for all five | 15 |
| Every fourth page | 8 for four builds, 9 for Hands | 9 (Hands 10) | 20 |

Every fourth meets the targets: 8 by mid Act 2, and 10 arriving in Act 3 rather than before it. The
second breakpoint (19.11a) stays something earned in the gale.
Act 2 is even (17 to 22). Act 3 spreads (23 to 34), because Hands and Tongue resolve more of its
gates. Eye still reaches 10 by late Act 3, and the extra pages only buy ranks and Margin slots.

Why this mechanism and not the others:
- **Not a 44-page target.** One path resolves only part of an act's gates, so 44 would mean pages for
  activity, not progress.
- **Not two-page big wins.** They widened the gap, since the builds that win set pieces already lead.
- **Not a cheaper rank cost.** Ranks still need to be scarce choices.
- **What was used:**
  - a chapter page every third page;
  - understanding gates on the facts the low-gate routes reach: Act 1 the early claim, the low light,
    the pink lamps, the lying clocks, Wenna's confession, Jory and Keel's motive; Act 2 the dead line
    and the yellow card; Act 3 the band's breath, Nan's door and the pedestal;
  - the two Act 3 rows the draft missed (the band lamps and the hill station).

**Re-filing the case.** At each daylight page Lamb may take back every page and spend them again:
the day's sleep re-files the case. It costs nothing but the choice. It keeps experimentation free,
which suits a game about getting the account right.

The Daybook shows Lamb's level as "pages filed", never as a number over the head.

### 19.5 Tools found in the world

No swords. Tools are what Gullet uses for work, and carrying one sets a guise (18.4). Classes:
**case** (shield and blunt, catches), **light** (fast, short), **long** (reach, pull or sweep),
**heavy** (slow, breaks guard and poise), **use** (thrown or spent). Each tool takes one **fitting**,
which changes its moves, and has a **temper** of 0 to 5, worked up at a bench (19.7).

| Tool | Class | Needs | Scales with | Character | Act, where, how |
|---|---|---|---|---|---|
| The claims case | case | COAT 1 | PRIDE strongly, FORM LETTER slightly | Catches everything; papers spill on a heavy hit | 1, starts with Lamb |
| The Vane's folding stick | light | none | SUM fairly, THE DARK slightly | Quick and weak; the Vane complains | 1, starts with Lamb |
| A gutting knife | light | NOSE 3 | THE DARK strongly, GRIP slightly | Quick and cruel; every faction reads it | 1, the Gut, Shadwell's bench (taken or bought) |
| A boathook | long | COAT 2 | GRIP fairly, SALT fairly | Reach; a heavy pulls a person off their feet | 1, the mole steps, Merrow's boat |
| A Lamplighter's brass pole | long | COAT 3 | BALLAST fairly, FORM LETTER slightly | Sweeps the legs; the Trust notices | 1, Hobb, or taken from a crew |
| The weigh-house lump hammer | heavy | COAT 5 | GRIP strongly, BALLAST fairly | Breaks guards, doors and lenses | 1, the weigh-house store, until Keel takes it at 04:15 |
| A storm lantern | use | none | none (CANDLEMAS reads what it lights) | Thrown, lights the ground, can fire oil | 1, starts with Lamb; Sabine sells more |
| A coil of rope | use | none | GRIP slightly | Thrown at the legs; ties a downed person | 1, the Low Company |
| A marlinspike | light | PEN 2 | CARBON fairly, GRIP slightly | Short; finds the gap in anything knotted or riveted | 2, Merrow's boat, after he trusts Lamb |
| An eel spear | long | NOSE 3 | SALT strongly, SMELL slightly | Three tines; holds a person at reach in water | 2, the Gut, Agnes Spratt's wall |
| A stripper's crowbar | heavy | COAT 4 | GRIP fairly, UNDERTOW slightly | Pries and hooks; a heavy pulls a guard down | 2, the Spit, the Patience's deck (taken or given) |
| A tide-warden's chain | long | COAT 4 | BALLAST strongly | Wraps a leg; drags toward water | 2, the quay, the wardens (taken in a fight, or Keel's gift) |
| An oar | long | COAT 3 | KNEES fairly, SALT fairly | A wide sweep in water; floats | 2, the boats at the mole steps |
| A Congregation bell jar | case | COAT 2 | PRIDE slightly, CONDOLENCE fairly | A helmet you hold; catches, and rings | 2, the Gasholder, Sister Gauze |
| The Glass, carried | use | PEN 3 | none (the Glass reads gusts) | Not a weapon; the next gust is called a beat early | 2, fitted at a bench (19.8) |
| A cooper's beetle (mallet) | heavy | COAT 6 | GRIP strongly, KNEES fairly | The heaviest thing in Gullet that is a tool | 3, the Ropewalk yard |
| A fid (splicing spike) | light | PEN 3 | SUM fairly, CARBON fairly | Hester's; reads a rhythm and lands in it | 3, the Ropewalk, Hester (given) |
| The Old Light's bronze key | case | COAT 3 | PRIDE fairly, SALT fairly | A hundred years of salt; it never bends | 3, the Old Light, if the gear is saved |
| A gasholder spanner | heavy | COAT 5 | GRIP fairly, SUM fairly | Two heads; a heavy turns an opponent | 3, the Gasholder frame |
| A boat's tiller | long | COAT 3 | SALT strongly, BALLAST slightly | Swings low; the gale makes it fly | 3, the mole steps, a wrecked boat |
| A sack of salt | use | none | none | Thrown, it blinds; on ice, footing for Lamb only | 3, the Gut, the salt store |

Twenty-one tools: eight in Act 1, seven in Act 2, six in Act 3. Every style has a primary and an
alternative in each act.

### 19.5a Movesets, specials and fittings: every tool plays differently

Depth comes from tools that move differently, from fittings that change how a tool plays, and from
teachers whose moves combine with both. Numbers come last. Each tool below has its own light string,
its own heavy, and a **special** (its art, paid from Composure, which the engine calls grit). Each
fitting changes a move or a property, never only a number. Records are in content/act1/combat.lwd
and content/act1/gear.lwd.

| Tool | Light | Heavy | Special | Fittings (one per tool) |
|---|---|---|---|---|
| Claims case | Two edge-shoves | Overhead slam; papers spill and blind for a beat | **Brace**: held, the next blow is caught by itself, and the riposte is a word (it opens a talk exit at once) | Brass corners: the slam breaks poise. Oilcloth: papers never spill, and PRIDE holds in rain. Arm strap: the case rides the forearm, so a second tool can be held and still catch |
| Vane's stick | Three flicks, the fastest string in Gullet | A lunge that pins a foot for a moment | **Weathercock**: after a gust, the next three strikes cost no Breath | Tin tip: the lunge breaks a lantern glass or a bell jar. Weighted knob: the string becomes two half-heavies. Cord loop: thrown and pulled back |
| Gutting knife | Three cuts, the last a drawing pull | Steps in under a guard | **Open**: from behind or from a sneak, a paired strike that makes an unnamed opponent yield on the spot and a named one stagger; it never kills | Oiled edge: faster, dulls sooner. Eel-skin grip: never slips wet. Hooked blade: cuts a rope or a net, and the heavy takes the opponent's tool |
| Boathook | Two thrusts | Hook and pull: the opponent comes to Lamb, off their feet | **Haul**: hook and swing the opponent into water or off an edge, which ends the fight for them | Barbed hook: the pull holds them two seconds. Cork float: it floats, and in water the thrusts become sweeps. Short haft: closer, faster, no pull |
| Brass pole | Two thrusts | A low sweep that takes both legs | **Ring**: strike the pole on stone. Lamplighters know the call and hesitate; zealots flinch | Tin cap: the ring stuns a zealot. Lantern hook: carries a light on the pole's end, held away from Lamb in a blackout. Split end: two tines that catch a tool |
| Lump hammer | One slow chop | A charged overhead that breaks a guard and knocks down | **Break**: smash a prop (a door, ice, a lens) or the opponent's tool | Weighted head: more poise damage, slower. Short haft: quicker, closer. Tarred grip: a wet hand keeps it |
| Storm lantern | Thrown: lights the ground; fires spilled oil | Held up: light in a blackout, and Lamb becomes the target | **Douse and throw**: put the room's light out, then throw, so the opponents stand lit and Lamb does not | Shutter: a beam that blinds the one it falls on. Spare fill: two throws |
| Rope | Thrown at the legs | Lasso a tool | **Tie**: bind a downed opponent, which ends their part | Weighted ends: thrown like a bolas, at reach. Tarred: holds in water |
| Marlinspike | Two stabs at the joints | Wedges a guard open | **Unpick**: strip a strapped thing: a bell jar's strap, an apron, a chain's shackle | Sharpened: the stabs land through a guard. Lanyard: never dropped, even when Lamb goes down |
| Eel spear | Three jabs | Pin: holds the opponent at reach; they cannot close | **Shallows**: in water, a strike at the feet that staggers anyone wading | Barbs: a pin holds longer. Long haft: more reach, no close jab |
| Crowbar | Two hooking blows | Pries a guard down; can take the tool | **Lever**: lever a cask, a plank or a sluice gate onto opponents | Claw end: hooks a rail, so Lamb cannot be shoved off a ledge. Taped: quieter (noise down) |
| Warden's chain | Lashes in a wide arc, at reach | Wraps a leg and drags toward water | **Anchor**: wrap a bollard; anyone crossing the arc trips | Weighted end: lashes knock down. Shackle: a wrapped leg stays wrapped |
| Oar | A wide sweep | Blade slap: knocks back, splash blinds | **Pull water**: in water, one stroke moves Lamb two metres at once | Copper sheath: the slap breaks a guard. Leathered grip: sweeps cost less Breath |
| Bell jar | Jar bash | Ring: everyone close flinches | **Under the jar**: raised over the head, blows to the head land on glass for five seconds, and Dread falls | Padding: more catches before it cracks. Cracked glass: shatters once as a flash that blinds everyone near |
| The Glass, carried | No strike | No strike | **Read the fall**: a beat before a gust, time slows for Lamb alone | Re-silvered: it calls the gust earlier. New needle: it calls the wind's turn too |
| Cooper's beetle | No light string | Two-handed overhead | **Drive**: charged, a stamp that knocks down everyone close; or drive a plank like a wedge and pin an opponent to a wall | Iron band: the stamp breaks guards. Long handle: more reach, slower |
| Hester's fid | A four-beat string; the fourth lands in the read window by itself | A twisting stab that opens a weak point | **Splice**: after a catch, three strikes chain at no cost | Polished: quicker. Bone: silent (no noise) |
| Old Light's bronze key | Two short raps | Turn: a twisting blow that staggers | **Lock**: jam the opponent's tool in their hands for three seconds | None. It never bends, and it starts at temper 3 |
| Gasholder spanner | Alternates the blunt head and the hooked one | Turn the opponent, so their back is to Lamb | **Tighten**: on a frame or valve, open a steam or gas vent that scatters everyone | Adjustable jaw: takes a tool off the opponent. Long throw: more reach, slower |
| Boat's tiller | A low swing at the knees | Gale swing: strongest downwind | **Come about**: a swing that turns Lamb round and hits both sides | Iron cap: the low swing knocks down. Lanyard: thrown and pulled back |
| Sack of salt | Thrown: blinds | Poured: a line of footing | **Footing**: on ice or frost, a patch where Lamb keeps poise and opponents do not | None |

**Combinations** are where builds come from. Teachers' moves stack with tools and fittings:
- Merrow's hook-pull with a barbed hook, a boathook that drags and holds.
- Lugg's shove-through with the warden's chain, a drag that ends in the water.
- Pip's turn with an oiled-edge knife, a sidestep that ends behind the opponent for Open.
- Hester's carriage return with a polished fid, a catch that turns into a free string.
- Tobit's count with the Glass, a read-window burst timed to the gust.
- Hobb's guard with a lantern-hook pole, a light that also blocks.
- Bright's gallery hold with a claw-end crowbar, unmovable on the mole's rail.
- Rook's reset with the brace, a step back that leaves a talk exit open.
- Fisk's snare with tarred rope, a snare that holds in the floor's water.

### 19.6 Clothing as armour, and the load

Clothing (8.1) gains two combat properties: **protection** (Standing added, blows softened) and
**weight**. The load is the weight carried against a limit set by COAT. The combat engineer takes the
bands from the clean-room COMBAT-FEEL spec (section 1.1):
- **Light** (well under the limit): the quick sidestep.
- **Medium**: the roll.
- **Heavy**: a lurch with a long recovery.

**A soaked coat counts as weight.** The weather is part of the build. A Wader Lamb in oilskin stays
light in rain, and a dry greatcoat turns heavy after the floor.

| Piece | Protection | Weight | Note |
|---|---|---|---|
| The Shelf greatcoat | 2 | 3 (6 soaked) | PRIDE +1 while dry |
| A borrowed oilskin | 1 | 2 (does not soak) | PRIDE -1 |
| Wenna's oxblood keeper's coat | 2 | 3 | KNEES +1 on stairs |
| A Lamplighter's dark coat | 3 | 4 | FORM LETTER +2 with the Municipal |
| Merrow's waders | 1 | 3 | Water does not slow the legs; BALLAST -1 on stone |
| A Congregation bell jar (worn) | 3 (head) | 2 | SMELL -3 |
| Sabine's mittens | 0 | 0 | GRIP +1 at Cold 4+ |
| A stripper's leather apron | 3 | 3 | Act 2, the Spit; the Low Company reads it |
| A tide-warden's sea boots | 2 | 3 | Act 2, the quay; Poise +1 on wet stone |
| Hester's knitted guernsey | 1 | 1 | Act 3, the Ropewalk; Cold rises slower; warm even wet |

### 19.7 The bench: salvage, temper and fittings

Benches: the room above the Brine (all acts), Merrow's boat (Act 2), Fisk's table in the
weigh-house store (Acts 2 and 3) and the Gasholder vestry (Act 3). Game minutes pass at a bench.
- **Temper** (0 to 5) raises a tool's damage and condition. Each step needs salvage. Tin and cork take
  it to 1 and 2. Brass and copper wire take it to 3 and 4. **Old bronze** takes it to 5, from two places: a tooth of the Old
  Light's turning gear (a piece for Lamb is a piece the town does not get), or the old brass collar from
  Mother's first lamp (Wenna would know it was gone).
- **Fittings**: one per tool, chosen from the tool's own list. A weighted head turns a light into a
  half-heavy. A hooked tip gives any long tool the boathook's pull. An oiled edge makes the knife
  faster and dulls it sooner. A copper wrap stops the grip slipping in rain. A tin cap makes a pole
  ring like a bell, which the Congregation hears.
- Tools keep **condition** and wear (18.4). The bench mends them. A broken tool is mended, never lost,
  unless a scene takes it.
- PEN and the Hands voices (GRIP, SUM) shorten bench time and unlock a second fitting slot on a
  temper-5 tool. That is the Hands build's craft depth.

### 19.8 The Kit in a fight; Margin notes as charms

Instruments are not weapons. Each reads one thing in a fight at its own condition: the Glass calls
the next gust, the Vane the wind's turn, Candlemas whether a thrown lantern will take, the Almanac
the seconds until the water reaches a floor fight, the Damp whether stone or ice is underfoot. An
Eye build fits them at the bench and wins by knowing a beat sooner.

Inked Margin notes (section 6) are the charm layer: each changes how Lamb fights under its tide.
Combat notes, by act:
- **Act 1**: A Body Is Also Evidence, The Pole Has Two Ends, Downwind (18.10), plus **The Stool Rule**
  (any chair is a shield once per fight; from Sabine).
- **Act 2**: **Second Water** (rolling in water costs no extra Breath; from Nan Cockle at the Spit)
  and **Salvage for the Insurer** (a beaten stripper drops a piece of salvage; from Sallis's docket).
- **Act 3**: **Eye Shut, Not Dark** (in blackout THE DARK outlines every opponent; from Wenna),
  **The Usual Rate** (once per fight a talk exit costs no Composure; from Hester) and **Thirty Seconds
  of Calm** (the first exchange after a gust is Lamb's; from the eye of the storm).

### 19.9 Moves learned from people (teachers)

Moves are learned in a scene, from someone who knows them (18.5), for favour, a chit or a
confession. Each costs Composure when used. Every style has a teacher in every act.

| Act | Teacher | Move | Styles |
|---|---|---|---|
| 1 | Merrow | Hook-pull: the boathook's heavy drags a person off their feet | Fist, Hands |
| 1 | Marrow | The gutter's feint: a light strike that reads as a heavy | Shadow |
| 1 | Sabine | The Stool Rule (a Margin note): any chair is a shield, once | Tongue, Fist |
| 1 | Nan Cockle | Mud-step: no penalty to the sidestep in water | Shadow, Eye |
| 1 | Gorm (Trust favour +1) | Pole sweep: a long tool's heavy takes both legs | Fist, Tongue |
| 2 | Lugg | Shove-through: a shove that carries into water or off a step | Fist |
| 2 | Dace | Oar sweep: a wide sweep that hits two | Fist, Hands |
| 2 | Fisk | Snare: the thrown rope ties the legs and stays | Hands |
| 2 | Rook | "I don't recall it": a step back that resets the opponent's read | Tongue, Eye |
| 2 | Pip | Tube-runner's turn: a sidestep that ends behind the opponent | Shadow |
| 3 | Hester | The carriage return: after a catch, the next strike lands in the read window | Eye, Tongue |
| 3 | Hobb | The lamp-carrier's guard: hold a light and block at once | Hands, Tongue |
| 3 | Tobit (under the Gasholder frame, after the eye) | Count the wind: three gusts, then the big one; be elsewhere on the fourth | Eye |
| 3 | Bright | The gallery hold: on a rail or ledge, a shove cannot move Lamb | Fist |

### 19.10 The five styles as builds

| Style | Compartments | Voices first | Tools | How it ends a fight | Depth |
|---|---|---|---|---|---|
| **Fist** | COAT, then NOSE | GRIP, BALLAST, KNEES, PRIDE | Hammer, beetle, crowbar, boathook, chain, oar, tiller | Breaks poise and wins | Four sub-builds with their own tools, fittings, teachers and notes. **Breaker**: heavy tools, poise and charged heavies; hammer then beetle; weighted heads; Lugg, Bright. **Puller**: long tools and water; boathook, chain, tiller; barbed hooks; Merrow, Lugg; Second Water. **Sweeper**: pole and oar against two at once; Gorm, Dace. **Brawler**: case and stool, shoves; Sabine, Lugg; the Stool Rule. The load decides sidestep or lurch, and the weather moves it in the night |
| **Tongue** | HAT, then COAT | CONDOLENCE, FORM LETTER, PRIDE, HEARSAY | The claims case, the bell jar, the Old Light key | Catches, then talks: a catch fills Composure, Composure buys a talk exit, and yields come early | A parry build: PRIDE scales the catch and wet clothes lower PRIDE, so staying dry is part of fighting. Teachers: Gorm, Rook, Hester, Hobb. Note: The Usual Rate |
| **Shadow** | NOSE, then COAT | THE DARK, SALT, SMELL, UNDERTOW | Knife, eel spear, the Vane's stick | Opens from a sneak (the strike from the dark) and never stands still | Light load, the sidestep, downwind play, blackout outlines. Teachers: Marrow, Nan Cockle, Pip. Notes: Downwind, Eye Shut Not Dark |
| **Hands** | PEN and COAT | GRIP, SUM, CARBON, SALT | Boathook, spanner, rope, lantern, salt, anything rigged | Uses the place: the sluice, the lamp, the frost, a snare | Bench craft: temper 5, second fittings, faster benches. Props in every encounter (the Fray's four ways). Teachers: Merrow, Fisk, Dace, Hobb |
| **Eye** | PEN, then NOSE | CARBON, UNDERTOW, PRECEDENT, SUM | Fid, marlinspike, pole, the Glass carried | Reads the telegraph and lands in the weak point | The Kit in a fight, read-window bursts, Breath efficiency. Teachers: Nan Cockle, Rook, Hester, Tobit. Notes: A Body Is Also Evidence, Thirty Seconds of Calm |

Every gate keeps its four ways through (section 18 and the path matrix), so no style needs another's
build to finish the night. A build is a way of being good at the night, never a key to it.

### 19.11 Placement plan for the content pass

Act by act, every tool, piece, material, bench and teacher above goes into the district that owns it:
- **Act 1**: quay, floor, Gut, weigh, mole, Brine.
- **Act 2**: the boats, the Spit, the Gut, the Gasholder, the Ropewalk, weigh2.
- **Act 3**: Ropewalk, Old Light, Gasholder, mole steps, Gut.

Upgrade salvage stays hand-placed and tide-limited (9.1), with old bronze rare and tied to a cost the
town feels. District writers are briefed only where a teacher needs a new scene (Pip, Rook, Bright,
Tobit, Hobb). The rest is records and one-line gives in existing scenes.

### 19.11a Min-maxing: focused builds play faster, spread builds stay viable

The author (verbatim): "With attributes scaling animation speed, and other variables. As well as
min-maxxing builds for efficient playthroughs." A focused build should feel efficient, and a spread
build should still finish the night.

- **Attributes scale speed.** The combat engineer defines the curves; the director sets the mapping:
  - COAT: heavy-strike recovery and stagger recovery.
  - NOSE: light strings, sidestep and roll startup.
  - PEN: how early a telegraph shows (the read window), plus bench minutes (faster tempering).
  - HAT: Composure regain, and talk-exit wind-up mid-fight.
  - Under a tool's requirement every animation slows (19.3).
  Speed is visible in the hands, so a COAT 9 Lamb swings a beetle like a cooper and a COAT 4 Lamb
  swings it like a clerk.
- **Breakpoints reward going deep.** Returns halve past 6 (the soft cap), but each compartment has
  two breakpoints that change play, not just numbers. At **8** the pillar gains a property: COAT 8,
  a heavy cannot be interrupted by a light; NOSE 8, a sidestep through a blow refills Breath; PEN 8,
  every telegraph shows its weak point; HAT 8, a talk exit can be taken without Composure once per
  fight. At **10** each compartment unlocks its tool class's second special (the beetle's stamp and
  the knife's Open, for example). Investing hard in one or two compartments is the efficient path.
  Spreading gives the four routes at every gate but no breakpoints.
- **Efficient routes.** A focused voice opens shortcuts as well as checks:
  - High GRIP climbs instead of walking round (Act 1 roof, Act 3 drainpipe).
  - High THE DARK slips past whole encounters (each encounter's sneak opening).
  - High FORM LETTER ends a gate in one line, instead of the two-step route.
  - High SUM and THE ALMANAC cut waits to the minute.
  Content tags these with `{verb: ...}` and gives the faster route a lower `cost:` in minutes, so an
  efficient build finishes a district sooner. Every gate keeps all its routes; a shortcut is
  never the only door.
- **Respec.** Re-filing at each daylight page (19.4) refunds every page. Tool temper and fittings
  move to another tool at the bench for the minutes alone, so a player can chase an optimal build
  without replaying.
- **What the build screen must show** (for the UI and UX lead):
  - each tool's requirement and its two scaling voices with their grades, plus the damage at
    Lamb's current levels and after the next page;
  - each compartment's pillar numbers, its speed effects and the next breakpoint;
  - the load band now and when soaked;
  - the fittings and their effects, the temper path and the salvage held;
  - the teachers' moves learned and where the rest are;
  - which checks and shortcuts in the current district a page would open.
  The level-up screen previews every number before the page is spent (the engine's
  `G.ext.combat.preview(levels)`).

### 19.12 Data hooks (for the combat engineer)

```
@attr coat ... pillar: endure            (nose: evade, pen: read, hat: end)
@weapon w.beetle   class, weight, reach, needs: coat 6, scale: grip strong, knees fair, temper: 0, fittings: weighted_head | hooked_tip, moves
@item c.apron      slot, protection, weight, soak, shed, warm, guise
@move mv.hook_pull from: merrow, cost: composure 2, tool: long, does: heavy drags
@fit  t.temper3    needs: s.brass 2, s.copper_wire 1, minutes: 20, gives: temper 3
gate pages: the engine pays one page on a gate's first resolution, by any route
```

Does not prove: none of this is tuned. The four-pillar structure came out of the model. Whether the
five styles feel equally strong is for the arena and the harness to show, with the build and
attentive policies extended to read 19.10.

### 19.13 Placement, as landed (2026-10-17)
Records: content/act1/combat.lwd (the six Act 1 tools with build fields) and content/act1/gear.lwd (15 tools, three clothing pieces, old bronze, temper and fitting recipes at four benches).
| Act | Where (node) | What |
|---|---|---|
| 2 | quay2.merrow.ok | Merrow's marlinspike |
| 2 | quay2.fight.wardens.win | The warden's chain and sea boots |
| 2 | quay2.oar (from quay2.boats) | A spare oar |
| 2 | spit.fight.strippers.win / .yield | A crowbar (win); young Penrose's apron (yield, Sallis); Lugg's shove-through (yield, Lugg) |
| 2 | gut2.spear | Agnes Spratt's eel spear, for a chit |
| 2 | brine2.dace | Dace's oar sweep |
| 2 | brine2.fisk.snare | Fisk's snare (with rope) |
| 2 | weigh2.pip.turn | Pip's tube-runner's turn |
| 2 | ropewalk.rook.reset | Rook's "I don't recall it" |
| 3 | ropewalk3.beetle | The cooper's beetle |
| 3 | ropewalk3.offer.yes | Hester gives Will's fid and jersey, and teaches the carriage return |
| 3 | oldlight (gear saved) / oldlight.bronze | The bronze key; a tooth of old bronze, at a cost to the Low Company |
| 3 | gasholder3.spanner / gasholder3.tobit.count | The spanner; Tobit's count |
| 3 | quay3.tiller | The tiller from the wrecked crabber |
| 3 | gut3.salt.*.ok | A sack of salt in hand |
| 3 | weigh3.hobb.guard | Hobb's guard |
| 3 | mole3.bright.hold / mole3.collar | Bright's gallery hold; Mother's old collar as old bronze |
Keel teaches nothing: his question on the mole keeps its quiet. Gate pages wait on the systems engineer's answer (19.4).


## 20. Live conversation and interrogation

The author, 2026-10-17 (verbatim): "It should not be turn based, it should be live action with
dialogue menus leading into either fighting, dialogue, or interrogation/communication ~ movement
should be fluid, and live action based".

A dialogue menu can lead to one of three things: more talk, a fight (`fight(e.id)`), or an
**interrogation** (`interrogate(x.id)`). An interrogation happens live, on the plate. The person
stays where they are and Lamb can move. The person says their own lies on their own clock. Two
gauges drive it, never shown as bars:
- **nerve**: how much true pressure the person can take before they tell.
- **heat**: how threatened they feel. At their bolt level they leave; at their swing level they fight.

Each play style presses differently:
- **Fist** threatens: big nerve loss, big heat.
- **Tongue** reads what they lost and says it back: steady nerve loss, little heat.
- **Eye** catches a lie as it is said, by holding the fact that breaks it: a large drop. A wrong catch steadies them.
- **Hands** puts the evidence on the table: the thing itself.
- **Shadow** already knows: it says where they were, or what they said when they thought they were alone.

Every interrogation has three endings, and each changes the night:
- **They tell**: the fact is set, and the person remembers how they were made to.
- **They bolt**: they leave the plate, and the fact has to be found another way.
- **They swing**: a fight begins, with its usual four ways out.

Walking away mid-scene is always allowed, and the person says so.

**Lines that survive a live world.** The main speakers each carry three short lines:
- **walk-away**: when Lamb leaves mid-line;
- **interrupted**: when an event cuts them off;
- **fight-start**: when a conversation turns into a fight.

The LWD/1 shape is being agreed with the systems engineer (NOTES-FOR-ENGINEER).

### 20.1 Where interrogation pays (Acts 1 and 2)

| Id | Act, place | Who | What they won't say | Fist | Tongue | Eye catches | Hands shows | Shadow knows | Bolt or swing |
|---|---|---|---|---|---|---|---|---|---|
| x1.merrow | 1, the Brine stove | Merrow | He was in the drowned lamp with a lantern that night (and when it was dark in there) | Collar him by the stove | What the Low Company lost when the copper went | "Never left the boat." against his wet thigh | The wet wick from the drowned lamp | His prints to the drowned lamp | Bolts into the yard; swings only if struck |
| x1.marrow | 1, the Guild hall after the vote | Marrow Dunlin | He pulled the quay switch for the vote | Lean on the pans | His father, and the switch that was never for the sea | "The switch was never touched." against the scales on the handle | The scales from the handle | What he said at Shadwell's fire-door | Swings (the hall is his) |
| x1.wenna | 1, the lamp room or the Brine | Wenna | She was not at the panel at twenty to ten | Never: a Fist press on Wenna makes her shut the door on Lamb (a bolt) | Twenty-eight years, the stairs, the knees | "I was at the panel." against the dry coat, or the log written ahead | The log, written before the hour it records | The motor she lifted her head to | Bolts, out of the lamp room; never swings |
| x1.hobb | 1, the weigh-house door | Constant Hobb | Who he saw at the quay board, and that he is not to say | Loom over him | That he will not be blamed, in the Board's own words | "Nobody past." against the scales on the switch | The duty roster in Gorm's book | Where he was standing | Bolts to Gorm; never swings |
| x2.rook | 2, the telegraph office | Rook | The 18:30 telegram's draft, and whose hand wrote 9.40 | Lean on the counter | That she is the only one who still reads the line | "I don't recall it." against the yellow 9.40 | The draft off the spike | That she reads the drafts aloud to herself at night | Bolts upstairs; never swings |
| x2.sallis | 2, the mole steps after the muster | Sallis | Who told him the Board pays for salvage | Take the crowbar out of his hand | That he has never stolen anything | "Board's orders." against the docket in his own hand | The Courier with the claim printed on it | What he read aloud to the men | Swings (the wardens with him) |

These six replace nothing. Each sits beside the scene's existing routes, so every gate keeps its four
ways through.

### 20.2 Reachability and Shadow's pace (2026-10-17)
- **Any style can work both scenes.** Merrow and Marrow now offer a press for every style that needs no fact, each a check on that style's own voice:
  - **Merrow:** CARBON at the bench (Hands), UNDERTOW's silence (Shadow), SUM against the Brine's clock (Eye). Fist and Tongue already had theirs.
  - **Marrow:** FORM LETTER (Tongue), CARBON at the long table (Hands), SMELL at his cuffs (Shadow), PRECEDENT (Eye).
  - The fact-gated presses stay, as the stronger option.
  - Merrow's scene opens once Lamb has asked him where he was tonight. Marrow's opens in the Guild hall.
- **Shadow's pace.** The Night Clerk now starts at NOSE 5 and HAT 2 (it was NOSE 4 and HAT 3). Shadow routes skip gates the other styles resolve, and it reached 8 only early in Act 3. With the new spread it reaches NOSE 8 a fifth of the way into Act 2 and 10 early in Act 3 (harness, one shuffle). It also has two new understanding pages on its route: the oven soot, and inside the Gannet house. The global pace is unchanged.

