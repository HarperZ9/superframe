<!-- writing-profile: research -->
# Cinematics: the boot, the opening, and the scenes the spine needs

Cinematics lead, 2026-10-22. For the author, the game director, the story lead, the art and
sensory director, the audio lead and the UI lead. Built pieces are marked BUILT; everything else is
PROPOSAL until the author or the owning lead takes it.

The author, 2026-10-22, verbatim: "The rating should be left up to the discretion of a rating board, and
be done in the typical fashion. Perhaps in an introductory scene or intro video for the game. We need
cinematics and such. But the big warning is too much. Let people come to their own conclusions."

The author, 2026-10-22, verbatim: "Abuse may also be shown explicitly in the game through actions and
cutscenes. There is no reason to obscure the seriousness of what occurs in this world." The handling
rules are in design/QUOTA-DESIGN.md and DECISIONS-2026-10-22.md, "Abuse shown on screen".

## 1. Rules every cinematic keeps

1. **The work says what kind of game this is.** No topic list, no card that explains the themes, no
   narrator who names them (design/RATING.md section 5). The only notice the game writes is the
   photosensitivity notice.
2. **Skipping.** A cinematic can be skipped once the player has seen it to the end, and always when
   reduced motion is on (the setting or the system's `prefers-reduced-motion`). The witness scene is
   the exception: it is played, not watched, and has no skip (spine-plan/02-WITNESS.md section 4).
3. **Reduced motion.** Camera moves become cuts on the same beats, focus pulls become cuts, and morphs
   become a cut with the sound cue carrying them (sensory/02-MORPHS.md rule 5).
4. **The flash rule.** Every cinematic passes F5 (sensory/05-CARE.md section 2, WCAG's wording): at most
   three flashes a second in any window of 1/16 of the frame, no saturated red flash. A hard cut from a
   dark plate to a bright one counts as one transition, so cuts are spaced at least 0.4 s apart.
5. **Abuse on screen.** Violence, abuse and harm to children are shown without cutting away. Each act
   belongs to a named person with a history and is seen from a position the scene chose. The camera
   stays when staying costs the player something. Two lines hold in every cinematic: nothing sexual
   involving a minor, ever; sexual violence between adults is shown as coercion, threat, violence and
   aftermath, never as sexual content or nudity.
6. **The observer camera.** The camera watches a living miniature (DECISIONS-2026-10-22, "Tilt-shift
   camera"). It keeps its distance, its focus finds what is alive, and the world goes on out of focus.
7. **Captions.** Every sound with meaning has a caption in brackets when captions are on
   (sensory/05-CARE.md section 4). Captions describe the sound and never interpret it.
8. **Dialogue.** Any spoken line in a cinematic meets design/DIALOGUE-STANDARD.md and the author
   approves it before it is recorded.

## 2. The boot sequence (BUILT)

| Step | What shows | Length | A key or click |
|---|---|---|---|
| 1 | Studio card: the maker's name, house grotesk, ink on the era 2 ground | 2.5 s | Skips it after the first boot |
| 2 | Engine card: "raw-native" in Conso | 2.5 s | Skips it after the first boot |
| 3 | Photosensitivity notice (RATING.md section 4, word for word) | 3 s | Always moves on |
| 4 | The opening cinematic (section 3) | 100 s | Skips it after a first full viewing, or always under reduced motion |
| 5 | The title, over the same dawn plate the cinematic ends on | | |

- The cards and the notice fade in and out over 0.5 s, or cut under reduced motion.
- While the cards show, the shell loads the cinematic's plates, its geometry and its score in the
  background, so the film starts without a wait.
- The game remembers in this browser that the opening was seen to the end (`lowwater.boot.v1`). A
  player who skipped it never had it remembered.
- Test and capture pages skip the boot: `?shot=`, `?carry=`, `?capture` without `?boot=1`, and
  `?boot=0`. `?boot=1` forces it.
- The title screen's old line of mature themes is removed. It was the last game-authored topic list.
- The studio card reads "Zain Dana Harper". The author confirms the wording before release.

## 3. The opening cinematic

### 3.1 Its job

In 100 seconds and with no narration, a player learns:
- **Place:** a small upland town on a white plain, Edrin's Upper Town, seen whole and then from its
  bell tower.
- **Era:** rifles, a goods train, carts, tallow and carbide light, felt and wool. Era 2's palette
  (sensory/01-LOOKS.md, L2: ground #070a11, ink #c4d8ee, one hot mark).
- **Tone:** hunger watched from a distance that cannot help. The camera is calm while something
  terrible is ordinary.
- **Stakes:** grain leaves under guard while a queue watches; a man is beaten for picking up spilled
  grain; the new graves are already dug; a boy in a borrowed coat crosses the square toward the office
  that keeps the figures, over the gratings of the cells.

The player should leave the film knowing this game is about who eats and who decides, that people in
it get hurt, and that the boy matters. Nobody in the film says any of that.

### 3.2 The beat sheet

Times in seconds. Plates are the art lead's (content/<plate>/, read only). World points are the
plates' own marks (place.json `marks.spots`).

| Beat | Time | Plate, camera | Focus and look | Sound | On screen |
|---|---|---|---|---|---|
| 0. Black | 0 to 4 | None | | The tower air alone: wind, the frost's tick | Nothing |
| 1. The district | 4 to 20 | q_town dawn, the whole map; a slow push of 1.6 times toward Exchange Square | The town-map miniature (`town_map`, K 40): the square sharp, the plain soft | Wind; one far bell at 10 s; the drone enters at 12 s | Nothing |
| 2. The queue | 20 to 36 | q_square_wide dawn from the tower; framed on the relief cart (8.5, 0, 5.5), drifting toward the siding | Oil and Ink (`daily`); focus on the queue, then a slow rack to the train | The queue's shuffle and coughs; the harp, figure A of the dawn cue | Nothing |
| 3. The train | 36 to 50 | Closer on the export train (17.5, 0, -1): men load sacks, soldiers stand with rifles slung | A morph into the record look (L12) for 6 s and back: the plate drains to paper and ink, the miniature strength rises to K 40, and the sacks' stencil reads | Sacks landing; the piano's bowls motif, low | The stencil on the sacks: HALVARD GRAIN CO., VIA ARLEN |
| 4. The blow | 50 to 64 | The same frame, held still: a sack splits at the end of the line; a man from the queue kneels and fills his cap; Gedge leaves the guard and strikes him down with his rifle butt, twice, and kicks the grain into the snow | The focus rests on them and does not move. No cut | The music stops dead for 6 s. Wind, the engine idling, the queue's silence. The blows are too far away to hear | Nothing |
| 5. The new rows | 64 to 76 | Up the hill's shoulder to the burial ground (8, 0, -26) | Oil and Ink; the observer drifts to it | The church bell for the new rows, three strokes; the drone | Nothing |
| 6. The boy | 76 to 88 | Back to the square. Tomas Haldane comes out of Haldane Yard's corner in a brown coat made for somebody bigger, cap in his hands, and walks along the queue to the district office. The train pulls out behind him, its headlamp moving along the siding | The focus follows him, the one thing that moves toward the office | The train leaving (the dawn cue's iron); under it, from the cells' gratings, an old man's voice humming the prayer for the water | Nothing |
| 7. The grating | 88 to 92 | He stops on the cells' grating under the returns-room window and looks down | Held | The hum, close now; everything else drops away | Nothing |
| 8. Title | 92 to 100 | Black, then the title | | The hum's last phrase, unfinished | THE PRAYER FOR THE WATER |

The title dissolves into the title screen, whose picture is the same dawn plate.

**Why the blow is seen from the tower.** The miniature makes the player an observer who cannot reach
the man. The act is small in the frame, whole and unbroken. Cutting closer would make it spectacle;
cutting away would let the player off. Gedge owns it: Constable Gedge, Will's constable, whose father
lost the Orme mill's carting to Hesh hands at two-thirds the rate and drank the rest of his life on it
(content/quota/q_world.lwd, `q.gedge`). The player meets him again with the cell keys. The man he
strikes is from the queue and is Hesh by the thread at his wrist; the story lead may name him
(PROPOSAL; the cinematic does not need the name on screen).

**Why the hum.** The title is the Hesh prayer Tesk says in the cell (content/quota/q_will.lwd:15) and
the one Tomas never gets the end of (content/quota/q_cells.lwd, Saturday night). The opening plants
the sound with no words and no source shown. The player hears it again in the cell and knows it.

**Grounding.** The queue on three sides, the train under guard, the stencil, the new rows and the
gratings come from the bell tower scene (content/quota/q_start.lwd, `q.wide` and `q.wide.will`). Tomas's
coat, cap and wrist come from content/quota/q_ned.lwd at the inspector's door. His walk to the office is
the morning of day 41; the film ends at 07:55 and he knocks at 08:40.

### 3.3 How it renders on the engine (BUILT unless marked)

- **Plates with depth and normals.** Each shot draws the plate's colour variant, its world positions
  (`geo-pos.f32`) and the light model built from them (game/engine/light/steps.mjs: normals, occlusion,
  the bake), the same data the play screen uses.
- **The observer camera.** A view on the plate (centre in world metres, zoom) eased between keys. The
  tilt-shift lens is raw-native P23's port (game/engine/fx/tiltshift.mjs, shared shaders): a
  Scheimpflug plane in world space through the shot's focus point, and defocus painted as a coarser
  Kuwahara, not as blur. Each shot names its look (`town_map`, `daily`, `record`) and its focus keys.
  Building it found a bug in the shared shader: the lens drew the plate upside down wherever it painted,
  in the play screen too (the dream look's "roof paint for wall paint"). Fixed in fx/tiltshift.mjs.
- **Oil and Ink as base, and a morph.** Beat 3's record look is a time morph (02-MORPHS.md): the grade
  glides to paper and ink and the miniature strength rises, then both glide back. Its cause is the
  export record the bell tower scene writes (`record(export.train, ...)`).
- **People.** Figures are drawn by the character pipeline (ui/figures.mjs, through the fighters' hook with a
  person's pose, so a body the queue repeats gets its own actor) at their world points, so they stand in the
  plate at the right scale. While the film runs the drawer works on the main thread: its workers wait for the
  play screen's occlusion data, which a film does not make. The queue repeats four townsfolk bodies (Lil,
  Edie, Davey, Rose) until the crowd tier has era 2 bodies; the loaders and the struck man are Gullet folk
  bodies; Holt and Gedge are their own. A test fails any figure placed off the painted ground.
- **Weather.** The effects layer's snowfall and breath (game/engine/fx/), lit by the light model, so
  flakes show where the light is.
- **Sound.** One cue, `opening` (game/engine/audio/pieces/opening.mjs), built from the existing
  instruments and the slice's sound design: wind, frost, the queue, the train idling and leaving, the
  church bell, the drone, the harp, the piano's bowls motif, and the `hum` voice for the prayer.
- **Skippable.** As section 1 rule 2. The skip fades to the title over 0.5 s, or cuts under reduced
  motion.
- **Reduced motion.** Each shot holds its middle key; the focus cuts; the morph cuts.
- **The blow** (beat 4) uses the character pipeline's own clips: the man walks to the split sack and
  stoops (`examine`), Gedge crosses and strikes twice (`long.heavy`) and shoves (`shove`), and the man
  goes down and stays down (`knockdown`, held). Section 6 says how far that is from landing.
- **Captions** are drawn when `prefs.captions` is set; nothing in Settings sets it yet (section 7).

## 4. The cinematics the spine needs, ranked

Ranked by how much of the spine fails without them.

| Rank | Cinematic | Where | Length | Skip |
|---|---|---|---|---|
| 1 | The opening (section 3) | Boot | 100 s | After the first viewing |
| 2 | The end cell, through the hatch (section 4.1) | Era 2, Saturday night, day 44 | About 3 min | Never: it is the era's peak and the player's verb is to stay |
| 3 | The ending: the table (section 4.2) | Era 5, after the commemoration | About 90 s | Never on a first ending; after it, yes |
| 4 | The witness scene's staging (section 4.3) | Year 38 interlude | Played | Never (02-WITNESS.md) |
| 5 | Era transitions (section 4.4) | Between eras, at the bell tower | 20 to 30 s each | After the first viewing |
| 6 | Morph moments in the inner arena (section 4.5) | Inside fights | 1 to 3 s | Never; they are part of play |

The cold open in Anni's kitchen (content/quota/q_start.lwd, `q.start`) already exists as a played scene
and stays one.

### 4.1 The end cell, through the hatch (PROPOSAL, for the story lead)

The coordinator's brief: the cell death in custody as a cutscene seen through the door's hatch, from
Ned's position. The author's direction of 2026-10-22 supersedes "the death is never shown" at the top
of content/quota/q_cells.lwd. The cell door itself stays shut; the camera sees through the hatch.

**Why Ned is there.** On Friday he witnessed Ilo's mark, and Holt said the boy would be home for his
tea (content/quota/q_week.lwd, `q.week.mark`). PROPOSAL: on Saturday night, the Inspector line gets one
new node. Ned goes down to the guardroom to ask why the boy is still held. Holt has gone home. Gedge is
on the night shift with his boots on the fender.

> GEDGE: He's asleep. Look for yourself if you like, I'm not getting up.

Ned slides the hatch in the passage door and looks down the row.

**The frame.** The hatch is the whole picture: a slot about one third the frame's height, black round
it, the passage door's wood at its edges. The camera never moves and never cuts. The plate is
q_cells at night, its lamp the smoking one nobody trimmed.

**What is seen,** in one take:
1. The end cell. Tomas on the bench with his knees up inside the Orme lad's coat.
2. He gets up to the bucket. It takes him a long time. He comes back holding the wall.
3. He holds the cup out through the bars toward the guardroom. Nobody comes. He holds it out until his
   arm drops.
4. Across the passage, Dorrah Tesk says the end of the prayer for him, slowly. He starts again and gets
   it wrong in the same place (q_cells.lwd, `q.cells.night`).
5. He lies down. The lamp gutters, and the light model lets it.
6. The prayer stops. His hand is still outside the bars with the cup on the floor under it.

**The player's verbs.** The scene offers two things and nothing else:
- **Knock on the hatch.** Gedge wakes, swears, says "He's asleep, Mr Furrowe," and is asleep again
  before the line ends. The scene goes on. The record keeps the knock.
- **Shut the hatch.** The frame goes to the black of the door. The sound goes on to the end: the
  prayer, the stopping, Gedge's breathing, the stove ticking as it cools. The record keeps that he shut it.

Waiting is the third choice and the one most players take. All three end the same way. The cost is
the staying.

**Who owns it.** Holt, who put him there and would not send the doctor for a Hesh boy; Gedge, asleep;
Ned, who signed as witness on Friday or refused and let Mott sign. The camera's position is Ned's,
because the inspector is the man whose paper could have opened the door.

**Sound.** No score. The passage's room tone, the lamp, the boy's breathing close to the hatch at the
start and too far away to hear at the end, Dorrah's voice, Gedge's breathing, the stove.

**Lines that hold.** Death by thirst and the flux in custody, shown plainly. Nothing sexual. The boy's
body stays clothed in the coat; the bucket is heard more than seen.

### 4.2 The ending: the table (PROPOSAL)

Era 5. After the commemoration, where Mara says what she has been told about a boy, partly wrong
(spine-plan/05-STRUCTURE.md section 2). The camera starts at the era 5 town map in the town-map look
under sodium, and descends to the window of the antique shop on the hill. The table, ticketed
"farmhouse, rustic, period" (content/quota/q_props.lwd:17), with the goat carved on its leg. Whoever stops at it
in the street stops; the camera holds on the table for as long as the player does not press a key.
No music. No document after it, no count, no summary (01-SPINE.md section 4). The last image is the
table. Then the credits, over silence.

### 4.3 The witness scene's staging (PROPOSAL)

Not a cinematic and never skipped. What cinematics adds: one fixed camera at table height in Anni's
room, so the player sits where the old man sits; one move only, when Anni recognises him, a slow
push of a few centimetres onto her face, under reduced motion a cut. Nothing else moves.

### 4.4 Era transitions (PROPOSAL)

Four, each at the bell tower, each about 25 seconds: the era timelapse of 02-MORPHS.md. The same
camera; the next era's plate replaces this one by depth band, far to near, so the hills change first
and the square last. The light tells the year (01-LOOKS.md, L1 to L5): tallow and carbide, then bare
bulbs, then the first sodium. The only text is the chapter name: The Exchange, The Quota, Allocation,
The Closure, The Clearance. Sound: the dawn cue's drone carried across in the next era's
instrumentation. Under reduced motion, a cut on the bell.

### 4.5 Morph moments in the inner arena (PROPOSAL for the combat lead)

The amalgamation's morph, when the room gives way (DECISIONS-2026-10-22, "Inner arena staging calls" 2).
Rules from cinematics: at most 3 s; the camera may pull back to fit the new form but never takes the
player's control during a tell; the room splits along its own beams; F5 passes; under reduced motion
the new form is simply there on the next beat, with its sound.

## 5. Checks (BUILT)

- `game/engine/tests/boot.test.mjs`: the boot order, the skip rules on first and later boots, under
  reduced motion, the pages that skip the boot, the notice word for word, and AA contrast for the
  cards and the skip hint.
- `game/engine/tests/cinematic.test.mjs`: the opening's length (60 to 120 s), shots contiguous and in
  order, cuts at least 0.4 s apart, every shot's plate and world points real, the reduced-motion
  version with no camera moves, and a planted fast flash failing the flash rule.
- `game/engine/cine/tools/cinecapture.mjs`: plays the opening in the real page, frame by frame, saves
  stills and a recording, and runs F5 over every frame with the inner arena's own measure.

## 6. The first cut, looked at (2026-10-22)

Captured headless with the GPU off, every frame at 30 fps on the film's own clock: stills, an 18 s
recording of the train and the blow, the reduced-motion version at 2 fps, and the flash rule over every
frame. Paths are in game/capture/cinematic-2026-10-22/ (a/ and b/ the two halves, rec/ the recording,
calm/ the reduced-motion stills, lens-fix-dream-before.png and -after.png the shader fix in play).

**Measured.** F5 over all 3,122 frames: at most 1 flash a second in any window (bound 3), no
saturated-red transition. Reduced motion: 0 and 0. No page errors. The cue's ten stems arrive in 19 s
under load, the wind in 5 s and the drone in 14 s, each before the film needs it.

**Where it falls short of a shipped cinematic,** worst first:
1. **The plates are blockouts.** Boxes with painted texture: no train that reads as a train, no sacks
   with the stencil on them, no split sack, no grating, no coffins in the porch, no low sun or long
   shadows on the dawn plate. The town map reads as a greybox under the miniature.
2. **The people are too small and too alike.** About 70 to 110 px tall at 1080 lines, four repeated
   bodies in the queue, Gullet folk as loaders and as the struck man. Tomas does not read as Tomas at
   the end: no coat, no cap, no wrist at that size. His look down at the grating is a stoop.
3. **The blow reads as a scuffle.** Gedge has no rifle, the man's kneel at the sack reads as standing,
   and he falls sideways and lies still. The camera stays on it; the act itself is too small and too
   stiff to land.
4. **Five of eight shots share one plate and one angle.** The film has no close shot and no change of
   lens length, so the square starts to repeat by the boy's walk.
5. **The record morph's stencil floats.** The words sit in the air over the pile, in front of a loader,
   and read as a caption.
6. **The observer's miniature is faint in the square.** Strong on the town map; in the square, with K
   raised to 22, only the near terrace goes coarser.
7. **The sound is synthesised and was not heard in the captures.** The prayer is a wordless formant
   voice. The capture records picture only, so the mix against the picture is unchecked.
8. **Frame time on a real GPU is unmeasured.** The record grade reads the whole frame back on the CPU
   each frame, and the figures draw on the main thread while the film runs.

**Found on the way.** The tilt-shift lens drew the plate upside down wherever it painted, in play too
(fixed, see 3.3). At HEAD, characters/cast/sculpt.mjs imports characters/forge/authored.mjs, which
imports `node:fs`, so the character pipeline does not load in a browser and every figure in the game
falls back to the plain placeholder (commit 0008ccc). The captures ran against a local server that
serves sculpt.mjs as it was before that commit; the characters lead owns the fix.

## 7. What is left

- Plates for the film: the square at dawn with the train, the stencilled sacks, the split sack, the
  grating and the porch; a closer plate at the train and at the grating.
- The crowd tier's era 2 bodies, and Tomas's coat, cap and thread readable at film size.
- The blow as staged motion: a rifle prop, a kneel, a strike, a fall and a kick.
- The stencil on the sacks in the world, drawn behind the figures.
- A recorded voice for the hum, approved by the author, with a Heshen text the story lead writes.
- A caption track and a Captions row in Settings (the UI lead's).
- The 4.1 scene's Saturday node and Gedge's lines, through the dialogue standard and the author.
- 4.2 to 4.4 need era 3 to 5 plates that do not exist yet.
- A real-time run on a GPU with the sound, and a viewer test with players who have not read the design.

## Does not prove

That the film moves anyone. Stills and a recording show what it looks like on this machine with the
GPU off; a viewer test with players who have not read the design is the only check on whether the
place, era, tone and stakes read. The flash check measures luminance on captured frames at 1280 by 720
and does not replace a Harding-style analyser.
