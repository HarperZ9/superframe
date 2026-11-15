<!-- writing-profile: research -->
# Combat spec: the fight at the top of the market

Combat director, 2026-10-23. For the combat engineer, the character lead, the audio lead, the UI lead and
the engine lead. It answers the author's direction of 2026-10-23, verbatim: "Let's make things really
intense and graphic. Lots of deep painful story content, and great combat." And: "We want to rival, and
beat AAAA titles with an indie game and engine." It keeps the 2026-10-16 direction: serious-production
characters and NRFTW-style combat (No Rest for the Wicked).

It supersedes SYSTEMS-FULL section 18 on feel numbers where the two disagree. The fiction, the
consequences and the opponents in section 18 stand. The hard lines in DECISIONS-2026-10-22 ("Abuse shown
on screen") hold over everything here.

Sources were read on 2026-10-22 and 2026-10-23. Every benchmark number carries its type: **M** measured,
**D** community datamined (wiki or modder, not patch-pinned), **DS** stated by the developer or publisher,
**E** estimate (ours, or a source's own guess). Where no source gave a number, the row says so. Section 9
lists the sources.

## 1. Pillars

1. **Every blow has a body on the other end.** No opponent in the outer world is a monster or a number.
   Each human opponent has a name, a household and a street in the community model, and the fight writes
   what it did to them into the Record (`struck.<char>`, and the new `wound.<char>.<region>` and
   `killed.<char>`). Killing a man empties a bowl at a table the player may sit at later.
2. **Weight before speed.** Commitment is the core of the feel, as in No Rest for the Wicked and Elden
   Ring: an attack commits for its startup and active frames, and only a dodge or a catch cuts its
   recovery. Weight is shown by the body (wind-up, recoil, knockback, fall), by a short keyed camera
   shake, and by sound. It is never shown by a damage number.
3. **The consequence outlives the fight.** Wounds stay on bodies in later scenes. Blood stays on the
   plate until someone scrubs it, and that scrubbing is a scene. A beaten man limps at the pump on day
   41. The violence is graphic so that the cost is legible, never for spectacle.
4. **The inner arena is the self-lies made flesh.** Inner fights are against the player's own evasions
   (08-ARENA.md). Force wins them and hardens the flaw; the other verbs (refuse, endure, yield, lose,
   name) resolve them. Winning by force there is the lie proved.
5. **Readable at the fixed camera.** The game plays on one three-quarter isometric angle with a world-space
   tilt-shift focal plane (CAMERA.md). A telegraph, a wound and a body's state must read at 134 to 137 px a
   person at 1080p, through the painterly defocus, in sodium light and in the dark.
6. **Win on focus.** We beat the large studios on writing, art direction, feel and engine craft, measured
   by the targets below. We do not try to match their breadth of weapons or enemies.

## 2. The verbs

| Verb | Input | What it does | Breath |
|---|---|---|---|
| Light strike | tap | Fast, short; a string of two or three in the tool's rhythm | 1 |
| Heavy strike | tap | Slow; breaks guard and poise; armoured after its first frames | 2 |
| Charged heavy | hold, release | Knocks down; armoured from frame 0 | 3 total |
| Catch | tap, timed | A frontal parry; opens the attacker for a riposte | 1 |
| Riposte | light inside the opening | A finishing blow on a caught body; the wound system's largest marks | 0 |
| Block | hold | A frontal guard, Breath per blow held; heavies break it | 1 a blow |
| Sidestep | tap, short | A quick step with a small safe window | 1 |
| Roll | tap, long | Its form follows the load: dash, roll, hop, lurch (NRFTW's weight classes) | 2 |
| Shove | tap | A step's push: into water, off a ledge, onto frost | 1 |
| Grapple | tap | Seize the arm or tool; a contest of GRIP | 2 |
| Takedown | on a downed or snared body | A finishing act on a body that cannot defend; unparryable | 1 |
| Use | tap | The pocket thing: lantern, rope, salt, bottle | 0 |
| Talk | the exit key when shown | The timed talk exit (COMBAT-WORLD, "Talk exits") | 0 |
| Lay down | hold guard and interact 1 s | Inner arena only: the tool drops (yield) | 0 |
| Name | the read-back row, over a live fight | Inner arena only: choose what happened over what was told | 0, costs standing |

### 2.1 Move set per class (era 2, all six per D5)

Every class has the common verbs above. A class adds its tool family (the classes already in
`combat/data/tools.mjs`: shield, light, long, short, heavy, bar, unarmed), two signature moves, one item
and one way to end a fight without winning it. Signatures are learned from a named person in a scene
(SYSTEMS-FULL 18.5), never bought.

| Line, era 2 man | Tool family | Signature 1 | Signature 2 | Item | Way out without winning |
|---|---|---|---|---|---|
| Mott, Walter, the clerk | Shield (the bound ledger), unarmed | **Close the book**: a catch with the longest window in the game (shield, 11 frames) whose riposte is a ledger-edge blow to the throat | **The bar on the seven**: a feint light that reads as a block, learned from his father | Ink pot, thrown to blind | Read a man's own entry aloud to him (talk exit, needs the ledger) |
| Furrowe, Ned, the inspector | Long (the measuring rod) | **The count**: holding still for 1 s marks a weak point on the target, from the PEN pillar's reads | **Up the hill**: a rod sweep at the legs that drops a man on frost | The good hat, thrown (a feint) | "Reported as found": write it down and walk away; the record notes it |
| Ashby, Lena, the correspondent | Bar (the tripod) | **Set the legs**: a planted tripod that blocks one lane | **The second exposure**: a shove that turns the man to face the street, so witnesses see him | Flash powder: a blinding burst drawn as a local bloom under the flash rule, never a screen flash | Raise the camera: men who will be seen stop |
| Lind, Clara, the doctor | Short (the lancet), unarmed | **Where it bleeds**: lights land on the wound already open, and wound tiers rise faster | **Bind**: stop her own bleeding mid-fight, 90 frames rooted | Laudanum: drinks to stop the shakes, written to the Record | Treat a downed opponent instead of finishing him |
| Brack, Will, the militia sergeant | Bar (the truncheon), unarmed | **Restraint**: a grapple into a pinned hold, a takedown that does not kill | **The step-in**: a shove that drives through a block, learned on the Crown's steps | Cuffs, thrown at the legs as a snare | The whistle: two constables come and the fight becomes an arrest |
| Orme, George, the miller | Heavy (the mill hook), unarmed | **The sack hook**: a heavy that pulls a man off his feet toward George | **The weigh beam**: a charged swing that clears a ring around him | A sack thrown to block a lane | Pay him: bread from the night carts, and the board chalks whose |

Brack's line is the one most at ease with violence, and Will turns it on his own house (the "house"
perspective pair). His move set carries the abuse thread: the same restraint and step-in appear, with no
cutaway, in his kitchen.

## 3. Feel targets

All frames are at 60 a second. Benchmark Elden Ring figures are datamined at 30 frames a second and are
doubled here. Every target has a check that can fail; section 8 names the harness for each.

| # | Target | Value | Benchmark it must match or beat | Check |
|---|---|---|---|---|
| T1 | Input to first visible frame of the action, glass to glass, native, 60 Hz | **50 ms or less** median, 67 ms p95 | Mick West: 67 ms is good at 60 fps, 50 ms the practical floor (M, 2008). Diablo IV with Reflex: up to 67 % lower PC latency (DS). No glass-to-glass number found for NRFTW, D4, PoE2, Hades or Elden Ring | Latency bench: input injected by timestamp, present timestamp from the swapchain, plus a camera rig once a year |
| T2 | Simulation frames from press to the move starting | **0 frames** when free | Our own; a frame of slack is a frame of the T1 budget | Frame-data test |
| T3 | Input buffer | **8 frames (133 ms)**, newest press first, held presses kept | Elden Ring queues a press "at the next available chance" (DS, no length given); attack beats roll beats move (forum claim) | Frame-data test; fluid test |
| T4 | Fastest light strike startup | **10 to 12 frames** (167 to 200 ms) for short and unarmed; **22 frames or less** for the heaviest tool | No frame data found for Elden Ring or NRFTW light attacks; estimate | Frame-data test over every tool class |
| T5 | Catch (parry) active window | **8 to 10 frames** (light tools), **11 to 12** (shield); a **24-frame lockout** after a missed catch | Lies of P perfect guard 9.3 frames, 30-frame lockout (D). Sekiro deflect 12 frames by animation tag (D). Elden Ring 3 to 5 active frames at 30 fps, so 6 to 10 at 60 (D) | Frame-data test; a mash test that the window cannot be held open |
| T6 | Roll safe window and recovery by load | Light: **24 safe frames, 14 recovery**. Medium: 22 and 18. Heavy: 20 and 30. Over: a lurch, 8 safe | Elden Ring: 13 i-frames at 30 fps (26 at 60), recovery 8 rising to 16 at heavy load (D). Its lesson: recovery is the lever, not the safe frames | Frame-data test per load band |
| T7 | Hitstop by weight | Light **0**, heavy and charged **2**, guard break and catch **2**, capped at 4 with three or more bodies standing; the caught attacker held **12** | The author's ruling of 2026-10-21 ("2-frame freeze on heavy blows"), from the NRFTW study (no hitstop there, weight from a keyed shake). Street Fighter V, 8 frames (DS), is the fighting-game ceiling we deliberately stay under | Frame-data test on `FEEL` |
| T8 | Hit reaction starts on the contact frame | Reaction pose on the **same tick** as contact; a heavy shows a recoil within **2 frames** and a fall with a bounce | Sakurai blends the flinch into the hurt pose over 4 frames during hitstop (DS). The JS feel review found reactions missing before the 10-17 fix | Captured run: reaction frame minus contact frame, per move |
| T9 | Telegraph lead, tell start to first active frame | Parryable from one attacker: **18 frames or more** (300 ms). Unparryable: **30 frames or more** (500 ms) with its own shape and sound. Boss signature: **36 or more** | No millisecond figure found for any benchmark. 300 ms sits above a trained human's simple visual reaction time of about 200 to 250 ms (E, general physiology, moderate confidence) | Frame-data test over every move with a tell |
| T10 | Camera shake | Keyed: peak at frame 2 to 3, swing back at 6 to 8, rest by 12 (15 heavy); **6 px peak at 1080p** on a heavy; **3 px cap** while any tell shows; settings full, 40 %, off | NRFTW keyed shake with an inertial spring (our study, CAMERA.md). Eiserloh's trauma model, shake from trauma squared, rotation only in 3D (DS, GDC 2016) | Captured offsets per frame (`capture/shake-*`); fightcam test |
| T11 | Attackers at once | **1 token**, a second after 20 s, one more while the player is passive, **3 at most**; kiting answers bypass tokens | Doom 2016's token pool per attack type (DS, via a secondary write-up). One article's suggested defaults: melee 1, ranged 2 (E) | AI test; a 40-seed soak counting simultaneous active frames |
| T12 | Readable size | **130 to 160 px** a person at 1080p in every fight | The clean-room presentation spec; Hades is praised for telegraphs but faulted on small foes (review, E) | placeshot report per fight area |
| T13 | Poise and stagger | Poise in hits; refill after **120 frames** clean; driven to -2 puts the body down; stagger **60 frames**, catchable by a roll from frame 40 | Elden Ring: poise breakpoints at 51 and 101 because most hits deal 50 or 100 (D); boss poise 80 to 120 (D). Sekiro posture regenerates for both sides (D) | Frame-data test; poise test with a control foe |
| T14 | Hit reaction variety | Per body: **4 directions x 3 weights** of flinch, plus stagger, knockdown with bounce, wall hit, ledge fall, water duck, grab, and a death per wound region (**20 or more** clips) | No count found for Diablo IV or Wukong (E: both visibly exceed 12) | Clip coverage test over reaction ids |
| T15 | Audio onset | Contact sound scheduled on the **contact tick**, heard within **30 ms** of the frame that shows it | No benchmark number found; our own, set below the T1 budget | Audio event timestamps against present timestamps |
| T16 | Frame time in a fight | **16.7 ms p95** at 1080p with 6 bodies, wounds and decals on; **33.3 ms p95** on a Steam Deck | Ledger F1 and F2 | bench, native build |

### 3.1 Why these numbers

- **T5 sits at the generous end of the parry benchmarks, and the lockout is new.** Lies of P and Sekiro
  both punish mashing. Without a lockout our 7-frame catch could be spammed for the 20 frames of its
  recovery. A wider window with a lockout keeps the clean timing honest and rewards reading the tell.
- **T6 follows Elden Ring's lesson.** Heavy load keeps most of its safe frames and pays in recovery.
  NRFTW changes the dodge form itself by weight; ours already does (dash, roll, hop, lurch).
- **T7 holds the author's ruling.** Light hits get their weight from T8 and from sound (T15), because
  the light strike's camera response measured 1.2 to 1.4 px (COMBAT-WORLD, feel5). The body and the sound
  close that gap; more freeze would fight the author's ruling.
- **T9 is our own floor** because no benchmark publishes telegraph timing. It is set by the isometric
  distance: at 134 px a man, a wind-up is a small change of silhouette, so the lead must be longer than
  in a close third-person camera.

## 4. Graphic violence

Governed by "Abuse shown on screen" and "Intense and graphic" (DECISIONS-2026-10-22). Both hard lines
hold here without exception: nothing sexual involving a minor in any form; sexual violence between
adults shown as coercion, threat, the act's violence and its aftermath, never as sexual content or
nudity. No wound, strip of clothing, pose or camera in combat sexualises a body.

### 4.1 Wound states on bodies

- **Regions:** head, torso, left arm, right arm, legs. **Tiers:** bruise, cut, deep cut, broken. A
  burn and a hook wound are their own kinds.
- **What sets them:** the tool's class and the move. A truncheon bruises and breaks; a sickle and a
  lancet cut; the mill hook makes a hook wound and drags. A riposte and a takedown move a region up two
  tiers.
- **What they do:** a broken arm drops the tool; broken legs turn the roll into a lurch; a deep cut
  bleeds Standing until bound. The same rules apply to the player and to opponents.
- **How they show:** painted wound layers on the figure, per region and tier, under the painterly look;
  torn and darkened cloth; the stance changes (a held arm, a limp). Portraits carry the head wounds.
- **How they persist:** `wound.<char>.<region>` goes to the Record. Later scenes test it: a sling, a
  limp, a scar, a man who will not meet the player's eye. A killed opponent writes `killed.<char>` and
  his household loses a member through the community model, decided by a named person as every fate is.

### 4.2 Blood

- Spatter on contact sized by tool and tier; pooling under a downed body that grows over 10 s; drag
  trails; blood on the striker's tool and cuffs that stays until the next scene change.
- **Flash rule (WCAG wording, adopted 2026-10-22):** blood is local paint, never a screen-wide change.
  No spatter or pool may produce a general flash: no pair of opposing luminance changes of 10 % or more
  of maximum relative luminance over a quarter of the view, three times a second, and no saturated red
  flash. The flashcheck runs on every captured fight.
- **Settings:** gore full, reduced (a severed limb drawn as a fold of paper and ink, small spatter, no pooling) and
  off (bruises and torn cloth only; wounds still change play). A blood colour option for colour vision.
  The defaults are full.

### 4.3 Dismemberment

**In every fight, town fights included, following the weapon** (author, 2026-10-23, DECISIONS-2026-10-22
"Combat content calls"). What a hook, a cleaver or a scythe can sever, it severs. A truncheon, a lump
hammer or bare hands break and bruise and never take a limb, so the wound tells the player what the
tool was. The body stays a person: the named dead keep their names, and bodies stay where they fell
(4.4). The wound model and the gore art are package P8.

**In the inner arena it also carries the story.** The Host's limbs fall only when the player names the
lie they carry (inferno decision 1), so a severed limb there is a lie given up. The amalgamations may
shed parts at a morph. The gore "reduced" setting draws every severed limb as a fold of paper and ink.

### 4.4 Aftermath that persists

- Bodies stay where they fell for the rest of the scene. No despawn, no fade.
- Blood stays on the plate's decal layer until the era changes or a scene scrubs it (Bet on her knees at
  the Well House step is such a scene). Decals are saved with the place.
- The board by the mill gate chalks who was hurt, beside whose loaf it was.
- Barks after a fight speak about it in the next node (SYSTEMS-FULL 18.9). Violence is talked about,
  never only scored.

### 4.5 Children in combat

**Children can be harmed in combat** (author, 2026-10-23, DECISIONS-2026-10-22 "Combat content calls").
The author chose this over the earlier proposal that children never be targets. The rules that hold:

- **Never a reward.** Hurting a child gives no score, loot, experience, standing or progression of any
  kind. No achievement names it. The design check is a test over the reward paths once child bodies
  exist in the sim (P8).
- **Always on the record.** Every harm to a child is written to the world record with the child's name
  and household, and it carries consequences in the world like any other act.
- **A named person's choice.** As with every act in the game, the harm belongs to someone with a name.
- **The hard lines stand** ("Abuse shown on screen"): nothing sexual involving a minor, ever, and sexual
  violence without sexual content or nudity.

Rating risk: interactive violence against children is the content most likely to draw a refusal of
classification and closer platform review. RATING.md section 3 holds the detail, and the territory check
before launch is required.

## 5. Enemies and bosses

### 5.1 Enemy design rules

1. Every human opponent is a person: name, household, street, a want, and a talk exit where the
   fiction allows one.
2. Each archetype owns **one signature threat** with a unique tell shape and sound, so the player reads
   the kind before the move.
3. Every unparryable attack has a lead of 30 frames or more and its own cue (the toothed ring for drags).
4. A pack closes lines rather than queueing: the token holder attacks, the rest cut off and flank
   (COMBAT-WORLD, "Cutting off").
5. Kiting is answered by the lunge and the thrown stone, never by stat buffs.
6. Principals never die in a fight (18.6). Everyone else can, and the Record keeps it.
7. No Hesh person and no world perpetrator is ever a monster (08-ARENA rule 6).

### 5.2 Boss grammar

Every boss, outer and inner, is a real fight (the author, 2026-10-23: "attack patterns, timing, special attacks, and arena mechanics are important, and the combat should be real and palpable"). The inner bosses were reworked to this grammar on 2026-10-23; the outer bosses keep the fixed-pattern brain (combat/ai/boss.mjs) until they are reworked the same way.

- **A readable moveset of 6 to 10 attacks**, each with its own tell (T9): quick blows that come in strings, a held version of a blow that catches an early roll, a gap closer, a guard-breaking blow under armour, a grab that puts the player down, and a signature.
- **Strings and mixups.** After the first blow of a string the boss picks its follow-up by weight: a quick one, a held one, a grab, or nothing. The pick is seeded, so a run replays exactly, and it is drawn from a short list, so a player who watches learns it.
- **Punish windows.** After every string the boss rests (40 to 75 frames, shorter in later phases), and its heavy blows and charges have long recoveries; a charge that meets a wall dazes it.
- **Spacing.** Between strings the boss holds a range: it closes in, backs off, or circles at that range, so the player has to choose when to go in.
- **Two or three phases**, cut by standing, each faster (shorter rests, longer strings, more grabs) and each adding one move and one change to the ground. A new phase opens with a roar: no blow lands for 50 frames (F3).
- **A signature on a clock**, with a lead of 36 frames or more, that also calls the ground (a floor mark, a lane across the room, a ring).
- **The arena acts.** Floor marks strike after a lead of 30 frames or more and pass through a roll's safe frames (combat/arena/innerhaz.mjs); phases change the ground (mud pits, ice, walls that close the room); some marks hurt the boss too, so the player can bait them.
- **Stamina and poise on both sides.** The boss pays breath for every move and winds itself; the player's heavy blows break its poise.
- **A shown name.** Inner bosses show the virtue they wear (FATHERHOOD, DUTY); the sin stays in the data.
- **Force always works.** Bringing the boss to nothing ends the fight as `forced`. The ways out that are not winning (the five verbs) stay as optional layers on top of the fight, never the main way through.

**Inner bosses.** The flaw is assembled from the run's own self-lies and what they cost (08-ARENA section 3). Force always hardens it. Each boss's moveset and ground are in section 12.1.

**The Adversary, in three movements (inferno decision 1, reworked 2026-10-23).** Each movement is a fight that force can end.
1. **The Clerk.** A duelist with the pen and the book; his signature raises lines of type from the ice. He still reads the player's record as he fights, true on every fact; stopping answering and striking while he reads is the optional end.
2. **The Host.** A great body with the run's kept lies fighting beside it as limbs that can be killed; the ice spreads by phase and cracks in rings round the player. Naming a limb is the optional way to take it.
3. **The One Who Withdraws.** It strikes, goes out of reach through its safe frames, and comes again from range; its signature is a ring round the player. Recognising the whisper is the optional end.

## 6. Difficulty and accessibility

| Option | Values | Notes |
|---|---|---|
| Story setting | on, off | Fights still played: incoming damage 25 %, catch and safe windows doubled, telegraph leads +50 %, no Down from a single exchange. Stated plainly in the menu, with no shame text |
| Fight speed | 100 %, 80 %, 60 % | Scales the sim tick, not the animation blend |
| Assist | longer catch window, auto-face the token holder, hold-to-block as toggle | Each separate |
| Remap | every action, keyboard and pad separately; one-handed preset | Ledger C4 |
| Camera shake | full, 40 %, off | CAMERA.md |
| Gore | full, reduced, off; blood colour | Section 4.2 |
| Reduced flash | on, off | WCAG wording; on by default only through the boot notice |
| Haptics | 0 to 100 % | Rumble events from `hits.mjs` |
| Telegraph sound cues | on, off | Every tell has a sound, for low vision |

Benchmark: The Last of Us Part II shipped more than 60 accessibility settings (DS, 2020-06-09). Our
target is every option above in the native settings menu at 1.0, each covered by the settings test.

## 7. Audio and haptics

- **Hit identity.** One sound family per tool class (7) times material struck: cloth, flesh, bone,
  wood, iron, sacking (6). Layers: a transient on the contact tick, a body layer, and a tail by room.
- **Bodies.** Breath that worsens with Breath spent, grunts by tier, the fall by surface, the drag on
  stone.
- **Barks.** One voice line at a time, never stopping the action (18.9).
- **Telegraphs.** Every tell has a sound; unparryables have one family shared across all foes.
- **Mix.** Ducking for barks; the mix never gives a lie away (ledger AU5).
- **Haptics.** Low and high rumble per hit (already emitted by `hits.mjs`), a long low pulse on a
  knockdown, a short high tick on a catch.

## 8. The native build

Combat is built in C++ on raw-native (D2 refined), not in the JS runtime being retired. The JS combat
is the reference: its traces define correct behaviour until the port reproduces them.

### 8.1 Module layout (new, `native/combat/` at the repo root, beside `shell/`)

| Module | Holds | Ported from |
|---|---|---|
| `sim/tick` | the fixed 60 Hz tick, the world, event emission | `sim/world.mjs` |
| `sim/fighter`, `sim/moves` | bodies, buffer, cancels, the move table | `sim/fighter.mjs`, `sim/moves.mjs` |
| `sim/hits`, `sim/tempo` | contact, catch, block, poise, hitstop, build scaling | `sim/hits.mjs`, `sim/tempo.mjs` |
| `sim/field` | ground, ledges, terrain, flow field, projectiles, props, stealth | `sim/field.mjs` and neighbours |
| `ai/` | brains, pressure tokens, pursuit, bosses | `ai/*.mjs` |
| `inner/` | the five verbs, flaws, the Host's ice | `arena/inner*.mjs`, `data/flaws*.mjs` |
| `anim/` | animation-driven hit volumes, root motion, reaction selection | `anim/drive.mjs` and new |
| `fx/` | wounds, blood decals, aftermath, the Record writes | new |
| `present/` | the impact camera, rumble, audio events | `ui/fightcam.mjs`, `ui/fightlayer.mjs` |
| `data/` | the move, foe and boss tables as JSON | exported from `data/*.mjs` |
| `tests/` | frame data, parity, latency, flash | new |

Reusable parts (the tick, hit volumes, the trace format) go to raw-native as engine modules, so later
games use them.

### 8.2 The deterministic tick

- Fixed 60 Hz with an integer tick count. Rendering interpolates; the sim never reads wall time.
- One seeded generator, ported bit for bit from `core/rng.mjs`.
- Floats in IEEE double with contraction off (`-ffp-contract=off`, `/fp:precise`). **Risk found in
  this audit:** the JS sim and AI call `Math.sin`, `Math.cos`, `Math.atan2`, `Math.pow` or `Math.exp` at
  23 sites. Their last bit differs between V8 and a C runtime, so trace parity would fail on angles. The
  first package replaces them on both sides with one shared polynomial set before any trace is recorded.

### 8.3 Animation-driven hit volumes

Each attack clip carries tracks: capsules bound to bones, live on the clip's active markers. The sim
reads the volume at each tick from the clip's sampled pose, so what the player sees is what hits.
Startup, active and recovery come from the clip markers, and an exporter test fails if the markers and
the move table disagree. Until the authored clips exist, the current reach and arc rings stand in, and
the parity traces are taken on those.

### 8.4 Test harness

- **Frame-data test:** every move's phases, windows and leads against section 3 (T2 to T9, T13).
- **Trace parity:** the JS sim records event traces for 40 seeds over every arena, encounter and inner
  fight; the C++ sim must reproduce them exactly.
- **Latency bench:** T1 and T15 from injected input and present timestamps on the native build.
- **Captured-run checks:** reaction timing (T8), shake (T10), flash (section 4.2) and readable size
  (T12) over native captures.
- **Visual checks:** a person looks at contact sheets of each boss phase and wound tier, against the
  benchmark stills, and records a verdict with the reason.

## 9. Sources

Read 2026-10-22 unless a date is given. Wiki and modder numbers are not patch-pinned.

- Mick West, "Measuring Responsiveness in Video Games", Game Developer, 2008-07-16.
  https://www.gamedeveloper.com/design/measuring-responsiveness-in-video-games
- NVIDIA, Reflex game updates, 2023-03.
  https://www.nvidia.com/en-gb/geforce/news/march-2023-reflex-game-hardware-updates/
- Capcom, Street Fighter V column on hitstop. https://game.capcom.com/cfn/sfv/column/131545
- Sakurai on hitstop, Famitsu column 490, via Source Gaming, 2015-11-11.
  https://sourcegaming.info/2015/11/11/thoughts-on-hitstop-sakurais-famitsu-column-vol-490-1/
- Elden Ring parry and shields. https://eldenring.wiki.gg/wiki/Parry ;
  https://eldenring.wiki.gg/wiki/Small_Shields
- Elden Ring equip load and rolls. https://eldenring.wiki.fextralife.com/Equip+Load
- Elden Ring poise. https://eldenring.wiki.gg/wiki/Poise
- Elden Ring combat guide (input queue). https://www.bandainamcoent.com/news/elden-ring-introduction-part-4-combat-guide
- Sekiro deflection. https://sekiroshadowsdietwice.wiki.fextralife.com/Deflection ;
  https://www.nexusmods.com/stellarblade/articles/199
- Lies of P perfect guard. https://www.nexusmods.com/liesofp/mods/161
- No Rest for the Wicked combat. https://norestforthewicked.wiki.fextralife.com/Combat
- Path of Exile 2 dodge roll. https://sportskeeda.com/mmo/path-exile-2-poe2-dodge-roll-system-iframes
- Attack tokens (Doom 2016 via a secondary write-up), 2026-08-30.
  https://www.strayspark.studio/blog/attack-token-system-ue5-group-combat-that-feels-fair
- Squirrel Eiserloh, GDC 2016, camera shake.
  https://www.gamedeveloper.com/programming/video-sprucing-up-cameras-with-math
- The Last of Us Part II accessibility, 2020-06-09.
  https://blog.playstation.com/2020/06/09/the-last-of-us-part-ii-accessibility-features-detailed
- Review aggregates: Hades II (OpenCritic 94), Hollow Knight: Silksong (91), Mina the Hollower (Metacritic's
  top 2026 game as of May 2026), Elden Ring Nightreign (80), Black Myth: Wukong (Metacritic 82), Lies of P
  (80 to 82; Switch 2 86, 2026-08-11), No Rest for the Wicked (OpenCritic 72.9 from 18, early access).
  https://opencritic.com/game/16683/hades-ii ; https://opencritic.com/game/7425/hollow-knight-silksong ;
  https://www.nintendolife.com/news/2026/05/mina-the-hollower-is-now-metacritics-highest-rated-game-of-2026 ;
  https://opencritic.com/game/18502/elden-ring-nightreign ; https://clutchpoints.com/gaming/black-myth-wukong-review-scores ;
  https://sports.khan.co.kr/en/article/202608111016017 ; https://gameworldobserver.com/?p=24126

Not found in any source: glass-to-glass latency for the isometric benchmarks, hitstop values for any
action RPG, telegraph lead times in milliseconds, Wukong and Hades frame data, and numbers on gore or
hit-reaction counts. Those targets are ours, marked E or "our own".

## 10. Audit of the JS combat, 2026-10-23

Measured from `game/engine/combat/` at HEAD a5d8322 with a frame-table dump over every move
(`defineMoves` over COMMON, BODY, every tool class, SPECIALS, BOSS_SPECIALS, ARENA_SPECIALS: 121 moves)
and the combat suite (155 tests, 155 pass, 44 s on a loaded machine). Captures are the ones on disk
named in each row; no new capture was run.

| # | Target | Measured now | Verdict | Evidence |
|---|---|---|---|---|
| T1 | 50 ms glass to glass | Not measured. The browser bench's "Lamb shown" is 17.5 ms in play and 122.7 ms in talk, a render-job time, not glass to glass | not built | COMPLETION F5 |
| T2 | 0 frames when free | 0 | meets | F4; feel.test |
| T3 | 8-frame buffer | 8 frames, 133 ms | meets | `data/common.mjs` RULES.buffer |
| T4 | Light startup 10 to 12, heaviest 22 or less | short 10, light 11, unarmed 12, bar 14, long 16, shield 18, heavy 22 | meets | frame dump, `light_1` per class |
| T5 | Catch 8 to 10, shield 11 to 12, 24-frame lockout | light, short, bar, unarmed 7; long 8; heavy 6; shield 11; no lockout beyond the 20-frame recovery | near | frame dump, `catch` per class |
| T6 | Roll by load, safe and recovery | dash 15 safe; roll 21 safe, cancellable from 38; hop 17 safe over 110 frames; lurch 7; step 9 | near | frame dump; roll is 5 safe frames short of Elden Ring's 26, and the hop's 110 frames make heavy load a trap |
| T7 | Hitstop 0 and 2 | `FEEL.hitstop` light 0, heavy 2, cap 4 at three bodies, the caught attacker 12 | meets | `sim/hits.mjs:71`, `:92` |
| T8 | Reaction on the contact tick | Additive reactions, knockdown with bounce, wall hit; JS reads them through poseOf; same-tick start not measured | near | COMBAT-WORLD "After the fixes"; ledger A4 fails on warden clips |
| T9 | Lead 18 parryable, 30 unparryable, 36 boss | 54 tells: 16 to 48 frames, mean 25.6. Nine moves at 16 (cutter flurry, hound bite, swarm peck and snatch, holder braced). Unparryables below 30: hound pounce 23, foreman charge 26, grappler grab 28, sweeper sweep 28. Boss slams 36, roar 48 | misses | frame dump, tell start to first active frame |
| T10 | Keyed shake, 6 px heavy, 3 px under a tell | 5.5 px catch, 6.4 px charged heavy, gone in 4 to 5 frames; 3 px clamp; settings present | meets | CAMERA.md 10-21; `capture/shake-*` |
| T11 | Tokens 1, 2 at 20 s, +1 passive, max 3 | rampFrames 1200, passiveFrames 150, maxTokens 3 | meets | `ai/pressure.mjs:9` |
| T12 | 130 to 160 px | 134 to 137 px in every wired area. The inner staging frames closer: Ned is about 115 px in a 720-line capture, about 170 at 1080, a little over the band | meets | CAMERA.md 10-21; `forty-force-p1-morph-f566.png` |
| T13 | Poise model | poiseDelay 120, regen 1 a second, knockdown at -2, stagger 60 with a roll from 40 | meets | `data/common.mjs` |
| T14 | 20 or more reactions a body | Not counted; warden hook, spin and thrust have no clip | misses | ledger A4 |
| T15 | Audio on the contact tick | No sound in the shell | not built | ledger AU1, AU2 |
| T16 | 16.7 ms p95 with 6 bodies and gore | Not measured in a fight; no gore exists | not built | ledger F1 |
| G1 | Wound states | None. The only "wound" in combat code is a flaw's text in `data/flaws-will.mjs` | not built | grep for blood, wound, gore under `combat/` |
| G2 | Blood and decals | None | not built | as G1 |
| G3 | Aftermath that persists | `struck.<char>` and `fought.<id>` written; bodies and blood do not persist | near | SYSTEMS-FULL 18.10 |
| G4 | Inner arena bosses as shipped art | Flat 2D forms with almost no animation; the tell rings read clearly | misses | ledger A9; the staging capture above, looked at by the director |
| B1 | Boss grammar | Pattern, rests, phases and shown virtue names exist for 7 of 12 inner bosses and the Host as data | near | ledger S18; inner tests |
| X1 | Story setting and fight speed | Not built | not built | ledger X15 |
| X2 | Remap | Fight actions remap; shell actions fixed | near | ledger C4 |
| N1 | Native combat | None; trace parity cannot start until the libm calls are replaced | not built | 23 `Math.sin`, `cos`, `atan2`, `pow` or `exp` sites in `sim/` and `ai/` |

**Headline.** The JS combat's core timing is close to the best of the benchmarks: a 0-frame start, an
8-frame buffer, fast light strikes, a keyed shake and attack tokens all meet the targets. It misses on
what a player sees and feels around the timing: telegraphs too short at isometric distance (nine moves
at 16 frames, four unparryables under 30), no wounds or blood at all, too few hit reactions, inner
bosses that are not yet art, and no sound. Glass-to-glass latency has never been measured.

## 11. Work plan for the C++ port

One package is one agent run of 30 turns. Packages in the same wave own disjoint files and can run in
parallel. The JS combat stays playable for content until P12.

| ID | Package | Owns | Entry | Exit check | Wave |
|---|---|---|---|---|---|
| P0 | Shared math, and combat events in the run traces | `combat/sim/math.mjs` (new), the 23 call sites, `combat/tools/trace.mjs` (new, writing the JSON-lines format of `tools/tracer.mjs` from commit 8366a8b) | 155 combat tests pass | Tests pass; traces for 40 seeds over every arena and encounter are byte-identical across two runs | 1 |
| P1 | Data export to JSON with a schema | `combat/tools/export-data.mjs` (new), `native/combat/data/` | P0 | Round trip: JSON loaded back in JS gives the same traces | 1 |
| P2 | Telegraph retune in the JS data (T9) and the catch lockout (T5) | `combat/data/foes.mjs`, `archetypes.mjs`, `bosses.mjs`, `sim/hits.mjs` catch path | P0 traces recorded first, then re-recorded | Frame-data test for T5 and T9 passes; doorbench and arena fair-win rates move less than 5 points | 1 |
| P3 | C++ tick, fighter, moves, buffer | `native/combat/sim/{tick,fighter,moves}`, CMake | P1 | Frame-data test passes in C++; parity on movement-only traces | 2 |
| P4 | C++ hits, catch, block, poise, tempo | `native/combat/sim/{hits,tempo}` | P3 | Parity on duel traces | 3 |
| P5 | C++ field, terrain, projectiles, props, stealth | `native/combat/sim/field*` | P3 | Parity on plate and hazard traces | 3 |
| P6 | C++ AI and pressure | `native/combat/ai/` | P4, P5 | Parity on every arena trace; token soak | 4 |
| P7 | Hit volumes from clips | `native/combat/anim/`, raw-native clip-marker module | P3; first authored clips from the character lead | Marker and move-table test; reach and arc within 5 % of the rings | 4 |
| P8 | Wounds, blood, aftermath | `native/combat/fx/`, the Record writes | P4 | Wound test per tool and region; flashcheck 0 general flashes; gore settings test | 5 |
| P9 | Impact presentation and the latency bench | `native/combat/present/`, `native/combat/tests/latency` | P4 | T1 50 ms median on the reference machine; T10 offsets match the JS capture within 1 px | 5 |
| P10 | Inner arena in C++ | `native/combat/inner/` | P6 | Parity on the 17 inner fights; flawcheck, forcecheck, notallycheck ported and passing | 5 |
| P11 | Six class move sets | `native/combat/data/classes/` | P4 | Frame-data test per class; a harness fight per class with each way out taken | 6 |
| P12 | Audio events and haptics | `native/combat/present/audio` | P9, the audio lead's mixer | T15 under 30 ms; one sound per tool class and material | 6 |
| P13 | Settings: story setting, fight speed, assists, gore | the native settings module, `native/combat/sim/speed` | P9, the native UI | Settings test lists every row of section 6; doorbench at each fight speed | 6 |

The reaction clips (T14) and the inner bosses as art (G4) belong to the character lead's asset work
under D1. P7 and P8 consume them.

## 12. The inner fights, 2026-10-23

Each inner boss is one of the character's flaws given a body, and the flaw shows in how it fights: what it does to the player, where it stands, what the ground does round it. The author, 2026-10-23: "attack patterns, timing, special attacks, and arena mechanics are important, and the combat should be real and palpable", and "Bookkeeping should not be a part of the plot". So no fight reads, checks or keeps a record: there is no sheet to read, no doubt counter, no row to name and no ledger, stamp or tally in a moveset. Force ends every fight (5.2, 12.1). The ways through without force are optional layers that open once the boss is in its second phase.

| Fight | The flaw | How the moveset and the arena carry it | The optional layer (not the main way through) |
|---|---|---|---|
| Fond of Them (era 1) | Courtesy that covers contempt | A host who duels with good manners: he catches a careless blow and the catch heals him, then ripostes; his plates come down the table and his bow is a grab. Bait the catch, then punish its long recovery | Leave by the barn door (`refuse`), or survive twelve of his strings without a blow (`endure`) |
| Received and Found Correct (era 2) | Doing as he is told | A heavy man who fights from behind his desk: cuff strings with a held cuff, a guard-breaking hammer-fist, a seize; two men in coats come in at his call; plaster comes down where the player stands, and the room closes on the desk | Put the case down and outlast the night (`yield`) |
| Only What They Send (era 2) | Smallness as an excuse | A chairman and eleven coats: the coats sit until called, crowd the player and strike at once on his clap; the gavel breaks a guard; the vote sweeps the long table | Leave by the door (`refuse`) |
| Never Once (Friday, era 2) | The father's hand | Quick backhands, a reach that grabs and a lean that holds; the table slam sends a shock down the table; he grows each phase and the kitchen closes round him | None: force or the loss |
| He's With Me (era 2) | Keeping someone by owning him | A clay guard that grows by phase: heavy fists, a hold, a charge that dazes it on the wall, a stomp that rings out; the yard closes ring by ring | Put the stick down and rub the word from its brow under its blows (`yield`) |
| Nearest One (era 2) | Doing the harm before someone else can | A beast in the granary's maze: gore strings, unparryable horns, a charge that dazes it on the stacks, a pounce; sacks fall in the last phase | Open the hand and let the thread go; it passes him by (`yield`) |
| Forty Carts (era 2) | Being one of many | The pole on the road post: thrust strings, a hook that pulls the player in, a drag to the district line; carts run the road in lanes and the road freezes | Lift the pole and outlast its drags (`yield`) |
| Nobody Checks (the Descent) | Show over substance | A stack of sacks with a painted front: front blows glance, it shoves, bashes and crushes, and topples sacks round the player | Survive its rounds without a blow (`endure`) |
| Under the Goats (era 2; era 4 for Ann) | Envy | A low, heavy thing in a mud fold: its pits slow the player, its burial pins him, it dives into the mud and comes up under him, and more of the fold turns to pit each phase | Put the spade down and stand on the bare rock by the lantern, under its blows (`yield`) |
| The Long Barn (era 2; era 4 for Ruth) | Hoarding | A grappler the size of a barn in a granary that falls in: its drag hauls the player to the throat, its hug crushes, its charge dazes it on a wall, beams fall (they hurt it too), and in its last phase the floor goes from the far end | Stand in its throat and do not feed it until the whistle stops (`endure: stand`) |
| The Figure (era 3) | A son defending his father by turning on himself | A mirror duelist stitched from sacking: it answers the player's last string with the same string, tells drawn out; its signature sends a shock across the floor; the floor freezes and the ice cracks in rings | Survive three of its rounds without a blow (`endure`) |
| Order (era 5) | Order as a reason for force | A riot shield whose front blows glance, so the player has to get round it; each phase walls off more of the street; it bashes and drags to clear room and calls constables; its signature drives the shield line down the street | Drop the baton and outlast three of its drags (`yield`) |
| Everybody Says (era 5) | Passing it on | A crowd boss: the notice calls heads that close round the player (four at most) and strike on each other's cue; its signature lays a line of posts across the verge; breaking the leader sends the heads home | Stand at the stone, striking nothing, until the heads go quiet (`endure: stand`) |
| The Descent (era 5) | What was beaten comes back | Only the flaws the run beat by force come back, ring by ring in era order, each in its last phase, on ground that narrows ring by ring. A flaw ended without force leaves an empty ring of snow | The snow rings are walked |
| The Adversary (era 5) | All of it at once | Three fights (5.2): the Accuser fights from his desk with a cane and closes fast; the Host fights with the run's kept lies as limbs on spreading ice; the One Who Withdraws strikes and goes | Stand still once the fight is joined (the Accuser lets him go); face each limb, standing under its blows for 1.5 s (`name`); face the One Who Withdraws when it comes |

### 12.1 The inner bosses as fights, 2026-10-23

The rework replaced every rule that kept force from working (a floor, a meant-to-lose, a force ending that was not a fall, blows that healed, slowed, swallowed or proved the lie) with a moveset in the grammar of 5.2 (combat/data/fights-a.mjs, fights-b.mjs, fights-host.mjs; the brain combat/ai/duel.mjs; the ground combat/arena/innerhaz.mjs). The old on-strike rules are removed from the code as well as the data, so no data edit can bring them back.

Measured by combat/tools/innerduel.mjs over 12 seeds (recorded in combat/tests/innerduel.json, checked by combat/tests/innerduel.test.mjs). The skilled player is the arena's scripted pilot (it reads every tell and floor mark, catches, rolls and punishes, and works on the leader when it is in reach); the unskilled one walks in and swings and never defends. Targets: the skilled player down in half the attempts or fewer, the unskilled in 70% or more, the kill in 60 to 180 s. The race is the damage each side deals a second over the fight, the player's then the boss's (the player has 16 Standing).

| Boss | Moveset (every tell meets T9) | The arena | Skilled ttk | Race (skilled) | Down: skilled, unskilled |
|---|---|---|---|---|---|
| Fond of Them | jab, cut, held cut, bow-lunge, thrown plate, catch (heals him) and riposte, bow (grab), table sweep, toast (signature, a ring of plates round him) | the long table: a lane down it from the second phase; plates fall round the player in the third | 127 s | 0.73 / 0.09 | 0, 0.92 |
| Under the Goats | spade swing, held swing, heave (all round), mud fling (three marks), dive (safe frames under the mud, up under the player), burial (grab), the heap (signature, a sinkhole under the player) | mud pits from the first phase, more each phase; pits collapse at the dig places (they hurt it too) | 99 s | 1.01 / 0.13 | 0.17, 1 |
| The Long Barn | slap, rib (unparryable), held rib, drag to the throat (grab at range), hug (grab), charge that dazes it on a wall, the whistle (signature, a lane down the floor) | beams fall from the second phase (they hurt it too); in the last the far end of the floor goes | 121 s | 0.99 / 0.12 | 0.25, 1 |
| The Figure | jab, hook, held jab, step (lunge), grab, the player's own last string answered in kind (light, heavy, charged), quake (signature, a lane) | the floor freezes in the second phase and wholly in the third; the ice cracks in rings round the player | 104 s | 0.98 / 0.12 | 0.33, 1 |
| Everybody Says | push, held push, sink (unparryable), throng (lunge), grab, post (two heads, four at most), chorus (the heads' next blows at once), spread (signature, a lane of posts) | the heads close round the player; the verge narrows in the last phase | 88 s | 0.64 / 0.14 | 0.25, 0.92 |
| Order | baton, backhand, held baton, bash (unparryable lunge), sweep, drag to the van (grab), call (two constables), the line (signature, a lane) | front blows glance off the shield; each phase walls off more of the street | 92 s | 1.04 / 0.13 | 0.25, 1 |
| Received and Found Correct | cuff, backhand, held cuff, hammer-fist (unparryable), sweep (all round), lunge, seize (grab), call (two men in coats), quake (signature, plaster falls) | plaster falls round the player in the last phase; the room closes on the desk | 112 s | 0.84 / 0.13 | 0.33, 1 |
| Only What They Send | press, second press, held press, gavel (unparryable), motion (lunge), chair (grab), seat (two coats), clap (the coats' next blows at once), vote (signature, a lane down the table) | the coats crowd the player; the door stays for the refusal | 93 s | 0.86 / 0.17 | 0.42, 0.75 |
| Never Once (Friday) | backhand, cuff, overhead (unparryable), held overhead, reach (grab), lean (a long grab), table slam (signature, a lane down the table), belt (signature, long reach) | the kitchen closes round him in the last phase; he grows each phase | 106 s | 1.07 / 0.15 | 0.42, 1 |
| He's With Me | fist, second fist, held fist, sweep, hold (grab), charge that dazes it on a wall, stomp (signature, a ring) | the yard closes one ring, then two; the clay grows each phase | 91 s | 1.2 / 0.14 | 0.25, 1 |
| Nearest One | gore, second gore, held gore, horns (unparryable, puts him down), charge that dazes it on the stacks, pounce (grab), bellow (signature, sacks fall) | the maze's corridors; sacks fall round the player in the last phase (they hurt it too) | 105 s | 0.93 / 0.14 | 0.33, 1 |
| Forty Carts | thrust, second thrust, held thrust, hook (pulls in, unparryable), sweep, drag to the line (grab), whistle (signature, a cart down the road) | carts run the road in lanes from the second phase; the road freezes, then wholly | 95 s | 1.05 / 0.12 | 0, 1 |
| Nobody Checks (the Descent) | shove, held shove, bash (unparryable lunge), slam, sweep, crush (grab), topple (signature, sacks fall round the player) | front blows glance off the painted front | 123 s | 0.78 / 0.1 | 0.17, 1 |
| The Accuser | cane, second cane, held cane, hammer-fist (unparryable), step (lunge), clinch (grab), drive (signature, a lane of cracked ice) | the ice; the lamp | 77 s | 1.18 / 0.15 | 0.08, 1 |
| The Host | claw, second claw, held claw, stride (lunge), sweep, grip (grab), wing (signature, a ring); its kept lies fight beside it as limbs | the ice spreads each phase and cracks in rings round the player | 119 s | 1.12 / 0.08 | 0, 1 |
| The One Who Withdraws | cut, second cut, held cut, go (out of reach with safe frames), come (a lunge from range with safe frames), take (grab), whisper (signature, a ring) | the empty yard; it holds the range | 66 s | 1.2 / 0.18 | 0.08, 1 |

Each boss's numbers carry a tuning factor (`tune` in its fight record; the common scale is combat/data/fights.mjs TUNE) set against this measure. The hands a boss calls in have their own blows scaled for the fight.

### 12.2 The prop on every ground

Every inner ground holds one heavy thing standing on open floor away from the fight's anchor (combat/data/props.mjs: the stove, the pump, the lamp post, the pillar and so on). A committed blow (one that breaks a guard, carries the boss forward or seizes) that brings the boss's body onto the prop in its active frames smashes it, and the boss reels for 120 frames (`inner.reel`, combat/arena/innerprop.mjs). That is a punish window the player earns by spacing: stand with the prop at his back, draw the lunge or the charge, roll clear. The prop stands again at the start of each phase. A jab does not smash it. It replaced the true-account sheet of the first rework.

**Does not prove.** The scripted players are instruments, not people: the skilled pilot is better at some fights than a person would be (it reads every floor mark the frame it is laid) and worse at others (it fought crowds poorly until it was told to work on the leader). The pilot does not bait the prop, so the prop broke once in the sixteen scripted runs and the measure above barely moved when it was added; what the prop is worth to a player who uses it is not measured. The measure says the fights are winnable by careful play and deadly to careless play in this simulator; it does not say they feel fair, hard or satisfying. That needs the browser capture checked by eye (done for five fights on 2026-10-23, before the prop) and the author's playtesters.

**Rules that hold across the inner fights.**
- No badges, scores or counts of flaws beaten (the inner run's no-tally rule: notallycheck).
- No fight reads, checks or keeps a record, and no move, hazard, bark or ending beat is about one.

## Does not prove

- No benchmark game was played or measured by us. Benchmark numbers come from wikis, modders and
  publisher statements, and several were not found at all.
- The audit reads frame data from the code and uses captures already on disk. Nobody played the fights
  at speed for this spec, so the feel verdicts on T8 and G4 are from stills.
- Meeting every target here does not make the combat better than the benchmarks. Reviews and players
  decide that. The targets make the gaps measurable.
