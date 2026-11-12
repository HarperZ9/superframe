<!-- writing-profile: research -->
# Combat feel: No Rest for the Wicked (clean-room spec)

Version 2, 2026-10-16 (late). Version 1 was public sources only; this version carries the reference's
own tuning, read from its installed data. Builders: the numbers here are the reference's authored values.
Use them as the calibration target for feel, then tune for Low Water.

Source tags:

- **[D]** data inspection: decoded from the installed game's simulation database (read-only, analysed in quarantine). Highest confidence for authored values; the build is the installed Steam early-access build (Unity 6000.1.15).
- **[S]** structure: read from the decompiled class layout (field and enum structure only, no logic).
- **[I]** my inference from [D] or [S]; not confirmed by play.
- **[R]** public source (see version 1 sources in section 9).
- **[P]** my proposal for Low Water.
- **[M]** measured from capture. None yet.

All frame counts are at 60 frames per second. The reference authors its action timelines at 60 fps
(animation segments carry frame counts that convert exactly to the stored seconds) [D]. Times stored in
seconds were converted with frames = round(seconds x 60).

## 0. How the reference builds a fight (architecture in one page)

- The whole fight runs in a deterministic fixed-point simulation (16.16 fixed point), separate from the
  presentation layer [S]. Every move is an **action asset**: a timeline with a duration, typed time
  windows, curves, hit volumes and events [D][S]. Presentation (animation, VFX, camera shake, sound) is
  attached by a parallel view asset and never changes the outcome [S][I].
- An action's timeline holds **window sections**, each a typed span with a start and end time and, for
  cancel windows, a mask of which action classes may cut in [D]. The section types that matter for feel:
  input buffering allowed; cancellable by anything; cancellable by movement; cancellable by a listed action
  class; cancellable by the next attack of the string; invulnerable; parry window; tap-release allowed;
  charge allowed; dodging; a loopable mid-roll span; three tiers of hit immunity (shrug off light, medium,
  or all hits) [S][D].
- Action classes used in masks: default, melee, ranged, special, dodge, quick dodge, block, parry,
  finisher, turn [S].
- Cancel windows also have procedural defaults: when a timeline does not list its own, an attack becomes
  cancellable by movement or another action after 18% of its recovery, by another attack after 5%, and a
  string's final hit after 50% [D]. Most player attacks use explicit windows (below).
- **Root motion** drives movement during actions: each action stores a sampled root-motion track
  (time, x, y, z, yaw) at 60 Hz, scaled per action [D]. Attacks can stretch root motion toward a target
  inside a 0.5 s window near the end of startup, capped at 20 m of stretch (2 m for running attacks) [D].
- **Per-action time-scale regions** replay parts of an animation faster or slower without changing its
  data (eased in and out) [D]. Enemies use these heavily to shape telegraphs (section 4).

Low Water reading [P]: this split (deterministic action timelines with typed windows, presentation layered
on top) is the architecture to build into the engine, whatever the moves are. See `ARCHITECTURE-NRFTW.md`.

## 1. Dodge

### 1.1 Which dodge: carried-weight bands

Load ratio = equipped weight / load limit [D]:

| Band | Load ratio | Stamina regen multiplier | Dodge form |
|---|---|---|---|
| Light | below 0.35 | x1.2 | quick step |
| Medium | 0.35 to 0.60 | x1.0 | roll |
| Heavy | 0.60 to 1.00 | x0.8 | heavy roll |
| Over | above 1.00 | x0.6 | heavy roll [I] |

Band thresholds and regen multipliers [D]; the band-to-form mapping [R] and consistent with the data [I].
The load limit grows with the load attribute (100 at the starting value, 500 at 50, 800 at 100) [D]; a
base load value of 70 also exists in the hero stats [D], and how the two combine is unverified [I]. A
mid-weight one-handed weapon weighs 30 [D].

### 1.2 Dodge timings

| | Quick step | Roll | Heavy roll |
|---|---|---|---|
| Total length | 43 f (717 ms) | 74 f (1233 ms) | 160 f (2667 ms) |
| Invulnerable | f3 to f20 (17 f) | f7 to f31 (24 f) | f11 to f31 (20 f) |
| Input buffered from | f16 | f24 | f23 |
| Melee attack may cut in from | f15 | f44 (melee or dodge) | f63 (melee or dodge) |
| Another quick step from | f33 | n/a | n/a |
| Block, parry, special, ranged from | f32 | f46 (anything) | f68 (anything) |
| Fully free | f41 | f46 | f68 |
| Distance (root motion x scale) | 2.88 m x 0.55 = about 1.6 m | 4.0 m x 1.4 = about 5.6 m | 5.28 m x 0.8 = about 4.2 m |
| Stamina cost | 8 | 8 | 8 |
| Stamina regen frozen after | 0.4 s | 0.4 s | 0.5 s |
| Steering during | 250 deg/s | 250 deg/s | 170 deg/s |

All values [D]. The cost of 8 is flat and modified by stats for each dodge type [S]. Starting max stamina
is 50 to 60 (section 2), so a dodge spends 13 to 16% of a fresh bar [I].

Further dodge rules [D]:

- The roll has a loopable middle span (f14 to f30 roll, f19 to f30 heavy roll), and the dodge controller
  can skip 0.167 s of the roll (quick step: 0.067 s), which is how the roll stays responsive [D][I].
- Direction locks 0.05 s after the dodge starts [D].
- The quick step has a direction mode: with a target closer than 3 m it steps in front; holding the button
  and releasing within 0.25 s, or a double tap within 0.35 s with less than 80 degrees between taps,
  select variants [D]. A missing stick input reuses the last valid move input from the previous 0.2 s [D].
- The roll does not break the player's own block [D].
- Getting up from a knockdown: a fast roll (70 f, invulnerable f6 to f32, about 4 m) or heavy roll
  (120 f, invulnerable f8 to f32) can replace the get-up (73 f, free from f38) [D].

Feel summary [I]: the light dodge is short, cheap in time, and mostly invulnerable up front; the roll
trades 31 extra frames of commitment for three times the distance; the heavy roll keeps a similar
invulnerable span but almost doubles the recovery. Weight changes the cost of being wrong, not the
protection.

## 2. Stamina and focus

| | Value | Source |
|---|---|---|
| Max stamina | attribute curve: 50 at the starting attribute (10), 70 at 15, 100 at 25, 250 at 100; the hero stats also add a flat 10, so a fresh character likely has 60 (the sum is unverified) | [D], sum [I] |
| Regeneration | 35 per second base, times the load-band multiplier | [D] |
| Regen freeze after an action | 0.5 s default; 0.4 s after a dodge; per action otherwise | [D] |
| Regen while blocking | x0.1 | [D] |
| Running | 10 per second | [D] |
| Parry cost | 15 | [D] |
| Melee attack cost | weapon stat: base 9 x class multiplier (13.5 for most one-handed classes, 9 for knives and rapiers, 18 for halberds and scythes) | [D] |
| Max focus | 100 at the starting attribute, 140 at 12, 200 at 16, 850 at 81 | [D] |
| Focus from a parry | flat 50 bonus on top of the weapon's on-hit gain | [D] |
| Focus on hit | weapon stat, base 10 (rapier 7.5) | [D] |

The earlier player report of "100 focus per parry" [R] does not match the current data (50) [D].

Feel summary [I]: at the start a fresh bar holds six to seven dodges, or three to four attacks plus a dodge;
the 0.4 to 0.5 s freeze means stamina only comes back when the player stops acting, so stamina paces the
exchange rather than limiting the total.

## 3. Attacks

### 3.1 The structure of a press

Every melee press is two actions [D]:

1. A **wind-up** plays while the button is held. A tap-release window opens 0 to 25 frames in (most
   one-handed weapons: f2); releasing inside it plays the normal attack. A charge window opens later
   (one-handed: f19 to f40; two-handed: f40 to f84); still holding at that point plays the charged attack.
   Over-charge is allowed [D].
2. The **attack** itself: startup, hit volume active, then recovery with cancel windows.

A weapon class has up to four alternative strings (A to D) of up to four hits, plus running, rolling and
quick-step follow-ups and plunges [D]. Which string a weapon uses is set per weapon [D].

### 3.2 Reading the table

- **Startup to hit**: frames from the press to the first active frame of the hit volume. For a tap this is
  the wind-up's tap frame plus the attack's own startup [I from D].
- **Active**: first to last frame the hit volume is live, attack clock [D].
- **Combo**: span in which the next attack of the string may cut in [D].
- **Dodge-cancel**: first frame a dodge may cut in [D].
- **Free**: first frame anything may cut in; the rest of the timeline is follow-through only [D].
- **Step**: root-motion distance of the attack x its scale [D].

### 3.3 First hits, by class (tap and charged)

| Class | Tap: startup to hit | Active | Combo window | Dodge-cancel | Free | Step | Charged: hold, then startup | Charged active |
|---|---|---|---|---|---|---|---|---|
| Straight sword | 2 + 15 = 17 | 15 to 23 | 26 to 41 | 27 | 45 | 1.5 m | hold 29, then 20 | 20 to 26 |
| Curved sword | 2 + 26 = 28 | 26 to 38 | 39 on | 39 | 68 | 0.5 m | hold 27, then 16 | 16 to 41 |
| Rapier | 15 + 6 = 21 | 6 to 11 | 15 on | n/a | 27 | 1.3 m | hold 49, then 37 | 37 to 44 |
| Spear | 12 + 19 = 31 | 19 to 23 | 24 to 31 | n/a | 48 | 1.3 m | hold 60, then 19 | 19 to 31 |
| Dagger | 0 + 15 = 15 | 15 to 20 | 32 on | 33 | 64 | 1.4 m | hold 19, then 15 | 15 to 20 |
| Paired daggers | 12 + 6 = 18 | 6 to 9 | 9 to 18 | 9 | n/a | 2.0 m | hold 36, then 11 | 11 to 16 |
| Fists or gauntlets | 6 + 12..15 = 18..21 | 12 to 21 | 22 on | n/a | 28 | 0.8 m | hold 30, then 8..12 | invulnerable f0 to f15 |
| Club | 6 + 11 = 17 | 11 to 31 | 26 on | n/a | 48 | 0.7 m | hold 28, then 16 | 16 to 48 |
| Axe | 2 + 32 = 34 | 32 to 53 | 67 on | 58 | 91 | 1.6 m | hold 29, then 20 | 20 to 39 |
| Hammer | 0 + 32 = 32 | 32 to 38 | 42 on | 48 | 72 | 1.3 m | hold 40, then 16 | 16 to 33 |
| Katana | 2 + 24 = 26 | 24 to 31 | 45 on | n/a | 74 | 2.3 m | hold 36, then 16 | 16 to 24 |
| Scythe | 1 + 44 = 45 | 44 to 62 | 62 on | n/a | 81 | 1.2 m | hold 30, then 45 | 45 to 57 |
| Halberd | 9 + 31 = 40 | 31 to 43 | 66 on | n/a | 87 | 2.0 m | hold 50, then 45 | 45 to 62 |
| Great sword | 23 + 25 = 48 | 25 to 33 | 48 to 52 | 73 | 74 | 0.8 m | hold 53, then 33 | 33 to 44 |
| Great axe | 8 + 48 = 56 | 48 to 72 | 68 on | n/a | 108 | 1.3 m | hold 60, then 42 | invulnerable f8 to f38 |
| Great hammer | 15 + 25 = 40 | 25 to 37, second volume 63 to 67 | 70 to 111 | n/a | 100 | 3.4 m | hold 40, then 25 | 25 to 34, 65 to 85 |
| Great club | 18 + 33 = 51 | 33 to 42 | 70 to 111 | n/a | 100 | 3.4 m | hold 60, then 37 | 37 to 67 |

All frame values [D]; startup sums [I from D]. "n/a" means the timeline lists no explicit dodge window,
so the procedural default applies (dodge after 18% of recovery) [D][I].

Patterns worth copying [I]:

- **Buffer early, cancel late.** Input is buffered from about f9 of a one-handed attack (two-handed: f18
  to f39) and released at the combo or cancel frame, so mashing is never punished by dropped inputs and
  never rewarded by speed.
- **Dodge-cancel arrives 4 to 6 frames after the hit volume ends** on one-handed weapons (straight sword:
  active ends f23, dodge from f27). The commitment is the swing, not the follow-through.
- **The combo window opens around the dodge-cancel frame and closes before "free"**, so continuing the
  string and bailing out are decided at the same moment.
- **Charging is a held decision**: one-handed charges commit after about half a second of holding; two-
  handed after two-thirds of a second to 1.4 s. Some charged and unarmed attacks carry invulnerability on
  their first frames (fists f0 to f15, great axe f8 to f38) as an armour-break tool.
- **Two-handed weapons are slow to start and long to finish** (40 to 56 frames to the first hit, free at
  frame 100 or later) but step 3 to 7 m when charged.

### 3.4 Damage and impact per class

Weapon base stats: base value x class multiplier [D]. One-handed classes listed (two-handed classes are in
the same table but were not decoded in this pass):

| Class | Damage | Poise damage | Stamina per swing | Weight |
|---|---|---|---|---|
| Straight sword | 14 | 1.2 | 13.5 | 30 |
| Curved sword | 16 | 1.0 | 13.5 | 25 |
| Wakizashi-type short blade | 14 | 1.2 | 11.25 | 30 |
| Rapier | 10 | 1.0 | 9 | 10 |
| Knife | 10 | 1.0 | 9 | 10 |
| Spear | 14 | 1.0 | 13.5 | 35 |
| Axe | 18 | 1.4 | 13.5 | 30 |
| Club | 16 | 1.4 | 13.5 | 30 |
| Mace | 16 | 1.6 | 13.5 | 30 |
| Hammer | 20 | 1.6 | 13.5 | 30 |
| Scythe | 18 | 2.2 | 18 | 30 |
| Halberd | 24 | 2.4 | 18 | 40 |
| Unarmed | 8 | 1.0 | 9 | 1 |

Per attack, a charged hit adds +1 poise tier and a knockback multiplier of about 2.0 (taps 0.25 to 1.5)
[D]. Attacks may override damage per string step (for example -30% damage and poise on a fast step, +30%
damage and +1 poise on a finisher) [D].

## 4. Poise, stagger and interruption

Two separate meters on the receiving side [D]:

| Meter | What fills it | Decay | Freeze before decay | Effect at full |
|---|---|---|---|---|
| Interruption | poise damage, converted by tier: tier 0.5 = 25, 1 = 100, 2 = 125, 3 = 150, 4 = 175, 5 = 200 | 30 per second | 2 s | the target's action is interrupted (hit reaction) |
| Stagger | poise damage, converted by tier: 1 = 10, 2 = 25, 3 = 50, 4 = 80, 5 = 120 | 30 per second | 6 s | a long stagger, open to a finisher |

Poise defence reduces both: interruption resistance up to 90% at defence 5; stagger resistance 10% at 1,
20% at 2, 35% at 3, rising further at 4 and 5 [D]. Actions can carry immunity windows of three tiers
(light, medium, all hits) and a flat armour value [S][D].

Reading [I]: interruption is fast and forgiving (it drains after 2 s), so light weapons interrupt by
rhythm; stagger is slow and long-memory (6 s before it drains), so heavy weapons build it across an
exchange. A tier-1 tap fills the interruption meter in one hit at tier 1, while stagger needs many hits.

Player hit reactions [D]:

| Reaction | Length | Cancellable by dodge from | Free from | Notes |
|---|---|---|---|---|
| Light | 38 f | f30 | f30 | buffer from f20 |
| Medium | 81 f | f40 | f60 | slides 1.7 m |
| Heavy | 144 f | f70 | f95 | immune to light hits f0 to f65 |
| Massive | 144 f | f42 | f112 | invulnerable f0 to f37 |
| Knockdown | 106 f | n/a | f80 | immune to medium hits throughout; slides 3 m |

## 5. Block and parry

**Block** [D]: a 120-degree arc in front; movement allowed (walking, not running); stamina regen x0.1
while raised; turning speed unchanged. Five block-reaction lengths by incoming weight (very short to very
long), a separate broken-block reaction and a broken-block-from-no-stamina reaction. Attacks can be flagged
to break blocks (about 18% of enemy attacks are) [D].

**Parry** [D]:

| | Value |
|---|---|
| Stamina cost | 15 |
| Parry action length | about 97 f (two segments) |
| Parry-active window inside the action | f6 to f13 (7 frames, 117 ms), after an input-change detection span f0 to f6 |
| Whiff recovery | melee from f22, free from f25 of the first segment |
| Cooldown after a parry | 0.3 s |
| Cooldown after taking damage | 0.4 s (no parry) |
| Rapid repeat against bosses | allowed |
| Controller timing settings | a 0.10 to 0.30 s window setting, a double-tap window of 0.2 s, a tap-release variant with 0.2 s max delay and 0.167 s buffer |

About 79% of enemy melee attacks are parryable [D]. A parry yields the flat +50 focus (section 2) and puts
the attacker into its "parried" reaction, which is per-enemy data [D]; the length of that opening varies by
enemy and is not one number [I].

## 6. Enemies and telegraphs

Across 889 enemy melee attacks with hit volumes [D]:

| Measure | Value |
|---|---|
| Startup to first hit, median | 46 f (767 ms) |
| 10th to 90th percentile | 19 f to 91 f |
| First hit to "free", median | 65 f |
| Parryable | 79% |
| Breaks block | 18% |
| Uses time-scale regions | 449 of 889 (51%) |

**Telegraph shaping** [D][I]: half of enemy attacks replay parts of their animation at a different speed.
The common pattern is slow, then fast: the wind-up plays at 0.25x to 0.75x (the pose holds and reads), then
the strike plays at 1.2x to 2.0x (the hit arrives sharply). Unblockable attacks invert it: start fast
(2.0x) to a held pose (0.55x), then a fast strike (1.7x). Multi-hit specials slow each recovery (0.3x to
0.5x) to show the gap. Eased transitions of 0 to 0.5 s smooth each change.

**Tracking** [D]: enemy attacks rotate toward the target at 540 to 720 degrees per second during startup;
some attacks lerp the target position fully when the player dodges (tracking dodges) and others do not
(value 1 or 0 per attack); attacks can predict target motion ahead. This is the mechanism behind the
"enemies follow early dodges" report [R].

**Aggro and recovery** [D]: out-of-combat health regen starts 10 s after combat at 15 m away. Enemy stats
scale by level (health 70 at level 1 to 950 at level 30).

## 7. Lock-on and camera

**Camera** [D]: pitch 45 degrees down, vertical field of view 56.5 degrees, far plane 250 m; the camera
may rotate within 0 to 70 degrees of pitch and -45 to +45 degrees of yaw and roll; the lock-on field of view
multiplier is 1.0 (no zoom when locked).

**Lock-on** [D]: acquires in a full 360-degree cone up to 20 m (10 m up or down); attackers count as 1.5x
closer and recently hit targets 2x closer for 20 s, so the lock prefers whoever is fighting the player.
Sub-targets on large enemies are allowed.

**Melee auto-aim without lock** [D]: 100-degree cone, 8 m. With soft lock: 120 degrees, 5 m. Ranged
auto-aim: 120 degrees, 15 m. The first attack of a string may snap up to 360 degrees toward a target (some
weapons limit this to 90). Attack startup rotates the attacker at 1800 degrees per second toward the
target, with stick steering at 180 degrees per second; wind-ups rotate for 0.2 s.

## 8. Hit feedback

What the data and structure show:

- **No hit-stop mechanism was found** in the simulation or presentation class structure by name or by
  data (no freeze or hit-pause fields; the time-scale regions are per-action animation retiming, not a
  global freeze) [S][D][I]. Contact weight is carried by other means, below. Confirm by capture (plan A15).
- **Camera shake** is of two kinds [S]: an inertial spring-damper rig that the weapon tip speed and the hit
  speed push, with separate position and rotation springs and noise, and an explosion falloff; and authored
  shake assets placed on action timelines (position and rotation curves, an oscillator with frequency and
  amplitude per axis, blend-in and blend-out, attenuation by distance or by whether the source is on
  screen). Values sit in presentation assets not yet decoded.
- **Rumble** [S]: timed left and right motor strengths with a start offset, duration and priority.
- **Knockback** [D]: every hit carries a knockback multiplier (taps 0.25 to 1.5, charged 2.0); blockers
  take 0.85x.

## 9. Proposals for Low Water [P]

Low Water still has no combat by design (`design/SYSTEMS-FULL.md` section 0). These carry the reference's
measured feel into Tide Runs; if the director admits combat, section 3 applies directly.

1. **Adopt the action-timeline model in the engine**: typed windows (buffer, cancel by class, invulnerable,
   brace), root-motion tracks, per-action time-scale regions, presentation on a separate layer.
2. **Footing bands** from carried weight and wetness, with the reference's thresholds as a start
   (0.35 / 0.60 / 1.00 of the limit). Light: a 43-frame hop with an immune span f3 to f20. Medium: a
   74-frame stride with a slide. Heavy: a slow plant. A soaked coat counts as weight.
3. **Brace instead of parry**: a 7-frame window after a 6-frame detection span, 15 breath, a 0.3 s
   cooldown, and a 0.4 s lockout after being hit.
4. **Breath instead of stamina**: 50 at the start, 35 per second back after a 0.4 to 0.5 s pause, dodge 8,
   brace 15. Cold shortens the maximum.
5. **Two footing meters like the reference's two poise meters**: a fast one (drains after 2 s) that makes
   Lamb stumble, and a slow one (drains after 6 s) that puts Lamb on one knee.
6. **Telegraph the sea like the reference telegraphs enemies**: waves draw back at 0.25x to 0.75x speed,
   then break at 1.5x to 2x; rogue waves start fast to a held crest.
7. **Weight without hit-stop**: as in the reference, carry impact by spring shake, rumble and knockback.
   Start with a positional spring push of a few centimetres on a wave strike, and test a 2-frame freeze
   against none; keep whichever reads better under sodium light.

## 10. Still to measure (capture, plan section 1)

Real input latency; hit-stop (confirm absence); camera shake amplitudes; the parried-enemy opening per
enemy size; the two-handed class base stats; how the load limit combines its two sources; whether
enemy hit-volume times are before or after the time-scale retiming.

## Sources (public, from version 1)

- gamerguides, "Equip load and dodging", 2024-03-26, updated 2024-05-02: https://gamerguides.com/no-rest-for-the-wicked/guide/gameplay/basics/equip-load-and-dodging
- Steam discussions (player reports, 2024): https://steamcommunity.com/app/1371980/discussions/0/4369130199805446996 ; /599653207707300768 ; /599651516483147327 ; /4369130199803018635 ; /4369130369048262165 ; /4365753864551974635 ; /4349990638028182783
- games.gg parry guide (undated): https://games.gg/ur/no-rest-for-the-wicked/guides/no-rest-for-the-wicked-guide-parry/
- Wikipedia, No Rest for the Wicked (video game), read 2026-10-16: https://en.wikipedia.org/wiki/No_Rest_for_the_Wicked_(video_game)
- Edge, March 2024, via PressReader: https://www.pressreader.com/australia/edge/20240321/282106346617078
- Private Division announcement, 2023-12-07: https://www.businesswire.com/news/home/20231207867055/en/Private-Division-and-Moon-Studios-Announce-No-Rest-for-the-Wicked/
- The AU Review, 2024-05-03: https://www.theaureview.com/games/early-access-review-no-rest-for-the-wicked/
- Moon Studios forum: https://forum.norestforthewicked.com/t/feedback-on-the-combat-system/9207 ; /t/high-priority-issues-that-hurt-the-game-right-now/16491 ; /t/option-to-aim-focus-skills-at-the-mouse-cursor/25775
- Patch notes, April and May 2024: https://www.sportskeeda.com/mmo/news-no-rest-wicked-patch-notes-april-21 ; https://hard-drive.net/guides/no-rest-for-the-wicked-update-patch-notes-may-3/
- Game Informer, 2026-09-01: https://gameinformer.com/2026/09/01/no-rest-for-the-wicked-10-launch-delayed-to-march-2027
