<!-- writing-profile: research -->
# Low Water: UI and UX audit

UI and UX design lead, 2026-10-17. Scope: the engine shell (`game/engine/play.html`,
`game/engine/ui/`) as it stood at 22:00 local on 2026-10-16 (the systems engineer's 05:01Z build,
with fights already moved into the world). Evidence: the code, the stills in `game/engine/ui/shots/`,
font files measured with fontTools, contrast computed from the CSS values. The prototype shell
(`game/main.mjs`) is the character lead's and is covered only where it diverges (finding A1).

Author direction this audit is held to (2026-10-17, verbatim): "Ui design will be important, and a
seamless and intuitive UI and UX experience, along with fluid animations and combat will be
paramount." And: "so that the style does not alternate depending on what is occuring in game."
The environment art lead's `LOOK-UNIFIED.md` R1 to R7 is the rule set for the look.

Severity: **P0** breaks the unified look or blocks a player; **P1** real friction most players hit;
**P2** inconsistency or a gap a careful player notices; **P3** polish.

## 1. Top issues

| # | Sev | Issue | Where |
|---|---|---|---|
| T1 | P0 | Tide Runs and sneaks still leave the world. Each opens a full-screen paper chart on black (`.runview`), with a side card, while fights now play in the plate. Three of the five modes share one look; two do not. | `ui/run.mjs`, `ui/sneak.mjs`, stills `run-1920x1080.png`, `sneak.png` |
| T2 | P0 | No build or gear screen. The action-RPG layer (SYSTEMS-FULL 19: four pillars, tool requirements, scaling grades, temper, load bands) has engine hooks (`G.ext.combat.preview`, `upgradeCost`, `upgrade`; `G.inv.upgrade`, `requires`) and no UI at all. The Sheet tab shows level and xp as numbers, which 19.4 forbids ("pages filed", never a number). | `ui/tabs-a.mjs` `sheetTab` |
| T3 | P0 | The interface shrinks at 4K. Root size is `clamp(14px, 1.25vmin + 7px, 22px)`: 20.5 px at 1080p, 22 px at 2160p, so on a 4K screen every word is about half the share of the screen it has at 1080p. | `theme.css:14` |
| T4 | P1 | Panels appear and vanish with no motion. The talk panel is `display: none` until someone speaks, then present at full size; in a fight the talk panel and the "what is here" card are removed the same way. The camera eases, the paper jumps. This is the main "modal jump" the author will feel. | `panels.css:14`, `panels.css:133` |
| T5 | P1 | Controls collide across modes. Space is confirm and roll; Shift is the check sums, hurry and sidestep; Tab is the Daybook and the lock; Q and E turn Daybook tabs and also use and shove; on the pad A confirms and catches, B goes back and rolls, X shows sums and is a light strike, Y opens the Daybook and is a heavy. The fight pad layout (X light, Y heavy, RB block, LB lock) is the reverse of what an Elden Ring player's hands expect (R1 light, R2 heavy, L1 guard, R3 lock). Nothing is remappable. | `ui/input.mjs`, `ui/fightkeys.mjs` |
| T6 | P1 | Travel time is hidden. A "Go" exit spends its minutes (`attrs.cost`) silently, in a game where the clock is the antagonist. Waiting is fixed at ten minutes with no "until low water". | `play.mjs:98`, `renderWorld` |
| T7 | P1 | Fight barks are dropped. The combat layer emits `fight.bark` (a voice line, SYSTEMS-FULL 18.9, LOOK-UNIFIED R6 "barks appear as talk lines in the panel's voice style"); the fight layer never listens. The voices go silent exactly when the build makes them matter. | `ui/fightlayer.mjs` |
| T8 | P1 | Checks show dice odds and hide their stakes. The tag reads `[EYE 10, pencil] you 4 72%`; Low Water has no dice (SYSTEMS-FULL 1). The sum is on hover only, at 0.72 rem (11.5 px at 1080p), and "ink" is the only sign that a check is once-only and that failing opens a scene. | `talk.mjs` `checkTag`, `panels.css:65` |
| T9 | P1 | Numbers are set in a proportional face. Conso has digits from 632 to 1406 units wide and no tabular feature, so levels, notches counts, the clock and save times never align and the clock shifts as it ticks. Hanken has tabular digits by default. | `theme.css` `--mono`, every `.mono` number |
| T10 | P1 | No pause in a fight. Esc and B are swallowed (`onBack: () => true`); a player who must stand up has no way to stop the clock. | `fightlayer.mjs:79` |

## 2. Screen by screen

### Title
- P2. "Content: Engine test content" is developer text on the first screen the author sees. (`title.mjs:31`)
- P2. Continue is greyed with its reason only in a `title` tooltip; a pad player never sees it.
- P3. The menu card is a large paper slab over a dimmed plate (brightness 0.7). The plate is the game's
  best asset; the card covers a third of it. A narrower column on the left would show the town.

### Character creation
- P1. Creation sits on black, not over a plate. It is the one screen with no world at all, and the
  script opens on the ferry, so the ferry plate (or the arrival wide view) belongs behind it.
- P1. A Precedent card lists numbers (`WIT 4 NRV 2 HND 3`) and nothing about what the choice does in a
  fight or in talk. With the build layer, a Precedent sets the four pillars; the card should say so
  (Endure, Evade, Read, End) in words a first-time player reads.
- P2. "Begin" sits top right, far from the cards; the right column is empty below it at 1080p.
- P2. The trusted instrument row cycles through every skill, not only the five instruments of the Kit.

### The world (exploring)
- P0 (structural, see A1). The engine shell has no walking figure: exploring is a list of "Here / Go /
  Wait" rows in a paper card, bottom left. The prototype shell has walking and figures. Until one shell
  owns both, there is no single exploring experience to design against.
- P1. The top bar (Daybook, Save, Settings, Title) is always on screen over the painting, and Title quits
  to the menu in one press with no confirmation (`play.mjs:26`). Autosave limits the loss; the jump
  still breaks the night.
- P1. The HUD (clock, tide, place) is light text with a shadow straight on the plate. Paper on a lit
  window measures 1.33:1. Tide shows as a signed number (`tide -0.55 m`) with no direction, and the
  direction (rising or falling) is what a player plans by. Weather is not shown anywhere.
- P2. The chips jump sideways when a conversation opens (they sit at the right of the visible scene).

### The talk panel and the inner voices
- Works: one scrolling column, voices in the same column as people, names in small capitals, lines on
  the ruled paper, numbered options, keys 1 to 9. This matches the clean-room spec's shape.
- P1. See T4: no slide in or out; the world is visible but the panel pops.
- P1. Voice lines and spoken lines differ only by a glyph and a smaller name (`.ln.voice .who` at
  0.7 rem). A voice interrupting a person should read as an interruption: different indent and face
  weight, the voice's name in its own register.
- P2. `.ln.past` lines at 0.55 opacity fall to about 2.4:1. Old lines must stay readable (the spec:
  "earlier lines scroll up and stay readable").
- P2. Long option lists take up to 62 vh and push the log to a sliver; the newest line can scroll out
  of view while the player reads options.

### Checks and their odds
- See T8. Also: the strain row is three small buttons per check under every visible check, so a beat
  with two checks shows six extra controls before the player has decided to strain at all.
- P2. A locked pencil check is struck through and dimmed to 0.55 opacity (2.4:1); its lock text, the
  reason and the to-do list for a retry, is in italics below. The reason is the useful part and is the
  hardest to read.

### The Daybook
- P1. A near-full-screen modal (inset 3 vh, 3.5 vw) over a 60 percent dim. The world disappears for as
  long as the player reads. It should be a book page that slides over part of the scene.
- P1. Ruled lines and content disagree: rows with padding or two lines of text sit between rules, so
  the paper's own grid shows the misalignment (stills `pack-1920x1080.png`, `daybook-sheet-1920x1080.png`).
- P2. Eight tabs in one row with Q and E; no tab carries a count or a "new" mark, so a found Margin note
  or a new page to spend is only a toast that vanishes in 3.2 s.
- P2. Meters on the edge are rows of tall empty boxes; at one notch ("0 of 1") the box reads exactly
  like a missing-glyph square.

### Margin
- Works: found, pencilled, inked, forgotten as groups; minutes to ink shown; costs stated.
- P2. The inked reward from the spec (a short written page when a note inks) has no surface.

### Inventory (Pack), crafting and the bench
- P1. Clothing, carried things and recipes share one long column; wearing changes voices and load, and
  neither change is previewed before the press.
- P1. Upgrades have engine support and no button. Crafting is available from any screen; SYSTEMS-FULL
  19.7 places the bench in four rooms, so the bench should be a place-bound panel, not a tab.
- P2. Requirements show as raw conditions (`Needs skill.grip >= 6`).

### Map and travel
- P1. No map. Exits are text rows; cost hidden (T6). For a town of ten districts over three nights the
  player needs a place to see where they are, what is open at this hour and what it costs to get there.

### The fight HUD and the talk-exit offer
- Works: in the plate, under the game camera; HUD paper strip bottom left; offer in paper; result card.
- P1. T7 (barks), T10 (pause), T5 (layout).
- P1. No lock indicator and no Composure (grit) readout, though grit pays for tool arts and talk exits.
- P1. The offer sits top right with a hot border while the focus ring, the view's one hot mark, may be
  elsewhere: two hot marks.
- P2. The HUD is rebuilt with `replaceChildren` every frame (60 DOM rebuilds a second); the result card
  needs an extra press, and the outcome then reappears as a talk line, so the player reads it twice.
- P2. Placeholder figures carry a hot ring at Lamb's feet; LOOK-UNIFIED R4 says the player is never
  outlined or tinted to stand out.

### Stealth readouts
- P0. T1: a separate chart screen. Watcher state is good (word plus mark plus notches, never colour
  alone), and that content should survive into the in-world strip.
- P2. Telegraphs print at the top of the chart in capitals; voices in a sneak should use the voice style.

### Tide and weather readouts
- P1. See the world section. The Tide Run chart shows depth in words ("below the knee"), which is the
  right register, and the in-world HUD should use it too.

### Settings
- P1. Missing: control remapping, hold or toggle for block and run, screen shake, interface scale
  separate from text size, pause when the window loses focus, fight speed for players who need it.
- P2. Lens settings (flare, streaks, halation, fringing) sit beside reading settings with no preview.
- Works: reduce bright flashes (flash-safe) exists and is wired to the lens.

### Save and load, pause
- Works: slots with time, place and level; ink mode explained in one line.
- P2. Overwriting a slot has no confirmation; level appears as a number again.

### Controller, mouse and keyboard
- P1. T5. Plus: hover moves focus on `mouseover`, so a resting mouse pointer steals focus from the pad
  whenever the panel redraws under it (`focus.mjs:76`).
- P2. Prompts name both devices ("Enter or A", "Esc or B") everywhere instead of the device in use.
- P2. The fight's "Keys" list is a folded `details` element in a corner, keyboard only.

## 3. Measured

| Ink on paper `#e9e3d4` | Ratio | Use | Verdict |
|---|---|---|---|
| `--ink #1d1418` | 14.1 | body | Pass |
| `--ink2 #5a4c4a` | 6.4 | quiet text, names | Pass |
| `--ink3 #7d6f6a` | 3.8 | brackets, strikethrough | Decorative only |
| `--hot #9a3b1f` | 5.4 | focus ring | Pass (3:1 needed for a non-text mark) |
| ink2 at 0.55 opacity | 2.4 | disabled and past lines, lock reasons | **Fail** |
| paper text on a lit window | 1.3 | HUD clock on the plate | **Fail** |

| Size at 1080p (root 20.5 px) | rem | px |
|---|---|---|
| Check line, check tag | 0.68, 0.72 | 13.9, 14.8 |
| Small caps names, keys | 0.70 to 0.75 | 14.4 to 15.4 |
| At 1280 x 720 (root 16 px) | 0.68 | **10.9** |
| At 1280 x 800, Steam Deck (root 17 px) | 0.68 | **11.6** on a 7-inch panel |

Fonts: Hanken Grotesk, digits all 560 of 1000 units (tabular). Conso, digits 632 to 1406 of 2048
units (proportional), features `aalt ccmp dnom frac locl numr salt ss01 ss02 ss03`, no `tnum`.

## 4. Structural notes for the director and the leads

- **A1. Two shells.** The engine shell has the systems (talk, checks, Daybook, fights, saves) and no
  walking figure; the prototype shell has walking and figures and none of the systems. The UI design
  here targets the engine shell, with the plate camera, and assumes walking arrives there. Whoever
  decides which shell ships decides when the "Here / Go / Wait" card becomes in-world prompts.
- **A2. Ground marks.** LOOK-UNIFIED R7 allows no HUD over figures except a prop's tag. A lock-on and a
  watcher's attention need a cue in the world. The proposal in UI-SYSTEM section 6 is ink marks on the
  ground plane (a pencil arc at the locked person's feet, a hatched wedge for a watcher's gaze), drawn in
  the plate's ink, never floating. That needs the environment art lead's yes.
- **A3. Hidden checks in History.** The History tab prints "hidden check: ..." lines. SYSTEMS-FULL 4.1
  says a passive voice gives "no notice that a check happened". Either the History stops showing them or
  the director rules that History is the one place they appear.

## 5. Scores (impeccable audit rubric, 0 to 4)

| Dimension | Score | Key finding |
|---|---|---|
| Accessibility | 2 | Focus model and text-size setting exist; disabled text fails contrast, no remapping, small check text |
| Performance | 3 | Plate camera is light; fight and run panels rebuild DOM every frame |
| Responsive | 1 | Shrinks at 4K; Deck sizes marginal; panels fixed in vw |
| Theming | 2 | Tokens exist; chart and fight colours are hard-coded copies |
| Anti-patterns | 3 | Distinctive paper language; small-caps eyebrows over almost every block, and modal overlays where a slide would do |
| **Total** | **11 of 20** | Acceptable; the language is right, the transitions and the build layer are missing |

Does not prove: the scores are one reviewer's reading of code and stills. No player has used the shell
for this audit; the first seat test should time how long a new player takes to find the Daybook, read a
check's sum and leave a fight by talk.

## 6. Status after the first build (2026-10-17, UI and UX lead)

| # | Status | What changed | Evidence |
|---|---|---|---|
| T1 | Spec handed over | Sneaks and Tide Runs on the plate: UI-SYSTEM 7.3, 7.4; the strip is ready to take a sneak's watchers | NOTES-FOR-ENGINEER |
| T2 | Built | The Build page: the case, Plain and Numbers densities, pencil planning, respec preview, side-by-side gear, the bench | `ui/build.mjs`, `ui/buildstats.mjs`; stills `design/ux/shots/build-*.png` |
| T3 | Built | Root size `clamp(15px, 1.9vmin, 48px)`; 41 px at 4K (was 22), 16.2 px on the Deck | `check-4k.png`, `check-deck.png`; results.txt |
| T4 | Built | Talk panel, here-list, Daybook and strip slide in and out on the motion tokens | `slow-slide-sheet.png`, `slow-book-sheet.png` (slowed 10 times to see the frames) |
| T5 | Built | Remappable fight controls (keyboard, mouse, pad); shoulder-button pad default; device-aware prompts | `ui/bindings.mjs`, Settings, Controls; results.txt (rebinding and pad input checks) |
| T6 | Built | Go and Wait rows show minutes | `world-1080.png` |
| T7 | Built | Barks speak in the voice line above the strip | `fight-parry.png`, `fightview-pilot.png` |
| T8 | Built | Pencil (dashed) and ink (solid) tags; "you 6", "short by 1"; the sum under the focused check; odds only in dice content | `check-1080.png`, `check-720.png` |
| T9 | Built | Numbers in Hanken (tabular); Conso for names | all stills |
| T10 | Built | Esc or Start pauses a fight; pause on focus loss | results.txt |
| Also | Built | HUD on paper with the tide's direction in words; toasts moved under the HUD; meters as tallies; disabled text by colour; hover takes focus only on real mouse movement; screen shake (snapped, at most 2 plate pixels, off or light in Settings) and pad rumble from combat's events; the result card replaced by the outcome flowing into the talk panel behind a 450 ms guard | `ui/hudtab.mjs`, `ui/strip.mjs`, `ui/fightlayer.mjs` |
| Open | Not built | A map; wait-until; the walking figure in the engine shell (A1); ground marks (A2); hidden checks in History (A3); creation over a plate with pillar words; Margin's inked page | |
