<!-- writing-profile: research -->
# The world shapes the fight: decision

Combat engineer, 2026-10-17. For the director, the systems engineer and the author. Author direction,
same day (verbatim): "the world should have some element of combat impact, such as limiting kiting,
etc." Reference for combat feel and world constraints: No Rest for the Wicked alone, through
cleanroom/spec/WORLD-COMBAT-CONSTRAINTS.md (coordinator's ruling, 2026-10-17). Clean room: specs
only. Every name and number below is ours; reference values were scaled to our quays, plates and
speeds. Code: game/engine/combat (data/world.mjs holds every value). Progress and resume steps:
game/engine/combat/PROGRESS-WORLD.md.

## What I wanted

Retreat-and-poke should lose time or Standing against fair, readable play, in every Act 1 and Act 2
fight, and no style should lose its way through any fight. The world should do the work: the quay edge,
the stairs, the light, the people in it, and not an invisible leash.

## How it was tested

- **Fair play**: the scripted pilot playing like the build (tools/pilot.mjs, unchanged in intent).
- **Kiting**: a retreat-and-poke policy added to the pilot (`style: "kite"`). It keeps a ring outside
  the nearest opponent's reach, runs from anyone who closes, rolls away from swings, steps throws, and
  strikes once only into a whiff (and, as an option, into an approach), then backs off. It never trades,
  catches or blocks, and it avoids exits (leaving is its own outcome).
- **The strongest kiter, not a strawman**: 12 variants (ring 2.6, 3.4 or 4.5 m; 25 or 50 frames between
  pokes; meeting the approach or not), best per style kept (tools/kite.mjs --search).
- **Five styles** (SYSTEMS-FULL 19.10) at a mid-game sheet: the style's compartments at 7, its four
  voices at 7, its own tool at temper 2 (tools/kite.mjs STYLES).
- **Ground**: every Act 1 and Act 2 encounter except brawls and sneak openings (19 encounters) on its
  painted plate, the ground the shell fights on.
- **Ablation**: each rule switched off in turn (COMBAT_WORLD_OFF, measurement only), tools/ablate.mjs.
- Outputs are kept in game/engine/combat/world-runs/. A scripted pilot is not a person; these numbers
  rank rules against each other and do not prove how a fight feels.

## What the baseline showed

Before any world rule, kiting already lost in most fights, because of the pressure system from the
earlier tuning (ai/pressure.mjs: a Lamb who does not fight back draws more attackers and shorter
cooldowns). The holes were specific:

1. **The time cap paid kiting.** At 120 s a fight broke off as their yield whenever Lamb had hurt them
   more than they had hurt Lamb. One poke and two minutes of running was a win: 7 of the strongest
   Fist kiter's 28 wins out of 38, 19 of 102 kiting wins across the styles.
2. **The long hook made kiting nearly free.** The Hands boathook poking from 2.6 m won 35 of 38, as many
   as fair play, at 23 s against 14 s.
3. **The ground did nothing.** Quay walls, the floor's drops and the mole's steps were walkable in any
   direction; a body could step off a 3 m quay unharmed or walk up it.

## The rules, and why each was kept

| Rule | What it does | Source | Kept because |
|---|---|---|---|
| Ledges and falls | A height step of 1 m or more between plate cells is a ledge. A walk stops at it; a knockback or a roll carries over it and the body falls. Into water: under, Breath -2. Onto ground: down from 1 m, hurt past 1.6 m (0.7 Standing a metre), opponents take 1.5 times as much | spec 7 (falls hurt from 7.5 m, kill at 10 m; foes die from shorter falls), scaled to a 2.5 to 3.4 m quay | Kiting near an edge is a gamble for both sides; a shove off the quay is real. Without it the ground is a picture |
| Slope and hazards | Speed falls with grade above 0.2; no running above 0.45. Nets and ropes slow (0.7 and 0.75) and trip a body that runs or rolls across them; slick lowers grip; loose ground shortens a roll | spec 7 (hazards tick over 2 to 3 m) | Running away over rigging costs a fall; walking over it costs time only |
| Running costs Breath only while engaged | 1.6 Breath a second while an aware opponent is within 10 m; free otherwise | spec 6 (running costs only in combat, about 5 s of running on a starting bar) | A mid-game Lamb gets 5 to 7 s of running in a fight, which is about when the kiting clock answers |
| The kiting clock | Each opponent counts how long Lamb has been out of everyone's reach and opening the gap on it (or far out of its reach). Being in reach drains it twice as fast. A guarded retreat does not count | spec 4 (a "time kited" count, 3 to 5 s) | It separates spacing from running: fair play never fills it (punish counts below) |
| The answers | At 3.5 s on the clock, or 1 s of Lamb being unreachable: a lunge if Lamb is 4 to 8.5 m off (closes about 4 m, armoured against a poke, quick to recover), else a slow thrown stone (48-frame wind-up, catchable, blockable, steppable; 6 to 10 s cooldown). These do not wait for an attack token | spec 4 and 5 (a slow-telegraphed ranged punish with a 6 to 10 s cooldown; gap-closers from 5 m) | Readable answers that a player who stands in the fight never sees |
| Pursuit | While Lamb runs from it, an opponent runs too (paying Breath), up to 4 s, keeping 2 Breath back, then rests 5 s. A chase arrives with a blow | spec 3 (bursts of about 5 s, cooldown about 5 s) | Without the arriving blow, a chaser walked into the kiter's poke and pursuit helped the kiter (see the ablation) |
| Cutting off | An opponent without the token goes for the ground 3 m ahead of a running Lamb | ours | A pack closes lines instead of queueing behind one another |
| Sight leash with no reset | No home leash and no healing. After 7 s without sight an opponent calls the others to Lamb's last seen spot and holds the way out nearest it | spec 2 (no spawn leash; give up after 7 s without sight) | Fog, the dark and alleys stay an honest way out, but the exit is watched |
| The beam | Mother's beam sweeps at the shell's own BEAM_RATE while she burns; a body in an arm is lit, and within 12 m it is seen whatever the fog (both ways: Lamb sees opponents in it too) | ours, the shell's rate | Measured below: lit only, it changed no outcome; with the fog rule it ends hiding in foggy fights under her light |
| Reads need light | A weak point (the PEN pillar) needs the attacker in Lamb's sight | ours | Darkness changes reads for Lamb as it already did for them |
| Break-off that does not pay kiting | At the time cap, their yield needs Lamb to have stood in the fight: opening the gap under 15% of it and out of everyone's reach under 60% | ours, set from measurement | Fair play measured at most 0.10 and 0.53 across 57 fights (tools/kiteshare.mjs); the kiter up to 0.49 and 1.0 |
| Walking round the ground | A flow field over the plate's cells (walls, ledges, waist-deep water) for brains and, when a ledge blocks or it is stuck, the pilot | needed by the ledge rule | Without it a ledge strands a body at the lip and fights stall to the cap |

Considered and not built: slowing Breath regeneration while retreating (running already stops regen
for its own duration, and the clock answers before regen matters); a cap on attackers beyond the
existing tokens (below).

## Attack tokens: our own decision

The spec found no limit on simultaneous attackers in the reference. We keep ours (one at first, a second
after 20 s, one more against a passive Lamb; ai/pressure.mjs). Reason: our fights are short and
read on a painted plate at a fixed camera, so a pile-on is hard to read; the tokens are what make fair
play readable. The kiting answers bypass tokens on purpose, because they exist only for a Lamb who has
left the fight.

## Results

Kiting against fair play, after the rules. Fights won (win or yield), mean seconds per fight, mean
share of Standing lost. Act 1 and Act 2 plates, 19 encounters.

**The default kiter**, 3 seeds, 57 fights per style and policy (world-runs/kite-before.txt,
kite-after.txt):

| Style | Fair before | Fair after | Kite before | Kite after |
|---|---|---|---|---|
| Fist | 57 won, 11.7 s, 0.25 lost | 55, 12.7 s, 0.26 | 22 won (11 at the time cap), 83.6 s, 0.36 | 13 (3 at the cap), 74.9 s, 0.47 |
| Tongue | 48, 13.0 s, 0.34 | 42, 13.9 s, 0.48 | 2, 55.0 s, 0.79 | 2, 58.2 s, 0.76 |
| Shadow | 52, 13.2 s, 0.37 | 51, 14.5 s, 0.42 | 6, 73.5 s, 0.74 | 5, 69.1 s, 0.65 |
| Hands | 50, 13.8 s, 0.36 | 52, 11.3 s, 0.30 | 12, 67.3 s, 0.64 | 14, 61.9 s, 0.65 |
| Eye | 53, 12.4 s, 0.35 | 51, 13.5 s, 0.40 | 6, 60.5 s, 0.79 | 3, 57.6 s, 0.76 |

**The strongest kiter per style**, 2 seeds, 38 fights each (world-runs/kite-search-before.txt,
kite-search-after.txt):

| Style | Fair after | Strongest kiter before | Strongest kiter after |
|---|---|---|---|
| Fist | 36, 13.1 s, 0.27 | 28 (7 at the cap), 69.1 s, 0.40 | 22 (5 at the cap), 69.2 s, 0.31 |
| Tongue | 27, 13.5 s, 0.48 | 10, 44.1 s, 0.56 | 8, 49.4 s, 0.68 |
| Shadow | 34, 14.9 s, 0.41 | 12, 66.5 s, 0.71 | 8, 75.7 s, 0.65 |
| Hands | 35, 11.0 s, 0.28 | 35, 23.1 s, 0.40 | 36, 23.9 s, 0.40 |
| Eye | 33, 13.9 s, 0.45 | 11, 44.3 s, 0.79 | 7, 59.5 s, 0.68 |

Every kiter loses time: 2 to 6 times as long as fair play. Every kiter but Hands also loses fights.
The Hands kiter (ring 2.6 m with the boathook, meeting the approach) wins as often as fair play but takes
2.2 times as long and loses 0.12 more Standing a fight; at 2.6 m it stands inside most opponents' reach,
so the world rules barely see it (11 throws in 38 fights). It is closer to spacing than to kiting, and I
leave it alone.

**Where the answers land** (world-runs/punishes.txt, 38 fights per row): fair play draws 3 to 12 throws,
no lunges and 3 or 4 chase blows per style across all 38 fights, costing 0.5 to 2.2 Standing in total.
The kiters (Fist, Tongue, Shadow, Eye) draw 96 to 167 throws, 21 to 162 lunges and 44 to 206 chase
blows, costing 17 to 50 Standing.

**Ablation**, the strongest kiter per style, all five styles summed, 2 seeds, 190 fights
(world-runs/ablation.txt):

| Switched off | Fair won | Kite won | Kite at the cap | Kite seconds | Kite Standing lost |
|---|---|---|---|---|---|
| nothing | 165 | 76 | 0 | 54.9 | 0.56 |
| every rule | 176 | 102 | 19 | 62.5 | 0.48 |
| break-off rule | 165 | 91 | 15 | 54.9 | 0.56 |
| ledges | 167 | 86 | 3 | 51.0 | 0.59 |
| engaged running | 165 | 85 | 1 | 51.1 | 0.58 |
| sight leash | 165 | 82 | 0 | 47.1 | 0.59 |
| walking round the ground | 172 | 77 | 0 | 51.6 | 0.62 |
| clock, answers, pursuit, cut-offs | 169 | 73 | 0 | 61.1 | 0.57 |
| beam | 165 | 76 | 0 | 54.9 | 0.56 |

Reading it: the break-off rule and the ledges do the most against kiting wins; engaged running and the
leash add to it. The clock and its answers do not lower kiting wins at this sample (73 off, 76 on). Per
style at 3 seeds they raise the Standing a kiter loses (Tongue 0.63 to 0.72, Shadow 0.65 to 0.69, Eye
0.68 to 0.71) and end kiting fights 7 to 12 s sooner, with Tongue's kiter down 32 times against 27. I
keep them for that, and because a crowd that never answers a runner reads as broken; it is the weakest
rule by this measure. Walking round the ground makes opponents better at reaching Lamb, which costs fair
play the most (172 to 165): that is the honest price of opponents who no longer stall at walls.

**Min-max** (tools/minmax.mjs, placeholder arenas, Acts 1 to 3, 2 seeds, 56 fights per build;
world-runs/minmax-before.txt, minmax-after.txt):

| Build | Before | After |
|---|---|---|
| Focused (COAT 10 Fist) | 55 won, 11.9 s per win, 81% Standing left | 55, 12.1 s, 81% |
| Spread | 55, 15.4 s, 69% | 51, 13.7 s, 73% |
| Early | 19 | 16 |

At 5 seeds (140 fights) spread wins 127 with every rule on, 132 with every rule off; the clock and its
answers account for the difference. The focused build still finishes faster with more Standing left;
the tempo table and breakpoints are untouched (tests/tempo.test.mjs, tests/build.test.mjs pass).

**No style loses its way through any fight.** e.strippers (Act 2, four strippers, the tide ending it)
has no fair win for Tongue, Shadow or Eye at 6 seeds, before and after the rules alike. Its talk exit
("Read them the claim") ends it for every style when taken as soon as it is offered: 5 of 6 fights end
in talk for Fist, Shadow, Hands and Eye, 3 of 6 for Tongue; the rest go down. Every other encounter has at least one fair win per style at 6 seeds
(Tongue on quay2.wardens: 1 of 6).


## Under a burning Mother

The quay and floor plates carry her lens. quay2.wardens is the Act 2 fight on the quay; I added the
Act 1 quay and floor fights for numbers (e.wardens, e.lamplighters, e.salvors, e.eels): 5 fights, 5
styles, 4 seeds, 100 fights per row (tools/beam.mjs; world-runs/beam.txt, beam-reveal.txt).

- **Lit only** (the first version): Lamb stood in an arm 2 to 7% of the fight, and nothing changed. Fair
  91 of 100 dark and burning, kiting 30 and 30, the same seconds and Standing. Under sodium the quay is
  already lit, and in fog the sight rule divides any light by the fog, so a beam could not cut through it.
- **With the fog rule** (a body in an arm is seen within 12 m, fog or not): clear air is unchanged (fair
  91, kite 31). In fog 0.35, a kiter who hid in the fog was nearly untouchable with Mother dark (12 wins,
  107 s, 0.05 Standing lost: it waits out the cap and gets clear); with her burning it is found and
  fought (27 wins, 98 s, 0.20 lost). Fair play pays too: 98 against 99 won, 13.8 s against 9.2 s, 0.26
  against 0.18 lost, because opponents see Lamb coming. The light cuts both ways, which is the point.
- Fog makes fair play easier in these fights (99 of 100 against 91 in clear air): opponents lose Lamb at
  1.6 m. That predates this work and is worth a look by whoever owns the sight rule.

## What this does not prove

- A scripted kiter with perfect reactions is not a person. It dodges thrown stones it can see coming
  in the move data, so a person kiting would likely do worse than these numbers.
- Two to three seeds per encounter. Differences of 5 wins in 190 are inside the run-to-run spread
  (four tuning variants of the clock and the answers all landed within 76 to 85 kiting wins).
- No plate carries authored hazards yet (place.json "terrain" is agreed and empty), so nets and ropes
  are tested on a synthetic arena only.
