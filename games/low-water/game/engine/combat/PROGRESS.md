# Low Water combat: progress

Combat engineer's log. Brief from the coordinator, 2026-10-16: combat in the manner the
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
24. DONE Coordinator, 2026-10-17 (min-maxing should pay visibly): the 19.11a breakpoints at 8 and
   10 (roster.mjs breakpoints(), sim/hits.mjs, sim/world.mjs, data/arts.mjs second specials), the
   director's tempo mapping (sim/tempo.mjs), PEN shortens bench minutes, the pilot spends
   Composure. Focused 11.9 s and 81% Standing left, spread 15.3 s and 69%, both 55 of 56.
   - taught-move flags: the content's short names (move_turn, move_guard, move_hold, move_shove,
     move_return, move_reset, move_count) map onto the learned moves (roster.mjs MOVE_ALIASES);
     before this the harness Fist learned three moves that did nothing.
   - fix: Pip's turn and Rook's step ran before the move existed and threw (sim/fighter.mjs
     startMove); exposed by the aliases, regression test in tests/act2.test.mjs.
   - plates: the art lead's marks.fight are read; a mark on a cell the grid leaves solid moves to
     the nearest clear cell within 2 m (sim/plate.mjs snapClear; the quay's first foe moved 1.8 m).
   node --test from game/engine: 201 of 201 pass; harness Fist 7 of 9.
25. DONE UI lead via coordinator, 2026-10-17: a dodge's invulnerable frames never fall below the base
   count as NOSE shortens the move (the roll went 20 to 19 from NOSE 3 to 5 before; now 20, 21, 22,
   23 at NOSE 3, 5, 8, 10 while the roll runs 60, 56, 52, 50 frames). preview() returns `frames`:
   startup, active, recovery, total, base, i-frame and parry windows for light, heavy, catch, step,
   the roll form the load picks, art and art2. tests/tempo.test.mjs, tests/build.test.mjs; 205 of 205.
26. DONE Coordinator, 2026-10-17 (character lead's pops in the heavy and the third light strike):
   every strike names a `sweep`, the last frames of startup where the swing travels (heavy 10,
   last link 7, other links 4, charged 2 to 8); anim/drive.mjs plays a clip's sweep phase there so
   the active frames carry only contact; export-timing writes it. No frame count changed (min-max
   identical). Also: brawl spawn offsets never land in a wall (the Brine marks moved). 206 of 206.
27. DONE Coordinator, 2026-10-17 (the Build page reads only preview()): preview(levels, tool,
   { gear, temper, fitting }) adds Breath per second and delay, protection and the share softened,
   damage, poise and Breath per strike (light, heavy, charged, specials), dodge distance in metres,
   time staggered, breakpoints, tempo factors, and an `applied` echo; clothes, temper and fittings
   preview without being paid for. Confirmed the character lead's reshaped strikes (no frame change).
   tests/build.test.mjs; 213 of 213.
28. DONE Author, 2026-10-17 ("limiting kiting"): the world shapes the fight. Ledges and falls, slope and
   hazards, engaged running, a per-foe kiting clock with a lunge and a throw, pursuit and cut-offs, the
   sight leash, the beam, and a time-cap break-off that does not pay kiting. Design and numbers in
   design/COMBAT-WORLD.md; log in PROGRESS-WORLD.md. 242 of 242 with the engine's.
29. Root PROGRESS 182. The inner arena (author, 2026-10-22: the inner arena, where bosses are the character's
   own self-lies made flesh; "the great sins ... demons and the devil/shaytan himself"; "the battle with the
   Golem, and many more other mythical creatures and entities; like an arena of intense battle. As well as
   Frankenstein"; "push for a completion"; "All actions and blockers approved"). Design: design/spine-plan/
   08-ARENA.md, 10-INFERNO.md, inferno/02 to 08, DECISIONS-2026-10-22.md; critic 06 and 07; sensory 03 and 05.
   **Bounds, written and committed before the code.** Each has the measure that holds it and a control that
   must fail; a check whose control passes is reported as broken, not as met.

   Rulings taken here (reversible by the author or the coordinator):
   - Inner fights never end as `win`. A boss brought down by blows ends as `forced` (the lie proved). "Force"
     in every rule below means the outcomes `win` (outside the inner arena only) and `forced`.
   - Friday is meant to be lost (08-ARENA's Never Once, merged into it by inferno/03): its standing has a
     floor of 20% and it cannot be brought down. Force still ends it at the floor (the coat turns: the lie
     shown false by the player's own hands, inferno/03) as `forced`; its true end is `lose`.
   - Boss data lives in combat/data/flaws.mjs (one source for moves, phases, verbs, boons and lines), not in
     a q_flaws.lwd, so the slice's content gates are untouched; the self-lie rows are read from
     content/quota/q_readback.lwd and the told lines from the scenes, never copied.
   - Non-force endings record only the flaw, the verb and the beat the next scene plays: no `dc`, no level,
     no stat (DECISIONS 4). Force endings may lower a `dc` (the lie hardens) and never raise one.

   | # | Bound | Measured with | Control that must fail |
   |---|---|---|---|
   | V1 | Refuse: a refuse flaw's own door; 30 frames (0.5 s) of steering inside it ends the fight as `fled`. Every other inner fight has no exit | tests/inner.test.mjs, forcecheck | a door on a flaw with no refuse verb (flawcheck) |
   | V2 | Endure: after `endure.rounds` boss rests with no blow of Lamb's landed on the boss side, the fight ends as `endured`; a landed blow resets the count to 0 | inner.test.mjs | one blow landed after rest 1: no end at rest `rounds` |
   | V3 | Yield: guard and interact held 60 frames (1.0 s) lays the tool down (`laid` event; strikes refused from then on); a flaw's follow-up (rub, lift, release) is a further hold within its reach; ends as `laid` | inner.test.mjs | a 59-frame hold lays nothing |
   | V4 | Lose: Lamb's Standing gone ends as `down`; the inner run plays the loss beat and goes on to the morning; a loss never ends the run | inner.test.mjs | (the stage after a down is the morning, not over) |
   | V5 | Name: the naming choice over a live fight; Lamb stands still for 90 frames (1.5 s) with the world running; moving cancels; choosing what was told does nothing; ends (or drops a limb) as `talk` with the row named | inner.test.mjs | a move on frame 60 of the hold names nothing |
   | R1 | Turning points only: an inner fight is armed only by a hinge whose self-lie is in G.state.selfLies; the external ladder (LADDER.bosses and every skin) never holds an inner boss | notallycheck, inner.test.mjs | a hinge whose self-lie was not heard arms nothing; a ladder holding an inner boss fails |
   | R2 | No tally on the player's surface: the inner run has no record(), writes no storage, its summary holds no count; the inner view draws no damage figures, no round line and no outcome banner | notallycheck (a storage spy; the HUD's drawn text) | a planted storage write; a planted "flaws beaten: 3" |
   | B1 | Boons only after force: an offer exists only after `forced`; one offer, the flaw's own, declinable | boonledger | a boon offered after `laid` |
   | B2 | Every boon has a cost: `who` is a @char in content/quota, `scene` is a content file that exists, `beat` is written; taking it emits `boon.cost` through onRecord at once | boonledger | a boon with no cost; a cost on "a family" |
   | S1 | No boss beatable only by force: every flaw names a non-force verb, and on the simulator a resolution bot reaches it within the flaw's limit on 2 seeds; a force bot never reaches a non-force outcome | flawcheck, forcecheck | a flaw whose only end is force; an endure count it can never reach (rounds 999) |
   | S2 | No inner fight changes a fate: no outcome or boon writes bowls, taken, members, end or a witness beat; played, G.state's households and fates are equal before and after every outcome | flawcheck, forcecheck | a planted outcome that writes bowls(haldane) |
   | S3 | Non-force endings change no number: their records carry no dc, level, stat or stock | flawcheck | a planted dc on a yield |
   | S4 | Force hardens: every dc shift on a force ending is below 0 | flawcheck | a planted force dc of +1 |
   | S5 | Meant to lose cannot be won: under the force bot on 3 seeds a meantToLose boss's standing never reaches 0 and the outcome is never `win` | forcecheck | the same boss with its floor removed |
   | S6 | Faces: a boss's faces are its liar's line only (Furrowe: abel, ned, pell, ruth, the era 5 character; Brack: josh, will, ann, leon); no Hesh person, no child, no world perpetrator (Holt, Gedge, Pask, Krall, Mott, Fenn) as a part | flawcheck | a planted Tomas face |
   | F1 | Hit-stop as the feel checklist: light 0, heavy 2, at most 4 with three or more opponents, on every inner contact | inner.test.mjs over each boss's played fight | FEEL.hitstop.heavy set to 6 |
   | F2 | Telegraphs: every inner special that strikes winds up 18 frames or more and shows its tell for 60% of that or more; Friday's tells are drawn as a wall shadow | inner.test.mjs | a planted special with a 12-frame wind-up |
   | F3 | Morphs readable: each phase change opens with the roar (iframes, no strike for 50 frames) and its arena or look change starts on that frame; no blow lands on Lamb within 50 frames of a morph | inner.test.mjs | a planted phase whose opening strikes at once |
   | F4 | Shake never hides a tell: on the arena page the shake is at most 3 px at 1080p while any tell shows (CAMERA.md ruling) | inner-capture (the view's offset each frame) | ?shakeclamp=off |
   | F5 | Flash and red (05-CARE.md section 2): at most 3 flashes in any 1 s per 1/16-frame window (a luminance pair of 10% of the brighter, the darker under 0.80); no saturated-red transition; 1 a second under reduce-flashes | inner-capture's frame analyser over every boss capture | a planted 5 Hz full-frame flash and a planted 2 Hz red pulse over a quarter of the frame must fail; a 0.5 Hz 5% breath must pass |
   | F6 | Framing: Lamb and the boss's body inside the frame on every captured frame | inner-capture | a planted 40 m arena with the boss at the far end |
   | T1 | The combat suite (135 before) and the engine suite (286 before) all pass after | node --test | |


   **Results, 2026-10-22** (the bounds above unchanged; one checker bug and three real misses found and fixed, below).
   | # | Result | Evidence |
   |---|---|---|
   | V1 | Met: only Only has a door; the fight ends `fled` on frame 30 or 31 of steering in it | tests/inner.test.mjs |
   | V2 | Met: 4 rests in a row end Nobody Checks; a blow after two rests starts the count again | inner.test.mjs; forcecheck (16.9 s on both seeds) |
   | V3 | Met: 59 frames lay nothing, 60 lay the tool; no strike starts after | inner.test.mjs |
   | V4 | Met: a loss records its beat and the run goes on to the morning | inner.test.mjs |
   | V5 | Met: what was told names nothing; 89 frames do not name, 90 do; a move on frame 60 cancels; the Host loses a limb a name | inner.test.mjs |
   | R1 | Met: 8 inner ids against 3 ladders; every flaw unarmed with nothing heard, armed by its self-lie; Nobody Checks never at a hinge | tools/notallycheck.mjs |
   | R2 | Met: no record(), no storage call in a played run, no count in the summary, no figure or tally word in the HUD's drawn text over three fights | notallycheck |
   | B1, B2 | Met: 6 boons, each offered only after `forced`, declinable, its cost recorded at once on a @char (Mott, Davey, Tomas, Edie, Mary, Aaron) | tools/boonledger.mjs |
   | S1 to S6 | Met: flawcheck 0 errors over 8 records; forcecheck 35 fights, 0 errors (resolution bots reach every non-force verb on 2 seeds; the force bot ends forced or down; Friday never under 6.8 of 34 standing; the story's state equal before and after) | tools/flawcheck.mjs, forcecheck.mjs |
   | F1 | Met on every flaw's 30 s force fight | inner.test.mjs |
   | F2 | Met | flawcheck |
   | F3 | Met: no blow lands within 50 frames of a morph in 6 fights that morph | inner.test.mjs |
   | F4 | Met after a fix: 3.00 px at most under tells (it was 3.28: the cap was per axis) | tools/inner-capture.mjs |
   | F5 | Met after a fix: 0 to 3 flashes a second per window across 17 captures, no red. Before the fix the arena's shake was a per-frame sine (about 18 Hz), which made dark windows shimmer 0.007 in luminance: 4 flashes a second by 05-CARE's wording ("10% of the brighter"). The shake is now keyed as CAMERA.md. Under WCAG's own wording (10% of full luminance) none of these would count; the stricter wording is kept | inner-capture |
   | F6 | Met after a fix: the maze was 24 m and lost the beast at the wicket (191 frames); it is 21 m now, 0 frames out | inner-capture |
   | T1 | Combat 149 of 149 (135 before); engine tests/ 290 of 290; `node --test` from game/engine 488, 483 pass, 5 skipped, 0 fail | node --test |
   Every control failed (or, for the breath, passed) as it must: 10 in flawcheck, 3 in forcecheck, 3 in boonledger, 4 in
   notallycheck, 5 in inner-capture (5 Hz flash, 2 Hz red, the breath passes, a shake under a tell with the clamp off,
   the 40 m room).
   Fixed on the way: the checker counted 7 transitions as a fourth flash (the rule is pairs); the Accuser could never
   go silent with fewer than 3 rows to read; the clerk was named "The Accuser" on screen (a devil's name: now "The Clerk").
   Stills: game/capture/inner-2026-10-22/ (98 stills, summary.json): every boss's first form, first tell, each morph
   (+20 frames) and settled form (+70), and its end, for the force bot and each resolution.
   **What reads, looking at them:** Received's stacked sheets and fan of pen hands, its closing ring, the signed sheets
   piling on the floor and the flock wheeling; Friday's boy's shoulders rising in shadow on the wall, and the kitchen
   going dark but for the table in the Saturn phase; the Golem's HELD on the brow, the grille on its chest, its growth,
   and the shine left after the rub; Only's coats on chairs round the table, standing and sitting; the Minotaur's horns,
   its turn into the player's own shape at the gap, and the thread trailing behind the player; the pole and its tally
   board; the Host's pasted notices; every anchor, crisp and warm in the base look against the dream palette.
   **What does not read yet:** Friday's arm (a thick line, lost under the character); the Host's limbs (small knobs,
   their marks too small); Received's eye phase (the bowl closes only the corners); Lamb is small and dark beside
   the big forms; the carts are hard to tell from the road; the ice under the Host is lighter floor, not ice; Saturn's
   eyes (two pixels). All placeholders: the art list is in design/NOTES-FOR-ENGINEER.md (2026-10-22).
   **Remains:** the other six bosses in the critique's order (Order, Everybody Says, Fond of Them, Under the Goats, The
   Long Barn, The Figure); the Descent (the kept flaws in rings, data and arena edits); the story's side (the hinge
   call on the night after each scene, the beats the next scenes play, the two NEW LINE self-lies under the dialogue
   gate); the shell's fight layer has no inner mode; the grey test and the trailer test (protocols, not code); the
   sensitivity readers before content (the Golem's inversion above all). Not proven: that a person reads any of this as
   the stills suggest; the bots play every resolution the easy way.
30. Root PROGRESS 185. The inner arena staged and drawn to be read (coordinator, 2026-10-22, after looking at
   friday-force-p1-settled-f725.png: a dithered greybox, the sin "PRIDE" on screen, a small player, forms that do not
   read; references design/art/references/2026-10-22: Martin's mezzotints 22 to 24, Schinkel's cave temple 62, the
   Trafalgar paintings 26 to 29, Goya). Commits 3566beb, 719c102, 97beaf5, 2aa8e5f, 631ad71.
   **Bounds, set before the measures were first run** (each with a control that must fail; combat/tools/innermeasure.mjs):
   | # | Bound | Control that must fail |
   |---|---|---|
   | R3 | No sin on the player's surface: no drawn text names a classical sin or a flaw's own label; a skill voice that shares a sin's name (PRIDE) is captioned with the boss's shown name (07-SENSES section 3) | a caption "PRIDE"; a caption rule that passes voices through |
   | P1 | The player is 130 px tall or more at 1080 lines on every frame he stands (design/CAMERA.md) | (unit test: a 120 px player) |
   | P2 | On every frame half or more of the player's outline differs from the ground 2 px outside by dL* 8 or more | the player drawn flat at the ground's value, no edge (?innerfx=rim,lambflat) |
   | F1 | Every part a form names is 6 px or more across at 1080 and differs from the ring round it by dL* 15 or more (by its core, its ink edge or, for a striped part, its pattern) at every still | a part over empty ground; a part 1 px across |
   | S1 | The grey silhouette test: two forms overlap under 0.75 as plain silhouettes at game scale on one foot point; one boss's body looks (Saturn, the arm, the flock, the eye, the cell, the walls, the gap) under 0.85 from each other | a silhouette against itself (unit test) |
   F4, F5 and F6 from step 29 are kept and rerun.

   **What changed.** The arena page draws the inner arena through a staged path, not the plain dither
   (combat/data/stages-inner.mjs; arena/innerstage, innerback, innerfloor, innerfx, innertone, forms, forms2,
   innerfigure, innersil):
   - The camera keeps the room's front edge at the foot of the view, so the building behind it has the top of the
     frame. One shaft of light per room from a source the player can see (a high window, the noon window, the kitchen's
     small window, the wicket), landing on the room's own first lamp (03-SURREAL rule 5). Behind each room a colossal
     building made of small repeated parts: tiers of windows, pigeonholes, piers off the frame, cells in tiers with a
     stair, sacks stacked as cliffs, the district line's posts to the horizon, the bridge as one arch over the ice. A
     raw-rock frame for the yard and the ice. Black-velvet floors lit by the light the simulation reads.
   - Smoke as a mass at the foot of the building and the engine's own smoke field (paint/smoke.mjs) rising from the
     room's sources; debris that drifts (sheets, ash, snow, grain, shards); chips and dust at a blow; a dust ring at a
     morph, dark, never a light.
   - Oil and Ink, where the engine has it: the bodies on their own layer in three depth passes (behind the player, the
     player, in front) with the engine's painted rim (paint/edge.mjs) and an ink line where the ground is lighter, a cool
     far edge where it is darker; the tone from the painter's value planes and the paraffin palette glazed in pigment
     space (paint/planes, palette, km) at the dream's 55% saturation (01-LOOKS L6); a fixed mezzotint grain heavy in the
     darks. The brush painter (paint/painter.mjs) is not used: it needs the 3D figures' bind space.
   - The colossal scale is in the building, never in a boss: 06-SYSTEMS ("Intensity without volume") keeps every boss
     under the Brack kitchen's ceiling except Saturn, which is the ceiling. Saturn now reaches it (4.3 m) and bends under
     the beam.
   - Forms redrawn for silhouette: Received's sheets, pen hands and the shine, the flock, the eye on the floor with lids,
     iris and the pupil the clerk pools in (the iris follows him, inside the eye); empty coats with open collars, the
     twelfth chair; Friday broad and faceless, Saturn with lit eyes (12 x 9 px at 1080), Never Once's arm at least 2.6 m,
     across the table and over the player's shoulders, with a lit sleeve and a pale cuff; the Golem in pale clay with a
     black iron door, arms out across the way in the cell; the Minotaur's iron horns, and at the gap the player's own
     shape; the striped barrier pole and its tally; carts at a cart's size with pale-rimmed wheels on pale snow; the
     sacks with 80; the clerk with the evidence behind him; the Host in paper notices with paper wings and Abel's hat,
     its limbs pale paper inside an ink line (pen hand, arm, clay fist, horn, sleeve, boom), drawn after its body;
     fallen forms lie as coats, never black holes; the Host's ice as white rime with dark cracks over black river ice.
   - The player: a figure with legs that ease into a stride, a coat, a pale brim and collar, a stronger found edge than
     the bosses; where a body in front covers him, his outline is drawn over it.
   - Fixed on the way, my own: the first occlusion test compared the player against the figure layer after the edge
     pass, so his own edge read as a cover and drew a bright outline that flickered (6 flashes a second in Friday's
     kitchen). Measured, fixed, 3.

   **Results, game/capture/inner-staging-2026-10-22/** (85 stills, summary.json, before-after/ with 82 pairs against
   step 29's stills; the run's log is game/capture/inner-staging-2026-10-22.log):
   | # | Result |
   |---|---|
   | R3 | Met: 0 errors over every caption and four fights' drawn text; both controls fail. Friday's PRIDE lines read FRIDAY; Nobody Checks' read NOBODY CHECKS. The sin mapping is right in the data: Friday's sin is wrath (flaws-will.mjs; 03-BESTIARY-B "Fatherhood ... Sin: wrath"); PRIDE was the skill voice that first said the lie |
   | P1 | Met: the player stands 165 px at 1080 in every fight (168 on the ice); 63 to 105 px only in a roll |
   | P2 | Missed on 5 of 17,537 frames: Friday force 3 of 1,424 (lowest 0.488), the Host named 1 of 204 (0.478), the One Who Withdraws 1 of 112 (0.483). Medians 0.66 to 0.96. The control (player flat, no edge) fails |
   | F1 | 325 of 355 parts pass; 30 misses: the Host's wings where they cross the shaft (11), Received's upper lid where the iris crosses it (5), Never Once's arm on 2 of 4 stills (10.6, 13.1), Friday's raised hand at its first still (8.2, 10.4), Only's collar on 2 of 174, the Golem's door on 2 of 13, the clerk's evidence (8.3, 10), the Host's limbs at the loss's last still (2), one cart wheel and one horse where carts overlap. Every Saturn eye passes (65 to 78); the cuff 43 to 62; the horns 30 to 47; the boom and tally by pattern 52 to 76; the Host's ice against the open floor 25.5; the shadow tell 15 to 21; 4 parts were off the frame's edge and are counted apart |
   | S1 | Met: 24 forms and looks; closest different forms 0.71 (the arm against the Minotaur); closest body looks 0.60 (the Golem and its cell). Room-only looks are not held to differ: Only's noon and chair (0.94), the pole when the carts come (0.84) |
   | F4 | Met: at most 3.00 px under tells |
   | F5 | Met: 1 to 3 flashes a second, no red, in every fight; controls as before. The flash windows now average every pixel: sampling every 4th pixel aliased thin bright lines (the place ring, the hat brim) into false flashes in the dark rooms (the clerk: 7 a second sampled, 1 averaged). To stay inside 05-CARE's wording ("10% of the brighter value") on a dark ground the heavy-blow glow is off (?innerfxon=glow shows it), the contact star is smaller and dimmer, the dust burst is faint, and the rim is set from the ground round the bodies, not fixed |
   | F6 | Met: 0 frames out |
   | T1 | Combat 155 of 155 (149 before; 6 new: R3, the staging and the judges); engine tests/ 290 of 290 |

   **What still falls short of a shipped game, looking at the stills.** These are placeholder forms drawn in 2D
   primitives: they read, they do not impress. Nothing animates beyond a stride, a raised arm and wing beats; no boss
   has a body that moves like a body. The building is a stage flat behind a top-down room: at this camera the
   architecture gets a band at the top of the frame, so the Martin scale is suggested, not felt; it needs a low view.
   The smoke is soft and slow; there is no Trafalgar violence in a blow, because the care rule at this darkness
   leaves almost no room for light at contact (the fix is the care rule's wording or a lighter ground, not my call).
   The arm still sinks into the father's dark coat where it crosses him. The Host's wings lose their edge in the
   shaft. Saturn's torso is a wedge. The grain reads as film grain more than a rocked plate. The floor reads as a
   rectangle on black at the sides. Not proven: that a person reads any of this as the measures say.

   **Asks** (not my lane): the character lead: production forms built to these silhouettes and part lists (the S1 keys
   and F1 names in summary.json), with bodies that move; the player's production figure with the pale brim and collar
   kept at 165 px. The UI lead: the boss bar and caption sit over the building's band; the word "winded" on the boss
   bar. The raw-native camera agent: a focal plane on the fight's floor with the building painted coarser out of focus,
   and a low pull-back at each morph so the building's height is seen; any focus drift must stay inside F5. The
   coordinator: whether 05-CARE's "10% of the brighter value" should be WCAG's 10% of full luminance, which would give
   the blows back their light; and the data's `town` holds titles (Friday) where the bestiary's town names are virtues
   (Fatherhood), so "named for the virtue" is not yet true on screen.
   To resume: serve game/ on 8754 (`node game/serve.mjs --port 8754`), then from game/engine
   `node combat/tools/inner-capture.mjs --out ../capture/<dir>` (about 15 minutes with the controls;
   `--only friday:force --no-controls` for one fight, `--query innerfx=rim` to leave a layer out, `--dump` for frames).
31. Root PROGRESS 187. The coordinator's four staging calls (design/spine-plan/DECISIONS-2026-10-22.md, "Inner arena
   staging calls", a10b172). Commits 1516e99, 8ebcf60.
   - **Flash rule in WCAG's wording.** 05-CARE section 2 and F5 count a change of 0.1 relative luminance (10% of 1.0),
     the darker under 0.80, at most 3 a second, no saturated red. New control: a dim 5 Hz swing on a dark ground passes
     (a flash by the old wording only); the 5 Hz flash and the 2 Hz red pulse still fail. The heavy-blow glow is back
     on (radius 34, one per 30 frames at most), the full contact star, a heavier dust burst. F5 over 17 fights: 0 to 1
     flashes a second, no red (was 1 to 3 under the old wording with the glow off).
   - **Height.** 06-SYSTEMS rewritten: single-sin bosses stay under the kitchen ceiling in their first form; the Host
     and every body morph may exceed the room. The Host is 4.4 m (cap 4.4), Saturn 5.6 m; in those phases the building
     leans out from the boss and the ceiling splits over it, widening over 60 frames (no luminance step).
   - **Virtue names.** `town` holds 03-BESTIARY's names (Diligence, Humility, Duty, Fatherhood, Protection,
     Obedience); `title` keeps the old names. Nobody Checks has none in the bestiary: Trust, my call, reversible. R3
     covers the names (0 errors); a test holds Friday at FATHERHOOD.
   - **No numeral.** Nobody Checks' stack is full from the front and, as the player comes round to its near side, an
     open shell with the dim backs of the far sacks inside. Its beat and senses lines say the same.
   Results, game/capture/inner-staging-2-2026-10-22/ (85 stills; before-after/ against the first staging pass; the
   hollow stack recaptured alone in inner-staging-2-check-2026-10-22/): F4 3.00 px at most, F6 0 out, P1 165 px,
   S1 met (24 forms and looks), every control as it must (8). P2 misses 4 frames (Friday 2, the Host named 1, the One
   Who Withdraws 1; lowest 0.478). F1 25 misses of about 355: the Host's wings where they cross the shaft (6), Received's
   upper lid under the iris (5), the arm (2), Friday's raised hand at its first still (2), Only's collar (2), the clerk's
   evidence (2), the Golem's door (1), the Host's hat and one limb at the last still (2), one cart wheel and one horse
   (2), the hollow when the player stands in front of it (1). Combat 155 of 155; engine tests/ 290 of 290.
   Looked at: FATHERHOOD and TRUST read in the bar and captions; Saturn and the Host now stand over the room and the
   leaning building with the split reads as the room failing to hold them; the split is often near the top edge and
   small at this camera. The hollow stack reads as a shell from the near side.
