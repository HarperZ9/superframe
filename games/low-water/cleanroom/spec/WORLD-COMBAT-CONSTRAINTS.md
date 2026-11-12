<!-- writing-profile: research -->
# World combat constraints: how No Rest for the Wicked stops kiting (clean-room spec)

Version 1, 2026-10-17. Written for the author's direction of the same day (verbatim): "the world should
have some element of combat impact, such as limiting kiting, etc." Source: No Rest for the Wicked's
installed early-access build (Unity 6000.1.15), its decoded simulation database and its decompiled class
layout, read-only, analysed in quarantine. No capture was run.

How each number is marked:

- **[decompiled, high]**: an authored value read from the game's data, or a constant in its code
  structure. These are what the game ships.
- **[decompiled-structure, high]**: a field, enum or condition type that exists, without a value.
- **[inferred, moderate]** or **[inferred, low]**: my reading of how the values combine. Not confirmed
  by play.
- **[unknown]**: not found.

Survey base: 511 enemy AI controller definitions, 889 enemy melee attacks, the global balance and AI
configuration records.

## 1. The short answer

The reference does not stop kiting with a leash. It makes kiting fail on four fronts at once:

1. **Enemies punish distance**: if the player has been kiting for 3 to 5 seconds, or is out of reach,
   most humanoid and many monster enemies switch to a slow-telegraphed ranged throw.
2. **Enemies punish healing at range**: a dedicated action group attacks a player who heals 4 to 20 m away.
3. **Enemies close gaps**: chase bursts, leaps and lunges cover 5 to 20 m.
4. **Running away costs stamina only in combat**, and the player's stamina regeneration stops while acting.

There is no distance from an enemy's spawn point beyond which it gives up. Enemies give up only when they
lose sight of the player for 7 seconds (bosses 11). Bosses are the exception and are bounded by an arena
box.

## 2. Leash, reset and giving up

| Rule | Value | Mark |
|---|---|---|
| Maximum distance an enemy may move from its origin | 0 on all 511 controllers, which means no limit | [decompiled, high]; "0 means off" [inferred, moderate] |
| Enemy drops its target after the target is out of sight for | 7 s | [decompiled, high] |
| Boss drops its target after out of sight for | 11 s | [decompiled, high] |
| Boss fight bounds | 25 m horizontally from the fight origin; 10 m below to 15 m above | [decompiled, high] |
| Boss resets after being inactive for | 6 s (one boss type) | [decompiled, high] |
| Enemy simulation culling distance | 20 m from players (15 m predicted, 10 m to the south of the camera) | [decompiled, high] |
| Culled characters despawn after | 3 s | [decompiled, high]; that wounded enemies keep their damage on return is a public report, not checked here |
| Respawned enemies appear no closer than | 25 m horizontally, 5 m vertically from any player | [decompiled, high] |

Reading [inferred, moderate]: an enemy follows wherever it can path, and it is breaking line of sight,
not distance, that ends the chase. Beyond 20 m an enemy stops simulating and is despawned, so running
far enough ends the fight. The punishments in section 4 mean the player rarely gets that far unhurt.

## 3. Pursuit speed versus the player

| Mover | Speed (m/s) | Mark |
|---|---|---|
| Player walk | 2.5 (slow walk 2.0; sneaking x0.7) | [decompiled, high] |
| Player run | 6.0 | [decompiled, high] |
| Player run by weight band | light x1.10 (6.6), medium x1.00 (6.0), heavy x0.90 (5.4), encumbered x0.85 (5.1) | [decompiled, high] |
| Enemy main combat movement | median 3.0 (range 0 to 8) | [decompiled, high] |
| Enemy strafe | median 0.75 to 2; back-away median 2.0 (up to 4) | [decompiled, high] |
| Enemy chase burst | median 5.0 (4.0 to about 11.9) on the 54 controllers that can chase | [decompiled, high] |
| Chase limits | stops at 2 m from the target (1 to 4); lasts up to 5 s (0 to 6); cooldown 5 s (3 to 10), one example 20 s | [decompiled, high] |
| Chase start conditions | a target distance threshold (for example beyond 8 m) and an angle | [decompiled, high] |

Reading [inferred, moderate]: a medium-weight player outruns most enemies in a straight line (6.0 against a
5.0 chase that lasts 5 s), so pure pursuit does not win. A heavy player at 5.4 barely outpaces a typical
chaser. This is deliberate: the anti-kiting is done by the ranged punish, not by out-running.

## 4. Punishing distance: the anti-abuse actions

Found in 66 controllers, in action groups the designers labelled for unreachable targets and abuse
[decompiled, high]. Their trigger is built from the game's condition types (structure confirmed; the
boolean grouping is my reading):

| Condition | Value | Mark |
|---|---|---|
| Path check to the target fails (target unreachable) | raycast with a 0.1 s timeout | [decompiled, high] |
| Or: the target has been kiting for | at least 5 s (some controllers 3 s) | [decompiled, high]; that this is the trigger [inferred, moderate] |
| Or: time since the enemy's last action ended | at least 5 s | [decompiled, high] |
| Or: the target is healing | any | [decompiled, high] |
| And: a clear throwing arc, the target inside 100 degrees of the enemy's facing | | [decompiled, high] |
| Cooldown | 10 s (66 uses), 6 s (54), 9 s (10), 5 s (2) | [decompiled, high] |

The game has a dedicated "time kited" condition type, alongside "target speed away from agent" weighting
[decompiled-structure, high]. How "time kited" accumulates (moving away, out of melee range, or both) is
[unknown].

The punish itself, for the common humanoid [decompiled, high]: a 110-frame ranged throw. It winds up
slowly (the animation plays at 0.40x, then 0.25x), releases the projectile between frames 63 and 92, and
ends slowly (0.30x). Movement is disabled during it. Large enemies throw bombs or boulders instead.

**Ranged retaliation** [decompiled, high]: 7 controllers retaliate against a player who shoots them, after
3 to 6 ranged hits taken, within 9 to 21 m.

**Healing punish** [decompiled, high]: 14 controllers carry a group that fires when the target heals,
from 4 or 6 m out to 20 m, after at least 2 s in combat, with a clear throwing arc. Target choice also
weighs a healing target +0.5, against +0.1 for staying on the current target [decompiled, high].

## 5. Closing the gap

- 73 enemy actions are only selected when the target is at least 5 m away [decompiled, high]. Common
  distance bands: 6 to 20 m (11 actions), 5 to 15 m (9), 6 to 12 m (6), 6 to 15 m (5), 5 to 12 m (5),
  12 to 20 m (3) [decompiled, high]. They are leaps, thrusts, running attacks, shield throws and air blasts
  [decompiled, high from action names, described here generically].
- Melee attacks stretch their root motion toward the target during a short window near the end of
  startup (up to 20 m of stretch for the player; enemies use per-attack stretch settings) [decompiled,
  high]. Enemy attacks rotate toward the target at 540 to 720 degrees per second and predict target
  motion up to 0.4 s ahead [decompiled, high].
- Some enemy attacks keep tracking a dodging target (the dodge does not shake them) and others do not;
  this is set per attack [decompiled, high].

## 6. Stamina while engaged

| Rule | Value | Mark |
|---|---|---|
| Running costs stamina | 10 per second | [decompiled, high] |
| Running out of combat | free | [decompiled, high] (a "free run out of combat" flag is on) |
| Dodge cost | 8 per dodge, any form | [decompiled, high] |
| Stamina regeneration | 35 per second, after a 0.4 to 0.5 s pause following any action | [decompiled, high] |
| Running out of stamina | locks stamina actions for 0.55 to 2.0 s | [decompiled, high] |
| Encumbered (over 100% load) | no dodge and no attack from a run | [decompiled, high] |

Reading [inferred, moderate]: a kiting player in combat spends 10 stamina a second running and 8 a dodge,
and regenerates nothing while running, so a starting bar of 50 to 60 lasts about 5 seconds of running.
That lines up with the 3 to 5 s "time kited" punish: by the time the throw comes, the player has little
stamina left to dodge it.

## 7. Terrain, ledges and hazards

| Rule | Value | Mark |
|---|---|---|
| Player fall damage starts at | 7.5 m | [decompiled, high] |
| Player dies from a fall at | 10 m | [decompiled, high] |
| Fall damage multiplier | 0.5 | [decompiled, high] |
| Fall roll (landing roll) needs horizontal speed of | 6 m/s | [decompiled, high] |
| Enemies that die from falls | 91 of 381 enemy definitions, at 5 to 7 m | [decompiled, high] |
| World kill height | 100 m below the world origin | [decompiled, high] |
| Walkable slope | up to about 53 degrees (cosine 0.6) | [decompiled, high] |
| Gravity | 34 m/s2 for the hero's movement; 40 for character collision | [decompiled, high] |
| Area hazards | ticks every 0.2 to 2 s, radius 2.25 to 3 m | [decompiled, high] |
| Surface damage presets | 8, the first an instant kill | [decompiled, high] |

Reading [inferred, moderate]: ledges cut both ways. Enemies can be knocked off for a kill at 5 to 7 m, and
a player backing away blind risks a 7.5 m drop. Kiting near edges is a gamble.

## 8. How many enemies engage at once

- No attack token or simultaneous-attacker limit was found in the AI data or structure. The only attacker
  constant (16) is a buffer capacity, not an engagement rule [decompiled-structure, high]. Engagement
  limits are [unknown]; there may be none.
- Spacing comes from strafing instead: enemies hold a ring around the player, typically 3 to 6 m (optimum
  4 m) and up to 20 m for ranged enemies [decompiled, high], and attack when their own action cooldowns
  (randomly weighted) allow.
- Group alert: most enemies alert only themselves (radius 0); some alert others up to 25 m away
  [decompiled, high]. Vision median 10 m (up to 60) over 120 degrees (up to 360); hearing 5 m (loud
  sounds up to 12) [decompiled, high].
- Co-op scales enemy action cooldowns by 0.8, 0.7 and 0.6 for 2, 3 and 4 players [decompiled, high].
- Target choice weighs distance (divided by 30 m) and hits taken (x0.2), plus the healing and stickiness
  offsets in section 4 [decompiled, high].

## 9. What this means for Low Water [P]

The author wants live-action fights in which kiting does not pay. Starting values from the reference:

1. **No spawn leash; a sight timer instead.** An enemy gives up after 7 s without sight of Lamb. Fog,
   blackout and alleys then become the honest way out of a fight.
2. **A kiting clock.** Track how long Lamb has been moving away or out of reach. After 3 to 5 s, the enemy
   switches to a slow, readable ranged answer (a thrown bottle, a hook, a lantern), cooldown 6 to 10 s.
3. **Punish healing at range.** If Lamb eats or drinks within 4 to 20 m of a hostile, they throw.
4. **Gap-closers with distance bands.** Give each enemy one move that only fires beyond 5 or 6 m and reaches
   12 to 20 m.
5. **Running costs breath only in a fight.** 10 a second while engaged, free otherwise.
6. **Ledges as a two-way risk.** Quay edges and the harbour floor drop: falls hurt from 7.5 m; enemies can
   be knocked into the water.
7. **Spacing over tokens.** Have enemies hold a 3 to 6 m ring and attack on their own cooldowns, and add a
   token limit only if playtests show pile-ons.
