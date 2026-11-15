<!-- writing-profile: research -->
# UI art lead: notes for the other owners

## 2026-10-21: the interface as part of the art (branch feat/ui)

Author direction, 2026-10-21, verbatim: "The UI is really plain and quite boring as well. It'd be cool to
have the typography maybe be some kind of like paint brush font, or I don't know, I guess just something
creative and not quite so clean and perfect. Maybe like, I like the notebook paper, but maybe faded and
burnt like an old RPG, something like that. I don't know, just something creative."

What a story gets when it names its era (`@meta ui-era` or `@meta era`, 1 to 5; `?era=N` overrides, `?era=0`
turns it off).
Low Water's Gullet acts name none, and every rule and module below stays inert for them.

- **Lettering, our own.** `ui/lettering/skeleton.mjs` draws every letter as strokes in a sign painter's
  order. `ui/lettering/brush.mjs` writes them with four tools: a round brush, a flat brush, a pointed pen
  and a rubber stamp. The bristle texture and the dry break are the painter's own `bristle()` from
  `paint/strokes.mjs`. A stroke starts loaded and ends dry, and each of three variants per letter moves
  the points, baseline, slant and weight. `tools/letterbake.mjs` bakes one grey atlas per tool
  (`ui/lettering/atlas/`, 2048 x 967, 173 to 384 KB each, under a second). `ui/letterer.mjs` sets
  titles, place names, chapter cards, speaker names, panel heads, stamps and the read-back's heading
  from the atlas. The words stay in the page for screen readers, glyph mode and the Plain text setting.
  No font was downloaded and no font was traced.
- **Paper.** `ui/paper.mjs` makes each panel's page from a seed: the era's stock, mottle and flecks,
  foxing, tea and water rings, thumb grime at the lower corners, and a torn edge. Burnt bites char black
  at the break and scorch brown inward, kept inside the padding. `ui/aged.mjs` gives every paper panel
  its own page, makes it again when the panel's size changes (one page a frame at most, no frame asked
  for while nothing waits), and lets the burn on the talk page and HUD creep when the record takes an
  event (`community.record`).
- **Eras** (`ui/era.css`). Era 1 is a merchant's ledger: cream stock, iron-gall ink, blue rules, a red
  double margin and pointed-pen headings. Era 2 is the ration form: grey pulp, typed HUD figures,
  carbon-blue narration, ticked form boxes for the choices and brush lettering. Era 3 is duplicated
  lists: violet spirit ink, spread and doubled, with flat-brush stencil headings. Era 4 is the bank's
  typed forms: green form rules and Conso heads. Era 5 is a photocopied notice: toner specks and copier
  edge shadow, with the HUD as a phone-screen fragment. Portraits sit in each era's mount: an oval, a
  pass photograph, a copy of a copy, a stapled form photo or a phone screen.
- **The read-back** (`@meta ui-readback: <node>`, else any node whose id ends `.readback`; `ui/recordmarks.mjs`). While the read-back node
  is open, the talk page reads as the record: typed in Conso, times in their own column, "What happened"
  set bold, "What you told yourself" in pencil, and the heading stamped.
- **Motion.** Ink settles into the page as a line is written. A stamp lands on the talk page when the
  record takes an event; the word is the era's (Entered, Received, Listed, Filed, Logged), and no stamp
  counts anything. The daybook page turns. The burn creeps over about a second. Reduced motion turns
  all of these off.
- **Glyph mode** (`ui/typed.mjs` through a hook in `paint/glyph/ui.mjs`). The panels are the era's
  printed matter: letterpress, typewriter with ribbon wear and light or hard keys, duplicator fading
  down the sheet, dot-matrix with sprocket holes, or a teleprinter copy with toner specks. Every
  character keeps at least 5.2:1 on its stock.
- **Accessibility.** Settings, Reading, Plain text: clean faces and clean paper. Text size and high
  contrast still apply. Body text stays in Hanken.
- **Painted portraits** (coordinator's item). `ui/portrait.mjs` reads
  `characters/portraits-painted/index.json` first and the old index under it, takes `<who>@e<era>` when
  the story has an era, and takes the mood from the line's direction tags (`moodOf`: a lie shows
  "lying", tender shows warm, anxious shows afraid). The slot's speaker is now the current line's
  speaker, falling back to the node's (performance engineer: the quay talk had none, so it showed no
  face).

- **The record's title block** (author reference, section 10 of `2026-10-21-x-research/RENDER-INSPIRATION-2026-10-21.md`,
  the specimen-sheet idiom). Under the read-back sits a drawing office's title block: the place, the day,
  the record number, a scale bar, and pen weights of 0.8 outside and 0.18 within. In era 4 it is a
  cyanotype, the bank's lending map. The drawing itself (era 1's exchange plans, era 3's allocation
  plans, era 4's lending map, era 5's ring-road clearance plan as the read-back's official drawing) is
  the painted lead's pen-and-glaze layer. When a drawing exists, the title block sits under it.

## 2026-10-22: round two, the old hands and each writer's own

Author verdict on round one, 2026-10-22, verbatim: "The lettering should be more olde timey, somewhat
gaelic/olde english and handwritten, with imperfections and variety. Some of the notes should appear
handwritten, so differences in writing is welcomed especially with character writing and letters."

- **Two display hands drawn from the historical scripts**, as strokes; no font was traced or downloaded.
  `ui/lettering/insular.mjs` is a half-uncial with wedge-headed stems, round bowls, the insular g, r, s,
  f and t, and no dot on i. Its majuscules are uncial for a, d, e, g, m and t, and print capitals with a
  wedge and swash otherwise. `ui/lettering/blackletter.mjs` is textura: broken strokes, minims with
  diagonal heads and feet, round d and s, and biting bows (`BLACK_KERN`). Its cadel capitals are the
  print capital broken into straight pulls, with a doubled hairline stem and a swash. Both have st and ct
  ligatures.
- **The broad nib** (`ui/lettering/nib.mjs`): the nib's edge swept along the stroke, so feet and heads end
  at the nib's angle. Imperfections, from how a dip pen behaves: ink pools at both ends, the tines catch
  and split for a moment, the hand wobbles, and a blot falls now and then. There are three atlases
  (`insular`, `textura`, and `bastarda`, the same skeleton slanted and loosened), four variants a letter,
  baked by `tools/letterbake.mjs`.
- **Eras.** Era 1 sets titles in textura and heads in insular. Era 2 sets both in the looser bastarda.
  Era 3 sets titles in bastarda and heads with the flat brush. In eras 1 to 3 a speaker's name is signed
  in their own hand where they have one (`--hand-own`). Eras 4 and 5 keep the print forms.
- **Each writer's hand.** The parameters live in the voice cast: `design/voice/quota-cast.json`, a new
  `hand` field on MOTT, NED, ABEL, ANNI, BET, TOMAS, PASK, HOLT, ILO and WILL. The game reads them from
  `ui/lettering/hands.json` (`node game/engine/tools/handsync.mjs`; a test keeps them in step). Joined
  hands use a school cursive skeleton (`cursive.mjs`) and print hands the print skeleton. Ilo writes the
  invented Hesh script (`hesh.mjs`, letters hanging from a headline), and Tarnish as a learned upright
  print that keeps the Hesh headline. Ned's hand has a `lie` mood that writes tighter. Bet spells
  phonetically. Anni draws tallies square (`[tally:N]` in text). `ui/lettering/handwrite.mjs` writes a
  line live, each word as one glyph, cached.
- **Where handwriting shows.** A line with `{hand: <who>}` (`dialogue/runner.mjs` passes the attribute;
  `talk.mjs` marks `.ln.hw`). The hand may also be a display hand, such as `{hand: insular}` for an old
  Tarn or Hesh document. The daybook's notes are in the player's hand (Ned or Will, from
  `G.playerFigure`). Signed names appear as described above. The clean words show under the writing on
  hover and on keyboard focus, and in Plain text and glyph mode.
- **Contrast.** Every writer's ink is at least 5.54:1 (Anni's pencil) against the darkest 2% of every
  era's paper. Handwriting is a textured mark, so it rests on the clean words for reading.

### For the story lead
Mark the written things with `{hand: ...}` to show them in a hand. This round adds no `{hand: ...}`
marks to content; they are yours to place. Candidates: the returns ledger and the village returns
(`mott`), the tally (`anni`), the cell log (`will`), the notices' added lines (the writer's), Abel's old
papers (`abel`), and the Hesh letters (`ilo`, or `insular` for the old documents).

### Correction (2026-10-22)
The lettering atlases (`ui/lettering/atlas/*.png`) are matched by the repository's `*.png` ignore rule,
so round one's merge carried the atlas JSON without the images. On dev the lettering fell back to plain
type, and only the stills (made in my worktree, where the images existed) showed it. They are now added
with `git add -f`. Round one's report did not know this.

### Measures (2026-10-22)
- **Contrast** (`node game/engine/tools/uicontrast.mjs`): every text ink of every era is at least 5.21:1
  against the darkest 2% of its aged paper, at the highest burn, over five seeds. The weakest is era 1's
  graphite pencil at 5.21:1, and the inks reach 15.1:1. Glyph mode's weakest typed strike is at least
  5.21:1 (era 3). Stamps run 5.8 to 13.3:1. The era 5 phone HUD is near-white on near-black, about
  17:1, computed by hand and not by the tool. Report: `game/capture/ui-2026-10-21/contrast.json` (local).
- **Frame cost** (`tools/bench.mjs --views quota-talk`, GPU on, 3 runs, median; the machine was NOT QUIET,
  25 to 49% load from other jobs). Painted: main thread 0.79 ms a frame with the era interface against
  0.84 ms with `era=0`. The ui stage measured 0.00 against 0.01 ms, so there is no per-frame cost to
  measure. Glyph: 5.46 against 5.80 ms main thread and 1.45 against 1.50 ms in the glyph stage; the
  typed hook adds nothing measurable. One-off costs happen when a page is made, never per frame. A talk
  page takes 23.6 ms (now in a worker, `ui/paperworker.mjs`), the HUD 4.5 ms, the daybook 22.7 ms, a
  lettered title 0.3 ms and a name under 0.05 ms.
- **Checks**: tests 383 of 384 pass. The one failure ("every plate the area wiring names is in the
  lock") fails on dev as well: the Quota's places are not in the plate lock. Visual check: painted and
  glyph both passed, 8 views each, with every control failing as it must. Low Water's own shell stills
  (title, world, talk) are pixel-identical to dev; Settings differs only by the new Plain text row.

- **The arena's pick between rounds** (author reference, section 11; the idiom only, not the reference's cards).
  `ui/venuepick.mjs`, hooked into `combat/arena/runui.mjs`: at the bread fights the three picks are chalked
  on the foreman's slate in a timber frame, with the round lettered in chalk. At the boxing club they are
  printed on a perforated betting slip with tick boxes and a red rule. The buttons, keys and words stay
  the same, and no odds or numbers are invented. Low Water's arena keeps its plain card. Stills:
  `game/capture/ui-2026-10-21/after/arena-pick-*.png` (local).

Fixed on the way: in the Quota the daybook stood under the lens panel; the daybook header showed
"tide +0.00 m"; What is here offered "Wait for the turn at low water" on a plain with no tide; the end
of a story printed "null" under "The end".

### For the glyph-style lead (files of yours I touched, all additive)
- `paint/glyph/ui.mjs drawUi`: reads `globalThis.__lwTyped(o)` (set by `ui/typed.mjs` only while a story
  has an era) for stock, ink, frame characters, side marks, ground fill and each character's strike. A
  floor keeps typed text at AA. With no era it draws exactly as before.
- `paint/glyph/ui.mjs collectUi`: characters outside their scroll box are no longer collected. The talk
  log, scrolled up, was setting its hidden lines over the title, and the options over the log.
- `paint/glyph/renderer.mjs renderUi` and `paint/renderer.mjs`: with no plate (the Quota's places are not
  baked yet), glyph mode drew nothing at all, panels included, and the game went black. Now it draws the
  panels alone on the night ground.

### For the story lead
I changed no content. The Quota turns this on through its own `@meta era: 2`. That line sits uncommitted
in the slice in the dev checkout as of 2026-10-22; until it is committed, the slice shows the plain
interface, and `?era=2` shows this one. The end line
shows the raw end id ("The end q.end"). That comes from the slice's `end:` value, not from the UI.

### For the painted lead
The read-back's title block is ready to sit under a drawing. If your pen-and-glaze layer can produce a
per-era plan as an image, the read-back can mount it above the title block (`.talk.record`). Size, place
and file naming are yours to propose.

**Your dialogue box** (`paint/portrait/box.mjs`) is not in the talk panel yet; the game shows portraits in
`ui/portrait.mjs`'s slot, mounted per era by `ui/era.css`. When the board goes in, the name could be
lettered with `ui/lettering/hand.mjs` `drawLettering(canvas, await loadHand(tool), name, { px, ink })`. The
tool for each era is in `ui/era.css` (`--hand-name`). Your 640 x 800 change to the index is fine with
the slot: it scales with object-fit.

### Open
- Glyph mode: the Pack toast collapses to its last word ("hat") in the talk view. The cause sits in the
  glyph panel layout of a wrapped toast; this change did not touch it.
- Lettering choice for the author: `game/capture/ui-2026-10-21/lettering-choice.png` shows the round
  brush (A, in use for eras 2, 4 and 5), the flat brush (B, era 3) and the pointed pen (C, era 1).
- The Pack toast and the gear cards still sit over the lens panel at the start (their stack predates this).

## 2026-10-22: round two fixes (coordinator's review of lettering-round2.png)

- **Anni, Will and Ilo's Tarnish now read as hands, not fonts.** Every stroke is drawn as a hand draws it:
  straight lines bow and run past their ends, and curves wander off their circles. Letters sit on a
  wandering baseline, vary in size and each lean their own way. Stroke weight varies per stroke. A hand's
  `rough` scales all of this: Anni 2.2, Will 2.4, Ilo's Tarnish 1.8. The pencil is thicker, so its grain
  shows (Anni's grain 0.75). Will's strokes stop dead and dig in (`stops`). Ilo's Tarnish is laboured:
  tremor, wide spacing, each letter set on its own.
- **Bet** no longer gets random capitals. She writes slowly: a heavy tremor, a third of her strokes gone
  over twice (`retrace`), the line sinking, and phonetic spelling kept.
- **Insular in titles:** a second atlas, `insularround`, with rounder r, s, t, g and f, is used for era 1's
  headings and place names. The historical forms stay in `insular`, for old documents (`{hand: insular}`).
- **The Hesh script is provisional** until the author approves it (`ui/lettering/hesh.mjs` header; the
  proof's label). It goes to the author with the next sheet.
- Proof: `game/capture/ui-2026-10-21/lettering-round3.png` (local). Era 1 in game:
  `game/capture/ui-2026-10-21/round3/` (local). Contrast: unchanged inks, none under AA. Tests: 427 of 427.

## 2026-10-22: the propaganda kit (author direction, via the coordinator)

The direction: the real faces of the Tarn, Hesh and Vell are distinct and dignified, and caricature
belongs only in the in-world propaganda. The kit uses invented features only, nothing from real-world
racist caricature. The player can set a poster beside the real person and see the lie.

- **The guard** (`ui/propaganda/guard.mjs`). Every caricature is built from parameters, and they pass a
  check before anything is drawn. Allowed: the people, the myth, props, pose, the grin, a crowd, labels and
  dress. Refused: skin colour or tone, nose, lips, eyes, ears, skull, hair texture as a racial marker,
  animal or vermin bodies (rats, apes, insects, dogs, pigs), blood libel, harm to children, and people
  drawn as disease. A test holds the check, and its controls must fail.
- **The cruelty is in the myth drawn as fact.** Grain in a hole under the goat; tallow dripping and fumes;
  the same figure repeated as a tide; the money bag with its arrow off the page; the bottles of the dole.
  The dress is turned into costume: the Hesh braids become ropes and the blue thread a cord, the Vell
  scarves wind round until the figure is mostly scarf, and the cottar gets a pulled-down cap and mud to
  the knee. Every people gets the same leering face. Nothing exaggerates a face or a body, so the lie is
  in what the poster claims, and the portrait beside it answers it.
- **The print processes** (`print.mjs`): era 1 engraving and woodcut, era 2 woodcut, era 3 a lithograph
  out of register, era 4 a halftone photograph cut out and taped to a collage, era 5 a compressed meme in a
  phone screenshot. `poster.mjs` sets the claim's own words in the era's lettering on the era's paper. A
  notice can be torn, or the true figure pasted over it in the player's hand.
- **The notice beside the person** (`ui/compare.mjs`, `ctx.compare({ claim, who, torn, pasted })`). The
  notice on the left, the person's portrait on the right, their words under each, and no verdict written.
- Proof: `game/capture/ui-2026-10-21/propaganda-kit.png` (local); proof page
  `/engine/ui/propaganda/proof3.html`.
- Also: the talk panel's portrait now reads the sculptor's Quota heads (`characters/portraits-quota`)
  between the painted index and the old one, so the Quota's cast has faces before the Studio paints them.

### For the painted lead
The figure in `propaganda/figure.mjs` is a placeholder in my hand. The drawing is yours: an ink drawing
on white, with tone, that the print processes take as input (`renderNotice` takes it). Draw to the guard's
vocabulary: the myth as props, the dress as costume, the same leer for everyone, and the real face never
changed. Please put the guard's check on your parameters too.

### For the gameplay engineer
The notices are your rhetoric carriers (`@carrier notices`, `@claim`). To show one: `ctx.compare({ claim:
"cl.hesh_hoard", who: "anni" })`, from a verb on the notice objects (q.notice_post, q.notice_exchange),
for example "Look at the picture". `torn` and `pasted` follow `did.tear.<claim>` and `did.paste.<claim>`;
pass them in. A claim could carry `myth:` (the picture's myth) and `era:` for later notices; until then
the picture follows the people (hesh: hoard, vell: tide, tarn: dole).

### For the story lead
Only era 2's words are yours (cl.hesh_hoard). The proof's other eras use the world bible's myths as stand-ins.
