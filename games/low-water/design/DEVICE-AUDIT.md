<!-- writing-profile: research -->
# The device audit: writing, reading and bookkeeping, replaced

Weighted-devices pass, 2026-10-23, on branch `feat/weighted-devices`.

The author's directions, verbatim, 2026-10-23:

- "All aspects that rely upon writing notes, and unintuitive game mechanics and poor story telling mechanics and
  devices should be replaced with ideas that are more practical and weighted/impactful in a physical, mental,
  emotional, or sensory sense."
- "Bookkeeping should not be a part of the plot". This overrides the first brief's "keep the plot exactly":
  wherever the plot itself ran on paperwork, the plot changes. The stakes stay (scarcity, who eats, blame,
  complicity, the fire, the dead, each character's flaw), and so do the endings' emotional outcomes and the
  five-era arc.

The rule this pass applies: no device depends on the player reading a document, a ledger or a count. The story
reaches the player through weight, sound, touch, bodies, changed places and changed people. A character may still
say a number, or read something aloud in a scene, when it carries feeling; nothing in the plot turns on it.

## 1. How the audit was made

`tools/devicecheck.mjs` reads everything the player is shown and lists each device that works by writing, reading
or bookkeeping (its rules are in section 4). Run on dev at `f8ecbe2` it found 206: hand 14, inscription 50,
figure 19, paperwork verbs 25, document props 13, props with no sense 51, journal 8, fates and world facts never
shown in the world 26. The per-era tables below add what a lint cannot see: plots that turn on a figure, a list or a
signature; hidden rules; two-class gates; effects that show only on a later run. Each row says where the device is,
what it carries for the story, and why it is weak. The replacement follows on the same row.

The era tables are in `design/device-audit/` (era 1, era 2, eras 3 to 5, the engine and the shell), one file per
owner so the passes could run side by side. Section 5 counts them.

## 2. The systems built (engine, reusable, story-agnostic)

| System | Records | What the player meets | Where |
|---|---|---|---|
| Sensory cues | `@sense id` with screen (shake, tint, vignette, dim, blur, flash), sound (from `audio/sfx`, placed near, far, through a wall, underfoot), caption, rumble pattern, posture, camera push or dip, hold | The moment lands in the body: the screen moves, the pad answers, the figure flinches | `world/senses.mjs`, played by `ui/senseplayer.mjs` |
| Weight and encumbrance | `@load id` (kilograms, never shown), `@scale id` (a balance with two pans) | The walk slows, the figure bends and then staggers, each sack lands in the pad; a scale's arm drops or rises | `world/burden.mjs`; the people layer reads `gait()` and the posture |
| World-state echo | `@echo id` with place, condition, era range, what it tells (a fate, a world fact, a flag, a lore fragment), what it shows (an empty seat, an absent person, a changed posture, a door, a sound, the light) and one sensory line | Coming back to a place, the consequence is there: a chair nobody pushes in, a dog that does not come, a mother who stands differently | `world/echo.mjs`; the runner puts the line at the top of a scene, the shell shows it on foot |
| A hand on a thing | `carries:` and `touch:` on a `@prop` (hold, cut, tie, lift, press, wipe, turn, open, smell, listen) | The thread held, cut or tied, with its sound and its rumble; the sack lifted | `world/props.mjs`, `world/verbs.mjs` |
| Discourse by hand and voice | acts `repeat`, `challenge`, `silence`, `answer` | Shout with the crier, shout him down, scrub the chalk goat off a door, stand on his crate and say what you saw | `world/discourse.mjs` |
| Twelve body sounds | `thud drag pour creak snap snip knock breath heart latch chair drip` | The sounds the cues use | `audio/sfx/body.mjs` |

The shared senses, loads and the exchange scale for all five eras are in `content/quota/senses.lwd`. Each system
is data in, behaviour out, with its own tests (`tests/senses.test.mjs`): another game uses them by writing records.

The menu lost its Journal page and the story writes nothing into a journal (`@meta journal: off`). Under
`numbers: off` the growth toasts no longer count pages to spend; the story's `@sense growth` plays instead.

## 3. Plot changes

Each decision, with its reason. The full scene work is in the era files; this is the record.

### 3.1 The instrument of era 2 is the exchange scale, not a figure on a sheet

- **Was.** Walter Mott writes three hundred and ten over a hundred and ninety on the barns' return; Ned holds the
  sheet to the window; the district meeting is eleven chairmen reporting figures to Commissioner Pask; the player
  reports the true figure, an inflated one, or one blamed on the Hesh.
- **Now.** The quota is set at the exchange scale on Exchange Square, in front of the relief queue. Walter Mott, the
  brigade clerk who works the scale, has wedged a flat iron under the sack pan so the barns' carts weigh heavy. The
  player finds it with his hands: the sacks come up too easily (a famine sack is half chaff), and the arm drops as
  if they were full. The hinge is the weighing before Pask. True: pull the wedge out, or leave the carts light, and
  let the whole square see how little there is (the review follows: the squads go round again with bayonets).
  Inflated: leave the wedge, let the arm drop, and Pask is pleased (the requisition comes for grain that was never
  grown). Blamed: leave it, and when Pask asks where the rest is, point up the hill.
- **Why.** The lie becomes a thing in the world the player can feel, hold and pull out, and the hinge happens in
  front of the people it starves. Pask, Krall's three-forty as boasting carts heaped to the rails, Mott's terror and
  his wife's collarbones all stay. The wedge also gives era 5 an heirloom a family can keep in a tin.
- **Kept.** `q_figure` keeps its three values; the community events and the fates downstream of them are unchanged.

### 3.2 What the player knows is what his body has met

- **Was.** `q.true_in_hand`: the figure in pencil, Anni's tally sheet, the log written true, the count in the
  inspector's book. The talk-out at the granary door was reading the real figure through the gap.
- **Now.** The same flag means the player has met the bare truth with his body: his hand on the rock in Tesk's fold,
  the light sacks lifted, the wedge in his coat, his arm in every bin on the hill. At the granary door the talk-out
  is testimony and the sacks themselves: he drags the barns' own sacks to the door and opens the wicket so the
  square sees them stencilled for the train, and he says what he saw on the hill.
- **Why.** Testimony is the spine's ending (resolve by testimony). A figure read through a door was a document.

### 3.3 Orders, passes and logs become a man at a door

- **Was.** The order on the nail, typed in Arlen; passes given to the chairmen's carts; the tally board; the cell
  log; signatures for four sacks.
- **Now.** Holt says the order to his men's faces at dawn. The pole lifts for the faces the post knows (Mary goes
  through because Will knows her husband's hat). Sacks are carried off the cart by the player's own arms, with
  their weight. The cell log becomes Tomas's cap, which Will keeps.
- **Why.** "A man signing an order becomes a man standing at the granary door deciding who goes in." Every decision
  has a person and a body in it.

### 3.4 The cross-era contract (ids kept, meanings changed)

| Id | Was | Now |
|---|---|---|
| `q.fact.ledger`, `q.lore.ledger` | The return with 190 overwritten as 310 | Walter's wedge under the barns' pan (the inspector finds it) |
| `q.fact.notebook`, `q.lore.notebook` | Tesk's fold, no store, in pencil | Ned's hand flat on the bare rock in Tesk's fold, the goat Sal at his glove |
| `q.fact.cell_log`, `q.lore.cell_log` | The cell log: Haldane, T., held | Tomas's brown cap, which Will took off the bench in the end cell and hung on a nail in the Brack kitchen; it goes down the Brack line to Leon |
| `f.e5_frank` | Walter's page in the ledger, torn out or left in | Walter's wedge in Frank Mott's tobacco tin: given to the archive, or dropped in the Edd from the bridge |
| `f.e5_page_*` | Dorrah's page: "T.H., oats, for the town children" | A child's oat sack with a goat stitched on it in blue thread, found in the wall of Tesk's fold when the ring road digs it: lost, kept (the League holds it up as proof the Hesh hid grain), or given to Sefa Tesk |
| Era 5's talk-out at the clearance | The cell log read to Leon Brack | The cap put in Leon Brack's hands, and what the player can tell him of where it hung |

Era-by-era plot decisions are recorded in each era's file under "Plot changes" (section 5 links them).

## 4. The gates

| Gate | What it fails on |
|---|---|
| `tools/devicecheck.mjs` | A line in a writer's hand; quoted capitals shown to be read; a numeral in narration, options, voices, props or echoes; an option or verb asking to read, write, sign, paste, compare or count; a document prop; a prop with no `carries:`; a journal; a counter; a fate or world fact no echo shows; an undefined `@sense`. Controls in `tests/senses.test.mjs` |
| `tools/echocheck.mjs` | An echo whose place, tells, sense or person do not exist; an echo felt on no run; a fate that falls on some run with no echo of it felt on any run where it fell |
| `tools/lorecheck.mjs` | Adds: a fragment found by reading a document prop; a fragment from an earlier run met only in a scene's words (it must be a prop, a touch or an echo); a chain some class can never complete in one run (a gate the player cannot see) |
| `tools/proplint.mjs`, `tools/propcheck.mjs` | Adds: no `carries:`; a document prop; a touch whose sense is undefined; a touch done on no run |
| `tools/discoursecheck.mjs` | Adds: the paper acts (tear, paste) in story content |
| `tools/validate.mjs` | Knows the new ids: `sense(id)`, `shoulder(load)`, `pan(scale, ...)`, `tip(scale)` |

### 3.5 The other eras, in short

Each decision, what it was and why, is in the era's file under "Plot changes".

- **Era 1** (`device-audit/era1.md`): the census is census night at the end barn door. Edwin Mott walks the round
  with Walter's lantern, the hands are turned out into the first frost, the player turns the key, and Walter chalks
  a goat on the shut door. Ilo is named Haldane to his face ("Call him Haldane. That'll do him."). The board's rule
  passes by a show of hands; the price board is the scale and a brown coin against a white one.
- **Era 3** (`device-audit/era3.md`): the allocation is a man with the keys (Walter at a board of hooks, iron rings
  for the merchants' houses, bright keys for the far bank). The Tarn list is a man at the rail saying aloud that
  Anni is his. The fever is chalk crosses, the smell, the handcart's dry wheel; over-allocation is Fenn counting
  heads with his finger at night. Dorrah's household book is her knot cord.
- **Era 4** (`device-audit/era4.md`): the map is a show of hands and Victor walking the town with Halvard's can of
  grey road paint; the fire report is the burnt house the player walks through, Mrs Bora's hands showing what she
  saw, and "Electrical" said out loud at the desk.
- **Era 5** (`device-audit/era5.md`): Walter's wedge in Frank's tobacco tin (into the Edd, or under the old scale's
  pan at the archive's opening); the child's oat sack with the blue goat dug out of Tesk's fold wall; Tomas's cap
  put in Leon's hands at the door; the posts and the clip heard, never read; Leon's statement said to his own
  bodycam; the petition a line on the library steps.

## 5. The audit by era

| Part | File | Rows |
|---|---|---|
| Engine, shell and inner arena | `design/device-audit/engine.md` | 20 |
| Era 1, The Exchange | `design/device-audit/era1.md` | 50 |
| Era 2, The Quota | `design/device-audit/era2.md` | 70 |
| Era 3, Allocation | `design/device-audit/era3.md` | 48 |
| Era 4, The Closure | `design/device-audit/era4.md` | 44 |
| Era 5, The Clearance | `design/device-audit/era5.md` | 90 |
| The cross-era lore (`w_lore.lwd`) | `design/device-audit/lore.md` | 6 |
| **Total** | | **328** |

By kind, over all 328 rows: document 183, record or journal 40, counter or quota 25, examine-only clue 15, compare or
check verb 13, fate flag 12 (covering all 23 fates), two-class gate 10, invisible dialogue effect 10, lore fragment
7, hidden rule 6, no visible cause 4, later-run effect 3. One document is kept on purpose (era 3's schoolbook: nothing
in the plot turns on reading it).

What the content now carries: 117 `@sense` records, 216 places where one is fired, 16 `@load` records, the exchange
`@scale`, 41 `@echo` records, and 40 props with a hand on them.

Open after this pass (engine rows 19 and 20): the voice and compartment names FORM LETTER, SMALL PRINT, PRECEDENT
and THE PEN, and the Character page's levels. Row 19 closed and row 20 partly closed by the traits pass, 2026-10-23
(design/TRAITS.md): every trait is renamed for a human quality and has a being; the page says what each one does. The era design docs (`design/eras/era1.md` to `era5.md`) and some
prop drawings (`render/places/layers/era3.mjs`, `era4.mjs`, `render/props/e4_rooms.mjs`, `e5_*.mjs`) still describe
the old documents; the content is the record of the change.
