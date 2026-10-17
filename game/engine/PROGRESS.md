# Low Water engine layer: progress

Game-side systems layer that the content plugs into. Private. Brief from the coordinator,
2026-10-16; scope addition the same day (crossover of Disco Elysium, Zero Parades and No Rest
For The Wicked: real-time hazards from the environment, inventory with crafting and salvage,
persistent settlement restoration, rumour and cover). No verification apparatus in the game, its
docs or the process (author, 2026-10-16): ordinary tests only.

Rules: content/ belongs to the director (no story prose here); placeholder test content lives in
test-content/. Idle priority, at most 2 heavy jobs, no GPU, headless only. Never write to the
isomorph or sofer repos. The prototype files in game/ outside game/engine/ belong to the polish
agent: this layer does not edit them. bible/, design/ and content/ belong to the director; the
engineer only appends to design/NOTES-FOR-ENGINEER.md under an engineer-replies heading.

## Layout
- core/: expressions and effects, seeded hash, scope (every name and call content can use)
- dialogue/: LWD/0 and LWD/1 parser, book builder (with include:), runner, memory, the Record
- rules/: ruleset loader, sheet (compartments, voices, pages), checks (pencil, ink, strain),
  the Margin, inventory and clothing, factions (favour and reads)
- world/: environment adapter, body (Cold, Wear, Dread, wetness), people (schedules, seen, guise),
  kit (instrument condition, wear, fittings), lamps, salvage, Tide Runs, the wall, quests,
  rumour, districts, hazards, settlement projects
- save/: versioned saves, migrations, slots, autosave
- tools/: validator CLI, quick-test CLI, graph viewer page
- ui/: DOM panels in the Daybook paper style, input navigation (keyboard, mouse, gamepad)
- play.html: the game shell (title, creation, play, panels)
- tests/: node --test

## Steps
Director decision (design/NOTES-FOR-ENGINEER.md, 16:20 local): Act 1 is written in this engine's
own dialect. The draft-1 director keys are withdrawn. Work = the engine's dialect plus requests
R1 to R13 from that file.
1. DONE Read PROGRESS, prototype, slice, design, LWD-FORMAT; scope addition received.
2. DONE Core: scope names wet, soaked, shed, warm, guise, stove, shelter, bench, runs, run.X;
   calls here(), run(), move(), forget(). tests/expr.test.mjs.
3. DONE Dialogue: R3 {below}, R13 {show} (and {when} on claims only hides), strain on choose,
   full meters and due events at node boundaries, run(id) interrupts with beat.run and
   talk.afterRun(), fixed checks print no tally, include: via loadAct(). tests/dialogue.test.mjs.
4. DONE Rules: R1 strain (@attr strain:, defaults for pen/coat/hat/nose), R2 train: no, R6
   archetype traits done, R9 pages (rank, slot to cabinet-slots-max, forget-cost), creation
   (archetype or spread, trusted, ink). sheet.skill is now the full effective level including
   @modifier records. tests/rules.test.mjs.
5. DONE World: night (@night or night one, tide from low and high water, keyframes; setLight,
   setTerm, gust), body (wetness, shed, warm, guise), meter rise/full/after/wait with $district
   and $trait (R4, R5), @char schedules and factions, Tide Runs (full, half, stepped), hazards
   live only during their run. tests/world.test.mjs.
6. DONE Save: v3 (night env and state.body), v2 to v3 migration, ink mode follows the
   character and autosaves on every action. tests/save.test.mjs.
7. DONE Tools: tools/lint.mjs + tools/validate.mjs (R12: missing nodes, dead ends,
   unreachable, undefined names, flags read never set, bad ids, unknown commands; exit 1 on
   errors), tools/quick.mjs (plays a path), tools/graph.html (columns from the start, findings
   per node, play from any node). Slice: 118 nodes, 118 reachable, 0 errors, 3 warnings (read:
   damp has no @instrument). tests/lint.test.mjs plants one of each fault.
8. DONE Test content: rules.lwd, demo.lwd, systems.lwd validate clean (31 nodes, all reachable).
9. DONE UI shell and panels (ui/, play.html; built by a delegated agent, reviewed here):
   title, creation, play with plate and dialogue panel (check sums, strain with cost, lock
   text), Daybook tabs (Notes, Claims, Margin, Sheet, Pack, Lamps, Town, History) with meter
   notches, saves, settings, pause, Tide Run chart. Keyboard, mouse, gamepad (pad untested:
   headless Chrome has none). 19 screenshots retaken 23:49Z in ui/shots/ and looked at.
   Open: http://127.0.0.1:<port>/engine/play.html?shot=<state> through game/serve.mjs.
10. DONE Answers in design/NOTES-FOR-ENGINEER.md: R1 to R13 (23:25Z) and hooks (23:28Z); report
    sent.
11. DONE Scope change (coordinator, 2026-10-16): combat (game/engine/combat/, not mine) and a
    character pipeline (characters/, not mine). Hooks built: core/hooks.mjs (fixed-step loop,
    input action state, register() with saved, migrated extension state), world/envhub.mjs
    (envAt: footing, grip, tide, depth, light, wind vector), world/anim.mjs (@anim timings,
    events, phases, rate expressions). Clean room: no reference game files are opened.
12. DONE Act 1 draft feedback: light() effect, empty needs:, word assignments, runs with a named
    goal get a built course, hazards tick in the world and during their runs.

13. DONE R15 conditional nar/line/inst ({when}, {once}, block never printed), R16 blackout puts
    Mother out, R14 confirmed; combat H1 (fight(id), beat.fight, afterFight, createFullGame,
    ui/fight.mjs, validator links) and H2 (envAt footing, animator at()). Act 1 validates with
    0 errors; quick-play paths over act1 run clean. 100 tests pass.

14. DONE Fight view fixes (combat engineer's notes, 2026-10-17): clock from
    G.ext.combat.clockRate, result card moved into the side card, full key list; stills in
    ui/shots/fight-idle and fight-pilot, looked at.

15. DONE Rework direction (author, 2026-10-17, via the coordinator): play styles per obstacle.
    - Stealth: world/stealth.mjs (@watcher, @hide, @crowd, @cue; the menu world's seen rule with
      hiding, blending, distraction; seenby.<watcher>), world/sneak.mjs (@sneak scenes: sight by
      light, fog, sodium, cone, distance; sound by footing, pace, carrying, wind and rain, carried
      downwind; smell for noses; states unaware, suspicious, searching, seen, each with a spoken
      telegraph; hiding spots and crowds; thrown distractions; outcomes win, seen, ambush, time;
      seen.<watcher>, book.<sneak>, favour; an alert or a sneak attack hands into a fight with
      G.state.ambush for the combat layer).
    - Verbs: world/verbs.mjs (@object with verb lines and the director's @spot records): climb,
      wade, hide, douse, light, power, cutpower, pry, rig, salvage, eavesdrop (SYSTEMS 5.2), read,
      throw, carry, weigh, mark, wait; checks, needs (items or conditions), uses, give, effects,
      once, gone, noise; after(minutes, "effects") timers for delayed rigs.
    - Daytime: day books (@meta clock in the day moves the clock pivot), @day records with a
      daylight term blended with each place's artificial light (day-light factor), terms day,
      daylight and phase, crowds and schedules by day.
    - Shell: verbs in the What is here list, ui/sneak.mjs and ui/sneakchart.mjs (telegraphs as
      words and marks, awareness notches, last known, cover); stills verbs.png, sneak.png,
      sneak-alert.png looked at.
    - Test content: test-content/yard.lwd (every verb, watchers, a nose, a cue, three sneaks),
      test-content/day.lwd. Tests: stealth, verbs, day (node --test tests/*.test.mjs: 90 pass).
16. DONE Clean-room architecture specs read (ARCHITECTURE-DE, -NRFTW, -ZP, DIALOGUE-AND-VOICES
    v2, PRESSURE-SYSTEMS v2). Adopted, and how ours differ:
    - Named gates and instructions registered by modules (ZP): core/scope.mjs registerCalls();
      stealth, sneaks and verbs register their own calls. Ours stay expressions in one language
      (conditions and effects), not typed card pins; the validator learns each call's id kind.
    - Tuning in data (ZP counters with defaults): stealth, carrying, day phases and line cost are
      @rules names with defaults (stealth-seen, stealth-hear, stealth-decay, stealth-sodium,
      sneak-walk, carry-speed, carry-noise, phase-*, line-seconds). Ours are fewer and flat.
    - Module events (ZP, NRFTW signals): already G.on everywhere; stealth adds stealth.state,
      stealth.voice, stealth.noticed, sneak.*, verb, timer.
    - Timed status effects (ZP): after(minutes, effects) timers; no full status-effect module yet.
    - Day phases (ZP 04:00, 09:30, 15:30, 21:00): term phase with those defaults.
    - Conditional alternate text and weak-voice lines (DE): R15 {when} and R3 {below} already.
    - Deterministic fixed-step core (NRFTW): G.loop; runs and sneaks are deterministic.
    Not adopted now, with reasons: dice and push-as-advantage (Low Water has no dice; Strain
    stays flat), per-line clock cost on by default (content prices beats with cost:; the rule
    exists at 0), per-check modifier triples on a node (the @modifier records cover it; a
    per-node list is a candidate), on-demand chunk loading (acts load whole; 1,264 nodes load in
    milliseconds), per-persona credibility (guise and the Read cover it for now).
17. DONE Own mistakes found and fixed this stretch: (a) a regex word boundary written as a
    backspace character in world/runs.mjs and dialogue/book.mjs, so built run courses never got
    water and the day clock pivot never applied; the run test passed by losing on time instead
    of to the water. Fixed, and the test now requires the loss to be "swept" with water built.
    (b) game.mjs imported combat/ statically, so a syntax error in the combat engineer's work in
    progress broke the whole engine and the validator; createFullGame moved to full.mjs.
    (c) a test changed the shared ruleset (attr-min) and broke a later test; tests now change
    only their own game's state.

18. DONE Fight view for the combat engineer's 02:10Z entry: interact, lantern and talk inputs,
    the talk-exit offer box, keys matched to combat's arena page; the clock was already combat's
    rate in ui/fight.mjs, and tools/quick.mjs (the other full.mjs path) was still at 4: fixed.
    Stills ui/shots/fight.png and fight-idle/ looked at.

19. DONE Validator: talk exits of an encounter are reachable from its fight; fight_* names known;
    --carry <earlier act root> (flags and variables an earlier act sets). Act 1: 0 errors,
    0 warnings. Act 2 with --carry: 14 errors, 9 warnings, all unwritten content. 92 tests pass.

20. DONE Camera (design/CAMERA.md): world/camera.mjs (scale per area, frame with whole-pixel snap,
    talk slide, camera: wide|near|n on nodes and events, run bounds, easing, plate projection
    equal to raw-native's), ui/platecam.mjs (full-screen plate, talk panel over the right third
    while talking), /characters/ mount in game/serve.mjs at the coordinator's request. Stills
    cam-*.png looked at. Flagged: the 100 to 110 px figure in CAMERA.md matches 720 lines, not
    1080p, at 2.25 times. 98 tests pass.

21. DONE Confirmed @event records in any included file are scheduled and run (real Act 3
    hill3.ev.lost checked; new placeholder test). 99 tests pass.

22. DONE validate.mjs --carry repeats (Acts 1 and 2 under Act 3, with visited scenes); all three
    acts 0 errors, 0 warnings.
23. DONE Playthrough harness tools/playthrough.mjs + tools/policy.mjs: five builds and seeded
    random runs through all three acts and both daylight pages; output in tools/out/. All five
    builds finish; 7 of 8 random runs. Found and fixed in the engine: @meta end-clock/at-end not
    acted on; words in @var values read as skill or term names. Found for content: a dead end at
    mole3.bulb.top; events that never fire. Found for combat: brine2.brawl never ends. Harness
    fixes after checking it: novelty penalty uncapped (a capped one ping-ponged 425 times);
    Hands favours lamp projects. 102 tests pass.

24. DONE Harness chooses by intent (verb tags, check voices, what scenes start and set, ending
    preferences read from the fate rules), seeded tie-breaks and shuffled menus (identical
    results under three shuffles); fight habits per build; Hands pays lamp stages. Engine fix:
    an interrupting scene ending in exit: returns to what it interrupted. Five builds finish;
    17 of 20 random runs (the other three circle Act 1's dawn desk). 103 tests pass.

25. DONE Builds value far intents (lessons, sneak openings, props, lamp projects) by choice
    distance; Fist learns the stool move and wins 6 of 7; Hands reaches its preferred ending
    (bulb, post) and lights three Act 1 lamps. Final numbers in NOTES 04:30Z; outputs in
    tools/out/. 103 tests pass.

26. DONE Road ending in the preferences; --attentive player (leading-mark pairs, Mother on,
    lamps tended); collier outcome and rule inputs recorded per run. Collier through: attentive
    2 of 25, plain 2 of 25; the marks are gated upstream (balance never lit in Act 1, bulb
    rarely offered, Mother lost to the wreckers). Harness bug fixed: number assignments were
    invisible to the intent reader. Results in NOTES 04:45Z and tools/out/collier-summary.txt.

27. DONE Attentive player fixed: lamp choice as a plan with look-ahead (the town's choice valued
    once), gate terms excluded from goals, no wiping a kept pair, no day2 promise, defence of
    Mother by distance from 02:30, Old Light lantern in the eye; collier inputs read at 04:05.
    Collier through: attentive random 20 of 20, plain random 9 of 20; builds 4 of 5 both ways.
    103 tests pass.

28. DONE One look (author, 2026-10-17): fights play in the plate view (ui/fightlayer.mjs,
    world/stage.mjs, platecam frameOn), overlays for HUD, talk-exit offer and result; ui/fight.mjs
    a wrapper for combat's harness; @area arena: placement for the art lead; setFigureDrawer for
    the character lead. Build layer prepared: @item requires and upgrade stages, gear(slot), save
    v4. 172 tests pass; five builds finish; acts validate clean. LOOK-UNIFIED.md pending.

29. DONE Gate pages (SYSTEMS-FULL 19.4): world/gates.mjs (@gate id, resolved: flags, pages),
    paid once on the first resolving flag through the sheet's xp, logged and toasted, settled on
    load; validator warns on gates that can never pay; harness reports pages per act. Content has
    no @gate records yet: baseline pages by Act 3's end 3 to 7 per build. 109 tests pass.

## Log
- 2026-10-16 23:00Z: resumed after the previous session stopped at a usage limit. Inventory: 25
  files, 1950 lines, no tests/ folder. Smoke run: test content loads with 0 errors, the slice
  loads with 0 errors.
- 2026-10-16 23:05Z: director decision read (draft-1 keys withdrawn; requests R1 to R13).
- 2026-10-16 23:18Z: steps 2 to 6 done. node --test (Idle priority): 50 tests, 50 pass.
  Run with: cmd /c "start /low /b /wait node --test" from game/engine.
- 2026-10-16 23:23Z: steps 7 and 8 done; 52 tests pass. UI delegated (ui/ and play.html only).
- 2026-10-16 23:28Z: hooks for combat and characters; built run courses; 58 tests pass.
- 2026-10-16 23:50Z: UI reviewed; fixed {{clock}} as hh:mm and area enter: once by default
  (enter-every: yes to repeat). lint() split into phases. 58 tests pass. Open for others:
  game/serve.mjs lacks ".css": "text/css" (polish agent's file; ui/styles.mjs works around it).
- 2026-10-17 00:10Z: R14 to R16 and combat H1/H2 done; notes answered.
- 2026-10-17 00:18Z: fight view fixes; stills retaken and reviewed.
- 2026-10-17 01:01Z: rework layers (stealth, verbs, daytime), spec ideas adopted; 90 tests pass.
- 2026-10-17 01:09Z: fight view inputs and talk offer; quick.mjs clock fixed.
- 2026-10-17 01:14Z: validator talk exits and --carry.
- 2026-10-17 01:33Z: camera built; stills looked at.
- 2026-10-17 03:55Z: events in district files confirmed.
- 2026-10-17 04:14Z: multi-act carry and the playthrough harness; results in NOTES.
- 2026-10-17 04:28Z: intent-based harness, shuffled menus, interrupt-exit fix; results in NOTES.
- 2026-10-17 04:30Z: final playthrough numbers.
- 2026-10-17 04:45Z: attentive player; collier comparison.
- 2026-10-17 04:54Z: collier measured with the fixed attentive policy.
- 2026-10-17 05:01Z: fights in the world; build layer; save v4.
- 2026-10-17 05:21Z: gate pages in the engine; awaiting @gate records.
