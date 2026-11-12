<!-- writing-profile: research -->
# Dialogue and inner voices: Disco Elysium (clean-room spec)

Version 2, 2026-10-17. Version 1 used public sources; section 10 adds the reference's own structure and counts, read from its installed dialogue database and class layout (tag [D] data, [S] structure). Tags: **[R]** reported (cited), **[I]** inferred,
**[M]** measured (none yet), **[U]** unknown, **[P]** proposal for Low Water. No skill names, thought
names, lines or interface text from the game appear here. The engine is Unity 2020.3.12 with the IL2CPP
backend [install file metadata, 2026-10-16].

Low Water already has its own forms of most of this (`design/SYSTEMS-FULL.md` sections 2 to 6, 14). This
spec gives the builder the reference's behaviour in enough detail to judge whether Low Water's versions
match it in depth, and lists where they could go further.

## 1. The shape of a conversation

- The protagonist's skills are 24 inner voices, six under each of four attributes [R: Wikipedia, citing Rock Paper Shotgun 2019-10-14]. Each voice is a character with its own temperament, and each can address the player directly [R: Wikipedia; Critical Hits review].
- A conversation is one scrolling column of text laid over the right side of the scene, with spoken lines and narration in one colour and numbered choices in an accent colour [R: Wikipedia image caption]. Text accumulates; earlier lines scroll up and stay readable [I, from the same description].
- Lines are attributed by a speaker tag. Inner voices speak in the same column as the people in the room, so a voice can interrupt someone mid-exchange and the player answers it like a person [R: Critical Hits; PC Gamer 2018-09-10].
- Inner voices can argue with each other and with the protagonist; a voice can offer a dialogue choice that only exists because it spoke [R: Wikipedia, "skill-driven internal debates may provide suggestions"].
- The clock moves through talk, not walking. Opening a new topic costs a fixed slice of in-game time (one guide says about a minute per unseen topic); reading and sitting also pass time; walking does not [R: PC Gamer guide; Twinfinite; Steam threads, varying in detail]. The exact rate per line or per topic is unreported [U].
- The Final Cut voices nearly every line, about 1.2 million words of recorded material by the developer's count, with one actor voicing the narrator and all skill voices, close to half the dialogue [R: Wikipedia, citing Polygon and PC Gamer, 2021]. Players can choose narration-only voice settings [R].

**What the player feels:** the conversation is a crowd. The other person is one voice among the
protagonist's own, and the protagonist's own voices are the ones that know things, lie, flatter and
panic. The text column reads like a play script, which lets a dozen speakers share one scene.

## 2. Passive checks: voices that speak on their own

- No dice. A passive succeeds when skill level plus modifiers plus a constant of 6 meets the line's requirement [R: Disco Elysium wiki "Skills", read 2026-10-16]. Equivalently, the required skill levels run in bands from trivial (0 to 1) up to impossible (11 to 14) [R: same].
- On success the voice adds its line unprompted. The player may never know a check happened [R: gfinity guide].
- On failure, nothing appears; the player does not learn what they missed [R: wiki].
- About 10,000 passives exist [R: wiki count]. They never gate the plot [R: wiki].
- A smaller set (about 200) fire only when the skill is below the requirement: a voice that speaks because the protagonist is weak, often hurting health or morale [R: wiki]. This is the clearest case of failure being written as content.
- Passives fire inside conversations and also out in the world when the protagonist walks near something [R: gfinity].

**Builder rule set:** every line can carry an optional (voice, threshold, polarity) triple. Polarity
"at or above" shows the line when effective level meets the threshold; polarity "below" shows it only when
the voice falls short. Effective level is evaluated at the moment the line would display, with all live
modifiers.

## 3. Active checks

- Two six-sided dice plus skill plus modifiers against a difficulty [R: wiki; Rock Paper Shotgun]. Double one always fails; double six always succeeds [R: wiki]. Difficulties run in named bands from 8 to 20 with gaps [R: wiki].
- Before choosing, the player sees the check's difficulty band and the percentage chance, and the modifiers that apply [R: wiki, "the game displays a success-percentage table"; Wikipedia, citing GameCrate].
- Two kinds:
  - **Retryable:** failing locks the option until something changes: a point put into that skill (if under its cap), new information found elsewhere, a thought finished, an action done, rarely a time delay [R: wiki; gfinity].
  - **One-shot:** usually plot-bearing, cannot be retried, and failure sometimes gives the better outcome [R: wiki].
- Modifiers attached to a check are situational and itemised: what the protagonist said earlier in the conversation, clothing worn, thoughts held, substances taken [R: wiki]. Earlier choices in the same conversation can add or subtract, which ties dialogue choices to the arithmetic [I].

**The structural point** is that a retry is earned by changing the world, never by reloading or
waiting at the same prompt. The check becomes a small quest pointer: the player knows the option exists
and goes looking for the thing that reopens it.

## 4. Attributes, caps and the cost of being good at something

- Attribute points at creation set every skill's starting level and its learning cap; a chosen signature skill gets +1 and raises its attribute's caps by 1 [R: wiki].
- Points come from experience; a point can raise a skill, buy a belief slot, or reopen a retryable check (by raising the skill) [R: wiki; Wikipedia].
- High skills bring quirks: a voice with a high level speaks more often and can push the protagonist into embarrassing, harmful or self-destructive behaviour [R: Wikipedia, citing Rock Paper Shotgun]. A strong voice is a stronger personality, not only a better number.
- Two damage tracks, health and morale, each tied to the skills of two attributes [R: wiki]. Failures and certain passives damage them [R: wiki]. Zero on either ends the game [U, not in sources read; widely held, needs confirmation].
- Clothing and items raise and lower skills [R: Wikipedia, GameCrate].

## 5. The belief slots

Structure only, in my words:

- Beliefs are offered by the world: a conversation or an inner monologue raises an idea, and the player may take it [R: wiki "Thoughts"; Wikipedia].
- Holding up to 12 at once; 3 slots at the start; each further slot costs one skill point [R: wiki].
- Taking a belief starts a research period measured in in-game time (from 15 minutes to 20 hours); sleep does not count toward it [R: wiki]. Several can be researched at once; research can be paused [R].
- During research a temporary effect applies, often a penalty or a strange bonus; on completion it is replaced by the permanent effect, which can mix benefits and drawbacks [R: wiki].
- Discarding a belief costs a skill point, frees the slot, and removes that belief for good [R: wiki].
- 53 exist; some exclude each other, so one play cannot hold them all [R: wiki]. The developer compared the system to traits in Fallout [R: Wikipedia, citing a ZA/UM post, 2017-03-31].
- Completing a belief typically produces a passage of writing, a small essay in the protagonist's head, as the reward [I, from wide report; confirm in observation].

## 6. Failure as content

- Failed checks produce scenes, not dead ends. A failed one-shot may close a quest line or a relationship but never stalls the story [R: gfinity "can you fail"].
- The weak-voice passives (section 2) are written for low skill specifically [R: wiki].
- Failures cost health or morale, which are reported as tied to specific attributes [R: wiki], so a failure has a bodily or emotional echo, not only a closed option.
- Some failures are funnier or more revealing than the success [R: wiki on one-shot checks; reviews].

## 7. How the world remembers

- The writing team called it "microreactivity": small choices and earlier lines change later lines, checks and modifiers [R: GCores developer article; secondary summary of a Wired 2021 piece]. The developer wrote that clusters of this reactivity were large enough to crash their dialogue authoring tool [R: GCores].
- Characters refer back to things said in other conversations; checks gain or lose modifiers from earlier choices [R: same; wiki].
- Time of day gates who is where; some people go indoors around 21:00; some quests are time-limited [R: Steam thread].

**Builder rule set:** a flat global fact store (boolean and integer variables), written by any line,
read by any line's display condition, check modifier list and choice availability. Plus per-character
memory flags. Lines can be gated on facts, on time windows, and on held beliefs.

## 8. Proposals for Low Water [P]

Low Water's SYSTEMS-FULL already maps most of these. Places the reference goes further, with a Low Water
answer in its own form:

1. **Weak-voice lines at volume.** The reference has about one weak-voice line for every fifty
   strong-voice lines. Low Water could aim higher, one in ten, because its voices are tied to weather
   and tide: a voice that falls short because Lamb is soaked should say so in its own temperament.
2. **Itemised check modifiers drawn from the night.** The reference lists modifiers from earlier lines
   and clothing. Low Water's pencil checks can list the tide, the lamp colour, the coat's wetness, and
   who is watching, so a retry is reached by changing the world: the weather is the second chance.
3. **Belief research in tide time.** The reference counts research in clock hours. Low Water's Margin
   notes ink over tide states (two turns of the light, one low water), so research ties to the night's
   rhythm and is never just waiting.
4. **A completed belief rewards with writing.** Keep this: when a Margin note inks, Lamb writes a short
   page in the Daybook.
5. **Talk is the clock.** Low Water already moves the night only when Lamb acts. Make the cost per line
   visible as the tide gauge's needle so the player feels each topic spend water.
6. **Voice casting.** One actor for every inner voice gave the reference a single head full of moods.
   Low Water's voices could instead be voiced as Lamb's own voice at different ages and states (tired,
   drunk, eleven years younger), which keeps the single-head idea in a different form.

## 10. Data-derived structure (v2, 2026-10-17)

Read-only analysis in quarantine of the installed build (Unity 2020.3.12, IL2CPP). No text, names or lines
leave quarantine; only counts and structure.

### 10.1 What the dialogue engine is [S][D]

- A third-party node-graph dialogue runtime with a Lua condition and script layer, fed by an export from a
  narrative authoring tool. The game adds about two dozen modules of its own script functions (clock,
  inventory, clothing, companion presence, map, money, tasks, thoughts, sound, area-specific logic) [S].
- One database holds everything: 424 actors, 259 items (53 of them are beliefs), 10,645 variables,
  1,501 conversations, 112,962 dialogue nodes and 136,536 links [D].
- 70,017 nodes carry displayed text; 19,814 are routing forks with no text [D]. The median conversation has
  2 nodes and the largest 1,860 [D]: most "conversations" are short world interactions, a few are huge hubs.

### 10.2 Inner voices in the data [D]

- Skill voices are ordinary actors in the database. 26 actors each speak more than 40 passive-check lines
  (24 skills plus two other inner presences) [D][I].
- 21.4% of all displayed lines are spoken by an inner voice [D] (14,985 of 70,017).
- Passive lines per voice range from 78 to 897; the most talkative voice has about 11 times the lines of
  the quietest [D]. Builders: plan for uneven voice volume on purpose, not equal coverage.
- A passive line carries one integer threshold (the required skill level). Distribution [D]:

| Threshold | 1 | 2 | 3 | 4 | 5 | 6 to 8 | 9 | 10 | 11 | 12 to 14 |
|---|---|---|---|---|---|---|---|---|---|---|
| Lines | 1,247 | 6,297 | 1,123 | 316 | 128 | 52 | 244 | 542 | 189 | 47 |

  Reading [I]: about 62% of passives sit at level 2, so a voice with any investment speaks constantly; a
  second cluster at 9 to 11 rewards specialists with rare lines. The middle (5 to 8) is almost empty.
- 213 lines are flagged to fire only when the voice falls short of its threshold [D] (the "weak voice"
  lines of section 2).

### 10.3 Active checks [D]

- 126 retryable checks and 110 one-shot checks in the whole script [D]. Active checks are rare; passives
  outnumber them more than 40 to 1.
- Difficulty is stored as an index 1 to 14 and turned into a two-dice target by the code; the 15 named
  difficulty bands run from 6 to 20 [S]. Most active checks sit at index 2 to 4 (easy end) with a second
  group at 10 to 12 [D].
- 214 of the 236 active checks carry itemised situational modifiers: median 4 per check, up to 10. Each
  modifier is a triple (a condition variable, a signed bonus, a tooltip). Values: -1 most common (575 uses),
  then +1 (144), -2 (132), +2, -3, and rare large swings of plus or minus 10 to 20 [D].
  Reading [I]: the typical modifier is a small penalty for not having done something; the player reads the
  list as a to-do list for raising the odds.
- A check result records: check kind (passive, retryable, one-shot), skill, attribute base, skill base,
  roll bonuses, both dice, base target, the applicable and all target modifiers, success, locked, and a
  forced-result flag [S]. Skill modifiers carry a source kind: starting dice, character creation,
  attribute, signature skill, advancement, story, secret, item, belief, chemical, damage [S].

### 10.4 Time [S]

- Each spoken dialogue line advances the clock by 23 in-game seconds; one clock "clang" step is 15
  minutes [S constants]. Reading [I]: a 30-line conversation costs about 11.5 in-game minutes.

### 10.5 Beliefs [D][S]

- 53 beliefs. Research time in in-game minutes: 30 to 1,440, median 300 (5 hours); most common 300 (20 of
  53) and 240 (12) [D]. 39 of 53 have an unlock requirement [D].
- Each belief holds research effects and completion effects, each a list of typed effects: stat bonus,
  skill bonus, set variable, damage, heal, reopen a retryable check, extra item slot, raise a learning cap,
  passives auto-succeed, passive target modifier, bonus XP, reputation, camera zoom limit, run a script,
  and others [S]. State machine: unknown, known, researching, discovered, fixed, forgotten [S].

### 10.6 Reactivity [D]

- 26,210 nodes (23%) have a condition; 13,273 run a script on display [D].
- Conditions read variables 23,056 times; the next most common test is "is the companion present"
  (4,687 uses), then item checks and time-of-day tests [D][I].
- 2,208 nodes have conditional alternate text (390 with two or more alternates, 226 with three or more):
  the same node swaps its line by state, which is the cheapest form of reactivity [D].
- Variables: 10,645, almost all booleans initialised false (10,503), grouped into 34 namespaces by area or
  character; the largest namespace holds 1,688 [D]. Reading [I]: memory is a very large flat set of
  "this happened" flags, not a model of the world.
- 139 tasks each carry display, done and cancel conditions and up to several subtasks with their own
  conditions [D].

### 10.7 What this means for Low Water [P]

- Budget the script like the reference: passives everywhere, active checks rare (about one per 300 lines),
  voices uneven by design, about one line in five from an inner voice.
- Store a pencil or ink check's modifiers as (condition, signed bonus, short reason) triples, mostly -1 and
  +1, so the reasons read as a list of things Lamb could change.
- Put reactivity in two cheap places first: conditional alternate text on existing nodes, and a flat flag
  store grouped by district. The engine's LWD/1 can carry both.
- Time per line: the reference spends 23 seconds a line. Low Water's tide clock could spend about 30 to 45
  seconds a line so that a long conversation visibly moves the water.

## 11. v3 additions (2026-10-17): voice chains and stat-gated options

New in this version, from the same decoded dialogue graph [decompiled, high]:

- **How many voices a line carries.** Walking forward from each inner-voice line: the median run of
  consecutive voice lines is 1, the 90th percentile 2, the longest 9. Distinct voices in a run: one in
  12,406 cases, two in 2,080, three in 363, four in 97, five in 29, six to nine in 10. Voices mostly speak
  alone; pairs are common; choruses of four or more are rare set pieces.
- **How stats change the options that exist.** Of 24,714 player response nodes, 6,668 (27%) carry a
  display condition, and 454 of those test a skill or check function directly. Most option gating is
  by world flags (what Lamb has done or knows), and only a small share is a raw stat test; stats mostly act
  through voices and checks instead of hiding options.
- **Failure that opens content.** Besides the 213 weak-voice lines (section 10.2), every active check
  routes to its own success and failure branches; one-shot check nodes have a median of 1 outgoing link
  each because the branch is taken by condition on the following nodes [inferred, moderate].

For a live world, see `LIVE-CONVERSATION.md` part B.

## 9. Sources

- Disco Elysium wiki, "Skills" and "Thoughts", read 2026-10-16: https://discoelysium.wiki.gg/wiki/Skills ; https://discoelysium.wiki.gg/wiki/Thoughts
- Wikipedia, Disco Elysium, read 2026-10-16 (cites Rock Paper Shotgun 2019-10-14 and 2019-10-15, GameCrate 2019-10-16, PC Gamer 2018-09-10, ZA/UM 2017-03-31, Polygon 2021, Wired 2021-06-07): https://en.wikipedia.org/wiki/Disco_Elysium
- gfinity, "Can you fail" and "Best skills explained" (undated): https://gfinity.net/disco-elysium/can-you-fail/ ; https://www.gfinityesports.com/disco-elysium/disco-elysium-best-skills-explained/
- GCores, developer article on micro-reactivity: https://www.gcores.com/articles/158712
- Kotaku on dialogue: https://kotaku.com/disco-elysium-lets-you-choose-your-characters-dialogue-1839144864
- PC Gamer, "Things I wish I knew": https://www.pcgamer.com/au/things-i-wish-i-knew-before-playing-disco-elysium/
- Twinfinite, passing time: https://twinfinite.net/guides/disco-elysium-pass-time-how/
- Steam discussion on time: https://steamcommunity.com/app/632470/discussions/0/6821308966006104963
