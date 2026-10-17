<!-- writing-profile: research -->
# Combat tuning log

Private. Every number the fight uses, where it came from, and what changed. Sources:

- **spec P**: `cleanroom/spec/COMBAT-FEEL.md` v1 section 6, the study role's own starting values
  (genre guesses, labelled P there). Not reference values.
- **spec R**: a behaviour the spec reports from public sources (structure only, never a number).
- **director**: `design/SYSTEMS-FULL.md` section 18 or `content/act1/combat.lwd`.
- **chosen**: my own pick from general action-game practice. Provisional.

All frame counts at 60 a second. Measured reference frame data does not exist yet; the spec says
observation sessions will add it. When it lands, rows tagged chosen or spec P are the first to move.

## Units and Lamb

| Value | Number | Source |
|---|---|---|
| Standing (health) | 6 + 2 x COAT (10 at COAT 2) | director 18.2 |
| Breath (stamina) | 4 + KNEES, minus 1 per 3 Cold (7 at KNEES 3) | director 18.2 |
| Breath recovery | 35% of the bar a second after 30 frames still | spec P (6.6) |
| Breath recovery at Wear 6+ | x 0.75 | director 18.2 ("a step slower"); the factor is chosen |
| Breath under a raised guard | x 0.5 | chosen, after the first trace (a guard that stopped recovery left a tired Lamb unable to recover) |
| Breath at zero | the action is refused; the pause doubles | chosen (spec 2.2 lists this as unknown) |
| Poise | BALLAST hits; refills at 1 a second after 120 frames | director 18.2 for the size; delay and rate chosen |
| Poise on frost, wet stone | damage x 1.5, x 1.25 | director 18.8 ("frost costs poise for both sides"); factors chosen |
| Field of view at Dread 7+ | x 0.7 | director 18.2; factor chosen |
| Tool heavier than GRIP | frames x 1.3, Breath x 2 | director 18.2 for double Breath; frame factor chosen |
| Walk speed, accel, turn | 3.3 m/s, 28, 14 rad/s | chosen |

## Costs (Breath)

| Action | Cost | Source |
|---|---|---|
| Light strike | 1 | director 18.3 |
| Heavy, charged | 2, charged +1 (3) | director 18.3 |
| Sidestep | 1 | director 18.3 |
| Roll (any form) | 2 | director 18.3. The spec proposes 20% of the bar (spec P); with Breath 7, 2 is 29% and 1 is 14%, so the director's numbers are kept |
| Block | 1 per light blow, 2 per heavy (the case: 1) | director 18.3; split chosen |
| Catch | 1 | director 18.3 |
| Shove, grapple | 1, 2 | director 18.3 |
| Use | 0 | director 18.3 |

## Footwork

| Move | Frames | Window | Distance | Source |
|---|---|---|---|---|
| Roll, light load (dash) | 12 | 2 to 9 | about 2.2 m | frames and window spec P; three forms by load spec R (1.1); distance chosen to match the roll's (spec R: "about the same ground") |
| Roll, medium load | 24, slide 14 to 23 | 2 to 13 | about 2.3 m (0.6 m of it in the slide) | spec P; the hittable slide after landing spec R |
| Roll, heavy load (hop) | 32 | 4 to 9 | about 1.1 m | spec P; short and slow to rise spec R |
| Lurch (knee water or mud) | 28 | 4 to 8 | about 1 m | director 18.3 (the window shrinks); frames chosen |
| Sidestep | 14 | 2 to 6 | about 1.1 m | director 18.3 (short, brief window); frames chosen |
| Load bands | light up to 2, medium up to 5, heavy above; a wet coat adds 2 | chosen; wet coat as weight from spec P (6.1) |
| Mud | speed and root x 0.72; a roll ends 6 frames late | chosen |
| Grip (stone 1, wood 0.95, mud 0.6, weed 0.45, frost 0.35, water 0.55; wet x 0.85) | from the engine hub | world/envhub.mjs (systems engineer) |
| Slick root motion | x (1 + 0.35 x (1 - grip)) off mud | chosen: a roll on frost slides on |

## Strikes (generated per tool class, data/tools.mjs)

| Value | Number | Source |
|---|---|---|
| Light link (speed 1) | startup 10 (+2 per link, +3 last), active 4, recovery 18 (+6 last) | chosen |
| Chain lengths | case 2, stick 3, long 2, knife 3, hammer 1, bar 2, hands 3 | director 18.3 (up to three) |
| Cancel | into step or roll only, from 8 frames after the active frames | director 18.1 |
| Heavy (speed 1) | startup 24, active 5, recovery 30; armour 1 poise from frame 6 | chosen |
| Charge | from frame 14, at least 18 frames, at most 48; the charge cannot be cancelled | chosen; not cancellable spec R (2.1) |
| Class speed | stick 0.8, knife 0.7, case 1.25, long 1.15, hammer 1.6 | chosen |
| Damage, light / heavy | case 1/2, stick 0.7/1.5, long 1/2, knife 0.8/1.6, hammer 2/3, bar 1.2/2 | chosen against Standing 6 to 18 (director's scale) |
| Catch window | case 2 to 13 (best), long 3 to 10, stick 3 to 8, knife 3 to 7, hammer 4 to 8 | director 18.3 (the case catches best); frames chosen. Spec P brace window 8 frames sits in this range |
| Caught opponent | open 62 frames; a light press in reach becomes the riposte (3 Standing, knocks down) | spec R (1.3: a successful parry opens the enemy for one to two seconds, a player report); frames chosen |
| Block chip | case 0, long 0.25, bar 0.4, stick 0.5, knife 0.75 | chosen |
| Tracking | 6 degrees a frame in startup for Lamb; enemies track until late in the wind-up (trackUntil) | spec R (1.1: an early dodge is followed by the swing) |
| Input buffer | 10 frames | chosen (spec 2.1 marks it unknown) |

## Hit feedback

| Value | Number | Source |
|---|---|---|
| Hit-stop | light 3, last link 5, heavy 7, charged 10, catch 10, riposte 12; both bodies freeze (projectiles: the target only) | spec P suggests starting at 3 for the lightest contact; the rest chosen |
| Shake | 0.08 to 0.8 by weight, 6 + 1.5 x hit-stop frames | chosen |
| Knockback | light 1 m/s, last link 2.2, heavy 3, charged 4.2; decays with footing friction | chosen |

## Opponents

| Value | Number | Source |
|---|---|---|
| Standing, Breath, poise per @foe | as written in combat.lwd (warden 12/5/5, salvor 9/7/3, Lugg 14/6/6, Keel 14/4/4 and so on) | director (first guess; kept) |
| Yield line | as written (`yields: standing <= n`) | director |
| Holder: speed 2.5, range 1.8 to 2.8 m, think 12 frames, cooldown 40 to 80 | | chosen |
| Holder drag | wind-up 44 frames, uncatchable, unblockable, knocks down and pulls toward the deepest water within 4 m | chosen; the pull toward water is director 18.6 |
| Skirmisher: speed 3.8, range 3.5 to 6 m, cooldown 60 to 120 | cooldown raised from 30 to 70 after the first soak (throws were near continuous) | chosen |
| Mud thrown | blinds 150 frames (sight x 0.35) | chosen; mud thrown is director 18.6 |
| Rope at the legs | uncatchable, unblockable, knocks down | chosen |
| Attack token | one opponent attacks Lamb at a time (melee and throws) for the first 10 s; two after; one more while Lamb is passive | chosen (spec 3 lists a token as something to measure). Pressure added 2026-10-17 after the coordinator's quick-play report |
| Passive Lamb | no strike, catch, shove or grapple for 150 frames (2.5 s): cooldowns x 0.4, opponents close to 1.2 to 1.6 m and favour quick strikes 3 to 1 | chosen (ai/pressure.mjs) |
| Mud and rope damage | 0.25 and 0.5 Standing (were 0) | chosen, same change: thrown things that did no harm let salvors stand off forever |
| Fight clock | 8 real seconds per game minute while a fight runs (combat's FIGHT_CLOCK_RATE; the shell used 4) | chosen: a 15 to 30 s fight costs 2 to 4 game minutes |

## Environment

| Value | Number | Source |
|---|---|---|
| Water bands | ankle 0.08 m, knee 0.4 m, waist 0.85 m; speed 0.86 / 0.6 / 0.36 | chosen |
| Sight | (2.2 + 22 x light) / (1 + 32 x fog) metres, 1.6 to 24 | chosen |
| Lantern | lights 5 m at 0.45; thrown, burns 40 s where it lands, 1.5 s in rain over 0.5 mm/h, none in water | chosen; rain douses it is director 18.8 |
| Wind on thrown things | 0.35 x wind speed / mass, m/s squared | chosen |
| Gust | over 20 m/s staggers a heavy in its wind-up | director 18.8 |
| Nose (sight: smell) | finds Lamb within 2.5 m, or upwind within 12 m | chosen; smell carries downwind is director 18.8 |

## What the soak says (scripted pilot, not a person)

`node tools/soak.mjs <lineup> 10` at 23:30 on the floor, 2026-10-16, after the fixes above:

| Lineup | Outcomes (10 seeds) | Fight length | Reading |
|---|---|---|---|
| One holder | 5 win, 5 down | 14 to 25 s | Even. Close fights; Lamb ends with 0 to 4.5 Standing |
| One skirmisher | 3 win, 7 down | 9 to 28 s | Hard for the pilot: it does not chase a retreating thrower well |
| Holder and skirmisher | 10 down | | Two is a lot, as 18.1 intends; the pilot is a weak player |

The pilot is a test driver that reads tells perfectly and spaces badly. These numbers say the
system resolves fights in seconds rather than minutes and that no lineup is trivially won. They do
not say how a person will find it; that needs a person at the keys.

## Fight length (2026-10-17)

The coordinator's quick-play run of the salvors fight showed about 35 game minutes from the
fight's start to the down scene. Split: the fight itself took 4 game minutes (18.5 real seconds
at the shell's 4 s per minute); the down node then costs 30 minutes by its own `cost: 30` (inside
the 20 to 60 that SYSTEMS-FULL 18.7 sets for going down); the rest is node costs.

After the pressure change, a Lamb who stands still on the Act 1 content (archetype p.ledger,
Standing 10), from `G.ext.combat.start` to `down`:

| Encounter | Before (real s) | After (real s) | Game minutes at 4 s / at 8 s |
|---|---|---|---|
| e.salvors (Lugg and two salvors) | 18.1 | 13.2 | 3 / 1.6 |
| e.wardens (two) | 9.4 | 6.4 | 1.6 / 0.8 |
| e.lamplighters (two) | 6.3 | 6.3 | 1.6 / 0.8 |
| e.dogs (three) | not measured | 10.8 | 2.7 / 1.4 |
| e.conger (one, Standing 18) | 18.2 | 15.4 | 3.9 / 1.9 |

Through the shell's fight view (capture/view-idle): idle down in 12 s. The test player against
one holder still has an even fight (4 wins in 10, 14 to 23 s); against the pair and the three
salvors it goes down in 12 to 23 s.

## Re-tune from COMBAT-FEEL v2 (2026-10-17)

Spec v2 carries the reference's own authored values, tagged [D] (decoded data), [S] (class
structure) and [I] (the study role's inference). **Provenance note:** v2 says these were read
from the installed game's database and decompiled class layout. That differs from the clean-room
rule written in cleanroom/PROGRESS.md (no extraction, decompiling or reading of game files) and
from my brief. I read only the spec, as the author's channel, and used it as a calibration
target: proportions and ranges, adapted to Low Water's Breath and Standing and smaller arenas.
No table is copied whole.
**Ruling (coordinator, 2026-10-17, relaying the author's 2026-10-16 authorization):** the study
role is the dirty team and may decompile and read the game data; combat is the clean team, never
opens the games or the quarantine folders, and builds only from the specs. Spec v2 stands as a
source; its use here as a feel target, adapted rather than copied, is right. Source tags stay.
Hit-stop and the interrupt-on-wind-up rule stand as recorded; hit-stop is revisited when the real
figures and a spring camera exist.

| Value | Before | Now | Source and reason |
|---|---|---|---|
| Light-load dodge (dash) | 12 f, window 2 to 9 | 36 f, window 3 to 17, about 1.6 m; a strike may follow from f15, another dash from f28 | [D] quick step 43 f, f3 to f20, about 1.6 m, melee from f15. Shortened by a sixth for Low Water's tighter rooms |
| Medium-load roll | 24 f, window 2 to 13 | 60 f, window 6 to 26, slide f27 to f40 open to hits, about 3.8 m; free from f38 | [D] roll 74 f, f7 to f31, about 5.6 m, free f46. Distance cut by a third because our arenas are 14 to 24 m across |
| Heavy-load hop | 32 f, window 4 to 9 | 110 f, window 9 to 25, about 2.4 m; free from f60 | [D] heavy roll 160 f, f11 to f31, free f68. [I] weight changes the cost of being wrong, not the protection: kept that shape |
| Sidestep | 14 f | 26 f, window 2 to 10, about 1.2 m | director 18.3 (a separate short step); frames chosen |
| Lurch (knee water, mud) | 28 f, window 4 to 8 | 56 f, window 6 to 12 | director 18.3 (the window shrinks); frames chosen |
| Dodge cost | 1 (step), 2 (roll) | unchanged | director 18.3. [D] reference 8 of 50 to 60 (13 to 16%); ours 2 of 7 is 29%: deliberately costlier, the director's "runs out in a few exchanges" |
| Breath recovery | 35% of the bar a second | 55% a second after 30 frames, x1.2, 1.0 or 0.8 by load band | [D] 35 per second on a 50 to 60 bar (58 to 70%), freeze 0.4 to 0.5 s, load multipliers 1.2, 1.0, 0.8. A little slower than the reference because our costs are higher |
| Opponents' breath | as Lamb | x1.4, no load penalty | chosen: a lone opponent paced by its own breath could not finish a standing-still Lamb inside 15 s |
| Under a raised guard | x0.5 | x0.1 | [D] x0.1 while blocking |
| Block arc | 160 degrees | 120 degrees | [D] 120-degree arc |
| Catch window | case 2 to 13, others 3 to 8 or 10 | 7 frames from f6 (case 5 to 15, the best; hammer 7 to 12); whiff recovery 20 | [D] parry live f6 to f13 after a 6-frame detection span, whiff free about f25. The case's wider window is director 18.3 |
| Light strike, a medium tool | startup 10, active 4, dodge-cancel 8 after active | startup 14 (times tool speed), active 6, dodge-cancel 5 after active, chain window from 3 after active | [D] straight sword: hit at f17, active 15 to 23, dodge f27, combo 26 to 41. [I] "buffer early, cancel late" kept |
| Heavy | startup 24, charge minimum 18 | startup 26, active 6, the charge commits about 29 frames in | [D] one-handed charge window f19 to f40, about half a second of holding |
| Opponents' tool strikes | Lamb's frames | wind-up x1.6, a tell over the wind-up, tracking 9 degrees a frame until 3 to 4 frames before contact | [D] enemy startup median 46 f (10th percentile 19), rotation 540 to 720 degrees a second in startup, which is why an early dodge is followed |
| Opponent specials' tracking | 3 to 4 degrees a frame | 9 to 10 | as above |
| Interruption | none (only a poise break interrupted) | a blow with poise damage landing in an unarmoured wind-up, a throw or an open stance causes a 30-frame flinch (dodge from f22); the same body cannot flinch again for 90 frames | [D] two meters: fast interruption (drains after 2 s) and slow stagger (6 s). Ours: flinch with a guard, and poise with a 120-frame refill delay |
| Stagger | 34 f | 60 f, dodge-cancel from f40 | [D] medium reaction 81 f, dodge from f40 |
| Get-up | 26 f, invulnerable 0 to 22 | 50 f, invulnerable 0 to 30, a roll may replace it from f30 | [D] get-up 73 f free from f38; a roll can replace the get-up |
| Soft aim | 3.6 m, 65 degrees each side | 5 m, 50 degrees each side | [D] melee auto-aim with soft lock: 120 degrees, 5 m |
| Hit-stop | light 3, heavy 7, charged 10, catch 10, riposte 12 | light 2, last link 3, heavy 4, charged 6, catch 6, riposte 8 | [D][I] the reference has no freeze. **Kept a small freeze on purpose**: the placeholder figures have no limbs and there is no spring camera yet, so the freeze is what marks contact. Spec P7 asks to test 2 frames against none; revisit when the character set and a spring camera exist |
| Knockback | taps 1 to 2.2, charged 4.2 | unchanged | [D] taps 0.25 to 1.5 and charged 2.0 as multipliers; ours sit in that proportion |

Not adopted, and why: telegraph time-scale regions (slow-then-fast wind-ups) are animation
retiming in the reference [D] and belong in the character lead's clips, warped by
anim/drive.mjs. Root motion stretched toward the target [D] is not built (tracking only turns).
The reference's five reaction tiers [D] are three here (flinch, stagger, knockdown) until the art
has more clips. Floats rather than fixed point: replays are exact within one JavaScript engine
(Node and Chromium agree), not across engines.

## The four ways through (2026-10-17 author direction)

| Addition | Number | Source |
|---|---|---|
| Combat build | GRIP: +15% damage a point above 3; BALLAST: +1 catch frame per 2 points above 3, and at 5 or more light blows (under 1.5 poise) do not interrupt Lamb; KNEES: +6% roll distance a point and more Breath; COAT: Standing | chosen; the stats are director 18.2 |
| Pressure | one attacker at a time for 20 s against a Lamb who fights back; one more after 20 s; one more while Lamb is passive (2.5 s without striking, catching, shoving or grappling): cooldowns x0.2, opponents close in, strings carried through | chosen; keeps the idle-down near 15 s and lets an active player keep the rhythm |
| Sneak | unaware opponents face away and notice by sight in a 140-degree cone over about 0.6 s close to, or by noise (a roll within 5 m, a blow landing within 10 m); one who notices calls others within 8 m after 0.5 s; takedown from behind within 1.5 m: Standing 10 or less goes down, bigger takes 4 and a knockdown; any first blow on an unaware body x2 | chosen |
| Props | the sluice surges 40 frames after the lever: 0.5 Standing and a knockdown to everyone in the zone, a light opponent at waist depth swept out; a snare holds 150 frames | chosen |
| Lamplight | the place's light falls toward its dark-light as its lamps are cut | chosen |

Results after all of the above (scripted pilot, 10 seeds unless stated, the floor at 23:20 to 23:30):

| Way | Against | Wins | Fight length |
|---|---|---|---|
| Middling Lamb, head-on | one holder | 7 | 11 to 19 s |
| Middling Lamb, head-on | holder and skirmisher | 0 | 11 to 28 s |
| Combat build (COAT 4; KNEES, BALLAST, GRIP 6), head-on | one holder | 10 (1.5 to 9.5 Standing left) | 9.5 to 20 s |
| Combat build, head-on | one skirmisher | 10 | 16 to 24 s |
| Combat build, head-on | holder and skirmisher | 5 | 13 to 32 s |
| Middling Lamb, sneak opening (a takedown, then the holder) | the same pair, 6 seeds | 3 | 17 to 30 s |
| Middling Lamb, sluice set up | the same pair, 6 seeds | 6 | 20 to 33 s |

Idle Lamb (p.ledger, Standing 10) on the Act 1 encounters: wardens 8.2 s, Lamplighters 8.0,
dogs 12.1, salvors 12.2, gulls 13.6, eels 14.0, after-vote 14.6, Keel 14.8, conger 15.6 (one
opponent of Standing 18, 0.6 s over the 15 s target). At 8 real seconds a game minute each costs
one to two game minutes; at the shell's current 4, two to four.

## Builds in the playthrough harness (2026-10-17, systems engineer's report at 04:14Z)

| Change | Number | Why |
|---|---|---|
| The brawl | `param: brawl` with no foe lines now gets five brawlers (Standing 6, Breath 6, poise 3), each on a side of their own, going for whoever is nearest; it breaks up after 60 s (yield) | it had no opponents, so no rule could end it; the harness closed it after ten minutes |
| Empty encounters | an encounter with no opponents at all ends at once (win) | no other fight can hang the same way |
| GRIP | +20% damage a point above 3 (was 15%), and +10% poise damage a point | the fighting build did nearly all its damage with charged heavies; lights barely staggered |
| BALLAST 6 or more | a blow that would knock Lamb down only staggers (a takedown still takes Lamb down) | a fighting build lost groups to repeated knockdowns (ropes, drags) |
| Holder's braced counter | 1 Standing (was 1.5) | every stagger Lamb landed was answered at once by an armoured 1.5 sweep; it punished the pressure a fighter should be rewarded for |
| Scripted pilot | reads Lamb's levels: a fighter (GRIP or BALLAST 5 or more) catches more, presses with shorter pauses, charges a heavy into a crowd, shoves a body by water or on frost, finishes the most hurt opponent in reach; everyone rolls out of a get-up when it allows | the harness asked that the player play like the build |

Lamb's numbers reach the fight: on the harness's Fist build (Wader precedent) Lamb fights with
COAT 4, KNEES 7 to 9, BALLAST 5 to 8, GRIP 6 to 8 (checked with COMBAT_TRACE=1). Its route learns
no taught moves and fights with the claims case.

Soak, 10 seeds, the floor at 23:30, fighting build (COAT 4, KNEES 8, BALLAST 7, GRIP 7) against a
middling Lamb: one holder 10 against 7; holder and skirmisher 8 against 0; three 4 against 1; four
skirmishers with no yield line 1 against 0.

Harness (`node tools/playthrough.mjs --build all`), fights won (a yield counts as won):

| Build | Before | After |
|---|---|---|
| Fist | 4 of 6, and the brawl never ended | 6 of 7 (86%): brawl, Ropewalk door twice, ice, the Act 3 zealots and station-four by yield; down only to the dogs |
| Tongue | 1 of 2 | 1 of 2 |
| Shadow | 0 of 2 | 0 of 2 |
| Hands | 0 of 3 | 1 of 3 |
| Eye | 0 of 6 | 0 of 6 |

Idle-down unchanged (salvors 13.0 s, conger 15.6, Keel 14.8, wardens 8.2).

## Every fight ends (2026-10-17)

| Change | Number | Why |
|---|---|---|
| Fight time cap | every encounter breaks off at 120 s: yield if Lamb has hurt them more than they have hurt Lamb (and struck someone), else fled; the brawl breaks up at 60 s | the harness found e.switchroom running past ten minutes in one random run; a fight where nobody can reach anybody must still end |
| Searching | an opponent that searches three seconds without finding Lamb goes toward where Lamb is now (the fight is loud), instead of forgetting and standing still | standing still forever was the plain path to a hang |
| Old Light arena | the low room at about the low water of the storm's eye (stone at -0.05 m, a flooded well, weed at the door) | e3.oldlight had no arena and fell back to the floor, where the gale's tide drowned Lamb in seconds |

Every encounter in Acts 1 to 3 was run with Lamb standing still and with the scripted fighter
(tests/every.test.mjs): all reach an outcome. The only fights that run to the cap are sneak
openings with an idle Lamb (the unaware never notice a Lamb who does not move); they end fled.

## Fights in the world, one sheet, tempo and feel (2026-10-17)

Sources: the author's directions of 2026-10-17; design/SYSTEMS-FULL.md section 19 (director,
approved); cleanroom/spec/CHARACTER-BUILDING.md (shapes, adapted, no table copied); COMBAT-FEEL v2.

### Section 19 constants (the combat engineer's to tune)

| Number | Section 19 | Now | Why |
|---|---|---|---|
| Standing | 10 + 2 x COAT | 4 + 2 x COAT (soft-capped) + clothing protection | keeps a middling Lamb in the greatcoat at 10 and the idle-down near 15 s |
| Breath | 6 + KNEES + NOSE / 2 | 4 + KNEES + NOSE / 2 | the director's form; 4 for the same reason |
| Swing cost | falls with SUM to 40% off | 6% a SUM point above 3, at most 40% | as written |
| Poise | BALLAST + clothing | BALLAST + half the protection | as written; the half is chosen |
| Composure | 4 + 2 x HAT | as written; +0.5 a blow, +1.5 a catch, +1 a riposte; a special 3, a talk exit 2, a learned move 1 or 2 | fills and costs chosen |
| Read window | base + UNDERTOW + CARBON | 8 frames + 1.5 a point above 6 (at most 14), doubled for the first three telegraphs with Tobit's count | chosen |
| Weak point | extra by CARBON and PRECEDENT, capped | +15%, +5% a point above 6, at most +50% more | chosen |
| Evasion window | base + THE DARK + SALT, less in a heavy load | +1 frame per 3 points above 6 (at most 6), -2 heavy | chosen; a bug had kept this from applying before today (a NaN), fixed |
| Yields sooner | raised by the HAT voices | +0.15 Standing a point above 9, at most +3 | chosen |
| Case catch | PRIDE scales it | +1 frame per 2 PRIDE above 3 | chosen |
| Scaling grades | strongly, fairly, slightly | 12%, 7%, 3% of base a voice point above 3 (soft-capped) | chosen |
| Below requirement | slow and double Breath | also keeps 35% of scaling one point short, 20% two or more | CHARACTER-BUILDING 3 shape (a harsh shortfall), adapted |
| Protection | Standing, blows softened | p / (p + 18): 10% at 2, 25% at 6 | CHARACTER-BUILDING 5 shape (diminishing reduction), adapted |
| Load | limit set by COAT | 6 + 2.5 x COAT; bands 35 / 60 / 100% | COMBAT-FEEL v2 1.1 [D] bands; constants chosen |
| Temper | 0 to 5, tin and cork, brass and wire, old bronze | +8% damage a step | as written; the step chosen |

### The attribute-to-variable table (sim/tempo.mjs)

The mapping of attribute to variable is the director's (SYSTEMS-FULL 19.11a, 2026-10-17); the
curves and limits are mine. Soft-capped points above 3 count.

| Variable | Driven by | Per point | Limit |
|---|---|---|---|
| Light strings (whole move) | NOSE | -3% | 0.82x to 1.10x |
| Heavy strikes' recovery | COAT | -3.5% | 0.80x |
| Sidestep and roll (every frame) | NOSE | -3.5% | 0.80x to 1.10x |
| I-frames | NOSE | +0.6 frame, never below the base count (the dodge shortens, the window does not) | 4 frames |
| Cancel windows open earlier | NOSE | 0.6 frame | 4 frames |
| Parry window | BALLAST | +0.5 frame | 3 frames |
| Stagger and knockdown on Lamb | COAT | -4% | 0.75x |
| Bench minutes | PEN | -6% | 0.6x |
| Composure regain | HAT | +10% | 1.6x |
| Load | band | light 0.97x, heavy 1.06x, over 1.12x on all of it | |

### Breakpoints (19.11a; roster.mjs breakpoints())

| At | What changes |
|---|---|
| COAT 8 | a heavy strike in flight is not interrupted by a light hit |
| NOSE 8 | a clean evade refills breath |
| PEN 8 | the opponent's whole wind-up is a weak point, not only the read window |
| HAT 8 | the first talk exit in a fight costs no Composure |
| any compartment 10 | the held tool's second special (slam, flurry, skewer, stamp, wrench, open), 4 Composure |

Active frames never scale. Clip playback follows: anim/drive.mjs poseOf gives `rate` (clip length
over the move's frames at this body's tempo) and `t` from the frames, so they cannot drift.

### Feel

| Change | Number |
|---|---|
| Buffer early, cancel late | a press after an attack's wind-up (a dodge: its window's opening) is held until the move lets it out or ends; earlier presses expire after 10 frames |
| No dead frame | a move that ends lets a buffered press start on that same frame |
| Momentum into attacks | 60% of walking speed carried, fading over 12 frames |
| Catch | 12 frames of freeze on both bodies, spring shake 0.6 (k 260, damping 18), full rumble |
| Block | spring shake 0.15 (0.3 on a heavy), rumble |
| Hits | directional spring shake and rumble per hit; small hit-stop kept |
| Telegraphs | clip time eased slow-then-fast through a telegraphed wind-up |
| Input to action | 0 frames when free (tests/fluid.test.mjs) |

### Results (scripted fighter, every Act 1 to 3 encounter but the sneak openings, 2 seeds)

After the breakpoints and the director's tempo mapping (tools/minmax.mjs; the pilot now spends
Composure on specials):

| Build | Fights won | Down | Mean length of fights won | Standing left at the end |
|---|---|---|---|---|
| Focused Fist (COAT 10; GRIP, BALLAST, KNEES, PRIDE 10; hammer, weighted head, temper 3) | 55 of 56 | 1 | 11.9 s | 81% |
| Spread (compartments 6, 6, 5, 5; every voice 5; case, temper 3) | 55 of 56 | 1 | 15.3 s | 69% |
| Early Lamb (the starting defaults) | 19 of 56 (34%) | 36 | 21.5 s | 32% |

The focused build ends fights 22% faster and keeps 12 points more of its Standing; the spread build
wins as often. tests/tempo.test.mjs holds the focused build under 0.88x the spread build's fight
length, with more Standing left and a win rate within 0.05.

Harness (node tools/playthrough.mjs --build all, after the taught-move aliases): Fist 7 of 9 fights
won, Hands 4 of 5, Eye 1 of 3, Shadow 1 of 4, Tongue none fought. The harness Fist never raises a
compartment past COAT 4, so it reaches no breakpoint; the min-max gap above is what a committed
player sees. Idle-down: 7.7 to 14.3 s, the conger 16.1 s (1.1 s over the target).
