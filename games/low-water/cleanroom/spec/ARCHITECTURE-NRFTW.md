<!-- writing-profile: research -->
# Architecture: No Rest for the Wicked (clean-room spec)

Version 1, 2026-10-17. Engine-level architecture in my own words, from the decompiled class layout
(structure only) [S] and the decoded simulation database [D]. No code or logic is transcribed. Builders use
this to put the same capabilities into Low Water's engine; section 6 proposes how.

## 1. The two worlds: simulation and view

- **Simulation**: a deterministic fixed-point world built on a commercial deterministic-networking
  engine. All gameplay state lives in it: entities with components, about 120 systems, a fixed tick,
  16.16 fixed-point maths [S]. It runs identically on every peer, so co-op sends inputs, not state, and
  each client predicts ahead and corrects [S][I].
- **View**: the ordinary engine scene (meshes, animation, VFX, audio, camera, UI). It reads simulation
  state and events and never writes gameplay state [S]. Two bridges carry data across: view sync
  (transforms and component state) and event sync (one-shot events such as hits, deaths, sounds) [S].
- A system can declare that it also runs on predicted frames (the ones that may be rolled back) [S]. The
  action system does, so player actions feel immediate under latency [S][I].

## 2. Data: one asset database

- Every tuning asset (actions, weapons, enemies, items, affixes, quests, world chunks, director
  strategies, global balance) is a typed record with a 64-bit id. References between records are ids
  [D][S].
- Shipped as one LZ4-compressed, MessagePack-encoded database of about 30,000 records in 411 types, loaded
  at start-up [D]. Field names are stored with values, so the format survives schema changes [D].
- Curves are stored as sorted key arrays of (time, fixed-point value); root-motion tracks as 60 Hz samples
  of (time, x, y, z, yaw) [D].
- The editor side keeps records as engine assets with names; the build strips names [D].

## 3. The main systems [S]

Grouped by role (my grouping):

| Group | Systems (described) |
|---|---|
| Actions | action playback and selection, paired actions (finishers, backstabs), cascades (chained effects), payloads (effect bundles) |
| Combat resolution | damage resolver, damage volumes, hit-reaction resolver, poise, damage build-up (status meters that fill and trigger), health, focus, modifiers, attributes, item stats, affixes, boons |
| Movement | movement, physics, navigation and path following, local avoidance, nav-mesh tracking, look-at |
| AI | AI controllers (behaviour built from tasks, decorators and utility selectors), an AI coordinator (decides who attacks), noise and perception |
| World | streaming (integration and de-integration of world chunks), culling, fog of war, persistent clock, ambience state, creep (spreading corruption), plague |
| Encounters | director (pluggable strategies: bounties, challenges, boss battles, waves), dynamic spawners, encounters, activities and quests |
| Economy | inventory, loot, merchants, levels, classes, hunger, crafting stations |
| Session | players connect and disconnect, commands, persistence, telemetry |

## 4. Update loop (one simulation tick) [S][I]

1. Read the tick's inputs from every player.
2. Controllers turn input into action requests (with input queueing, tap and hold detection, buffers).
3. The action system advances every playing action by one tick: evaluate window sections (cancel,
   buffer, invulnerable, immunity), apply root motion and target stretching, fire timeline events,
   activate weapon hit volumes.
4. Movement and physics integrate; collisions raise signals.
5. Hits become damage events; the damage resolver applies damage, poise and stagger, picks the hit
   reaction, grants focus, and raises signals that other systems (affixes, boons, cascades) listen to.
6. AI updates (coordinator, controllers), director and spawners, streaming and culling.
7. The view reads state and events after the tick.

Signals (typed callbacks such as "damage resolved", "action executed", "component added") decouple
systems: a system subscribes instead of being called directly [S].

## 5. The action model (core of the feel)

Detail in `COMBAT-FEEL.md` section 0. In short [D][S]:

- An action is a timeline: duration, typed window sections with masks, curves, root-motion track, hit
  volumes with per-volume windows and strike data, events, time-scale regions, and per-segment
  animation retiming.
- An armament (weapon class) maps slots (normal combos, running, quick-step and roll follow-ups,
  plunges, parries, blocks, reactions) to lists of actions with per-step overrides of cost and damage.
- Player and enemy use the same action system; enemies add AI selection, target tracking settings and
  telegraph retiming.

## 6. What Low Water's engine should take [P]

1. **Deterministic core with a view layer.** Low Water has no co-op, but determinism still pays: replays,
   captured play-throughs for the trailer pipeline, and bug reproduction. Keep the night, tide, weather and
   Tide Runs in a fixed-step deterministic core; draw everything else from it.
2. **One typed record database with ids**, compiled from LWD/1 source into a compact binary at build
   time, with field names kept for tolerance.
3. **The action timeline** as the unit of anything timed: Tide Run moves, bracing, slips, set-piece beats.
4. **Signals between systems** instead of direct calls, so the Margin, the Lamps and the Record can react
   to events without knowing each other.
5. **A director with pluggable strategies** for the town's night: rumour waves, blackouts, patrols.

## Sources

Decompiled class layout of the installed early-access build (Unity 6000.1.15, IL2CPP) and its simulation
database, analysed read-only in quarantine on 2026-10-16 and 2026-10-17. Public context: see
`COMBAT-FEEL.md`.
