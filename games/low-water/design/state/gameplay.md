<!-- writing-profile: research -->
# Gameplay engineer's notes

The gameplay engineer's notes for the other leads (coordinator's rule, 2026-10-22: each lead writes only its own
file under design/state/; the shared design/STATE.md keeps the history). I own the mechanics; the look is the art
leads'. I supply state and events, listed here per system with the records that drive them.

## Mechanics from the author's direction of 2026-10-22
The author, verbatim: "I think we should continue work on our shaders and effects techniques, and implement tons
of new rendering and visual features. As well as game mechanics." The coordinator's order for the mechanics, from
design/quota/04-SYSTEMS.md and PITCHES 3a to 3c: examine and props; the lore graph and lorecheck; the world record
across runs; the read-back as a mechanic with the self-deception layer; rumour and discourse; dreams; perspective
chapters. Each lands with tests, a control and a harness check.

### 1. Examine and props (2026-10-22)
- **Records.** `@prop` (world/props.mjs): `name`, `place`, `mark` (a plate mark id), `tells` (person, household or
  era: the object rule), `verb` (the label), and `state: <era> <id> [? condition] | text {gives: lore, do: effects}`.
  The first state of the current era whose condition holds is the prop's state; the era is `var.era`, else `@meta
  era` (the slice says 2), and `era()` reads it. Content: content/quota/q_props.lwd, twelve props. Five persist
  across the five eras with a state each (the Haldane table, the bowls, the street sign, the exchange scale, the
  burial ground), from the PITCHES 3c table; seven are the slice's rooms. The era 2 texts are drafts for the story
  lead to rewrite in the slice's voice.
- **For the art leads.** Each prop is an `@object` with one verb, `examine`, offered at its place like the other
  verbs (`G.verbs.list()`), so the shell's existing verb list shows it. `G.props.state(id)` gives the state id
  for a plate variant or a prop layer (the bowls: five, four, three; the table: laid, fewer). Event:
  `prop.examine { id, state, era, tells, place }`. Flags: `seen.<prop>` and `seen.<prop>.<state>`.
- **Marks.** The props stand on the plates' existing marks (q_haldane `table` and `ration_card`, q_returns
  `ledger` and `map`, q_furrowe_kitchen `good_hat`, q_brack_kitchen `rifle`, q_post `board`). The street sign
  (q_furrowe_door), the scale and the burial ground (the tower over the square), and the cell log (q_cells) have
  no plate yet; proplint warns until they do, and then needs a mark named on each.
- **Checks.** `tools/proplint.mjs` (static) and `tools/propcheck.mjs` (played). On the slice: proplint 12 props, 0
  errors, 4 warnings (the plates not yet made); propcheck over 18 runs: every prop at a scene's place seen; the
  street sign is free roam only; the burial ground's corner state and the cell log's Haldane entry are reached by
  no run (they need a route that blames the Hesh with Tomas held, which the harness has not got yet).

### 2. The lore graph and lorecheck (2026-10-22)
- **Records.** `@lore` (world/lore.mjs): `chain`, `layer` (surface, deep, hidden), `where` (prop <id> [states], node
  <id>, record <type>; repeatable), `requires` (class <value>, lore <id>, choice <condition>, prior <fact>;
  repeatable), `gives` (facts kept for later runs), `about` (for designers; the game shows nothing of it). `@chain`:
  `name`, `route: <one-run | two-classes | across-runs> | fragments`. `@meta class-var` names the class variable.
- **The missing-Tomas chain** (content/quota/q_lore.lwd): six fragments. Surface: the Haldane bowls, four or three,
  a week later. Deep: the district ledger (inspector), the notebook on the hill (inspector), the cell log
  (militia). Hidden: the unmarked corner (any class that blamed the Hesh; in the slice the inspector, told by Will
  on the steps of the Crown, new scene q.coda.corner, reached from q.coda.own), and the stone in the corner that
  reads T. HALDANE on a later run once an earlier run found the cell log. Routes: two-classes (bowls, ledger, cell
  log), one-run (bowls, ledger, corner), across-runs (the stone).
- **Story lead:** q.coda.corner and its hook (one `alt:` in q.coda.own) are drafts in my file for you to rewrite.
- **Events and state:** `lore.found { id, layer, chain, via }`, flag `lore.<id>`, `G.lore.found()` (a Daybook or a
  journal can list what the player has found, if the UI lead wants one); `fact.kept { id, from }`.
- **Checks.** `tools/lorecheck.mjs`: lint 6 fragments, 0 problems; played: 22 fresh runs and 8 seeded, every
  fragment found, all three routes complete, the two-class route held whole by no single run. Two policy routes
  added for it (tools/quota/policy.mjs): inspector_hill and inspector_blamed_held.

### 3. The world record across runs (2026-10-22)
- **What it keeps** (save/worldrecord.mjs): per finished run, its class, end, the lore facts it kept, each
  `@worldfact` whose condition held at the end (content/quota/q_record.lwd: Tomas dead, Anni at the home, Will
  down), the households record events fell on, its lies, the stones, the `@meta world-keep` variables, and the
  line its character said (the last option that set a said.* flag matching `@meta world-line`; the slice quotes
  the district office report).
- **How it is stored, local only.** Two copies in the storage the saves use (browser localStorage in the game; a
  folder of files in the harness): `lw.world.<story>` and `lw.world.<story>.b`, each JSON `{ format:
  "low-water.world", version: 1, story, runs, sum }`, sum a hash of the runs. Neither is a save slot, so deleting a
  slot or starting a new game leaves them. Each read checks both: a copy missing, unreadable or edited (its sum
  fails) is rewritten from the other. Loading an older save takes nothing back: the record sits outside the save
  state and each run is written once, by its run id, at its end. Clearing the site's data in the browser clears
  both; that is the only way, and it is the player's. Nothing is sent anywhere.
- **The next run, whatever its class**, starts from it: `prior(fact)` for every fact earlier runs kept, and the
  variables prior_line, prior_who, prior_stones, prior_runs. In the slice: the burial ground shows a blank stone
  once an earlier run left Tomas dead, and the name once an earlier run found the cell log; the district board at
  the post has the last character's report chalked under the Arlen notice, "the inspector said that" or "the
  militia said that". The table in the antique shop is era 5 content; the record keeps what it needs.
- **For the UI lead:** the shell installs it in `newGame` for a story that keeps one (`@meta world-keep` or
  `@worldfact` records). Event `world.recorded { run }` at a run's end.
- **Checks.** `tools/worldcheck.mjs` plays each class into a fresh record and the other class after it, and
  checks the entry, the seeding, and survival of a deleted slot, a deleted copy and a hand-edited copy: every
  check passes. tests/worldrecord.test.mjs plays the same through the real saves, including an older save loaded.

### 4. The read-back as a mechanic, with the self-deception layer (2026-10-22)
- **What it is** (world/readback.mjs): a document in two columns, what you told yourself and what happened, with a
  time and a place on each row, in clock order. Three kinds of row: a self-lie the character heard beside what
  the `@selflie` record says happened; words the character chose (an option that set a said.* flag with a `@said`
  record), quoted word for word with the marker `{said: <flag>}`, beside what happened; and authored rows of the
  `@readback` record. A `happened:` line with no condition is a fallback, used only when no conditioned line holds.
- **The self-deception layer.** A voice line tagged `{self: <id>}` is a self-lie. The slice has five, all the story
  lead's lines that the old read-back already named: SUM on the signed sheet and on adding up what they send,
  PRIDE on nobody coming to check and on never lifting a hand to the boy, BALLAST on the forty carts. Event
  `self.lie { id, voice, node }` when one is heard: the cue for the rendering leads' per-figure blur of what the
  character won't see (PITCHES, rule 3). Event `self.restored { id }` when its row is read.
- **Unskippable.** `G.readback.next(now)` shows the next row only after the last has had its reading time (0.6 s
  plus 0.25 s a word); `close()` refuses until every row is read. The panel (ui/readbackpanel.mjs, plain paper,
  the UI lead's to restyle) takes the focus, ignores go back, and reads itself at that pace. A scene opens it
  with `readback(<id>)`; q.readback now does, and its lines moved to content/quota/q_readback.lwd.
- **Story lead:** the rows are your sentences. Mine, to rewrite: the cart that never came, the promise and the
  tally, Tomas sent home, and the inflated reports' consequences. The read-back check counts the self-lies
  against all the voice lines a class hears: about three in ten for both classes over 22 runs, under the half
  that would make most inner lines lies, and over the quarter where I start to worry the trick wears thin.
- **Checks.** `tools/readbackcheck.mjs`: the lint (every tag names a `@selflie`, every `@selflie` is tagged, every
  `@said` flag is set by an option, every condition evaluates) and the play (22 runs: every heard self-lie paired
  with something that happened, every said row quoted with its marker, rows in order, the second row refused
  too soon, the document refused closing early). Stills: game/capture/quota-2026-10-22/rb-01-open.png and
  rb-02-later.png.
- **Shared files** (coordinator, 2026-10-22): the read-back panel's two lines in game/engine/ui/play.mjs and its
  rules in ui/ux.css were uncommitted in the main checkout and blocked the merge of feat/light. They are committed
  with that item (165, d644d77). From now on I commit shared engine files (play.mjs, ux.css and the like)
  as soon as each change works.

### 5. Rumour and discourse (2026-10-22)
- **Records.** `@claim` (world/discourse.mjs): `words` (the claim in the town's own words), `target` (a people),
  `victim` (the household it lands on), `carriers` (@carrier ids), `step`, `first` (provenance, for an
  examination later), `challenge-cost` (effects; `{self}` is the player's household, `@meta player-household`).
  Two new carriers beside the notices (content/quota/q_discourse.lwd): the Crown on Mill Street (`pub`) and the
  Furrow Church (`pulpit`), each with a rule that turns its volume into standing.hesh (R17p, fast; R17c, slow) and
  one that fades it (talk forgets, a sermon keeps). Streets carry `pub` and `pews` (q_community.lwd), and the wide
  lens shows both volumes.
- **The four acts.** `discourse(<act>, <claim>[, <carrier or street>[, <pasted claim>]])`, from an option or an
  object's verb: repeat (volume up; record spoken.position), challenge (volume down, the cost runs on the
  challenger's own household; record challenge.claim), tear (the notices' volume and the street's notices down;
  the office reposts in two days, rule Rr; record tear.notice; seen tearing sets noticed.<claim>), paste (as tear,
  with the pasted claim's words in the record; record paste.notice). The notices to act on: q.notice_post (the
  board at the post) and q.notice_exchange (under the street sign); the paste is offered once the true figure is
  in hand. Events: `discourse.act { act, claim, over, street, carrier, words, event }`; flags `did.<act>.<claim>`.
- **What it does, measured** (tools/discoursecheck.mjs, against a matched game where nobody spoke, both starting
  loud as after the blamed report, two weeks on): repeating at the post lowers standing.hesh in every street,
  most in Haldane Yard (-0.027); in the pub only on Mill Street and the square (-0.012); from the pulpit everywhere
  a little (-0.004 to -0.006). Challenging raises it by about as much. Tearing a notice helps only the street it
  was on (+0.010 on the road to Tarn Hollow), because the office posts it again. The numbers are the model's
  calibration and are small; the direction is what the check holds.
- **Story lead and UI lead:** no scene repeats or challenges in the pub or the church yet; the mechanic waits for
  one. The UI lead may want a mark on the notice once it is torn or pasted (`did.tear.cl.hesh_hoard`).

### 6. Dreams and premonition (2026-10-22)
- **What it is** (world/dreams.mjs): `@dream` records. A dream copies the community model, applies the dreamer's
  fear to the copy (`fear:` effects), runs the copy on for `days`, and shows the first `see:` line that holds in
  that future. The real model, the flags and the variables are untouched, and the projection emits nothing. When
  the day comes, the same lines are read in the real world: the dream matches or it does not, and the game never
  says which reading is right. `reading:` lines keep both (premonition, fear).
- **The slice** (content/quota/q_dreams.lwd, a draft for the story lead): q.dream.night, the night of day 41, in the
  chair by the stove, before the coda (one `alt:` at the top of q.coda). The dream looks a week ahead at the
  Haldane table through a fear that the Haldanes' food is a little lower than it is. THE DARK says it is what's
  coming; SUM says it is the day's count. The scene uses the dream look (`cmd: dream 0.8`, then `dream 0`).
- **For the art leads.** Event `dream.seen { id, seen, due }`; at the day, `dream.due { id, seen, now, matched }`,
  and when it matched the game sends `cmd dream cue` (the one-frame recognition paint/dream.mjs already answers).
  The read-back gets a row for each dream whose day came: what was dreamed beside what that day showed, no verdict.
- **Checks.** `tools/dreamcheck.mjs`: the lint (two readings at least, a day ahead at least, a see: line with no
  condition last, conditions and fear that run, a scene that dreams it, and a projection that leaves the real game
  as it was) and the play: both readings stay open only if the dream comes true on some runs and not on others.
  Over 22 runs it came true on 9 (inspector runs only); it did not on the other 13, and on none of the sergeant's
  runs. Why the sergeant's never match I have not traced yet.
- **A side effect on the read-back's count:** the dream's two inner voices are true lines, so the share of
  self-lies among the voice lines a class hears fell from about three in ten (section 4) to 24% for both classes.

### 7. Perspective chapters (2026-10-22)
- **What it is** (world/perspective.mjs): `@perspective` records (`name`, `archetype`, `figure`, `start`, `return`).
  `perspective(<id>)` on the chapter's first node puts the run's own person aside whole (sheet, pack, cabinet, the
  checks' memory, ink) and makes the chapter's from its archetype; `endperspective()` on its last node drops the
  chapter's and puts the run's own back. What the chapter did to the world stays: flags, variables, the model,
  the record; every record event made in it carries `pov: <id>`. A save in the middle loads back into the chapter.
  `pov()` reads the chapter being played. This is the first time two sheets run in one game.
- **The slice** (content/quota/q_perspective.lwd, a draft for the story lead): Bet Haldane outside the granary door,
  the same hour, on her own sheet (archetype q.bet), with her own figure, between the door and the night. The
  granary's endings now go to q.night (my node in q_dreams.lwd), which plays her chapter and then the dream and
  goes on to q.coda; q.coda itself is as the story lead wrote it again, so a scene or test that starts at the
  coda starts at the week's cut (story lead's report, 856b1fa: three model tests failed while the chapter was an
  `alt:` at the top of q.coda, because starting at q.coda stopped at Bet's choice; fixed this way). Her account disagrees with the read-back's on what mattered:
  "a man to show for the night" is the Orme lad, who shouted and went talking the whole way. She chooses to get
  Anni home or to stay and see who it was (`bet_door`).
- **For the art and UI leads.** Events `perspective.start { id, name, figure }` and `perspective.end { id }`;
  `G.playerFigure()` gives the chapter's figure while it lasts (bet), and the run's own after. The HUD and the
  daybook show whoever `G.state.sheet` is; whether a chapter wants its own frame is yours.
- **Checks.** `tools/perspectivecheck.mjs`: the lint (archetype, start node that says perspective(id), return node,
  and every path from the start ending the chapter before the act ends and going on to the return node) and the
  play (each run that played a chapter: the chapter's sheet and figure while it lasted, the run's own person and
  figure back unchanged after, the world keeping its choices; and every chapter played on some run).
- **Correction (2026-10-22, after the coordinator asked why the sergeant's dreams never came true).** A bug of
  mine: the dream was set against its day on the model's first rule event of that day, before the day's last
  rules had laid the table, so it read a table the day had not finished. It now settles once the day's whole tick
  has run. With that fixed, the inspector's dream came true on all 14 of his runs: one fear for both men made his
  a prophecy. Each dreamer now fears his own part in it: the inspector, that the requisition comes for what his
  signature says the barns owe (`shift(owed, 60, haldane_yard)`); the sergeant, the sacks he took (the Haldanes'
  food a little lower). The check is now per class: the inspector's dream comes true on 9 of 14 runs, the
  sergeant's on 6 of 8, so both readings stay open for both.

### Follow-ups (2026-10-22)
- **No tide on the plain, at its source.** The Quota's "What is here" offered "Wait for the turn at low water"
  (the glyph lead's contact sheet). A night with `tide: none` (world/night.mjs) now gives no turn terms
  (tide.dir, tide.next, tide.next.at, tide.next.h are undefined), the wait row returns nothing when the night has no
  sea (ui/waiting.mjs, beside the UI lead's HUD-config guard), and the Map page drops its tide line (ui/map.mjs).
  Low Water's nights keep theirs (a test checks both).
- **The fight drawer on plates with no arena.** I took the glyph lead's one-line fix (design/state/glyph.md) in
  characters/runtime/fightdrawer.mjs: the glyph skeleton and weapon move by the stage's offset as well as its
  height, so glyph fighters stand where the painted ones do. It checks out: `at` is the stage's world point for the
  fighter and `a.pos` its fight coordinates, so on a plate with an arena the shift is zero. The drawer test passes;
  the glyph lead's outline-agreement number is theirs to re-measure.
- **The close look on examine (2026-10-22).** From the author's reference (RENDER-INSPIRATION section 16). A `@prop`
  may carry `macro: [seconds] [zoom] [height]` (world/props.mjs; it needs a mark); six slice props do (the ledger,
  the map, Abel's hat, Will's rifle, the Haldane bowls, the ration card). Examining one pushes the camera in slowly on
  its plate mark, lifted to table height (ui/platecam.mjs `macro(at, { zoom, secs })`, `macroSettled()`), sends a
  shallow-focus request (event `camera.focus { at, range, prop }` and `globalThis.__lwFocusRequest`) for the effects
  lead's depth of field in game/engine/fx/post.mjs, and shows the text once the camera settles (ui/examinecam.mjs).
  Any key, click or pad press skips to the text; the next lets the look go, or it lets go by itself after six
  seconds. It never runs under reduced motion or with the new "Close looks" setting off.
- **Effects lead:** the focus request is there for your `dof(img, F, { focus })`; the focus depth is the distance
  along the plate camera's axis to `at`. Nothing reads it yet.
- **A fix found on the way.** An examined prop's text was invisible in free roam: a verb's lines go to the talk
  log, which is slid away while walking. Every examined prop's text now also shows as a note card in the margin,
  on paper, for its reading time (`propNote`, through ui/notify.mjs).
- **Seen in the shell** (game/capture/quota-2026-10-22/macro-00 to macro-03, Ned in the returns room): the push-in
  arrives 2.4 times closer on the counter, the lamp and the ledger's lit page; the note reads cleanly; any key lets
  the look go and the room comes back. The HUD fades while the camera is in close and returns after; I did not add
  that and have not traced which layer does it.

### For the tools architect (2026-10-22): what is content-agnostic in my systems, and what is not yet
The author's rule (verbatim, relayed): "building the tools, similar to how argon decided to do so, so it could
re-use them is a wise approach, so that the tools can be reutilized for other games, and engine expansions and
features". No code moves until your plan says so; this is where things stand.
- **Content-agnostic, the story as data:** the community model (world/community.mjs), the lenses
  (world/lens.mjs), props, lore, the read-back, discourse, dreams, perspective chapters (world/*.mjs, loaded
  together by world/storysystems.mjs; each does nothing for content without its records), the world record
  (save/worldrecord.mjs, keyed by story name), the close look (ui/examinecam.mjs, ui/readbackpanel.mjs), and every
  check (proplint, propcheck, lorecheck, worldcheck, readbackcheck, discoursecheck, dreamcheck, perspectivecheck,
  communitycheck). A story names its knobs in @meta: era, class-var, player-figure, player-household, world-keep,
  world-line, hud, hud-day, hud-weather, name-face, community-day and community.*. The harness reads the story
  through tools/use-story.mjs and tools/use-policy.mjs (STORY.acts, STORY.name, STORY.wiring, STORY.watch).
- **Fixed today:** proplint defaulted to the Quota's slice and wiring paths, and discoursecheck read the Quota's
  wiring by path. Both now take them from the story file (STORY.acts[0], STORY.wiring).
- **Conventions that are not knobs yet:** a quotable chosen line is an option that sets a said.* flag (the world
  record and @said records rely on the prefix); flags named seen.<prop>, lore.<id>, did.<act>.<claim>; the
  harness's attentive player and the read-back's unskippable check live in tools/quota/story.mjs (watch), which a
  new story would copy. The fight balance tools (doorbench) are the Quota's own.
- **Engine hooks other systems touch:** game.mjs (two lines for the story systems, the player figure asking
  G.povFigure first), world/verbs.mjs (the examine verb), dialogue/memory.mjs wrapped (visit, hear, say) by lore,
  the read-back, the world record and the model; ui/platecam.mjs (macro), ui/play.mjs (two panels, the verb path).
