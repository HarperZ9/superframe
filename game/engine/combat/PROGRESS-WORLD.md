# Low Water combat: the world shapes the fight (progress)

Combat engineer's log for the world-combat brief. Private. Author direction, 2026-10-17 (verbatim):
"the world should have some element of combat impact, such as limiting kiting, etc." The design and
its reasons live in design/COMBAT-WORLD.md. Reference for combat feel and world constraints: No Rest
for the Wicked alone, through cleanroom/spec/WORLD-COMBAT-CONSTRAINTS.md (coordinator, 2026-10-17).
Clean room: specs only. CPU only, Idle priority, no windows, nothing leaves the machine.

Resume: read this file, then design/COMBAT-WORLD.md, then `git log --oneline -10`.
Run from game/engine/combat at low priority (`cmd //c "start /low /b /wait node ..."`):
- `node tools/kite.mjs 3 [--detail]`: fair against the default kiter, five styles, Act 1 and 2 plates.
- `node tools/kite.mjs 2 --search`: fair against the strongest of 12 kiting variants per style.
- `node tools/minmax.mjs 2`: focused, spread and early builds over Acts 1 to 3.
Outputs are kept in world-runs/ (out/ is ignored by git) (`*-before.txt` predates every world rule).

## PROGRESS
1. DONE Read PROGRESS.md, SYSTEMS-FULL 19, COMBAT-FEEL v2, the sim, AI, pilot and min-max.
2. DONE Terrain field agreed with the systems engineer (2026-10-17): place.json "terrain" { hazards,
   ledges, noLedge }, absent means derived only; they asked for a pure terrainAt(arena, x, z), spawns
   that snap clear of ledges, and the beam rate read from their BEAM_RATE export (0.35 rad/s,
   term("mother") == "burning").
3. DONE Kiting policy in tools/pilot.mjs (createPilot({ style: "kite", kite })), measurement in
   tools/kite.mjs. Baseline, before any world rule (world-runs/kite-before.txt, kite-search-before.txt,
   minmax-before.txt):
   - default kiter, 57 fights per style (19 encounters x 3 seeds): fair wins 48 to 57, kite 2 to 22.
   - strongest kiter per style, 38 fights each: fist 28 of 38 (fair 38) at 69 s against 12 s; hands
     35 of 38 (fair 35) at 23 s against 14 s, the long hook's reach poking from 2.6 m; others 10 to 12.
   - holes found: the 120 s cap hands a kiter a yield (7 of fist's 28 wins); the kiter leaves by exits.
   - min-max before: focused 55 of 56, 11.9 s, 81% Standing left; spread 55 of 56, 15.4 s, 69%;
     early 19 of 56.
4. DONE World rules (data/world.mjs holds every value; COMBAT_WORLD_OFF switches rules off for ablations):
   - sim/terrain.mjs: slope, ledges (a step of 1 m or more between cells), hazards from place.terrain;
     terrainAt() for the shell. sim/ground.mjs: walking stops at a ledge, a knockback or roll carries
     over and the body falls (into water: under, Breath -2; onto ground: down, hurt past 1.6 m, foes 1.5x);
     nets and ropes trip a runner or roller. sim/paths.mjs: a flow field so bodies walk round ledges.
   - running costs Breath only while engaged (1.6 a second; free otherwise).
   - ai/pursuit.mjs: the per-foe kiting clock (3.5 s), a lunge from 4 m out and a slow throw (6 to 10 s
     cooldown), chase bursts that keep a Breath reserve, cut-off points ahead of a running Lamb, the
     sight leash (7 s: call the others, hold the nearest way out). Foes carry stones; specials
     world.throw and world.lunge in data/foes.mjs.
   - the beam sweeps at the shell's BEAM_RATE while Mother burns (sim/field.mjs beamAt); weak points need
     the tell in sight.
   - the time cap gives a yield only to a Lamb who stood in the fight: opened the gap under 15% and stood
     out of reach under 60% of it (tools/kiteshare.mjs measured fair play at 0.10 and 0.53 at most).
   - pilot: walks along the ground when a ledge cuts its line or it is stuck (tools/pilot.mjs steer).
   - tests/world.test.mjs (9 tests). Combat 106 of 106; engine and combat together 241 of 241.
   After (world-runs/kite-after.txt, minmax-after.txt): fair wins fist 55, tongue 42, shadow 52, hands
   54, eye 51 of 57; default kiter 13, 1, 4, 12, 4. Min-max focused 55 of 56, 11.6 s, 81%; spread 52,
   13.8 s, 74%; early 18.
   Known cost: brains that path round walls make fair Tongue lose more (99 of 114 with every rule off,
   92 with all on, six seeds); e.strippers has no fair win for four styles before and after (it has a
   talk exit the pilot never takes).
5. DONE Measured and tuned after the rules (world-runs/*-after.txt, ablation.txt, punishes.txt):
   - found and fixed: pursuit helped the kiter (a chaser walked into its poke): a chase now arrives with
     a blow and the lunge is armoured and recovers in 26 frames; the break-off needed an out-of-reach
     share as well (apartShare 0.6); a guarded retreat no longer fills the clock; the pilot paths only
     across ledges or when stuck (keeps its fair numbers comparable).
   - four tuning variants of the clock and answers (punishAt 150, 300, faster throws, longer chases) all
     landed at 81 to 85 kiting wins against 76 for the chosen values: inside the noise, values kept.
   - tools: ablate.mjs, ablate-style.mjs, punishes.mjs, kiteshare.mjs; COMBAT_WORLD_SET for tuning runs.
   - systems engineer told (terrainAt, stepDrop, ledgeClear, beams, spawn lips, BEAM_RATE import).
   - design/COMBAT-WORLD.md written: rules, reasons, results, ablation, limits.
   Tests: combat 106 of 106; engine and combat 242 of 242.
6. DONE Coordinator, 2026-10-17 (accepted; Hands spacing left alone; strippers' exit visible; lead with
   the clock's cost):
   - Burning Mother: tools/beam.mjs on the quay and floor fights (quay2.wardens plus four Act 1), 100
     fights a row. Lit only, the beam changed nothing; added: a body in an arm is seen within 12 m
     through fog (WORLD.beam.reveal). Fog kiter: 12 wins, 0.05 lost with Mother dark; 27, 0.20 burning.
   - Hazards: nets and ropes trip only a body moving fast with its eyes behind it (the first rule helped
     kiters: chasers tripped). Proposal for the director: design/HAZARDS-PROPOSAL.md (quay, Spit,
     Ropewalk), measured with tools/hazards.mjs; the Ropewalk strand is the one that bites.
   - Presentation: anim/fx.mjs fxOf(W) (thrown, tells with answers, contacts, frozen); the systems
     engineer draws it (ui/fightfx.mjs, 195c099) and the character lead gave tells distinct shapes.
   - Found by the shell probe and fixed: sight treated a 0.5 m bench as a wall (plate tops, field
     sightClear; the systems engineer applied the same rule to sneaks, 55e76ee); "unreachable" meant "no
     straight line" (now: no path); stones stopped at benches.
   - Feel capture in the shell at 1080p, frame-exact (tools/feel_capture.py, showcase.mjs, feel_review.py);
     findings in design/COMBAT-WORLD.md "Feel". Talk exit visible at 5.0 s.
   Tests: 108 combat; 248 with the engine's at 8c7fbc8 (the engine has moved since).
7. OPEN
   - Feel items 1 to 7 in design/COMBAT-WORLD.md, owners named (camera shake under LOOK-UNIFIED R5 is the
     first, a decision for the art direction and the author).
   - In unstaged shell runs the chase blow catches a fleeing Lamb at 2.3 to 2.7 s, before the 3.5 s clock,
     so lunges and stones rarely appear live on the quay; the readability capture staged them.
   - The clock and its answers raise a kiter's cost but not its losses (88 kiting wins on, 75 off).
   - Brains that path round walls cost fair Tongue about 7 of 114 wins and spread 5 of 140.
   - The shell's fight grid (0.25 m, scene-laid) covers less of the quay than the plate's marks (531 m2
     against 646 m2 at the same cell): worth a look by the systems engineer.
