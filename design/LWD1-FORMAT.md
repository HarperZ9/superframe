<!-- writing-profile: research -->
# LWD/1 for Low Water: the writer's reference

Draft 2, 2026-10-16 (resumed director session). Private. Draft 1 (15:31) proposed its own
spellings before the engine's parser existed; this draft replaces it. LWD/1 is the language the
engine in `game/engine/` reads (its `dialogue/parse.mjs`, `core/expr.mjs`, `core/scope.mjs`,
`rules/ruleset.mjs`). This page says how Low Water's systems (`design/SYSTEMS-FULL.md`) are
written in it. Where this page and the engine disagree, the engine wins and this page is fixed.
Keys marked **(R n)** are requests in `design/NOTES-FOR-ENGINEER.md`; writers use them now and the
engine ignores them until it reads them.

## 1. Files and lexical rules

- Act 1 lives in `content/act1/`. The root is `act1.lwd`, the only file with `@meta`; it names the
  rest with `include:` lines. Ids are global across the act.
- UTF-8, LF. `#` starts a comment line. A record starts with `@kind id`; its lines are
  `key: value`, split at the first colon. Repeatable keys repeat.
- Ids: lowercase ASCII, digits, `.` and `_`. Prefix every id with its district
  (`quay.`, `brine.`, `weigh.`, `floor.`, `mole.`, `gut.`, `dawn.`, `m.` for Margin, `a1.` for quests).
- Times are `hh:mm` on the night's clock: `00:00` to `11:59` are after midnight.
- Text may contain `{{expression}}`, filled from the world (`{{tide}}`). Use it only for numbers an
  instrument would say.

## 2. Nodes: the writing

```
@node quay.keel.start
place: quay
speaker: KEEL
cost: 4
do: set(met.keel)
nar: At the top of the steps stands the harbourmaster, very tall, in a puddle he brought with him.
line: KEEL: You will be the Shelf. The Board telegraphed. The Board is gratified.
inst: THE DAMP: Saturated. I can't read him. Nobody can.
voice: pride: He is wetter than you. Take comfort in that while it lasts. {dc: 4}
voice: pride: He is wetter than you. You are wetter than you were. {below: 4}
go: quay.keel.menu
```

| Key | Meaning |
|---|---|
| `place: id` | Lamb is now at this place (the environment reads light, sodium and zone from it) |
| `speaker: NAME` | Default speaker for `line:` lines without a name |
| `cost: n` | Game minutes the beat takes. Talking costs time: about one minute per two lines |
| `nar: text` | The report, in the house voice (bible section 2). Any `nar:`, `line:` or `inst:` may end with `{when: cond}` or `{once}` **(R15)** |
| `line: NAME: text` | A character speaks. `LAMB:` is Lamb |
| `inst: NAME: text` | An instrument speaks (CANDLEMAS, THE GLASS, THE ALMANAC, THE DAMP, THE VANE) |
| `read: instrument args` | An instrument's live reading (`read: almanac`) |
| `voice: skill: text {dc: n}` | A passive voice: plays when the skill's level is at least n. Without `dc` it always plays |
| `voice: skill: text {below: n}` | Plays only when the level is below n **(R3)** |
| `voice: ... {when: cond, once}` | Further gates. `once` plays it only the first time |
| `passive: skill -> node {dc: n}` | A passive check that detours into a node and comes back (the node ends with `return:`) |
| `do: effects` | Effects, separated by `;` (section 4) |
| `if: cond => effects` | Effects only when the condition holds |
| `when: cond` + `else: node` | If the condition fails, go to `else` (or return) |
| `alt: node ? cond` | Jump to another node now if the condition holds. Put `alt:` lines first |
| `cmd: words` | Environment commands: `setPower quay off`, `restrike mother`, `wet lamb 0.3`, `addRumour fact district w`, `setLight place l s` **(R8)**, `setTerm term v` |
| `go: node` | Continue. `^hub` returns to the last hub, `^return` to a caller |
| `call: node` / `return:` | Visit a node and come back |
| `hub: yes` | This node is a menu that `^hub` returns to |
| `exit: walk` | Back to walking the area (or to the district menu) |
| `end: id` | The act ends (only `dawn.end.*` nodes) |

## 3. Options

```
opt: "Ask about the switch." -> weigh.marrow.switch ? has(scales.switch) +2 {once}
check: "[SMELL] Lean down to the handle." -> weigh.scales.ok / weigh.scales.fail ? light >= 0.1 {skill: smell, dc: 7}
check: "[GRIP] Climb to the balance." -> quay.balance.ok / quay.balance.fail {skill: grip, dc: 8, red}
claim: "You signed the works order." -> quay.keel.order.ok / quay.keel.order.fail ? has(works.order) & has(claim.time) {show: has(works.order)}
```

- `opt`: `"label" -> target ? condition +minutes {attributes}`. The condition hides the option.
- `check`: two targets, success / failure. `{skill: id, dc: n}` is a **pencil** check (retry once
  anything in the sum has risen). Add `red` for an **ink** check (one try). Every check has a real
  failure node that plays a scene; a failure never just closes a door.
- The label of a check starts with the voice in capitals in brackets: `[SMELL]`. The interface
  adds the sum.
- `claim`: Lamb puts a case to someone. The condition decides which target plays; the option is
  always shown unless `{show: cond}` **(R13)** hides it.
- Attributes: `once` (hide after chosen), `do: effects` (run on choosing), `xp: n` (pages, see 5.9),
  `id: name` (a stable key for `said(name)`), `nostrain` **(R1)**.
- Lamb's spoken options are what Lamb says, in Lamb's voice, in quotes when spoken aloud. Actions
  are plain imperatives ("Leave him dripping.").

## 4. Conditions and effects

Conditions: `& | !`, comparisons, numbers, `hh:mm` times, words compare as strings.

Names: `clock` (also `hour`), `place`, `area`, `district`, `tide`, `fog`, `rain`, `light`,
`sodium`, `wind.speed`, `wind.dir`, `power.quay`, `mother`, `wet`, `temp` and `frost` **(R11)**,
`guise` **(R7)**, `skill.<id>`, `attr.<id>`, `rep.<faction>`, `meter.<id>`, `trait.<id>`,
`quest.<id>`, `project.<id>`, `item.<id>` (count), `var.<name>` or a declared var by name.

Calls in conditions: `has(flag)`, `at(place)`, `inarea(area)`, `indistrict(d)`, `seen(node)`
(visited), `visits(node)`, `said(option id)`, `passed(check id)`, `failed(check id)`,
`count(item)`, `worn(item)`, `trait(id)`, `quest(id)`, `rep(faction)`, `rumour(fact, district)`,
`knows(fact, district)`, `meter(id)`, `skill(id)`, `min max abs`.

Effects: `set(flag)`, `clear(flag)`, `give(item[, n])`, `take(item[, n])`, `equip(item)`,
`xp(n)`, `offer(trait)`, `quest(id, stage)`, `rep(faction, n)`, `rumour(fact, district, w)`,
`meter(id, n)`, `project(id)`, `wet(n)`, `wait(min)`, `journal("text")`, assignments
`v_name = 1`, `var.tab_pip += 1`, and `run(id)` **(R10)**.

## 5. Low Water conventions

### 5.1 Facts and flags
- Evidence is a `@fact` with `about:` (the Daybook line, in the house voice), `against: who n`
  and `by:` (how it was read). Ids from the bible keep their names (`scales.switch`,
  `works.order`). Set with `do: set(id)`.
- State flags are `@fact` records without `against`. `met.<char>` when first spoken to.

### 5.2 The Record (memory of what Lamb said)
- `said.<id>` when Lamb states something that matters; `lied.<id>` as well when it is untrue.
- `heard.<char>.<id>` for each named person present; Lamplighters present add `book.<id>`.
- Write it with the option: `{do: set(said.wreckers); set(heard.keel.wreckers)}`.
- Lines that quote Lamb back test these flags.

### 5.3 Favour and the Read
- `rep(guild, 1)`; favour runs -3 to +3.
- The Read is a var per faction: `seenas_guild = nose`. Values in SYSTEMS-FULL 13.2.

### 5.4 Voices and the Kit
- Voice ids: `sum precedent smallprint carbon knees ballast pride grip condolence formletter chit
  hearsay smell dark undertow salt`. Instruments: `candlemas glass almanac damp vane`.
- Thresholds: 4 anyone notices; 6 a good ear; 8 a trained one; 10 to 12 only a Lamb built for it
  in the right weather. A typical fresh Lamb sits at 2 to 6.
- A voice interjects to add, to argue, or to mislead. At most three voices in one beat. A voice
  never repeats information a line just gave.
- Instruments speak with `inst:` in their temperament (bible section 9). They are always exact.

### 5.5 The Margin
- A note is a `@trait` with `name`, `about`, `research` (minutes to ink), `while` (pencil cost),
  `mod` (inked effect, with its tide as a condition) and optionally `do`. Offer it with
  `do: offer(m.clocks)` at the moment the town says the phrase.
- Each note has a nodding page `nod.<id>` in `margin.lwd` **(R5)**.

### 5.6 Meters
- `do: meter(cold, 2)`. Full scenes: `chilled.<district>`, `small.<district>`, `nod.<id>` **(R4)**.

### 5.7 Items, clothing, salvage, fits
- `@item` with `slot` for clothing (`hat coat neck hands feet hand`), `mod` lines, and `shed`,
  `warm`, `guise` **(R7)**. Salvage pieces are `stack: yes`.
- A salvage point is a hotspot or option that gives pieces once and is gone when the tide covers it:
  `opt: "Prise the brass collar off the post." -> floor.salv.collar ? !has(salv.collar) & tide < -0.3`.
- A fit is a `@recipe` whose `out` is a fitting item with a `mod:` on the instrument's skill.

### 5.8 Lamps, runs, the Tab
- A Lamp of Gullet is a `@project` whose stages need pieces and whose `do` changes the light.
- A Tide Run starts with `do: run(r.gully)` **(R10)**. Until runs exist, every run node starts with
  `alt: <fallback check node> ? !runs` and the fallback is an ordinary check on the run's voice.
- The Tab: `tab_<char> = 1` when Lamb has done that person a real favour.

### 5.9 Pages
- `xp: 1` on an option, or `do: xp(1)`, grants one page. Act 1 has twelve. A page marks a moment
  of understanding, never a chore done.

## 6. Records other than nodes

| Kind | Keys |
|---|---|
| `@meta` | `title`, `format: lwd/1`, `start`, `clock`, `end-clock`, `at-end`, `include` |
| `@rules` | `check-mode`, `xp-per-level`, `points-per-level`, `skill-cap`, `creation-points`, `attr-min`, `attr-max`, `cabinet-slots`, `rep-min`, `rep-max`, `start-node`, `start-area` |
| `@attr` | `name`, `short`, `about` |
| `@skill` | `name`, `short`, `attr`, `about`, `glyph`, `voice`, `base`, `train: no` (R2) |
| `@modifier` | `skill`, `mod`, `when`, `why` |
| `@meter` | `name`, `about`, `min`, `max`, `start`, `decay`, `scope`, `warn`, `rise` (R4), `full` (R4) |
| `@trait` | `name`, `about`, `glyph`, `research`, `while`, `mod`, `do`, `unlock` |
| `@item` | `name`, `about`, `slot`, `stack`, `mod`, `salvage`, `tags`, `value`, `shed`, `warm`, `guise` |
| `@recipe` | `name`, `in`, `out`, `tool`, `when`, `cost`, `known`, `about` |
| `@faction` | `name`, `about`, `start`, `tier` |
| `@var` | `default`, `values`, `about` |
| `@archetype` | `name`, `about`, `attr`, `skill`, `item`, `trait` |
| `@quest` | `name`, `about`, `stage` (`id: text`), `done` |
| `@instrument` | `name`, `key`, `about`, `say` |
| `@char` | `name`, `speaker`, `faction`, `about` |
| `@place` | `name`, `zone`, `light`, `sodium`, `dark-light`, `stove: yes` |
| `@district`, `@area` | As in `game/engine/world/districts.mjs` |
| `@event` | `at` and/or `when`, then node keys |
| `@hazard` | As in `game/engine/world/hazards.mjs` |
| `@project` | `name`, `about`, `district`, `stage` |
| `@run` | R10 |

## 7. Carrying state

Every flag, var, item, favour, trait, quest stage and the Record carry into Act 2.
