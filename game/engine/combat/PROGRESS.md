# Low Water combat: progress

Combat engineer's log. Private. Brief from the coordinator, 2026-10-16: combat in the manner the
author described ("the way that the dodges and the attacks work", paraphrase of a spoken message),
beside the dialogue spine; tense, physical, weighty; the tide, weather and light are part of the
danger. All mechanics in original expression.

Rules held: clean room (no game files of the reference opened, no lookups about it; values come
from general action-game engineering and cleanroom/spec/ only). This folder only; hooks are
requested in design/NOTES-FOR-ENGINEER.md. CPU only, Idle priority, at most 2 heavy jobs, no
visible windows, nothing leaves the machine. No writes to isomorph or sofer. Tests are engineering
tests (node --test), not proof.

## Steps
1. DONE Read PROGRESS.md, design/PRODUCTION.md, SYSTEMS-FULL.md, NOTES-FOR-ENGINEER.md, STATE.md,
   game/engine/PROGRESS.md, the engine's env and night modules. cleanroom/spec/ empty at start.
2. DONE Coordinator, mid-work (2026-10-16): cleanroom/spec/COMBAT-FEEL.md v1 landed; the director
   designed combat in (SYSTEMS-FULL 18, PRODUCTION 10 and 11, content/act1/combat.lwd); build
   against section 18. Rebased all numbers on the director's units (Standing 6 + 2 COAT, Breath
   4 + KNEES, costs 1 to 3, poise in hits) and the spec's starting frames.
3. DONE Simulation core (sim/): data-driven moves (moves.mjs), fighters with buffer, cancel windows,
   root motion, charge, tracking, breath with delay, poise with delay (fighter.mjs), hit and hurt
   volumes, evade, catch, block, guard break, grapple contest, shove into water, footing on poise,
   yield, fall (hits.mjs), lock-on, soft targeting, riposte check, sight with lanterns and sight
   modes (target.mjs), thrown things with wind and lanterns that keep burning (projectiles.mjs),
   fixed-step world with hit-stop, separation, Record, outcome and hash (world.mjs).
4. DONE Environment through the engine hub (sim/field.mjs reads G.envAt and the hub's footing grip):
   tide bands per tile, frost, wet, mud, fog and light sight, wind on thrown things, blackout,
   gusts over 20 m/s, rain dousing a thrown lantern.
5. DONE Tools by class (data/tools.mjs: shield, light, long, short, heavy, bar, unarmed) generating
   each fighter's strikes; body moves (data/body.mjs): sidestep, the roll in three load forms plus
   the lurch, riposte, shove, grapple, the lantern and a bottle.
6. DONE Two archetypes (data/foes.mjs, ai/brain.mjs): the holder (tide-wardens) and the
   skirmisher (salvors). Telegraphs, attack token, flank slots, retreat, seek, brace and scramble.
   Every Act 1 @foe maps to one of them (FOE_STYLE).
7. DONE Dialogue hand-off (encounter.mjs): installCombat(G) registers G.ext.combat (request, take,
   start, step, finish, outcome) and a loop system at order 20; reads @weapon, @foe, @encounter;
   writes fought.<id>, struck.<char>, book.violence, var fights. The `fight(id)` effect and the
   runner's afterFight are the systems engineer's to add (request in NOTES).
8. DONE Tests: node --test tests/*.test.mjs from this folder at low priority: 33 pass (moves,
   sim, replay, field, ai, encounter on the director's combat.lwd).
9. DONE Voice barks (sim/barks.mjs): ballast, knees, salt, smell, undertow, dark, pride on their
   situations; `@bark id` records (key, text) replace the placeholder lines.
10. DONE Animation interface (anim/drive.mjs): poseOf() gives the renderer actor, clip, phase and
   warped clip time; checkClips() lists missing clips; directional dodge clips (_f/_b/_l/_r), and
   under a lock a dodge keeps facing the target. tools/export-timing.mjs writes
   out/timing.combat.json in the character lead's timing schema. Agreement written in
   design/NOTES-FOR-ENGINEER.md ("Combat engineer replies").
11. DONE Test arena (arena/): index.html, main.mjs, draw.mjs, figure.mjs, hud.mjs. Placeholder
   ink figures, the engine's real night through the hub, a five-tone dither warm under sodium.
   Scenarios pair, holder, skirmisher, fog, frost, blackout. Through game/serve.mjs at
   /engine/combat/arena/ (keys in the page corner).
12. DONE Tuning: TUNING.md logs every value with its source (spec P, spec R, director, chosen).
   Fixes from the traces: a spawn knee-deep in the gully, breath that never recovered under a
   raised guard, throws that ignored the attack token, a punish path that held the token 30
   frames, the gully cut too deep for "open on foot", a quay below high water, indoor wind and
   rain, the quay's harbour rows treated as wading.
13. DONE Captures (headless Chromium, GPU off, Idle priority; tools/capture.py through
   tools/idle.sh): capture/holder (win, 23.6 s), capture/pair (down, 11.5 s), capture/fog,
   capture/frost, capture/blackout; each has arena.mp4, sheet.png and fight.json (every event).
   The browser run and the Node run give the same fight for the same seed.
14. DONE Tests: 38 pass (`cmd /c "start /low /b /wait node --test tests/*.test.mjs"` from this
   folder).

## How it feels, judged from the captures (not from playing it)
- Readable: the holder's long wind-ups, the glint on the hook during a tell, the ring that grows
  under Lamb before the drag (the one blow that cannot be caught or blocked), the catch's star on
  the case, the white flash and contact star on a hit, the smear of a swing, bodies going down and
  getting up. The tide visibly takes the floor during the pair fight and the footing line in the
  corner turns from wet stone to water at the knee.
- Weight comes from hit-stop, knockback, the flash and the long recoveries; the figures have no
  limbs, so anticipation and follow-through in the body are missing until the character set lands.
- Close bodies still merge at times; Lamb's lantern at the hip is what tells Lamb apart.
- Fog under sodium flattens the quay to one orange; blackout leaves only Lamb's lantern pool, and
  the noses that find Lamb are unseen until they strike. That is the rule working, and it makes
  the capture hard to read; a player will need sound for it.
- Difficulty against the scripted pilot: one holder is an even fight of 14 to 27 s; a skirmisher
  is harder; the pair beats the pilot every time. The pilot is a weak player; a person has not
  played it.

## Waits on
- Systems engineer: the `fight(id)` effect, `beat.fight` and `talk.afterFight()` in the runner,
  installCombat(G) at startup, the shell's hand-off, and the validator treating fight starts as
  jumps (NOTES H1). Optional: G.envAt with a footing argument, an animator call that sets clip time
  (H2). Until H1 lands, content's `fight(e.x)` still halts the game.
- Spec: measured frame data from the observation sessions (COMBAT-FEEL marks every number P, R or
  U). Rows tagged chosen or spec P in TUNING.md move first.
- Art: the missing clips listed in NOTES, and their renderer reading poseOf() time instead of
  running its own cancel and hit logic.
- Director: `char:` keys on named @foe records (for struck.<char>), @bark lines, and decisions on
  what is not built (brawl, per-foe named moves, tool wear and fittings, learned moves, the
  lens behind Keel, falling off the quay edge).
15. DONE Coordinator (2026-10-17): the systems engineer wired H1 and H2 (fight(id), afterFight,
   createFullGame, ui/fight.mjs, envAt footing, animator at). (1) Fight length: the reported 35
   game minutes is 4 minutes of fight plus the down node's own cost: 30. Pressure added anyway
   (ai/pressure.mjs: more attackers over time and against a passive Lamb, shorter cooldowns,
   opponents close in) and thrown mud and rope now hurt a little: idle Lamb is down in 6 to 15 s
   across Act 1's fights. FIGHT_CLOCK_RATE 8 offered as G.ext.combat.clockRate. (2) ui/fight.mjs
   opened headless at Idle through a harness (tools/fightview.html, tools/capture_view.py):
   capture/view-idle, view-pilot, view-conger; stills looked at. Fixed from them: a body on the
   ground drew as a sliver; the camera left half the frame on the unlit quay. 101 tests pass
   (engine and combat together).
16. DONE Author direction, 2026-10-17 (via the coordinator): a combat, talk, stealth and utility
   build must each get through; "the combat is good". Re-tuned from COMBAT-FEEL v2 (TUNING.md,
   re-tune table; provenance flagged there). Added: interruption (flinch), longer tracked
   opponent wind-ups with tells, the build's skills in the fight (roster buildBonus, BALLAST
   planting), pressure that spares an active Lamb, sneak and alerted openings with takedowns
   (sim/stealth.mjs), props lamp, cut, sluice, flood and snare (sim/props.mjs), talk exits
   (encounter `talk:`), the lantern shutter, shoves that slip a body on frost and wet stone.
   Fixed: flight needs intent (a knockback into an exit is not flight); the floor's tide rule
   reads the sea, not a sluice. Read ARCHITECTURE-NRFTW.md against this design (gaps in
   TUNING.md). 50 combat tests, 132 with the engine's, all pass. Captures: capture/sneak, tools,
   build; the older captures predate this re-tune.
17. DONE Coordinator, 2026-10-17: createFullGame moved to full.mjs (harness repointed, checked
   headless); the stealth layer's ambush flag (G.state.ambush) read at start(): the fight opens
   with the takedown landing. Notes to the systems engineer, the director and the author
   (provenance of COMBAT-FEEL v2) in design/NOTES-FOR-ENGINEER.md. 141 tests pass with the
   engine's.
18. DONE Provenance ruling recorded in TUNING.md: the study role is the dirty team, combat the
   clean team (specs only, never the games or quarantine folders); spec v2 stands as a source.
   Open: revisit hit-stop when the character set and a spring camera exist.
19. DONE Full-suite failure (coordinator, 2026-10-17): the director renamed Lamplighters to
   f.fewell and f.strand and moved encounters into encounters1.lwd. New ids fell back to the
   skirmisher (which sidesteps), and the tests read only combat.lwd. Fixed: styleFor() picks an
   archetype from the @foe record (style:, the table, the tool, then size); the tests load
   combat.lwd and every encounters*.lwd. node --test from game/engine: 142 of 142 pass. The
   fight view now maps E shove, F interact, H lantern, T talk (systems engineer).
20. DONE Coordinator, 2026-10-17 (Act 2 written): taught moves read from <district>.move_<name>
   flags (feint, mudstep, hookpull, sweep; roster learnedFromFlags); Act 2 fight areas
   (data/arenas2.mjs: hill, spit, gasholder, ropewalk); props at 0 0 placed by arena anchors
   (sim/props.mjs anchorProps), so hill.station_four and e.station put out all three white lamps
   on hill.dark. Fixed: open fights start with the opponents knowing where Lamb stood (they could
   wait forever in a big dark arena); the brain fills memory an opening seeds. Idle-down: Act 1
   6.8 to 15.6 s, Act 2 5.5 to 10.3 s. node --test from game/engine: 151 of 151 pass.
21. DONE Harness findings (04:14Z): the brawl had no opponents and could not end (now five
   brawlers on sides of their own, breaking up after 60 s; empty encounters end at once). The
   build's sheet does reach the fight (checked). Fighting build strengthened in its own stats
   only (GRIP damage and poise, BALLAST 6+ keeps its feet), braced counter softened, pilot plays
   like the build. Harness Fist build: 6 of 7 fights won; the other builds 0 to 1 of 2 to 6.
   fight.start now carries Lamb's numbers. node --test from game/engine: 162 of 162 pass.
22. DONE Every fight ends: a 120 s cap per encounter (break off as yield or fled), searchers
   head for Lamb instead of forgetting, an Old Light arena for Act 3. tests/every.test.mjs runs all
   Act 1 to 3 encounters idle and with the scripted fighter under a 125 s cap. The harness's
   random run 8 now finishes. node --test from game/engine: 169 of 169 pass.
23. DONE Author, 2026-10-17 (four directions) and the director's section 19:
   - fights in the world: sim/plate.mjs builds fight ground from a painted plate (walkable cells,
     heights, footing, walls, lamps, exits, anchors, spawns) for all twelve plates
     (tools/plate-arenas.mjs, overlays by tools/plate-overlay.py, looked at); walls stop bodies,
     thrown things and sight; G.ext.combat.usePlate(area, arena); tests/plate.test.mjs.
   - one sheet: section 19 pillars, soft caps, 17 held tools plus 4 used, clothing protection and
     weight with soaking, temper and fittings at the bench, Composure, 15 learned moves
     (data/build.mjs, data/learned.mjs, roster.mjs); tests/build.test.mjs.
   - tempo: the attribute-to-variable table (sim/tempo.mjs) drives move frames and clip rate;
     tests/tempo.test.mjs (curves, limits, a focused build against a spread one).
   - feel: held presses, no dead frame, momentum, catch and block impact, spring shake and rumble
     events, eased telegraphs; tests/fluid.test.mjs (latency 0 frames when free).
   - fixes: the NOSE evasion window was never applied (NaN), raw move kinds, wall-aware steering,
     a damaged encounter.mjs restored by hand after a bad scripted edit.
   node --test from game/engine: 199 of 199 pass; harness green.
