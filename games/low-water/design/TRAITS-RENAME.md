<!-- writing-profile: procedure -->
# The traits rename: the checklist

The traits pass, 2026-10-23 (design/TRAITS.md). The global rule: never rename by blind search and replace. Every row
below was changed by hand or by a script that asserted one match per edit, and each row names its check.

## 1. Names: ids kept, names changed

The ids stay because about 300 voice lines, the self-lie records, the checks, the combat build, the inner traces and
saves read them. Only the shown name and what the trait is changed.

| Id | Old name | New name | Under | Being (boss id) |
|---|---|---|---|---|
| coat | THE COAT | HARDNESS | | the HARDNESS gate |
| nose | THE NOSE | FEAR | | the FEAR gate |
| pen | THE PEN | SUSPICION | | the SUSPICION gate |
| hat | THE HAT | AUTHORITY | | the AUTHORITY gate |
| sum | HEFT (SUM before 2026-10-23) | PRUDENCE | pen | prudence (was received) |
| precedent | PRECEDENT | LOYALTY | pen | order |
| smallprint | SMALL PRINT | COWARDICE | pen | barn |
| carbon | CARBON | GUILT | pen | figure |
| knees | KNEES | WEARINESS | coat | only |
| ballast | BALLAST | OBEDIENCE | coat | forty |
| pride | PRIDE | VANITY | coat | fond |
| grip | GRIP | APPETITE | coat | friday |
| condolence | CONDOLENCE | TENDERNESS | hat | withme |
| formletter | FORM LETTER | CONTEMPT | hat | check |
| chit | THE CHIT | JEALOUSY | hat | jealousy (new) |
| hearsay | HEARSAY | SPITE | hat | says |
| smell | SMELL | DISGUST | nose | goats |
| dark | THE DARK | DREAD | nose | dread (new) |
| undertow | UNDERTOW | SHAME | nose | shame (new) |
| salt | SALT | NERVE | nose | nearest |

The `short:` of each compartment is now its pillar (ENDURE, EVADE, READ, END).

## 2. Where the names live, and the check on each

| Done | Place | What changed | Check |
|---|---|---|---|
| x | `content/quota/q_rules.lwd` | `@attr` and `@skill` name, short, about (what each does, in a fight and out) | `tests/traits.test.mjs`: the ruleset and `combat/data/traits.mjs` agree; no name is paper |
| x | `game/engine/combat/data/traits.mjs` | new: the table of record | the same test; `combat/data/flaws.mjs` throws if a boss names a trait the table does not give it |
| x | `content/quota/*.lwd` `@selflie about:` | the voice word in caps (SUM, PRIDE, BALLAST, SMALL PRINT, SMELL, SPEAKING UP, ORDER) | validate 0 errors; grep for the old caps names over content/quota returns nothing |
| x | `content/quota/q_dreams.lwd` | the dream's two readings (THE DARK, SUM) | the same grep |
| x | `content/quota` self-lie lines and their witness echoes | eight self-lies re-voiced to the trait they become (section 4) | witnesscheck, fatecheck, the harness (section 5 of COMPLETION) |
| x | `content/quota` comments in e1_board, e3_town, e4_night, e4_town | the voice named in the hinge's comment | grep |
| x | `combat/data/flaws-*.mjs` | `trait`, `town` (shown name), the lines' voices, `force.dc` keyed by the trait | flawcheck (S4: force hardens its own trait), innercheck R3 |
| x | `combat/data/host.mjs` | the Accuser's voice `clerk` becomes `accuser`; the whisper's voices | innercheck R3; the captions |
| x | `combat/arena/hud.mjs` | captions read the trait's name, not the voice id | innercheck R3 (`checkCaptions`); its control (voices passed through) still fails |
| x | `combat/data/build.mjs`, `combat/roster.mjs` | comments | read |
| x | `ui/create.mjs`, `ui/build.mjs`, `ui/buildstats.mjs`, `ui/ux.css` | the compartment lines from the table; the character page says what each trait does and what the night last did to it | still of the page (TRAITS.md section 8) |
| x | `combat/arena/forms*.mjs` | the `notice` form and feature become `horn`; `clerk` becomes `accuser` and the filing cabinet a coat stand; `received` form replaced by `prudence` (forms5) | inner-capture F1, silhouettes |
| x | `combat/data/fights-a.mjs`, `combat/data/props.mjs` | Everybody Says' first phase "the notice" becomes "the crier"; the verge's prop "the notice post" becomes "the crier's post" | traces regenerated |
| x | `design/SYSTEMS-FULL.md` 19.2 | the table of compartments and voices | read |
| x | `design/DEVICE-AUDIT.md`, `design/device-audit/engine.md` rows 19 and 20 | closed | read |
| | `content/act1/rules.lwd` and the Gullet acts | not changed: the Gullet is cut and archived (decision D7); its names are history | none |
| | `game/engine/tests/traces/content/` | not changed: a frozen copy of content for the story trace tests | the trace tests |

## 3. Ids that had to change, and their migration

| Old id | New id | Why | Migration | Check |
|---|---|---|---|---|
| received (boss) | prudence | "Received and Found Correct" is a form of words on paper; the brief removes it | `combat/data/traits.mjs` `MIGRATE_FLAW`; `combat/innerhook.mjs` renames `G.state.inner.received` on first read and accepts `inner(received, ...)`; `combat/arena/inner.mjs` accepts the old id in `createInnerRun`, `innerend()` and `innerboon()` | `tests/traits.test.mjs`, "the old id still works" |
| received.* (moves) | prudence.* | the move ids carried the boss id | none needed: moves are rebuilt from data on every load; no save holds a move id | innerduel.json and the traces regenerated |
| q.inner.received (node) | q.inner.prudence | the node carried the boss id | none: a cost-0 node a save cannot stop on | validate; `tests/innerhinge.test.mjs` |
| notice (form, feature) | horn | the crier's horn is a voice, not a notice | none: drawn each frame | inner-capture F1 |
| clerk (form, voice) | accuser | the Accuser reads nothing | none | innercheck R3 |

## 4. Self-lies re-voiced to the trait they become

| Self-lie | Line (first words) | Was | Now | Level check kept |
|---|---|---|---|---|
| q.sl.add_up | "The arm says what it says." | sum | knees (WEARINESS) | dc 2; Ned's knees 2 |
| q.sl.check | "Nobody's going to climb up and look behind them." | pride, dc 3 | formletter (CONTEMPT), dc 2 | Will's formletter 2, Ned's 4 |
| q.sl.never_hand | "You've never once lifted a hand to that boy." | pride | grip (APPETITE) | dc 2; Will's grip 6 |
| q.sl.order | "Somebody had to keep order." | ballast | precedent (LOYALTY) | dc 2; Will's precedent 2 |
| e3.sl.figure | "Your dad was the one honest man in that building." | pride | carbon (GUILT) | dc 2; Ned's carbon 6 |
| e3.sl.order | "Somebody has to keep them back off the fire." | ballast | precedent (LOYALTY) | dc 2 |
| e5.sl.says | "Everybody's sharing everything." | undertow | hearsay (SPITE) | dc 2; hearsay 2 to 3 |
| e5.sl.order | "Somebody has to keep order on Mill Street." | ballast | precedent (LOYALTY) | dc 2 |

Each one's witness echo was re-voiced with it, so the line comes back in the same voice it was first said in.
