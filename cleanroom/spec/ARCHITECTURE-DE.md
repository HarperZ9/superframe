<!-- writing-profile: research -->
# Architecture: Disco Elysium (clean-room spec)

Version 1, 2026-10-17. From the decompiled class layout [S] and the decoded dialogue database [D] of the
installed Final Cut build (Unity 2020.3.12, IL2CPP). No code, text or names transcribed.

## 1. Shape of the game

A 3D isometric adventure where nearly all play is dialogue. Three layers [S]:

1. **The dialogue runtime**: a third-party node-graph conversation engine with a Lua layer. Content is
   authored in an external narrative tool and imported as one database (actors, items, variables,
   conversations of nodes and links) [S][D].
2. **The game rules ("character sheet" layer)**: attributes, skills, learning caps, modifiers with
   typed sources, the dice roller, check results, beliefs, health and morale pools, XP, clothing and
   items, the clock [S].
3. **The world**: scenes with painted plates, 3D characters, an orthographic camera with zoom limits and
   pixel-grid snapping, clickable world "orbs" that start short conversations, a journal of tasks [S][D].

## 2. How the layers talk [S][I]

- Dialogue nodes carry **conditions** (Lua expressions) and **scripts** (Lua statements). The game
  registers about two dozen modules of its own Lua functions (clock, inventory, clothing, companion,
  money, tasks, beliefs, map, sound, area logic), so content calls game rules by name [S].
- Checks are node fields: a passive threshold on a voice's line, or a retryable or one-shot difficulty
  with up to ten (condition, bonus, tooltip) modifier triples [D]. The rules layer evaluates the check
  and writes the result back for the graph to branch on [S][I].
- World memory is about 10,600 boolean variables grouped by area and character, plus counters [D].
- Each displayed line advances the clock by 23 in-game seconds [S].

## 3. Data flow for one line [I from S and D]

1. The runtime picks the next node; conditions filter candidates; forks route without text.
2. If the node belongs to a voice and has a passive threshold, the rules layer compares skill plus
   modifiers plus 6 with the threshold (or fires the weak-voice line when it falls short).
3. Alternate text is chosen by its own conditions.
4. The line displays in the text column, with the speaker's portrait if the actor has one; scripts run;
   the clock advances; variables change.
5. For a choice with an active check, the interface shows difficulty, chance and itemised modifiers; on
   pick, two dice roll and the result routes the graph and may damage health or morale.

## 4. Beliefs as a system [S][D]

A belief is an item flagged as a thought with a research time in in-game minutes, research effects and
completion effects (typed effect lists), and a state machine (unknown, known, researching, discovered,
fixed, forgotten) [S][D]. The clock drives research [S].

## 5. What Low Water's engine should take [P]

1. **Content calls rules by name.** LWD/1 effects and conditions should call engine functions by name
   (tide, light, coat, Kit, Margin, Record), registered per module, as the reference's Lua modules do.
2. **Checks as node data**: thresholds and modifier triples on nodes; the engine evaluates and writes
   back.
3. **A flat, namespaced flag store** for memory, grouped by district and character.
4. **The clock advanced by reading**, at a per-line cost set in rules.
5. **An orthographic, pixel-snapped camera** with separate interior and exterior zoom limits for the
   painted plates (see `CHARACTER-PRESENTATION.md` section 7).
