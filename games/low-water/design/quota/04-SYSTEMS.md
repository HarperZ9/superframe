<!-- writing-profile: research -->
# The Quota, 4: systems

Part of [QUOTA-DESIGN.md](../QUOTA-DESIGN.md). A build spec for the gameplay engineer. The model stays
small so a designer can read it; its job is to be legible, never to be right about economics.

## 1. The community model

**Resolution.** The Upper Town is twelve streets; in era 2 the eleven villages are added as one row each.
Ten named households sit on named streets. The model advances one day per tick. Between scenes the clock
jumps and the model runs the skipped days. One era covers a season (era 2: one famine winter, about
ninety days).

**Stocks per street** (0 to 1 unless noted):

| Stock | Meaning | Shown by |
|---|---|---|
| `food` | Food held in the street's households | Bins, cupboards, plates at the narrow lens |
| `price` | Staple price, in shillings a loaf (number) | The board in the exchange |
| `wage` | A day's pay for the street's main work (number) | Pay packets, the hiring hall |
| `work` | Share of adults in work | Who is out in the morning |
| `hunger` | Share of people going without | Queues; thin faces at the narrow lens |
| `sick` | Disease, following hunger | The fever notice; the clinic queue |
| `crowd` | People per house | Washing lines; doors open; children on steps |
| `theft` | Theft and violence | Broken shutters; the cell log |
| `school` | Share of children at school | Children in the street in school hours |
| `faith` | Attendance at the Furrow Church and the Well House, separately | Full or half-full halls |
| `breakup` | Families separating or children sent away | Empty rooms; the children's home list |
| `drink` | Drinking and drug use | The Sheaf at noon; the estate's stairwells |
| `leaving` | Out-migration per season | Bags at the station; empty houses |
| `deaths` | Per season (count) | The burial ground's rows |

**Access per people per street** (0 to 1): `entry`, `own`, `credit`, `move`, `voice` (vote, testify,
print), `schooling`, `worship`, `protection`. **Standing per people per street** (−1 to +1): how the
street treats them (served, hired, stopped, housed). **Trust per institution** (0 to 1): council, police,
press, Furrow Church, Well House, relief office, bank.

**Rhetoric.** Each era has carriers with a `volume` (0 to 1): era 1 the professor and the sermon; era 2 the
paper and the district notices; era 3 the schoolbook; era 4 the campaign poster and the pub; era 5 the
feeds, the clip, the channel, the comment section. Each carrier pushes `standing` for a named people.

**Households** have their own `food`, `wage`, `debt`, `members` (by name), `sick`, `school`, `drink`,
`housing` (a named house), and an `end` state (rose, fell, left, ended, absorbed) resolved at era 5.

## 2. Rules (with delays)

Each rule is one line in a `@rule` record: a condition, an effect and a delay in days. The first set:

| Rule | When | Then | Delay |
|---|---|---|---|
| R1 quota | A village figure is reported | The district quota rises by the figure over the true yield | 0 |
| R2 requisition | Quota above what was taken | Requisition from the village's `food` | 7 |
| R3 export | The Directorate sells to Halvard | District grain leaves; `price` rises | 3 |
| R4 price | `food` across the district falls | `price` rises; hoarding (Orme) raises it further | 1 |
| R5 entitlement | `price` over `wage` for a street's work | That street's `hunger` rises (day hands and the Hesh first) | 7 |
| R6 sickness | `hunger` above 0.3 | `sick` rises | 21 |
| R7 deaths | `sick` and `hunger` both high | `deaths` | 14 |
| R8 theft | `hunger` rises | `theft` rises | 7 |
| R9 policing | `theft` rises | Patrols; `protection` falls for whoever the rhetoric blames; `trust` in police falls in their streets | 3 |
| R10 black market | `trust` in the council below 0.4 | Black market; `price` rises again | 7 |
| R11 school | `hunger` above 0.4 | `school` falls (children forage or work) | 7 |
| R12 faith | `deaths` rise | `faith` rises for a season, then falls | 30 / 90 |
| R13 breakup | `hunger` and `crowd` high | `breakup` rises | 30 |
| R14 drink | `work` falls | `drink` rises | 30 |
| R15 leaving | `hunger` high and `move` open | `leaving` rises | 14 |
| R16 passes | Passes required | `move` falls to near 0 for the named people; R15 stops | 0 |
| R17 rhetoric | A carrier's `volume` | `standing` of its target people falls in every street it reaches | 7 |
| R18 standing to access | `standing` below −0.3 | `entry`, `credit` and `protection` fall for that people | 14 |
| R19 credit | The bank's map shades a street | `credit` 0 there; houses unrepaired; `crowd` rises | 60 |
| R20 closure | The mill closes | `work` and `wage` fall in its streets; `drink` and `leaving` rise | 30 |
| R21 blight | `crowd` high and repairs none | The council's survey calls the street blighted | 180 |
| R22 clearance | A blighted street and a vote | Clearance order; households evicted | 30 |
| R23 correction | A true account reaches someone outside the chain (an inquiry, the paper, the archive) | `trust` in that carrier changes; a lie's effects stop where it is caught | 7 |

Couplings run in both directions where history says they did: the black market feeds `price`; policing
feeds `theft` in the long run through lost trust; the clearance feeds the next era's `crowd` elsewhere.

## 3. How the record enters

Every lie, evasion, truth and spoken position is a record event with a type, a victim and an effect
bundle. The reckoning module (`game/engine/rules/reckoning.mjs`) already logs gaps with their cause and
clock; it extends to name a victim household and a street.

| Event | Example | Effect |
|---|---|---|
| `report.figure` | Walter Mott writes 310 for 190 | R1, then the chain; victim: the Haldanes |
| `blame.people` | The shortfall blamed on Hesh hoarding at the meeting | R17 on the Hesh, volume +0.3 for a season; victim: Tomas |
| `certify.cause` | "Intestinal illness" | Hides R7 from the district's count; R23 cannot fire until the certificate is found |
| `cut.story` | The photograph spiked | The paper's `volume` for the truth stays 0; trust unchanged |
| `hold.grain` | Orme's night carts | R4 raised |
| `refuse.pass` | The cart turned back | R16 for that household |
| `spoken.slur` / `spoken.position` | The player's option at a dinner or meeting | R17 for the target; the record quotes it |
| `truth.costly` | The true figure reported | The village blacklisted (requisition doubled); trust in the reporter's line rises; the record keeps it |

Both routes do damage (Decay constraint 2): `truth.costly` hurts a named household as surely as a lie
does, somewhere else.

## 4. Decay, as output

No meter, bar or score, hidden or shown. Each stock and access value maps to things the player can see:

| Value | What changes in the world |
|---|---|
| `hunger`, `food` | Plate contents at the narrow lens; queue length; stall count |
| `deaths` | Burial ground rows (prop states); black armbands on figures |
| `crowd` | Plate variant per house; washing lines; people on steps |
| `school` | Children on marks in school hours |
| `leaving` | Empty houses (variant); bags at the station |
| `standing`, `access` | Who is served (shop marks), who is stopped (police marks), signs on doors |
| `trust` | Who goes into the council and church; graffiti |
| Era variants | The street sign, the table, the bowls, the scale, the fence (PITCHES 3c) |

## 5. Wide and narrow lenses

- **Wide:** `camera: wide` on a region plate of the Upper Town per era and per state. Crowds are
  impostors driven by the street stocks: painted crowd layers per state, or glyph crowds (the glyph
  renderer's crowd edges exist). The official figure per street is drawn as an in-world document (a
  ledger line, a map label), never a meter.
- **Narrow:** a household interior plate at the close camera, with prop states, the old heads and the
  portrait dialogue boxes.
- **Moving:** the player picks a door in the wide view; the ink-blot transition (merged at 6d53155)
  takes them in, and out again, with the clock running. The record keeps what was seen from each lens.

## 6. The record, the read-back and the world record

- **The record:** the reckoning log plus every record event above, with clock, place, victim and the
  character's own words.
- **The read-back** (pillar 5): a typed document, scrolled, read flatly, unskippable. Five hinges with the
  names beside them; every lie, promise and denial; each inner line beside what happened (What they tell
  themselves rule 4).
- **The world record** (pillar 2): a file beside the saves, never cleared by a new game: names harmed,
  lies told, stones, end states, the line said in the previous run. A new run seeds from it (a stone with
  a name; a comment under the clip quoting the previous character; the table in the antique shop).
- **No escape hatch** (pillar 1): one save slot per run; reckoning choices are ink choices with an
  autosave first; ink mode exists in `save/save.mjs`.

**Revised 2026-10-22 (game director; design/spine-plan/02-WITNESS.md, 03-FATES.md).**
- **Fates are decided by people.** `@fate` records (world/community.mjs) name a pressure, the household, the
  decider and the scene. The model only presses: `pressure(<id>)` is true once the pressure held in its
  window. The scene's node calls `fate(<id>)`, which takes the bowl and records `fate.<id>` with the decider.
  A household rule that writes bowls, taken, members or end is refused by the loader. `tools/fatecheck.mjs`
  checks that the decider speaks, that every scene has two ways out and the player can move between them,
  that a held pressure's scene played, and that every bowl that left a table left by a person's decision.
- **The read-back is a witness scene.** `@witness` records (world/witness.mjs): who tells it, to whom, where,
  what she could have seen (reach), who told her the rest (sources), where she never was, and beats that each
  answer named state. Self-lies are echoed word for word in the beat they belong to; she talks over them and
  nothing marks them true or false. The old document survives as the oracle `tools/witnesscheck.mjs` reads:
  every row that would have printed is answered by a beat played, or declared unwitnessed. No verdict from
  the narration, three figures at most, unskippable, and it ends on an effect. Save version 5 moves an open
  read-back to the witness.
- **No numbers on the player's surface** (`@meta numbers: off`): the HUD says the wind in words, the fight
  strip keeps bars and drops numerals, the lens panel shows no levels.

## 7. Class paths and the lore graph

- `@route` records: a place, document or person, gated on class, era and optionally a choice (PITCHES 3c
  table of exclusive finds and routes).
- `@lore` records: `id`, `layer` (surface, deep, hidden), `where`, `requires` (fragments, class, choice,
  prior-run fact), `gives`. The Haldane chain in PITCHES 3c is the first graph.
- **`tools/lorecheck.mjs`** (new): plays the builds and classes like `eventcheck`, then checks that every
  fragment is reached on at least one run, every hidden chain is completable within its rule (one class;
  two classes; a class and a choice), and every cross-run fragment names the earlier fact it needs.

## 8. What to build, and where

| Piece | Where | New or extended |
|---|---|---|
| The model | `game/engine/world/community.mjs`; records `@street`, `@household`, `@rule`, `@carrier` in LWD/1 | New |
| Era props | `@prop` with states by era and condition, on plate marks | New |
| The world record | `game/engine/save/worldrecord.mjs` | New |
| Record events | Extend `rules/reckoning.mjs` with victim and street | Extended |
| `communitycheck` | Plays recorded events forward and prints each chain with its delays | New |
| `lorecheck`, run ledger | Above | New |
| Validators and lints | The LWD validator, `eventcheck`, `exitcheck`, `clocklint`, the pacing tool, `dialogue_lint`, `articulate dialogue` | Kept; `tidelint` retired |
