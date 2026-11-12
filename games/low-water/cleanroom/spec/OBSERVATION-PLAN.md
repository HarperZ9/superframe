<!-- writing-profile: procedure -->
# Observation plan (Phase 2)

Version 1, 2026-10-16. The measurements that public sources could not supply, grouped per game, in
priority order: No Rest for the Wicked combat first, then character presentation, then Disco Elysium,
then ZERO PARADES. Target: four sessions, each under 45 minutes of game time.

## 0. Rules and setup

### 0.1 Before any session

1. Confirm the GPU lock does not exist. If it exists and names another owner, stop.
2. Take the lock with this role's own token (`cleanroom-study-<pid>-<unix>`), following the lock protocol the coordinator names. Record the token in `cleanroom/PROGRESS.md`.
3. Hold the lock only while a game runs. Release it the moment the game closes. The explainer 4K render waits on 30 free minutes.
4. Never delete, overwrite or load over the author's saves. Start a new character or a new game in a new slot. Back up the save folder (for example `%USERPROFILE%/AppData/LocalLow/Moon Studios/`) to `E:/cleanroom-dirty/low-water/<game>/save-backup-<date>/` first, read-only copy.
5. Captures go to `E:/cleanroom-dirty/low-water/<game>/capture/`. They never enter the Low Water folder or any repo. Only numbers and my own descriptions reach the specs.

### 0.2 Capture

- Record the game window at 60 fps, constant frame rate, 1920x1080, lossless or near-lossless (CQP 16 or lower) so single frames are clean. OBS Studio is installed; use a separate scene collection and profile named `cleanroom` so the author's profile stays untouched (creating that profile is a settings change; ask first if no one has approved it).
- Lock the game to 60 fps with V-sync or its frame cap, so one captured frame equals one game frame. Check this first: record 10 s of idle with an on-screen timer or a known loop and confirm no duplicated or dropped frames (count unique frames).
- Show inputs in the capture: a keyboard and controller overlay (a small on-screen input display) or a keypress log with a timestamp aligned to the video by a sync flash at the start (press a key that produces an instant visible change, such as opening the menu).
- Disable motion blur and camera shake options only for a second pass; the first pass records defaults, because feel is the default.

### 0.3 Frame-stepping method

1. Open the capture in a frame-accurate viewer or step it with OpenCV (installed: cv2 5.0.0) writing each frame number on screen.
2. **Startup:** first frame the input appears in the overlay to the first frame of visible motion: that is input latency plus startup. Measure input latency once with a menu action that has no animation (cursor move) and subtract it.
3. **Active:** first frame the hit lands (the target flinches or a damage number or spark appears) to the last frame a target can be hit. For the active window, place a target at several distances and timings and record hits and misses (bisection).
4. **Recovery:** frame after the last active frame to the first frame a new action changes the pose (test by mashing the next action and noting when it comes out).
5. **Invulnerability:** stand in a repeating enemy attack and dodge at varied offsets. For each try record the frame offset between dodge start and the enemy's contact frame and whether damage was taken. The invulnerable window is the span of offsets that never take damage. Ten to twenty tries per dodge type.
6. **Distance:** measure in character heights from the capture: pixel displacement of the feet divided by the character's standing height in pixels at the same screen location.
7. **Bars:** stamina and focus as a fraction of bar width in pixels, before and after the action, three repetitions.
8. Write every number as median plus range over repetitions, with n.

## 1. No Rest for the Wicked: combat (session A, priority)

Setting: a new character in the opening area, light enemies available; and a second pass against
tougher enemies with a sword-and-shield and a two-handed weapon.

| # | Do | Record |
|---|---|---|
| A1 | Strip to light load. Dodge 10 times in open ground with stick held, and 5 with no stick | Total frames, distance, direction rule with no stick, stamina per dodge |
| A2 | Same at normal load and heavy load | Same, plus slide-out frames for the roll and get-up frames for heavy |
| A3 | Dodge through a repeating enemy swing at varied offsets (method 0.3.5), each load band | Invulnerability start and end frames |
| A4 | Dodge, then press attack and dodge early during the recovery | Earliest frame the next action comes out; buffer window |
| A5 | With a one-handed sword: light string to the end; light then dodge at each swing | Swings per string; startup, active, recovery per swing; dodge-cancel frame per swing; forward step per swing |
| A6 | Same with a two-handed weapon, plus heavy charged at minimum and maximum hold | Same, plus charge levels, hold limits, armour during charge (hit the player during charge) |
| A7 | Spend stamina to zero with attacks; then wait | Regen delay frames, regen rate, behaviour at zero |
| A8 | Hold block for 5 s, and block a light and a heavy enemy hit | Drain per second, cost per hit, guard break at zero |
| A9 | Parry 20 attempts against one enemy at varied timing | Parry startup, window frames (bisection), whiff recovery, enemy stagger frames, focus gained |
| A10 | Backstab: from a parried enemy and from stealth | Prompt condition, animation length, invulnerability during it |
| A11 | Hit three sizes of enemy repeatedly with light attacks, pausing 0, 3, 5, 10 s between hits | Hits to stagger; whether the count resets after a pause |
| A12 | Let a poise-breaking enemy knock the player down | Knockdown frames, get-up invulnerability, whether dodge can leave the get-up |
| A13 | Record five enemy types attacking repeatedly | Tell-to-active frames per attack, lunge distance, tracking cutoff (dodge early and late), punish window after a whiff, unblockable markers, how many enemies attack at once |
| A14 | Lock on and off, switch targets, dodge under lock | Acquire range and cone, switch input, dodge direction rule under lock, camera behaviour |
| A15 | Single light hit, heavy hit, parry, backstab, kill, player hit, each 3 times | Hit-stop frames (count frozen frames on attacker and target separately), shake amplitude in px and duration, flash colour and frames, VFX spawn frame vs contact, audio layers (describe), rumble on/off |

Output: replace each "measure" in `COMBAT-FEEL.md` with median, range and n, tag [M], and append a
dated line to `cleanroom/PROGRESS.md`.

## 2. Character presentation (session B, about 15 minutes per game, can ride along with A, C, D)

For each game, three locations (street or open ground, interior, large exterior):

| # | Do | Record |
|---|---|---|
| B1 | Stand still, then walk, then run across the screen | Character height in px, walk and run cycle frames, stride in body heights |
| B2 | Turn 180 degrees from standing and while running | Turn frames, snap or blend |
| B3 | Idle 30 s | Idle loop length, variant idles |
| B4 | Find a floor with straight lines | Camera pitch (vanishing-point check), projection, zoom range |
| B5 | Stand next to another figure, in light and in shadow | How the two are separated (rim, outline, value); screenshot pair |
| B6 | Open a conversation | Portrait size as % of screen height, framing, whether it animates or changes with mood, how the scene behind dims or blurs |
| B7 | ZERO PARADES only: enter a tense set piece | Transition frames, colour drain curve, camera move, how choices are shown |
| B8 | A crowd at distance | Drawn as full figures, low-detail figures, or painted groups |

## 3. Disco Elysium: dialogue (session C, about 30 minutes)

| # | Do | Record |
|---|---|---|
| C1 | Note the clock, read 10 lines in one conversation, note the clock; then walk for 60 s | Minutes per line or per topic; walking cost |
| C2 | Hover a retryable and a one-shot check | What the check preview shows (difficulty band, percent, itemised modifiers), layout description in my own words |
| C3 | Fail a retryable check; then change one thing named in its modifier list and return | How the reopened check is signalled |
| C4 | Count inner-voice interjections in one 5-minute conversation | Voices per minute; how often a voice speaks below its threshold |
| C5 | Take a belief; check its research time against the clock | Time to complete, what changes during and after, presentation of the completion |
| C6 | Take health or morale damage | Feedback (sound, screen, text), what happens near zero |
| C7 | Text column | Width as % of screen, scroll behaviour, how speaker tags and choices are set apart, line reveal speed |

## 4. ZERO PARADES: pressure systems (session D, about 30 minutes)

| # | Do | Record |
|---|---|---|
| D1 | Read the three meters at the start; fail a check of each faculty | Meter gain per failure |
| D2 | Push a check | Bonus shown, meter cost, whether pushes stack |
| D3 | Raise one meter near full | Where the lockout starts; how it is shown |
| D4 | Use a recovery ritual | Amount recovered, time cost |
| D5 | Take a belief; break its rule | Slot count, suspension length, penalty shown |
| D6 | Wear a different outfit near a person who comments | Skill changes; reaction behaviour |
| D7 | Enter a tense set piece | Rounds, choices per round, check resolution, what a failure does, how cover or a contact is affected |
| D8 | Note the clock across 10 lines and one sleep | Time cost per line; day change behaviour |

## 5. After each session

Close the game, release the lock, record the release time in `cleanroom/PROGRESS.md`, update the spec
the session served, and keep every capture in `E:/cleanroom-dirty/`.

## 6. Version 2 update (2026-10-17): what the data already answered

The unpack answered most of the frame data. A session now only needs to confirm feel and measure what
lives in presentation or run-time state.

Answered from data (no capture needed): dodge lengths, invulnerability, distances, stamina costs and
regeneration (A1 to A4, A7); attack frame data, buffers, combo and cancel windows for 17 classes (A5, A6);
block and parry values (A8, A9); poise and stagger meters (A11); player hit reactions and get-up (A12);
enemy startup distribution and telegraph retiming (A13); lock-on and camera numbers (A14); Disco Elysium
per-line time, check structure and belief times (C1, C2, C5); ZERO PARADES pressure scale, push cost,
lockout, rituals, belief timers and set-piece structure (D1 to D5, D7, D8 in part).

Still needs a capture, in priority order:

1. No Rest for the Wicked: hit-stop (confirm none), camera shake amplitude and duration, rumble, VFX timing
   (A15); real input latency; parried-enemy opening for three enemy sizes; whether enemy hit-volume times
   are before or after the time-scale retiming (compare a slowed telegraph's contact frame with the data);
   on-screen character height and camera distance (B1, B4).
2. All three: the presentation grid in `CHARACTER-PRESENTATION.md` section 4 (figure height, walk and run
   cycles in pixels, portrait size, figure separation).
3. ZERO PARADES: gameplay camera angle and zoom; set-piece transition frames (B7); persona credibility
   feedback.
4. Disco Elysium: check-preview layout and text-column metrics (C7), health and morale damage feedback (C6).

New session length estimate: about 20 minutes for No Rest for the Wicked and 10 minutes each for the other
two.
