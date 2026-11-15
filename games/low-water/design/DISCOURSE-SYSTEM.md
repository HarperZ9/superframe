<!-- writing-profile: research -->
# Low Water: the town's discourse, as a system

Story lead, 2026-10-21. Companion to `design/THEMES.md`. The town's information ecosystem
as something Lamb plays: claims carried by notices, sermons, ledgers, telegrams and tavern talk;
an examination that asks questions and returns evidence; a rumour that grows because frightened
people need it. Records: `content/act1/themes.lwd` (the `lantern` var) and the claim records in
each act's files.

The game is not a verification tool and does not teach one (author, 2026-10-16: "the game does not
need to be tied to verification in any way whatsoever"). It shares a vocabulary with Radar because
both are about the same thing a harbour town is about: who said it first, and who repeated it.

## 1. The rule: evidence, never verdicts

The game never stamps a claim TRUE or FALSE. No voice says "this is a lie". An examination returns
provenance: who first said it, when, who repeats it and whether they are separate, what words it is
built from, and what would change Lamb's mind. The player decides what to believe. The people who
trusted the wrong source live with it, and so does Lamb.

This is Radar's rule (its README: "Radar gives evidence, never verdicts") moved into fiction.

## 2. Claims and where they are carried

A claim is a `@fact` with the prefix `cl.` and an `about:` line in the town's own words. Carriers:

| Carrier | Register | Act |
|---|---|---|
| The Board's notice board on the quay | Capitals, official, dated | 1, 2, 3 |
| The Hesk Courier (read aloud in the Brine; quoted on the board) | Headline | 1, 2 |
| The Congregation's refrain and its broadsheet, THE FILAMENT | Liturgy | 1, 2 |
| The Guild's ledgers and the chalk board | Figures, names | 1, 2 |
| Rook's telegrams | STOP | 2, 3 |
| Brine talk | Overheard | all |
| The Shelf's typed replies | Typed, the bent e | all |

The notice board keeps engagement as chalk: people tick a notice they agree with. WRECKERS has
forty-one ticks by Act 2. Penhallow's log line pinned beneath it ("LIGHT ON WRONG BEARING") has
three. Nobody ticks a correction.

## 3. The Lantern Man

The town's rumoured attacker: the wrecker who walks the floor with a lantern and shows a false
light when Mother sleeps. He does not exist. He is born on Low Night from four things that do:
Keel's claim ("malicious darkening by wreckers"), the low light that Lamb and the Saint Cuthwin
saw, Teague's report that Merrow said he'd "see her blind", and the Low Night song about the Kell.

He grows because each principal's guilt has a place to go in him. Marrow pulled the switch;
Wenna did not climb; Keel signed; Crake struck a clause; the Brine cast green glass. If the Lantern
Man darkened Mother, none of them did. The town would rather have a monster than a chain of small
decisions, and the rumour is how it gets one.

Mechanics:
- The rumour fact is `cl.lantern` (rumour pressure by district, as any fact).
- `var.lantern` counts Lamb's own testimony: +1 each time Lamb repeats wreckers, the Lantern Man,
  or the song to someone; -1 each time Lamb puts a named decision in his place in someone's hearing.
- People read it. At `lantern >= 2` the Brine talks of him by name; at `>= 4` the Board's wardens
  carry lanterns on the Spit "for the Lantern Man", which is how the strippers dress on Night 2.
- On Night 3 the men who go up the mole to put Mother out are the town's own, and they carry a
  lantern because the story told them what a wrecker looks like. The claim made the crime, and the
  rumour gave it a costume.
- At the last vote the room is offered him as a verdict ("Write the Lantern Man and be done"). It
  is the comforting monster and the room will cheer it. Lamb can give it to them.
- Merrow's lantern in the drowned lamp, the one that turned the ferry, is the nearest thing the
  Lantern Man has to a body: a thief who saved forty people. The five unexplained minutes stay
  unexplained (bible 12).

## 4. The examination

When Lamb meets a claim on a carrier, the option "Look at it properly" opens an examination hub.
Lamb asks; the answers are evidence. Each question is owned by one voice of THE PEN or THE HAT, and
each answer sets a provenance fact. The voices ask questions in the examination; they do not give
conclusions.

| Question | Voice | Sets | Radar sign it mirrors |
|---|---|---|---|
| Who said it first, and when? | PRECEDENT | `cl.<id>.first` | Provenance; media age (first uploaded long before the post that shows it) |
| Who else says it, and are they separate? | SUM | `cl.<id>.copied` | Coordination: the same text from several accounts; organic baseline |
| What is it made of? | SMALL PRINT | `cl.<id>.words` | Language: rhetoric markers, dehumanising words, the words that matched |
| Who gains if it is believed? | THE CHIT | `cl.<id>.owner` | Sources: who owns the outlet |
| What would change my mind? | CARBON | `cl.<id>.test` | Every sign's "does not prove" line; a stated way to be wrong |

Then Lamb may pin the claim in the Daybook with a stance, `var.cl_<id>`: `credited`, `doubted` or
`open`. The stance is a said-thing in the Record; people quote it. `open` is not a fence (it does
not add to `lean_dry`) when the examination reached its test; it is a fence when it did not.

Writers' rules:
- An answer is a fact in the world: a time struck on a telegram form, the same nine words in three
  places, a word chosen. Never "this proves".
- The same claim can be examined by people in the town. Gorm examines Lamb's own words in her book
  with the same five questions, aloud, at the quay at dawn. The method is not Lamb's property.
- A failed check on a question plays a scene too: Lamb gets a wrong answer and is not told.

## 5. Fallibility, both ways

The method must never become the new authority.

- **The careful check is wrong once (Act 2, the ice vote).** Forty Guild voices chant the same nine
  words, "the Captain's way, the Captain's dark, the Captain's price", from the hall, the gutter and
  the stalls. SUM flags it as copied text from many mouths, which it is. It is also a song the Gut
  has sung for thirty years: an organic chorus, not a coordinated one. A Lamb who reads it as a
  planted line misreads the room. This is Radar's organic-baseline problem: the same words from many
  people can be a campaign or a culture, and the count alone cannot tell them apart.
- **The crank is right once (Act 1 and Act 3).** Orrin Teague, drunk, nine years waiting for a boat,
  says on Low Night that the Lantern Man will go up the mole "when the gale comes, because that's
  when they'll pay for it". Every check says he is a drunk repeating a song. On Night 3 the wardens
  go up the mole with a lantern. He was right for a reason he did not know: the rumour made it true.
- **The checker as power.** Gorm's book, the town's most careful record, is evidence at the trial in
  the Brine (THEMES.md T4). Rook's spike holds every message the town ever sent; she decides which
  one Hesk is calm enough to read. Hester types the Shelf. Each is a truth-tool that became power.

## 5a. Dreams are claims too

Lamb's dreams between nights (THEMES.md 9a) are examined with the same questions as the town's
rumours. Who said it first: Lamb, asleep. Who else says it: nobody, or the Glass. What would change
the assessor's mind: a board with other than forty-one ticks. The method treats the believer and the
sceptic alike, and in one case (the forty-one) it cannot explain the dream away. It records that as
unexplained and stops there.

## 6. What this mirrors in Radar, and what it does not

| Radar | In Gullet | Shared term |
|---|---|---|
| Coordination: the same text from several accounts | The same nine words on the notice, in the Courier and in a warden's mouth | Copied text |
| Organic baseline on coordination | The Guild's chant | Organic chorus |
| Provenance; media age | The claim telegraphed three hours before the dark | First said |
| Language signs with the words that matched | SMALL PRINT names the words ("malicious", "wreckers", "Farsider") | Words that matched |
| Sources: owner of an outlet | THE CHIT: who gains if it is believed | Owner |
| Does-not-prove line on every sign | CARBON's question: what would change my mind | Way to be wrong |
| Evidence, never verdicts | No stamp; the player pins a stance | Stance, not verdict |
| Never calls anyone a bot | Nobody is called a liar by the system; people call each other liars, often wrongly | |

The game does not measure anything, and no claim here is about Radar's precision. The mirror is in
vocabulary and in rules, not in function.

## 7. Placement

| Act | Carrier | Claim | Where |
|---|---|---|---|
| 1 | The Board's notice on the quay | `cl.wreckers`: WRECKERS EXPECTED LOW NIGHT | `quay.lwd` |
| 1 | Teague in the Brine | `cl.lantern`: the Lantern Man | `brine.lwd` |
| 1 | The Congregation's refrain on the steps | The light came out of the filament into the deacon | `quay.lwd` |
| 2 | The notice board, with chalk | WRECKERS, forty-one ticks; Penhallow's log line, three | `quay2.lwd` |
| 2 | The Guild's chant on the ice | The organic chorus | `gut2.lwd` |
| 2 | The founders' ledger | The Kell showed the light (the song), and the ledger | `gut2.lwd` |
| 3 | The Shelf's reply, and the town's belief in it | FURTHER LOSS ANTICIPATED | `ropewalk3.lwd` |
| 3 | The room at the last vote | Write the Lantern Man and be done | `brine3.lwd` |
