<!-- writing-profile: research -->
# Architecture: ZERO PARADES: Director's Cut (clean-room spec)

Version 1, 2026-10-17. From the decompiled class layout [S] and the exported project database and flow
chunks [D] of the installed build (Unity 6000.3.15, IL2CPP). No code, text or names transcribed.

## 1. Shape of the game

A narrative RPG on the studio's own node-graph runtime. It is the most modular of the three references:
the narrative runtime knows nothing about game rules, and every rule system plugs in as a module [S].

## 2. The narrative runtime [S][D]

- Content is a set of **flows**. A flow is a graph of **cards** connected through named input and output
  pins. Card kinds include dialogue fragments, forks, hubs, jumps, start and end, passive checks,
  weak-voice passives, retryable checks, one-shot checks, orbs (world interactions), barks (ambient
  lines), money options, instruction cards, belief reinforce and punish cards, counters with min and max,
  conditional alternative-text cards, sleep, slot unlock, and tactical hubs and routes for the set pieces [D].
- Each pin and card can call **gates** (named conditions returning true or false) and **instructions**
  (named effects) with typed arguments; conditions can be structured trees of AND, OR and NOT over gate
  calls and property tests [S][D].
- **Entities** describe the world's nouns: characters, items, skills, faculties, attributes, pressures,
  beliefs, status effects, rituals, personas, tasks, belief aids [D].
- **Variables**: about 19,800 flags, 5,600 counters (many of them tuning values with defaults), 32 lists
  [D]. Tuning such as push cost, pressure maximums, belief slot counts and sleep restoration lives in
  counters with default values, so designers tune in data, not code [D].
- Flows load on demand in about 320 chunks; a small set of cards is always loaded [D].

## 3. Rule modules [S]

Each module registers gates and instructions and owns a manager:

| Module | Owns |
|---|---|
| Checks | retryable and one-shot check cards; dice (2d6, advantage and disadvantage 3d6 tables), criticals |
| Pressures (limits) | three pressure meters, max values, midpoint lockout, push cost, events for increased, maxed, lockout changed |
| Skills | 15 skills in 3 faculties, ratings, caps, penalties, promotions and demotions, skill points |
| Beliefs | belief slots, reinforce and punish, dissonance, resurfacing, XP for agreeing choices |
| Status effects | timed effects on skills, faculties, pressures, personas, sleep; listeners on checks, counters, items; follow-ups |
| Rituals | routine events with cooldowns, time costs and pressure modifiers |
| Sleep, waiting, time | day phases, time events (single, recurring, spans), sleep restoration, wait costs |
| Inventory, barks, localization, save | as named |

## 4. Data flow for one card [I from S and D]

1. The runtime enters a card through a pin whose condition passes.
2. The card's hook calls run (instructions), the card displays or resolves (a check rolls, a passive
   reports), and the time module advances the clock by up to 30 seconds.
3. Output pins are evaluated in order; the first whose condition passes is followed.
4. Modules raise events (pressure maxed, status effect ended) that the interface and other modules
   observe.

## 5. What Low Water's engine should take [P]

This is the closest model to what LWD/1 already is. Concretely:

1. **Named gates and instructions** registered by engine modules; LWD/1 options and effects call them by
   name with typed arguments.
2. **Tuning in data**: every rule constant (meter max, Strain cost, lockout fraction, Margin slots,
   dissonance length) as a named counter with a default in the rules file, not in code.
3. **Pins with conditions** on node exits, so a node routes by state without a separate fork node.
4. **On-demand chunks** by district, with a small always-loaded set (the Daybook, the Margin, the Kit).
5. **Module events** so the interface reacts to state (a meter at lockout, a note suspended) without the
   script having to tell it.
