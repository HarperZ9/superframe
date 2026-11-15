<!-- writing-profile: research -->
# Spine plan 6: the build plan, and questions for the author

Part of [../SPINE-PLAN.md](../SPINE-PLAN.md). Phases run in order unless marked parallel. Every phase
ends with the checks named; a phase is not done on a green run alone, because a passing checker can
accept a wrong story. Each phase therefore also names what its checks do not prove. Effort is S, M, L as
in 05-STRUCTURE.md; moderate confidence.

**Build status, 2026-10-22 (game director).** Phase 0: answered under the author's blanket approval
(`DECISIONS-2026-10-22.md`). Phases 1 to 3 built for era 2: the design documents carry the spine; the engine has
`@fate`, `pressure()`, `fate()`, `world/witness.mjs` and save version 5; `tools/fatecheck.mjs` and
`tools/witnesscheck.mjs` with controls in tests; the slice is written to the spine (PROGRESS steps 176 to 179).
Not built: the world record as objects (worldcheck unchanged), `complicitycheck`, the inner arena (waits for the
mechanics lead), Dorrah and Ilo on the hill, the cold reads, the author's approval of the sample lines.

## Phase 0: the author's answers (blocks everything)

- The questions in section 2, answered and recorded verbatim with the date in `design/state/story.md`.
- **Check:** each answer quoted, dated, and linked from this file. **Effort:** the author's time.

## Phase 1: design documents follow the spine (no code, no content)

Depends on phase 0. Runs after the line-level pass on `content/quota/` lands, so citations are stable.

| Document | Change |
|---|---|
| `design/QUOTA-DESIGN.md` | The spine, the title decision, the persecution focus and the arena idea as decisions |
| `design/quota/02-HOUSEHOLDS.md` | Wounds as people (05-STRUCTURE.md section 4); the failing-parent arcs (section 8); the Hesh hiders per era |
| `design/quota/03-STORY.md` | Hinges on people; the witness interludes and the cold open; era 3 midpoint; era 5 testimony ending; replace beat 10 of era 5 |
| `design/quota/04-SYSTEMS.md` | Sections 2 and 6: `@fate` and pressure; the witness; the world record as table objects |
| `design/quota/05-ARENA.md` | The inner arena beside the yard (08-ARENA.md) |
| `design/quota/07-PRODUCTION.md` | Content warning additions; the sensitivity read widened (04-PERSECUTION.md section 8) |
| `design/THEMES.md` | A Quota page: the questions in human terms (`design/STORY-ASSESSMENT.md:273-284`) and the author's assumptions on trial (04-PERSECUTION.md section 9) |

**Checks:** `public/flywheel/scripts/check_writing.py --profile research` on each changed file; no em
dash; every `file:line` resolves (a short script that opens each cited path and line). **Does not
prove:** that the design is good. **Effort:** M.

## Phase 2: the engine (parallel with phase 3's drafting)

Depends on phase 1's record shapes.

| Piece | Files | Checks |
|---|---|---|
| Fates by people | `game/engine/world/community.mjs` (`@fate`, `pressure()`, refusal of household fate writes); `tools/fatecheck.mjs` | fatecheck with its two controls; `tests/community.test.mjs` updated from `R2>H1` (line 48); communitycheck's chains end in a node |
| The witness | `game/engine/world/witness.mjs` from `readback.mjs`; `ui/readbackpanel.mjs` retired; `save/save.mjs` version 5 | witnesscheck with its three controls; a version 4 fixture save with an open read-back migrates and finishes; `tests/worldrecord.test.mjs` unchanged and passing |
| World record as objects | `save/worldrecord.mjs` (`@worldobject`); `tools/worldcheck.mjs` | No player-facing run count or prior speaker; one trace per era |
| Complicity | `tools/complicitycheck.mjs` | Its control (a planted skill gain on `blame.people`) fails |
| The inner arena | `combat/arena/run.mjs` inner ladder; `@flaw`; `tools/flawcheck.mjs` | flawcheck with its controls; `tools/arenarun.mjs` on 24 seeds shows every flaw resolvable by its non-force route |

**Standing gates:** the LWD validator 0 errors and 0 warnings; eventcheck, exitcheck, clocklint;
lorecheck, discoursecheck, dreamcheck (hit-rate target dropped), perspectivecheck, propcheck, proplint
pass as they do today (`PROGRESS.md:257`). **Does not prove:** that a person feels the difference.
**Effort:** L.

## Phase 3: the slice written to the spine

Depends on phase 0 for every sample; on phase 2 for wiring. Each new scene's sample lines go to the
author for approval before the scene is written in full.

| Scene | Plan file |
|---|---|
| Cold open: Anni at forty and the tin | 02-WITNESS.md section 1 |
| The witness interlude, with the old man at the table | 02-WITNESS.md |
| The gate on Tilney Road (H1) | 03-FATES.md section 1 |
| Gedge at the yard (H2) | 03-FATES.md section 2 |
| The granary custody beat; the militia walk to the wicket | 03-FATES.md section 3 |
| The Sheaf on day 40 (joy, era 1's witness) | 05-STRUCTURE.md section 5 |
| The walk home (Hesh only) | 05-STRUCTURE.md section 7 |
| Dorrah and Ilo on the hill | 04-PERSECUTION.md section 4 |
| Taste lines at every meal; the body in the lettering hand | 05-STRUCTURE.md section 6 |
| Tomas with an edge at the post | 07-GRIP.md section 3 |
| The five flaws of the slice | 08-ARENA.md section 3 |

**Checks:** `articulate dialogue --voices design/voice-sheets/quota --gate`, 0 epigram shapes (the gate
used in step 158, `PROGRESS.md:228`); dialogue_lint; the read-aloud test of DIALOGUE-STANDARD; the
slur rule (a speaker with a history and a hearer); harness runs reach `q.end` on both classes with no
stall; playtime within the slice budget plus the new scenes (era 2 is 85 minutes in the full game,
`design/quota/03-STORY.md:13`). **Cold read:** two readers who have not seen the plan read the witness
interlude and the H2 scene and say, in their own words, what happened and how they felt; a reader who
summarises the theme back, or says they saw the turn coming, is a fail for that beat (07-GRIP.md
section 4). **Does not prove:** that it holds a player for five hours. **Effort:** L.

## Phase 4: senses and care (parallel with phase 3)

- The witness look (L8 era window, sound first); the inner arena's morph look; the held aftermath shot
  per era (04-PERSECUTION.md section 8).
- Scene notes setting; content warning text; captions for the witness's room sounds; the "About the
  history" menu page.
- **Checks:** the flash rule and its controls (`design/sensory/05-CARE.md:21-54`); captions for every
  sound with meaning; the steady-world option on the inner arena. **Effort:** M.

## Phase 5: the long game

Eras 1, 3, 4 and 5 designed to the spine and the persecution arc; carried words across eras; the era 3
midpoint; the era 5 death and its denial; the ending by testimony; end states as scenes.

- **Checks:** lorecheck extended to carried-word chains, with a target that the clearance-day talk-out
  is reachable on at least one route per class and that a chain breaks on at least one route (both
  readings stay open); fatecheck across all eras; the sensitivity read and a historian of genocide
  before M2 (`design/quota/07-PRODUCTION.md:64-68`).
- **Does not prove:** that the persecution is handled well. Only the readers can say that.
  **Effort:** L, several times over.

## Dependencies at a glance

Phase 0 blocks all. Phase 1 blocks 2 and 5. Phases 2, 3 and 4 run together once 1 lands, and 3's
wiring waits on 2. Phase 5 follows the slice's acceptance.

## 2. Open questions for the author

**The spine and the witness**
1. Anni at forty sits outside every era (year 38). Keep the interlude out of era time, or make the era 2
   witness Anni at twenty-two, inside era 3?
2. The Haldane years: Anni at fourteen in era 2 is born before era 1's wedding. Move era 2 to year 16, or
   make era 1 show a man already married? **ANSWERED 2026-10-22** by the author: "Out of wedlock." Anni
   stays fourteen and era 2 stays at year 12. Bet had her before the wedding, the register's father
   column is blank, and Ilo raised her as a Haldane. The father, asked of the author the same day ("You
   decide, and expand upon it deeply."), is Ned Furrowe, decided by the coordinator: see
   [09-ANNI.md](09-ANNI.md) for the accounts, the reveal and the inspector line's choices.
3. The player's own character, old, at the witness's table: yes? And may he tell her where Tomas lies?
4. Should the author's line, "Our explanations stop when we do, and the effects keep moving.", ever
   appear on screen, or stay in the structure only?
5. Title: one of the five in 01-SPINE.md, or another.

**Fates**
6. H1: does Bet decide, or Anni, by going?
7. H2: may a nine-year-old be taken at all, or does Gedge take Ilo, or does H2 go?
8. The militia line's walk to the wicket at the granary: keep it, with its risk?

**Persecution**
9. The peak: option A (era 2, plus a denied death in era 5) or option B (a later peak)?
10. Who dies in era 5, and does the clip show Danil Saro dead or hurt?
11. The era 3 midpoint: may Anni be the one who names a goat-Hesh family?
12. The ledger's margin note, "T.H. to the inspector, Weds." (`content/quota/q_props.lwd:82`): may it pay
    off as Mott logging the boy's visit for the office?
13. The corner is reachable only by blaming the Hesh (`content/quota/q_lore.lwd:46-53`). Add a second
    route, or keep it as the burden of the complicit?
14. Scene notes: may a player step past the H2 scene and the granary custody beat?
15. The sensitivity read widened to communities that survived genocide and ethnic cleansing, and a
    historian: who arranges it?
16. The slice's review with a doubled quota and its passes mirror documented famine mechanisms. Keep,
    or vary further from the record?

**The inner arena**
17. Adopt the inner arena as designed in 08-ARENA.md?
18. May a hardened flaw fight on the player's side in a story fight?
19. Tag "Somebody had to keep order" as a self-lie, so it can become a flaw?
20. Does each era's protagonist get an inner arena, or only era 2's?

**Continuity**
21. Frank Mott's "father's page" would make him over a hundred in era 5. Grandfather's page instead?
22. The Orme lad whose coat Tomas wears: who is he to the Ormes?
