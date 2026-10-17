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
