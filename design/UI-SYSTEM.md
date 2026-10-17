<!-- writing-profile: research -->
# Low Water: the interface system

UI and UX design lead, 2026-10-17. For the systems engineer (who owns `game/engine/`), the combat
engineer, the character lead and the environment art lead (who owns the look). The look's rules are
`LOOK-UNIFIED.md` R1 to R7; this page is the interface inside them and does not restate them. The
problems it answers are in `UX-AUDIT.md`.

Author direction (2026-10-17, verbatim): "Ui design will be important, and a seamless and intuitive
UI and UX experience, along with fluid animations and combat will be paramount. Coupled with a
powerful, deep, and moving story."

## 1. The idea

The interface is Lamb's Daybook and Lamb's pencil, laid over one continuous painting. Paper never
replaces the world; it slides over an edge of it and slides away. Every panel in every mode is the
same paper, the same two faces, the same ink. A fight, a sneak and a conversation differ in which
strip of paper is out, never in how the paper looks.

Two marks carry meaning across the whole game, and they come from the fiction:

| Mark | Means | Where it shows |
|---|---|---|
| **Pencil**: graphite, dashed rule, lighter ink (`--graphite`) | Provisional. Can change, can be tried again | Pencil checks, pencilled Margin notes, found things, a page not yet spent, a planned route |
| **Ink**: solid rule, full ink (`--ink`) | Settled. Once only, or permanent | Ink checks, inked notes, chosen ranks, the Record |

A player who learns "dashed means I can come back to it" in the first conversation can read the
Margin, the build sheet and the check tags without another lesson.

## 2. Type

Two faces, as now. Their jobs change.

| Face | Job | Never |
|---|---|---|
| **Hanken Grotesk** (variable 100 to 900, italic) | Every sentence, every option, every button, **every number**. Its digits are tabular by default (all 560 units), so columns, clocks and counters hold still | Small capitals |
| **Conso** | Names: speakers and voices in small capitals, place names, tab names, section names, the title | Numbers (its digits run 632 to 1406 units wide and it has no tabular feature), body text |

Scale, ratio 1.2 from the root. The root follows the screen's short side with no low ceiling:

```
html font-size = text-size setting x clamp(15px, 1.9vmin, 48px) x deck
deck = 1.08 when the screen is 16:10 and 800 lines or fewer, else 1
```

| Token | rem | 1280 x 720 | 1280 x 800 Deck | 1920 x 1080 | 3840 x 2160 | Use |
|---|---|---|---|---|---|---|
| `--fs-xs` | 0.83 | 12.5 | 13.5 | 17.0 | 34.0 | Key glyphs, sums; the floor, nothing is smaller |
| `--fs-s` | 0.9 | 13.5 | 14.6 | 18.5 | 36.9 | Names in small capitals, help lines |
| `--fs-m` | 1 | 15 | 16.2 | 20.5 | 41 | Lines, options, rows |
| `--fs-l` | 1.2 | 18 | 19.4 | 24.6 | 49 | Panel titles, the clock |
| `--fs-xl` | 1.44 | 21.6 | 23.3 | 29.5 | 59 | Daybook and menu headings |
| `--fs-xxl` | 2.07 | 31 | 33.5 | 42.5 | 85 | The title only |

Line length in the talk panel: 38 to 48 characters at every screen size, which a third of the width
gives. Line height 1.6 for lines and narration, which is also the ruled paper's pitch (`--line`), so
text sits on the rules. A row that is taller than one line is padded to a whole number of rules.

## 3. Values and colour

The world supplies the colour. The interface is value: warm paper, violet-brown ink, one hot mark.

| Token | Value | Role | On paper |
|---|---|---|---|
| `--paper` | `#e9e3d4` at 0.96 | Every panel | |
| `--paper-shade` | `#ddd5c2` | Second layer: the strip's edge, a selected row | |
| `--ink` | `#1d1418` | Text, ink rules, filled notches (the plates' ink family, darker) | 14.1 |
| `--ink-2` | `#54463f` | Quiet text, names | 7.0 |
| `--graphite` | `#6b625c` | Pencil marks, dashed rules, disabled text (never opacity) | 5.2 |
| `--hot` | `#9a3b1f` | The one hot mark per view: focus, or the fight's single urgent thing | 5.4 |
| `--night` | `#070509` | Behind everything when no plate is loaded | |
| `--scrim` | ink-violet at 0 to 0.32 | Behind a book page; never darker | |

Rules:
- **No opacity for meaning.** Disabled, past and locked text uses `--graphite`, which passes 4.5:1.
  Opacity stays for motion only.
- **One hot mark per view.** Focus is the hot mark. When the fight's talk-exit offer appears it takes the
  hot mark and focus moves onto it, so there are never two.
- **Never colour alone.** Pencil and ink differ by dash and weight; states differ by a word and a shape
  (notches filled or open, a struck line, a tick). Every screen passes in greyscale; that is the
  colour-blind test.
- **Text never sits straight on the plate.** The HUD, the clock and the keys are on paper tabs. A lit
  window under light text measured 1.3:1.
- **In the Gut** the paper and ink are mapped through the palette's nearest ramp steps (R2's palette
  lock); the tokens are swapped as a set on `[data-palette="gut"]`, nothing else changes.
- **In a blackout** the paper stays paper; the plate dithers around it. The interface is Lamb's, and
  Lamb's book does not go dark.

## 4. The paper

| Element | Form |
|---|---|
| Sheet | `--paper`, a 1 px ink rule at 0.16 on the inner edges, a soft shadow below (`0 0.5rem 1.6rem` of night at 0.5). No rounded corners, no blur, no glass |
| Strip | A sheet one or two rows tall pinned to a screen edge (the fight strip, the HUD tab, the prompt line) |
| Ruled page | Rules every `--line`; content snaps to them |
| Notches | Standing and Breath: upright ticks, filled ink for what is left, graphite outline for what is spent. A partial notch fills from the bottom |
| Tallies | The three meters (Cold, Wear, Dread): pencil tally marks in fives with the fifth struck through; at 7 or more the tally is inked. This replaces the empty boxes that read as missing glyphs |
| Tag | A pencil or ink ruled box around a check's voice and target, never a coloured pill |
| Key glyph | A small paper keycap for keys (`Enter`), a ring with a letter for pad buttons (`A`), shown only for the device last used |

## 5. Motion

Motion says where paper came from and where it went. It never makes the player wait and never hides
the world for long.

| Token | Duration | Easing | Use |
|---|---|---|---|
| `--t-press` | 90 ms | linear | Pressed state, focus ring arrival |
| `--t-in` | 220 ms | `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out quint) | A panel or strip entering |
| `--t-out` | 150 ms | `cubic-bezier(0.55, 0, 0.75, 0.2)` (ease-in) | Leaving; always faster than entering |
| `--t-morph` | 280 ms | ease-out quint | The talk panel giving way to the fight strip and back |
| `--t-line` | 160 ms | ease-out quint | A new line writing itself into the log (opacity and a 4 px rise) |

Rules:
- **Enter from the edge you belong to, by a short distance.** The talk panel slides 32 px in from the
  right while its opacity rises; the fight strip rises 16 px from the bottom; the Daybook page slides
  40 px from the right. Distance is a hint of origin, not a journey.
- **Leave faster than you came.** 150 ms out against 220 ms in.
- **Never animate the plate for the interface.** The camera eases on its own rules (CAMERA.md); panels
  do not push it, scale it or blur it.
- **The scrim is light and brief.** A book page dims the world to at most 32 percent over 220 ms. A
  conversation dims nothing.
- **Input is never blocked by motion.** A panel accepts input from its first frame. The one exception
  is a guard of 450 ms after a fight ends, during which a held catch (pad A, which is also confirm)
  cannot choose an option by accident.
- **Reduced motion** (setting, and the system's `prefers-reduced-motion`): every slide becomes a 80 ms
  opacity change; the camera snaps instead of easing (already built in `platecam.mjs`).
- **Flash safety.** No interface element flashes. Combat's hit dab and catch star (R5) follow the lens
  setting "Reduce bright flashes"; screen shake has its own switch.

## 6. Layout

Safe area: 4 percent of the short side on every edge (TV overscan and the Deck's rounded bezel).
Everything is placed in rem, so the layout scales with the root in section 2 from 1280 x 720 to 4K.

```
 +------------------------------------------------------------------+
 | [clock 23:07  tide falling, at the knee]          [prompts tab]  |
 |                                                                  |
 |                 the plate (camera per CAMERA.md)        talk     |
 |                                                          panel   |
 |                                                         (right   |
 |                                                          third)  |
 | [voice line]                                                     |
 | [fight strip / sneak strip / here-list]                          |
 +------------------------------------------------------------------+
```

- **Top left: the HUD tab.** Clock, then the tide in words with its direction ("falling, at the knee"),
  then the place. Weather appears as a word only when it changes the night ("rain", "frost on the
  stone", "wind 14 from the west"). On paper.
- **Right third: the talk panel**, full height, as now. 33.4 vw with a floor of 24 rem and a ceiling of
  40 rem, so the column stays 38 to 48 characters.
- **Bottom left: the strip** for whatever is live: the "what is here" list when exploring, the fight
  strip in a fight, the sneak strip in a sneak. One place, one shape, so the eye always knows where to
  look.
- **Above the strip: the voice line.** A voice that speaks outside a conversation (a fight bark, a sneak
  telegraph, a passive voice on walking past something) writes one line here in the talk panel's voice
  style and fades after 4 s. Two at most.
- **Top right: the prompts tab.** Only the keys for what can be done now, for the device last used.
  The persistent Daybook, Save, Settings and Title chips go; Esc or Start opens the pause page, which has
  all of them.
- **Ground marks** (needs the art lead's yes, UX-AUDIT A2): a lock-on is a pencil arc on the ground at
  the held person's feet; a watcher's gaze is a graphite hatch on the ground. Both are drawn into the
  plate layer in the plates' ink, never as floating screen elements.

Steam Deck (1280 x 800, 7 inches): the root rises by 1.08, the floor size is 13.5 px, every press
target is at least 2.4 rem (39 px) tall, and the talk panel keeps its 24 rem floor. 4K: the root is
41 px, so everything keeps the share of screen it has at 1080p.

## 7. Flows: one continuous scene

Every mode is the same plate under the same camera. What changes is which paper is out.

| From | To | What moves |
|---|---|---|
| Walking | Talking | The camera slides the speakers to the left third (CAMERA.md). The talk panel enters from the right (`--t-in`). The here-list leaves to the left (`--t-out`). No scrim |
| Talking | Walking | The talk panel leaves right; the here-list returns; the camera eases back to Lamb |
| Talking | Fighting | The last spoken line stays in the voice line slot; the talk panel leaves right; the fight strip rises bottom left (`--t-morph`, 60 ms after the panel starts out). The camera keeps the talk frame until the first exchange (R1) |
| Fighting | Talk exit | When the fight offers a way out, the offer slides in from the right edge where the talk panel lives, takes the hot mark and the focus, with its key (T, pad d-pad down) |
| Fighting | Talking | The fight ends; 700 ms for the body to land; then the outcome is written as narration into the talk panel, which slides back in. No separate result card and no extra press |
| Talking | Sneaking | As fighting, with the sneak strip in place of the fight strip |
| Any | Daybook | A book page slides in from the right over two thirds of the screen; the left third of the world stays visible under a 32 percent scrim. The clock does not move while the book is open |
| Any | Pause | Esc or Start. The same page form, one column, over a 32 percent scrim; in a fight the loop pauses |
| Any | The bench | A bench is a place. "Work at the bench" opens the Build page at its Bench section, with salvage and minutes shown before any press |

### 7.1 Checks with their stakes and their voices

A visible check is an option with three parts, read left to right:

```
 3.  ( SMALL PRINT  7 )  you 6        Read the clause again.
     pencil: try again when something changes            short by 1
     6 = PEN 3, trained 2, lit desk +1, Wear 6 -1, sodium -1
```

- The tag is ruled in pencil (dashed) for a pencil check and in ink (solid, heavier) for an ink check.
  An ink check's second line reads "once: failing opens its own scene".
- "you 6" and "short by 1" (or "clear by 2") replace the dice percentage. Low Water has no dice.
- The sum is always shown under the focused check, at `--fs-xs`, never only on hover. Held Shift or
  pad X shows the sums of all checks at once.
- **Strain** collapses to one control per check: left and right on the focused check step strain from
  +0 to +3, and the sum line shows the cost ("+2 costs 4 Wear"). The three buttons stay for the mouse.
- A locked pencil check keeps its line and puts the reason in `--graphite` upright text: "Locked until
  something in the sum changes: dry the coat, a lamp, the tide." That line is a to-do list.
- **Voices that speak** stay in the log as people do. A voice line is indented one rule step, its name in
  Conso small capitals, the line in Hanken italic. A voice that falls short (the `<` form) is marked with
  a graphite dash before its name, so the player learns which voices speak from weakness.

### 7.2 The build: one sheet, two readers

The Daybook gains a **Build** page (it replaces the Sheet tab, and its first column keeps the voices).
It is a two-page spread. An Elden Ring player reads the right page first; a Disco Elysium player reads
the left. Both are the same numbers.

**Left page: the case.** The four compartments, each with its pillar in one plain word and its four
voices with levels. A voice shows its level as a tabular number and its terms on focus (as checks do).
"+1 rank" is a pencil mark until the page is spent; spending inks it.

**Right page: Lamb in a fight.** Standing, Breath, Poise, Composure, the load band (light, medium,
heavy) and the tool in hand. For the tool: what it needs ("COAT 5", ticked or not), how it scales in
words ("GRIP strongly, BALLAST fairly"), its temper (0 to 5, notches), and its light and heavy blows as
numbers. When a requirement is not met the line says what happens: "swings slow, costs double Breath".

**Spending a page.** Focus a voice or, on a chapter page, a compartment. The right page shows every
number that would change as `14 to 16` in ink beside the current value, computed by
`G.ext.combat.preview(levels)`; the left page shows which checks in reach would open. Confirm spends
it. On a daylight page, "Re-file the case" takes every page back (SYSTEMS-FULL 19.4).

**Gear.** Below the tool, the clothes: protection, weight, how a soaked coat turns heavy ("6 when
soaked"). Wearing something shows its effect on load and voices before the press.

**The bench** (a section of the same page, open only at a bench): each tool's temper path as notches,
the next step's salvage with what Lamb has ("brass 1 of 2"), the minutes it costs, and one confirm.

The page never shows "level" or "xp". It shows "pages filed" and "pages to spend".

### 7.2a Numbers for the min-maxer, without clutter for the reader

Author direction (2026-10-17, relayed verbatim): "As well as min-maxxing builds for efficient
playthroughs." The Build page has two densities, switched with one key (N, pad X) and remembered:

| Density | Shows | For |
|---|---|---|
| **Plain** (default) | The four pillars in words, the tool's needs ticked, its scaling in words, the load band and what it does ("light: you dash"), Standing, Breath, Composure | The story-first player. Five lines a page, no frames |
| **Numbers** | Every row below, as a table, with the planned change beside each value | The theorycrafter |

Numbers rows, all read from the combat engineer's functions through `ui/buildstats.mjs`, so the page can
never disagree with the fight:

| Group | Rows (unit) |
|---|---|
| Body | Standing; Breath; Breath back a second; Poise; Composure; protection; share of each blow softened |
| Load | weight against limit; band; dodge form (dash, roll, hop); Breath recovery factor |
| Footwork | dodge: invulnerable frames, total frames, distance in metres, Breath; sidestep: invulnerable frames, total frames |
| Tool | requirement met; light strike: frames to land, total frames, damage, poise damage; heavy the same; charged heavy; Breath per swing; catch window frames; scaling per voice point |
| Read and end | read window (frames earlier); weak point bonus; yield line (Standing) |

Frames are at 60 a second; a second column gives milliseconds for players who think in time. Every
number that would change shows `old to new` with a pencil arrow, and its row sorts nothing and hides
nothing, so a player can plan a whole night of pages and see every consequence.

**Planning (pencil).** On a voice or compartment, left and right pencil in planned ranks, up to the pages
Lamb has. Planned ranks are dashed; the right page shows the result of the whole plan, not one step.
"Ink the plan" spends the pages; "Rub out" clears it. Below zero is allowed as a **respec preview** at any
time, marked "preview: re-file at a daylight page", and can only be inked on a daylight page.

**Compare.** In the gear list, focusing any tool or piece Lamb carries opens a side-by-side: the current
choice and the candidate in two columns over the same rows, with the difference in a third. Pad LB and RB
step through candidates; the comparison never needs a second screen.

When combat adds attribute-scaled animation speed (asked of the combat engineer in NOTES, 22:16), its rows
join the Footwork and Tool groups with no change to the page.

### 7.2b Combat feedback that sells weight, never over the fight

The screen effects are R5's (a brush dab, the catch star, a 2-pixel snap of shake, hitstop in the sim).
The interface adds its share in the strip, bottom left, below the fight bounds:

| Event | In the strip | Duration |
|---|---|---|
| Lamb struck (`fight.hit` on Lamb) | The lost Standing notches crack (an ink split) and go graphite; the strip drops 3 px and settles | 90 ms crack, 220 ms settle |
| A blow blocked (`fight.block`) | The Breath it cost drains from the right with a smear; the word "Blocked" in the exchange line | 160 ms |
| Guard broken (`fight.guardbreak`) | Breath notches empty in one stroke; "Guard broken" | 160 ms |
| A catch (`fight.parry` by Lamb) | Composure fills with a nib stroke; "Caught: strike now"; the strip lifts 2 px | 120 ms in, held for the riposte window |
| Lamb lands a blow (`fight.hit` by Lamb) | The opponent's notches crack; a riposte reads "Riposte" | 90 ms |
| Winded (`fight.breathless`) | Breath notches outlined in the hot mark until a notch returns | until recovered |
| Knockdown | The opponent's name struck through while down | while down |

The exchange line holds one word or short phrase and replaces itself; it never stacks. The strip's jolts
follow the screen-shake setting and vanish under reduced motion.

### 7.3 Stealth in the world (spec for the systems engineer)

The sneak plays on the plate as fights do (`world/stage.mjs` places the sneak's ground as it places an
arena). The sneak strip, bottom left, carries what the chart carries now, in the same words: each
watcher by name with a state word (unaware, suspicious, searching, seen), a mark (none, ?, ??, !) and
notches for how sure they are; Lamb's cover in words; the time left. Telegraphs and voices write to the
voice line. Light pools are already painted; a watcher's gaze is a ground mark (A2). The chart view
stays as the stepped-mode and accessibility view only.

### 7.4 Tide Runs in the world (spec)

Same pattern: the run plays on the plate, the camera frames the course and the water front (CAMERA.md),
the strip shows water in words ("below the knee"), the time left as a tally, and the run's goal as a
ground mark. Stepped mode keeps the chart.

## 8. Controls

Defaults below; every action is remappable in Settings, Controls (keyboard and pad separately). Hold or
toggle is a setting for block, run and crouch.

| Action | Keyboard | Pad (Xbox names; PlayStation shapes in brackets) |
|---|---|---|
| Move | WASD | Left stick |
| Choose, confirm | Enter, Space (outside a fight), 1 to 9 for options | A (cross) |
| Back | Esc | B (circle) |
| Pause | Esc in play | Start |
| Daybook | Tab (outside a fight) | View / Select |
| Daybook pages | Q, E | LB, RB |
| Sums of checks | Shift held | X held (square) |
| **Fight** | | |
| Light strike | J or left mouse | RB (R1) |
| Heavy, hold to charge | K or right mouse | RT (R2) |
| Block, hold | I | LB (L1) |
| Catch | L | LT (L2) |
| Roll (tap), sidestep with a direction and Shift | Space | B (circle) |
| Lock, switch | Tab, [ ] | Right stick click, flick |
| Use the thing in hand | Q | X (square) |
| Work a prop | F | A (cross) |
| Lantern | H | D-pad up |
| Take the talk exit | T | D-pad down |
| Shove, grapple | E, G | Y (triangle), Y held |

The pad fight layout follows the shoulder-button convention action-RPG players already have in their
hands. In a fight, the shell's own uses of Space, Tab, Q and E wait (they already do, through the
capture listener). The prompts tab shows only what is possible now.

## 9. Settings

Reading: text size (small to largest, 0.88 to 1.5), interface scale, high-contrast paper, reduced
motion, screen shake (on, light, off). Controls: the table above, remap each, hold or toggle, stick
dead zone. Fights: fight speed (full, three quarters, half) for players who need time, with outcomes
unchanged in rules. Tide Runs: as now. Lens: as now, with "Reduce bright flashes" first. Pause when the
window loses focus (on by default).

## 10. Sound hooks

The interface makes paper sounds, quiet and dry, mixed under the world. Names are event keys for the
audio work; no sound is shipped yet.

| Key | When | Character |
|---|---|---|
| `ui.page.in`, `ui.page.out` | Daybook, pause | A page turning, short |
| `ui.panel.in`, `ui.panel.out` | Talk panel | Paper sliding on paper |
| `ui.move` | Focus moves | A pencil tap, very quiet, rate-limited to 12 a second |
| `ui.pencil` | A pencil mark: a found note, a pencil rank, strain chosen | Graphite on paper |
| `ui.ink` | An ink mark: a rank spent, a note inked, an ink check chosen | Nib scratch |
| `ui.voice` | A voice line outside a conversation | A breath, no tone |
| `ui.offer` | The talk-exit offer appears | A single low knock |
| `ui.locked` | Pressing something locked | A dull pencil tap |

## 11. Who builds what

See `NOTES-FOR-ENGINEER.md`, "UI and UX lead" entries, for the files claimed, the edits made and the
specs handed over.
