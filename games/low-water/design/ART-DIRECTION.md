<!-- writing-profile: research -->
# Low Water: art direction

Art director, 2026-10-17. Private. For the author to choose a direction, then for the character
lead, the environment art lead and the UI lead to adopt it. Frames and the code that made them are
in `design/art/`. Nothing here edits another lead's files.

The author's verdict that this answers (2026-10-17, verbatim): "the character detail needs to be
much greater, as they are not distinct enough" and "the art style is somewhat lacking". The
author's later ruling on tools (2026-10-17, verbatim): "We do not need blender, we will make and
use our own assets and tooling." Every frame below comes from our own code; section 7 specifies the
in-house tools the chosen direction needs.

## 1. What is wrong now, looked at

I looked at `characters/stills/10-cast.png`, `09-fight-inworld-1080.png`,
`game/engine/ui/shots/fight-inworld.png`, the look bible's key frames and the quay plates.

- **One body wearing different coats.** The 38 figures in `10-cast.png` (each shown twice) share
  one skeleton, one head shape, one stance and one arm hang. By eye, heights vary by about 15 percent
  and head sizes by about 20.
  Squint and the cast is a row of dark columns with a pale face at the top. The look bible asks for
  heads 1.2 to 1.5 times natural and "one exaggerated feature each", and the built figures sit at
  the timid end of that range, so nothing reads as exaggerated.
- **Faces carry no information at play size.** In the fight still Lamb is about 120 px tall and the
  face is a few warm pixels. No figure has a readable hand, prop silhouette or wear.
- **The style is a filter over stylised 3D.** The plates are good painted places. The figures are
  smooth CG bodies with a brush texture laid over them, so they sit on the plate rather than in it,
  and the same smoothness is the "generic stylised 3D" the author is reacting to.

Two causes. The proportion range is too narrow, and detail is spent evenly instead of where the eye
goes. The fix is a wider shape vocabulary per person and a detail budget aimed at faces, hands,
wear and props, plus a rendering style with a stated point of view.

## 2. Where the look comes from

Each row is a reference the author shared or made, what I take from it, and where it shows in the
frames. Third-party works are reference for look and technique only; nothing is copied.

| Source (author's own) | What it teaches | Where it shows |
|---|---|---|
| Taste statement (engine-creative-vision memory, 2026-10-09): "very, very, very abstract, artistic, grotesque, and very, very indie", "real funky"; Disco Elysium and ZERO PARADES as favourites; tense, not jump scares | Grotesque proportion as the house rule; abstraction over fidelity; humour inside dread | Every character sheet (section 4); direction A's painted faces; B's two-ink night |
| Disco Elysium, as reported in the clean-room spec (CHARACTER-PRESENTATION 1, 7.1) | Small figure in a painted world, identity carried by a painted portrait; orthographic camera at 35.26 degrees; figures about 130 px at 1080p; brushwork as the unifying element | The play-size frames use that camera; portraits are the second scale of every person |
| 2026-10-15 inspiration: monochrome dithered first-person stills and trailer | Ordered dither over a fine scanline grid; fog lifting toward paper; forms that read as texture, not geometry | Direction B's dither and scanline grid |
| GlagStone breakdown ("making night with only two colors") | Darkness is an 8x8 Bayer pattern; each light is a radial mask quantised through it; layers: world, darkness, lights, beam | Direction B's whole lighting model |
| Pixel RPG with a reduced palette | A fixed palette, dithered gradients, one animated hot colour | B's five-ink ramp plus one reserved colour |
| DuneCrawl paint-over pipeline ("illustrations you can walk through") | Block out in 3D, render at the game angle, paint over, project back | The plates already work this way (LOOK-BIBLE 2.4); direction A extends the painting to the people |
| Glowing wireframe spider | Emissive line as a body; lines that draw on | The ink pass in A and B; a candidate effect for Mother and the Congregation, not used on the principals |
| Creamdast | Gaunt grotesque figures in vertex-lit low poly; fire as the one warm thing | Keel's waterlogged grey and the warm practical in a dark field |
| Elder ENB live release, `ROOT/enbseries.ini` (dated 2026-03-05) | The author's night balance: direct (moon) light 0.2 and fully desaturated (`DirectLightingDesaturationNight=1.0`), ambient 0.15, fire-type practicals at 2.0 with specular 3.5, strong bounce (`ILAmount=2.25`) and AO (2.0), fog weighted toward its sources (`VolumetricFog CurveNight=2.5`), lens at 0.5, depth of field on | `design/art/tools/shading.py` and `cine.py` use this balance in all three directions; C is the closest to it |
| DESIGN-INSPIRATION (telos-v2, now historical per the 2026-10-16 ruling; read for the visual DNA, not as canon) | The luminous orb in a dark field, fine line-work, scanline and halftone, grain as the veil | Lamps as orbs in every frame; B's scanline grid; grain in A and C |
| Eames films memory note | One idea shown at two scales; everyday objects treated with care | The two scales of a person (play figure and portrait); props drawn with care (Keel's trumpet, the egg, the Vane's cockerel) |

I did not use the effect `.ini` files beside `enbseries.ini` (dated July and August 2026, after the
release) or any repo named elder-enb, truth-enb or enb-runtime-core, per the author's correction
that the hand-tuned style is the live release.

## 3. The moment in every frame

Lamb, Keel and Sabine on Lamp Quay at night under sodium. Keel, the harbourmaster, stands nearest
and drips; Lamb holds a storm lantern and the Vane's stick; Sabine offers Lamb a pickled egg in
front of the Brine's lit door. Light comes from two sodium heads (one each side of the camera), the
moon behind the row as a cold rim, Lamb's paraffin lantern and the Brine's door. Sodium is
monochromatic, so under it only value survives; colour comes back only near paraffin. That rule is
already the game's mechanic (LOOK-BIBLE 2.3), and all three directions draw it.

Each direction shows the same five frames: the quay moment at 1920 x 1080, the same moment from the
game camera at play size (figures measured from the G-buffer: Keel 201 px, Lamb 189 px with hat
and stick, Sabine 132 px, against the reported Disco Elysium baseline of about 130 px), and a
1024 x 1280 dialogue portrait of each face.

## 4. The characters: grotesque, exaggerated, unmistakable

Three people, three shape languages. Each is built to pass one test: a black silhouette 150 px tall
must say who it is. These records are in `design/art/tools/cast.py` (`HEADS`) and in
`design/art/heads.json`, in the head-tool keys the character forge is adopting, so one sheet can
drive these frames and the game.

| | Absalom Keel | H. Lamb | Sabine Brine |
|---|---|---|---|
| Shape | A wet black column | A coat-hanger | A barrel on tiptoe |
| Height | about 2.3 m with the cap | about 2.0 m with the hat | about 1.5 m |
| Head | A tall egg (0.37 m crown to chin, about 1.6 times natural), long jaw, tiny down-turned mouth | A beak on a stalk: two-segment hooked nose, long chin, bulging heavy-lidded eyes | A wide loaf (0.22 m across), apple cheeks, a grin to the ears, eyes like currants |
| Neck and collar | No visible neck: a 0.17 m standing collar buttoned to the throat, the chin resting on it | The long neck (0.10 m visible, radius 0.036 m) leaning forward over an open white collar | No visible neck: the head sits down in the shoulders on a crossed shawl |
| Posture | Rigidly upright, turns the whole body | Stooped 7 degrees from the hips, head thrust forward | Weight on the balls of the feet, leaning in |
| Silhouette marks | Peaked cap with a funnelled peak; brass speaking trumpet under the arm; a puddle and a constant drip | Wide soft brim tipped back; claims case on the hip; lantern; stick with a tin cockerel | The pickling fork through the bun; one fist on the hip; the egg held out |
| Pale mass on dark | Grey face and the white cap badge on black | Collar and shirt V on slate; oxblood lining in the split | Striped apron and blouse on a black skirt |
| Detail where the eye goes | Waterlogged skin (vertical prune wrinkles), wet pale eyes, grey sideburns, two rows of tarnished buttons, sodden ragged hem, drips from cuffs and peak | Forehead creases, stubble, sallow skin, frayed and mud-splashed hem, worn and patched wool, brass clasps, the cockerel | Ruddy blotched skin, a row of teeth, knitted shawl, stained apron, rolled sleeves, hands like hams |

The head and neck numbers matter for the forge. Its test Keel has a long thin neck; that is the
wrong person. Keel's length is in the coat and the egg of the head, and his neck is hidden in the
collar. Lamb is the one with the neck.

Rules for every other speaking part:

1. **Different skeletons, not different coats.** Vary height from 1.2 m to 2.3 m, head width
   against height, neck from none to long, and stance. Two people who stand together must differ in
   at least two of shape, height and posture.
2. **One idea per head.** Egg, loaf, beak, and so on. Pick it before the costume.
3. **Spend detail on the face, the hands and one prop.** Wear (mud, fray, patch, stain, wet) goes
   where the light lands. Coats stay broad.
4. **Figures keep their own brush and line scale.** Whatever the style, a person is never painted
   or dithered at the same coarseness as the ground around them. This is the rule the play-size
   frames test.
5. **Colour is evidence on people too.** True costume colour (Lamb's oxblood lining, Sabine's red
   stripes) shows only in paraffin or daylight.

## 5. Three directions

### A. Oil and Ink

**In a sentence:** expressionist oil paint over the lit scene, violet and teal shadow planes against
sodium orange, green halftones on skin, and a violet-brown ink line, in the Disco Elysium line of
painted grotesques.

Recipe (`tools/paint.py`): the lit HDR frame is massed into five value planes with soft brushy
edges; shadows turn violet on one side of a form and teal on the other; skin gets olive halftones
and rose lights (verdaccio); strokes are laid coarse to fine along the image's flow (after
Hertzmann's layered painterly rendering), with fine brushes only on people and faces, and coarse
strokes barred from crossing into a person; bristle texture by line-integral convolution; ink from
depth, normal and identity breaks, heavier on silhouettes than folds.

Frames: `design/art/frames/A-oil-and-ink/` (`01-quay-hero.png`, `02-play-size.png`,
`03-portrait-keel.png`, `04-portrait-lamb.png`, `05-portrait-sabine.png`, `00-board.png`).

**My verdict.** The quay frame is the best-looking single picture of the three and the closest to
the author's favourite. The violet and teal shadow planes against sodium orange give the night a
painter's colour, and the ink seats the people in the place. Two faults. At play size it fails the
test this whole page is about: coarse paint smears the figures into the ground (Keel, Lamb and Sabine
become dark lumps in `02-play-size.png`). Barring coarse strokes from people helped in the hero and
not enough at 130 to 200 px; the real fix is the object-anchored painter of section 7.2, which these
frames cannot show. In the portraits the bristle texture reads as a filter laid on a sculpt rather
than as paint that built the face. The approach is right for portraits and plates; the stroke engine
here is not good enough to judge it fairly.

### B. Two Inks and a Lamp

**In a sentence:** an ordered-dither night on a five-ink ramp (ink, plum, rust, sodium, paper) over
a fine scanline grid, with one reserved colour, evidence red, that appears only where paraffin
shows a surface its true colour.

Recipe (`tools/dither.py`): the GlagStone model on the same lit scene. Light becomes a value that
is quantised through an 8x8 Bayer matrix onto the ramp at a working resolution of a half or a third
of the screen; windows print as a sodium and rust dither, only the door, the lantern and the globes
as paper; a one-pixel ink line from the same edges as A; a one-pixel rust rim keeps each person off
the dark; the last row of each working pixel dips to draw the scanline grid.

Frames: `design/art/frames/B-two-inks/`.

**My verdict.** This is the direction with a point of view. It comes straight from the author's
2026-10-15 batch, it looks like nothing else on the quay plates, and it makes the game's central rule
visible: under sodium the frame is two inks and a lamp, and the only true colour is evidence red on
Lamb's lining, Sabine's stripes and her ruddy cheeks, all lit by paraffin. The faces survive the
reduction better than I expected; Keel's waterlogged grey and Sabine's grin read in the dither. At
play size the rust rim keeps all three people readable and distinct (`02-play-size.png`). Its limits:
detail is capped by the working resolution, so a face at hero size is twenty-odd working pixels
wide; the Brine's open door prints as a flat paper block that needs its own dither treatment; and
motion is untested, which matters more here than anywhere (section 8).

### C. Sodium Cinema

**In a sentence:** the scene lit and composed the way the author's Elder ENB composes a night,
with deep desaturated ambient, hot practicals with wet speculars, lamp fog that gathers at its
sources, halation, a shallow depth of field and a 2.39 letterbox.

Recipe (`tools/cine.py`): the ENB night balance from section 2 as light terms; wet reflections
blurred by roughness; single scattering from each lamp in closed form; bloom, a short streak,
halation, depth of field by circle of confusion; a filmic curve, a violet shadow lift, grain.

Frames: `design/art/frames/C-sodium-cinema/`.

**My verdict.** The most legible at play size, and the frame where the author's ENB light
composition shows plainest: deep ambient, hot practicals, speculars on Keel's wet coat, fog
gathering at the lamps. It also exposes the sculpts as sculpts. With nothing between the viewer and
the surfaces, the people read as painted clay figures on a model set, which is the "generic
stylised 3D" the author named. It would need assets far beyond these, and even then its point of
view is cinematography, not a style of its own. I would keep its light balance in whichever
direction is chosen and not choose it as the look.

## 6. Recommendation

I recommend **B, Two Inks and a Lamp**, built on the light balance of C and keeping the painted
plates as its source.

- It answers the second fault outright. It has a point of view, it is traceable line by line to the
  author's own references (the dither stills, GlagStone, the reduced-palette RPG), and it turns
  Low Water's rule that colour is evidence into the picture itself.
- It answers the first fault at play size, where the game is played. The rim and the evidence colour
  keep people apart from the ground and from each other, and the proportions of section 4 do the
  rest.
- It costs least to make consistent. A ramp and a threshold applied to every plate and figure make
  one look by construction, which is what LOOK-UNIFIED asks for. The plates stay paintings: the
  painting supplies value and edges, and the dither prints them.

What would change my mind: a motion test. If world-anchored dither shimmers on a moving camera or
on walking figures at 1080p and no threshold choice fixes it, B fails, and A with the section 7.2
painter becomes the recommendation. I would run that test before anyone re-bakes a plate.

If the author prefers A, the section 7.2 painter is the condition: object-anchored strokes and a
per-figure brush budget, without which A fails at play size as it does here. Under either choice the
blackout and Flats dither that LOOK-BIBLE already uses stays, so a night event can still change the
look, as LOOK-UNIFIED allows.

The author chooses. The comparison sheets are `design/art/frames/00-compare.png` and
`00-portrait-<who>-ABC.png` (the same face in all three).

## 7. In-house tools the chosen direction needs

The author ruled out outside art tools. These are the tools to build, in our own code, with what
each must do. The character forge (CHARACTERS-ART section 6) already covers part of 7.1 and 7.3;
the specs below say what it still needs for this direction.

### 7.1 Head and body sculptor (SDF sculpt and mesh bake)

- Parametric heads in the keys of `design/art/heads.json`: crown, face mass, jaw width and length,
  chin, cheekbones, brow, eyes (size, spacing, upper and lower lid lines, lid tilt), nose (bridge,
  hump, tip, wings), mouth (width, lip fullness, smile curve), ears, jowls, neck length and radius.
  Sliders must reach well past natural: the three principals sit at the edges of these ranges.
- Displacement layers that stay below the shading's alias limit at each level of detail (the
  quay test showed a 3 cm bump aliasing into moire at hero distance): prune wrinkles, creases,
  pores, fray. Amplitude and frequency are authored per level of detail, not one value.
- Bake to the forge's `.lwmesh` at three levels of detail, with curvature, thickness and cavity
  maps baked beside it (the painter and the wear layer read them).
- Per-person neck and collar records are part of the sheet. A head without its collar is not a
  valid sheet.
- Exact distance shapes where shading reads the field: soft shadows and AO built on bounds rather
  than exact distances drew contour rings in these frames until the shadow became hard visibility
  plus a screen-space filter (section 8). The runtime should not inherit that trap.

### 7.2 Brush painter (for direction A; partly needed for any direction)

- Object-anchored strokes: each stroke is stored in a figure's bind space, so a walking person
  carries its own paint and nothing shimmers (CHARACTERS-ART rule 5).
- Coarse-to-fine layers with a per-region brush budget: faces and hands get the finest brush,
  coats a middle one, the plate the coarsest; coarse strokes never cross into a person.
- Flow from the form (cross-contour from the normal) blended with the image flow.
- Painted value planes with a per-direction palette: shadow hues by plane orientation, skin
  halftones, warm lights. The palette is data per place and per hour (the eight time slots).
- Portrait mode: the same painter at portrait scale, writing the Daybook-sketch portraits the
  clean-room spec proposes, one per line of dialogue where the light changes.

### 7.3 Wear and paint layers

- Mud and splash rising from the hem, wet darkening with runs, fray and holes at edges, patches,
  stains settling into folds, tarnish on brass, stubble and blotch on skin. All as per-vertex or
  bind-space paint the forge already carries, driven by the curvature and cavity bakes.
- A stamp tool for patterns (Sabine's stripes, a cap badge) in bind space.

### 7.4 Costume and prop kit

- Hats (wide soft brim, peaked cap with a funnelled peak), collars (standing, wing), coats with a
  split front and lining, shawls crossed and knotted, aprons with bibs, rolled sleeves, boots.
- Props with care: speaking trumpet, storm lantern with bail, claims case with clasps, the Vane's
  stick with its tin cockerel, the pickling fork, the egg. Each prop has a grip axis for the
  fist (CHARACTERS-ART rule 7).
- Hands as a kit: open, fist, grip, offering, knuckles on the hip; finger curl and spread per hand.

### 7.5 Ink line pass

- Lines from depth, normal and identity breaks, weight by role (silhouette heavy, crease light),
  lower crease threshold on skin so lids, nostrils and mouths draw. Hand wobble and breaks anchored
  to the object, not the screen.

### 7.6 Night composition controls (for any direction)

- The ENB-derived balance as data per place and hour: practical intensity and specular, ambient
  level and desaturation, moon desaturation, bounce and AO amounts, fog weighting toward sources.
- Sodium as a monochromatic light that erases hue; paraffin and day as full-colour lights; an
  evidence mask (how much of a pixel's light is paraffin) that B uses for its reserved colour and A
  can use to lift true colour.
- Luminaire cutoffs so sodium pools have edges.

### 7.7 Dither stage (for direction B, and for blackouts under any direction)

- World-anchored Bayer and blue-noise thresholds (the 2026-10-15 notes' open question; stills
  cannot settle it, motion must), a ramp and a reserved colour as data, a rim for figures, a
  scanline grid at the working resolution.

## 8. How the frames were made, and what they do not prove

- One scene, three treatments. A CPU sphere tracer in Python (`design/art/tools/render.py`) writes a
  G-buffer (position, normal, material, character id, character-local position, light visibility,
  AO, and a reflection layer for wet ground); each direction is a different pass over the same
  buffer. Rendered at Idle priority on the CPU; the GPU was not used.
- The characters and the quay are signed-distance sculpts written for these frames
  (`cast.py`, `anatomy.py`, `env.py`). They stand in for the tools in section 7. They show
  proportion, silhouette, light and style; they do not show what a finished sculpt with baked wear
  and a hand-tuned painter would look like, which would be better.
- Defects found and fixed while making them, so the runtime avoids them: a 3 cm bump aliasing into
  moire on the stones; bounding-sphere proxies registering as hits from the far play camera
  (bubbles over every figure); soft shadows and a wide AO reading the bounds as near misses
  (contour rings); a double sRGB conversion in the paint pass; staging where Sabine's own hand hid
  her face.
- These are stills. Nothing here measures shimmer in motion, which matters most for A's strokes
  and B's dither. Section 7 asks for object-anchored strokes and world-anchored dither for that
  reason; neither is tested here.
- These frames are not raw-native runtime output. The passes are written to be portable to it
  (closed-form fog, a G-buffer the engine already has, screen passes); porting is the engine's work.

## 9. Files

- `design/art/frames/<direction>/` five frames and a board per direction; `design/art/frames/00-*`
  comparisons.
- `design/art/heads.json` and `design/art/tools/cast.py` (`HEADS`): the per-person head, neck and
  collar sheet.
- `design/art/tools/`: `sdf.py`, `model.py`, `anatomy.py`, `cast.py`, `env.py`, `scene.py`,
  `render.py`, `shading.py`, `paint.py`, `dither.py`, `cine.py`, `cams.py`, `jobs.py`, `frames.py`,
  `boards.py`, `turn.py`, `preview.py`, `export_heads.py`. Rebuild everything with
  `python jobs.py && python frames.py && python boards.py` from that folder (about 25 minutes on
  the CPU). Images are untracked, as the repo's `.gitignore` sets for all bakes.
