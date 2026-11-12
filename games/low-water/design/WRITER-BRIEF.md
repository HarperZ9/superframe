<!-- writing-profile: procedure -->
# Writer's brief: one district of Act 1

From the director and lead writer, 2026-10-16. Private. Every writing helper reads this first, then
the documents it names, then writes one file. Working folder:
`C:/dev/mission-control/2026-10-16-low-water/` (all paths below are relative to it).

## Read, in this order

1. `bible/WORLD-BIBLE.md`: the whole of it. Section 2 (tone and house voice) and section 7
   (characters and their registers) govern every line.
2. `design/ACT1-PLAN.md`: the beat sheet, the cast schedule, quests, facts, Margin offers, pages,
   lamps and the style rules in section 10. Your district's beats are listed there by file name.
3. `design/LWD1-FORMAT.md`: the format you write in (draft 2). Follow it exactly.
4. `design/SYSTEMS-FULL.md`: sections 2 (voices), 4 (checks), 5 (meters), 6 (the Margin), 8 (items),
   9 (salvage and fitting), 10 (lamps), 12 (runs and squalls), 13 (the Read, guises, the Tab), 14 (the
   Record).
5. `content/act1/rules.lwd`, `world.lwd`, `facts.lwd`: the shared ids. Use them. Do not redefine
   them, and do not edit these files.
6. `slice/lamp_quay_2300.lwd` and `slice/SLICE-READING-COPY.md`: the one-hour slice in LWD/0. Its
   text is ours. Where your district's scenes exist there, carry the best of it over, convert it to
   LWD/1, and deepen it with the systems (voices, checks, the Margin, the Record, favour, the Read).
   Rewrite whatever is thin.

## Write

- One file only: `content/act1/<district>.lwd`. Start it with a comment naming the district.
- New ids (facts, flags, vars, items) your district needs go at the top of your file under
  `# ---- new ids`, prefixed with your district (`brine.`, `gut.`). Flags need a `@fact` record
  (no `about:` for a state flag).
- Every node id starts with your district prefix, except the convention nodes your brief names.
- Cross-district targets you may use: every district's hub (`quay.hub`, `brine.hub`, `weigh.hub`,
  `floor.hub`, `mole.hub`, `gut.hub`) and the entry nodes listed in section "Shared entry nodes"
  below. Do not jump into another district's other nodes.

## Shared entry nodes (the owner must define them)

| Node | Owner | What it is |
|---|---|---|
| `quay.prologue` | quay | The game's first node: the deck of the Saint Cuthwin, a memory |
| `quay.hub`, `quay.phone` | quay | The quay; the harbour office telephone (Crake) |
| `brine.hub`, `brine.room`, `bench`, `wall` | brine | The bar; the room above; the fitting bench; the case wall |
| `weigh.hub`, `weigh.tube.midnight` | weigh | The weigh-house; the midnight tube scene |
| `weigh.run.shadow.win`, `weigh.run.shadow.lose` | weigh | The Lamplighter's shadow run |
| `floor.hub`, `floor.run.gully.win`, `floor.run.gully.lose`, `floor.run.fish.win`, `floor.run.fish.lose` | floor | The floor and its runs |
| `mole.hub`, `mole.run.frost.win`, `mole.run.frost.lose` | mole | The mole and its run |
| `gut.hub` | gut | The Gut |
| `chilled`, `nodding`, `small`, `nod.default`, `nod.m.<id>`, `small.<district>`, `chilled.<district>` | margin | Full-meter scenes |
| `dawn.start` | dawn (director) | The dawn verdict |

## The quality bar

- Literary, grotesque-funny, reactive. Every line earns its place: it changes what the player
  knows, what someone thinks of Lamb, what the town looks like, or what Lamb can do next.
- The house voice for `nar:` (bible section 2): the assessor's report in the third person,
  itemised, dry, exact, fond of the town. One grotesque image per beat. Short and long sentences
  without a pattern. No sentence built to land. Never sarcastic about people.
- Characters speak in their own registers (bible section 7; ACT1-PLAN section 3 for the supporting
  cast). Keel speaks as "the Board". Gorm speaks only in questions. Merrow never asks a question.
  Lugg whispers. Sabine puts a price in every sentence. Marrow calls everyone a fish.
- Inner voices: interject to add, to argue, or to mislead, at most three in a beat. Write both
  sides: lines for a high level (`{dc: n}`) and for a low one (`{below: n}`). A low level is a
  different scene, never a silent one.
- Checks: pencil by default, `red` (ink) for one-time moments. Every check has a written failure
  node, and failure is interesting: it opens something, costs something, or makes someone laugh.
- The environment matters: gate scenes on tide, light, sodium, fog, rain, clock, power, frost.
  The same question asked under a lamp and in the dark should get a different answer where it
  matters. Blackouts (21:38 to 21:52 before play; 02:50 to 03:20 in play) change who talks.
- The world remembers: set `said.*`, `heard.<char>.*`, `book.*` (when a Lamplighter is present) and
  test them later. React to the provisional cause (`var.prov`) after 00:20 in every hub.
- Return visits: `.again` nodes, short, changed by what has happened since.
- Time: `cost:` on every node that takes time (about a minute per two lines of talk; walking 1 to 3).
- Humour from exactness. Horror from social pressure and weather. No jump scares, gore or monsters.
- Original writing only. No names, lines, skill names or mechanics from any other game or book.
- No em dashes anywhere. Plain punctuation.
- No verification, audit or proof language in the fiction or interface text.

## Check your work

Run, from the working folder:

```
node content/tools/lwd1_lint.mjs content/act1/act1.lwd --file <district>.lwd
```

Fix every ERROR in your file. Targets into files not yet written will show as errors only if they
are not in the shared entry list; use only shared entries across files. Warnings about unreachable
nodes in your file mean a hub or option is missing. Run the lint until your file is clean.

## Rules of the machine

- Write only your one file. Do not edit anything else, including the engine in `game/engine/`,
  the prototype in `game/`, `render/`, other districts' files, or the shared records.
- No web access is needed; do not fetch anything. Nothing leaves this machine.
- Clean-room rule (author, 2026-10-16): never open any reference game's files. Learn only from
  `cleanroom/spec/` and public sources. All expression is original.
- Fights: see design/ACT1-PLAN.md section 11 and design/SYSTEMS-FULL.md section 18.
- No GPU. Run nothing heavy.
- Write the file in several passes if it is long (create it, then append with edits).

## Report back

When the file is clean, reply with: the node count and word count (the lint prints both), the
beats you wrote and any you could not, every new id you added, any shared id you needed that does
not exist, and the three lines you are proudest of.
