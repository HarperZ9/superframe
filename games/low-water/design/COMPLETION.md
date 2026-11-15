<!-- writing-profile: research -->
# Low Water: the completion ledger

Ledger keeper, 2026-10-22. This file is self-contained: a session that has lost its context can
pick up the work from here alone. It defines "complete", lists every criterion with a check that can
fail, records the status measured today, and orders the remaining work into waves of agent runs.

**The author's words this ledger serves**, verbatim, 2026-10-22: "Do not stop until we have a complete
compiled game, and complete story. The UI, Controls, Movement, Animations, Accessibility, Fluidity, and
Mechanics should be feature complete ... We aim for maximal output, and maximum quality and rigor,
attention to detail, and creativity." Also: "Be rigorous".

**What the game is.** The project folder is Low Water. The game it ships is the Quota spine adopted on
2026-10-22: "the boy who did not come home" (Tomas Haldane), five eras of Edrin's Upper Town, working
title *The Prayer for the Water* (design/spine-plan/DECISIONS-2026-10-22.md, decision 5). The Gullet acts
(content/act1 to act3, Lamb) are cut and archived in place (design/quota/06-KEEP-CUT.md). The engine runs
in a browser today (ES modules, workers, canvas, WebGL2, localStorage). The target is a Steam release.

## How to use this ledger

- **Status words.** PASS: the check ran and passed today. FAIL: the check ran and failed, or the thing
  exists and is wrong. PARTIAL: part is built or passing, and the row says which part. NOT BUILT: the
  thing, or the check for it, does not exist yet.
- **Checks.** Each row names a check that can fail: a test, a checker in `game/engine/tools/`, a capture
  plus a look, or a timed measurement. "New" means the check itself is a deliverable.
- **Updating.** A package that closes a row edits that row's status and evidence in the same commit as
  its work, and adds a dated line to the measurement record (section 5). A row moves to PASS only on a
  check run, never on a claim in a progress note.
- **Paths** are relative to `games/low-water/` unless they start with a drive.
  Commands in section 5 run from `game/engine/` with `LW_STORY=quota` unless marked.

## Measurement conditions, 2026-10-22

- dev at `bd2566e` (17:14 local), with other agents' uncommitted edits in the working tree
  (content/quota/q_discourse.lwd, game/engine/ui/play.mjs, world/discourse.mjs, world/verbs.mjs,
  characters/cast/sculpt*.mjs and more). Every result below is of the working tree as it stood.
- The machine was busy: the frame bench measured 96.4 % load before its run and 84.7 % after, so every
  frame time here is labelled NOT QUIET.
- Browser runs used a private server on port 8791 (`node game/serve.mjs --port 8791`) and the headless
  shell at `%LOCALAPPDATA%/ms-playwright/chromium_headless_shell-1243`. Captures went to the session
  scratchpad, which is not kept; section 5 gives the command that reproduces each one.

## Headline

| Status | Rows |
|---|---|
| PASS | 40 |
| PARTIAL | 34 |
| FAIL | 15 |
| NOT BUILT | 59 |
| **Total** | **148** |

Most PASS rows are era 2's checkers and the engine's tests. Most NOT BUILT rows are the platform, the
four missing eras, accessibility settings and checks, audio and the store.

**Story: one era of five exists, and it is partial.** Era 2 (The Quota) is written to the spine and plays
to its witness scene on both built classes: 22 files in `content/quota/`, 194 nodes, all reachable, 971
spoken lines, 71 to 88 minutes a play (playtime middle estimate; budget 85). Eras 1, 3, 4 and 5 have
design beats only (design/quota/03-STORY.md) and no content, plates, cast or wiring. The game's ending
(era 5, resolved by testimony) does not exist. By the runtime budget of 320 minutes, about a quarter of
the story is built.

**Compiled game: none.** There is no native shell, no installer, no saves on disk, and no Deck build.
The game is a browser page.

---

## 1. A complete compiled game

**Definition.** A native Windows program that installs from Steam, starts without a browser, keeps its
saves, settings and world record on disk, and plays from boot to the game's ending in one sitting or
across quits, on a desktop and on a Steam Deck, with no stall, no error and nothing a player can lose.

| ID | Criterion | Check | Status | Evidence |
|---|---|---|---|---|
| B1 | A native Windows executable hosts the game: own window, no browser chrome, works offline, ships no third-party runtime beyond the OS web view (STEAM-READINESS section 2, option A) | New: `shell/` build plus a smoke test that launches the exe, waits for the title, and exits clean, timed | NOT BUILT | No shell source in the tree; no file names WebView2 or steam_api (grep over *.mjs, *.cpp, *.h, *.json) |
| B2 | A depot builder ships only what the game reads (plates, geo buffers, place.json, fonts, scripts) and reports the size | New: `tools/package.mjs` with a manifest, a size report, and a scan that fails on .env, logs, captures, `render/` sources or `content/act*` | NOT BUILT | `content/` is 1.6 GB and `render/` 8.1 GB on disk (du, today) |
| B3 | Every shipped asset is reproducible from a clean clone: place files tracked, plates rebuilt from `content/PLATES.lock` | New: clone to a scratch folder, rebake from the lock, diff against the working tree | FAIL | `git ls-files 'content/q_*'` returns 0 files: the place.json of all 21 locked Quota plates is untracked |
| B4 | Saves, settings and the world record on disk: one file per slot, written to a temp name and renamed, the last good copy kept as `.bak`, read back after write | New: `tests/filestore.test.mjs`, with controls (a truncated file falls back to `.bak`; a write killed mid-way leaves the old save) | PARTIAL | JS side built and checked, 2026-10-23: save/filestore.mjs, tests/filestore.test.mjs 11 of 11; a corrupted save is detected and a missing file falls back to `.bak`, with plain files, tools/worldfile.mjs and the store with sums off failing as they must; a write killed at each step leaves a whole live file. In headless Chromium a fake bridge got the page's saves and world record as files. Not yet on disk in a build: the shell's bridge (W1-D, W2-E) |
| B5 | Old saves upgrade on load | `tests/save.test.mjs`, `tests/witness.test.mjs` (v4 read-back migrates to the v5 witness) | PASS | SAVE_VERSION 5 with migrations 0 to 4 (save/save.mjs:17-58); engine tests 290 of 290 |
| B6 | A crash writes a local report (build id, last 200 beats, slot, error) and shows one plain screen; nothing is sent | New: a planted throw in a worker and in the page each leave a report | PASS | 2026-10-23: ui/crash.mjs; tests/filestore.test.mjs plants throws in the page, a worker and a promise; in headless Chromium a throw in the page and one in a real worker each left a scrubbed report and the screen showed. The build id reads "dev" until B8 |
| B7 | Window and display: fullscreen, borderless, windowed; resolution follows the window; vsync; frame cap 30, 60 or uncapped; pause on focus loss | Shell smoke test per mode, captured | PARTIAL | Pause on focus loss exists (ui/settings.mjs, "Pause when the window loses focus"); the rest needs the shell |
| B8 | A build id shown on the title and in every crash report and save | Capture of the title; grep in a save | NOT BUILT | No build id in ui/title.mjs |
| B9 | Steam Deck: the Windows build runs under Proton at 30 frames a second or better at 1280 x 800, pad only, text legible, no launcher | Deck spike: timed run plus Valve's Deck checklist, item by item, with captures | NOT BUILT | No Deck run recorded. Note: "Verified" is Valve's grant after its own review; the team can only meet the checklist. STEAM-READINESS section 2 recommends "Playable" at launch |
| B10 | Steamworks: achievements and rich presence load when `steam_api64.dll` is present; the game runs without it | Shell test with the DLL removed and present | NOT BUILT | No Steamworks code |
| B11 | Full playthrough in the harness, boot to the game's ending, every build and route, no stall | `playthrough.mjs --build all --shuffle 3` plus random seeds | PARTIAL | Era 2 only: inspector 3 of 3 and militia 3 of 3 FINISHED, random 10 of 10 FINISHED (today). The game's ending (era 5) does not exist |
| B12 | Full playthrough in the browser shell, by clicks, both classes, boot to the ending, 0 stalls, 0 page errors | `tools/quota-shell.mjs --class 1` and `--class 2` | PARTIAL | Era 2 only: class 1, 32 steps, 1 fight, ended; class 2, 30 steps, 1 fight, ended; 0 stalls, 0 errors, 6 and 7 warnings (section 5). No boot sequence on dev, so the run starts at the title |
| B13 | Full playthrough in the native build: save mid-run, quit, relaunch, continue, finish; world record carried to a second run | New: shell-driven run with a forced quit | NOT BUILT | Needs B1 and B4 |
| B14 | People who have not read the design finish it: playtest rounds 0 to 2 (STEAM-READINESS 1.1), with the success criteria written there | The author's playtest notes and the local session logs | NOT BUILT | No playtest has run |

## 2. A complete story

**Definition.** Every era of the adopted spine (the boy who did not come home; eras 1 to 5) is written,
wired to places, and playable to the game's ending, with: every fate decided in a written scene by a
named person; a witness scene closing each era (era 2's is Anni at forty, the read-back's replacement);
H1 and H2 as written scenes; the inner arena reachable from the story; the ending resolved by testimony;
every line to design/DIALOGUE-STANDARD.md. Era beats: design/quota/03-STORY.md. Witness roster:
design/spine-plan/02-WITNESS.md section 1. Fates: design/spine-plan/03-FATES.md. Decisions:
design/spine-plan/DECISIONS-2026-10-22.md.

| ID | Criterion | Check | Status | Evidence |
|---|---|---|---|---|
| S1 | Era 1, The Exchange (year 0): census hinge, Ilo named at the census table, harvest supper, the new table; its witness (Ilo at the Sheaf) | validate 0 errors over the era's files; harness FINISHED on every class; witnesscheck; fatecheck | NOT BUILT | No era 1 content; 03-STORY.md:28-41 beats only |
| S2 | Era 2, The Quota (year 12), to the spine | validate, harness, fatecheck, witnesscheck, lorecheck, propcheck, playtime within 85 min | PARTIAL | Built: 22 files, 194 nodes, 194 reachable, 0 errors, 0 warnings; harness and shell finish on both classes; play 71 to 88 min. Missing: 4 of the 6 classes (M2 in quota/07-PRODUCTION.md), Dorrah and Ilo on the hill, the "house" perspective pair, the author's approval of sample lines, two cold reads (06-BUILD.md phase 3) |
| S3 | Era 3, Allocation (year 20): allocation hinge, schoolbook, shift table, the fever, Anni names a goat-Hesh family, Bet dies in the fever; its witness (Aaron grown) | As S1 | NOT BUILT | 03-STORY.md:82-94 beats only |
| S4 | Era 4, The Closure (year 70): board meeting, Kasem Saro, "the pit" pair, closure night; its witness (Mira Saro) | As S1 | NOT BUILT | 03-STORY.md:96-110 beats only |
| S5 | Era 5, The Clearance (year 115): the clip with Danil Saro dead and denied, the movement choice, the vote, Mara and Frank Mott (the grandfather's page), the clearance-day fight, the ending by testimony | As S1, plus lorecheck's carried-word chains (06-BUILD.md phase 5) | NOT BUILT | 03-STORY.md:112-129 beats; 05-STRUCTURE.md section 2 |
| S6 | Cold open: Anni at forty shuts the tin | Harness beat log reaches it on every run | PASS | First beat of every run is q.start.class with the kitchen and the tin (beat log, section 5) |
| S7 | The witness scene, era 2: Anni at forty, the old man at her table, unskippable, no verdict, ends on an effect | `witnesscheck.mjs`; `tests/witness.test.mjs`, `tests/witnesspace.test.mjs`; still of the end | PASS | witnesscheck: 30 scenes in 30 runs, 11 of 11 beats, 0 errors, 0 warnings; shell still at THE END in Anni's kitchen |
| S8 | Witness scenes for eras 1, 3, 4 and 5 | witnesscheck per era | NOT BUILT | 02-WITNESS.md section 1 table: sketches only |
| S9 | H1 as a written scene: Bet decides at the gate on Tilney Road | `fatecheck.mjs` (decider speaks, two ways, played, cause) | PASS | f.anni_home decided by BET, fell on 10 of 30 runs |
| S10 | H2 as a written scene: Gedge takes Aaron at the yard, Ilo goes in for the coat | `fatecheck.mjs` | PASS | f.aaron_taken decided by GEDGE, fell on 1 of 30 runs |
| S11 | The granary custody: Holt decides at the wicket; the militia line walks to it | `fatecheck.mjs`; `quota/doorbench.mjs` | PASS | f.tomas_held decided by HOLT, fell on 8 of 30 runs |
| S12 | End states (rose, fell, left, ended, absorbed) and rules R13, R15, R22 as scenes with named deciders | fatecheck across eras | NOT BUILT | 03-FATES.md section 5; none of R13, R15, R22 exists in `content/quota/q_community.lwd` |
| S13 | Cold reads: two readers who have not seen the plan read the witness scene and the H2 scene and say what happened and how they felt | Written notes, a fail for any reader who summarises the theme or saw the turn coming (07-GRIP.md section 4) | NOT BUILT | Listed as remaining in PROGRESS 181 |
| S14 | The author approves the sample lines of each new scene before it is written in full | Dated approval quoted in design/state/story.md | NOT BUILT | PROGRESS 181: "the author's approval of the sample lines" remains |
| S15 | Dialogue standard, mechanical: 0 epigram shapes under `articulate dialogue` with the gate passed; dialogue_lint's six hard rules at 0 (mirrored-pair only points a reviewer at a line, DIALOGUE-STANDARD section 6) | `python content/tools/dialogue_lint.py --acts content/quota`; `articulate dialogue_check --voices design/voice-sheets/quota --gate` over every spoken line | PARTIAL | dialogue_lint 2026-10-22 (W1-E, b132817): hard rules 0; mirrored-pair only points a reviewer. Was: hard rules 5. Articulate's gate passed on 153 new lines only (PROGRESS 179) |
| S16 | Dialogue standard, by ear: the read-aloud test on every scene | A person reads each scene aloud; notes per scene | NOT BUILT | No record of a read-aloud pass on the Quota |
| S17 | Every promise the story makes is kept or cut: no flag set and never read without a written reason | `flags.mjs ../../content/quota/slice.lwd` | PASS | flags.mjs 2026-10-22 (W1-E, b132817): 74 set, 0 never read; 8 kept, 3 cut with written reasons in the commit and PROGRESS |
| S18 | The inner arena reachable from the story: each era's protagonist meets his self-lies at the hinge the plan names; outcomes change only the next scene | New: a harness route into the inner fight from the story, plus flawcheck, forcecheck, boonledger, notallycheck | PASS | Every hinge with a written self-lie is wired (2026-10-23): era 1 Fond of Them (e1.inner.fond), era 2's one night in the order heard (Steady Hand, Only, Forty Carts, Friday: q.inner.*), era 3 The Figure (e3.inner.figure), era 4 The Long Barn and Under the Goats (e4.inner.barn, e4.inner.goats), era 5 Everybody Says, Order, the Descent and the Adversary. A hinge pauses the talk only when its lie was heard; the harness plays it headless (tools/innerplay.mjs) and the shell over the scene (ui/inneroverlay.mjs). Both classes reach THE END over seeds 1 to 3 with every armed fight played (tests/innerhinge.test.mjs, 7 tests). He's With Me and Nearest One have no self-lie in the content, so nothing arms them; Nobody Checks is the Descent's. The traits pass (2026-10-23, design/TRAITS.md): every boss is one of the character's traits embodied; the hinge carries the sheet's levels into the dream (a trait is as big inside as he made it) and brings back what each ending did to the trait (force -1, terms +1, lost to +2) as a sheet modifier; the Descent is four gates built from the traits he fed; three new lesser beings (JEALOUSY, DREAD, SHAME) give every voice a body (tests/traits.test.mjs; combat/tests/innerduel.json, 16 beings and 3 movements on target) |
| S19 | The game's ending: the table in the antique shop, resolved by testimony, nothing totalled, someone in era 5 does one true thing for Tomas and it changes nothing that happened (01-SPINE.md section 4) | New: endingcheck (the ending reached on every class and movement; no count on screen); cold read | PARTIAL | `tools/endingcheck.mjs` (2026-10-23), LW_STORY=quota, seeds 1 and 2: 54 finished runs, all 38 ending nodes reached, each class reaches e5.end on each of the five movements, every variant entered only with the state and fate it stands for, no count in any line shown, the last line in the table's last beat; 0 errors; three planted faults caught (a "Lives lost" caption, the Haldane end swapped, a run stopped before the table). Not done: the cold read, and a check on the shell's pixels (the text is checked, not the screen) |
| S20 | Persecution across five eras, staged as in 04-PERSECUTION.md (who does it, who looks away, who profits, who hides someone), the plague as its engine | lorecheck chains per era; sensitivity read | PARTIAL | Era 2 plants the Well rumour, the chalk, the pulpit line (PROGRESS 179); eras 1, 3, 4, 5 not written |
| S21 | Sensitivity read (trans, Muslim, Jewish, Black, immigrant, rural-poor readers; descendants of famines; addiction and domestic violence) and a historian of genocide, acted on | The readers' notes and a dated response | NOT BUILT | The author arranges it; a gate before M2 (07-PRODUCTION.md) |
| S22 | The world record shows itself only as objects at the table (no run count, no prior speaker) | `worldcheck.mjs` extended; new `complicitycheck.mjs` with its control | PARTIAL | worldcheck passes (record written, carried, healed); objects and complicitycheck not built (06-BUILD.md status) |
| S23 | Runtime: the whole game 5 to 6 hours at the middle reading rate | `playthrough.mjs --beatlog` then `playtime.mjs` | PARTIAL | Era 2: inspector 71 min (57 to 93), militia 88 min (69 to 115). Whole game unmeasurable until eras exist |
| S24 | Random runs exercise the playtime model | `playtime.mjs` on a `--random` beat log | FAIL | Ten random runs report "0 words in 0 beats" and 1 min each while the beat log holds 599 KB of beats: the model misses random runs (tool defect) |

## 3. Feature-complete criteria

### 3.1 UI

| ID | Criterion | Check | Status | Evidence |
|---|---|---|---|---|
| U1 | The title is the game's own, over its own plate | Capture plus a look | PASS | Shell still 00-title: "The Prayer for the Water" over the square |
| U2 | No game-authored topic list anywhere before or on the title (RATING.md section 5; CINEMATICS.md section 2) | New: grep test over ui/ for the content list, plus a title capture | FAIL | The title still shows "Mature themes: political and religious conflict, ..." (game/engine/ui/title.mjs:15, `MATURE`; seen in today's title still) |
| U3 | Boot sequence: studio card, engine card, photosensitivity notice, opening cinematic, title | `tests/boot.test.mjs`, `tests/cinematic.test.mjs`, `cine/tools/cinecapture.mjs` | NOT BUILT | CINEMATICS.md:41 and :237 say BUILT, but those tests and `game/engine/cine/` are absent from dev at bd2566e and from every worktree (searched today). Another agent is editing the boot code |
| U4 | The talk panel honours the witness gate; walking off cannot end the scene | `tests/witnesspace.test.mjs` | PASS | Engine tests 290 of 290 |
| U5 | Every place in the playable story shows its painted plate, never a name card on black | Shell stills, one per new scene, looked at | PASS | Era 2: 20 and 19 stills today, every one on a plate. Era 1, 3, 4, 5 plates do not exist (counted under the eras) |
| U6 | People read in every room: figure luminance inside the band the visual check uses | `tools/visual-check.mjs` with Quota views (new views needed) | FAIL | Returns room: Tomas and the inspector draw as near-black silhouettes (shell still 05; engine PROGRESS 37, "High"). visual-check passes 8 of 8 with controls failing, but all 8 views are Gullet places |
| U7 | The HUD clock never runs backwards across days, and shows time in a form the story allows (`@meta numbers: off`) | New: clock continuity check over the shell's step log | FAIL | PROGRESS 183: the HUD reads 11:00 then 07:06 in the cells; the day is hidden. Today's stills show numerals (08:40, 22:05) |
| U8 | The Daybook and Pause stay clear of the fight panel and barks | layoutcheck over fight stills | PASS | Shell still 11-fight: both buttons clear |
| U9 | The town map wired as the Daybook's map or the wide lens | Capture; a test that every era place has a map position | NOT BUILT | q_town baked and locked, not wired (PROGRESS 184) |
| U10 | Settings complete: every row UI-SYSTEM section 9 and 05-CARE name, each saved and applied | New: settings test enumerating required rows | PARTIAL | Present: text size, contrast, plain text, reduced motion, close looks, interface scale, portraits, shake, rumble, pause on blur, pace (ui/settings.mjs:19-31). Missing: captions, fight speed, story setting, haptics slider, scene notes, steady world, loudness profile and sliders, hold or toggle |
| U11 | The interface at 4K and at 1280 x 800 (Deck) with the talk panel and Daybook open at the largest text size | Captures at both sizes, looked at; new layout check for overflow | PARTIAL | Root clamp built, 41 px at 4K, 16.2 px on Deck (UX-AUDIT section 6, T3); no capture at the largest text size on Deck |
| U12 | Ink contrast: every text ink 4.5:1 or better on the darkest 2 % of its aged paper | `tools/uicontrast.mjs` | PASS | rc 0 today, no ink under 4.5:1 |
| U13 | No panel hides more than a fifth of a way out, over Quota stills | `tools/layoutcheck.mjs` on quota-shell stills | PARTIAL | The tool exists; it has run on Gullet walks only |
| U14 | Credits screen: the author, tools, fonts and licences, testers who agree to be named | Capture; licence files present | NOT BUILT | STEAM-READINESS 7.3 |
| U15 | Each era's interface look (paper, inks, hot mark) for eras 1 to 5 | uicontrast per era; captures | PARTIAL | era.css and the era 2 look exist; eras 1, 3, 4, 5 have no screens to show it on |

### 3.2 Controls

| ID | Criterion | Check | Status | Evidence |
|---|---|---|---|---|
| C1 | Keyboard alone finishes the game | New: `quota-shell.mjs --input key` (presses keys, never clicks) | PARTIAL | Keys exist for every action (UI-SYSTEM section 8); the shell driver clicks options, so no keyboard-only run exists |
| C2 | Mouse finishes the game | `quota-shell.mjs` (clicks) | PARTIAL | Era 2 finished by clicks on both classes; combat's pilot played the fights |
| C3 | Pad alone finishes the game, every menu, the Daybook and settings | New: `quota-shell.mjs --input pad` through an injected Gamepad API | PARTIAL | Pad menu mode in ui/input.mjs and pad fight bindings exist; never run pad-only |
| C4 | Remapping everywhere: every action, keyboard and pad separately | New: test that every action in `SHELL` and `FIGHT_ACTIONS` rebinds and persists | PARTIAL | Fight actions remap (ui/bindings.mjs:13); shell actions are a fixed table (ui/bindings.mjs:77) |
| C5 | Hold or toggle for block, run and crouch | Settings test | NOT BUILT | Promised in UI-SYSTEM section 8; no settings row |
| C6 | Device-aware prompts | Capture after switching device | PASS | UX-AUDIT section 6, T5; the keys panel shows key and pad names (still 11-fight) |
| C7 | A default Steam Input layout | Shell test on a Deck | NOT BUILT | Needs B1, B9 |
| C8 | Stick dead zone and shaping without flicker | `tests/stick.test.mjs` (bound 2e) | PASS | Engine tests 290 of 290 |

### 3.3 Movement

| ID | Criterion | Check | Status | Evidence |
|---|---|---|---|---|
| M1 | Start, stop, turn, diagonal and wall slide inside their bounds (engine PROGRESS 37, 2a to 2d) | `combat/tests/feel.test.mjs` | PASS | Combat tests 155 of 155 |
| M2 | Paths on the visibility graph never thread a one-cell gap | `tests/visgraph.test.mjs` | PASS | Engine tests 290 of 290 |
| M3 | Every room the story enters has walking ground | New: a check that every area's plate yields walkable samples | FAIL | Class 2 shell log: "platecam: no walking ground on q_brack_kitchen" |
| M4 | Bodies and held tools stay out of walls and props | visual-check with Quota views | PARTIAL | 8 of 8 pass, Gullet views only |
| M5 | Movement in eras 1, 3, 4, 5 places | As M3 | NOT BUILT | No places |

### 3.4 Animation

| ID | Criterion | Check | Status | Evidence |
|---|---|---|---|---|
| A1 | Foot lock: planted feet slide 1 cm or less a step | `characters/proto/anim_bounds_test.mjs` | PASS | "anim bounds: all pass"; 0.77 cm over 600 steps (ANIM-BOUNDS.md) |
| A2 | Transitions: fade edges smooth, once-per-fade turn rule | anim_bounds_test | PASS | 1.84 deg/frame² over 3,432 pairs (PROGRESS 176) |
| A3 | Upper-body layering: strike from a walk | `actor_test.mjs`, `sample_test.mjs` | PASS | Both pass today |
| A4 | Every combat move the story's foes use has a clip | New: clip coverage test over combat's move ids | FAIL | Shell logs: "no clip for combat's warden.hook, warden.spin, warden.thrust; showing the guard" |
| A5 | Faces read as people at play size and in portraits: each head inside HEAD-BOUNDS, cast distinct | `heads_test.mjs`; head bounds gate; blind distinctness test | FAIL | 5 of 22 heads pass every bound; distinctness median 0.021 H against 0.03 (PROGRESS 186); the Tomas and Anni portraits read as placeholders (today's stills) |
| A6 | Faces move: expression changes, blinks, a mouth that speaks | New: portrait and figure face test | PARTIAL | Expression swap with a 120 ms cross-fade (ui/portrait.mjs:8); no blink or mouth movement found |
| A7 | Cloth: legs through coat or dress at most 5 vertices a frame | `characters/proto/fidelity_check.mjs` | PASS | 0 to 3.2 vertices a frame with clothPush (FIDELITY.md) |
| A8 | No visible pops: popcheck at or under its baseline | popcheck | FAIL | Pops rose from 162 to 213 frames (PROGRESS 176) |
| A9 | Inner arena bosses are animated forms that hold up as shipped art | Capture plus a look; morph phases played | FAIL | "placeholder 2D forms that read but do not impress, little animation" (PROGRESS 185) |
| A10 | Cinematic motion: strike, fall, kick; a carrying pose | cinecapture | NOT BUILT | CINEMATICS.md section 6 |
| A11 | Cast for eras 1, 3, 4, 5: children, the old, each era's dress | quota_test extended per era | NOT BUILT | Era 2 cast only (characters/cast/quota.mjs) |

### 3.5 Accessibility (design/sensory/05-CARE.md)

| ID | Criterion | Check | Status | Evidence |
|---|---|---|---|---|
| X1 | Flash rule (WCAG wording, 05-CARE section 2) over every scene, fight and cinematic | New: `tools/flashcheck.mjs` over shell captures, with its three controls; F5 in `combat/tools/inner-capture.mjs` | PARTIAL | Inner arena: 0 to 1 flashes a second, no red, over 17 fights (PROGRESS 187). Outer fight (quay, 2026-10-23): `tools/flashframes.mjs` judges 241 dumped frames offline with six controls planted on a still frame (still, breath and a 240 px pan pass; a 5 Hz flash, a 2 Hz red pulse and a 2 Hz dark-red pulse at WCAG's 20 fail), so the detector works on that path. The 34 to 37 saturated-red transitions were the fight camera's follow pan (zoom 1.12 to 1.80, 240 px of travel) moving an amber, lamp-lit wall across the fixed windows: 35 with every lamp and flame held still (fxflicker=off), 37 with them, the same with and without shake, and 18 of the 19 in frames 90 to 240 come back from one still frame panned by the logged camera. Not the torch lamp, not an effect. The count was any change of 0.05 in the share of saturated-red pixels. The rule is now WCAG 2.2's, checked against the W3C source on 2026-10-23 (W3C Recommendation, 12 December 2024, "general flash and red flash thresholds", Note 3): "a pair of opposing transitions where, one transition is either to or from a state with a value R/(R + G + B) that is greater than or equal to 0.8, and the difference between states is more than 0.2 (unitless) in the CIE 1976 UCS chromaticity diagram" (cine/redflash.mjs, read on each window's mean colour). The (R - G - B) x 320 > 20 measure used for a few hours first is WCAG 2.0's Understanding note, a page no longer maintained; its count stays in the results for the record. Outer fight: 1 flash a second, 0 red transitions in all three impact modes by both measures. The margin is now a chromaticity distance: the quay wall cut from the fight and framed 3, 6, 12 and 25 times closer gives 0.000, 0.082, 0.117 and 0.189 against 0.2, no red transition at any framing (`tests/flashred.test.mjs`); WCAG 2.0's measure already fails the wall at 3 times closer. The inner arena's in-page probe uses the same rule (combat/tools/inner-capture.mjs), and its controls (5 Hz flash, 2 Hz red, a new 2 Hz dark red, breath) behave. No check over the story shell The Well House fire in play (2026-10-24): the burning plate captured in the shell for 6 s at 10 frames a second, 0 flashes a second, 0 red transitions, controls behave; no pixel of the plate reaches R / (R + G + B) 0.8 (its maximum is 0.71). |
| X2 | The photosensitivity notice at boot, word for word from RATING.md section 4 | boot test | NOT BUILT | See U3 |
| X3 | Captions for every sound with meaning, with speaker names and delivery tags; never interpreting | New: caption coverage check over placed sounds | NOT BUILT | No caption system in the shell (05-CARE section 4) |
| X4 | Subtitles: every line with its speaker's name | Still of the talk panel | PASS | Today's stills: every line carries a name |
| X5 | Text size 0.88 to 1.5 and interface scale | ui/settings.mjs:19 | PASS | Rows present |
| X6 | Largest text legible on the Deck screen | U11 capture | NOT BUILT | |
| X7 | Colour-blind passes: every verdict cue keeps OKLab lightness 0.12 apart or a second channel under protan, deutan and tritan simulation | New: cvdcheck with a planted red-on-green control | NOT BUILT | 05-CARE section 3 proposes it |
| X8 | Every screen passes in greyscale | New: greyscale pass over shell stills | NOT BUILT | Stated as a rule (UI-SYSTEM.md:79-81); no check |
| X9 | Reduced motion, also from the system setting | `tests/` and ui/settings.mjs:22, tokens.css:41 | PASS | Present |
| X10 | Reduce bright flashes | ui/prefs.mjs:21 | PASS | Present |
| X11 | Shake full, light, off; rumble | ui/settings.mjs | PASS | Present |
| X12 | Haptics intensity 0 to 100 % in steps of 25 | Settings test | NOT BUILT | 05-CARE section 6 |
| X13 | Scene notes (off by default) and the steady-world option | Settings test; a scene stepped past is noted neutrally | NOT BUILT | 05-CARE section 7; DECISIONS 14 |
| X14 | Pace of scenes: full, half, stepped | ui/settings.mjs:31 | PASS | Present |
| X15 | Fight speed and a story setting for fights, stated plainly | Settings test; doorbench under each | NOT BUILT | UI-SYSTEM section 9; STEAM-READINESS section 3 |
| X16 | Loudness profiles and separate sliders for dialogue, music, sound and inner voices; dialogue boost | Gate in 05-CARE section 5 over rendered scene mixes | NOT BUILT | No audio in the shell |

### 3.6 Fluidity

| ID | Criterion | Check | Status | Evidence |
|---|---|---|---|---|
| F1 | 16.7 ms a frame, p95 at or under 16.7 ms, in every Quota scene at 1080p, GPU on, on a quiet machine | `node tools/bench.mjs` (project root) with every Quota view | PARTIAL | NOT QUIET (96 % load): quota-granary 16.67 ms, p95 16.7; quota-talk 16.67 ms, p95 16.8; quota-square fails before measuring ("ENOENT" parsed as JSON) |
| F2 | 30 frames a second or better on a Steam Deck in every scene | Deck spike, timed | NOT BUILT | |
| F3 | Load times: launch to title, place to place, save to play, each under a set bound (proposed: 5 s, 1 s, 3 s on an SSD desktop; Deck bounds set after the spike) | New: `tools/loadtime.mjs` (navigation and scene timings from the page) | NOT BUILT | No load-time measurement exists |
| F4 | Input to action: 0 frames free, buffer 100 to 150 ms, cancel windows in data | `combat/tests/feel.test.mjs`, `fluid.test.mjs` | PASS | Buffer 8 frames, 133 ms; combat tests 155 of 155 |
| F5 | Input to visible: the player's figure image on screen within a bound (proposed 33 ms in play, 50 ms in talk) | bench "Lamb shown" | FAIL | NOT QUIET: 17.5 ms at the granary, 122.7 ms in the returns-room talk view (figure job latency 92 ms). The flash rule, also named F5 in 05-CARE and the capture tools, is row X1; the outer fight's red result (2026-10-23) is recorded there |
| F6 | Camera at rest still; no jitter in a live fight; fighters framed clear of the panels | `tools/camprobe.mjs` with the old follow as control | PASS | Engine PROGRESS 37, bounds 3a to 3d met (Gullet quay and brawl); not yet run on Quota places |
| F7 | No stall, soft-lock or broken transition from title to ending | quota-shell, playthrough | PASS | Era 2: 0 stalls both classes; 16 harness runs finished |
| F8 | The lens move (wide to narrow) is an ink-blot transition with no hitch | Capture plus frame times across the move | PARTIAL | The transition exists (06-KEEP-CUT); the wide square view cannot be benched (F1) |

### 3.7 Mechanics (design/quota/04-SYSTEMS.md and design/SYSTEMS-FULL.md)

| ID | Criterion | Check | Status | Evidence |
|---|---|---|---|---|
| K1 | The community model at full scale: twelve streets, ten households, carriers per era, rules R1 to R23 with delays | `communitycheck.mjs`; `tests/community.test.mjs` | PARTIAL | Built: 4 streets, 3 households, 1 carrier, rules R2, R3, R4, R5, R8, R9, R11, R17, R17b, Rv (content/quota/q_community.lwd). Missing R6 and R7 (sickness and deaths, which the plague direction needs), R10, R12 to R16, R18 to R23 |
| K2 | Record events with a victim and a street, every effect seen from a lens | `communitycheck.mjs` | PASS | "every record event's effect is seen from a lens" (today) |
| K3 | Fates by people: no rule writes bowls, taken, members or end | `fatecheck.mjs` lint | PASS | 3 fates, 0 errors |
| K4 | The witness mechanic | `witnesscheck.mjs` | PASS | See S7 |
| K5 | Props with a state per era, each on a mark, each seen on some run | `proplint.mjs`, `propcheck.mjs` | PARTIAL | proplint 0 errors, 4 warnings (props with no mark, e.g. q.burial_fence, q.cell_log); propcheck 0 never seen, 3 states unreached; era 2 states only |
| K6 | The lore graph: every fragment reachable, every chain completable within its rule | `lorecheck.mjs` | PARTIAL | 8 fragments, 1 chain, 0 errors; the Haldane chain across eras not built |
| K7 | The world record across runs | `worldcheck.mjs`; `tests/worldrecord.test.mjs` | PASS | Every check passed, healing copies included |
| K8 | Rumour and discourse | `discoursecheck.mjs` | PASS | Every act on every claim ok |
| K9 | Dreams: two readings at least, the real model untouched | `dreamcheck.mjs` | PASS | Inspector 13 of 20, militia 8 of 10 |
| K10 | Perspective chapters: every pair in 03-STORY (the requisition, the house, the pit, the false world) | `perspectivecheck.mjs` | PARTIAL | 1 chapter (Bet), 30 of 30 runs; the other pairs are not built |
| K11 | Classes: six per era, each with its trade, routes and a way through every forced fight | Harness per class; `exitcheck.mjs` | PARTIAL | 2 of 6 in era 2; exitcheck: 0 forced fights without a way through |
| K12 | Story fight 1, the granary door: won, talked out, lost or left by each class and figure | `quota/doorbench.mjs`; shell fight | PASS | One fight per class in today's shell runs; doorbench recorded in PROGRESS 161 |
| K13 | Story fight 2, the clearance day: the Clearance Sergeant, the talk-out by what was carried down | doorbench equivalent | NOT BUILT | 05-ARENA.md; 03-STORY.md era 5 beat 8 |
| K14 | The inner arena's rules: five verbs, no tally, boons cost a named beat | flawcheck, forcecheck, boonledger, notallycheck (combat tests) | PASS | 0 errors over 14 records and 64 played fights (2026-10-23), controls fail as they must; combat 180 of 180. Every resolution without force waits until the fight is joined; the true-account sheet was removed later on 2026-10-23 and a prop on each ground replaced it (COMBAT-SPEC 12.2). The inner capture's full control run has two failures that predate this work, checked at 546f888 with the same numbers: check-endure's hollow differs from its ring by dL* 1.2 (F1, at least 15), and the dimswing control reads the player's outline under half on 5 of 918 frames (P2, lowest 0.484). Not fixed here. The full capture of 2026-10-23 (31 fights and the controls) also shows F1 contrast failures on Received (the lid), Friday (the hand, the arm), He's With Me (the door), Only (the collar), Forty Carts (the horse, a wheel) and the Host (the evidence, the wings, a limb, the hat), and P2 on two of their runs: every one of them is the same, number for number, at 546f888, so they predate the true account and the new bosses. The twelve new and changed fights (era 5's four, the last four) pass F1, F2, F4, F5, F6 and P2, and their silhouettes separate (closest pair 0.712). Not fixed here |
| K15 | Complicity is examined, never rewarded | New: `complicitycheck.mjs` with its control | NOT BUILT | 06-BUILD.md phase 2 |
| K16 | No escape hatch: one slot per run, autosave before ink choices | New: a test on the Quota's save rules | PARTIAL | Ink mode exists in save/save.mjs; not tested for the Quota |
| K17 | Event coverage: every event fires on some run; clock and tide statements agree | `eventcheck.mjs` | PASS | 0 disagreements in 231 beats |
| K19 | No device works by reading or bookkeeping (the author, 2026-10-23: weight, sound, touch, bodies, changed places; "Bookkeeping should not be a part of the plot") | `devicecheck.mjs`, `echocheck.mjs`, lorecheck and proplint's device rules; `tests/senses.test.mjs` controls | PASS | 2026-10-23, feat/weighted-devices: devicecheck 0 findings (206 before); echocheck 56 runs, 41 echoes, 0 errors; lorecheck 0 errors with every chain completable in one run by each class; both classes to THE END in the shell (class 1 100 steps, class 2 90 steps, 0 stalls, 0 errors). Audit: design/DEVICE-AUDIT.md, 328 rows. Open: the Character page's levels under `numbers: off` (engine audit row 20). The voice names FORM LETTER, SMALL PRINT, PRECEDENT and THE PEN are gone (the traits pass, 2026-10-23, design/TRAITS-RENAME.md) |
| K18 | Every SYSTEMS-FULL system has a keep or cut verdict for the spine, and each kept one has a check (sub-table below) | This ledger's sub-table, reviewed by the game director | PARTIAL | Verdicts below; four await the director |

**SYSTEMS-FULL against the spine.** SYSTEMS-FULL.md is Gullet's design. The Quota keeps its own ruleset
(content/quota/q_rules.lwd: the four compartments and sixteen voices, no Kit, no meters, no creation).

| SYSTEMS-FULL section | Verdict | Check if kept |
|---|---|---|
| 2 Compartments and voices; 4 checks and strain | Kept (q_rules.lwd) | validate; harness voice coverage |
| 3 Effective level; 15 pages; 19 one sheet | Kept in q_rules.lwd (xp-per-level 1, skill-cap 4) | Harness: pages earned per class (no check yet) |
| 5 Meters; 2.2 the Kit; 7 creation | Cut (q_rules.lwd header) | None |
| 6 the Margin; 8 clothing; 9 salvage, wear, fitting; 19.7 the bench | Undecided for the Quota | Game director to rule |
| 10 Lamps of Gullet; 11 the room above the Brine; 12 Tide Runs | Cut with Gullet (06-KEEP-CUT; tidelint retired) | None |
| 13 Reputation, cover, the Read | Undecided (rep-min and rep-max exist in q_rules.lwd) | Game director to rule |
| 14 the Record | Kept as the record and the witness | witnesscheck |
| 16 World-state hooks | Kept | Engine tests |
| 18 the Fray | Kept for story fights and the arena | Combat tests; doorbench |
| 20 Interrogation | Undecided | Game director to rule |

### 3.8 Audio

| ID | Criterion | Check | Status | Evidence |
|---|---|---|---|---|
| AU1 | Sound plays in the game: the score and sound design wired into the shell | New: shell test that cues fire on scene, lens and fight changes | NOT BUILT | game/engine/audio/ has the score, mixer, ducking and a listen page; nothing under ui/ imports it (grep for createScore) |
| AU2 | Ambience per place and era; footsteps per footing; fight impacts and barks; UI paper sounds (UI-SYSTEM section 10) | New: placed-sound coverage list per scene | NOT BUILT | Event keys named, no sound shipped |
| AU3 | Loudness: scene mixes inside their bands, -1 dBTP | `audio/analysis.mjs` over rendered scene mixes | PARTIAL | Renders are measured to BS.1770-4 (05-CARE section 5); no per-scene gate in the game |
| AU4 | Voice: either recorded or generated voices for every spoken line, approved by the author, disclosed on Steam | Coverage list; the AI disclosure | NOT BUILT | Generated voices exist as scene renders (tools/voice/); dirlint reports 0 directed lines of 971 in the Quota |
| AU5 | The mix never gives a lie away | The duck test that never reads `lie` (design/state/audio.md) | PASS | Pinned by the audio lead's test (feat/audio) |

### 3.9 Cinematics

| ID | Criterion | Check | Status | Evidence |
|---|---|---|---|---|
| CI1 | The opening cinematic, 60 to 120 s, flash-safe, skippable after one viewing | `tests/cinematic.test.mjs`; cinecapture with F5 | NOT BUILT | Not on dev (see U3) |
| CI2 | The end cell through the hatch; the ending at the table; the witness staging; era transitions; morph moments (CINEMATICS.md 4.1 to 4.5) | cinecapture per shot | NOT BUILT | All PROPOSAL; 4.2 to 4.4 need era 3 to 5 plates |
| CI3 | A caption track for every cinematic | Caption coverage check | NOT BUILT | CINEMATICS.md section 6 |

### 3.10 Store and release

| ID | Criterion | Check | Status | Evidence |
|---|---|---|---|---|
| R1 | Steamworks partner account, fee, tax and bank forms | The author's confirmation | NOT BUILT | Author-only step (STEAM-READINESS section 9) |
| R2 | Content survey answers drafted from the internal content list, each traced to scenes | Draft reviewed by the author | NOT BUILT | RATING.md section 7 |
| R3 | Generative-AI disclosure: every shipped asset made with a generative tool listed with its tool and the human part | New: asset audit list | NOT BUILT | RATING.md section 2 |
| R4 | German availability checked against German law | Written advice | NOT BUILT | RATING.md section 1 |
| R5 | Store art: capsules at Steam's sizes, five or more screenshots, a trailer cut from play | Files at the sizes Steamworks lists today | NOT BUILT | STEAM-READINESS section 8 (written for Gullet; needs the Quota) |
| R6 | Achievements that mark a story fact, none for grind | List reviewed; Steamworks test | NOT BUILT | STEAM-READINESS 7.1 lists Gullet achievements; none for the Quota |
| R7 | Font licences shipped; Conso cleared for commercial embedding | Licence files beside the fonts | FAIL | game/fonts holds three .woff2 files and no licence file |
| R8 | The game's licence and the credits | Author sign-off | NOT BUILT | STEAM-READINESS 7.3 |
| R9 | English only at 1.0, with strings extractable later | New: string-table extraction dry run | NOT BUILT | Text is inline in .lwd |
| R10 | The Gullet acts archived out of the shipped build | Package scan (B2) | NOT BUILT | Author decision 5 in 07-PRODUCTION.md; content/act1 to act3 still in place |

### 3.11 Combat, with the competitive bar (design/COMBAT-SPEC.md)

Added by the combat director, 2026-10-23, on the author's direction "Combat at the top of the market"
(DECISIONS-2026-10-22). Each row names the title to beat and how we measure against it. Feel targets
T1 to T16 are in COMBAT-SPEC section 3; the audit behind each status is its section 10.

| ID | Criterion | Check | Status | Evidence | Competitive bar |
|---|---|---|---|---|---|
| CB1 | Input to first visible frame, glass to glass, 50 ms median and 67 ms p95 at 60 Hz (T1) | New: native latency bench (COMBAT-SPEC P9) | NOT BUILT | Never measured; F5 is a render-job time | Diablo IV with Reflex; Mick West's 67 ms bound |
| CB2 | Frame data: 0-frame start, 8-frame buffer, light startup 10 to 12, hitstop 0 and 2, poise model (T2 to T4, T7, T13) | New: frame-data test over every move | PARTIAL | Values meet by the frame dump (COMBAT-SPEC section 10); the test is not written | Elden Ring (buffer, poise); NRFTW (hitstop) |
| CB3 | Catch window 8 to 10 frames, shield 11 to 12, a 24-frame lockout after a miss (T5) | Frame-data test and a mash test | PASS | 2026-10-23, P2 (58c60ac): catch 9 frames on light, short, long, bar and unarmed tools, 8 on heavy, 11 on the shield; a missed catch locks the next out for 24 frames. `combat/tests/telegraph.test.mjs` checks both, mashing included. Arena fair-win moved 0 to 2 fights in 57 a style (`combat/tools/kite.mjs`); doorbench unchanged | Lies of P (9.3 frames, 30-frame lockout); Sekiro |
| CB4 | Roll safe frames and recovery by load band (T6) | Frame-data test per band | PARTIAL | Roll 21 safe frames; the heavy hop runs 110 frames | Elden Ring (26 safe at 60 fps, recovery 16 to 32); NRFTW weight classes |
| CB5 | Telegraph leads: 18 frames parryable, 30 unparryable, 36 boss signature (T9) | Frame-data test over every tell | PASS | 2026-10-23, P2 (58c60ac): every tell over the specials and the foes' tool strikes leads by 18 or more, unparryables by 30 or more, boss signatures 36 and 48 unchanged; `telegraph.test.mjs`. 40 traced fights: same outcomes before and after | Sekiro's perilous cue; Hades readability |
| CB6 | Hit reactions on the contact tick, 20 or more a body (T8, T14) | Captured reaction timing; clip coverage | FAIL | Warden hook, spin and thrust have no clip (A4) | Black Myth: Wukong; Diablo IV |
| CB7 | Wounds on bodies, blood under the flash rule, aftermath that persists, gore settings (COMBAT-SPEC section 4) | Wound test; flashcheck; gore settings test | NOT BUILT | No wound, blood or gore code under combat/ | Diablo IV; No Rest for the Wicked |
| CB8 | Keyed impact shake with the tell clamp, and attack tokens (T10, T11) | fightcam test; shake captures; AI test | PASS | Fixed 2026-10-23. Bisect from 0110c5f (6.4 px, good) to b95d71f (15.8 px) named 63515f2 as the first commit over 7 px (11.5 px); a later merge in the range raised it to 15.8 px by changing the fight itself (two 0.75 blows on one frame). Cause: 63515f2 swapped the 10 Hz decaying swing for a keyed shake that reaches its full nominal size at frame 3, and left the nominal size at 18 px, a value the old shape only ever showed at about 0.38. The spring was also added on top of the keyed shake, so two blows on one frame stacked and the tell clamp covered each layer alone (3 px each, up to 6 together). Now the nominal peak is 6 px (T10), and one limit applies to the keyed shake and spring together: 6 px, or 3 px while a tell shows. Quay fight, impact-capture: 15.8 px before, 5.3 px after (peak at frame 200, shake gone by frame 212). `fightcam.test.mjs` replays the fight's eight blows and fails above 7 px, plus a three-blows-on-one-frame case, rest by frame 12 and 15, and the 3 px tell limit with spring. Frames 200 and 204 viewed. F5 on the outer fight: 1 flash a second, at most 3 allowed. The saturated-red count was 34 before the fix and 34 to 37 after, so the shake did not cause it. Traced 2026-10-23 (row X1): the camera's follow pan over an amber wall, not the torch lamp; with WCAG's red measure the fight has 0 red transitions, and the offline detector's controls pass. | NRFTW; Doom 2016 tokens |
| CB9 | Six era 2 class move sets, each with two signatures, an item and a way out (COMBAT-SPEC 2.1) | Frame-data test per class; a harness fight per class | NOT BUILT | Tool classes exist; class signatures do not | NRFTW; Elden Ring builds |
| CB10 | Native C++ combat reproducing the JS traces on 40 seeds | Trace parity test | NOT BUILT | No native combat; 23 libm calls block parity | Our own JS reference |
| CB11 | Combat sound on the contact tick within 30 ms, one family per tool and material (T15) | Audio timestamps against present | NOT BUILT | No sound in the shell (AU1) | Hades II; Hollow Knight: Silksong |

The bar for combat rows elsewhere in this ledger: M1 (NRFTW movement), A4 and A9 (Black Myth: Wukong, Lies
of P bosses), X1 (WCAG 2.x), X15 (The Last of Us Part II's 60 and more options), F4 (Elden Ring's buffer),
F5 (Diablo IV), K12 and K13 (Disco Elysium's talk-outs alongside NRFTW fights), K14 and S18 (Silent Hill 2
and Hellblade for inner bosses).

---

## 4. Status by area

| Area | PASS | PARTIAL | FAIL | NOT BUILT |
|---|---|---|---|---|
| Compiled game (B) | 2 | 4 | 1 | 7 |
| Story (S) | 5 | 7 | 1 | 11 |
| UI (U) | 5 | 4 | 3 | 3 |
| Controls (C) | 2 | 4 | 0 | 2 |
| Movement (M) | 2 | 1 | 1 | 1 |
| Animation (A) | 4 | 1 | 4 | 2 |
| Accessibility (X) | 6 | 1 | 0 | 9 |
| Fluidity (F) | 3 | 2 | 1 | 2 |
| Mechanics (K) | 9 | 7 | 0 | 2 |
| Audio (AU) | 1 | 1 | 0 | 3 |
| Cinematics (CI) | 0 | 0 | 0 | 3 |
| Store and release (R) | 0 | 0 | 1 | 9 |
| Combat (CB) | 3 | 2 | 1 | 5 |
| **Total** | **42** | **34** | **13** | **59** |

Counted from the tables by script after writing; the headline at the top carries the same totals.

## 5. Measurement record, 2026-10-22

| What | Command | Result |
|---|---|---|
| Engine tests | `node --test tests/*.test.mjs` | 290 tests, 290 pass, 0 fail, 7.0 s |
| Combat tests | `node --test combat/tests/*.test.mjs` | 155 tests, 155 pass, 15.4 s |
| Character tests | `node characters/proto/<name>_test.mjs` for 15 files (project root) | All end on ok lines; heads 13 of 13, quota 6 of 6, anim bounds all pass |
| Validator | `node tools/validate.mjs ../../content/quota/slice.lwd [wiring/quota-areas.lwd]` | 22 files, 194 nodes, 194 reachable, 0 errors, 0 warnings; with wiring the same over 23 files |
| proplint | `node tools/proplint.mjs` | 12 props, 0 errors, 4 warnings |
| dirlint | `node tools/dirlint.mjs ../../content/quota` | 971 spoken lines, 0 directed, 0 errors |
| flags | `node tools/flags.mjs ../../content/quota/slice.lwd` | 77 set, 11 never read |
| communitycheck | `node tools/communitycheck.mjs --quiet` | Passes; every effect seen from a lens |
| discoursecheck | `node tools/discoursecheck.mjs` | Passes |
| fatecheck | `node tools/fatecheck.mjs` | 30 runs, 3 fates, 0 errors |
| witnesscheck | `node tools/witnesscheck.mjs` | 1 scene, 6 self-lies, 11 of 11 beats over 30 runs, 0 errors |
| lorecheck | `node tools/lorecheck.mjs` | 30 fresh runs, 8 seeded, 8 fragments, 1 chain, 0 errors |
| worldcheck | `node tools/worldcheck.mjs` | Every check passed |
| dreamcheck | `node tools/dreamcheck.mjs` | 21 of 30 came true; both readings open |
| perspectivecheck | `node tools/perspectivecheck.mjs` | 1 chapter, 30 played, 0 errors |
| propcheck | `node tools/propcheck.mjs` | 0 never seen, 3 states unreached |
| devicecheck | `node tools/devicecheck.mjs` (2026-10-23, the weighted-devices pass) | 0 findings (hand, inscription, figure, paperwork verb, document prop, sense, journal, counter, unfelt, cue); 206 on dev at f8ecbe2 before the pass |
| echocheck | `node tools/echocheck.mjs` (2026-10-23, the weighted-devices pass) | 56 runs, 41 echoes, 0 errors; every fate that falls is felt where it fell |
| eventcheck (with clocklint and tidelint) | `node tools/eventcheck.mjs` | 0 disagreements |
| exitcheck | `node tools/exitcheck.mjs` | 0 forced fights without a way through |
| Harness | `node tools/playthrough.mjs --build all --shuffle 3 --beatlog b.jsonl --json t.json` | 6 of 6 FINISHED; militia 1 of 1 fight won each |
| Harness, random | the same with `--random 10` | 10 of 10 FINISHED |
| Playtime | `node tools/playtime.mjs b.jsonl t.json` | Inspector 71 min (57 to 93); militia 88 min (69 to 115); random runs read as 0 words (S24) |
| Dialogue lint | `python content/tools/dialogue_lint.py --acts content/quota` (project root) | 524 lines, 45 flagged |
| UI contrast | `node tools/uicontrast.mjs` | rc 0 |
| Browser shell | `node tools/gpu-lock.mjs run --lock heavy-cpu <job> -- node game/engine/tools/quota-shell.mjs --class 1\|2 --port 8791 --out <dir>` (project root) | Class 1: 60 s, 32 steps, 20 stills, 1 fight, ended, 0 stalls, 0 errors, 6 warnings. Class 2: 63 s, 30 steps, 19 stills, 1 fight, ended, 0 stalls, 0 errors, 7 warnings |
| Visual check | `node game/engine/tools/visual-check.mjs --port 8791 --out <dir>` under the heavy-cpu lock | 8 of 8 views pass, 4 controls fail as they must (Gullet views only) |
| Frame bench | `node tools/bench.mjs --port 8791 --gpu 1 --views quota-square,quota-granary,quota-talk --query content=quota` (project root) | Granary 16.67 ms (p95 16.7), shown 17.5 ms; talk 16.67 ms (p95 16.8), shown 122.7 ms; square failed to load; NOT QUIET |
| File store and crash reports (2026-10-23, W1-C) | `node --test tests/filestore.test.mjs` | 11 tests, 11 pass; controls fail as they must; engine tests 318 of 318 |
| The traits pass (2026-10-23, feat/traits-embodied, design/TRAITS.md) | `node tools/ledgerrun.mjs --browser` before (edcbd8e) and after, both in clean worktrees without the untracked plates; `quota-shell.mjs --class 1\|2 --iters 2000` | Every row's gate the same before and after. Engine tests 367 of 377 (361 of 371 before; the 10 failing need untracked plate and geo files); combat 173 of 182 before regenerating the Descent's trace, 174 after (174 before); traits tests 6 of 6; innerduel 16 beings and 3 movements on target. Shell at the ledger's default 400 polls: neither class ends before or after (class 1 91 then 89 steps, class 2 66 then 27: the inner fights now run at the sheet's own levels and take longer in real time). With 2000 polls both classes reach THE END: class 1 51 steps, 6 inner fights; class 2 46 steps, 5 inner fights; 0 stalls, 0 errors |

Stills looked at today: the title (topic list present), the returns room (silhouetted figures, placeholder
portrait), the granary fight (panels clear), and the end in Anni's kitchen (THE END, witness lines). The
committed captures of the same runs from earlier passes are in `game/capture/quota-shell-2026-10-22/`,
`game/capture/quota-shell-plates-c1/`, `-c2/` and `game/capture/quota-shell-angle-c1/`, `-c2/`.

---

## 6. The wave plan

**Rules for every package.** One agent run of about 2 to 4 hours. It owns the files named and edits no
other file; two packages in the same wave never share a file. It starts only when its entry criteria
hold, ends with its exit checks run and their output quoted, updates its rows in this ledger, and commits
its own files alone. A package that touches `game/engine/ui/play.mjs` says so, and only one such package
runs at a time (it is the shell's hub). Owner roles are the ones the project already uses.

**Wave 0: decisions only the author can make.** These block the packages named.

| # | Decision | Blocks |
|---|---|---|
| D1 | The art pipeline: keep code-generated heads and bosses, or move to a hand-authored pipeline (Blender sculpts, painted portraits), as the coordinator flagged | W3-E, W4-E, every era's cast |
| D2 | The native shell: option A (own shell on WebView2) for 1.0, as STEAM-READINESS recommends, or another | W1-D, W2-E |
| D3 | The Deck target: meet "Verified" at launch, or "Playable" first | W2-E, W6-B |
| D4 | Who makes the voices: generated (disclosed), actors, or text only at 1.0 | W5-C |
| D5 | Era 2's classes: all six (M2) or the two built, with four in later eras | W2-F |
| D6 | The sensitivity read and the historian: who, when (a gate before M2) | S21, W6-C |
| D7 | Archive the Gullet acts out of the build | R10, W2-E |
| D8 | The title (working title The Prayer for the Water, reversible) | R5, U1 |

**Wave 1: unblock measurement and the platform, finish era 2's text.** All six run in parallel.

| ID | Package | Owner | Files owned | Entry | Exit checks | Closes |
|---|---|---|---|---|---|---|
| W1-A | One command runs every checker in this ledger and prints the status table; Quota views for visual-check; fix the bench's quota-square view | Systems engineer, QA | `game/engine/tools/ledgerrun.mjs` (new), `game/engine/tools/visualcheck/views.mjs`, `tools/bench-views.mjs` | None | ledgerrun reproduces section 5; visual-check runs on 4 Quota rooms with its controls failing; bench measures quota-square | Checks for U6, M4, F1; S24 named for W2-A |
| W1-B | Boot sequence and title land: studio and engine cards, photosensitivity notice, opening film, the topic list removed | UI lead with the cinematics lead | `game/engine/ui/title.mjs`, `game/engine/cine/` (new), `tests/boot.test.mjs`, `tests/cinematic.test.mjs` | The cinematics agent's in-flight boot work is committed or handed over | boot and cinematic tests pass; title capture has no topic list; cinecapture F5 passes | U2, U3, X2, CI1 |
| W1-C | Saves, settings and the world record on disk behind the existing storage interface; local crash reports | Systems engineer | `game/engine/save/filestore.mjs` (new), `game/engine/ui/crash.mjs` (new), `tests/filestore.test.mjs` (new) | None | filestore test with both controls failing as they must; a planted throw writes a report | B4 (JS side), B6 |
| W1-D | Native shell spike on Windows: a window, WebView2, a file bridge, launch to title | Native engineer | `shell/` (new) | D2 | Smoke test: exe to title, timed, exit clean | B1 (spike), part of B7 |
| W1-E | Era 2 text complete: Dorrah and Ilo on the hill; the 11 unkept promises kept or cut; dialogue_lint's 5 hard flags fixed; the sample-line packet for the author | Story lead | `content/quota/*.lwd` | The line pass now running on content/quota has landed | validate 0 and 0; flags 0 unexplained; dialogue_lint hard rules 0; Articulate gate on every line; harness both classes FINISHED | S15 (mechanical), S17, part of S2 |
| W1-F | Eras 1, 3, 4, 5 designed to the spine at build detail: scene list per era with whose story, fates and deciders, witness, places, cast, props, rules each era needs | Game director | `design/eras/` (new): one file per era | None | Every beat in 03-STORY.md mapped; every fate has a decider; the director's file:line check passes; check_writing.py on each | Entry for every era package |

**Wave 2: the shell becomes a game, era 1 in words.** Parallel except where marked.

| ID | Package | Owner | Files owned | Entry | Exit checks | Closes |
|---|---|---|---|---|---|---|
| W2-A | Clock continuity and the HUD's time words; the playtime model reads random runs; walking ground on every area | Systems engineer | `game/engine/ui/hudtab.mjs`, `game/engine/tools/playtime.mjs`, `game/engine/tools/marks-check.mjs` | W1-A | New clock check passes over both shell runs; playtime reports words for random runs; marks-check fails on q_brack_kitchen before the fix and passes after | U7, S24, M3 check |
| W2-B | Captions: the system, the Settings row, the caption track format | UI lead | `game/engine/ui/captions.mjs` (new), `game/engine/ui/settings.mjs` | W1-B | Caption coverage check with a planted uncaptioned sound failing | X3 (system), CI3 (format) |
| W2-C | Remapping everywhere, hold or toggle, keyboard-only and pad-only shell runs | UI lead (second run) | `game/engine/ui/bindings.mjs`, `game/engine/ui/input.mjs`, `game/engine/tools/quota-shell.mjs` | W1-A | quota-shell `--input key` and `--input pad` finish era 2 on both classes; rebinding test over every action | C1, C3, C4, C5 |
| W2-D | Figures read in every Quota room; warden clips; the brack kitchen's ground | Character and light lead | `characters/runtime/`, `characters/anim/`, `content/q_brack_kitchen/place.json` and the other Quota place files (tracked in git as part of this package) | W1-A's Quota views; the current characters/ work landed | visual-check Quota views pass; clip coverage test passes; `git ls-files 'content/q_*'` lists every place.json | U6, A4, M3, B3 (place files) |
| W2-E | The native shell made whole: file bridge to filestore, window modes, frame cap, build id, optional Steamworks, depot builder; the Deck spike | Native engineer | `shell/`, `tools/package.mjs` (new) | W1-C, W1-D, D3, D7 | Shell smoke per mode; depot scan; Deck timed run with captures | B1, B2, B7, B8, B10, part of B9 |
| W2-F | Era 1 written, The Exchange, to design/eras/era1 | Story lead | `content/era1/` (new) | W1-F, D5, sample lines approved | validate 0 and 0; harness FINISHED per class; witnesscheck for Ilo's witness; Articulate gate | S1 (text) |
| W2-G | Inner arena reachable from the story: era 2's hinge calls into the inner fight and back | Combat engineer, touches `ui/play.mjs` | `game/engine/combat/arena/`, `game/engine/ui/play.mjs` (sole holder this wave) | W1-B landed | Harness route through the inner fight on both classes; flawcheck and notallycheck pass | S18 (hinge) |

**Wave 3: era 1 playable, accessibility checks, the art pipeline starts.**

| ID | Package | Owner | Files owned | Entry | Exit checks | Closes |
|---|---|---|---|---|---|---|
| W3-A | flashcheck over shell captures; colour-blind and greyscale passes | Art and sensory director with QA | `game/engine/tools/flashcheck.mjs`, `game/engine/tools/cvdcheck.mjs` (new) | W1-A | Each tool's controls fail as they must; both pass on era 2 stills | X1, X7, X8 |
| W3-B | Accessibility settings: haptics slider, scene notes, steady world, fight speed, story setting | UI lead with the combat engineer | `game/engine/ui/settings.mjs`, `game/engine/ui/prefs.mjs`, `game/engine/combat/sim/speed.mjs` (new) | W2-B | Settings test lists every required row; doorbench at each fight speed; a stepped-past scene noted neutrally | U10, X12, X13, X15 |
| W3-C | Era 1 plates and wiring | Rendering lead | `render/places/q1_*`, `content/q1_*`, `game/engine/wiring/era1-areas.lwd` | W2-F | Plates locked; validate with wiring; shell stills on a plate for every era 1 scene | S1 (wired), U5 era 1 |
| W3-D | Era 3 written, Allocation | Story lead | `content/era3/` (new) | W1-F; era 1 accepted | As W2-F | S3 (text) |
| W3-E | Art pipeline, first pass under D1: the era 2 cast's faces and the first inner bosses to the shipped bar | Head sculptor and character lead | `characters/cast/`, `characters/forge/`, `characters/portraits-quota/` | D1 | HEAD-BOUNDS gate on every head; blind distinctness test; portraits looked at | A5, part of A9 |
| W3-F | Load-time tool and the input-to-visible bound | Performance engineer | `tools/loadtime.mjs` (new), `characters/runtime/figpool.mjs` | W1-A | loadtime measures three bounds; bench "shown" under its bound in talk and play, on a quiet machine | F3, F5 |
| W3-G | Audio into the shell: cues on scene, lens and fight changes | Audio lead, touches `ui/play.mjs` | `game/engine/audio/web/`, `game/engine/ui/audiohook.mjs` (new), `ui/play.mjs` (sole holder) | W2-G done | Cue test in the shell; loudness gate on two scenes | AU1, part of AU3 |

**Waves 4 to 9: the long game.** Each era follows the same five packages (design is done in W1-F):
write (story lead, `content/eraN/`), plates and wiring (rendering lead), cast and dress (head sculptor,
`characters/cast/eraN.mjs`), systems the era needs (gameplay engineer: rules, fates, props, lore for that
era in `content/eraN/` records only after the writer's pass, coordinated by turns), and sound (audio lead,
`audio/pieces/eraN/`). One era's write runs beside the previous era's plates.

| Wave | Packages (parallel within the wave) | Closes |
|---|---|---|
| 4 | Era 3 plates, cast, systems; era 4 written; inner arena bosses 8 to 10 (Fond of Them, Under the Goats, The Long Barn) as data and forms; perspective pair "the house"; era 2 classes 3 and 4 if D5 says six | S3, S4 (text), K10 part, S18 part, K11 part |
| 5 | Era 4 plates, cast, systems; era 5 written in two runs (to the vote; the clearance day and the ending); voices under D4; inner bosses 11 and 12 and the Descent; era 2 classes 5 and 6 | S4, S5 (text), AU4, S18 |
| 6 | Era 5 plates, cast, systems; the clearance-day fight (Clearance Sergeant, talk-out by what was carried); endingcheck; complicitycheck; world record as table objects; the sensitivity read acted on (D6) | S5, S19, K13, K15, S22, S21 |
| 7 | Full-game harness to the ending on every class; witnesses for eras 1, 3, 4, 5 checked; the community model at full scale (R1 to R23); ambience and footsteps for every place; cinematics 4.1 to 4.5 | B11, S8, S12, K1, AU2, CI2 |
| 8 | Store art and trailer; achievements; credits and licences; content survey draft; AI disclosure audit; German-law check; strings extraction dry run | R2 to R9, U14 |
| 9 | Playtest rounds 0 to 2 run by the author; fix packages for what they find; quiet-machine bench of every scene; Deck checklist; the native build played start to end with saves on disk | B13, B14, B9, F1, F2, S13, S16 |

**Parallel at a glance.** Waves 1, 2 and 3 hold 6, 7 and 7 packages. From wave 4, an era's five
packages run beside the next era's writing, so four to six agents work at once. `ui/play.mjs` has one
holder per wave. `content/quota/` has one holder at a time. Packages in different eras never share a file.

## 7. Effort, honestly

- **Count.** Waves 1 to 3 are 20 packages. Each later era needs about 12 to 18 package runs (writing
  alone took era 2 several runs for 194 nodes, and its plates, cast and systems took more), so eras 1, 3,
  4 and 5 are about 50 to 70 runs. The platform, accessibility, audio, cinematics and store work add about
  35 to 50. Total: about 105 to 140 package runs. Confidence low; the art decision (D1) moves it most.
- **In waves.** At five to seven agents at once, about 18 to 26 waves of agent work. Wave 9's playtests
  run on people's time and cannot be compressed by agents; nor can the sensitivity read (S21), the
  author's approvals (S14), or the Steam steps (R1).
- **What finishes first.** A compiled era 2 (native shell, saves on disk, boot, sound, accessibility
  rows) is reachable by the end of wave 3. A complete story is the long pole.

## 8. The biggest risks

1. **The art pipeline.** Code-generated heads read as placeholders: 5 of 22 heads inside their bounds,
   the cast too alike (A5), the inner bosses flat 2D forms with little animation (A9). The coordinator
   flagged a possible move to a hand-authored pipeline of Blender sculpts and painted portraits, pending
   the author's decision (D1). Every era multiplies this: eras 1, 3, 4 and 5 need children, the old and
   five eras of dress. Until D1, any cast work for new eras may be redone.
2. **The native shell and the Deck.** Nothing exists (B1). The recommended route (own shell on WebView2)
   has two unknowns from memory: the Steam overlay over a web view, and WebView2 under Proton on the Deck
   (STEAM-READINESS section 2, low to moderate confidence). If the Deck spike fails, the fallback breaks
   the shipped-dependency rule or drops Linux at launch.
3. **Voice and audio.** The score exists and is measured, but no sound plays in the game (AU1), and a
   narrative game on Steam without sound reads as unfinished in its first minute (STEAM-READINESS section
   6). Generated voices need Steam's AI disclosure and the author's approval (R3, D4); 971 Quota lines
   carry no voice direction (dirlint).
4. **Story volume and the author's gates.** Four eras of five are unwritten, each scene's sample lines
   wait on the author, and the sensitivity read gates M2. The writing cannot outrun approvals.
5. **Measurement on a shared machine.** Every frame time today is NOT QUIET, and the Quota's wide square
   cannot be benched (F1). Fluidity claims need a quiet window that the parallel waves themselves consume.
6. **Docs ahead of the tree.** CINEMATICS.md marks the boot sequence BUILT while its code and tests are
   absent from dev (U3), and the title still shows a topic list that RATING.md says is gone (U2). Rows
   here move on check runs only for this reason.
7. **Reproducibility.** The Quota's place files are untracked (B3); a clean clone cannot build era 2.

## Does not prove

A row at PASS proves its check passed on this machine today, on era 2. It does not prove the story moves
anyone, that the persecution is handled well, or that strangers finish the game; only readers, the
sensitivity read and playtests can show those (S13, S21, B14). The effort estimate is a judgement with
low confidence, and the wave plan assumes the author's decisions in wave 0 arrive before the waves that
need them.
