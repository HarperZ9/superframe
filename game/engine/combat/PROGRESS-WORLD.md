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
4. NEXT World rules: terrain (sim/terrain.mjs), engaged running, kiting clock with throw and lunge,
   pursuit, cut-off flanks, sight leash with chokes, the beam, the break-off rule.
