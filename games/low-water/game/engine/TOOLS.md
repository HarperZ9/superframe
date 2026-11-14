# The engine's tools

Every tool here checks the game, not the story. Where a tool needs to know something about this particular story, that knowledge sits in one of three places, and a new story replaces those places and nothing else:

- `tools/story.mjs`: how the story ends and what counts as finished, the reckoning ledger's flag patterns, the fallback events no route needs, and the fight bench's default fight.
- `tools/policy.mjs`: the builds (each a precedent, its voices and its habits) and the routes (appointments by node and hour).
- The content's own conventions, listed per tool below.

`LW_STORY` chooses the story the harness plays. Leave it unset for Low Water, or set `LW_STORY=quota` for The Quota's slice (`tools/quota/story.mjs` and `tools/quota/policy.mjs`). Every tool reads the story through `tools/use-story.mjs` and `tools/use-policy.mjs`.

Acts are found on disk (`tools/acts.mjs`): `content/actN/actN.lwd` for N = 1, 2 and on, each with its area wiring in `wiring/actN-areas.lwd` when it has any. A longer story adds folders.

Run anything that takes more than about 30 seconds under the machine lock: `node tools/gpu-lock.mjs run --lock heavy-cpu "<job>" -- <cmd>` (from the project root).

Start heavy jobs with PowerShell `Start-Process` under the lock, not as a Bash background command. On 2026-10-21 the sculptor saw jobs started as Bash background commands stall twice in the paint function at near-zero CPU; the same jobs started with `Start-Process` under the heavy-cpu lock ran cleanly. The tools that start other tools (eventcheck, exitcheck) spawn them by relative path, so run those from game/engine with the lock at `../../tools/gpu-lock.mjs`. `tools/quota/doorbench.mjs` takes `--figures` to bench one reported figure.

## Content checks (no play)

| Tool | What it checks | What it assumes about the content |
|---|---|---|
| `tools/validate.mjs`, `tools/lint.mjs` | Every node reachable; no flag read that nothing sets; no unknown target, skill or variable. `--carry` passes earlier acts' flags in. | The `.lwd` format. |
| `tools/flags.mjs` | Flags set and never read: a promise the game never keeps. | Flags are read by name. |
| `tools/dirlint.mjs` | Performance directions on lines parse (the voice bible's grammar). | `design/voice/profiles.json`. |
| `tools/marks-check.mjs` | Each area's plate carries the marks and variants the wiring names: spawns and hotspots on walkable ground, people at their spots. | Plates in `content/<plate>/`, wiring per act. |

## Played checks (the scripted player)

`tools/playthrough.mjs` plays every act in order for each build and route. It reports finished or stalled, dead ends, fights and their outcomes, and events never fired. Each run also keeps the reckoning ledger:
- what Lamb professed;
- what Lamb did;
- every gap with its cause;
- the closing totals.

Everything named below reads its runs or its beat log (`--beatlog`, `--json`).

| Tool | What it checks | What it assumes |
|---|---|---|
| `playthrough.mjs --clockcheck` | No single choice moves the clock past its stated minutes plus the interrupts that played. | Nothing. |
| `tools/eventcheck.mjs` | Every event fires in some run. Calls `runsummary --require-all`, the tide lint and the clock lint. | Fallback events listed in `story.mjs` GUARDS. |
| `tools/runsummary.mjs` | Events that never fired, clock findings, endings reached. | As above. |
| `tools/exitcheck.mjs` | Every fight a non-striker build is forced into has a way through by talk or by leaving, for that build. | Which builds never strike (`NON_FIGHTERS`, from policy). |
| `tools/tidelint.mjs` | Lines about the tide agree with the tide clock; nobody offers to wait for a tide state that already holds. | English tide words; a tide on the night spec. |
| `tools/clocklint.mjs` | Narration that tells the time agrees with the game clock, within the precision it was said in (5 to 30 minutes). | English clock phrases. |
| `tools/playtime.mjs` | How long each act takes to play: reading, choosing, walking and fighting, at low, middle and high rates. | Reading speeds are general. |
| `tools/pacing.mjs` | Intensity over real minutes: flat stretches and cliffs. | English danger words; event ids start `ev`; reveal and reckoning nodes are named so. |
| `tools/communitycheck.mjs` | The Quota's community model: for each figure the district office can take, every change the record event caused, with the rules it passed through and their delays, and the tables on the coda's day. Fails when two figures lay the same Haldane table, when a figure leaves every table as it began, or when a record event's effect is shown by no lens (`@lens shows`). | `@street`, `@household`, `@rule` and `@carrier` records, and an option that assigns the figure variable (`--var`, default `q_figure`). |
| `tools/proplint.mjs` | Every `@prop` (world/props.mjs): it tells about a person, a household or an era; its place exists and a scene or area uses it; every era the story plays has a state, the era's last state has no condition; it stands on a mark of its place's plate (a warning when the place has no plate yet); its text says more than what the thing is (8 words or more); its conditions evaluate; it gives only lore the story defines. | `@prop` records, the story's `@meta era`, and the plates' `marks.spots`; the root and wiring from the story file (`LW_STORY=quota`), or named on the command line. |
| `tools/propcheck.mjs` | Plays the story's builds and routes with the attentive player (it looks at every prop at the place whenever a line is shown, tools/quota/story.mjs) and fails when a prop at a scene's place was seen on no run. Props that only free roam reaches, and states no run reached, are listed as warnings. `--runs` reads runs already made. | `LW_STORY=quota`; run from game/engine. |
| `tools/lorecheck.mjs` | The lore graph (world/lore.mjs). The lint: every `@lore` has a layer, a place it is found (a prop and its states, a node, a record event the content makes) and requirements that exist; a surface fragment needs nothing, a hidden one needs a class, a choice or a prior fact; a fragment found through a prop state that reads `prior()` names that fact; every `@chain` route lists fragments of its chain. The play: the builds and routes fresh, then each class again seeded with each set of facts a fresh run kept; fails on an orphan fragment, a route its rule cannot complete (one-run, two-classes, across-runs), a two-class route one run holds whole, or a cross-run fragment found on a fresh run. `--lint` skips the play. | `LW_STORY=quota`; run from game/engine; `@meta class-var`. |
| `tools/worldcheck.mjs` | The world record (save/worldrecord.mjs) through the harness: a run of each class into a fresh record, then the other class after it (`playthrough --world <dir>`); checks the entry (class, end, facts, the line said), that the next run started from it, and that it survives a deleted slot, either copy deleted, and a copy edited by hand. | `LW_STORY=quota`; run from game/engine. |
| `tools/readbackcheck.mjs` | Retired from the gate 2026-10-22: the read-back is a witness scene now (witnesscheck reuses its lint). The read-back (world/readback.mjs). Lint: every `{self: id}` voice tag names a `@selflie` and every `@selflie` is tagged; every `@said` flag is set by an option; conditions evaluate. Play: for each run's read-back, every heard self-lie and every said row is paired with something that happened, said rows quote the chosen words with their marker, rows are in clock order, the next row is refused before its reading time and closing is refused before the end; per class, self-lies under half the voice lines heard (over a quarter is a warning). `--runs` reads runs already made. | `LW_STORY=quota`; run from game/engine. |
| `tools/witnesscheck.mjs` | The witness scene (world/witness.mjs), which replaced the read-back. Lint: readbackcheck's self-lie and said lint; every `@witness` names nodes that exist and a dispatch node with `wnext()` and an alt per beat; Reach (a beat told as seen names a place in reach and not in never; heard names a source); No verdict (no narration or option label passes judgement; characters' lines exempt); the count cap (three figures); an echo, word for word, for every self-lie. Play: every self-lie heard is echoed by a beat played; every ledger row that holds is answered by a beat played or declared unwitnessed (the oracle); the talk panel's gate refuses a second beat early and an early close; the scene closes on its last beat. Controls in tests/witness.test.mjs. | `LW_STORY=quota`; run from game/engine. |
| `tools/fatecheck.mjs` | A person's fate (`@fate`, world/community.mjs). Lint: no household rule writes bowls, taken, members or end; each fate's decider has a line in its scene; each scene has an outcome where the fate falls and one where it does not, and an option or a condition between them; `fate()` is called only in its own scene. Play: a pressure that held had a scene played; every change to a fate field came from a node, and each table is its members less its fates. Controls in tests/fate.test.mjs. | `LW_STORY=quota`; run from game/engine. |
| `tools/discoursecheck.mjs` | Rumour and discourse (world/discourse.mjs). Lint: every `@claim` carrier exists, every carrier has a rule turning its volume into its target's standing, every `discourse(...)` call names an act and a claim. Play: each act on each claim, through the notices' verbs or in the pub and the pulpit, for each class, against a matched game with no act, both starting loud, two weeks on: the record event, the volume's direction, standing lower after a repeat and higher after a challenge, tear or paste, the challenger's household paying, the torn notice reposted, and a lens that shows what moved. | `LW_STORY=quota`; run from game/engine. |
| `tools/dreamcheck.mjs` | Dreams (world/dreams.mjs). Lint: two readings at least, a day ahead at least, the last `see:` with no condition, conditions and fear effects that run, a scene that dreams it, and a projection that leaves the real model, flags and variables as they were. Play: each dream dreamed on some run, set against its day on every finished run, and both readings open: true on some runs and not on others. | `LW_STORY=quota`; run from game/engine. |
| `tools/perspectivecheck.mjs` | Perspective chapters (world/perspective.mjs). Lint: each `@perspective` names an archetype, a start node that says `perspective(id)` and a return node; every path from the start ends the chapter before the act ends and goes on to the return node. Play: each run that played a chapter had the chapter's sheet and figure while it lasted, got its own person and figure back unchanged after, and kept the chapter's choices in the world; every chapter is played on some run. | `LW_STORY=quota`; run from game/engine. |
| `playthrough.mjs --window act:from-to` | How many new things there are to do in a stretch of the night, opening every hub on a copy of a route's state each half hour. | Hubs are marked `hub: yes`, or named `.hub` or `.menu`. |

## Fights

| Tool | What it checks | What it assumes |
|---|---|---|
| `tools/arenarun.mjs` | The arena mode's ladder played by the scripted player for a committed and a spread build over seeds: rounds cleared, time to kill, dodges, deaths by pattern, bosses. `--skin bread` or `--skin club` plays The Quota's venues. | Nothing; venues come from `combat/data/skins-quota.mjs`. |
| `tools/fightbench.mjs` | One fight on its painted plate, set up as the game sets it up. For each build over seeds it plays talk, out and fight routes and reports outcome, seconds and standing left. `--talkat`, `--variant` and `--cold` try changes before they are made. Matched to the browser from the same start (3.9 standing in both). | The fight, act, plate, area and hotspot come from flags, with `story.mjs` BENCH as defaults. |
| `tools/quota/doorbench.mjs` | The Quota's granary door for each class and each figure over seeds: won, talked out, lost, left. `--notalk` makes the Inspector fight it out. | The slice's `e.q_granary` and its class and figure variables. |
| `tests/` (node test) | Engine rules, combat, layout helpers, and a few scenes pinned by name. | The scene tests name nodes and need rewriting with the story. |

## Browser walks (headless, real time, at 1280 x 720)

| Tool | What it checks | What it assumes |
|---|---|---|
| `tools/uxfight.py` | A new player's fight in the real page. `--mode talk` presses T a second after the offer. `--mode out` walks the nearest way out by the fight's own paths. It saves stills and the layout every second. | `--act` and `--scene place\|x,y,z\|node\|option` name the fight. The default is Act 1's quay. |
| `tools/uxact2.py` | A first-options player through an act from its start, with stills at each new place. `--through` plays through fights, logging each press. `--until` stops at a node. | Act folders; the archetype to create. |
| `tools/layoutcheck.mjs` | Over the walk stills: no panel hides more than a fifth of a way out, and the keys never cover the meters. The flat fallback arena is left out. | Nothing. |
| `tools/placeshot.py`, `tools/waystill.py` | Stills of places and of a fight's ways out. | Area ids. |
