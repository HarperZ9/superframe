<!-- writing-profile: research -->
# Live conversation: talking inside a running world (clean-room spec)

Version 1, 2026-10-17. Written for two author directions of the same day (verbatim): "It should not be
turn based, it should be live action with dialogue menus leading into either fighting, dialogue, or
interrogation/communication ~ movement should be fluid, and live action based", and "only no rest has the
fluid combat; but disco elysium and zero parades has the expanded dialogue and unique RPG elements".

So this file has two halves:

- **Part A**: how No Rest for the Wicked, the only live-action reference, starts and ends NPC talk inside
  a world that keeps running.
- **Part B**: how Disco Elysium and ZERO PARADES dialogue depth can sit on top of that kind of live
  movement. Which features survive a running world, and which need adapting.

Marks: **[decompiled, high]** authored value or constant from the installed game; **[decompiled-structure,
high]** a field or type that exists, no value; **[inferred, moderate/low]** my reading; **[unknown]**.
No capture was run. Disco Elysium and ZERO PARADES are used only for dialogue and RPG structure, as the
author directed; their own movement is ignored.

## Part A: No Rest for the Wicked

### A1. The world does not stop

- The game is a deterministic online simulation shared by up to 4 players; there is no pause state in the
  simulation structure, and NPC talk is an action played by the player character inside that simulation
  [decompiled-structure, high]. The world therefore keeps running while the player talks [inferred,
  high].
- Dialogue beats can be marked unskippable per action [decompiled-structure, high].

### A2. Starting a conversation

| Rule | Value | Mark |
|---|---|---|
| Talking is | a player action, flagged as non-combat | [decompiled, high] |
| Facing cone to start an interaction | 50 degrees on most interactables (369 of 532); 45, 70, 60 and 30 on others; 360 for a few | [decompiled, high] |
| Move into place first | most NPCs need no alignment walk (alignment distance 0 on 415 entries) | [decompiled, high] |
| Player-to-player interaction | within 3 m and 90 degrees | [decompiled, high] |
| Soft lock-on is suppressed near interactables | yes (a dedicated distance setting) | [decompiled-structure, high] |
| Block talk when enemies are near | an option exists: no talk with an enemy within 7 m horizontally and 3 m vertically; set off in both shipped uses | [decompiled, high] |

### A3. Ending a conversation

| Rule | Value | Mark |
|---|---|---|
| Cooldown before the next interaction | 0.5 s after the talk ends (1.5 s on one interactable) | [decompiled, high] |
| Run button disabled after an interaction | 0.5 s | [decompiled, high] |
| Interactions that break on damage or on attack | the option exists; set on one interaction | [decompiled, high] |
| Walking away mid-talk | [unknown] from data; the UI layer owns it | [unknown] |

### A4. From talk to fight

- 711 NPC entries carry a combat style field: 550 have none, 138 a first style, 14 a second, 7 a third,
  2 a sixth [decompiled, high]. So some talking NPCs are built to fight [inferred, moderate].
- Quest data drives turns from talk to hostility through world events and flags rather than a special
  dialogue-to-combat transition [inferred, low]. No direct hand-off record was found [unknown].

Reading: No Rest for the Wicked keeps talk short and light. It is a walk-up interaction with a facing cone,
a half-second cooldown, and no pause. It has no checks or skill voices; its depth is in quests and items,
not in conversation.

## Part B: Disco Elysium and ZERO PARADES depth on live movement

### B1. What the two dialogue references do, in brief

Detail is in `DIALOGUE-AND-VOICES.md` (Disco Elysium) and `PRESSURE-SYSTEMS.md` (ZERO PARADES). The parts
that matter for a live world:

| Feature | Disco Elysium | ZERO PARADES |
|---|---|---|
| How talk starts in the world | click an interactable within a 1 m interact radius; world "thought orbs" pop short conversations as the player passes [decompiled, high] | 1,032 world interaction flows; 451 ambient bark cards [decompiled, high] |
| Clock cost | 23 in-game seconds per line [decompiled, high] | up to 30 s per card, barks and orbs 30 s [decompiled, high] |
| Inner voices | 21% of lines; usually one voice at a time (section B3) [decompiled, high] | passive cards per skill, 9,732 [decompiled, high] |
| Checks | passive (threshold), retryable, one-shot; itemised modifiers [decompiled, high] | the same three; push by advantage roll at a pressure cost [decompiled, high] |
| Tense moments | none | set pieces where time stops, hubs of about 3 routes [decompiled, high] |

### B2. What survives a world that keeps running

| Feature | Survives as is? | Why |
|---|---|---|
| Passive voice lines | yes | they are lines that appear without a choice; they can play as barks while Lamb walks, from the moment a threshold is met [inferred, moderate] |
| Thought orbs and world barks | yes | both references already fire short interactions from proximity [decompiled, high] |
| Itemised check modifiers | yes | they are data on the choice, computed from state at the moment of choosing [inferred, high] |
| Retry rules (retryable versus one-shot) | yes | they depend on state change, not on time stopping [inferred, high] |
| Beliefs with research or dissonance timers | yes, if timed in world time | both references count in-game time, which a running world supplies [inferred, high] |
| Clock advanced by reading | adapt | in a running world the clock moves anyway; charge reading time as a pause in which the world slows rather than a hard cost [inferred, moderate] |
| Long branching conversations | adapt | in a live world others can interrupt; the reference live game keeps talk short and blocks it only by option when enemies are near [decompiled, high]; long scenes need a protected state |
| Time-stopped tense set pieces | adapt | ZERO PARADES stops time [decompiled, high]; in a live game this becomes a slowed-time bubble or a staged scene with menus |
| Choosing a check under threat | adapt | the reference games choose with unlimited time [decompiled, high]; a live game must either slow time while the menu is open or keep menus short |

### B3. How many voices a line carries (Disco Elysium, new data)

From the dialogue graph [decompiled, high]:

- Following inner-voice lines forward through the graph: the median run is 1 line, the 90th percentile 2,
  the longest 9.
- Distinct voices in a run: one voice in 12,406 cases, two in 2,080, three in 363, four in 97, five in 29,
  and six to nine in 10.

Reading [inferred, moderate]: voices interject mostly alone, sometimes in pairs; a chorus of four or more
is a rare set piece. In a live world, a single voice bark at a time is the natural fit, with the occasional
two-voice exchange.

### B4. A model for Low Water [P]

1. **Talk is a protected bubble, not a pause.** When Lamb opens a conversation, nearby hostiles (none, in
   most scenes) are held by the same rule No Rest for the Wicked ships as an option: no talk if a hostile is
   within 7 m; inside the bubble, the world runs at a slowed rate so the tide still moves.
2. **Three exits from every menu, as the author asked**: talk on, interrogate (checks with itemised
   modifiers and Strain), or fight (the menu hands off into a live action with the opponent already
   facing Lamb).
3. **Voices as barks in the open**: passive voice lines play while walking, one at a time, at most two in a
   row, using the Disco Elysium threshold distribution.
4. **Walk-away rule**: leaving the bubble ends the talk; the other party remembers it (a flag) and may
   follow, call out or turn hostile, by character.
5. **Set pieces become slowed-time scenes**: the ZERO PARADES hub-and-route structure (about 3 routes per
   hub, one-shot checks) runs while the world crawls at a fraction of speed, so the tension stays physical.
6. **After talk**: a 0.5 s interaction cooldown and a 0.5 s run lock, from the reference, so a click-through
   does not fire a second conversation or a sprint by accident.
