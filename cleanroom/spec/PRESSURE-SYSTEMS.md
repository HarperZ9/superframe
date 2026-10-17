<!-- writing-profile: research -->
# Pressure systems: ZERO PARADES: For Dead Spies, Director's Cut (clean-room spec)

Version 2, 2026-10-17. Version 1 used public sources; section 12 adds the structure and tuning read from the installed build (tags [D] data, [S] structure). Where section 12 differs from earlier sections, section 12 wins. Tags: **[R]** reported (cited), **[I]** inferred,
**[M]** measured (none yet), **[U]** unknown, **[P]** proposal for Low Water. No skill, faction, item or
belief names appear in the builder-facing parts.

## 0. Verified identity

- ZA/UM's espionage RPG. Released on PC 2026-05-21 at USD 39.99 on Steam, Epic and GOG [R: RPG Site, 2026-05-08].
- The Director's Cut is a free PC update released 2026-10-01; PS5 version 2026-11-03 [R: RPG Site, announced 2026-09-17; second article on availability]. It adds about 40,000 words, one new tense set-piece scene, clothing that people react to, more street life, alternative portraits for flashbacks, new illustrations, inventory sorting, better orbiting interaction with objects, ultrawide, controller remapping, a photosensitivity mode, and an art-history "backstage" mode with commentary [R: RPG Site; PlayNews].
- Engine: Unity 6 (UnityPlayer file version 6000.3.15), IL2CPP backend [install file metadata, 2026-10-16].
- Length: about 21 hours for the main story [R: GG.deals]; about 35 hours without skimming [R: OpenCritic user review].

## 1. Faculties and skills

- 15 skills in three faculties of five: action, relation, intellect [R: RPG Site, 2026-05-08; GamingTrend 2026-05-21].
- Three starting archetypes, or a custom build [R: RPG Site].
- Experience comes from exploring, talking, odd jobs and reflection, not fights [R: GamingTrend].
- Skill checks are dice rolls modified by skill [R: RPG Site; Checkpoint Gaming, May 2026]. Two kinds again: retryable after a day passes or a skill level rises; one-shot for high stakes [R: GamingTrend]. Reviewers advise holding a few skill points in reserve to reopen failed retryable checks [R: Siliconera, 2026-05-21].

## 2. The three pressures (in place of health)

- Three meters, one per faculty: a physical one (tiredness), a social one (nerves) and a mental one (unreality) [R: RPG Site; Siliconera]. Mapping: action to the physical meter, relation to the social meter, intellect to the mental meter [R: Siliconera].
- **What raises them:** dialogue choices, failed checks, physical harm or neglect, drugs, and the deliberate push described in section 3 [R: GamingTrend].
- **What lowers them:** small rituals and rest, such as a smoke break or coffee, and completing goals [R: GamingTrend].
- **Near full:** the player cannot push checks of that faculty until the meter drops [R: Siliconera].
- **Full:** a random skill of that faculty loses a level [R: Siliconera; GamingTrend]. One reviewer called this punitive and noted it happened once in a full play [R: Siliconera].
- The meters are presented as a picture of the protagonist's state of mind, a system in its own right [R: RPG Site].

## 3. Pushing a check

Before a hard roll the player may push: gain an advantage on the roll by filling the matching pressure
meter considerably [R: Siliconera; RPG Site]. The size of the bonus, the cost in meter, and whether
the push can be stacked are unknown [U].

**What the player feels:** a check is never simply a chance. The player decides how much of the
protagonist's composure a success is worth, and pays in a currency that will cost skills later.

## 4. Conditioned beliefs

- Beliefs are gained through people and quests and placed in a limited number of slots [R: GamingTrend].
- Reinforcing a belief raises the level cap of certain skills and changes behaviour, opening dialogue options [R: Siliconera].
- Each belief carries a rule of conduct. Breaking the rule suspends the belief's bonuses for a while and applies a short penalty to certain rolls [R: Siliconera; GamingTrend]. Reported examples (paraphrased, generic): a belief that strengthens covert and lucky actions at night is suspended by sleeping through the night; a belief that raises two action skills is suspended by showing remorse [R].
- Some beliefs and skills depend on day or night [R: GamingTrend].

**Structural difference from Disco Elysium:** the reference's predecessor charges for a belief up front
(research time and a temporary effect). Here the belief is cheap to hold but polices behaviour
continuously. Roleplay becomes a constraint the player chooses to obey.

## 5. Cover and crowds

- The protagonist keeps a hardened persona; speaking sincerely risks blowing cover [R: Siliconera].
- Blending into a crowd grants practical invisibility, used during tense scenes [R: Siliconera; Checkpoint Gaming].
- Clothing changes skills, and in the Director's Cut people react to what she wears [R: GamingTrend; RPG Site]. Wigs and similar items are sold [R: GamingTrend].
- How cover is tracked (a hidden meter per faction, flags, or scene-local only) is unknown [U].

## 6. Tense set pieces

- The developer describes them as moments where time stands still and the player makes a series of choices to resolve a dangerous situation [R: developer description quoted in Checkpoint Gaming].
- Turn-based rounds; each round offers a few stances such as hide, run or assess [R: Galaxus review].
- No timer: the player has unlimited time to decide [R: Checkpoint Gaming].
- Each choice resolves through a dice check modified by skill; failure does not end the scene, the sequence continues from a worse position [R: Checkpoint Gaming]. Critical moments can be tried once [R: same].
- Presentation: the world drains to grey, a spotlight isolates the protagonist and the opponent, and the available skills appear as vivid, almost grotesque images to choose between [R: review quoted in search summary, PC Gamer or RPGamer, May 2026; needs confirmation of outlet].
- Reviewers split: one calls them the best and most underused mechanic, another says they are rare [R]. At least one can end in death (new death screens in the Director's Cut) [R: RPG Site].
- Some include supernatural abilities, such as stunning an attacker [R: Siliconera].

## 7. Network of contacts

- Rebuilding a broken spy network by meeting contacts across the city is a core loop; a larger network opens routes and jobs [R: GamingTrend].
- The city opens by district as the story advances, with hidden passages; three factions compete [R: GamingTrend].
- The story is a web: quests in different directions are keys to a final assignment; the player cannot help everyone and chooses who joins the last mission, at risk to their lives [R: Siliconera].

## 8. Time

- Days pass as the player acts; a passing day resets retryable checks [R: GamingTrend]. How time advances (per line, per action, per sleep) is unknown [U].

## 9. Unknowns that need a session

Push bonus size and meter cost; pressure gain per failed check; recovery amounts per ritual; how
near-full is defined; slot count for beliefs and how slots grow; how long a broken rule suspends a
belief; how cover is represented; the turn structure of set pieces (how many rounds, can the player
lose cover or a contact inside one); time cost of a line of dialogue. See `OBSERVATION-PLAN.md` section 3.

## 10. Proposals for Low Water [P]

Low Water's SYSTEMS-FULL already has Strain (push a check by paying into a meter) and Cold, Wear and
Dread. Where the reference suggests improvements:

1. **Keep the near-full lockout, drop the random level loss.** Low Water's rule (a full meter is a scene,
   never a loss of skill) answers the reviewer's complaint. Add the lockout: at Cold 8 Lamb cannot
   strain a COAT check, which the player sees before choosing.
2. **Rituals as recovery.** Small named comforts lower meters: a cup at the Brine stove, a dry pair of
   socks, a pipe on the weigh-house step. Each costs time on the tide clock, so recovery spends water.
3. **Margin notes with rules of conduct.** SYSTEMS-FULL makes notes tidal (they work only in certain
   light or tide). Add one conduct rule to a few notes, so a note is suspended by an act, not only by the
   weather; for example, a note that strengthens Lamb's calm with officials lapses for an hour if Lamb
   takes a drink. The rule is shown in the note's margin so breaking it is a choice.
4. **Squalls take the grey-spotlight idea in Low Water's own look.** The sodium light goes out except a
   single lantern circle around Lamb and the other party; the voices that can act appear as pencil
   marks in the Daybook's margin rather than as painted images. No timer, as in the reference, because
   Low Water's rule bans timed dialogue.
5. **Crowd cover through weather.** Low Water already gives blending in fog and blackout. The reference
   suggests making it active: Lamb can step into a passing procession or a queue at the ferry to drop
   out of a watcher's sight.

## 12. Data-derived structure and tuning (v2, 2026-10-17)

Read-only analysis in quarantine of the installed Director's Cut build (Unity 6000.3.15, IL2CPP). Only
numbers and structure leave quarantine; no names, lines or text.

### 12.1 Architecture [S]

- The game is built on the studio's own node-graph narrative runtime. Every piece of content is a **flow**
  of **cards** joined by pins; cards call **gates** (conditions) and **instructions** (effects) by name
  with typed arguments [S]. Game systems are separate modules that register their own gates and
  instructions: checks, beliefs, rituals, skills, sleep, status effects, waiting, time, inventory, barks
  [S]. Builders: this is the cleanest model of the three references for Low Water's LWD/1.
- One project database holds 1,535 flows (1,032 of them world "orb" interactions, 401 ordinary flows, 56
  bark flows, 39 belief-processing flows, 7 tense set pieces), 713 entities and the variable store:
  19,842 flags, 5,572 counters, 32 lists [D]. Flows load on demand in 321 chunks [D].
- Card counts across all flows [D]: 53,615 dialogue fragments; 9,732 passive checks; 441 weak-voice
  (fires-on-failure) passives; 998 orb cards; 451 bark cards; 154 one-shot checks; 100 retryable checks;
  802 two-outcome cards; 103 money options; 74 belief-punish and 39 belief-reinforce cards; 19 tactical
  hubs and 48 tactical routes (the set pieces).
- Gate and instruction use across flows [D]: flag tests 12,980; passive-result reports 10,173; set-flag
  6,706; counter increments 2,454; pressure increases 1,219 and decreases 498; item tests 909; item
  equipped tests 708; belief status tests 688; day-phase tests 340; XP grants 310; time advances 242;
  weather tests 116.

### 12.2 Dice [S]

- Two six-sided dice plus skill against a threshold. 12 is a critical success and 2 a critical failure
  [S]. Passive checks use a fixed 6 in place of the dice [S], as in the predecessor.
- **Pushing a check is an advantage roll**: roll three dice and keep the best two. A disadvantage roll
  (keep the worst two) also exists [S]. The interface precomputes probability tables for 2d6, advantage
  3d6 and disadvantage 3d6 [S].

### 12.3 The three pressures [D]

| | Value |
|---|---|
| Maximum per pressure | 20 (all three start at 0) |
| Cost of pushing a check | 5 pressure in that check's faculty |
| Push lockout | at 70% of maximum (14 of 20) the faculty cannot push |
| At maximum | a status effect fires; the skill-penalty percentage is 0 in data, so the penalty comes from the status effect (a skill demotion) [D][I] |
| Typical increase from content | +1 (65% of 1,219 increases), +2 (20%), +3 to +5 (the rest) |
| Typical decrease from content | -1 (48% of 498), -2 (34%), -3 (15%), -4 or more (3%) |
| Sleep | restores 50% of pressure; restful sleep needs 7 hours; sleeping again is locked for 7 hours |
| Waiting | each wait costs 30 minutes and +1 tiredness; a threshold triggers after 8 waits |
| Belief broken (dissonance) | +1 to the belief's faculty pressure |

Each skill also belongs to one pressure, so a skill's own failures feed that pressure [D].

Reading [I]: with pushes at 5 and content at 1 to 2, a player can push about twice per faculty before
lockout, and ordinary story pressure takes 7 to 14 bad moments to fill a bar. The bar is a budget for
pushes, refilled by sleep and rituals.

### 12.4 Rituals [D]

19 rituals (small comforts and routines). Cooldowns of 12, 20 or 24 hours; time cost 0, 30 or 240
minutes. Effects are typically -2 or -3 to one named pressure; a few give +4 to all three or +20 to one
value (likely a resource) [D][I].

### 12.5 Beliefs [D][S]

| | Value |
|---|---|
| Beliefs | 39, split 13 / 13 / 12 across the three faculties |
| Slots | 2 unlocked at the start; up to 9 reinforced; unlocking a slot costs 1 skill point |
| How a belief is gained | most through content; some appear automatically when a hidden counter crosses a threshold (4, 6, 8 or 14): four hidden personality counters, political leanings, the protagonist's own counters |
| Dissonance (broken rule) | lasts 7,200 s (2 in-game hours); adds +1 pressure; suspends the belief's skill effects |
| Resurfacing | an ignored belief comes back after 43,200 s (12 hours) |
| XP | +5 XP for each choice that agrees with a held belief; a skill point every 100 XP |
| Day-phase bonus | a belief can carry a bonus tied to one of four day phases |

Day phases [D]: dawn 04:00, day 09:30, dusk 15:30, dark 21:00.

### 12.6 Personas and cover [D]

10 personas, each with a credibility counter and a gained flag; 5 belong to the protagonist, 1 to a
companion, 4 to either [D]. Content switches the active persona 99 times [D]. Reading [I]: cover is a
per-persona credibility number that content raises and lowers, not one global meter.

### 12.7 Status effects [D]

73 general status effects plus one per belief for dissonance. Durations: mostly 4 h (19), 2 h (11), 6 h
(8), 24 h (8), 1 h (7), 8 h (5). An effect can change skills, faculties, pressures, personas or sleep, lock
pushing for a faculty, listen for a check result, a counter or an item gain, and chain to a follow-up
effect [S].

### 12.8 Time [D]

Each dialogue card advances the clock by up to 30 seconds; barks and orb interactions also 30 seconds
[D]. The cost steps down as the player reads more (thresholds after 50, 100 and 280 cards read) [D][I].
Explicit time jumps in content: 30 minutes (89 uses), 15 minutes (69), 10 minutes (21), 4 hours (20),
then 5 minutes, 20 minutes, 2 hours and 6 hours [D].

### 12.9 Checks in numbers [D]

| Card | Count | Threshold range | Most common |
|---|---|---|---|
| Passive | 9,732 | 6 to 15 | 10 (2,885), then 9 (1,927), 12 (1,210), 8 (1,164) |
| Weak-voice passive | 441 | 7 to 20 | 10 (109), 12 (95) |
| Retryable | 100 | 9 to 20 | 14 (23), 15 (19), 16 (14) |
| One-shot | 154 | 10 to 18 | 14 (38), 15 (27), 13 (23) |

A passive threshold is compared with skill + 6, so a threshold of 10 needs skill 4 [S][I]. Skills top out
at a rating of 9 [D]. Retryable checks reset when their condition changes; the database stores 695 such
reset conditions [D].

### 12.10 Tense set pieces [D]

Seven in the build. Each is a chain of 1 to 7 tactical hubs; each hub offers about 3 routes; each route
resolves with a one-shot check (2 to 15 per set piece); passive checks run alongside (22 to 252); pressure
moves inside the set piece (up to 26 increases in one) [D]. There is no timer [R][S].

### 12.11 What this means for Low Water [P]

- Build Low Water's runtime on the same split: flows of cards, named gates and instructions, systems as
  modules. LWD/1 already has records and effects; adding named gate and instruction hooks makes each
  system (the Margin, Strain, the Lamps) a module.
- Strain as advantage: Low Water has no dice, so give Strain a flat +2 and price it at a quarter of the
  meter, which matches the reference's cost-to-capacity ratio (5 of 20).
- Meter scale: 20 per meter, pushes at 5, ordinary harm at 1 to 2, lockout at 70%.
- Belief rules in time: 2 in-game hours of dissonance and a 12-hour resurfacing timer fit a three-night
  game when scaled to tide turns (about 6 hours each).
- Hidden personality counters that grant a belief when they cross a threshold: Low Water can use the same
  mechanism for Margin notes offered by the player's habits.

## 11. Sources

- RPG Site, features trailer, 2026-05-08: https://www.rpgsite.net/news/20325-zaum-shares-features-gameplay-trailer-for-zero-parades
- RPG Site, Director's Cut dated, 2026-09-17: https://www.rpgsite.net/news/21425-zero-parades-directors-cut-ps5-release-date-pc-free-update-patch
- RPG Site, Director's Cut available: https://www.rpgsite.net/news/21501-zero-parades-directors-cut-now-available-on-pc-free-update-download-ps5-release
- PlayNews, Director's Cut: https://www.playnews.gg/en/dlcs/zero-parades-director-s-cut-40-000-new-words-free-on-pc-october-1-2026
- Siliconera review, 2026-05-21: https://www.siliconera.com/review-zero-parades-understands-the-assignment/
- GamingTrend review, 2026-05-21: https://gamingtrend.com/reviews/zero-parades-for-dead-spies-review/
- Checkpoint Gaming review, May 2026: https://checkpointgaming.net/reviews/2026/05/zero-parades-for-dead-spies-review-luck-and-skill/
- Galaxus review: https://www.galaxus.at/en/page/zero-parades-for-dead-spies-captivating-world-meagre-main-character-42649
- RPGamer review: https://rpgamer.com/review/zero-parades-for-dead-spies-review/
- GG.deals: https://gg.deals/game/zero-parades/ ; OpenCritic: https://opencritic.com/game/20490/-/reviews
