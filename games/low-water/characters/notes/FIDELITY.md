<!-- writing-profile: research -->
# Bodies: the fidelity pass (2026-10-22)

The coordinator's review of `bodies-sheet.png` and `strip-strike-while-walking.png`, under the author's
approval ("All actions and blockers approved"), against the author's bar ("The character bodies and animations
should be done very well", for a Steam release). Measures: `proto/fidelity_check.mjs`, `proto/floor_check.mjs`,
`proto/body_check.mjs`. Captures: `game/capture/fidelity-2026-10-22/before/` and `after/` (the before face
sheet rendered from a clean worktree at 38d9af2 with the same camera).

Targets were set after the first measurement in this pass, the same order ANIM-BOUNDS.md states.

| Measure | Target | Before | After | Met |
|---|---|---|---|---|
| Nose projection past the cheeks, Quota adults | at most 0.35 R (about 4.7 cm) | 0.49 to 0.70 R (6.8 to 9.7 cm) | 0.23 to 0.38 R (3.3 to 5.4 cm) | no: Abel 0.38 |
| Nose projection, children | at most 0.28 R | 0.32 to 0.42 R | 0.16 to 0.24 R | yes |
| Hand length / breadth with thumb / thickness, % of height | 10 to 11.5 / at most 6.5 / at most 2.5 | adults 8.9 to 10.3 / 7.1 to 8.1 / 3.0 to 3.3; children up to 17.9 / 12.4 / 4.6 | 10.9 / 6.0 / 3.0 for everyone | no: thickness (the curled thumb and fingers count in it) |
| Legs through coat or dress, vertices a frame (walk, run, strike) | at most 5 | 6 to 45; Lamb 32 | 0 to 8; captain 26; Lamb 9 (later: 0.0 to 3.2 with clothPush) | no, then yes after the cloth collision |
| Apron band standing off the body | none | a hoop 10 cm off the waist | on the torso | yes (looked at) |
| Apron gap to what is under it / vertices inside | 3 cm / 0 | 16 cm / 20 a frame | 10 to 17 cm / 35 a frame | no; the measure bins coarsely and is not trusted |
| Stick under the floor, Lamb, 400 frames of turn, walk, stop, turn from a run | at most 10 frames, 2 cm | 114 frames, 21 cm | 7 frames, 1.0 cm | yes |
| Rose's hip ratio | 0.42 within 0.03 | 0.376 | 0.418 | yes |
| Foot lock after the body changes (ANIM-BOUNDS.md) | 1 cm | | 0.77 cm over 600 steps | yes |

## What changed

- **Aprons** (`cast/parts.mjs` `apron`): a grid gathered at a band that sits on the torso, opening toward the
  hem, folds of uneven width deepening downward, the hem dipping under each fold, weighted as the dress under it
  moves; a knot and two ties hanging behind. The old apron was an arc tube a fixed distance in front of the hips,
  with its waist strings 10 cm off the body (the bar in profile).
- **Coats and dresses** (`skirt({ fit })`): the cloth in front of and behind a thigh follows that thigh, the top
  comes in to the hips and eases out (no shelf at the waist), more room toward the hem, and the springs keep a
  share of the hem so it swings after the leg. Lamb's coat too: the dark oval on his thigh in the strike strip
  was his trouser thigh pushing through the coat panel.
- **Torso**: a waist under the shoulders, a chest, a squarer section (`square: 2.6`). Knee rolls (`legs({ knees })`).
- **Hands** (`hand2`): sized from height (length 0.108 h, breadth 0.047 h, thickness 0.018 h, from memory,
  moderate confidence); a palm, four fingers of their own lengths and a thumb; a squared fist round the grip axis
  with knuckles and a thumb across. Children's hands had been up to 18 % of their height. Lamb gets them too.
- **Profiles**: Quota noses keep their shape and lose 55 % of their length (`profileFace` in cast/quota.mjs).
- **Children**: `AGES[4].leg` 0.89; a child's stoop held to 2 degrees (Aaron's forward head).
- **Swing smear** (`runtime/figjob.mjs`): the trail turns about the hand on an arc, dense enough to leave no
  gaps; it had been a chord between two frames, drawn as a flat broken triangle.
- **Stick and floor** (`actor.floorTool`): the wrist turns a held tool up out of the ground, eased.
- **Strike over a walk**: the arm goes back to the walk at the cancel point or 35 % into recovery.
- **Hit reaction** (`runtime/feel.mjs`): power capped at 0.95; head, neck, chest, spine and root reduced.

## Still not good enough (looked at)

- **Faces** are the weakest thing on screen. In three-quarter and profile they read as painted balls: round
  skulls, the hair a flat cap, ears too large, eyes like goggles, the cheeks a round pink disc (a colour change
  toward skin did nothing visible: it is the cheek shape catching the light), mouths a smear. The nose change
  helped the profiles and is not the fix. It needs a sculpt pass on the head, not parameter changes.
- **Cloth** is skinned tubes with no collision. Legs still push through on long strides (captain 26 vertices a
  frame). The apron reads as cloth now but stands a little off the dress in profile. Hems swing on springs; there
  is no cloth simulation.
- **The smear** has no gaps but is a flat grey fan, not a painted stroke in the Oil and Ink look.
- **Hit reaction**: the head still goes back about 30 degrees on a heavy blow from the front.
- **Hands** are small at play size, and the fist is a block with bumps.
- **Patched coats** (Aaron, Pell): the patches read as dark blobs on the chest and elbows.
- **Lamb's face** keeps its 9 cm nose: his head is the sculpted forge head that Low Water's portraits hash.
- `fidelity_check.mjs`'s waist-to-shoulder ratio is unreliable (0.09 to 0.95) and is not used.
- Not done from the list: slope foot tilt, the pop count (longer fades). The Quota portraits, glyph portraits and
  the Studio's painted portraits are not rebaked after the nose and body changes.

## The head sculpt and cloth collision (2026-10-22, later the same day)

Bounds before code, controls and results: notes/HEAD-BOUNDS.md. Captures before and after, the same way:
game/capture/sculpt-2026-10-22/ (faces, close-ups, body sheet, mood sheets, head views; heads-old.png is the
old head as the control).

- **Heads** (cast/sculpt.mjs, sculpt_face.mjs, sculpt_hair.mjs): built from planes as signed distance shapes
  and meshed by the forge's narrow-band mesher; eyes meshed exactly inside lids with thickness; one skin with
  the painter's zones as a vertex tint; hair and scarves grown off the skin. 5 of 22 pass every head bound;
  the old head passes for none. Goggle eyes and the missing highlight are gone for all 22. Distinctness fails.
- **Cloth** (rig/body.mjs `clothPush`): legs through coat or dress 0.0 to 3.2 vertices a frame for all 23
  (target 5; the Captain was 26, Lamb 9). Met.

### Still not good enough (looked at)

- The faces now have skulls, sockets, cheekbones, jaws and ears, and hold up in three-quarter and profile,
  but they are not at the bar of a painted portrait. In the live banded light the sockets and the planes under
  the cheekbones fall to the darkest band, so many faces read bruised or masked at play size; women carry a
  dark slash under the cheekbone; the hair reads as a helmet with a hard edge, not locks.
- Children read as small adults: the lower face sits in shadow and the mouth corners show two pale nubs.
- The cast's faces are still too alike in silhouette (distinctness median 0.021 H against 0.03).
- The painted portraits come out darker and gaunter than the old ones; nobody has yet judged them beside the
  Studio's references.
- The cheekbone-hollow and jaw-corner measures did not separate the old head from the new one well enough to
  trust (HEAD-BOUNDS.md, what the controls showed).

## Resume here

Done since the list above was written (HEAD-BOUNDS.md, second pass): faces on their own light ramp, children's
mouths, one idea per face. Open, in order:

1. Distinctness: decide the descriptor (feature-weighted, not outline-normalised) or the bound; the outline
   measure cannot pass without breaking the proportion bounds.
2. Hair as locks with a soft hairline (strand groups in cast/sculpt_hair.mjs), not a shell. Not started.
3. Cheeks a little pink on older men (Abel, Gedge): the ruddy zone and the shadow warmth add up.
4. Rebake the Quota painted and glyph portraits after this pass (they are from the first pass).
5. A painted smear; slope foot tilt; longer fades for the pop count.
