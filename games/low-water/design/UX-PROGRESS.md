<!-- writing-profile: research -->
# UI and UX: progress

UI and UX design lead. Started 2026-10-17 (machine clock 2026-10-16 22:00 PDT). Steps are numbered
and kept in order; each says what was done and where it landed.

1. **Read.** LOOK-BIBLE, LOOK-UNIFIED (exists; the environment art lead's R1 to R7 govern), CAMERA,
   SYSTEMS-FULL (sections 2 to 7, 17 to 19), STATE, NOTES-FOR-ENGINEER (latest replies to 05:01Z),
   the clean-room specs DIALOGUE-AND-VOICES and CHARACTER-PRESENTATION, and every file in
   `game/engine/ui/` plus the combat API the UI reads (`combat/encounter.mjs`, `combat/data/build.mjs`,
   `combat/sim/barks.mjs`, `rules/inventory.mjs`). Looked at every still in `game/engine/ui/shots/`.
   Reference games and quarantine folders not opened.
2. **Fonts measured.** Hanken Grotesk ships tabular digits (all ten 560 units); Conso is proportional
   (digit widths 632 to 1406 of 2048) and has no `tnum`. The shell sets every number in Conso, so
   columns of numbers do not align and the clock shifts as it ticks. Contrast measured for every ink
   on the paper (UX-AUDIT section 3).
3. **Audit written:** `design/UX-AUDIT.md`.
4. **System written:** `design/UI-SYSTEM.md` (type, values, paper, motion, layout, flows, checks, the
   build page, controls, settings, sound hooks).
5. **Author direction on min-maxing and weight** arrived mid-task (relayed 2026-10-17). Added UI-SYSTEM
   7.2a (two densities, every number before and after, planning and respec preview, side-by-side
   compare) and 7.2b (hit, block and catch responses in the strip). Read the combat engineer's live
   table (`combat/roster.mjs`, `data/build.mjs`, `data/body.mjs`, `data/tools.mjs`): every number the
   page needs comes out of pure functions; animation-speed scaling does not exist yet and is asked for.
6. **Files claimed** in NOTES-FOR-ENGINEER ("UI and UX lead, 2026-10-17 (22:16 local)").
7. **Built (shell, mine):** `ui/tokens.css`, `ui/ux.css`, `ui/strip.mjs`, `ui/hudtab.mjs`, `ui/bindings.mjs`,
   `ui/buildstats.mjs`, `ui/build.mjs`, `ui/uxlab.mjs` with `uxlab.html`.
8. **Built (engineer's files, marked `// ux:`):** styles, scene (HUD tab, tallies), talk (check tags, voice
   lines), play (chips with glyphs, minutes on Go and Wait, slide state, fresh lines), fightlayer (strip,
   barks, pause, pause on blur, shake, rumble, no result card, input guard), fightkeys (bindings, mouse,
   pad shoulder layout, tool art), daybook (Build page, page actions, header without level), input (View
   opens the Daybook, Y and N are the alt key), focus (hover only on real movement, slid panels skipped),
   prefs and settings (interface scale, shake, rumble, pause on blur, Controls with rebinding), title
   (developer line behind `?dev`, visible reason on Continue, device prompts), shots (`window.__shell`,
   `?motion`).
9. **Tested** headless at Idle priority (`design/ux/idle.sh`, `uxshots.py`, `cases.py`): keyboard, mouse
   and a simulated pad on title, world, talk, checks at 720p, Deck and 4K, the talk-panel slide, the
   Daybook, a fight (strip responses, barks, pause and resume by Esc, Start and B, pad and key strikes,
   rumble), Settings rebinding, the Build page (plan by key and pad, density by Y and N, compare, bench),
   and combat's own harness. Engine tests 110 of 110. Stills and slowed motion sheets in
   `design/ux/shots/` (PNG, not committed; the repo is text only).
10. **Looked at every still** and fixed what they showed: notches wrapping, chips under the talk panel in a
    fight, toasts over the chips, the compare table clipped, the book too narrow at 1080p, the plan
    density not read at load, a redraw that removed the focused bench button.
11. **Findings sent:** NOTES 22:45 (fight framing under the strip, shake ownership, sneaks and runs on the
    plate, chapter pages; the NOSE i-frame drop to the combat engineer; A2 to the art lead).
12. **Round 2** (coordinator, 2026-10-17: the engine shell ships; order: sneaks and runs on the plate
    with fight framing, creation over a plate, the inked Margin page and chapter pages, a map and wait
    until low water; harden the catch check). Sneaks and Tide Runs now play on the plate
    (`ui/sneaklayer.mjs`, `ui/runlayer.mjs`, `ui/worldlayer.mjs`); fight, sneak and run framing keeps
    figures clear of the strip and the HUD tab (`clearOfPaper`). Stills: `sneak-world-2.png`,
    `run-world-2.png`, `fight-frame.png`.
13. **Build page on preview().** Combat shipped frames in `preview()` and floored NOSE i-frames
    (6e30fab). `ui/buildstats.mjs` now reads only `preview()`; lost rows and one input asked for.
14. **Catch check hardened.** The strip keeps every exchange line in `data-history`; the test freezes the
    loop before emitting and reads the history and the screen (`catch-hard`, both pass).
15. **Creation over the painted scene** (`ui/create.mjs`, rebuilt): Precedents as cards with their claims,
    compartments as pips with pillar words, the first note; a side page shows the focused choice in a
    fight from `preview()`; only the Kit's instruments can be trusted; Begin takes focus after a choice.
    Stills `create-act1-pad.png`, `create-act1-720.png`.
16. **The inked page and chapter pages** (`ui/inked.mjs`): a Daybook leaf when a note inks (its `done:`
    text, its effect in words), queued for a quiet moment; a chapter-page leaf on a `chapter` event; the
    Build page inks compartment raises once the engine pays chapter pages. Still `inked-leaf.png`.
17. **Map and waiting** (`ui/map.mjs`, `ui/waiting.mjs`): the Map page draws districts at their `map:`
    points, walked ways in ink and the rest in pencil, focus describes each; "Wait for low water" (or high)
    moves the night in ten-minute steps and stops at the turn, at anything the night has to say, or at
    three hours. Stills `map-act1-focus.png`, `wait-turn.png`.
18. **Portraits** (coordinator, 2026-10-17): slot built (`ui/portrait.mjs`), UI-SYSTEM 7.5, the character
    lead's format agreed with three asks. Setting "Portraits in conversation".
19. **Regression**: 92 of 93 checks pass. The one failure is the portrait check: at 23:24 the character
    lead's portrait folder was being re-baked with no index file in it; the same check passed against the
    lane index before the re-bake. Engine tests 116 of 116.
20. **No gender for Lamb** (standing writing rule, relayed 2026-10-17): every UI string, prompt,
    accessibility label and comment I wrote was checked; three comments fixed; one in the engineer's
    `play.mjs` flagged. **Visual polish paused** until the art direction is chosen (design/ART-DIRECTION.md);
    panel look, palette and portraits will be revisited then.
21. **Direction keys** (systems engineer's question, relayed 2026-10-17): walk, scene and menu modes in
    `ui/input.mjs`, set by the play screen; WASD and the stick walk, arrows and the d-pad move focus; every
    direction moves focus behind a panel. Tested with keyboard and a simulated pad; scenes and menus re-run
    clean.
22. **Live talk** (coordinator, 2026-10-17): pad A talks in walk mode (F on the keyboard), N or Y calls a
    lie; a Talk chip with its key when someone is faced. The panel measured in a live world
    (`design/ux/livetalk_eval.py`): slim panel by default, framing on the free plate, edge marks for
    anyone behind the panel or off screen (12 of 12), a draining lie tab (6 of 6). Decision and numbers in
    UI-SYSTEM 7.6. Tests: `pad-talk`, `keys-talk` (updated for walk-off in talk), `slide` (updated: Enter
    talks unless a row was chosen).
23. **Camera reads the free width itself** (systems engineer, 0d8812e): the per-frame `camera-talk-x` write in
    `ui/livetalk.mjs` is deleted. Framing re-checked at three resolutions and both widths: subject at 0.45 to
    0.46 of the free width (12 of 12), rule untouched, no page errors. Fixed a quoting error I had committed
    in `livetalk_eval.py` (af7ddb6). Reported a character-drawer crash on unknown figure ids.
24. **Line of sight in sneaks** (systems engineer, 55e76ee): `ui/sneaklayer.mjs` sets `G.stealth.sight` through
    the scene's stage and `sightClear` while a sneak plays on a plate, and clears it when the sneak ends.
    Tested: set during, null after, no page errors; sneak, scene-key and stepped-sneak cases re-run clean.
